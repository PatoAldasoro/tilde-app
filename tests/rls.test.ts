/**
 * RLS: un usuario no puede leer ni modificar datos de otro.
 * Corre contra el Supabase local (npm run db:start). Si no está disponible, se saltea.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../scripts/lib/env";
import { adminClient, deleteTestUser, ensureTestUser, userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url) || process.env.TILDE_ALLOW_REMOTE_TEST === "1";
const reachable =
  isLocal && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? await fetch(`${url}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } })
        .then((response) => response.ok)
        .catch(() => false)
    : false;

if (!reachable) console.warn("[rls] Supabase local no disponible: se saltea el test de RLS (npm run db:start).");

type Client = SupabaseClient<Database>;

describe.skipIf(!reachable)("RLS", () => {
  let alice: TestUser;
  let bob: TestUser;
  let asAlice: Client;
  let asBob: Client;
  let anon: Client;
  const ids = { subject: "", task: "", subtask: "", event: "", block: "", activity: "", exception: "", session: "", sessionTask: "", document: "", feed: "" };

  beforeAll(async () => {
    const stamp = Date.now();
    alice = await ensureTestUser(`rls-alice-${stamp}@tilde.test`, "alice-password-123", "Alice RLS");
    bob = await ensureTestUser(`rls-bob-${stamp}@tilde.test`, "bob-password-123", "Bob RLS");
    asAlice = await userClient(alice);
    asBob = await userClient(bob);
    anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

    // Alice carga una fila en cada tabla.
    const one = <T>(result: { data: T; error: { message: string } | null }): NonNullable<T> => {
      if (result.error || !result.data) throw new Error(result.error?.message ?? "sin datos");
      return result.data;
    };
    ids.subject = one(await asAlice.from("subjects").insert({ name: "Álgebra", color_key: "pino" }).select("id").single()).id;
    ids.document = one(
      await asAlice
        .from("subject_documents")
        .insert({ subject_id: ids.subject, source: "link", name: "Apunte", url: "https://docs.google.com/document/d/abc/edit" })
        .select("id")
        .single(),
    ).id;
    ids.feed = one(
      await asAlice
        .from("calendar_feeds")
        .insert({ name: "Facultad", url: "https://calendar.google.com/calendar/ical/alice/private-secreto/basic.ics" })
        .select("id")
        .single(),
    ).id;
    ids.event = one(
      await asAlice
        .from("calendar_events")
        .insert({ subject_id: ids.subject, category: "tp", title: "TP 1", date: "2026-10-20", lead_days: 3, feed_id: ids.feed, external_id: "ics:tp1@facultad" })
        .select("id")
        .single(),
    ).id;
    ids.task = one(
      await asAlice.from("tasks").insert({ subject_id: ids.subject, title: "Leer capítulo 1", planned_date: "2026-10-13" }).select("id").single(),
    ).id;
    ids.subtask = one(await asAlice.from("subtasks").insert({ task_id: ids.task, title: "Sección 1.1" }).select("id").single()).id;
    ids.block = one(
      await asAlice.from("schedule_blocks").insert({ subject_id: ids.subject, weekday: 1, start_time: "08:00", end_time: "10:00" }).select("id").single(),
    ).id;
    ids.activity = one(
      await asAlice
        .from("schedule_events")
        .insert({ title: "Vóley", color_key: "cielo", start_time: "19:00", end_time: "20:30", recurrence: "none", date: "2026-10-14" })
        .select("id")
        .single(),
    ).id;
    ids.exception = one(
      await asAlice.from("schedule_exceptions").insert({ target_type: "block", target_id: ids.block, date: "2026-10-12", kind: "skip" }).select("id").single(),
    ).id;
    ids.session = one(
      await asAlice
        .from("study_sessions")
        .insert({ subject_id: ids.subject, preset: "25-5", started_at: "2026-10-13T18:00:00Z", ended_at: "2026-10-13T18:30:00Z", focus_seconds: 1500, break_seconds: 300, cycles_completed: 1 })
        .select("id")
        .single(),
    ).id;
    ids.sessionTask = one(
      await asAlice.from("study_session_tasks").insert({ session_id: ids.session, task_id: ids.task, title: "Leer capítulo 1" }).select("id").single(),
    ).id;
  });

  afterAll(async () => {
    if (alice) await deleteTestUser(alice.id);
    if (bob) await deleteTestUser(bob.id);
  });

  const tables = [
    ["subjects", "subject"],
    ["subject_documents", "document"],
    ["calendar_events", "event"],
    ["calendar_feeds", "feed"],
    ["tasks", "task"],
    ["subtasks", "subtask"],
    ["schedule_blocks", "block"],
    ["schedule_events", "activity"],
    ["schedule_exceptions", "exception"],
    ["study_sessions", "session"],
    ["study_session_tasks", "sessionTask"],
  ] as const;

  it("la dueña ve sus filas", async () => {
    for (const [table] of tables) {
      const { data, error } = await asAlice.from(table).select("id");
      expect(error, table).toBeNull();
      expect(data, table).toHaveLength(1);
    }
    const { data: profile } = await asAlice.from("profiles").select("user_id");
    expect(profile).toEqual([{ user_id: alice.id }]);
  });

  it("otro usuario no puede leer nada", async () => {
    for (const [table, key] of tables) {
      const all = await asBob.from(table).select("id");
      expect(all.data, table).toEqual([]);
      const byId = await asBob.from(table).select("id").eq("id", ids[key]);
      expect(byId.data, table).toEqual([]);
    }
    const profiles = await asBob.from("profiles").select("user_id");
    expect(profiles.data).toEqual([{ user_id: bob.id }]);
  });

  it("un visitante sin sesión no puede leer nada", async () => {
    for (const [table] of [...tables, ["profiles"] as const]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("otro usuario no puede modificar ni borrar", async () => {
    const admin = adminClient();
    await asBob.from("subjects").update({ name: "Hackeada" }).eq("id", ids.subject);
    await asBob.from("tasks").update({ title: "Hackeada", completed_at: new Date().toISOString() }).eq("id", ids.task);
    await asBob.from("profiles").update({ locale: "en" }).eq("user_id", alice.id);
    for (const [table, key] of tables) await asBob.from(table).delete().eq("id", ids[key]);

    const subject = await admin.from("subjects").select("name").eq("id", ids.subject).single();
    expect(subject.data?.name).toBe("Álgebra");
    const task = await admin.from("tasks").select("title, completed_at").eq("id", ids.task).single();
    expect(task.data).toEqual({ title: "Leer capítulo 1", completed_at: null });
    const profile = await admin.from("profiles").select("locale").eq("user_id", alice.id).single();
    expect(profile.data?.locale).toBe("es");
    for (const [table, key] of tables) {
      const row = await admin.from(table).select("id").eq("id", ids[key]);
      expect(row.data, table).toHaveLength(1);
    }
  });

  it("no se pueden insertar filas a nombre de otro ni colgarlas de datos ajenos", async () => {
    const forged = await asBob.from("subjects").insert({ name: "Ajena", color_key: "uva", user_id: alice.id });
    expect(forged.error).not.toBeNull();
    // Bob intenta colgar una tarea de la materia de Alice: la FK compuesta (id, user_id) lo impide.
    const attached = await asBob.from("tasks").insert({ subject_id: ids.subject, title: "Intrusa", planned_date: "2026-10-13" });
    expect(attached.error).not.toBeNull();
    const subtask = await asBob.from("subtasks").insert({ task_id: ids.task, title: "Intrusa" });
    expect(subtask.error).not.toBeNull();
    const profile = await asBob.from("profiles").insert({ user_id: alice.id });
    expect(profile.error).not.toBeNull();
    // Tampoco puede asociar una fecha suya al calendario vinculado de Alice.
    const event = await asBob.from("calendar_events").insert({ category: "evento", title: "Intrusa", date: "2026-10-20", feed_id: ids.feed });
    expect(event.error).not.toBeNull();
  });

  it("una fila propia no se puede pasar a otro usuario", async () => {
    const own = await asBob.from("subjects").insert({ name: "Mía", color_key: "lima" }).select("id").single();
    const moved = await asBob.from("subjects").update({ user_id: alice.id }).eq("id", own.data!.id);
    expect(moved.error).not.toBeNull();
  });
});
