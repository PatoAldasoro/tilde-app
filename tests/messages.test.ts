import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { CALENDAR_CATEGORIES } from "../src/lib/domain/calendar";
import { ICON_KEYS, iconLabelKey } from "../src/lib/domain/icons";

const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();

describe("mensajes", () => {
  it("español e inglés tienen las mismas claves", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it("ningún texto está vacío", () => {
    for (const [locale, messages] of [["es", es], ["en", en]] as const) {
      const empty = Object.entries(messages).filter(([, value]) => value.trim() === "").map(([key]) => key);
      expect(empty, `claves vacías en ${locale}`).toEqual([]);
    }
  });

  it("cada ícono y cada categoría del calendario tienen su nombre", () => {
    const missing = [
      ...ICON_KEYS.map((icon) => iconLabelKey(icon)),
      ...CALENDAR_CATEGORIES.flatMap((category) => [`cat_${category}`, `cat_hint_${category}`]),
    ].filter((key) => !(key in es));
    expect(missing).toEqual([]);
    expect(new Set(ICON_KEYS).size).toBe(ICON_KEYS.length);
  });

  it("cada clave usa las mismas variables en ambos idiomas", () => {
    const mismatched = Object.keys(es).filter((key) => {
      const a = [...new Set(placeholders(es[key as keyof typeof es]))];
      const b = [...new Set(placeholders(en[key as keyof typeof en]))];
      return a.join() !== b.join();
    });
    expect(mismatched).toEqual([]);
  });
});
