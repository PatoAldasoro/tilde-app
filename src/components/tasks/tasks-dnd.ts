import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

/** Datos que cada fila arrastrable y cada destino publican en @dnd-kit. */
export type DragData = { taskId: string; day: string; daily: boolean };
export type DropData = { type: "row"; taskId: string; day: string } | { type: "day"; day: string; empty: boolean };

const dropData = (container: DroppableContainer) => container.data.current as DropData | undefined;

/**
 * Primero se elige el día (el que está bajo el puntero o, con teclado, el que más se superpone)
 * y dentro de él la fila pendiente más cercana. Un día sin filas se devuelve a sí mismo.
 */
export const taskCollision: CollisionDetection = (args) => {
  const days = args.droppableContainers.filter((container) => dropData(container)?.type === "day");
  const rows = args.droppableContainers.filter((container) => dropData(container)?.type === "row");
  const within = args.pointerCoordinates
    ? pointerWithin({ ...args, droppableContainers: days })
    : rectIntersection({ ...args, droppableContainers: days });
  const dayHit = within[0] ?? closestCenter({ ...args, droppableContainers: days })[0];
  if (!dayHit) return [];
  const day = days.find((container) => container.id === dayHit.id);
  const dayKey = day ? dropData(day)?.day : undefined;
  const dayRows = rows.filter((container) => dropData(container)?.day === dayKey);
  if (dayRows.length === 0) return [dayHit];
  return [closestCenter({ ...args, droppableContainers: dayRows })[0] ?? dayHit];
};

/**
 * Teclado: con la tarea levantada, ↑/↓ saltan de fila en fila (y a los días vacíos).
 * La fila arrastrada queda apenas por debajo (o por encima) del centro del destino, que es
 * como se decide si se inserta después o antes.
 */
export const taskKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return undefined;
  event.preventDefault();
  const { active, collisionRect, droppableContainers, droppableRects } = context;
  if (!active || !collisionRect) return undefined;
  const origin = active.data.current as DragData | undefined;
  const centerY = collisionRect.top + collisionRect.height / 2;
  const down = event.code === "ArrowDown";

  let best: { left: number; center: number } | undefined;
  for (const container of droppableContainers.getEnabled()) {
    const data = dropData(container);
    const rect = droppableRects.get(container.id);
    if (!data || !rect) continue;
    if (data.type === "day" && !data.empty) continue;
    // Las tareas con fecha límite no salen de su día.
    if (origin && !origin.daily && data.day !== origin.day) continue;
    const center = rect.top + rect.height / 2;
    const ahead = down ? center > centerY + 4 : center < centerY - 4;
    if (!ahead) continue;
    if (!best || (down ? center < best.center : center > best.center)) best = { left: rect.left, center };
  }
  if (!best) return undefined;
  return { x: best.left, y: best.center - collisionRect.height / 2 + (down ? 4 : -4) };
};
