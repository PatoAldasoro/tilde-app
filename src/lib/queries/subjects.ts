"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import { bySubjectOrder } from "@/lib/domain/subjects";
import { nextSortOrder, type OrderPatch } from "@/lib/domain/tasks";
import type { SubjectFormValues } from "@/lib/schemas";
import type { SubjectDocumentRow, SubjectRow, Update } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useOptimistic, useRows } from "./table";

/** Las materias, en el orden elegido por el usuario. */
export function useSubjects() {
  const query = useRows("subjects", "sort_order");
  // La caché se toca de forma optimista (altas, reordenar): el orden se vuelve a aplicar acá.
  const data = useMemo(() => (query.data ? [...query.data].sort(bySubjectOrder) : undefined), [query.data]);
  return { ...query, data };
}

export function useSubjectMutations() {
  const user = useSessionUser();
  const queryClient = useQueryClient();

  const create = useOptimistic("subjects", {
    apply: (rows, row: SubjectRow) => [...rows, row],
    run: (row) => insertRows("subjects", [row]),
  });
  const update = useOptimistic("subjects", {
    apply: (rows, { id, patch }: { id: string; patch: Update<"subjects"> }) => patchById(rows, id, patch as Partial<SubjectRow>),
    run: ({ id, patch }) => updateRow("subjects", id, patch),
  });
  const reorder = useOptimistic("subjects", {
    apply: (rows, patches: OrderPatch[]) => {
      const orders = new Map(patches.map((patch) => [patch.id, patch.sort_order]));
      return rows.map((row) => (orders.has(row.id) ? { ...row, sort_order: orders.get(row.id)! } : row));
    },
    run: async (patches) => {
      await Promise.all(patches.map((patch) => updateRow("subjects", patch.id, { sort_order: patch.sort_order })));
    },
  });
  const remove = useOptimistic("subjects", {
    apply: (rows, id: string) => removeByIds(rows, [id]),
    run: (id) => deleteRows("subjects", [id]),
    // La base borra en cascada tareas, horarios, fechas y documentos de la materia.
    alsoInvalidate: ["tasks", "subtasks", "calendar_events", "schedule_blocks", "schedule_exceptions", "subject_documents", "study_sessions"],
  });

  return {
    create(values: SubjectFormValues): SubjectRow {
      const now = nowIso();
      const row: SubjectRow = {
        id: newId(),
        user_id: user.id,
        ...values,
        // Una materia nueva va al final.
        sort_order: nextSortOrder(queryClient.getQueryData<SubjectRow[]>(["subjects"]) ?? []),
        grade_course: null,
        grade_final: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      };
      create.mutate(row);
      return row;
    },
    update: (id: string, patch: Update<"subjects">) => update.mutate({ id, patch }),
    /** Guarda un orden nuevo (ver orderPatches): solo se escriben las materias que cambiaron de lugar. */
    reorder: (patches: OrderPatch[]) => {
      if (patches.length > 0) reorder.mutate(patches);
    },
    setArchived: (id: string, archived: boolean) => update.mutate({ id, patch: { archived_at: archived ? nowIso() : null } }),
    remove: (id: string) => remove.mutate(id),
  };
}

export function useDocuments() {
  return useRows("subject_documents");
}

type NewDocument = Pick<SubjectDocumentRow, "subject_id" | "source" | "name" | "url" | "drive_file_id" | "mime_type">;

export function useDocumentMutations() {
  const user = useSessionUser();

  const create = useOptimistic("subject_documents", {
    apply: (rows, added: SubjectDocumentRow[]) => [...rows, ...added],
    run: (added) => insertRows("subject_documents", added),
  });
  const rename = useOptimistic("subject_documents", {
    apply: (rows, { id, name }: { id: string; name: string }) => patchById(rows, id, { name }),
    run: ({ id, name }) => updateRow("subject_documents", id, { name }),
  });
  const remove = useOptimistic("subject_documents", {
    apply: (rows, id: string) => removeByIds(rows, [id]),
    run: (id) => deleteRows("subject_documents", [id]),
  });

  return {
    add(documents: NewDocument[]) {
      const base = Date.now();
      // created_at escalonado para conservar el orden en que se eligieron.
      create.mutate(
        documents.map((document, index) => ({
          id: newId(),
          user_id: user.id,
          created_at: new Date(base + index).toISOString(),
          ...document,
        })),
      );
    },
    rename: (id: string, name: string) => rename.mutate({ id, name }),
    remove: (id: string) => remove.mutate(id),
    restore: (row: SubjectDocumentRow) => create.mutate([row]),
  };
}
