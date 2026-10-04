import { describe, expect, it } from "vitest";
import { generatesTask, holidayNames, itemsByDate, linkedTaskFields, splitChips, taskSyncFor, tpTaskTitle, type CalendarEvent } from "./calendar";
import type { Holiday } from "./holidays";

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.random().toString(36).slice(2),
  subject_id: "s1",
  category: "parcial",
  title: "",
  date: "2026-10-20",
  confirmed: true,
  lead_days: null,
  ...overrides,
});

const holiday: Holiday = { date: "2026-10-12", name: "Día del Respeto a la Diversidad Cultural", key: "diversity" };

describe("itemsByDate", () => {
  it("agrupa por fecha y ordena: feriado nacional, feriado, final, parcial, recuperatorio, TP", () => {
    const events = [
      event({ category: "tp", date: "2026-10-12" }),
      event({ category: "recuperatorio", date: "2026-10-12" }),
      event({ category: "parcial", date: "2026-10-12" }),
      event({ category: "final", date: "2026-10-12" }),
      event({ category: "feriado", date: "2026-10-12", subject_id: null }),
      event({ category: "parcial", date: "2026-10-20" }),
    ];
    const map = itemsByDate(events, [holiday]);
    expect(map.get("2026-10-12")?.map((item) => (item.kind === "holiday" ? "nacional" : item.event.category))).toEqual([
      "nacional", "feriado", "final", "parcial", "recuperatorio", "tp",
    ]);
    expect(map.get("2026-10-20")).toHaveLength(1);
    expect(map.get("2026-10-21")).toBeUndefined();
  });
});

describe("splitChips", () => {
  it("muestra hasta 3 chips y cuenta el resto para '+N más'", () => {
    expect(splitChips([1, 2])).toEqual({ shown: [1, 2], more: 0 });
    expect(splitChips([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(splitChips([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], more: 2 });
  });
});

describe("holidayNames", () => {
  it("junta feriados nacionales y manuales; el nacional manda", () => {
    const names = holidayNames(
      [
        event({ category: "feriado", date: "2026-09-21", title: "Día del Estudiante", subject_id: null }),
        event({ category: "feriado", date: "2026-10-12", title: "Otro nombre", subject_id: null }),
        event({ category: "parcial", date: "2026-09-22" }),
      ],
      [holiday],
    );
    expect([...names.keys()].sort()).toEqual(["2026-09-21", "2026-10-12"]);
    expect(names.get("2026-09-21")).toEqual({ name: "Día del Estudiante", holiday: null });
    expect(names.get("2026-10-12")?.holiday).toBe(holiday);
  });
});

describe("TP genera tarea", () => {
  it("solo el TP genera tarea", () => {
    expect(generatesTask("tp")).toBe(true);
    for (const category of ["parcial", "final", "recuperatorio", "feriado"]) expect(generatesTask(category)).toBe(false);
  });

  it("el título es 'TP · <título>' y usa la materia si el evento no tiene título", () => {
    expect(tpTaskTitle("TP", "Circuitos RC", "Física II")).toBe("TP · Circuitos RC");
    expect(tpTaskTitle("TP", "  ", "Física II")).toBe("TP · Física II");
    expect(tpTaskTitle("TP", "", null)).toBe("TP");
  });

  it("la tarea toma materia, fecha y anticipación del evento", () => {
    const tp = event({ category: "tp", title: "Circuitos RC", date: "2026-11-06", lead_days: 5, subject_id: "s9" });
    expect(linkedTaskFields(tp, "TP", "Física II", 3)).toEqual({
      title: "TP · Circuitos RC",
      subject_id: "s9",
      due_date: "2026-11-06",
      lead_days: 5,
    });
    expect(linkedTaskFields({ ...tp, lead_days: null }, "TP", "Física II", 3).lead_days).toBe(3);
  });

  it("decide qué hacer con la tarea al guardar el evento", () => {
    expect(taskSyncFor(null, "tp", false)).toBe("create"); // TP nuevo
    expect(taskSyncFor("tp", "tp", true)).toBe("update"); // editar el TP actualiza su tarea
    expect(taskSyncFor("tp", "tp", false)).toBe("none"); // la tarea se borró a mano: no se recrea
    expect(taskSyncFor("parcial", "tp", false)).toBe("create"); // pasa a ser TP
    expect(taskSyncFor("tp", "parcial", true)).toBe("delete"); // deja de ser TP
    expect(taskSyncFor(null, "parcial", false)).toBe("none");
    expect(taskSyncFor("parcial", "final", false)).toBe("none");
    expect(taskSyncFor(null, "recuperatorio", false)).toBe("none");
  });
});
