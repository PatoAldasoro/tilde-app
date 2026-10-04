import { describe, expect, it } from "vitest";
import {
  canComplete,
  canDropOnDay,
  daysInRange,
  dueStatus,
  moveItem,
  nextSortOrder,
  orderPatches,
  priorityOrderPatches,
  tasksForDay,
  toggleSubtask,
  toggleTask,
  visibilityOn,
  windowStart,
} from "./tasks";
import type { Priority, Subtask, Task } from "./types";

const TODAY = "2026-10-13"; // martes
const NOW = "2026-10-13T15:00:00Z";

let counter = 0;
function task(overrides: Partial<Task> & { done?: string } = {}): Task {
  counter += 1;
  const { done, ...rest } = overrides;
  return {
    id: `t${counter}`,
    user_id: "u1",
    subject_id: null,
    title: `Tarea ${counter}`,
    priority: "none" as Priority,
    planned_date: rest.due_date ? null : TODAY,
    due_date: null,
    lead_days: rest.due_date ? 3 : null,
    sort_order: counter,
    completed_at: done ? `${done}T15:00:00Z` : null,
    completed_on: done ?? null,
    source_calendar_event_id: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    subtasks: [],
    ...rest,
  };
}

const sub = (id: string, done = false): Subtask => ({
  id,
  user_id: "u1",
  task_id: "t",
  title: id,
  sort_order: 1,
  completed_at: done ? NOW : null,
  created_at: NOW,
});

const ids = (list: { task: Task }[]) => list.map((entry) => entry.task.id);

describe("tasksForDay · tarea diaria", () => {
  it("vive en su planned_date", () => {
    const today = task({ planned_date: TODAY });
    const tomorrow = task({ planned_date: "2026-10-14" });
    expect(ids(tasksForDay([today, tomorrow], TODAY, TODAY))).toEqual([today.id]);
    expect(ids(tasksForDay([today, tomorrow], "2026-10-14", TODAY))).toEqual([tomorrow.id]);
    expect(tasksForDay([today, tomorrow], "2026-10-15", TODAY)).toEqual([]);
  });

  it("no aparece en días futuros antes de su fecha", () => {
    const friday = task({ planned_date: "2026-10-16" });
    expect(visibilityOn(friday, TODAY, TODAY)).toBeNull();
    expect(visibilityOn(friday, "2026-10-15", TODAY)).toBeNull();
    expect(visibilityOn(friday, "2026-10-16", TODAY)).toEqual({ carriedDays: 0 });
  });
});

describe("tasksForDay · arrastre", () => {
  it("una tarea de ayer sin completar se ve hoy con 'de ayer'", () => {
    const yesterday = task({ planned_date: "2026-10-12" });
    expect(tasksForDay([yesterday], TODAY, TODAY)).toEqual([{ task: yesterday, carriedDays: 1 }]);
  });

  it("cuenta los días de arrastre ('hace N días')", () => {
    const old = task({ planned_date: "2026-10-08" });
    expect(visibilityOn(old, TODAY, TODAY)).toEqual({ carriedDays: 5 });
  });

  it("el arrastre solo afecta a hoy: no aparece en días futuros ni reescribe el pasado", () => {
    const yesterday = task({ planned_date: "2026-10-12" });
    expect(visibilityOn(yesterday, "2026-10-14", TODAY)).toBeNull();
    // Su día original la sigue mostrando, sin etiqueta de arrastre.
    expect(visibilityOn(yesterday, "2026-10-12", TODAY)).toEqual({ carriedDays: 0 });
    expect(yesterday.planned_date).toBe("2026-10-12");
  });

  it("una arrastrada que se completa queda el día en que se completó y deja de arrastrarse", () => {
    const done = task({ planned_date: "2026-10-10", done: "2026-10-12" });
    expect(visibilityOn(done, "2026-10-12", TODAY)).toEqual({ carriedDays: 0 });
    expect(visibilityOn(done, TODAY, TODAY)).toBeNull();
    expect(visibilityOn(done, "2026-10-11", TODAY)).toBeNull();
    expect(visibilityOn(done, "2026-10-10", TODAY)).toEqual({ carriedDays: 0 });
  });

  it("completada hoy se ve hoy sin etiqueta de arrastre", () => {
    const done = task({ planned_date: "2026-10-11", done: TODAY });
    expect(visibilityOn(done, TODAY, TODAY)).toEqual({ carriedDays: 0 });
  });

  it("completada antes de su día planificado se ve solo el día en que se completó", () => {
    const early = task({ planned_date: "2026-10-15", done: TODAY });
    expect(visibilityOn(early, TODAY, TODAY)).toEqual({ carriedDays: 0 });
    expect(visibilityOn(early, "2026-10-15", TODAY)).toBeNull();
  });
});

describe("tasksForDay · ventana de fecha límite", () => {
  const delivery = () => task({ due_date: "2026-10-20", lead_days: 3 });

  it("empieza en due_date − lead_days", () => {
    expect(windowStart(delivery())).toBe("2026-10-17");
    expect(windowStart(task({ due_date: "2026-10-20", lead_days: 0 }))).toBe("2026-10-20");
  });

  it("aparece todos los días desde el inicio de la ventana hasta la fecha límite", () => {
    const t = delivery();
    expect(visibilityOn(t, "2026-10-16", TODAY)).toBeNull();
    for (const day of ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]) {
      expect(visibilityOn(t, day, TODAY), day).toEqual({ carriedDays: 0 });
    }
    expect(visibilityOn(t, "2026-10-21", TODAY)).toBeNull();
  });

  it("con lead_days 0 aparece solo el día de la entrega", () => {
    const t = task({ due_date: "2026-10-15", lead_days: 0 });
    expect(visibilityOn(t, "2026-10-14", TODAY)).toBeNull();
    expect(visibilityOn(t, "2026-10-15", TODAY)).not.toBeNull();
  });

  it("la misma tarea aparece en varios días de la vista de 7 días", () => {
    const t = task({ due_date: "2026-10-15", lead_days: 3 });
    const days = daysInRange("week", TODAY, null);
    expect(days).toHaveLength(7);
    expect(days.filter((day) => tasksForDay([t], day, TODAY).length > 0)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  });
});

describe("tasksForDay · vencida", () => {
  it("pasada la fecha límite sigue en hoy mientras esté pendiente", () => {
    const overdue = task({ due_date: "2026-10-09", lead_days: 2 });
    expect(visibilityOn(overdue, TODAY, TODAY)).toEqual({ carriedDays: 0 });
    expect(dueStatus(overdue, TODAY)).toEqual({ kind: "overdue" });
  });

  it("no aparece en días futuros ni entre la fecha límite y hoy", () => {
    const overdue = task({ due_date: "2026-10-09", lead_days: 2 });
    expect(visibilityOn(overdue, "2026-10-14", TODAY)).toBeNull();
    expect(visibilityOn(overdue, "2026-10-11", TODAY)).toBeNull();
    // Su ventana original no cambia.
    expect(visibilityOn(overdue, "2026-10-08", TODAY)).toEqual({ carriedDays: 0 });
  });

  it("etiquetas: en N días, mañana, hoy y vencida", () => {
    expect(dueStatus(task({ due_date: "2026-10-20" }), TODAY)).toEqual({ kind: "upcoming", days: 7, soon: false });
    expect(dueStatus(task({ due_date: "2026-10-16" }), TODAY)).toEqual({ kind: "upcoming", days: 3, soon: true });
    expect(dueStatus(task({ due_date: "2026-10-14" }), TODAY)).toEqual({ kind: "tomorrow" });
    expect(dueStatus(task({ due_date: TODAY }), TODAY)).toEqual({ kind: "today" });
    expect(dueStatus(task({ due_date: "2026-10-12" }), TODAY)).toEqual({ kind: "overdue" });
    expect(dueStatus(task({ planned_date: TODAY }), TODAY)).toBeNull();
  });
});

describe("tasksForDay · completada", () => {
  it("una tarea con fecha límite deja de aparecer los días posteriores al que se completó", () => {
    const t = task({ due_date: "2026-10-16", lead_days: 5, done: TODAY }); // ventana: 11 al 16
    expect(visibilityOn(t, TODAY, TODAY)).toEqual({ carriedDays: 0 }); // ese día, en gris
    expect(visibilityOn(t, "2026-10-12", TODAY)).toEqual({ carriedDays: 0 });
    expect(visibilityOn(t, "2026-10-14", TODAY)).toBeNull();
    expect(visibilityOn(t, "2026-10-16", TODAY)).toBeNull();
    expect(dueStatus(t, TODAY)).toEqual({ kind: "done", dueDate: "2026-10-16" });
  });

  it("una vencida que se completa se ve el día en que se completó y no después", () => {
    const t = task({ due_date: "2026-10-09", lead_days: 1, done: "2026-10-12" });
    expect(visibilityOn(t, "2026-10-12", TODAY)).not.toBeNull();
    expect(visibilityOn(t, TODAY, TODAY)).toBeNull();
  });

  it("las completadas bajan al fondo de su día; las pendientes van por sort_order", () => {
    const a = task({ sort_order: 3 });
    const b = task({ sort_order: 1, done: TODAY });
    const c = task({ sort_order: 2 });
    const d = task({ sort_order: 0.5, done: TODAY });
    expect(ids(tasksForDay([a, b, c, d], TODAY, TODAY))).toEqual([c.id, a.id, d.id, b.id]);
  });
});

describe("completar", () => {
  it("una tarea sin subtareas se marca y se desmarca", () => {
    expect(toggleTask(task(), NOW)).toEqual({ completed_at: NOW });
    expect(toggleTask(task({ done: TODAY }), NOW)).toEqual({ completed_at: null });
  });

  it("con subtareas pendientes no se puede completar", () => {
    const t = task({ subtasks: [sub("a", true), sub("b")] });
    expect(canComplete(t)).toBe(false);
    expect(toggleTask(t, NOW)).toBe("blocked");
    expect(toggleTask(task({ subtasks: [sub("a", true), sub("b", true)] }), NOW)).toEqual({ completed_at: NOW });
  });

  it("al completar la última subtarea la tarea se completa sola", () => {
    const t = task({ subtasks: [sub("a", true), sub("b")] });
    expect(toggleSubtask(t, "b", NOW)).toEqual({ subtask: { completed_at: NOW }, task: { completed_at: NOW } });
  });

  it("completar una subtarea que no es la última no toca la principal", () => {
    const t = task({ subtasks: [sub("a"), sub("b")] });
    expect(toggleSubtask(t, "a", NOW)).toEqual({ subtask: { completed_at: NOW } });
  });

  it("al desmarcar cualquier subtarea se desmarca la principal", () => {
    const t = task({ done: TODAY, subtasks: [sub("a", true), sub("b", true)] });
    expect(toggleSubtask(t, "a", NOW)).toEqual({ subtask: { completed_at: null }, task: { completed_at: null } });
    const pending = task({ subtasks: [sub("a", true), sub("b")] });
    expect(toggleSubtask(pending, "a", NOW)).toEqual({ subtask: { completed_at: null } });
  });

  it("ignora una subtarea que no existe", () => {
    expect(toggleSubtask(task({ subtasks: [sub("a")] }), "zzz", NOW)).toBeNull();
  });
});

describe("orden", () => {
  const o = (id: string, sort_order: number) => ({ id, sort_order });

  it("reparte los mismos valores en el orden nuevo y devuelve solo los cambios", () => {
    // a(10) b(20) c(30) → se mueve c al principio
    const desired = moveItem([o("a", 10), o("b", 20), o("c", 30)], o("c", 30), 0);
    expect(desired.map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(orderPatches(desired)).toEqual([o("c", 10), o("a", 20), o("b", 30)]);
    expect(orderPatches([o("a", 10), o("b", 20)])).toEqual([]);
  });

  it("mover una posición solo cambia dos tareas", () => {
    const desired = moveItem([o("a", 1), o("b", 2), o("c", 3), o("d", 4)], o("b", 2), 2);
    expect(orderPatches(desired)).toEqual([o("c", 2), o("b", 3)]);
  });

  it("al entrar una tarea de otro día usa los valores de ambos", () => {
    // día destino: a(5) b(9); llega x(2) para quedar segunda
    const desired = moveItem([o("a", 5), o("b", 9)], o("x", 2), 1);
    expect(orderPatches(desired)).toEqual([o("a", 2), o("x", 5)]);
  });

  it("espacia valores repetidos para poder expresar el orden", () => {
    const patches = orderPatches([o("b", 1), o("a", 1), o("c", 1)]);
    const order = new Map(patches.map((p) => [p.id, p.sort_order]));
    const value = (id: string) => order.get(id) ?? 1;
    expect(value("b")).toBeLessThan(value("a"));
    expect(value("a")).toBeLessThan(value("c"));
  });

  it("moveItem acota el índice", () => {
    expect(moveItem([o("a", 1), o("b", 2)], o("a", 1), 99).map((x) => x.id)).toEqual(["b", "a"]);
    expect(moveItem([o("a", 1), o("b", 2)], o("b", 2), -5).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("ordenar por prioridad: alta primero, sin tocar las completadas y respetando el orden previo", () => {
    const low = task({ priority: "low", sort_order: 1 });
    const high = task({ priority: "high", sort_order: 2 });
    const none = task({ priority: "none", sort_order: 3 });
    const medium = task({ priority: "medium", sort_order: 4 });
    const high2 = task({ priority: "high", sort_order: 5 });
    const done = task({ priority: "high", sort_order: 0, done: TODAY });
    const patches = priorityOrderPatches([low, high, none, medium, high2, done]);
    const order = new Map([low, high, none, medium, high2].map((t) => [t.id, t.sort_order]));
    patches.forEach((p) => order.set(p.id, p.sort_order));
    const sorted = [...order.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    expect(sorted).toEqual([high.id, high2.id, medium.id, low.id, none.id]);
    expect(patches.some((p) => p.id === done.id)).toBe(false);
  });

  it("una tarea nueva va al final", () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([o("a", 3), o("b", 7.5)])).toBe(8.5);
  });
});

describe("mover entre días", () => {
  it("las diarias se pueden mover a otro día; las de fecha límite solo dentro del mismo", () => {
    const daily = task({ planned_date: TODAY });
    const delivery = task({ due_date: "2026-10-16" });
    expect(canDropOnDay(daily, TODAY, "2026-10-14")).toBe(true);
    expect(canDropOnDay(delivery, TODAY, "2026-10-14")).toBe(false);
    expect(canDropOnDay(delivery, TODAY, TODAY)).toBe(true);
  });
});

describe("daysInRange", () => {
  it("hoy, próximos 7 días y fecha puntual", () => {
    expect(daysInRange("today", TODAY, null)).toEqual([TODAY]);
    expect(daysInRange("week", TODAY, null)).toEqual([
      "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19",
    ]);
    expect(daysInRange("date", TODAY, "2026-11-02")).toEqual(["2026-11-02"]);
    expect(daysInRange("date", TODAY, null)).toEqual([TODAY]);
  });
});
