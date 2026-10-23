/**
 * Íconos que se pueden elegir para una materia o una actividad, agrupados como en el selector.
 * Son nombres de Lucide en kebab-case (algunos deportes, de Lucide Lab: el set complementario de
 * Lucide, con el mismo trazo); el componente de cada uno está en `src/components/subject-icon.tsx` y
 * su nombre, en el mensaje `icon_<clave>` de cada idioma.
 * Una clave guardada no se puede sacar de la lista: ya hay materias que la usan
 * ("building-2" es el nombre viejo de "building-complex" en Lucide y se queda así).
 */
export const ICON_GROUPS = [
  {
    key: "study",
    icons: [
      "book-open", "book-open-text", "notebook-pen", "notebook", "notebook-tabs", "graduation-cap", "school",
      "university", "library", "library-big", "backpack", "pencil", "pencil-ruler", "highlighter", "eraser", "ruler",
      "paperclip", "clipboard-list", "file-text", "folder-open", "archive", "bookmark", "sticky-note",
      "presentation", "lightbulb", "lamp-desk", "hourglass", "alarm-clock", "calendar-days", "list-checks", "target",
      "award",
    ],
  },
  {
    key: "math",
    icons: [
      "calculator", "sigma", "pi", "square-function", "radical", "infinity", "percent", "variable", "divide",
      "equal", "omega", "binary", "hash", "shapes", "triangle-right", "axis-3d", "grid-3x3", "chart-spline",
      "chart-scatter", "chart-pie", "chart-column", "chart-line", "dice-5", "square-sigma",
    ],
  },
  {
    key: "science",
    icons: [
      "atom", "flask-conical", "flask-round", "test-tube", "test-tubes", "microscope", "dna", "orbit", "telescope",
      "rocket", "satellite", "magnet", "zap", "thermometer", "droplet", "flame", "snowflake", "sun", "moon",
    ],
  },
  {
    key: "nature",
    icons: [
      "earth", "globe", "mountain", "mountain-snow", "wind", "cloud-rain", "leaf", "sprout", "tree-pine", "trees",
      "flower-2", "bug", "fish", "bird", "rabbit", "turtle", "shell", "egg",
    ],
  },
  {
    key: "health",
    icons: [
      "brain", "stethoscope", "heart-pulse", "pill", "syringe", "hospital", "activity", "bandage", "cross",
      "ambulance", "bone", "skull", "ear", "eye", "hand", "scan-heart", "apple", "salad", "baby", "accessibility",
    ],
  },
  {
    key: "tech",
    icons: [
      "code", "code-xml", "terminal", "cpu", "microchip", "database", "server", "network", "circuit-board", "cable",
      "wifi", "router", "bot", "braces", "git-branch", "app-window", "monitor", "laptop", "smartphone", "keyboard",
      "mouse", "hard-drive", "cloud", "lock", "shield-check", "key", "workflow", "blocks",
    ],
  },
  {
    key: "engineering",
    icons: [
      "cog", "wrench", "drafting-compass", "hammer", "hard-hat", "construction", "factory", "plug",
      "battery-charging", "building-2", "building", "car", "plane-takeoff", "train-front", "ship",
    ],
  },
  {
    key: "society",
    icons: [
      "scale", "gavel", "landmark", "briefcase", "briefcase-business", "chart-candlestick", "trending-up", "coins",
      "banknote", "wallet", "piggy-bank", "receipt", "handshake", "store", "users", "user-round", "megaphone",
      "newspaper", "vote",
    ],
  },
  {
    key: "humanities",
    icons: [
      "languages", "speech", "message-circle", "messages-square", "quote", "book-type", "scroll-text", "feather",
      "church", "map", "map-pin", "compass", "flag",
    ],
  },
  {
    key: "arts",
    icons: [
      "palette", "brush", "paintbrush", "pen-tool", "swatch-book", "type", "image", "aperture", "camera", "film",
      "clapperboard", "drama", "theater", "music", "music-2", "guitar", "piano", "drum", "mic", "headphones",
      "shirt", "scissors",
    ],
  },
  {
    key: "sports",
    icons: [
      // La raqueta va primera: es la que aparece al buscar pádel o ping-pong (no hay ícono propio).
      "tennis-racket", "soccer-ball", "soccer-pitch", "basketball", "volleyball", "tennis-ball", "hockey", "rugby-ball",
      "baseball", "golf-driver", "bowling", "waves-ladder", "sport-shoe", "bike", "dumbbell", "biceps-flexed", "weight",
      "ice-skate", "skis", "snowboard", "surfboard", "kayak", "whistle", "trophy", "medal", "footprints", "goal",
      "tent-tree", "person-standing", "swords", "chess-knight",
    ],
  },
  {
    key: "food",
    icons: [
      "utensils", "chef-hat", "coffee", "cup-soda", "pizza", "sandwich", "croissant", "cake", "cookie",
      "ice-cream-cone", "beer", "wine",
    ],
  },
  {
    key: "life",
    icons: [
      "house", "bed-double", "bed", "shopping-cart", "shopping-bag", "bus", "plane", "gamepad-2", "tv", "popcorn",
      "heart", "star", "sparkles", "party-popper", "gift", "paw-print", "dog", "cat", "clock", "bell", "umbrella",
      "shower-head", "washing-machine", "hand-heart",
    ],
  },
] as const;

export type IconGroup = (typeof ICON_GROUPS)[number]["key"];
export type IconKey = (typeof ICON_GROUPS)[number]["icons"][number];

export const ICON_KEYS: readonly IconKey[] = ICON_GROUPS.flatMap((group) => group.icons);

export function isIconKey(value: unknown): value is IconKey {
  return typeof value === "string" && (ICON_KEYS as readonly string[]).includes(value);
}

const GROUP_OF = new Map<IconKey, IconGroup>(ICON_GROUPS.flatMap((group) => group.icons.map((icon) => [icon, group.key] as const)));

/** El grupo del selector al que pertenece un ícono. */
export function iconGroup(icon: IconKey): IconGroup {
  return GROUP_OF.get(icon) ?? ICON_GROUPS[0].key;
}

/** Clave del mensaje con el nombre del ícono ("icon_flask_conical"). */
export function iconLabelKey(icon: IconKey): `icon_${string}` {
  return `icon_${icon.replace(/-/g, "_")}`;
}

// ---------- búsqueda ----------

/** Minúsculas y sin tildes: "Química" y "quimica" son lo mismo. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lo que se compara con la búsqueda: el nombre visible y, aparte, las palabras del grupo. */
export type IconText = { label: string; keywords: string };

/**
 * Íconos que coinciden con lo escrito: cada palabra de la búsqueda tiene que aparecer en el
 * nombre, en las palabras de su grupo o en la clave (en inglés, la de Lucide). Primero los que
 * coinciden por el nombre (los que empiezan igual, antes) y después los que coinciden por el grupo.
 */
export function searchIcons(query: string, textOf: (icon: IconKey) => IconText): IconKey[] {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...ICON_KEYS];
  const ranked: { icon: IconKey; rank: number; index: number }[] = [];
  ICON_KEYS.forEach((icon, index) => {
    const text = textOf(icon);
    const label = normalizeSearch(text.label);
    const all = `${label} ${normalizeSearch(text.keywords)} ${icon.replace(/-/g, " ")}`;
    if (!words.every((word) => all.includes(word))) return;
    const labelWords = label.split(" ");
    const rank = label.startsWith(words[0])
      ? 0
      : words.every((word) => labelWords.some((part) => part.startsWith(word)))
        ? 1
        : words.every((word) => label.includes(word))
          ? 2
          : 3;
    ranked.push({ icon, rank, index });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.icon);
}
