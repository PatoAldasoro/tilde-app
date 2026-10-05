/**
 * npm run seed:demo
 *
 * Crea (o recrea desde cero) la cuenta demo y le carga datos de ejemplo: materias, documentos,
 * horario, tareas, fechas del calendario, notas y sesiones de estudio. Los datos son los del
 * prototipo de diseño, reubicados alrededor de DEMO_TODAY.
 *
 * Usa el service role solo para crear el usuario; los datos se insertan con la sesión del
 * propio usuario, pasando por RLS. Se niega a correr fuera de un Supabase local o de test.
 */
import { addDays, diffDays } from "../src/lib/domain/dates";
import type { Database } from "../src/lib/supabase/database.types";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD, DEMO_TODAY } from "./lib/demo";
import { adminClient, deleteTestUser, ensureTestUser, userClient } from "./lib/test-session";

type Tables = Database["public"]["Tables"];

/** Las fechas del prototipo están pensadas alrededor del martes 13/10/2026. */
const PROTOTYPE_TODAY = "2026-10-13";
const rel = (prototypeDate: string) => addDays(DEMO_TODAY, diffDays(PROTOTYPE_TODAY, prototypeDate));
/** Un instante del día `date` a la hora local de Buenos Aires (UTC−3). */
const at = (date: string, time = "15:00") => new Date(`${date}T${time}:00-03:00`).toISOString();

async function main() {
  // Borrar el usuario borra en cascada todos sus datos: el seed siempre parte de cero.
  const admin = adminClient();
  const existing = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((user) => user.email === DEMO_EMAIL);
  if (existing) await deleteTestUser(existing.id);
  const user = await ensureTestUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
  const db = await userClient(user);

  const insert = async <T extends keyof Tables>(table: T, rows: Tables[T]["Insert"][]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el cliente tipado no admite un nombre de tabla genérico
    const { data, error } = await (db.from(table) as any).insert(rows).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as Tables[T]["Row"][];
  };

  // ---------- materias ----------
  const subject = (
    name: string,
    commission: string,
    teacher: string,
    period: number,
    credits: number,
    color: string,
    course: number | null,
    final: number | null,
    archived: boolean,
    order: number,
  ) => ({
    name,
    commission,
    teacher,
    term_year: 2026,
    term_period: period,
    credits,
    color_key: color,
    grade_course: course,
    grade_final: final,
    archived_at: archived ? at(rel("2026-07-20")) : null,
    created_at: new Date(Date.UTC(2026, 6, 1, 12, order)).toISOString(),
  });
  const subjects = await insert("subjects", [
    subject("Lógica Computacional", "Com. 2", "Mariana Ferreyra", 2, 6, "cobalto", 8, null, false, 1),
    subject("Programación Orientada a Objetos", "Com. 1", "Diego Salvatierra", 2, 8, "pino", 9, null, false, 2),
    subject("Física II", "Com. 3", "Laura Benítez", 2, 8, "mandarina", null, null, false, 3),
    subject("Diseño y Procesamiento de Documentos XML", "Com. 1", "Pablo Rinaldi", 2, 4, "uva", null, null, false, 4),
    subject("Química", "Com. 4", "Silvia Acosta", 2, 6, "turquesa", null, null, false, 5),
    subject("Inglés técnico", "Com. 5", "Ana Quiroga", 2, 2, "fucsia", 9, 8, false, 6),
    subject("Álgebra", "Com. 1", "Gustavo Medina", 1, 8, "frambuesa", 8, 9, true, 7),
    subject("Introducción a la Programación", "Com. 3", "Valeria Ortiz", 1, 6, "ambar", 7, 7, true, 8),
  ]);
  const id = (name: string) => {
    const found = subjects.find((row) => row.name.startsWith(name));
    if (!found) throw new Error(`materia no encontrada: ${name}`);
    return found.id;
  };
  const [logica, poo, fisica, xml, quimica, ingles, algebra] = ["Lógica", "Programación", "Física", "Diseño", "Química", "Inglés", "Álgebra"].map(id);

  // ---------- documentos (referencias a Drive, nunca el archivo) ----------
  const doc = (subject_id: string, name: string, url: string, mime_type: string | null = null) => ({
    subject_id,
    source: mime_type ? "drive" : "link",
    name,
    url,
    drive_file_id: /\/d\/([\w-]+)/.exec(url)?.[1] ?? null,
    mime_type,
  });
  await insert("subject_documents", [
    doc(logica, "Apunte: deducción natural", "https://docs.google.com/document/d/1TildeDemoLogica01/edit"),
    doc(logica, "Copi — Introducción a la lógica (cap. 3)", "https://drive.google.com/file/d/1TildeDemoLogica02/view", "application/pdf"),
    doc(poo, "Clase 6 — Herencia y polimorfismo", "https://docs.google.com/presentation/d/1TildeDemoPoo01/edit"),
    doc(poo, "Enunciado TP integrador", "https://docs.google.com/document/d/1TildeDemoPoo02/edit"),
    doc(fisica, "Guía 4 — Electrostática", "https://drive.google.com/file/d/1TildeDemoFisica01/view", "application/pdf"),
    doc(fisica, "Mediciones laboratorio 1", "https://docs.google.com/spreadsheets/d/1TildeDemoFisica02/edit"),
    doc(fisica, "Foto del pizarrón", "https://drive.google.com/file/d/1TildeDemoFisica03/view", "image/jpeg"),
    doc(fisica, "Resnick — Física vol. 2", "https://drive.google.com/file/d/1TildeDemoFisica04/view", "application/pdf"),
    doc(xml, "Enunciado TP 2 — Facturas XML", "https://docs.google.com/document/d/1TildeDemoXml01/edit"),
    doc(algebra, "Práctica 5 — Transformaciones lineales", "https://drive.google.com/file/d/1TildeDemoAlgebra01/view", "application/pdf"),
  ]);

  // ---------- horario ----------
  const block = (subject_id: string, weekday: number, start_time: string, end_time: string, room: string) => ({ subject_id, weekday, start_time, end_time, room });
  const blocks = await insert("schedule_blocks", [
    block(logica, 1, "08:00", "10:00", "Aula 305"),
    block(logica, 3, "08:00", "10:00", "Aula 305"),
    block(poo, 2, "14:00", "17:00", "Laboratorio 2"),
    block(poo, 4, "18:00", "20:00", "Aula 210"),
    block(fisica, 1, "18:00", "20:00", "Aula 110"),
    block(fisica, 4, "08:30", "11:00", "Aula 110"),
    block(xml, 3, "18:00", "20:00", "Aula 402"),
    block(quimica, 2, "08:00", "10:00", "Aula 201"),
    block(quimica, 5, "08:00", "10:00", "Lab. de Química"),
    block(ingles, 5, "14:00", "15:30", "Aula 12"),
  ]);
  const activity = (title: string, color_key: string, start_time: string, end_time: string, weekdays: number[], date: string | null, until_date: string | null) => ({
    title,
    color_key,
    start_time,
    end_time,
    recurrence: date ? "none" : "weekdays",
    weekdays,
    date,
    start_date: null,
    until_date,
  });
  await insert("schedule_events", [
    activity("Vóley", "lima", "21:00", "23:00", [1, 3], null, null),
    activity("Cerámica", "cacao", "19:00", "21:00", [2], null, null),
    activity("Ayudantía de Álgebra", "frambuesa", "14:00", "16:00", [4], null, rel("2026-11-26")),
    activity("Consulta Física II", "mandarina", "10:00", "11:30", [], rel("2026-10-15"), null),
    activity("Viaje a la facu", "grafito", "12:30", "14:00", [2], null, null),
  ]);
  // La clase de XML del miércoles se omite esta semana.
  const xmlBlock = blocks.find((row) => row.subject_id === xml)!;
  await insert("schedule_exceptions", [{ target_type: "block", target_id: xmlBlock.id, date: rel("2026-10-14"), kind: "skip" }]);

  // ---------- calendario ----------
  const event = (category: string, subject_id: string | null, title: string, date: string, extra: { confirmed?: boolean; lead_days?: number } = {}) => ({
    category,
    subject_id,
    title,
    date: rel(date),
    confirmed: extra.confirmed ?? category !== "recuperatorio",
    lead_days: extra.lead_days ?? null,
  });
  const events = await insert("calendar_events", [
    event("parcial", fisica, "", "2026-10-20"),
    event("parcial", logica, "", "2026-10-22"),
    event("tp", xml, "Parser de facturas XML", "2026-10-16", { lead_days: 5 }),
    event("parcial", quimica, "", "2026-10-27"),
    event("parcial", poo, "", "2026-10-28"),
    event("tp", poo, "Integrador de POO", "2026-10-30", { lead_days: 7 }),
    event("recuperatorio", fisica, "", "2026-11-03", { confirmed: false }),
    event("recuperatorio", logica, "", "2026-11-05", { confirmed: true }),
    event("tp", ingles, "Writing task", "2026-10-20", { lead_days: 3 }),
    event("tp", quimica, "Informe de laboratorio 2", "2026-10-20", { lead_days: 4 }),
    event("recuperatorio", quimica, "", "2026-10-20", { confirmed: false }),
    event("final", algebra, "Final · Álgebra (mesa de diciembre)", "2026-12-09"),
    event("final", ingles, "", "2026-11-25"),
    event("tp", xml, "Hojas XSLT", "2026-11-06", { lead_days: 5 }),
    event("feriado", null, "Día del Estudiante (sin clases)", "2026-09-21"),
  ]);
  const tp = (title: string) => events.find((row) => row.title === title)!;

  // ---------- tareas ----------
  type TaskSeed = {
    title: string;
    subject_id?: string | null;
    priority?: "none" | "low" | "medium" | "high";
    day?: string;
    due?: string;
    lead?: number;
    done?: string;
    event?: string;
    subtasks?: [string, boolean][];
  };
  const taskSeeds: TaskSeed[] = [
    { title: "Resolver guía 4: ejercicios 1 a 8", subject_id: fisica, priority: "medium", day: "2026-10-12", subtasks: [["Ejercicios 1 y 2", true], ["Ejercicios 3 y 4", true], ["Ejercicios 5 y 6", false], ["Ejercicios 7 y 8", false]] },
    { title: "TP · Parser de facturas XML", subject_id: xml, priority: "high", due: "2026-10-16", lead: 5, event: "Parser de facturas XML", subtasks: [["Definir el XSD", true], ["Validar los ejemplos", true], ["Transformación XSLT a HTML", false], ["Escribir el informe", false]] },
    { title: "Leer capítulo 3 de Copi", subject_id: logica, priority: "medium", day: "2026-10-13" },
    { title: "Informe de laboratorio 1", subject_id: quimica, priority: "high", due: "2026-10-12", lead: 4 },
    { title: "Ejercicios de herencia y polimorfismo", subject_id: poo, priority: "low", day: "2026-10-10" },
    { title: "Repasar estequiometría", subject_id: quimica, priority: "low", day: "2026-10-13", done: "2026-10-13" },
    { title: "Comprar guardapolvo para el laboratorio", day: "2026-10-13", done: "2026-10-13" },
    { title: "Estudiar para el parcial de Física II", subject_id: fisica, priority: "high", due: "2026-10-20", lead: 7 },
    { title: "Preparar preguntas para la consulta", subject_id: fisica, day: "2026-10-14" },
    { title: "Guía 3 de Lógica: deducción natural", subject_id: logica, priority: "medium", day: "2026-10-15", subtasks: [["Reglas de introducción", false], ["Reglas de eliminación", false], ["Ejercicios integradores", false]] },
    { title: "Reading: unit 4 vocabulary", subject_id: ingles, day: "2026-10-14" },
    { title: "Estudiar para el parcial de Lógica", subject_id: logica, priority: "high", due: "2026-10-22", lead: 5 },
    { title: "Pasar en limpio apuntes de POO", subject_id: poo, day: "2026-10-16" },
    { title: "Pedir turno para el laboratorio de Física", priority: "low", day: "2026-10-15" },
    { title: "TP · Writing task", subject_id: ingles, due: "2026-10-20", lead: 3, event: "Writing task" },
    { title: "TP · Informe de laboratorio 2", subject_id: quimica, priority: "medium", due: "2026-10-20", lead: 4, event: "Informe de laboratorio 2" },
    { title: "TP · Integrador de POO", subject_id: poo, priority: "high", due: "2026-10-30", lead: 7, event: "Integrador de POO" },
    { title: "TP · Hojas XSLT", subject_id: xml, due: "2026-11-06", lead: 5, event: "Hojas XSLT" },
    // Ya completadas (historial y progreso de las materias)
    { title: "Guía 1 de Lógica: tablas de verdad", subject_id: logica, priority: "low", day: "2026-09-02", done: "2026-09-03" },
    { title: "Guía 2 de Lógica: formalización", subject_id: logica, priority: "low", day: "2026-09-16", done: "2026-09-17" },
    { title: "TP 1: modelo de clases", subject_id: poo, priority: "high", due: "2026-09-25", lead: 5, done: "2026-09-24" },
    { title: "Ejercicios de encapsulamiento", subject_id: poo, day: "2026-09-29", done: "2026-09-29" },
    { title: "Guía 3 de Física: campo eléctrico", subject_id: fisica, priority: "medium", day: "2026-10-01", done: "2026-10-02" },
    { title: "TP 1: DTD de una biblioteca", subject_id: xml, priority: "high", due: "2026-09-18", lead: 5, done: "2026-09-18" },
    { title: "Unit 3 exercises", subject_id: ingles, day: "2026-10-05", done: "2026-10-05" },
    { title: "Leer cap. 2 de Chang", subject_id: quimica, day: "2026-10-06", done: "2026-10-07" },
  ];
  const tasks = await insert(
    "tasks",
    taskSeeds.map((seed, index) => ({
      title: seed.title,
      subject_id: seed.subject_id ?? null,
      priority: seed.priority ?? "none",
      planned_date: seed.due ? null : rel(seed.day!),
      due_date: seed.due ? rel(seed.due) : null,
      lead_days: seed.due ? (seed.lead ?? 3) : null,
      sort_order: index + 1,
      completed_at: seed.done ? at(rel(seed.done)) : null,
      source_calendar_event_id: seed.event ? tp(seed.event).id : null,
    })),
  );
  const taskId = (title: string) => tasks.find((row) => row.title === title)!.id;
  await insert(
    "subtasks",
    taskSeeds.flatMap((seed) =>
      (seed.subtasks ?? []).map(([title, done], index) => ({
        task_id: taskId(seed.title),
        title,
        sort_order: index + 1,
        completed_at: done ? at(rel("2026-10-12"), "11:00") : null,
      })),
    ),
  );

  // ---------- sesiones de estudio ----------
  const session = (date: string, time: string, subject_id: string | null, preset: string, focus: number, breaks: number, cycles: number) => {
    const started = new Date(`${rel(date)}T${time}:00-03:00`);
    return {
      subject_id,
      preset,
      started_at: started.toISOString(),
      ended_at: new Date(started.getTime() + (focus + breaks) * 60_000).toISOString(),
      focus_seconds: focus * 60,
      break_seconds: breaks * 60,
      cycles_completed: cycles,
    };
  };
  const sessions = await insert("study_sessions", [
    // Esta semana y la anterior (las del prototipo)
    session("2026-10-13", "09:30", fisica, "50-10", 100, 10, 2),
    session("2026-10-12", "16:00", xml, "25-5", 100, 15, 4),
    session("2026-10-11", "10:00", logica, "90-20", 90, 0, 1),
    session("2026-10-10", "17:00", null, "25-5", 50, 5, 2),
    session("2026-10-08", "15:00", poo, "50-10", 150, 20, 3),
    session("2026-10-07", "19:00", fisica, "25-5", 75, 10, 3),
    session("2026-10-06", "11:00", quimica, "50-10", 50, 0, 1),
    session("2026-10-05", "18:00", logica, "25-5", 130, 20, 5),
    // Semanas anteriores: completan un historial de ocho semanas
    session("2026-10-03", "10:00", logica, "25-5", 100, 15, 4),
    session("2026-10-01", "16:00", xml, "50-10", 100, 10, 2),
    session("2026-09-29", "18:00", poo, "custom", 120, 16, 3),
    session("2026-09-28", "09:00", quimica, "50-10", 135, 20, 3),
    session("2026-09-24", "17:00", fisica, "50-10", 150, 20, 3),
    session("2026-09-22", "10:00", poo, "90-20", 180, 20, 2),
    session("2026-09-21", "15:00", null, "25-5", 50, 5, 2),
    session("2026-09-17", "18:00", logica, "25-5", 125, 20, 5),
    session("2026-09-15", "09:00", xml, "50-10", 150, 20, 3),
    session("2026-09-14", "16:00", fisica, "50-10", 100, 10, 2),
    session("2026-09-12", "11:00", poo, "90-20", 180, 20, 2),
    session("2026-09-09", "17:00", quimica, "25-5", 75, 10, 3),
    session("2026-09-07", "10:00", logica, "50-10", 150, 20, 3),
    session("2026-09-03", "18:00", fisica, "25-5", 100, 15, 4),
    session("2026-09-01", "09:00", poo, "50-10", 100, 10, 2),
    session("2026-08-31", "16:00", ingles, "25-5", 60, 10, 2),
    session("2026-08-27", "17:00", logica, "50-10", 150, 20, 3),
    session("2026-08-25", "10:00", fisica, "90-20", 180, 20, 2),
    session("2026-08-24", "15:00", xml, "25-5", 90, 15, 3),
    session("2026-08-20", "18:00", poo, "50-10", 150, 20, 3),
    session("2026-08-18", "09:00", quimica, "25-5", 100, 15, 4),
    session("2026-08-17", "11:00", null, "25-5", 60, 10, 2),
  ]);
  const link = (index: number, title: string) => ({ session_id: sessions[index].id, task_id: taskId(title), title });
  await insert("study_session_tasks", [
    link(0, "Repasar estequiometría"),
    link(1, "TP 1: DTD de una biblioteca"),
    link(1, "Guía 3 de Física: campo eléctrico"),
    link(3, "Comprar guardapolvo para el laboratorio"),
    link(4, "Ejercicios de encapsulamiento"),
    link(4, "TP 1: modelo de clases"),
    link(5, "Leer cap. 2 de Chang"),
    link(6, "Unit 3 exercises"),
    link(8, "Guía 2 de Lógica: formalización"),
    link(8, "Guía 1 de Lógica: tablas de verdad"),
  ]);

  console.log(`Cuenta demo lista: ${DEMO_EMAIL} (hoy de la demo: ${DEMO_TODAY}).`);
  console.log(`  ${subjects.length} materias · ${blocks.length} bloques de horario · ${tasks.length} tareas · ${events.length} fechas · ${sessions.length} sesiones`);
  console.log("Siguiente paso: npm run screenshots (con la app corriendo).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
