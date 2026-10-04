"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { getSupabase } from "@/lib/supabase/client";
import type { Row, TableName, Update } from "@/lib/supabase/types";

/**
 * Acceso genérico a las tablas. Las filas se leen completas (RLS deja ver solo las propias)
 * y cada mutación actualiza la caché de TanStack Query de forma optimista.
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
  const { error } = await table(name).update(patch).eq(name === "profiles" ? "user_id" : "id", id);
  fail(error);
}

export async function updateRows<T extends TableName>(name: T, patches: { id: string; patch: Update<T> }[]): Promise<void> {
  await Promise.all(patches.map(({ id, patch }) => updateRow(name, id, patch)));
}

export async function deleteRows<T extends TableName>(name: T, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await table(name).delete().in("id", ids);
  fail(error);
}

export function useRows<T extends TableName>(name: T, orderBy = "created_at") {
  return useQuery({ queryKey: [name], queryFn: () => fetchRows(name, orderBy) });
}

type OptimisticOptions<T extends TableName, V> = {
  /** Cómo queda la lista en caché apenas se dispara la mutación. */
  apply: (rows: Row<T>[], variables: V) => Row<T>[];
  /** La escritura real en Supabase. */
  run: (variables: V) => Promise<void>;
  /** Otras tablas que cambian en el servidor por esta mutación (cascadas). */
  alsoInvalidate?: TableName[];
};

/** Mutación con update optimista: aplica en caché, revierte si falla y revalida al terminar. */
export function useOptimistic<T extends TableName, V>(name: T, { apply, run, alsoInvalidate }: OptimisticOptions<T, V>) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  return useMutation({
    mutationKey: [name],
    mutationFn: run,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: [name] });
      const previous = queryClient.getQueryData<Row<T>[]>([name]);
      queryClient.setQueryData<Row<T>[]>([name], (rows) => apply(rows ?? [], variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData([name], context.previous);
      toast(t("error_generic"));
    },
    onSettled: () => {
      // Con varias mutaciones en vuelo se revalida una sola vez, al terminar la última.
      if (queryClient.isMutating({ mutationKey: [name] }) === 1) {
        void queryClient.invalidateQueries({ queryKey: [name] });
      }
      alsoInvalidate?.forEach((other) => void queryClient.invalidateQueries({ queryKey: [other] }));
    },
  });
}

export const patchById = <R extends { id: string }>(rows: R[], id: string, patch: Partial<R>): R[] =>
  rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

export const removeByIds = <R extends { id: string }>(rows: R[], ids: string[]): R[] => {
  const set = new Set(ids);
  return rows.filter((row) => !set.has(row.id));
};

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
