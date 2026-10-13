"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { WriteOp } from "@/lib/domain/outbox";
import { outbox } from "@/lib/offline/outbox";
import { getSupabase } from "@/lib/supabase/client";
import type { Row, TableName, Update } from "@/lib/supabase/types";

/**
 * Acceso genérico a las tablas. Las filas se leen completas (RLS deja ver solo las propias).
 * Cada escritura actualiza la caché de TanStack Query al instante y queda anotada en la cola de
 * cambios pendientes (`lib/offline/outbox.ts`), que la sube cuando hay conexión.
 */

/** Las tablas del usuario y el campo por el que se leen ordenadas. El perfil va aparte (es una sola fila). */
export const TABLE_ORDER = {
  subjects: "sort_order",
  subject_documents: "created_at",
  tasks: "sort_order",
  subtasks: "sort_order",
  calendar_events: "date",
  calendar_feeds: "created_at",
  schedule_blocks: "created_at",
  schedule_events: "created_at",
  schedule_exceptions: "created_at",
  study_sessions: "started_at",
  study_session_tasks: "created_at",
} as const satisfies Record<Exclude<TableName, "profiles">, string>;
export type DataTable = keyof typeof TABLE_ORDER;

// El cliente tipado de Supabase no admite un nombre de tabla genérico; los tipos se
// reponen en las firmas públicas de este archivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: TableName) => getSupabase().from(name) as any;

export async function fetchRows<T extends DataTable>(name: T): Promise<Row<T>[]> {
  // Con cambios sin subir, lo que devuelva el servidor todavía no los tiene: primero se sube la cola.
  await outbox.whenIdle();
  const { data, error } = await table(name).select("*").order(TABLE_ORDER[name], { ascending: true });
  if (error) throw new Error(error.message);
  return data as Row<T>[];
}

/**
 * Las filas de una tabla. Con datos ya cargados (o guardados en el dispositivo) una relectura que
 * falla no es un error para quien mira: `isError` solo avisa si no hay nada para mostrar.
 */
export function useRows<T extends DataTable>(name: T) {
  const query = useQuery({ queryKey: [name], queryFn: () => fetchRows(name) });
  // Lo guardado en el dispositivo puede estar listo antes de que React termine de hidratar una
  // pantalla: hasta entonces se muestra "cargando", igual que en el HTML del servidor.
  const hydrated = useHydrated();
  const { data, isPending, isLoadingError, refetch } = query;
  return useMemo(
    () =>
      hydrated
        ? { data, isPending, isError: isLoadingError, isSuccess: data !== undefined, refetch }
        : { data: undefined, isPending: true, isError: false, isSuccess: false, refetch },
    [hydrated, data, isPending, isLoadingError, refetch],
  );
}

/** Deja en caché todas las tablas, también las de secciones que no se abrieron: así cualquiera se puede usar sin conexión. */
export function prefetchAllTables(queryClient: QueryClient) {
  for (const name of Object.keys(TABLE_ORDER) as DataTable[]) {
    void queryClient.prefetchQuery({ queryKey: [name], queryFn: () => fetchRows(name), staleTime: 5 * 60_000 });
  }
}

// ---------- operaciones (lo que se anota en la cola) ----------

export const insertRows = <T extends DataTable>(name: T, rows: Row<T>[]): WriteOp => ({ kind: "insert", table: name, rows });
export const updateRow = <T extends DataTable>(name: T, id: string, patch: Update<T>): WriteOp => ({ kind: "update", table: name, id, patch });
export const deleteRows = <T extends DataTable>(name: T, ids: string[]): WriteOp => ({ kind: "delete", table: name, ids });

type Changes = { [T in DataTable]?: (rows: Row<T>[]) => Row<T>[] };
type Ops = WriteOp | readonly (WriteOp | null | false | undefined)[];
type WriteOptions = {
  /** Otras tablas que cambian en el servidor por esta escritura (cascadas, triggers). */
  alsoInvalidate?: DataTable[];
};

/**
 * Escritura optimista sobre una o varias tablas: aplica los cambios en caché al instante y anota
 * las operaciones en la cola. Con conexión se suben enseguida; sin conexión quedan guardadas en el
 * dispositivo. Cuando la cola se vacía se relee lo que tocó (si el servidor rechazó algo, ahí se
 * corrige lo que se veía).
 */
export function useWrite() {
  const queryClient = useQueryClient();
  return useCallback(
    (changes: Changes, ops: Ops, options?: WriteOptions): Promise<boolean> => {
      for (const name of Object.keys(changes) as DataTable[]) {
        // Una lectura en vuelo no tiene este cambio: se descarta.
        void queryClient.cancelQueries({ queryKey: [name] });
        const rows = queryClient.getQueryData<Row<DataTable>[]>([name]);
        const change = changes[name] as ((rows: Row<DataTable>[]) => Row<DataTable>[]) | undefined;
        if (rows && change) queryClient.setQueryData([name], change(rows));
      }
      outbox.enqueue(Array.isArray(ops) ? ops : [ops as WriteOp], [...Object.keys(changes), ...(options?.alsoInvalidate ?? [])]);
      return Promise.resolve(true);
    },
    [queryClient],
  );
}

type OptimisticOptions<T extends DataTable, V> = {
  /** Cómo queda la lista en caché apenas se dispara la mutación. */
  apply: (rows: Row<T>[], variables: V) => Row<T>[];
  /** Las operaciones que hay que subir a Supabase. */
  run: (variables: V) => Ops;
  alsoInvalidate?: DataTable[];
};

/** Atajo de useWrite para mutaciones sobre una sola tabla. */
export function useOptimistic<T extends DataTable, V>(name: T, { apply, run, alsoInvalidate }: OptimisticOptions<T, V>) {
  const write = useWrite();
  return {
    mutate: (variables: V) =>
      void write({ [name]: (rows: Row<T>[]) => apply(rows, variables) } as Changes, run(variables), { alsoInvalidate }),
  };
}

export const patchById = <R extends { id: string }>(rows: R[], id: string, patch: Partial<R>): R[] =>
  rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

export const removeByIds = <R extends { id: string }>(rows: R[], ids: string[]): R[] => {
  const set = new Set(ids);
  return rows.filter((row) => !set.has(row.id));
};

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
