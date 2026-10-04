/** Formato de números para mostrar: coma decimal en español, punto en inglés. */

const EMPTY = "—";

/** Con decimales fijos (promedios: siempre 2). null → "—". */
export function formatDecimal(value: number | null, locale: string, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return EMPTY;
  const text = (Math.round(value * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
  return locale === "es" ? text.replace(".", ",") : text;
}

/** Sin ceros de más (notas en la celda: "8", "8,5", "7,25"). null → "". */
export function formatGrade(value: number | null, locale: string): string {
  if (value === null) return "";
  const text = String(Math.round(value * 100) / 100);
  return locale === "es" ? text.replace(".", ",") : text;
}
