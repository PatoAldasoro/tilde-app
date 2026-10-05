import { describe, expect, it } from "vitest";
import { guessCategory, guessSubject, importNews, importRange, nextSkipped, normalizeFeedUrl, planCalendarImport } from "./calendar-import";
import type { IcsOccurrence } from "./ics";

const subjects = [
  { id: "s-algebra", name: "Álgebra" },
  { id: "s-fisica", name: "Física II" },
  { id: "s-fisica1", name: "Física" },
];

const occurrence = (id: string, title: string, date: string, extra: Partial<IcsOccurrence> = {}): IcsOccurrence => ({
  externalId: `ics:${id}`,
  uid: id,
  title,
  date,
  time: null,
  recurring: false,
  ...extra,
});

describe("normalizeFeedUrl", () => {
  it("acepta direcciones de Google Calendar, Outlook e iCloud", () => {
    const google = "https://calendar.google.com/calendar/ical/abc%40gmail.com/private-123/basic.ics";
    expect(normalizeFeedUrl(`  ${google} `)).toBe(google);
    expect(normalizeFeedUrl("webcal://p01-caldav.icloud.com/published/2/abc")).toBe("https://p01-caldav.icloud.com/published/2/abc");
    expect(normalizeFeedUrl("https://outlook.office365.com/owa/calendar/x/y/calendar.ics")).not.toBeNull();
  });

  it("rechaza todo lo demás: otros sitios, http, puertos, credenciales y redes internas", () => {
    for (const url of [
      "https://example.com/basic.ics",
      "http://calendar.google.com/calendar/ical/a/basic.ics",
      "https://calendar.google.com:8443/calendar/ical/a/basic.ics",
      "https://user:pass@calendar.google.com/x.ics",
      "https://calendar.google.com.evil.com/x.ics",
      "https://evilicloud.com/x.ics",
      "https://localhost/x.ics",
      "https://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
      "no es una url",
      "",
    ]) {
      expect(normalizeFeedUrl(url), url).toBeNull();
    }
    expect(normalizeFeedUrl(`https://calendar.google.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("sugerencias", () => {
  it("categoría por el título, en español y en inglés", () => {
    expect(guessCategory("Parcial de Álgebra")).toBe("parcial");
    expect(guessCategory("2.º PARCIAL")).toBe("parcial");
    expect(guessCategory("Recuperatorio del 1er parcial")).toBe("recuperatorio");
    expect(guessCategory("Final de Física")).toBe("final");
    expect(guessCategory("Entrega TP 3")).toBe("tp");
    expect(guessCategory("Trabajo práctico integrador")).toBe("tp");
    expect(guessCategory("Midterm exam")).toBe("parcial");
    expect(guessCategory("Homework 4 due")).toBe("tp");
    expect(guessCategory("Feriado puente")).toBe("feriado");
    expect(guessCategory("Cumpleaños de Sofi")).toBe("evento");
    // "finalizar" no es un final ni "otp" un TP.
    expect(guessCategory("Finalizar inscripción")).toBe("evento");
  });

  it("materia nombrada en el título: gana el nombre más largo", () => {
    expect(guessSubject("Parcial de algebra", subjects)).toBe("s-algebra");
    expect(guessSubject("TP Física II - laboratorio", subjects)).toBe("s-fisica");
    expect(guessSubject("Consulta de física", subjects)).toBe("s-fisica1");
    expect(guessSubject("Dentista", subjects)).toBeNull();
    expect(guessSubject("Clase de arte", [{ id: "x", name: "Art" }])).toBeNull();
  });
});

describe("planCalendarImport", () => {
  it("propone lo nuevo con categoría y materia, y lo marca para importar", () => {
    const plan = planCalendarImport([occurrence("a", "Parcial de Álgebra", "2026-10-12"), occurrence("b", "Dentista", "2026-10-13", { time: "10:00" })], [], subjects);
    expect(plan.upToDate).toBe(0);
    expect(plan.items.map((item) => [item.key, item.status, item.category, item.subjectId, item.selected])).toEqual([
      ["ics:a", "new", "parcial", "s-algebra", true],
      ["ics:b", "new", "evento", null, true],
    ]);
  });

  it("lo que ya está: sin cambios no aparece; si cambió de día u hora, sí, con su categoría actual", () => {
    const existing = [
      { id: "e1", external_id: "ics:a", date: "2026-10-12", start_time: null, category: "final", subject_id: "s-fisica" },
      { id: "e2", external_id: "ics:b", date: "2026-10-13", start_time: "10:00:00", category: "evento", subject_id: null },
      { id: "e3", external_id: "ics:c", date: "2026-10-14", start_time: "09:00:00", category: "tp", subject_id: "s-algebra" },
      { id: "e4", external_id: null, date: "2026-10-15", start_time: null, category: "parcial", subject_id: null },
    ];
    const plan = planCalendarImport(
      [
        occurrence("a", "Parcial de Álgebra", "2026-10-19"),
        occurrence("b", "Dentista", "2026-10-13", { time: "10:00" }),
        occurrence("c", "Entrega", "2026-10-14", { time: "11:30" }),
      ],
      existing,
      subjects,
    );
    expect(plan.upToDate).toBe(1);
    expect(plan.items.map((item) => [item.key, item.status, item.category, item.subjectId, item.selected])).toEqual([
      ["ics:c", "changed", "tp", "s-algebra", true],
      ["ics:a", "changed", "final", "s-fisica", true],
    ]);
  });

  it("lo omitido antes vuelve a aparecer sin marcar", () => {
    const plan = planCalendarImport([occurrence("a", "Dentista", "2026-10-12"), occurrence("b", "Parcial", "2026-10-13")], [], subjects, ["ics:a"]);
    expect(plan.items.map((item) => [item.status, item.selected])).toEqual([
      ["skipped", false],
      ["new", true],
    ]);
    expect(importNews(plan)).toBe(1);
  });

  it("una serie va en una sola fila y sin marcar; un feriado nunca lleva materia", () => {
    const series = ["05", "12", "19"].map((day) => occurrence(`clase:202610${day}`, "Clase de Álgebra", `2026-10-${day}`, { uid: "clase", recurring: true, time: "18:00" }));
    const plan = planCalendarImport([...series, occurrence("f", "Feriado: Álgebra no se dicta", "2026-10-12")], [], subjects);
    const group = plan.items.find((item) => item.key.startsWith("series:"))!;
    expect(group.occurrences).toHaveLength(3);
    expect(group.selected).toBe(false);
    expect(group.subjectId).toBe("s-algebra");
    expect(plan.items.find((item) => item.key === "ics:f")).toMatchObject({ category: "feriado", subjectId: null });
    expect(importNews(plan)).toBe(4);
  });

  it("una serie con una sola fecha en el rango se trata como evento suelto", () => {
    const plan = planCalendarImport([occurrence("cumple:20261121", "Cumpleaños", "2026-11-21", { uid: "cumple", recurring: true })], [], subjects);
    expect(plan.items[0].selected).toBe(true);
  });
});

describe("nextSkipped", () => {
  const present = [occurrence("a", "A", "2026-10-12"), occurrence("b", "B", "2026-10-13"), occurrence("c", "C", "2026-10-14")];

  it("guarda lo ofrecido y no elegido, y olvida lo que ya no existe en el calendario", () => {
    const plan = planCalendarImport(present, [], subjects, ["ics:c", "ics:borrado"]);
    expect(nextSkipped(plan, new Set(["ics:a"]), ["ics:c", "ics:borrado"], present)).toEqual(["ics:b", "ics:c"]);
    // Elegir algo que estaba omitido lo saca de la lista.
    expect(nextSkipped(plan, new Set(["ics:a", "ics:b", "ics:c"]), ["ics:c"], present)).toEqual([]);
  });

  it("un cambio sin aplicar no se marca como omitido: se vuelve a ofrecer", () => {
    const existing = [{ id: "e1", external_id: "ics:a", date: "2026-10-01", start_time: null, category: "evento", subject_id: null }];
    const plan = planCalendarImport(present.slice(0, 1), existing, subjects);
    expect(nextSkipped(plan, new Set(), [], present)).toEqual([]);
  });
});

describe("importRange", () => {
  it("de hoy a un año; con las pasadas, un año hacia atrás", () => {
    expect(importRange("2026-10-05", false)).toEqual({ from: "2026-10-05", to: "2027-10-05" });
    expect(importRange("2026-10-05", true)).toEqual({ from: "2025-10-05", to: "2027-10-05" });
  });
});
