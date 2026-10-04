import { describe, expect, it } from "vitest";
import backup2026 from "../../../data/feriados-2026.json";
import backup2027 from "../../../data/feriados-2027.json";
import { holidayKey, normalizeHolidays, transferredDate, yearsAround } from "./holidays";

describe("normalizeHolidays", () => {
  it("descarta los puente: son días no laborables, no feriados", () => {
    const result = normalizeHolidays([
      { fecha: "2026-03-23", tipo: "puente", nombre: "Puente turístico no laborable" },
      { fecha: "2026-03-24", tipo: "inamovible", nombre: "Día Nacional de la Memoria por la Verdad y la Justicia" },
    ]);
    expect(result.map((h) => h.date)).toEqual(["2026-03-24"]);
  });

  it("ignora filas inválidas y no repite fechas", () => {
    const result = normalizeHolidays([
      { fecha: "2026-13-40", tipo: "inamovible", nombre: "Roto" },
      { fecha: "2026-12-25", tipo: "inamovible", nombre: "Navidad" },
      { fecha: "2026-12-25", tipo: "inamovible", nombre: "Navidad (duplicada)" },
    ]);
    expect(result).toEqual([{ date: "2026-12-25", name: "Navidad", key: "christmas" }]);
  });

  it("devuelve los feriados ordenados por fecha", () => {
    const result = normalizeHolidays([
      { fecha: "2026-12-25", tipo: "inamovible", nombre: "Navidad" },
      { fecha: "2026-01-01", tipo: "inamovible", nombre: "Año nuevo" },
    ]);
    expect(result.map((h) => h.date)).toEqual(["2026-01-01", "2026-12-25"]);
  });
});

describe("respaldo 2026 (contrastado con el calendario oficial)", () => {
  const holidays = normalizeHolidays(backup2026);
  const dates = holidays.map((h) => h.date);

  it("tiene los 17 feriados nacionales y ningún puente", () => {
    expect(dates).toEqual([
      "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03", "2026-05-01",
      "2026-05-25", "2026-06-15", "2026-06-20", "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-09",
      "2026-11-23", "2026-12-08", "2026-12-25",
    ]);
    for (const bridge of ["2026-03-23", "2026-07-10", "2026-12-07"]) expect(dates).not.toContain(bridge);
  });

  it("incluye el 09/11 (visita del papa León XIV, Decreto 1103/2026) y no los feriados locales del 10 y 11", () => {
    expect(holidays.find((h) => h.date === "2026-11-09")?.key).toBe("pope_visit");
    expect(dates).not.toContain("2026-11-10");
    expect(dates).not.toContain("2026-11-11");
  });

  it("no mueve los trasladables que la API ya trae trasladados", () => {
    expect(dates).toContain("2026-06-15"); // Güemes (17/6, miércoles → lunes anterior)
    expect(dates).toContain("2026-11-23"); // Soberanía (20/11, viernes → lunes siguiente)
    expect(dates).not.toContain("2026-06-17");
  });

  it("todos los feriados tienen nombre traducible", () => {
    expect(holidays.filter((h) => h.key === null)).toEqual([]);
  });
});

describe("respaldo 2027 (provisorio)", () => {
  const holidays = normalizeHolidays(backup2027);
  const dates = holidays.map((h) => h.date);

  it("traslada según la Ley 27.399 los que la API trae en su fecha original", () => {
    expect(dates).toContain("2027-06-21"); // Güemes: jueves 17/6 → lunes siguiente
    expect(dates).toContain("2027-08-16"); // San Martín: martes 17/8 → lunes anterior
    expect(dates).toContain("2027-10-11"); // Diversidad Cultural: martes 12/10 → lunes anterior
    expect(dates).toContain("2027-11-20"); // Soberanía: sábado, no se mueve
    for (const original of ["2027-06-17", "2027-08-17", "2027-10-12"]) expect(dates).not.toContain(original);
  });

  it("conserva los inamovibles y reconoce todos los nombres", () => {
    for (const fixed of ["2027-01-01", "2027-03-24", "2027-03-26", "2027-05-25", "2027-07-09", "2027-12-25"]) {
      expect(dates).toContain(fixed);
    }
    expect(holidays).toHaveLength(16);
    expect(holidays.filter((h) => h.key === null)).toEqual([]);
  });
});

describe("transferredDate", () => {
  it("martes y miércoles van al lunes anterior; jueves y viernes, al siguiente", () => {
    expect(transferredDate("2027-08-17")).toBe("2027-08-16"); // martes
    expect(transferredDate("2026-06-17")).toBe("2026-06-15"); // miércoles
    expect(transferredDate("2027-06-17")).toBe("2027-06-21"); // jueves
    expect(transferredDate("2026-11-20")).toBe("2026-11-23"); // viernes
  });

  it("lunes, sábado y domingo no se mueven", () => {
    expect(transferredDate("2026-10-12")).toBe("2026-10-12");
    expect(transferredDate("2027-11-20")).toBe("2027-11-20");
    expect(transferredDate("2028-08-13")).toBe("2028-08-13");
  });
});

describe("holidayKey y yearsAround", () => {
  it("reconoce variantes de nombre y devuelve null para lo desconocido", () => {
    expect(holidayKey("Paso a la Inmortalidad del Gral. José de San Martín")).toBe("san_martin");
    expect(holidayKey("Día de la Soberanía Nacional (20/11)")).toBe("sovereignty");
    expect(holidayKey("Feriado inventado")).toBeNull();
  });

  it("pide el año visible y sus vecinos", () => {
    expect(yearsAround("2026-10-13")).toEqual([2025, 2026, 2027]);
    expect(yearsAround("2026-12-28", "2027-01-03")).toEqual([2025, 2026, 2027, 2028]);
  });
});
