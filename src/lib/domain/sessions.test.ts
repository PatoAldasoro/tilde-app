import { describe, expect, it } from "vitest";
import { focusBySubject, totalFocus, weeklyFocus, type StudySession } from "./sessions";

const TZ = "America/Argentina/Buenos_Aires";
const TODAY = "2026-10-13"; // martes; su semana empieza el lunes 12/10

const session = (started_at: string, minutes: number, subject_id: string | null = null): StudySession => ({
  started_at,
  focus_seconds: minutes * 60,
  subject_id,
});

describe("weeklyFocus", () => {
  it("devuelve las últimas 8 semanas, de la más vieja a la actual, de lunes a domingo", () => {
    const weeks = weeklyFocus([], TODAY, TZ);
    expect(weeks).toHaveLength(8);
    expect(weeks[0].weekStart).toBe("2026-08-24");
    expect(weeks[7].weekStart).toBe("2026-10-12");
    expect(weeks.every((week) => week.focusSeconds === 0)).toBe(true);
  });

  it("suma el foco de cada sesión en la semana en que empezó", () => {
    const weeks = weeklyFocus(
      [
        session("2026-10-12T12:00:00Z", 50), // lunes de esta semana
        session("2026-10-13T20:00:00Z", 25), // hoy
        session("2026-10-11T15:00:00Z", 90), // domingo: semana anterior
        session("2026-10-05T10:00:00Z", 30), // lunes de la semana anterior
        session("2026-06-01T10:00:00Z", 500), // fuera del rango
      ],
      TODAY,
      TZ,
    );
    expect(weeks[7].focusSeconds).toBe(75 * 60);
    expect(weeks[6].focusSeconds).toBe(120 * 60);
    expect(weeks.slice(0, 6).every((week) => week.focusSeconds === 0)).toBe(true);
  });

  it("usa el día en la zona del usuario, no en UTC", () => {
    // Lunes 12/10 a las 01:30 UTC = domingo 11/10 a las 22:30 en Buenos Aires → semana anterior.
    const weeks = weeklyFocus([session("2026-10-12T01:30:00Z", 40)], TODAY, TZ);
    expect(weeks[7].focusSeconds).toBe(0);
    expect(weeks[6].focusSeconds).toBe(40 * 60);
    expect(weeklyFocus([session("2026-10-12T01:30:00Z", 40)], TODAY, "UTC")[7].focusSeconds).toBe(40 * 60);
  });
});

describe("focusBySubject y totalFocus", () => {
  const sessions = [session("2026-10-12T12:00:00Z", 50, "fisica"), session("2026-10-13T12:00:00Z", 25), session("2026-10-13T15:00:00Z", 100, "poo"), session("2026-10-14T12:00:00Z", 60, "fisica")];

  it("agrupa por materia (null = sin materia) y ordena de mayor a menor", () => {
    expect(focusBySubject(sessions)).toEqual([
      { subjectId: "fisica", focusSeconds: 110 * 60 },
      { subjectId: "poo", focusSeconds: 100 * 60 },
      { subjectId: null, focusSeconds: 25 * 60 },
    ]);
  });

  it("suma el total", () => {
    expect(totalFocus(sessions)).toBe(235 * 60);
    expect(totalFocus([])).toBe(0);
  });
});
