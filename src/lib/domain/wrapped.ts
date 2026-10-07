/**
 * "Wrapped": el resumen de una semana, un mes o un cuatrimestre de estudio, para mirar con ganas.
 * Acá solo se calculan los números; cómo se cuentan (y con qué gracia) lo decide la pantalla.
 */
import { addDays, dateInTimeZone, dateParts, diffDays, makeDate, minutesInTimeZone, startOfWeek, weekdayOf, type IsoDate, type Weekday } from "./dates";

export type WrappedPeriod = "week" | "month" | "term";

export type WrappedRange = {
  period: WrappedPeriod;
  from: IsoDate;
  to: IsoDate;
  /** El período inmediatamente anterior, para comparar. */
  previous: { from: IsoDate; to: IsoDate };
  /** Cuatrimestre: 1 = primero (marzo a julio), 2 = segundo (agosto a diciembre), 0 = verano (enero y febrero). */
  term?: { year: number; index: 0 | 1 | 2 };
};

/** Meses (1–12) en que empieza cada tramo del año: verano, primer y segundo cuatrimestre. */
const TERM_STARTS = [1, 3, 8] as const;

function termBounds(year: number, index: number): { from: IsoDate; to: IsoDate } {
  const from = makeDate(year, TERM_STARTS[index], 1);
  const to = index === 2 ? makeDate(year, 12, 31) : makeDate(year, TERM_STARTS[index + 1], 0);
  return { from, to };
}

function shiftTerm(year: number, index: number, delta: number): { year: number; index: 0 | 1 | 2 } {
  const absolute = year * 3 + index + delta;
  return { year: Math.floor(absolute / 3), index: (((absolute % 3) + 3) % 3) as 0 | 1 | 2 };
}

/**
 * El período que contiene a `today`, corrido `offset` períodos (−1 = el anterior).
 * Semana de lunes a domingo; mes calendario; cuatrimestre según el calendario académico argentino.
 */
export function wrappedRange(period: WrappedPeriod, today: IsoDate, offset = 0): WrappedRange {
  if (period === "week") {
    const from = addDays(startOfWeek(today), offset * 7);
    return { period, from, to: addDays(from, 6), previous: { from: addDays(from, -7), to: addDays(from, -1) } };
  }
  const { year, month } = dateParts(today);
  if (period === "month") {
    const from = makeDate(year, month + offset, 1);
    const start = dateParts(from);
    return {
      period,
      from,
      to: makeDate(start.year, start.month + 1, 0),
      previous: { from: makeDate(start.year, start.month - 1, 1), to: makeDate(start.year, start.month, 0) },
    };
  }
  const currentIndex = month >= 8 ? 2 : month >= 3 ? 1 : 0;
  const term = shiftTerm(year, currentIndex, offset);
  const before = shiftTerm(term.year, term.index, -1);
  return { period, ...termBounds(term.year, term.index), previous: termBounds(before.year, before.index), term };
}

export type WrappedSession = {
  id: string;
  subject_id: string | null;
  started_at: string;
  focus_seconds: number;
  preset: string;
  away_count: number;
};

export type WrappedTask = {
  title: string;
  subject_id: string | null;
  planned_date: IsoDate | null;
  due_date: IsoDate | null;
  /** Día (zona del usuario) en que se completó, o null. */
  completed_on: IsoDate | null;
  subtasks: { completed_at: string | null }[];
};

export type Chronotype = "early" | "day" | "evening" | "night";

/** Cómo viene el período, para el mensaje de cierre. */
export type WrappedMood = "fire" | "steady" | "warmup" | "rest";

export type Wrapped = {
  range: WrappedRange;
  /** Sin sesiones ni tareas completadas: no hay nada que contar. */
  empty: boolean;
  focusSeconds: number;
  /**
   * El período todavía no terminó. En ese caso se compara contra el mismo tramo del anterior
   * (los primeros N días), para no medir media semana contra una semana entera.
   */
  inProgress: boolean;
  previousFocusSeconds: number;
  /** Variación contra el período anterior, en porcentaje (null si el anterior fue cero). */
  changePercent: number | null;
  sessions: number;
  /** Días con al menos una sesión, y cuántos días del período ya pasaron. */
  daysStudied: number;
  daysElapsed: number;
  /** Mayor cantidad de días seguidos con sesión. */
  streak: number;
  longestSession: { seconds: number; date: IsoDate; subjectId: string | null } | null;
  topSubject: { subjectId: string; seconds: number; share: number } | null;
  /** Una materia activa a la que no se le dedicó ni una sesión. */
  forgottenSubjectId: string | null;
  bestWeekday: { weekday: Weekday; seconds: number } | null;
  chronotype: Chronotype | null;
  tasksCompleted: number;
  subtasksCompleted: number;
  /** Entregas (tareas con fecha límite) completadas a tiempo y tarde. */
  onTime: number;
  late: number;
  /** La tarea diaria que más días se arrastró antes de completarse. */
  mostCarried: { title: string; days: number } | null;
  /** Minutos de foco por tarea tildada durante una sesión (promedio), o null si no hubo ninguna. */
  minutesPerTask: number | null;
  exams: number;
  examAways: number;
  mood: WrappedMood;
};

export type WrappedInput = {
  sessions: readonly WrappedSession[];
  /** Tareas anotadas en sesiones (una fila por tarea y sesión). */
  sessionTasks: readonly { session_id: string }[];
  tasks: readonly WrappedTask[];
  /** Materias activas. */
  subjects: readonly { id: string }[];
  timeZone: string;
  today: IsoDate;
};

const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);

const inRange = (day: IsoDate | null, range: { from: IsoDate; to: IsoDate }): day is IsoDate => day !== null && day >= range.from && day <= range.to;

function chronotypeOf(minutesOfDay: number): Chronotype {
  const hour = Math.floor(minutesOfDay / 60);
  if (hour >= 5 && hour < 12) return "early";
  if (hour >= 12 && hour < 18) return "day";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

/** El elemento con mayor valor de un mapa (el primero en caso de empate), o null si está vacío. */
function topEntry<K>(totals: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null;
  for (const entry of totals) if (!best || entry[1] > best[1]) best = entry;
  return best;
}

export function buildWrapped(range: WrappedRange, input: WrappedInput): Wrapped {
  const { timeZone, today } = input;
  const dayOf = (session: WrappedSession) => dateInTimeZone(session.started_at, timeZone);
  const sessions = input.sessions.filter((session) => inRange(dayOf(session), range));
  const focusSeconds = sessions.reduce((sum, session) => sum + session.focus_seconds, 0);
  const inProgress = today >= range.from && today < range.to;
  const daysElapsed = Math.max(1, diffDays(range.from, today < range.to ? (today < range.from ? range.from : today) : range.to) + 1);
  const comparable = inProgress ? { from: range.previous.from, to: minDate(addDays(range.previous.from, daysElapsed - 1), range.previous.to) } : range.previous;
  const previousFocusSeconds = input.sessions
    .filter((session) => inRange(dayOf(session), comparable))
    .reduce((sum, session) => sum + session.focus_seconds, 0);

  const bySubject = new Map<string, number>();
  const byWeekday = new Map<Weekday, number>();
  const byChronotype = new Map<Chronotype, number>();
  const days = new Set<IsoDate>();
  let longest: Wrapped["longestSession"] = null;
  for (const session of sessions) {
    const day = dayOf(session);
    days.add(day);
    if (session.subject_id) bySubject.set(session.subject_id, (bySubject.get(session.subject_id) ?? 0) + session.focus_seconds);
    byWeekday.set(weekdayOf(day), (byWeekday.get(weekdayOf(day)) ?? 0) + session.focus_seconds);
    const kind = chronotypeOf(minutesInTimeZone(timeZone, new Date(session.started_at)));
    byChronotype.set(kind, (byChronotype.get(kind) ?? 0) + session.focus_seconds);
    if (!longest || session.focus_seconds > longest.seconds) longest = { seconds: session.focus_seconds, date: day, subjectId: session.subject_id };
  }

  // Racha: la mayor cantidad de días seguidos con al menos una sesión.
  let streak = 0;
  let run = 0;
  let last: IsoDate | null = null;
  for (const day of [...days].sort()) {
    run = last !== null && diffDays(last, day) === 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
    last = day;
  }

  const topSubject = topEntry(bySubject);
  const bestWeekday = topEntry(byWeekday);
  const chronotype = topEntry(byChronotype);
  const forgotten = focusSeconds > 0 && input.subjects.length >= 2 ? (input.subjects.find((subject) => !bySubject.has(subject.id))?.id ?? null) : null;

  const completed = input.tasks.filter((task) => inRange(task.completed_on, range));
  const deliveries = completed.filter((task) => task.due_date !== null);
  const onTime = deliveries.filter((task) => task.completed_on! <= task.due_date!).length;
  let mostCarried: Wrapped["mostCarried"] = null;
  for (const task of completed) {
    if (task.due_date !== null || task.planned_date === null) continue;
    const carried = diffDays(task.planned_date, task.completed_on!);
    if (carried > 0 && (!mostCarried || carried > mostCarried.days)) mostCarried = { title: task.title, days: carried };
  }
  const subtasksCompleted = input.tasks
    .flatMap((task) => task.subtasks)
    .filter((subtask) => subtask.completed_at !== null && inRange(dateInTimeZone(subtask.completed_at, timeZone), range)).length;

  // Minutos por tarea: solo cuentan las sesiones en las que se tildó algo.
  const sessionIds = new Set(sessions.map((session) => session.id));
  const tasksBySession = new Map<string, number>();
  for (const link of input.sessionTasks) {
    if (sessionIds.has(link.session_id)) tasksBySession.set(link.session_id, (tasksBySession.get(link.session_id) ?? 0) + 1);
  }
  const productive = sessions.filter((session) => tasksBySession.has(session.id));
  const tasksInSessions = [...tasksBySession.values()].reduce((sum, count) => sum + count, 0);
  const minutesPerTask = tasksInSessions > 0 ? Math.round(productive.reduce((sum, session) => sum + session.focus_seconds, 0) / 60 / tasksInSessions) : null;

  const examSessions = sessions.filter((session) => session.preset === "exam");
  const changePercent = previousFocusSeconds > 0 ? Math.round(((focusSeconds - previousFocusSeconds) / previousFocusSeconds) * 100) : null;

  // El cierre no contradice a la comparación: "en racha" solo si no se viene estudiando claramente menos.
  let mood: WrappedMood = "steady";
  if (focusSeconds === 0) mood = "rest";
  else if (changePercent !== null && changePercent <= -25) mood = "warmup";
  else if ((changePercent !== null && changePercent >= 15) || ((changePercent === null || changePercent > -10) && days.size / daysElapsed >= 0.6)) mood = "fire";

  return {
    range,
    empty: sessions.length === 0 && completed.length === 0,
    focusSeconds,
    inProgress,
    previousFocusSeconds,
    changePercent,
    sessions: sessions.length,
    daysStudied: days.size,
    daysElapsed,
    streak,
    longestSession: longest,
    topSubject: topSubject && focusSeconds > 0 ? { subjectId: topSubject[0], seconds: topSubject[1], share: Math.round((topSubject[1] / focusSeconds) * 100) } : null,
    forgottenSubjectId: forgotten,
    bestWeekday: bestWeekday ? { weekday: bestWeekday[0], seconds: bestWeekday[1] } : null,
    chronotype: chronotype ? chronotype[0] : null,
    tasksCompleted: completed.length,
    subtasksCompleted,
    onTime,
    late: deliveries.length - onTime,
    mostCarried,
    minutesPerTask,
    exams: examSessions.length,
    examAways: examSessions.reduce((sum, session) => sum + session.away_count, 0),
    mood,
  };
}

/** Comparaciones para darle escala al tiempo de foco: cuántos partidos de fútbol o capítulos de una serie entran. */
export function focusEquivalence(focusSeconds: number): { kind: "matches" | "episodes"; count: number } | null {
  const minutes = focusSeconds / 60;
  if (minutes >= 180) return { kind: "matches", count: Math.round(minutes / 90) };
  if (minutes >= 45) return { kind: "episodes", count: Math.round(minutes / 45) };
  return null;
}
