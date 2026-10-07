"use client";

import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { orderPatches, type OrderPatch } from "@/lib/domain/tasks";
import type { SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type SortableSubjectsProps = {
  subjects: SubjectRow[];
  /** Dibuja la tarjeta de una materia; `grip` es el asa que hay que ubicar adentro. */
  renderCard: (subject: SubjectRow, grip: ReactNode, className?: string) => ReactNode;
  onReorder: (patches: OrderPatch[]) => void;
  /** Lo que va al final de la grilla y no se mueve (la tarjeta de "Agregar materia"). */
  children?: ReactNode;
};

/**
 * Grilla de materias que se reordena arrastrando: con el mouse o el dedo desde cualquier parte de
 * la tarjeta, o con el teclado desde el asa (Espacio la levanta, las flechas la mueven).
 */
export function SortableSubjects({ subjects, renderCard, onReorder, children }: SortableSubjectsProps) {
  const t = useTranslations();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    // Con distancia mínima: un clic sin mover sigue abriendo la materia.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = subjects.map((subject) => subject.id);
  const nameOf = (id: string | number) => subjects.find((subject) => subject.id === id)?.name ?? "";
  const positionOf = (id: string | number) => ids.indexOf(String(id)) + 1;
  const dragging = subjects.find((subject) => subject.id === draggingId);

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(orderPatches(arrayMove(subjects, from, to)));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setDraggingId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: t("subject_dnd_instructions") },
        announcements: {
          onDragStart: ({ active }) => t("dnd_picked", { title: nameOf(active.id) }),
          onDragOver: ({ over }) => (over ? t("subject_dnd_over", { position: positionOf(over.id), total: ids.length }) : undefined),
          onDragEnd: ({ active, over }) =>
            over ? t("subject_dnd_dropped", { name: nameOf(active.id), position: positionOf(over.id), total: ids.length }) : t("dnd_cancelled"),
          onDragCancel: () => t("dnd_cancelled"),
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="subject-grid">
          {subjects.map((subject) => (
            <SortableSubject key={subject.id} subject={subject} renderCard={renderCard} />
          ))}
          {children}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null} className="drag-overlay">
        {dragging
          ? renderCard(
              dragging,
              <span className="grip card-grip opacity-100" aria-hidden="true">
                <GripVertical size={18} />
              </span>,
              "is-lifted",
            )
          : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableSubject({ subject, renderCard }: { subject: SubjectRow; renderCard: SortableSubjectsProps["renderCard"] }) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: subject.id });
  return (
    // Los eventos van en toda la tarjeta (arrastrar desde cualquier parte); el teclado solo actúa desde el asa.
    <div ref={setNodeRef} className={cn("sortable-subject", isDragging && "is-dragging-source")} style={{ transform: CSS.Translate.toString(transform), transition }} {...listeners}>
      {renderCard(
        subject,
        <button type="button" ref={setActivatorNodeRef} className="grip card-grip" {...attributes} aria-label={t("subject_drag", { name: subject.name })}>
          <GripVertical size={18} />
        </button>,
      )}
    </div>
  );
}
