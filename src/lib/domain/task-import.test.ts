import { describe, expect, it } from "vitest";
import { extractJson, firstVisibleDay, matchSubject, parseImportDate, parseTaskImport, TASK_IMPORT_LIMIT, taskImportExample } from "./task-import";

const today = "2026-10-05";
const subjects = [
  { id: "s-algebra", name: "Álgebra" },
  { id: "s-fisica", name: "Física II" },
  { id: "s-poo", name: "Programación Orientada a Objetos" },
];
const context = { today, subjects, defaultLeadDays: 3 };

function tasksOf(text: string) {
  const result = parseTaskImport(text, context);
  if (!result.ok) throw new Error(`no se pudo importar: ${result.error}`);
  return result;
}

describe("parseTaskImport", () => {
  it("lee el formato recomendado", () => {
    const { tasks, issues, unknownSubjects } = tasksOf(
      JSON.stringify({
        tasks: [
          { title: "Leer el capítulo 3", date: "2026-10-06", subject: "Álgebra", priority: "medium" },
          { title: "Resolver la guía 4", date: "2026-10-07", subject: "fisica ii", priority: "high", subtasks: ["Ej. 1 a 5", " ", "Ej. 6 a 10"] },
        ],
      }),
    );
    expect(issues).toEqual([]);
    expect(unknownSubjects).toEqual([]);
    expect(tasks).toEqual([
      { title: "Leer el capítulo 3", planned_date: "2026-10-06", due_date: null, lead_days: null, priority: "medium", subject_id: "s-algebra", subtasks: [] },
      { title: "Resolver la guía 4", planned_date: "2026-10-07", due_date: null, lead_days: null, priority: "high", subject_id: "s-fisica", subtasks: ["Ej. 1 a 5", "Ej. 6 a 10"] },
    ]);
  });

  it("una entrega usa la anticipación indicada, la que surge de `date` o la del perfil", () => {
    const { tasks } = tasksOf(
      JSON.stringify([
        { title: "TP 1", due: "2026-10-20" },
        { title: "TP 2", due: "2026-10-20", date: "2026-10-15" },
        { title: "TP 3", due: "2026-10-20", lead_days: 10 },
        { title: "TP 4", due: "2026-10-20", date: "2026-10-25" },
        { title: "TP 5", due: "2026-12-30", lead_days: 400 },
      ]),
    );
    expect(tasks.map((task) => [task.planned_date, task.due_date, task.lead_days])).toEqual([
      [null, "2026-10-20", 3],
      [null, "2026-10-20", 5],
      [null, "2026-10-20", 10],
      [null, "2026-10-20", 3],
      [null, "2026-12-30", 60],
    ]);
  });

  it("acepta tareas agrupadas por día, por fecha y como texto suelto", () => {
    const byDay = tasksOf(
      JSON.stringify({ days: [{ date: "2026-10-06", tasks: ["Repasar teoría", { title: "Práctica 2", priority: "alta" }] }, { date: "07/10", tasks: [{ tarea: "Simulacro" }] }] }),
    );
    expect(byDay.tasks.map((task) => [task.title, task.planned_date, task.priority])).toEqual([
      ["Repasar teoría", "2026-10-06", "none"],
      ["Práctica 2", "2026-10-06", "high"],
      ["Simulacro", "2026-10-07", "none"],
    ]);

    const byDate = tasksOf(JSON.stringify({ "2026-10-08": ["Uno", "Dos"], "2026-10-09": [{ title: "Tres" }] }));
    expect(byDate.tasks.map((task) => [task.title, task.planned_date])).toEqual([
      ["Uno", "2026-10-08"],
      ["Dos", "2026-10-08"],
      ["Tres", "2026-10-09"],
    ]);

    expect(tasksOf('["Comprar el libro"]').tasks[0]).toMatchObject({ title: "Comprar el libro", planned_date: today });
  });

  it("entiende claves en español y fechas escritas de otras formas", () => {
    const { tasks } = tasksOf(
      JSON.stringify({
        tareas: [
          { titulo: "Resumen", fecha: "mañana", materia: "Álgebra", prioridad: "baja", subtareas: [{ titulo: "Unidad 1" }] },
          { Título: "Entrega final", Vence: "20/10/2026", Anticipación: 7 },
        ],
      }),
    );
    expect(tasks[0]).toMatchObject({ title: "Resumen", planned_date: "2026-10-06", priority: "low", subject_id: "s-algebra", subtasks: ["Unidad 1"] });
    expect(tasks[1]).toMatchObject({ title: "Entrega final", planned_date: null, due_date: "2026-10-20", lead_days: 7 });
  });

  it("saca el JSON de una respuesta con texto y bloque de código", () => {
    const text = 'Acá va tu plan:\n\n```json\n{ "tasks": [{ "title": "Leer", "date": "2026-10-06" }] }\n```\n\n¡Éxitos!';
    expect(tasksOf(text).tasks).toHaveLength(1);
    expect(tasksOf('Plan: [{"title": "Leer"}] listo').tasks).toHaveLength(1);
  });

  it("informa lo que no pudo importar sin frenar el resto", () => {
    const { tasks, issues, unknownSubjects } = tasksOf(
      JSON.stringify({
        tasks: [
          { title: "Bien", date: "2026-10-06", subject: "Química" },
          { date: "2026-10-06" },
          { title: "Fecha rara", date: "32/13/2026" },
          { title: "Entrega rara", due: "pronto" },
          42,
          null,
        ],
      }),
    );
    expect(tasks.map((task) => task.title)).toEqual(["Bien", "42"]);
    expect(tasks[0].subject_id).toBeNull();
    expect(unknownSubjects).toEqual(["Química"]);
    expect(issues.map((issue) => [issue.position, issue.code])).toEqual([
      [2, "no_title"],
      [3, "bad_date"],
      [4, "bad_due"],
      [6, "not_a_task"],
    ]);
  });

  it("recorta títulos largos y limita las subtareas", () => {
    const { tasks } = tasksOf(JSON.stringify([{ title: `  ${"a".repeat(400)}  `, subtasks: Array.from({ length: 80 }, (_, index) => `Paso ${index}`) }]));
    expect(tasks[0].title).toHaveLength(300);
    expect(tasks[0].subtasks).toHaveLength(50);
  });

  it("rechaza lo que no es un plan", () => {
    expect(parseTaskImport("   ", context)).toEqual({ ok: false, error: "empty" });
    expect(parseTaskImport("hola, no soy JSON", context)).toEqual({ ok: false, error: "invalid_json" });
    expect(parseTaskImport('"solo un texto"', context)).toEqual({ ok: false, error: "invalid_json" });
    expect(parseTaskImport("[]", context)).toEqual({ ok: false, error: "no_tasks" });
    expect(parseTaskImport('{ "tasks": [] }', context)).toEqual({ ok: false, error: "no_tasks" });
    const many = JSON.stringify(Array.from({ length: TASK_IMPORT_LIMIT + 1 }, (_, index) => `Tarea ${index}`));
    expect(parseTaskImport(many, context)).toEqual({ ok: false, error: "too_many" });
  });

  it("el ejemplo del formato se puede importar tal cual", () => {
    const { tasks, issues, unknownSubjects } = tasksOf(taskImportExample(today, "Álgebra"));
    expect(issues).toEqual([]);
    expect(unknownSubjects).toEqual([]);
    expect(tasks).toHaveLength(3);
    expect(tasks[2]).toMatchObject({ due_date: "2026-10-11", lead_days: 3 });
  });
});

describe("ayudas", () => {
  it("parseImportDate", () => {
    expect(parseImportDate("2026-10-06", today)).toBe("2026-10-06");
    expect(parseImportDate("2026-10-06T10:00:00Z", today)).toBe("2026-10-06");
    expect(parseImportDate("6/10", today)).toBe("2026-10-06");
    expect(parseImportDate("Hoy", today)).toBe(today);
    expect(parseImportDate("tomorrow", today)).toBe("2026-10-06");
    expect(parseImportDate("2026-02-30", today)).toBeNull();
    expect(parseImportDate({}, today)).toBeNull();
  });

  it("matchSubject: exacto, parcial único o nada", () => {
    expect(matchSubject("ALGEBRA", subjects)).toBe("s-algebra");
    expect(matchSubject("Programación", subjects)).toBe("s-poo");
    expect(matchSubject("Física", subjects)).toBe("s-fisica");
    expect(matchSubject("Historia", subjects)).toBeNull();
    // Ambiguo: dos materias lo contienen.
    expect(matchSubject("a", subjects)).toBeNull();
  });

  it("extractJson devuelve undefined si no hay objeto ni lista", () => {
    expect(extractJson("nada")).toBeUndefined();
    expect(extractJson("{ roto")).toBeUndefined();
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("firstVisibleDay", () => {
    expect(firstVisibleDay({ planned_date: "2026-10-08", due_date: null, lead_days: null }, today)).toBe("2026-10-08");
    expect(firstVisibleDay({ planned_date: null, due_date: "2026-10-20", lead_days: 5 }, today)).toBe("2026-10-15");
  });
});
