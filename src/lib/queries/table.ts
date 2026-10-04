"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { getSupabase } from "@/lib/supabase/client";
import type { Row, TableName, Update } from "@/lib/supabase/types";

/**
 * Acceso genérico a las tablas. Las filas se leen completas (RLS deja ver solo las propias)
 * y cada escritura actualiza la caché de TanStack Query de forma optimista.
 */

// El cliente tipado de Supabase no admite un nombre de tabla genérico; los tipos se
// reponen en las firmas públicas de este archivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: TableName) => getSupabase().from(name) as any;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function fetchRows<T extends TableName>(name: T, orderBy = "created_at"): Promise<Row<T>[]> {
  const { data, error } = await table(name).select("*").order(orderBy, { ascending: true });
  fail(error);
  return data as Row<T>[];
}

export async function insertRows<T extends TableName>(name: T, rows: Row<T>[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await table(name).insert(rows);
  fail(error);
}

export async function updateRow<T extends TableName>(name: T, id: string, patch: Update<T>): Promise<void> {
  const { error } = await table(name).update(patch).eq("id", id);
  fail(error);
}

export async function deleteRows<T extends TableName>(name: T, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await table(name).delete().in("id", ids);
  fail(error);
}

export function useRows<T extends TableName>(name: T, orderBy = "created_at") {
  return useQuery({ queryKey: [name], queryFn: () => fetchRows(name, orderBy) });
}

type Changes = { [T in TableName]?: (rows: Row<T>[]) => Row<T>[] };
type WriteOptions = {
  /** Otras tablas que cambian en el servidor por esta escritura (cascadas, triggers). */
  alsoInvalidate?: TableName[];
};

/** Escrituras en vuelo por tabla: se revalida una sola vez, cuando termina la última. */
const inFlight = new Map<TableName, number>();

/**
 * Escritura optimista sobre una o varias tablas: aplica los cambios en caché al instante,
 * los revierte (con un aviso) si el servidor falla y revalida al terminar.
 */
export function useWrite() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  return useCallback(
    async (changes: Changes, run: () => Promise<void>, options?: WriteOptions): Promise<boolean> => {
      const tables = Object.keys(changes) as TableName[];
      const previous = tables.map((name) => {
        void queryClient.cancelQueries({ queryKey: [name] });
        const rows = queryClient.getQueryData<Row<TableName>[]>([name]);
        const change = changes[name] as ((rows: Row<TableName>[]) => Row<TableName>[]) | undefined;
        if (rows && change) queryClient.setQueryData([name], change(rows));
        inFlight.set(name, (inFlight.get(name) ?? 0) + 1);
        return [name, rows] as const;
      });
      try {
        await run();
        return true;
      } catch {
        previous.forEach(([name, rows]) => queryClient.setQueryData([name], rows));
        toast(t("error_generic"));
        return false;
      } finally {
        for (const name of tables) {
          const left = (inFlight.get(name) ?? 1) - 1;
          inFlight.set(name, left);
          if (left === 0) void queryClient.invalidateQueries({ queryKey: [name] });
        }
        options?.alsoInvalidate?.forEach((name) => void queryClient.invalidateQueries({ queryKey: [name] }));
      }
    },
    [queryClient, t],
  );
}

type OptimisticOptions<T extends TableName, V> = {
  /** Cómo queda la lista en caché apenas se dispara la mutación. */
  apply: (rows: Row<T>[], variables: V) => Row<T>[];
  /** La escritura real en Supabase. */
  run: (variables: V) => Promise<void>;
  alsoInvalidate?: TableName[];
};

/** Atajo de useWrite para mutaciones sobre una sola tabla. */
export function useOptimistic<T extends TableName, V>(name: T, { apply, run, alsoInvalidate }: OptimisticOptions<T, V>) {
  const write = useWrite();
  return {
    mutate: (variables: V) =>
      void write({ [name]: (rows: Row<T>[]) => apply(rows, variables) } as Changes, () => run(variables), { alsoInvalidate }),
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
