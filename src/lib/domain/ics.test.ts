import { describe, expect, it } from "vitest";
import { parseIcs, zonedToInstant, type IcsOccurrence } from "./ics";

const BA = "America/Argentina/Buenos_Aires";
const range = { timeZone: BA, from: "2026-10-01", to: "2026-12-31" };

/** Arma un .ics con los eventos dados (cada uno, sus renglones sin BEGIN/END). */
const calendar = (...events: string[][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Facultad", ...events.flatMap((lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

function parse(text: string, options = range): IcsOccurrence[] {
  const result = parseIcs(text, options);
  if (!result.ok) throw new Error(result.error);
  return result.occurrences;
}
const dates = (occurrences: IcsOccurrence[]) => occurrences.map((occurrence) => occurrence.date);

describe("parseIcs: eventos sueltos", () => {
  it("todo el día, UTC, con zona y flotante", () => {
    const occurrences = parse(
      calendar(
        ["UID:a@x", "SUMMARY:Parcial de Álgebra", "DTSTART;VALUE=DATE:20261012", "DTEND;VALUE=DATE:20261013"],
        ["UID:b@x", "SUMMARY:Entrega TP", "DTSTART:20261014T210000Z"],
        ["UID:c@x", "SUMMARY:Final", "DTSTART;TZID=America/Argentina/Buenos_Aires:20261020T140000"],
        ["UID:d@x", "SUMMARY:Charla", "DTSTART:20261021T093000"],
      ),
    );
    expect(occurrences).toEqual([
      { externalId: "ics:a@x", uid: "a@x", title: "Parcial de Álgebra", date: "2026-10-12", time: null, recurring: false },
      { externalId: "ics:b@x", uid: "b@x", title: "Entrega TP", date: "2026-10-14", time: "18:00", recurring: false },
      { externalId: "ics:c@x", uid: "c@x", title: "Final", date: "2026-10-20", time: "14:00", recurring: false },
      { externalId: "ics:d@x", uid: "d@x", title: "Charla", date: "2026-10-21", time: "09:30", recurring: false },
    ]);
  });

  it("pasa a la zona del usuario aunque cambie el día", () => {
    // 01:30 UTC del 15 son las 22:30 del 14 en Buenos Aires.
    expect(parse(calendar(["UID:a", "SUMMARY:Tarde", "DTSTART:20261015T013000Z"]))[0]).toMatchObject({ date: "2026-10-14", time: "22:30" });
    // 09:00 en Madrid (UTC+1 en noviembre) son las 05:00 en Buenos Aires.
    expect(parse(calendar(["UID:b", "SUMMARY:Madrid", "DTSTART;TZID=Europe/Madrid:20261110T090000"]))[0]).toMatchObject({ date: "2026-11-10", time: "05:00" });
    // Una zona que el navegador no conoce se toma como hora local.
    expect(parse(calendar(["UID:c", "SUMMARY:Rara", "DTSTART;TZID=Argentina Standard Time:20261110T090000"]))[0]).toMatchObject({ time: "09:00" });
  });

  it("une renglones partidos, limpia el texto y se queda con el rango pedido", () => {
    const text = calendar(
      ["UID:a", "SUMMARY:Entrega\\, parte 1\; revisar\\nlas con", " signas", "DTSTART;VALUE=DATE:20261012"],
      ["UID:antes", "SUMMARY:Antes", "DTSTART;VALUE=DATE:20260930"],
      ["UID:despues", "SUMMARY:Después", "DTSTART;VALUE=DATE:20270101"],
    );
    const occurrences = parse(text);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].title).toBe("Entrega, parte 1; revisar las consignas");
  });

  it("ignora los cancelados, las alarmas y lo que no tiene fecha válida", () => {
    const text = calendar(
      ["UID:a", "SUMMARY:Cancelado", "DTSTART;VALUE=DATE:20261012", "STATUS:CANCELLED"],
      ["UID:b", "SUMMARY:Con alarma", "DTSTART;VALUE=DATE:20261013", "BEGIN:VALARM", "TRIGGER:-PT10M", "DTSTART;VALUE=DATE:20261201", "SUMMARY:Aviso", "END:VALARM"],
      ["UID:c", "SUMMARY:Sin fecha"],
      ["UID:d", "SUMMARY:Fecha rota", "DTSTART:2026-10-12"],
    );
    expect(parse(text).map((occurrence) => [occurrence.title, occurrence.date])).toEqual([["Con alarma", "2026-10-13"]]);
  });

  it("sin UID arma un identificador estable; el título puede faltar", () => {
    const text = calendar(["SUMMARY:Sin uid", "DTSTART;VALUE=DATE:20261012"], ["UID:x", "DTSTART;VALUE=DATE:20261013"]);
    const first = parse(text);
    expect(first[0].externalId).toMatch(/^ics:sin-uid-[a-z0-9]+$/);
    expect(parse(text)[0].externalId).toBe(first[0].externalId);
    expect(first[1].title).toBe("");
  });

  it("lee el nombre del calendario y rechaza lo que no es un .ics", () => {
    const result = parseIcs(calendar(["UID:a", "DTSTART;VALUE=DATE:20261012"]), range);
    expect(result.ok && result.calendarName).toBe("Facultad");
    expect(parseIcs("<html>login</html>", range)).toEqual({ ok: false, error: "not_ics" });
  });
});

describe("parseIcs: repeticiones", () => {
  const weekly = ["UID:clase", "SUMMARY:Consulta", "DTSTART;TZID=America/Argentina/Buenos_Aires:20261005T180000"];

  it("semanal con BYDAY y COUNT (la cuenta arranca en la primera fecha)", () => {
    const occurrences = parse(calendar([...weekly, "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5"]));
    expect(dates(occurrences)).toEqual(["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19"]);
    expect(occurrences.every((occurrence) => occurrence.recurring && occurrence.time === "18:00")).toBe(true);
    expect(occurrences[1].externalId).toBe("ics:clase:20261007");
  });

  it("COUNT cuenta también las fechas anteriores al rango", () => {
    const text = calendar(["UID:vieja", "SUMMARY:Vieja", "DTSTART;VALUE=DATE:20260907", "RRULE:FREQ=WEEKLY;COUNT=6"]);
    // 07/09, 14/09, 21/09, 28/09, 05/10, 12/10: en el rango (desde el 01/10) quedan dos.
    expect(dates(parse(text))).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("UNTIL corta la serie: como fecha y como instante en UTC", () => {
    expect(dates(parse(calendar([...weekly, "RRULE:FREQ=WEEKLY;UNTIL=20261019"])))).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
    // 18:00 en Buenos Aires = 21:00 UTC. El 19 a las 20:59 UTC todavía no ocurrió la de ese día.
    expect(dates(parse(calendar([...weekly, "RRULE:FREQ=WEEKLY;UNTIL=20261019T205900Z"])))).toEqual(["2026-10-05", "2026-10-12"]);
    expect(dates(parse(calendar([...weekly, "RRULE:FREQ=WEEKLY;UNTIL=20261019T210000Z"])))).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
  });

  it("INTERVAL: cada dos semanas y cada tres días", () => {
    expect(dates(parse(calendar([...weekly, "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4"])))).toEqual(["2026-10-05", "2026-10-19", "2026-11-02", "2026-11-16"]);
    expect(dates(parse(calendar([...weekly, "RRULE:FREQ=DAILY;INTERVAL=3;COUNT=4"])))).toEqual(["2026-10-05", "2026-10-08", "2026-10-11", "2026-10-14"]);
  });

  it("mensual: mismo día, día fijo, ordinal y último viernes", () => {
    const monthly = (rule: string, start = "20261005") => dates(parse(calendar(["UID:m", "SUMMARY:M", `DTSTART;VALUE=DATE:${start}`, `RRULE:${rule}`])));
    expect(monthly("FREQ=MONTHLY")).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
    expect(monthly("FREQ=MONTHLY;BYMONTHDAY=15")).toEqual(["2026-10-05", "2026-10-15", "2026-11-15", "2026-12-15"]);
    expect(monthly("FREQ=MONTHLY;BYDAY=2TU", "20261013")).toEqual(["2026-10-13", "2026-11-10", "2026-12-08"]);
    expect(monthly("FREQ=MONTHLY;BYDAY=-1FR", "20261030")).toEqual(["2026-10-30", "2026-11-27", "2026-12-25"]);
    // El 31 solo existe en algunos meses.
    expect(monthly("FREQ=MONTHLY", "20261031")).toEqual(["2026-10-31", "2026-12-31"]);
  });

  it("anual", () => {
    const text = calendar(["UID:cumple", "SUMMARY:Cumpleaños", "DTSTART;VALUE=DATE:20201121", "RRULE:FREQ=YEARLY"]);
    expect(dates(parse(text, { timeZone: BA, from: "2026-01-01", to: "2027-12-31" }))).toEqual(["2026-11-21", "2027-11-21"]);
  });

  it("EXDATE saca fechas y una instancia modificada reemplaza a la original", () => {
    const text = calendar(
      [...weekly, "RRULE:FREQ=WEEKLY;COUNT=4", "EXDATE;TZID=America/Argentina/Buenos_Aires:20261012T180000"],
      ["UID:clase", "SUMMARY:Consulta (pasa al jueves)", "RECURRENCE-ID;TZID=America/Argentina/Buenos_Aires:20261019T180000", "DTSTART;TZID=America/Argentina/Buenos_Aires:20261022T170000"],
    );
    expect(parse(text).map((occurrence) => [occurrence.date, occurrence.time, occurrence.title, occurrence.externalId])).toEqual([
      ["2026-10-05", "18:00", "Consulta", "ics:clase:20261005"],
      ["2026-10-22", "17:00", "Consulta (pasa al jueves)", "ics:clase:20261019"],
      ["2026-10-26", "18:00", "Consulta", "ics:clase:20261026"],
    ]);
  });

  it("una instancia cancelada desaparece de la serie", () => {
    const text = calendar(
      [...weekly, "RRULE:FREQ=WEEKLY;COUNT=3"],
      ["UID:clase", "SUMMARY:Consulta", "RECURRENCE-ID;TZID=America/Argentina/Buenos_Aires:20261012T180000", "DTSTART;TZID=America/Argentina/Buenos_Aires:20261012T180000", "STATUS:CANCELLED"],
    );
    expect(dates(parse(text))).toEqual(["2026-10-05", "2026-10-19"]);
  });

  it("una regla que no entiende deja solo la primera fecha y avisa", () => {
    const result = parseIcs(calendar([...weekly, "RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU,WE,TH,FR"]), range);
    expect(result.ok && result.truncated).toBe(true);
    expect(result.ok && dates(result.occurrences)).toEqual(["2026-10-05"]);
  });

  it("una serie sin fin se desarrolla solo hasta el final del rango", () => {
    const text = calendar(["UID:siempre", "SUMMARY:Siempre", "DTSTART;VALUE=DATE:20200106", "RRULE:FREQ=DAILY"]);
    const result = parseIcs(text, { timeZone: BA, from: "2026-10-01", to: "2026-10-07" });
    expect(result.ok && result.occurrences).toHaveLength(7);
    expect(result.ok && result.truncated).toBe(false);
  });
});

describe("zonedToInstant", () => {
  it("respeta el horario de verano de la zona", () => {
    // Madrid: UTC+2 en julio, UTC+1 en enero.
    expect(new Date(zonedToInstant("2026-07-01", 12 * 60, "Europe/Madrid")).toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(new Date(zonedToInstant("2026-01-15", 12 * 60, "Europe/Madrid")).toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(new Date(zonedToInstant("2026-10-12", 14 * 60, BA)).toISOString()).toBe("2026-10-12T17:00:00.000Z");
  });
});
