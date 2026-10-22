import { describe, expect, it } from "vitest";
import { matchTimeOption, minutesToTime, normalizeTime, parseTimeInput, timeOptions, timeToMinutes } from "./time";

describe("horas", () => {
  it("minutos ↔ texto", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("08:30:00")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
    expect(normalizeTime("18:00:00")).toBe("18:00");
  });

  it("parseTimeInput acepta lo que se escribe a mano", () => {
    expect(parseTimeInput("14:30")).toBe("14:30");
    expect(parseTimeInput(" 9:05 ")).toBe("09:05");
    expect(parseTimeInput("1430")).toBe("14:30");
    expect(parseTimeInput("930")).toBe("09:30");
    expect(parseTimeInput("14")).toBe("14:00");
    expect(parseTimeInput("14.30")).toBe("14:30");
    expect(parseTimeInput("14h30")).toBe("14:30");
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("   ")).toBeNull();
  });

  it("parseTimeInput rechaza lo que no es una hora", () => {
    for (const text of ["25:00", "12:60", "tarde", "12:3", "1:2:3", "-1"]) expect(parseTimeInput(text), text).toBe("invalid");
  });

  it("matchTimeOption resalta la opción que empieza con lo escrito", () => {
    const options = timeOptions(7 * 60, 23 * 60);
    expect(options[matchTimeOption(options, "18")]).toBe("18:00");
    expect(options[matchTimeOption(options, "18:3")]).toBe("18:30");
    expect(options[matchTimeOption(options, "183")]).toBe("18:30");
    expect(options[matchTimeOption(options, "9")]).toBe("09:00");
    expect(options[matchTimeOption(options, "93")]).toBe("09:30");
    expect(matchTimeOption(options, "18:50")).toBe(-1);
    expect(matchTimeOption(options, "")).toBe(-1);
  });
});
