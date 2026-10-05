/**
 * Íconos que se pueden elegir para una materia o una actividad. Son nombres de Lucide en
 * kebab-case; el componente de cada uno está en `src/components/subject-icon.tsx`.
 * El orden es el del selector (8 por fila).
 */
export const ICON_KEYS = [
  // Estudio
  "book-open", "graduation-cap", "notebook-pen", "pencil-ruler", "library", "languages", "presentation", "lightbulb",
  // Exactas y naturales
  "calculator", "sigma", "pi", "square-function", "atom", "flask-conical", "microscope", "dna",
  "brain", "stethoscope", "heart-pulse", "leaf", "globe", "telescope", "zap", "magnet",
  // Tecnología e ingeniería
  "code", "terminal", "cpu", "database", "network", "circuit-board", "cog", "drafting-compass",
  // Sociales, economía y derecho
  "scale", "landmark", "briefcase", "chart-line", "coins", "users", "megaphone", "newspaper",
  // Arte y diseño
  "palette", "music", "camera", "film", "drama", "pen-tool", "building-2", "hammer",
  // Actividades
  "dumbbell", "volleyball", "bike", "trophy", "utensils", "coffee", "bus", "bed-double",
  "shopping-cart", "gamepad-2", "heart", "star", "plane", "house", "paw-print", "guitar",
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export function isIconKey(value: unknown): value is IconKey {
  return typeof value === "string" && (ICON_KEYS as readonly string[]).includes(value);
}

/** Clave del mensaje con el nombre del ícono ("icon_flask_conical"). */
export function iconLabelKey(icon: IconKey): `icon_${string}` {
  return `icon_${icon.replace(/-/g, "_")}`;
}
