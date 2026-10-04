import { describe, expect, it } from "vitest";
import { averages, gradeScopes, parseGrade, subjectAverage, type Graded } from "./grades";

const subject = (course: number | null, final: number | null, credits: number | null = null, archived = false): Graded => ({
  grade_course: course,
  grade_final: final,
  credits,
  archived_at: archived ? "2026-07-20T00:00:00Z" : null,
});

describe("parseGrade", () => {
  it("acepta enteros y decimales con coma o punto", () => {
    expect(parseGrade("8")).toEqual({ ok: true, value: 8 });
    expect(parseGrade("8,5")).toEqual({ ok: true, value: 8.5 });
    expect(parseGrade("7.25")).toEqual({ ok: true, value: 7.25 });
    expect(parseGrade(" 10 ")).toEqual({ ok: true, value: 10 });
    expect(parseGrade("0")).toEqual({ ok: true, value: 0 });
  });

  it("vacío significa sin nota", () => {
    expect(parseGrade("")).toEqual({ ok: true, value: null });
    expect(parseGrade("   ")).toEqual({ ok: true, value: null });
  });

  it("rechaza lo que está fuera de 0–10 o no es un número", () => {
    for (const bad of ["11", "10,5", "-1", "abc", "8,555", "1e1", "8,", ",5", "100"]) {
      expect(parseGrade(bad), bad).toEqual({ ok: false });
    }
  });
});

describe("subjectAverage", () => {
  it("es (cursada + final) / 2 cuando están las dos notas", () => {
    expect(subjectAverage(subject(8, 9))).toBe(8.5);
    expect(subjectAverage(subject(0, 10))).toBe(5);
  });

  it("es null si falta alguna", () => {
    expect(subjectAverage(subject(8, null))).toBeNull();
    expect(subjectAverage(subject(null, 9))).toBeNull();
    expect(subjectAverage(subject(null, null))).toBeNull();
  });
});

describe("averages", () => {
  it("sin materias con promedio devuelve null", () => {
    expect(averages([])).toEqual({ simple: null, weighted: null, counted: 0 });
    expect(averages([subject(8, null, 6)])).toEqual({ simple: null, weighted: null, counted: 0 });
  });

  it("el simple es la media de los promedios no nulos", () => {
    const result = averages([subject(8, 9), subject(7, 7), subject(9, null), subject(null, null)]);
    expect(result.simple).toBe(7.75); // (8.5 + 7) / 2
    expect(result.counted).toBe(2);
  });

  it("el ponderado usa los créditos y deja afuera las materias sin créditos", () => {
    const result = averages([subject(8, 9, 8), subject(7, 7, 6), subject(10, 10, 0), subject(10, 10, null)]);
    // Ponderado: (8.5×8 + 7×6) / 14 = 110 / 14
    expect(result.weighted).toBeCloseTo(110 / 14, 10);
    // Simple: las cuatro tienen promedio
    expect(result.simple).toBe((8.5 + 7 + 10 + 10) / 4);
    expect(result.counted).toBe(4);
  });

  it("sin créditos en ninguna materia no hay ponderado", () => {
    expect(averages([subject(8, 9), subject(7, 7, 0)]).weighted).toBeNull();
  });

  it("una materia sin promedio no aporta créditos al ponderado", () => {
    const result = averages([subject(8, 8, 4), subject(10, null, 20)]);
    expect(result.weighted).toBe(8);
  });
});

describe("gradeScopes", () => {
  it("el actual usa las no archivadas y el general usa todas", () => {
    const scopes = gradeScopes([subject(9, 8, 2), subject(8, 9, 8, true), subject(7, 7, 6, true)]);
    expect(scopes.current).toEqual({ simple: 8.5, weighted: 8.5, counted: 1 });
    expect(scopes.overall.simple).toBe((8.5 + 8.5 + 7) / 3);
    expect(scopes.overall.weighted).toBeCloseTo((8.5 * 2 + 8.5 * 8 + 7 * 6) / 16, 10);
    expect(scopes.overall.counted).toBe(3);
  });
});
