import { describe, expect, it } from "vitest";
import { buildWrapped, focusEquivalence, wrappedRange, type WrappedInput, type WrappedSession, type WrappedTask } from "./wrapped";

const BA = "America/Argentina/Buenos_Aires";
const today = "2026-10-07"; // miércoles

describe("wrappedRange", () => {
  it("semana: de lunes a domingo, con la anterior para comparar", () => {
    expect(wrappedRange("week", today)).toEqual({ period: "week", from: "2026-10-05", to: "2026-10-11", previous: { from: "2026-09-28", to: "2026-10-04" } });
    expect(wrappedRange("week", today, -1)).toMatchObject({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("mes: calendario, también al cruzar de año", () => {
    expect(wrappedRange("month", today)).toEqual({ period: "month", from: "2026-10-01", to: "2026-10-31", previous: { from: "2026-09-01", to: "2026-09-30" } });
    expect(wrappedRange("month", "2026-01-15", -1)).toMatchObject({ from: "2025-12-01", to: "2025-12-31", previous: { from: "2025-11-01", to: "2025-11-30" } });
    expect(wrappedRange("month", "2028-03-10", -1)).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("cuatrimestre: marzo a julio, agosto a diciembre, y el verano", () => {
    expect(wrappedRange("term", today)).toEqual({
      period: "term",
      from: "2026-08-01",
      to: "2026-12-31",
      previous: { from: "2026-03-01", to: "2026-07-31" },
      term: { year: 2026, index: 2 },
    });
    expect(wrappedRange("term", "2026-05-20")).toMatchObject({ from: "2026-03-01", to: "2026-07-31", previous: { from: "2026-01-01", to: "2026-02-28" }, term: { year: 2026, index: 1 } });
    expect(wrappedRange("term", "2026-02-10")).toMatchObject({ from: "2026-01-01", to: "2026-02-28", previous: { from: "2025-08-01", to: "2025-12-31" }, term: { year: 2026, index: 0 } });
    expect(wrappedRange("term", today, 1)).toMatchObject({ from: "2027-01-01", to: "2027-02-28", term: { year: 2027, index: 0 } });
  });
});

/** Sesión que empieza el día y la hora dados en Buenos Aires (UTC−3). */
const session = (id: string, day: string, time: string, minutes: number, subject: string | null, extra: Partial<WrappedSession> = {}): WrappedSession => ({
  id,
  subject_id: subject,
  started_at: new Date(`${day}T${time}:00-03:00`).toISOString(),
  focus_seconds: minutes * 60,
  preset: "25-5",
  away_count: 0,
  ...extra,
});

const task = (title: string, patch: Partial<WrappedTask>): WrappedTask => ({ title, subject_id: null, planned_date: null, due_date: null, completed_on: null, subtasks: [], ...patch });

const base: WrappedInput = {
  sessions: [
    session("a", "2026-10-05", "09:00", 60, "fisica"),
    session("b", "2026-10-05", "21:00", 30, "algebra"),
    session("c", "2026-10-06", "20:00", 90, "fisica"),
    session("d", "2026-10-07", "19:30", 120, "fisica", { preset: "exam", away_count: 3 }),
    // Semana anterior
    session("e", "2026-09-30", "10:00", 100, "algebra"),
    // Otra semana, más vieja
    session("f", "2026-09-15", "10:00", 500, "quimica"),
  ],
  sessionTasks: [{ session_id: "a" }, { session_id: "a" }, { session_id: "c" }, { session_id: "e" }],
  tasks: [
    task("Guía 4", { planned_date: "2026-10-02", completed_on: "2026-10-06", subtasks: [{ completed_at: "2026-10-06T15:00:00Z" }, { completed_at: "2026-10-01T15:00:00Z" }, { completed_at: null }] }),
    task("TP 1", { due_date: "2026-10-07", completed_on: "2026-10-06" }),
    task("TP 2", { due_date: "2026-10-05", completed_on: "2026-10-07" }),
    task("Leer", { planned_date: "2026-10-06", completed_on: "2026-10-06" }),
    task("Vieja", { planned_date: "2026-09-20", completed_on: "2026-09-21" }),
    task("Pendiente", { planned_date: "2026-10-06" }),
  ],
  subjects: [{ id: "fisica" }, { id: "algebra" }, { id: "quimica" }],
  timeZone: BA,
  today,
};

describe("buildWrapped", () => {
  const wrapped = buildWrapped(wrappedRange("week", today), base);

  it("suma el foco del período y lo compara con el anterior", () => {
    expect(wrapped.focusSeconds).toBe(300 * 60);
    expect(wrapped.previousFocusSeconds).toBe(100 * 60);
    expect(wrapped.changePercent).toBe(200);
    expect(wrapped.sessions).toBe(4);
    expect(wrapped.empty).toBe(false);
  });

  it("días estudiados, racha y días transcurridos del período", () => {
    expect(wrapped.daysStudied).toBe(3);
    expect(wrapped.streak).toBe(3);
    expect(wrapped.daysElapsed).toBe(3); // lunes, martes y miércoles
  });

  it("la materia estrella, la olvidada, el mejor día y la hora preferida", () => {
    expect(wrapped.topSubject).toEqual({ subjectId: "fisica", seconds: 270 * 60, share: 90 });
    expect(wrapped.forgottenSubjectId).toBe("quimica");
    expect(wrapped.bestWeekday).toEqual({ weekday: 3, seconds: 120 * 60 });
    expect(wrapped.chronotype).toBe("evening");
    expect(wrapped.longestSession).toEqual({ seconds: 120 * 60, date: "2026-10-07", subjectId: "fisica" });
  });

  it("tareas: completadas, a tiempo, tarde y la más pateada", () => {
    expect(wrapped.tasksCompleted).toBe(4);
    expect(wrapped.subtasksCompleted).toBe(1);
    expect([wrapped.onTime, wrapped.late]).toEqual([1, 1]);
    expect(wrapped.mostCarried).toEqual({ title: "Guía 4", days: 4 });
  });

  it("minutos de foco por tarea tildada en sesión, y los exámenes", () => {
    // Sesiones a (60 min, 2 tareas) y c (90 min, 1 tarea): 150 min / 3.
    expect(wrapped.minutesPerTask).toBe(50);
    expect([wrapped.exams, wrapped.examAways]).toEqual([1, 3]);
    expect(wrapped.mood).toBe("fire");
  });

  it("una sesión cuenta en el día de la zona del usuario, no en UTC", () => {
    // Domingo 04/10 a las 22:30 de Buenos Aires ya es lunes 05/10 en UTC: sigue siendo de la semana anterior.
    const input = { ...base, sessions: [session("x", "2026-10-04", "22:30", 40, null)] };
    const thisWeek = buildWrapped(wrappedRange("week", today), input);
    expect(thisWeek.focusSeconds).toBe(0);
    expect(thisWeek.chronotype).toBeNull();
    const lastWeek = buildWrapped(wrappedRange("week", today, -1), input);
    expect(lastWeek.focusSeconds).toBe(40 * 60);
    expect(lastWeek.chronotype).toBe("evening");
  });

  it("con el período en curso, compara contra el mismo tramo del anterior", () => {
    // Miércoles: la semana pasada solo cuenta de lunes a miércoles. El jueves 01/10 queda afuera.
    const input = { ...base, sessions: [session("a", "2026-10-05", "09:00", 60, "fisica"), session("p1", "2026-09-29", "10:00", 30, null), session("p2", "2026-10-01", "10:00", 300, null)] };
    const current = buildWrapped(wrappedRange("week", today), input);
    expect(current).toMatchObject({ inProgress: true, previousFocusSeconds: 30 * 60, changePercent: 100 });
    // Una semana ya cerrada se compara entera con la anterior.
    const closed = buildWrapped(wrappedRange("week", today, -1), input);
    expect(closed).toMatchObject({ inProgress: false, focusSeconds: 330 * 60, previousFocusSeconds: 0, changePercent: null });
  });

  it("el cierre no contradice a la comparación", () => {
    // Estudió todos los días, pero bastante menos que antes: paso firme, no "en racha".
    const input = {
      ...base,
      sessions: [
        session("a", "2026-10-05", "09:00", 30, null),
        session("b", "2026-10-06", "09:00", 30, null),
        session("c", "2026-10-07", "09:00", 30, null),
        session("p", "2026-09-28", "09:00", 110, null),
      ],
    };
    expect(buildWrapped(wrappedRange("week", today), input)).toMatchObject({ changePercent: -18, mood: "steady" });
  });

  it("un período sin nada queda vacío y en descanso", () => {
    const empty = buildWrapped(wrappedRange("week", today, 3), base);
    expect(empty).toMatchObject({ empty: true, focusSeconds: 0, sessions: 0, streak: 0, topSubject: null, forgottenSubjectId: null, minutesPerTask: null, mood: "rest", changePercent: null });
  });

  it("si se estudió menos que antes, toca remontar; sin período anterior no se compara", () => {
    const less = buildWrapped(wrappedRange("week", today), { ...base, sessions: [session("a", "2026-10-05", "09:00", 20, "fisica"), session("e", "2026-09-30", "10:00", 100, "algebra")] });
    expect(less.changePercent).toBe(-80);
    expect(less.mood).toBe("warmup");
    const first = buildWrapped(wrappedRange("month", today), { ...base, sessions: [session("a", "2026-10-05", "09:00", 20, "fisica")] });
    expect(first.changePercent).toBeNull();
    expect(first.mood).toBe("steady");
  });

  it("el mes y el cuatrimestre toman sus propios rangos", () => {
    expect(buildWrapped(wrappedRange("month", today), base).focusSeconds).toBe(300 * 60);
    expect(buildWrapped(wrappedRange("term", today), base).focusSeconds).toBe(900 * 60);
    expect(buildWrapped(wrappedRange("month", today, -1), base)).toMatchObject({ focusSeconds: 600 * 60, tasksCompleted: 1, daysElapsed: 30 });
  });
});

describe("focusEquivalence", () => {
  it("le da escala al tiempo: capítulos o partidos", () => {
    expect(focusEquivalence(20 * 60)).toBeNull();
    expect(focusEquivalence(90 * 60)).toEqual({ kind: "episodes", count: 2 });
    expect(focusEquivalence(9 * 3600)).toEqual({ kind: "matches", count: 6 });
  });
});
