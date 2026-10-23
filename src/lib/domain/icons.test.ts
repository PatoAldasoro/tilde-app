import { describe, expect, it } from "vitest";
import { ICON_GROUPS, ICON_KEYS, iconGroup, isIconKey, normalizeSearch, searchIcons, type IconKey } from "./icons";

const LABELS: Partial<Record<IconKey, string>> = {
  "book-open": "Libro abierto",
  "flask-conical": "Matraz",
  calculator: "Calculadora",
  sigma: "Sigma",
  "square-sigma": "Sumatoria",
  map: "Mapa",
  "map-pin": "Ubicación",
  "chart-candlestick": "Bolsa",
  "shopping-bag": "Bolsa de compras",
};
const GROUP_WORDS: Record<string, string> = { math: "Matemática álgebra análisis cálculo", science: "Ciencias química física", sports: "Deporte fútbol tenis pádel ping pong" };
const textOf = (icon: IconKey) => ({ label: LABELS[icon] ?? icon, keywords: GROUP_WORDS[iconGroup(icon)] ?? "" });

describe("íconos", () => {
  it("cada clave está una sola vez y en un solo grupo", () => {
    expect(new Set(ICON_KEYS).size).toBe(ICON_KEYS.length);
    expect(ICON_GROUPS.reduce((total, group) => total + group.icons.length, 0)).toBe(ICON_KEYS.length);
    expect(ICON_KEYS.length).toBeGreaterThan(200);
  });

  it("las claves que ya se guardaron siguen existiendo", () => {
    for (const key of ["book-open", "building-2", "square-function", "volleyball", "paw-print", "gamepad-2", "house"]) expect(isIconKey(key)).toBe(true);
    expect(isIconKey("no-existe")).toBe(false);
  });

  it("cada ícono sabe su grupo", () => {
    expect(iconGroup("calculator")).toBe("math");
    expect(iconGroup("flask-conical")).toBe("science");
    expect(iconGroup("pizza")).toBe("food");
  });

  it("normaliza: sin tildes, minúsculas y un solo espacio", () => {
    expect(normalizeSearch("  Química   ORGÁNICA ")).toBe("quimica organica");
  });
});

describe("buscar íconos", () => {
  it("sin nada escrito están todos, en el orden del selector", () => {
    expect(searchIcons("  ", textOf)).toEqual([...ICON_KEYS]);
  });

  it("encuentra por el nombre, sin importar tildes ni mayúsculas", () => {
    expect(searchIcons("ubicacion", textOf)).toEqual(["map-pin"]);
    expect(searchIcons("MATRAZ", textOf)).toEqual(["flask-conical"]);
  });

  it("los que empiezan igual van primero", () => {
    const results = searchIcons("bolsa", textOf);
    expect(results.slice(0, 2)).toEqual(["chart-candlestick", "shopping-bag"]);
  });

  it("encuentra por las palabras del grupo, después de los que coinciden por el nombre", () => {
    const results = searchIcons("algebra", textOf);
    expect(results).toContain("calculator");
    expect(results.every((icon) => iconGroup(icon) === "math")).toBe(true);
    const sum = searchIcons("suma", textOf);
    expect(sum[0]).toBe("square-sigma");
  });

  it("pádel y ping-pong no tienen ícono propio: la raqueta va primera entre los deportes", () => {
    expect(searchIcons("padel", textOf)[0]).toBe("tennis-racket");
    expect(searchIcons("ping pong", textOf)[0]).toBe("tennis-racket");
  });

  it("encuentra por la clave en inglés de Lucide", () => {
    expect(searchIcons("flask", textOf)).toEqual(expect.arrayContaining(["flask-conical", "flask-round"]));
  });

  it("todas las palabras tienen que coincidir", () => {
    expect(searchIcons("libro abierto", textOf)).toEqual(["book-open"]);
    expect(searchIcons("libro zzz", textOf)).toEqual([]);
  });
});
