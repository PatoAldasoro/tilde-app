import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";

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

  it("cada clave usa las mismas variables en ambos idiomas", () => {
    const mismatched = Object.keys(es).filter((key) => {
      const a = [...new Set(placeholders(es[key as keyof typeof es]))];
      const b = [...new Set(placeholders(en[key as keyof typeof en]))];
      return a.join() !== b.join();
    });
    expect(mismatched).toEqual([]);
  });
});
