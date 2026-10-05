import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accentScript, headScript, toAccent } from "../src/lib/accent";
import { SUBJECT_COLORS } from "../src/lib/domain/subjects";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const migrations = readFileSync("supabase/migrations/20261004000000_init.sql", "utf8");

describe("paleta y color de acento", () => {
  it("cada color de la paleta tiene sus cinco tonos en claro y en oscuro", () => {
    for (const color of SUBJECT_COLORS) {
      for (const tone of ["solid", "vivid", "soft", "on-soft", "on-solid"]) {
        const declared = tokens.match(new RegExp(`--subject-${color}-${tone}:`, "g")) ?? [];
        expect(declared, `${color}-${tone}`).toHaveLength(2);
      }
    }
  });

  it("cada color de la paleta se puede usar como acento, con todos los tokens del acento", () => {
    const accentTokens = ["accent", "accent-hover", "accent-soft", "accent-text", "accent-fill", "on-accent-fill", "on-accent", "focus-ring"];
    for (const color of SUBJECT_COLORS) {
      const rule = new RegExp(`:root\\[data-accent="${color}"\\][^{]*\\{([^}]*)\\}`).exec(tokens)?.[1] ?? "";
      for (const token of accentTokens) expect(rule, `${color}: --color-${token}`).toContain(`--color-${token}: `);
      // Solo se arma con tonos de ese color.
      expect(rule.match(/--subject-([a-z]+)-/g)?.every((match) => match === `--subject-${color}-`)).toBe(true);
    }
  });

  it("la base acepta exactamente las mismas claves que la app", () => {
    const list = /is_color_key[\s\S]*?value in \(([\s\S]*?)\)/.exec(migrations)?.[1] ?? "";
    expect([...list.matchAll(/'([a-z]+)'/g)].map((match) => match[1])).toEqual([...SUBJECT_COLORS]);
  });

  it("toAccent: una clave de la paleta, o null para el acento original", () => {
    expect(toAccent("turquesa")).toBe("turquesa");
    for (const value of [null, undefined, "", "naranja", "#E44919", 3]) expect(toAccent(value)).toBeNull();
  });

  it("el script de arranque solo acepta claves de la paleta", () => {
    const run = (stored: string | null) => {
      const dataset: Record<string, string> = {};
      new Function("localStorage", "document", accentScript)({ getItem: () => stored }, { documentElement: { dataset } });
      return dataset.accent;
    };
    expect(run("uva")).toBe("uva");
    expect(run(null)).toBeUndefined();
    expect(run("uva\"]{}")).toBeUndefined();
    expect(run("rojo")).toBeUndefined();
  });

  it("el script de <head> aplica el tema y el acento sin romperse", () => {
    const dataset: Record<string, string> = {};
    const stored: Record<string, string> = { "tilde-theme": "dark", "tilde-accent": "cobalto" };
    new Function("localStorage", "document", "matchMedia", headScript)(
      { getItem: (key: string) => stored[key] ?? null },
      { documentElement: { dataset } },
      () => ({ matches: false }),
    );
    expect(dataset).toEqual({ theme: "dark", accent: "cobalto" });
  });
});
