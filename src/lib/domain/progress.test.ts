import { describe, expect, it } from "vitest";
import { progressOf, subjectProgress, taskCounts, taskUnits } from "./progress";

const task = (done: boolean, subtasks: boolean[] = [], subject_id: string | null = null) => ({
  subject_id,
  completed_at: done ? "2026-10-13T12:00:00Z" : null,
  subtasks: subtasks.map((d) => ({ completed_at: d ? "2026-10-13T12:00:00Z" : null })),
});

describe("taskUnits", () => {
  it("una tarea sin subtareas cuenta como 1", () => {
    expect(taskUnits(task(false))).toEqual({ done: 0, total: 1 });
    expect(taskUnits(task(true))).toEqual({ done: 1, total: 1 });
  });

  it("una tarea con subtareas cuenta por sus subtareas, sin sumar la principal", () => {
    expect(taskUnits(task(false, [true, false, false]))).toEqual({ done: 1, total: 3 });
    expect(taskUnits(task(true, [true, true]))).toEqual({ done: 2, total: 2 });
  });
});

describe("progressOf", () => {
  it("sin unidades el progreso es 100 %", () => {
    expect(progressOf([])).toEqual({ percent: 100, done: 0, total: 0 });
  });

  it("porcentaje = unidades completadas / unidades totales", () => {
    // 1 + 3 unidades; hechas: 1 + 1
    expect(progressOf([task(true), task(false, [true, false, false])])).toEqual({ percent: 50, done: 2, total: 4 });
    expect(progressOf([task(false), task(false)]).percent).toBe(0);
    expect(progressOf([task(true), task(true, [true])]).percent).toBe(100);
  });

  it("no muestra 100 % mientras falte una unidad", () => {
    const tasks = [...Array.from({ length: 199 }, () => task(true)), task(false)];
    expect(progressOf(tasks).percent).toBe(99);
  });
});

describe("subjectProgress", () => {
  it("usa todas las tareas de la materia y solo esas", () => {
    const tasks = [task(true, [], "a"), task(false, [], "a"), task(false, [], "b"), task(false)];
    expect(subjectProgress(tasks, "a")).toEqual({ percent: 50, done: 1, total: 2 });
    expect(subjectProgress(tasks, "b").percent).toBe(0);
    expect(subjectProgress(tasks, "sin-tareas")).toEqual({ percent: 100, done: 0, total: 0 });
  });
});

describe("taskCounts", () => {
  it("cuenta tareas, no unidades", () => {
    expect(taskCounts([task(true, [true, true]), task(false, [true, false])])).toEqual({ done: 1, total: 2 });
  });
});
