import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dateInTimeZone,
  diffDays,
  formatDayMonth,
  formatFullDate,
  isIsoDate,
  makeDate,
  minutesInTimeZone,
  monthMatrix,
  parseDayMonthYear,
  startOfWeek,
  todayInTimeZone,
  weekDates,
  weekdayOf,
} from "./dates";

describe("fechas sin zona horaria", () => {
  it("suma y resta días cruzando meses, años y bisiestos", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("diferencia en días", () => {
    expect(diffDays("2026-10-13", "2026-10-20")).toBe(7);
    expect(diffDays("2026-10-13", "2026-10-12")).toBe(-1);
    expect(diffDays("2026-10-13", "2026-10-13")).toBe(0);
  });

  it("la semana empieza el lunes (1) y termina el domingo (7)", () => {
    expect(weekdayOf("2026-10-12")).toBe(1); // lunes
    expect(weekdayOf("2026-10-13")).toBe(2);
    expect(weekdayOf("2026-10-18")).toBe(7); // domingo
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(weekDates("2026-10-12")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });

  it("valida fechas reales", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("arma fechas normalizando desbordes", () => {
    expect(makeDate(2026, 10, 1)).toBe("2026-10-01");
    expect(makeDate(2026, 11, 0)).toBe("2026-10-31");
    expect(makeDate(2026, 13, 1)).toBe("2027-01-01");
  });

  it("matriz del mes con lunes primero y días vecinos", () => {
    const october = monthMatrix(2026, 10); // 1/10/2026 es jueves
    expect(october[0][0]).toBe("2026-09-28");
    expect(october[0][3]).toBe("2026-10-01");
    expect(october.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(october).toHaveLength(5);
    expect(october.every((week) => week.length === 7)).toBe(true);
    // Febrero de 2027 empieza lunes y tiene 28 días: 4 semanas exactas.
    expect(monthMatrix(2027, 2)).toHaveLength(4);
  });

  it("navega meses", () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 10, -22)).toEqual({ year: 2024, month: 12 });
  });

  it("formatea DD/MM y DD/MM/AAAA", () => {
    expect(formatDayMonth("2026-03-05")).toBe("05/03");
    expect(formatFullDate("2026-03-05")).toBe("05/03/2026");
  });

  it("lee fechas escritas como DD/MM/AAAA", () => {
    expect(parseDayMonthYear("5/3/2026", 2026)).toBe("2026-03-05");
    expect(parseDayMonthYear("05/03", 2027)).toBe("2027-03-05");
    expect(parseDayMonthYear("31-12-26", 2026)).toBe("2026-12-31");
    expect(parseDayMonthYear("31/02/2026", 2026)).toBeNull();
    expect(parseDayMonthYear("mañana", 2026)).toBeNull();
  });
});

describe("zona horaria del usuario", () => {
  it("'hoy' se calcula en la zona del usuario, no en UTC", () => {
    // 02:30 UTC del 14/10 todavía es 13/10 a las 23:30 en Buenos Aires (UTC−3).
    const instant = new Date("2026-10-14T02:30:00Z");
    expect(todayInTimeZone("America/Argentina/Buenos_Aires", instant)).toBe("2026-10-13");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-14");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-10-14");
    expect(dateInTimeZone("2026-10-14T03:00:00Z", "America/Argentina/Buenos_Aires")).toBe("2026-10-14");
  });

  it("minutos desde la medianoche en la zona del usuario", () => {
    const instant = new Date("2026-10-13T19:20:00Z");
    expect(minutesInTimeZone("America/Argentina/Buenos_Aires", instant)).toBe(16 * 60 + 20);
    expect(minutesInTimeZone("UTC", new Date("2026-10-13T00:05:00Z"))).toBe(5);
  });
});
