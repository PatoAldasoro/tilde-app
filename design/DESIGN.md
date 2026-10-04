# Tilde — Design spec

Webapp de organización para estudiantes universitarios. Todo gira alrededor de las **materias**: su color identifica horarios, tareas, fechas, notas y sesiones de estudio.

Esta carpeta es la fuente de verdad para implementar la app:

```
design/
├── DESIGN.md            ← este documento
├── assets/              ← logo (símbolo, wordmark, lockup) y favicon en SVG
└── prototype/           ← prototipo clickeable sin build: abrir prototype/index.html
    ├── css/tokens.css   ← todos los tokens (mismos nombres que en este documento)
    ├── css/app.css      ← componentes y pantallas
    └── js/              ← icons.js (Lucide), i18n.js, data.js, core.js, shell.js, views/*.js
```

Parámetros útiles del prototipo (van antes del `#`): `?tema=claro|oscuro|sistema`, `?lang=es|en`, `?hoy=2026-10-13` (fecha "de hoy"; por defecto el martes 13/10/2026 para mostrar el feriado del 12/10), `?hora=16:20` (fija la hora de la línea "ahora"), `?velocidad=60` (acelera el timer ×60).

---

## 1. Nombre y logo

### Propuestas

| Nombre | Por qué |
|---|---|
| **Tilde** (elegido) | De *tildar*: marcar lo que ya está hecho. También es la virgulilla de la ñ. Dos sílabas que se dicen igual en español e inglés. |
| Órbita | Todo orbita alrededor de las materias. Claro en ambos idiomas, pero el acento complica dominios y búsquedas. |
| Hilo | "El hilo de la cursada": corto y cálido, pero en inglés se lee "hai-lo" y pierde el sentido. |

**Elegido: Tilde.** Se escribe "Tilde" en texto corrido y "tilde" (minúscula) solo en el wordmark.

### Logo

- **Símbolo** (`assets/tilde-symbol.svg`, `tilde-symbol-dark.svg`): cuadrado redondeado (radio 6,5 sobre 24) en `--color-accent` con un trazo que empieza como una tilde (~) y termina en una marca de verificación (dibujada como trazo). Trazo 2,4 sobre 24, puntas redondeadas.
- **Wordmark** (`tilde-wordmark.svg`, `-dark.svg`, `-currentcolor.svg`): letras monolínea dibujadas a mano con el mismo lenguaje de trazo (grosor 3 sobre 28 de alto, terminaciones redondeadas). Está en trazos SVG: no depende de ninguna fuente.
- **Lockup** (`tilde-logo.svg`, `tilde-logo-dark.svg`): símbolo 28 px + 12 px de separación + wordmark.
- **Favicon** (`favicon.svg`): versión simplificada (trazo 3,1, radio 5,5) con `prefers-color-scheme` interno; legible a 16 px. Para PNG: exportar 16, 32, 180 (apple-touch) y 512 desde este SVG.

Uso:
- Claro: fondo `#E44919`, trazo `#FFFFFF`, wordmark `#1E1C19`. Oscuro: fondo `#FF754A`, trazo `#131211`, wordmark `#EDEAE5`. En la app se dibuja inline con `var(--color-accent)` / `var(--color-on-accent)` y `currentColor`.
- Área de respeto: la mitad del alto del símbolo alrededor. Tamaño mínimo: símbolo 16 px; lockup 20 px de alto.
- No rotar, no cambiar el color del símbolo por el de una materia, no poner el símbolo sobre fotos, no agregar sombras.
- Dónde aparece: barra de la landing (lockup 30 px), hero (símbolo 64 px), drawer (lockup 28 px), pie de la landing (lockup 22 px), pestaña del navegador (favicon).

---

## 2. Principios

1. Las materias son las protagonistas: su color aparece en todas partes; la interfaz se queda en neutros cálidos.
2. Un solo acento (bermellón) para lo que importa ahora: hoy, la hora actual, el foco, lo marcado.
3. Jerarquía tipográfica antes que cajas: títulos en serif, todo lo demás en una sans sobria con números tabulares.
4. Nada depende del hover ni del color solo: cada acción tiene un control visible y cada estado, un texto o una forma.
5. Calma por defecto: bordes finos, sombras solo en lo que flota, movimiento corto y con intención.
6. Escrito como habla un compañero: frases cortas, sin marketing, sin voseo marcado.

---

## 3. Tokens

Todos están en `prototype/css/tokens.css` con estos mismos nombres. El tema se elige con `data-theme="light|dark"` en `<html>`; la preferencia "Sistema" resuelve con `prefers-color-scheme` y se re-evalúa cuando cambia el sistema. El oscuro **no es el claro invertido**: la elevación sube aclarando la superficie, los bordes bajan de contraste, las sombras se reemplazan por un borde de 1 px más una sombra negra profunda, el acento se aclara y lleva texto tinta encima, y el primario pasa a ser claro.

### 3.1 Color — interfaz

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#FAF9F7` | `#131211` | Fondo de la app |
| `--color-surface` | `#FFFFFF` | `#1B1A18` | Tarjetas, tablas, grilla |
| `--color-surface-raised` | `#FFFFFF` | `#242220` | Diálogos, popovers, paneles |
| `--color-surface-sunken` | `#F3F1ED` | `#0F0E0D` | Controles segmentados, celdas fuera de mes, rellenos sutiles |
| `--color-surface-hover` | `#F1EFEB` | `#262421` | Hover de filas y botones ghost |
| `--color-surface-active` | `#E9E6E1` | `#2E2B28` | Pressed / seleccionado neutro |
| `--color-border` | `#E7E3DD` | `#302D2A` | Divisores y bordes de tarjeta (decorativos) |
| `--color-border-strong` | `#D6D1C9` | `#3E3A36` | Botón secundario, chips interactivos, bordes con más peso |
| `--color-border-control` | `#948D83` | `#716A61` | Borde de inputs, checkbox y switch (≥3:1) |
| `--color-text` | `#1E1C19` | `#EDEAE5` | Texto principal |
| `--color-text-muted` | `#5E5850` | `#ADA69C` | Texto secundario |
| `--color-text-subtle` | `#706A61` | `#8F887E` | Metadatos, placeholders, ejes |
| `--color-text-disabled` | `#A9A39A` | `#5C5751` | Texto deshabilitado (exento de contraste) |
| `--color-primary` | `#1E1C19` | `#EDEAE5` | Botón primario (tinta) |
| `--color-primary-hover` | `#3A3732` | `#FFFFFF` |  |
| `--color-primary-active` | `#000000` | `#D9D4CC` |  |
| `--color-on-primary` | `#FAF9F7` | `#171513` | Texto sobre primario |
| `--color-accent` | `#E44919` | `#FF754A` | Acento: indicadores, checkbox marcado, anillo del timer, línea de "ahora", progreso |
| `--color-accent-hover` | `#CF3F12` | `#FF8B66` |  |
| `--color-accent-soft` | `#FCEDE7` | `#3A2219` | Fondo de ítem activo del drawer, selección |
| `--color-accent-text` | `#BD3403` | `#FF8D65` | Acento usado como texto |
| `--color-accent-fill` | `#BD3403` | `#FF754A` | Relleno con texto encima (fecha de hoy, etiqueta de hora) |
| `--color-on-accent-fill` | `#FFFFFF` | `#1A0F0A` | Texto sobre accent-fill |
| `--color-on-accent` | `#FFFFFF` | `#1A0F0A` | Ícono sobre accent (check) |
| `--color-focus-ring` | `#E44919` | `#FF8D65` | Anillo de foco |
| `--color-success` | `#12924F` | `#4CC97F` | Progreso completo, descanso, presencia |
| `--color-success-soft` | `#E3F5EA` | `#15301F` |  |
| `--color-success-text` | `#0C6E3B` | `#6FD597` |  |
| `--color-warning` | `#C27A00` | `#F0AE3C` | Prioridad media |
| `--color-warning-soft` | `#FCF0D9` | `#33270F` | Chip "entrega pronto" |
| `--color-warning-text` | `#8A5700` | `#F5C46B` |  |
| `--color-danger` | `#D92D3A` | `#FF6B6B` | Prioridad alta, botón destructivo |
| `--color-danger-hover` | `#BF2230` | `#FF8585` |  |
| `--color-danger-soft` | `#FDEBEC` | `#3A1A1B` | Chip "vencida", fondo de error |
| `--color-danger-text` | `#B4232F` | `#FF8A8A` | Texto de error / destructivo |
| `--color-on-danger` | `#FFFFFF` | `#1A0B0B` | Texto sobre danger |
| `--color-info` | `#2F6FDB` | `#6EA1FF` | Prioridad baja |
| `--color-info-soft` | `#E8F0FD` | `#172640` |  |
| `--color-info-text` | `#2457B8` | `#8DB4FF` |  |
| `--color-priority-high` | `var(--color-danger)` | `—` | = danger |
| `--color-priority-medium` | `var(--color-warning)` | `—` | = warning |
| `--color-priority-low` | `var(--color-info)` | `—` | = info |
| `--color-holiday-bg` | `#EFEDE9` | `#26241F` | Feriado (chip, columna) |
| `--color-holiday-text` | `#5E5850` | `#ADA69C` |  |
| `--color-holiday-border` | `#D6D1C9` | `#3E3A36` |  |
| `--color-scrim` | `rgba(30, 28, 25, 0.32)` | `rgba(0, 0, 0, 0.56)` | Velo detrás de drawer/diálogo |
| `--color-skeleton` | `#ECE9E4` | `#2A2825` | Carga (skeleton) |
| `--color-stripe` | `rgba(30, 28, 25, 0.10)` | `rgba(237, 234, 229, 0.08)` | Rayado de bloques omitidos |

#### Contraste verificado (WCAG 2.2)

| Par (texto/elemento sobre fondo) | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `color-text` / `color-bg` | 16.16 | 15.59 | 4.5:1 |
| `color-text-muted` / `color-bg` | 6.68 | 7.76 | 4.5:1 |
| `color-text-subtle` / `color-bg` | 5.09 | 5.34 | 4.5:1 |
| `color-text-subtle` / `color-surface-sunken` | 4.75 | 5.50 | 4.5:1 |
| `color-border-control` / `color-surface` | 3.28 | 3.26 | 3:1 |
| `color-on-primary` / `color-primary` | 16.16 | 15.18 | 4.5:1 |
| `color-accent` / `color-surface` | 3.99 | 6.54 | 3:1 |
| `color-accent-text` / `color-surface` | 5.74 | 7.66 | 4.5:1 |
| `color-on-accent-fill` / `color-accent-fill` | 5.74 | 7.07 | 4.5:1 |
| `color-on-accent` / `color-accent` | 3.99 | 7.07 | 3:1 |
| `color-danger-text` / `color-danger-soft` | 5.67 | 6.89 | 4.5:1 |
| `color-on-danger` / `color-danger` | 4.79 | 6.90 | 4.5:1 |
| `color-warning-text` / `color-warning-soft` | 5.40 | 9.03 | 4.5:1 |
| `color-success-text` / `color-success-soft` | 5.60 | 7.89 | 4.5:1 |
| `color-info-text` / `color-info-soft` | 5.85 | 7.28 | 4.5:1 |
| `color-holiday-text` / `color-holiday-bg` | 6.01 | 6.43 | 4.5:1 |
| `color-accent-text` / `color-accent-soft` | 5.03 | 6.50 | 4.5:1 |

Notas: `--color-border` (decorativo) no necesita 3:1; todo control que hay que identificar (input, checkbox, switch, chip interactivo) usa `--color-border-control` o un texto propio. `--color-text-disabled` y los números de días fuera del mes son inactivos (exentos).

### 3.2 Color — paleta de materias (12)

Se elige de una lista cerrada; no hay selector libre. Paleta generada en OKLCH con luminosidad constante por rol, para que todas las materias tengan el mismo "peso" y el mismo contraste. Cada color expone cinco roles:

| Rol | Variable | Uso |
|---|---|---|
| solid | `--subject-<clave>-solid` | Rellenos con texto encima (chip de **final**), check del swatch elegido. Lleva `on-solid`. |
| vivid | `--subject-<clave>-vivid` | Marcas sin texto: barra de progreso, punto del chip, franja de la tarjeta, swatch. ≥3:1 contra el fondo. |
| soft | `--subject-<clave>-soft` | Fondo de bloques del horario, chips de materia, ícono de documento. |
| on-soft | `--subject-<clave>-on-soft` | Texto sobre `soft`. |
| on-solid | `--subject-<clave>-on-solid` | Texto sobre `solid` (blanco en claro, tinta en oscuro). |

En el código, cualquier elemento recibe la clase `.subj-<clave>`, que expone `--s-solid`, `--s-vivid`, `--s-soft`, `--s-on-soft`, `--s-on-solid` para los componentes.

| Clave | Nombre ES / EN | Claro: solid · vivid · soft · on-soft · on-solid | Oscuro: solid(=vivid) · soft · on-soft · on-solid | Contraste claro: blanco/solid · on-soft/soft · vivid/bg | Contraste oscuro: on-solid/solid · on-soft/soft · solid/surface |
|---|---|---|---|---|---|
| `frambuesa` | Frambuesa / Raspberry | `#CA4568` · `#F25980` · `#FEEBED` · `#9E3D55` · `#FFFFFF` | `#F87F99` · `#472028` · `#FEB2BF` · `#131211` | 4.60 · 5.63 · 3.06 | 7.56 · 8.19 · 7.03 |
| `mandarina` | Mandarina / Tangerine | `#B95A05` · `#E26F04` · `#FFECE1` · `#9A4901` · `#FFFFFF` | `#F38C48` · `#45240E` · `#FEB98F` · `#131211` | 4.64 · 5.51 · 3.07 | 7.71 · 8.30 · 7.17 |
| `ambar` | Ámbar / Amber | `#9B6C06` · `#BE8403` · `#FDEED7` · `#835A01` · `#FFFFFF` | `#DE9D16` · `#3E2903` · `#EFC37E` · `#131211` | 4.62 · 5.36 · 3.07 | 7.97 · 8.39 · 7.40 |
| `lima` | Lima / Lime | `#598005` · `#6E9E05` · `#E9F5DC` · `#4B6D00` · `#FFFFFF` | `#8FBC4C` · `#253310` · `#B8D790` · `#131211` | 4.65 · 5.32 · 3.04 | 8.43 · 8.44 · 7.84 |
| `pino` | Pino / Pine | `#068553` · `#03A567` · `#DEF8E7` · `#027347` · `#FFFFFF` | `#40C786` · `#0C3722` · `#91DFB2` · `#131211` | 4.68 · 5.27 · 3.03 | 8.67 · 8.45 · 8.06 |
| `turquesa` | Turquesa / Teal | `#028380` · `#0EA09D` · `#D6F8F6` · `#016F6D` · `#FFFFFF` | `#0AC3BF` · `#023634` · `#74DFDB` · `#131211` | 4.60 · 5.33 · 3.05 | 8.53 · 8.43 · 7.93 |
| `cielo` | Cielo / Sky | `#047BB1` · `#0598D9` · `#E3F3FE` · `#026896` · `#FFFFFF` | `#31B7FE` · `#083248` · `#92D4FF` · `#131211` | 4.69 · 5.41 · 3.07 | 8.32 · 8.39 · 7.73 |
| `cobalto` | Cobalto / Cobalt | `#486FDA` · `#5E8AFE` · `#E9F0FF` · `#405EAD` · `#FFFFFF` | `#84A8FE` · `#1F2C4C` · `#B3CAFE` · `#131211` | 4.60 · 5.37 · 3.05 | 8.03 · 8.40 · 7.46 |
| `uva` | Uva / Grape | `#8E5CCC` · `#AC72F4` · `#F3EDFF` · `#724EA0` · `#FFFFFF` | `#BD92F9` · `#332647` · `#D6BCFE` · `#131211` | 4.61 · 5.54 · 3.09 | 7.70 · 8.27 · 7.16 |
| `fucsia` | Fucsia / Fuchsia | `#BE4992` · `#E45DB1` · `#FEE9F4` · `#954074` · `#FFFFFF` | `#EC81C0` · `#432135` · `#FAB0D9` · `#131211` | 4.61 · 5.57 · 3.07 | 7.55 · 8.14 · 7.01 |
| `cacao` | Cacao / Cocoa | `#966B4D` · `#B38667` · `#FBEDE4` · `#7E5A42` · `#FFFFFF` | `#C9A187` · `#382B22` · `#E5C3AC` · `#131211` | 4.66 · 5.35 · 3.06 | 7.96 · 8.29 · 7.40 |
| `grafito` | Grafito / Graphite | `#78746D` · `#938E87` · `#F0EEEB` · `#63605A` · `#FFFFFF` | `#AFAAA3` · `#302D29` · `#CECAC3` · `#131211` | 4.65 · 5.41 · 3.09 | 8.11 · 8.39 · 7.54 |

Orden en el selector (fila de 6 × 2): frambuesa, mandarina, ámbar, lima, pino, turquesa / cielo, cobalto, uva, fucsia, cacao, grafito. Al crear una materia se preselecciona el primer color que no use otra materia activa.

### 3.3 Tipografía

| Familia | Token | Uso | Fuente |
|---|---|---|---|
| **Instrument Serif** 400 (+ itálica) | `--font-display` | Títulos de página, hero, títulos de la landing, mes del calendario, números grandes de "Hoy" | Google Fonts / `@fontsource/instrument-serif` |
| **Geist** 300–600 (variable) | `--font-sans` | Todo lo demás: UI, cuerpo, tablas, timer | Google Fonts / `@fontsource-variable/geist` |
| Roboto 500 | `--font-google-button` | Solo el texto del botón "Continuar con Google" (lo pide la guía de marca de Google) | Google Fonts |

Por qué esta pareja: Instrument Serif le da la calidez editorial de Claude y un contraste claro con la UI (condensada, de trazo fino, se luce a partir de 28 px y nunca se usa chica). Geist es una grotesca neutra, muy legible a 13–15 px, con numerales tabulares reales (`tnum`), cero con forma propia y peso Light elegante para el timer: hace de "Notion" sin ser Inter. Fallbacks: `"Iowan Old Style", "Palatino Linotype", Georgia, serif` y `ui-sans-serif, system-ui, -apple-system, "Segoe UI"`.

Carga (prototipo): `https://fonts.googleapis.com/css2?family=Geist:wght@300..600&family=Instrument+Serif:ital@0;1&family=Roboto:wght@500&display=swap`. En producción, preferir Fontsource (self-host) con `font-display: swap`.

| Token | Tamaño / interlineado | Peso | Familia | Uso |
|---|---|---|---|---|
| `--text-display-xl` | 72 / 1.0 (hero usa 96, 84 bajo 1280) | 400 | display | Hero |
| `--text-display-l` | 48 / 1.05 | 400 | display | Títulos de bloque de la landing (52 → 44 bajo 1100), estado de primer uso |
| `--text-title-l` | 36 / 1.1 | 400 | display | — (reservado) |
| topbar | 30 / 1.0 | 400 | display | Título de cada sección en la barra superior |
| `--text-title-m` | 22 / 1.3 | 600 | sans | Título de diálogo, % de hoy |
| `--text-title-s` | 17 / 1.4 | 600 | sans | Nombre en tarjeta de materia, encabezado de día |
| `--text-body` | 15 / 1.5 | 400 | sans | Texto base, título de tarea |
| `--text-body-s` | 14 / 1.45 | 400–500 | sans | Botones, inputs, menús, tablas |
| `--text-caption` | 13 / 1.4 | 400–500 | sans | Metadatos, labels de campo |
| `--text-micro` | 12 / 1.35 | 500 | sans | Chips, badges, tooltips |
| `--text-stat` | 34 / 1.1 | 500 | sans tnum | Promedios |
| `--text-timer` | 96 / 1.0 | 300 | sans tnum | Timer |
| `--text-timer-focus` | 136 / 1.0 (120 bajo 1280) | 300 | sans tnum | Timer en modo foco |

Interlineados (tokens): `--leading-display-xl` 1.0 · `--leading-display-l` 1.05 · `--leading-title-l` 1.1 · `--leading-title-m` 1.3 · `--leading-title-s` 1.4 · `--leading-body` 1.5 · `--leading-body-s` 1.45 · `--leading-caption` 1.4 · `--leading-micro` 1.35 · `--leading-stat` 1.1 · `--leading-timer` 1. `--font-mono` (Geist Mono) queda definido para código o atajos de teclado; no se usa en la UI actual.

Pesos: `--weight-light` 300, `--weight-regular` 400, `--weight-medium` 500, `--weight-semibold` 600. Tracking: `--tracking-normal` 0 (por defecto), `--tracking-tight` −0.02em (títulos sans), `--tracking-display` −0.01em, `--tracking-caps` 0.06em (labels de sección en mayúsculas, solo `section-label`).

**Numerales tabulares** (`font-variant-numeric: tabular-nums`, clase `.tnum`): timer, horas del horario, fechas DD/MM, conteos (3/7), porcentajes, notas y promedios, créditos, duración de sesiones.

### 3.4 Espaciado

Base 4 px: `--space-0-5` 2 · `--space-1` 4 · `--space-1-5` 6 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64 · `--space-20` 80 · `--space-24` 96.

### 3.5 Radios y bordes

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 4 px | Badges, etiqueta de feriado, tooltip interno |
| `--radius-sm` | 6 px | Botones, inputs, chips, filas de tarea, bloques del horario, checkbox (6) |
| `--radius-md` | 10 px | Tarjetas, tablas, popovers, paneles |
| `--radius-lg` | 14 px | Diálogos, tarjeta del timer, marcos de captura |
| `--radius-xl` | 22 px | Contenedores de la landing |
| `--radius-full` | 999 px | Solo avatares, switch, botón play, píldora de fase, barras de progreso |

Bordes: `--border-width` 1 px (general), `--border-width-strong` 1.5 px (chips del calendario, checkbox, bloque de actividad), `--border-width-final` 3 px doble (final). Bordes punteados solo con significado: TP (calendario), actividad (horario), "solo diseño", tarjeta fantasma "Agregar materia".

### 3.6 Sombras (solo en lo que flota)

| Token | Claro | Oscuro |
|---|---|---|
| `--shadow-popover` | `0 1px 2px rgba(30,28,25,.06), 0 8px 24px -8px rgba(30,28,25,.18)` | `0 0 0 1px #34312D, 0 12px 28px -8px rgba(0,0,0,.6)` |
| `--shadow-dialog` | `0 2px 4px rgba(30,28,25,.06), 0 24px 48px -12px rgba(30,28,25,.28)` | `0 0 0 1px #34312D, 0 28px 56px -12px rgba(0,0,0,.7)` |
| `--shadow-drawer` | `8px 0 32px -12px rgba(30,28,25,.24)` | `1px 0 0 #302D2A, 12px 0 40px -12px rgba(0,0,0,.7)` |
| `--shadow-drag` | `0 2px 4px rgba(30,28,25,.08), 0 16px 32px -8px rgba(30,28,25,.26)` | `0 0 0 1px #3E3A36, 0 18px 36px -8px rgba(0,0,0,.7)` |
| `--shadow-focus` | `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-focus-ring)` | igual |

Tarjetas, filas y tablas no tienen sombra: borde de 1 px.

### 3.7 Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--duration-instant` | 80 ms | Fades con movimiento reducido |
| `--duration-fast` | 120 ms | Hover, pressed, aparición de popover/tooltip |
| `--duration-base` | 180 ms | Diálogo, switch, toast, cambios de estado |
| `--duration-slow` | 260 ms | Reacomodo de filas (FLIP), barra de progreso, panel lateral |
| `--duration-drawer` | 240 ms | Drawer |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Cambios en el lugar |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas (drawer, diálogo, sheet, toast) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Salidas |

Animaciones: `pop-in` (opacidad 0→1 + translateY 4 px + scale .98→1), `slide-in-left` (drawer), `slide-in-right` (sheet), `toast-in`, `fade-in` (scrim, modo foco). Con `prefers-reduced-motion: reduce` todas las duraciones pasan a 1 ms y no se ejecuta el FLIP de filas.

### 3.8 Capas (z-index)

`--z-topbar` 20 · `--z-sheet` 40 · `--z-drawer` 50 · `--z-dialog` 60 · `--z-popover` 70 · `--z-toast` 80 · `--z-drag` 90 · `--z-focus-mode` 100.

---

## 4. Layout

- Plataforma: desktop y tablets 10–13" en modo escritorio, **1024–1440 px de ancho** (se diseña a 1440 y se verifica a 1024 y 1366). No hay layout mobile.
- `--topbar-height` 64 px, fija (sticky). Contiene: botón `menu` (40 × 40, siempre arriba a la izquierda), título de la sección en serif 30 px y las acciones de la página a la derecha (alineadas con el borde derecho del contenido).
- `--drawer-width` 296 px, superpuesto con scrim; con el drawer cerrado el contenido usa todo el ancho.
- `--gutter` 32 px (24 px por debajo de 1200).
- Anchos máximos de contenido: `--content-max` 1200 px (Inicio, Sesiones), `--content-narrow` 860 px (Tareas, para que la fila no se estire), ancho completo (Horario y Calendario).
- `--sheet-width` 440 px (panel lateral derecho de materia y de tarea, sin velo).
- Grillas: tarjetas de materia `repeat(auto-fill, minmax(300px, 1fr))` con gap 16; Notas 2 columnas (1 bajo 1100); Sesiones `1fr 360px` (320 bajo 1280, 300 bajo 1100); Calendario 7 columnas iguales, celda mínima `--calendar-cell-min` 124 px; Horario `--schedule-time-col` 60 px + N días, `--schedule-slot-height` 26 px por cada 30 min (07:00–23:00 = 832 px, scroll interno).
- Targets táctiles: `--hit-target` 40 px; controles `--control-height` 40, `--control-height-sm` 32 (sube a 40 con `pointer: coarse`), `--control-height-lg` 48.

---

## 5. Íconos (Lucide)

- Librería única: **Lucide** (verificado contra `lucide-static@1.52.0`). En React: `lucide-react`, mismo nombre en PascalCase (`grip-vertical` → `GripVertical`).
- Trazo 2 (1.75 en tamaños ≥ 28 px), `stroke-linecap/linejoin: round`, color `currentColor`, siempre `aria-hidden="true"` (el texto o `aria-label` del control da el nombre).
- Tamaños: 12–13 (dentro de chips y metadatos), 16 (botones chicos, menús), 18 (botones), 20 (por defecto), 22 (menú de la barra), 28 (play), 32 (estados vacíos).
- Íconos rellenos: solo `flag` en prioridad media/alta (`fill: currentColor`) y `play`/`pause`.
- Única excepción a Lucide: la "G" oficial de Google en el botón de login. El logo de Tilde es propio.

| Uso | Ícono |
|---|---|
| Abrir menú / cerrar | `menu` / `x` |
| Inicio · Horario · Tareas · Calendario · Sesiones | `house` · `calendar-clock` · `list-checks` · `calendar-days` · `timer` |
| Ajustes · Cerrar sesión | `settings` · `log-out` |
| Tema claro · oscuro · sistema | `sun` · `moon` · `monitor` |
| Agregar (botones, agregar rápido, celda del calendario) | `plus` |
| Agregar fecha | `calendar-plus` |
| Menú de opciones (tarjeta, Tareas) | `ellipsis` |
| Editar · Eliminar/Borrar | `pencil` · `trash-2` |
| Archivar · Desarchivar · Archivadas | `archive` · `archive-restore` · `archive` |
| Volver a materias | `arrow-left` |
| Docente · Comisión/cuatrimestre | `user-round` · `calendar` |
| Documentos (contador) | `file-text` |
| Tipos de documento: Docs · Hojas · Presentaciones · Imagen · PDF/archivo · Link | `file-text` · `file-spreadsheet` · `presentation` · `image` · `file` · `link` |
| Abrir en pestaña nueva | `external-link` |
| Agregar desde Drive · Pegar link | `folder-open` · `link` |
| Ayuda de promedios · Nota al pie | `circle-help` · `info` |
| Error de campo · Vencida | `circle-alert` |
| Semana/mes anterior · siguiente | `chevron-left` · `chevron-right` |
| Días visibles | `calendar-days` |
| Feriado (etiqueta y columna) | `calendar-off` |
| Aula | `map-pin` |
| Actividad recurrente | `repeat` |
| Omitir esta vez · Restaurar / Deshacer | `calendar-x-2` · `undo-2` |
| Clase de una materia · Actividad (selector del diálogo) | `book-open` · `calendar` |
| Asa de arrastre | `grip-vertical` |
| Checkbox marcado | `check` |
| Prioridad | `flag` |
| Fecha límite | `calendar` (vencida: `circle-alert`) |
| Contador de subtareas | `list-todo` |
| Expandir/contraer subtareas | `chevron-down` (rota 180°) |
| Tarea arrastrada de días anteriores | `history` |
| Ordenar por prioridad | `arrow-down-wide-narrow` |
| Seleccionar | `square-check` |
| Todo completado | `circle-check-big` |
| Vacío de Tareas · de Inicio/Notas · de Horario · de Historial | `list-checks` · `book-open` · `calendar-clock` · `history` |
| Fase foco · descanso | `target` · `coffee` |
| Iniciar · Pausar · Reiniciar · Saltar descanso | `play` · `pause` · `rotate-ccw` · `skip-forward` |
| Sonido activado · desactivado | `volume-2` · `volume-x` |
| Preset personalizado | `sliders-horizontal` |
| Modo foco · salir | `maximize-2` · `minimize-2` |
| Pestañas Sesión · Historial · Amigos | `timer` · `history` · `users` |
| Agregar amigos | `user-plus` |
| Tarea vinculada (popover del calendario) | `list-checks` |
| Cargando (botones usan spinner CSS; inline) | `loader-circle` |

---

## 6. Componentes

Estados comunes a todo control interactivo: **default**, **hover** (fondo `--color-surface-hover` o color `*-hover`), **focus visible** (`--shadow-focus`: anillo de 2 px en `--color-focus-ring` separado 2 px del fondo; en tabs y filas, anillo interior), **active** (scale .98 o fondo `--color-surface-active`), **disabled** (`--color-surface-sunken` + `--color-text-disabled`, `cursor: not-allowed`, sin hover). Error y cargando donde se indica.

### Botón `.btn`
- Variantes: `btn-primary` (tinta: `--color-primary` / `--color-on-primary`; una por vista), `btn-secondary` (superficie + `--color-border-strong`), `btn-ghost` (sin fondo), `btn-danger` (`--color-danger` / `--color-on-danger`), `btn-danger-ghost` (texto `--color-danger-text`, hover `--color-danger-soft`), `btn-accent` (`--color-accent-fill`, uso puntual).
- Tamaños: default 40 alto (padding 0 16, texto 14/500); `btn-sm` 32 (40 con `pointer: coarse`); `btn-lg` 48 (padding 0 24, 15); `btn-icon` cuadrado 40 (con `aria-label`).
- Ícono a la izquierda, gap 8, tamaño 18. Cargando: `.is-loading` oculta el texto y muestra un spinner de 16 px; `pointer-events: none`.
- Radio `--radius-sm`.

### Botón de Google `.btn-google`
Sigue las guías de Google Sign-In: claro `#FFFFFF`, borde `#747775`, texto `#1F1F1F`; oscuro `#131314`, borde `#8E918F`, texto `#E3E3E3`; Roboto Medium 14, "G" de 20 px, alto 40 (grande: 48, texto 16). Texto: "Continuar con Google" / "Continue with Google". Cargando: opacidad .7 + "Conectando…".

### Input `.input`, select `.select`, textarea `.textarea`
- Alto 40, padding 0 12, texto 14, radio 6, borde `--color-border-control` (3.3:1).
- Hover: borde `--color-text-muted`. Focus: borde `--color-focus-ring` + halo 3 px `--color-accent-soft`. Disabled: fondo sunken, borde `--color-border`. **Error**: `.is-invalid` → borde `--color-danger` + halo `--color-danger-soft`, mensaje `.field-error` (12 px, `circle-alert` 14) debajo y `aria-invalid` + `aria-describedby`.
- Campo `.field`: label 13/500 muted encima (gap 6), hint 12 subtle debajo. Obligatorio: `*` en `--color-danger-text` (aria-hidden) + `aria-required`.
- `input-inline` (celdas de notas, nombre de documento): sin borde hasta hover/focus; en Notas, fondo sunken para que se vea editable.
- Select nativo con flecha dibujada en CSS.

### Checkbox `.check` (role="checkbox")
- Caja 20 × 20 (18 en subtareas), radio 6, borde 1.5 `--color-border-control`; área táctil 40 × 40.
- Marcado: fondo `--color-accent`, ícono `check` 14 (trazo 3) en `--color-on-accent`. Hover: borde muted / fondo hover. Pressed: scale .9.
- **Bloqueado** (tarea con subtareas pendientes): `aria-disabled="true"` (no `disabled`, para que siga recibiendo foco y tap), borde punteado, opacidad .75, tooltip "Faltan N subtareas para poder completarla"; al tocarlo muestra el tooltip 2,2 s (y un toast en pantallas táctiles).
- Variante selección `.check-select`: círculo; marcado en `--color-primary`.

### Switch `.switch` (role="switch")
Pista 36 × 22, pulgar 15; apagado: fondo sunken + borde control; encendido: `--color-accent`. Etiqueta a la derecha, área total ≥ 40 de alto. Disabled: opacidad .5.

### Control segmentado `.seg`
Contenedor sunken con borde, padding 3, ítems de 38 de alto; seleccionado: superficie + borde 1 px (oscuro: `--color-surface-active`). Roles: `radiogroup`/`radio` con `aria-checked`. Usos: General | Por materia, filtro de fecha, presets, tema, idioma, repetición, tipo de alta en Horario.

### Tabs `.tabs`
Texto 15/500, alto 44, subrayado 2 px `--color-accent` en la activa. `role="tablist"`/`tab`, `aria-selected`. Usos: Materias | Notas, Sesión | Historial | Amigos.

### Chip `.chip` y chip interactivo `.chip-toggle`
- `.chip` (24 alto, radio 6, 12/500): fondo `--s-soft`, texto `--s-on-soft`, punto 7 px `--s-vivid`. Se trunca con elipsis; nombres largos usan forma corta (`POO`, `XML`, `Lógica Comp.`) con el nombre completo en `title`.
- `.chip-toggle` (40 alto): borde strong; seleccionado: fondo `--s-soft`, borde `--s-solid`, texto `--s-on-soft`. Usos: filtro por materia, selector de prioridad.
- `.daychip` 40 × 40 (L M X J V S D): seleccionado en primario.
- `.badge` 20 alto, radio 4: neutro, `badge-accent`, `badge-danger`, `badge-warning`, `badge-success`, `badge-info`, `badge-outline` (punteado: "Solo diseño", "Selector simulado").

### Selector de color `.swatches`
Grilla 6 × 2 de botones 40 × 40 (role="radio"), fondo `--s-soft` y círculo 22 `--s-vivid`; elegido: círculo 26 `--s-solid` con `check` 16 `--s-on-solid` + anillo interior 2 px `--s-solid`. Tooltip con el nombre del color.

### Barra de progreso `.progress`
Pista sunken (oscuro: surface-active), radio full; alturas 4 (`-xs`, encabezado de día), 6 (default, tarjetas), 10 (`-lg`, progreso de hoy). Relleno `--bar` (acento por defecto; `--s-vivid` en tarjetas; `--color-success` al llegar a 100 % en días). `role="progressbar"` con `aria-valuenow`. Transición de ancho `--duration-slow`.

### Avatar `.avatar`
36 (44 en `-lg`), círculo, iniciales 13/600 sobre `--s-soft`/`--s-on-soft` del color asignado. Presencia: punto 12 `--color-success` con aro de superficie. Sin fotos de stock (si hay foto de Google, se usa la foto).

### Tooltip `[data-tip]`
Fondo `--color-primary`, texto `--color-on-primary` 12, radio 6, máx. 260 px; aparece tras 200 ms con hover **o foco de teclado**. En táctil (`hover: none`) no depende del hover: los íconos de ayuda abren un popover al tocar (`help-btn`) y los checkbox bloqueados muestran el tooltip al tocar.

### Popover / menú `.popover`, `.menu-item`
Superficie raised, radio 10, borde 1 (claro), `--shadow-popover`, padding 6, ancho 220–340. Ítems 40 alto con ícono 18 muted; peligro en `--color-danger-text` (hover `--color-danger-soft`). Separador 1 px. Se posiciona debajo del ancla (arriba si no entra), se cierra con Esc, clic afuera o al elegir; devuelve el foco al ancla.

### Diálogo `.dialog`
Ancho 520 (`-sm` 420, `-lg` 640), radio 14, `--shadow-dialog`, scrim `--color-scrim`. Encabezado (título 22/600, descripción 14 muted, `x` 40), cuerpo con gap 20, pie con borde superior y botones a la derecha (Cancelar secundario + acción primaria; destructivo en `btn-danger`). Foco atrapado, Esc cierra, foco inicial en el primer campo. Confirmaciones de borrado nombran la cantidad: "¿Borrar 3 tareas?" / "Borrar 3 tareas".

### Panel lateral `.sheet`
Derecha, 440, superficie raised, borde izquierdo + sombra de popover, sin velo (se puede seguir viendo la lista). Encabezado 64 con acción de cierre; cuerpo con scroll; pie con acciones (destructiva a la izquierda, "Listo" a la derecha). Usos: detalle de materia, detalle de tarea.

### Toast `.toast`
Abajo al centro, fondo `--color-primary`, texto `--color-on-primary`, radio 10, alto ≥ 48, 6 s. Acción opcional "Deshacer" (`undo-2`) y cerrar (`x`). `role="status"`, `aria-live="polite"`. Uno a la vez.

### Drawer `.drawer`
296 × alto completo, superficie, `--shadow-drawer`, entra desde la izquierda en 240 ms. Contenido: lockup + cerrar; navegación (5 ítems de 44 alto, ícono 20; activo: fondo `--color-accent-soft`, texto `--color-accent-text`, `aria-current="page"`); pie con perfil (avatar + nombre + correo), Ajustes, selector de tema (Claro/Oscuro/Sistema) y de idioma (Español/English). Se cierra al elegir sección, al tocar el scrim o con Esc; el foco vuelve al botón de menú.

### Barra superior `.topbar`
64 alto, sticky, fondo `--color-bg` 92 % + blur 8 px; aparece un borde inferior al hacer scroll (`.is-scrolled`).

### Tarjeta de materia `.subject-card`
Superficie, borde 1, radio 10, franja superior 4 px `--s-vivid`. Contenido: nombre (17/600, hasta 2 líneas), botón `ellipsis` (menú: Editar · Archivar · Eliminar), docente (`user-round`), comisión · cuatrimestre (`calendar`), barra de progreso + % (tnum) + "2 de 5 tareas completadas" (sin tareas: 100 % y "Sin tareas todavía"), pie con documentos (`file-text`) y créditos. Toda la tarjeta abre el panel (botón superpuesto con `aria-label`), el menú queda por encima. Hover: borde strong. Archivada: fondo sunken, franja neutra y botón visible "Desarchivar". Tarjeta fantasma "Agregar materia": borde punteado 1.5.

### Fila de tarea `.task` y subtarea `.subtask`
- Fila ≥ 48 alto, superficie, borde 1, radio 6, separación 6. Orden: asa (`grip-vertical`, 32 × 44, opacidad .55 → 1 en hover/foco y siempre 1 en táctil) · checkbox · título (15, botón que abre el detalle) · chip de materia · etiqueta de arrastre ("de ayer" / "hace 3 días", `history`) · (derecha) bandera de prioridad · chip de fecha límite · contador de subtareas (`list-todo` + 2/4) · chevron.
- Bandera: alta `--color-priority-high` rellena, media `--color-priority-medium` rellena, baja `--color-priority-low` contorno, ninguna: no se muestra. Siempre con `aria-label`/tooltip "Prioridad alta…" (no solo color).
- Fecha límite `.due`: neutra ("Entrega en 7 días"), `is-soon` ≤ 3 días (warning), `is-today` "Vence hoy" (acento), `is-overdue` "Vencida" (danger + `circle-alert`). Completadas: DD/MM atenuado.
- Completada: fondo transparente, título tachado subtle, chip neutro; baja al final de su día con FLIP de 260 ms.
- Seleccionada (modo selección): fondo `--color-accent-soft`, borde acento; el asa y el checkbox se reemplazan por `.check-select`.
- Levantada (arrastre): `--shadow-drag`, rotación −0.6°, scale 1.01, superficie raised. Hueco de origen: borde punteado 1.5 sin contenido. Indicador de inserción: línea de 2 px acento con un círculo de 8 px a la izquierda. Destino: el grupo del día recibe fondo `--color-accent-soft` + anillo de 2 px acento; días no permitidos (para tareas con fecha límite) bajan a opacidad .45.
- Subtareas: indentadas 72 px, filas de 40 con separador punteado, checkbox 18; tachadas al completar.

### Encabezado de día y agregar rápido
Encabezado sticky (debajo de la barra): "Hoy"/"Mañana"/día de la semana (17/600) + DD/MM subtle + conteo "3/7" (tnum) + barra de 4 px (120 px de ancho). Agregar rápido: fila de 44 con `plus` y un input sin borde ("Agregar tarea"); al enfocarlo aparece la pista "Enter".

### Tarjeta de progreso de hoy `.today-card`
Número grande en serif (2 / 8), barra de 10 px, pendientes y porcentaje (22/600). Todo completado: se reemplaza por `.all-done` (fondo `--color-success-soft`, `circle-check-big` 32, "Todo listo por hoy").

### Bloque del horario `.block`
- **Clase**: fondo `--s-soft`, texto `--s-on-soft`, borde 1 px `--s-solid` al 45 %; título 13/600 (2 líneas), horario tnum, aula con `map-pin` (si entra). Hover: anillo `--s-solid`.
- **Actividad** (fuera de materias): fondo superficie, **borde punteado 1.5 px** `--s-solid`, texto neutro, `repeat` si se repite (punto de color si es única).
- **Omitida / sin clase (feriado)**: rayado diagonal `--color-stripe` sobre sunken, borde strong, título tachado, etiqueta "Omitida" o "Sin clase".
- Bloques superpuestos se reparten el ancho de la columna (algoritmo por clústeres de solapamiento, columnas mínimas). Altura mínima 20; por debajo de 40 px se muestra solo el título.
- Línea "ahora": 2 px acento, círculo de 10 px y etiqueta de hora sobre `--color-accent-fill`.
- Encabezado de día: día abreviado + DD/MM; hoy con DD/MM sobre `--color-accent-fill`; feriado con etiqueta `.holiday-tag` (`calendar-off` + nombre truncado) y columna con tinte `--color-holiday-bg`.
- Huecos de 30 min clicables (`+` en hover) que precargan día y hora.

### Celda y chip del calendario `.cal-cell`, `.ev`
- Celda ≥ 124 alto; número del día en botón de 28 (hoy: `--color-accent-fill`); `+` para agregar (visible en hover/foco, siempre visible al 60 % en táctil); fuera de mes: sunken y número desactivado; fin de semana: tinte suave.
- Hasta 3 chips + "+N más" (abre la lista del día en un popover).
- Chips (26 alto, 32 en táctil; radio 5; 12/500), el color viene de la materia; la categoría se codifica con **borde y opacidad**:

| Categoría | Borde | Relleno / texto |
|---|---|---|
| Parcial | sólido 1.5 px `--s-solid` | `--s-soft` / `--s-on-soft` |
| Final | **doble 3 px** `--s-solid` (`background-clip: padding-box` para que se vea la doble línea) | relleno pleno `--s-solid` / `--s-on-solid`, 600 |
| TP | **punteado** 1.5 px `--s-solid` | sin relleno / `--color-text` |
| Recuperatorio (tentativo) | fino 1 px `--s-solid` al 45 % | `--s-soft` al 45 % / `--color-text-muted` 400 |
| Recuperatorio (confirmado) | fino 1 px `--s-solid` | `--s-soft` / `--s-on-soft` 500 |
| Feriado | 1 px `--color-holiday-border` | `--color-holiday-bg` / `--color-holiday-text` (sin color de materia) |

- Recuperatorio: el chip es un toggle (`aria-pressed`) — un clic confirma, otro vuelve a tentativo; el lápiz (`pencil` 13, 22 × 22, 30 × 30 en táctil) está siempre visible dentro del chip y abre la edición.
- Leyenda con las cinco categorías arriba a la derecha (dibujadas en grafito para mostrar solo la forma).

### Timer
- Tarjeta con: píldora de fase (Foco: acento soft + `target`; Descanso: success soft + `coffee`; inactivo: sunken "Lista para empezar") + "Ciclo 2 de 4" con puntos (hechos: acento; actual: aro).
- Anillo de 380 px (500 en modo foco; 440 bajo 1280), trazo 8, pista sunken; progreso en acento (foco) o success (descanso); actualiza cada segundo con transición lineal de 1 s.
- Tiempo 96 px Geist Light tnum (modo foco 136); debajo "Termina a las 17:42" / "En pausa" / "4 ciclos de 25 + 5 min".
- Controles: Reiniciar (48 redondo), Play/Pausa (72 redondo, primario), Saltar descanso (48; deshabilitado fuera del descanso, con tooltip). Debajo: presets (segmentado), campos de Personalizado (foco, descanso, ciclos), materia (select, opcional), switch de sonido, "Terminar sesión".

---

## 7. Pantallas y estados

Rutas del prototipo (relativas a `prototype/index.html`). Todas existen en claro y oscuro (`?tema=oscuro`) y en inglés (`?lang=en`). Los estados `?demo=` se aplican al cargar.

| Pantalla / estado | Ruta |
|---|---|
| Landing | `#/` |
| Inicio · Materias | `#/inicio` |
| Inicio · Alta de materia | `#/inicio?demo=nueva-materia` |
| Inicio · Alta con error (nombre vacío) | `#/inicio?demo=error-materia` |
| Inicio · Edición de materia | `#/inicio?demo=editar-materia` |
| Inicio · Panel de materia con documentos | `#/inicio?demo=documentos` |
| Inicio · Selector de Drive (simulado) | `#/inicio?demo=drive` |
| Inicio · Archivadas | `#/inicio/archivadas` |
| Inicio · Primer uso (vacío) | `#/inicio?demo=vacio` |
| Inicio · Notas | `#/inicio/notas` |
| Inicio · Notas vacío | `#/inicio/notas?demo=vacio` |
| Horario · Semana (con feriado y clase omitida) | `#/horario` |
| Horario · Alta de clase (varios horarios) | `#/horario?demo=nueva-clase` |
| Horario · Alta de actividad con repetición | `#/horario?demo=nuevo-evento` |
| Horario · Excepción (popover "Omitir esta vez") | `#/horario?demo=excepcion` |
| Horario · Vacío | `#/horario?demo=vacio` |
| Tareas · General (próximos 7 días) | `#/tareas` |
| Tareas · Por materia | `#/tareas?demo=por-materia` |
| Tareas · Detalle con subtareas | `#/tareas?demo=detalle` |
| Tareas · Arrastrando | `#/tareas?demo=arrastrando` |
| Tareas · Modo selección | `#/tareas?demo=seleccion` |
| Tareas · Confirmación de borrado | `#/tareas?demo=borrar` |
| Tareas · Vacío | `#/tareas?demo=vacio` |
| Tareas · Todo completado | `#/tareas?demo=todo-hecho` |
| Calendario · Mes | `#/calendario` |
| Calendario · Alta (parcial) | `#/calendario?demo=nuevo-evento` |
| Calendario · Alta (TP con anticipación) | `#/calendario?demo=nuevo-tp` |
| Calendario · Lista del día ("+1 más") | `#/calendario?demo=dia` |
| Calendario · Recuperatorio tentativo y confirmado | `#/calendario?demo=recuperatorio` (noviembre: 03/11 tentativo, 05/11 confirmado; también 20/10 tentativo en octubre) |
| Calendario · Vacío | `#/calendario?demo=vacio` |
| Sesiones · Inactivo | `#/sesiones` |
| Sesiones · En foco | `#/sesiones?demo=foco` |
| Sesiones · En descanso | `#/sesiones?demo=descanso` |
| Sesiones · Modo foco | `#/sesiones?demo=modo-foco` |
| Sesiones · Resumen | `#/sesiones?demo=resumen` |
| Sesiones · Historial | `#/sesiones/historial` |
| Sesiones · Historial vacío | `#/sesiones/historial?demo=vacio` |
| Sesiones · Amigos (**solo diseño**) | `#/sesiones/amigos` |
| Sesiones · Agregar amigos (**solo diseño**) | `#/sesiones/amigos?demo=agregar-amigo` |
| Drawer abierto | `?drawer=1` sobre cualquier ruta, p. ej. `index.html#/inicio?drawer=1` |
| Ajustes | `index.html#/inicio?ajustes=1` |

> **Amigos es "solo diseño"**: se diseña completa con datos de ejemplo, pero **no se implementa en la primera versión** (requiere cuentas, vínculos y privacidad). La pestaña muestra la etiqueta "Solo diseño" y un aviso.

### Lógica de producto que el diseño asume

- **Progreso de materia** = tareas completadas / tareas de esa materia (todas las fechas). Sin tareas: 100 %.
- **Progreso del día** = completadas / visibles ese día. Día sin tareas: 100 %.
- **Tareas sin fecha** viven en un día (`date`). Si no se completan, aparecen en Hoy con "de ayer" o "hace N días". Al completarse quedan en el día en que se completaron.
- **Tareas con fecha límite** aparecen todos los días desde `due − N` hasta `due` (N = "aparece X días antes", por defecto el valor de Ajustes, 3). Vencidas sin completar: aparecen en Hoy con "Vencida". Etiquetas relativas a hoy: "Entrega en N días", "Entrega mañana", "Vence hoy", "Vencida".
- **Subtareas**: un nivel. La tarea solo se puede completar con todas sus subtareas completas. Si se desmarca una subtarea de una tarea completada, la tarea vuelve a pendiente.
- **Notas** 0–10 (acepta coma o punto, hasta 2 decimales). Promedio de materia = (cursada + final) / 2; si falta una, "—" y no cuenta. Simple = media de promedios; ponderado = Σ(promedio × créditos) / Σ créditos. *Cuatrimestre actual* = no archivadas; *General* = todas.
- **Calendario → Tareas**: parcial, final y TP crean una tarea con fecha límite (prioridad alta, N días antes). El recuperatorio crea su tarea al confirmarse y la quita al volver a tentativo (si no estaba completada). Editar la fecha actualiza la tarea; eliminarla borra la tarea pendiente.
- **Feriados**: nacionales de Argentina precargados (solo feriados, sin días no laborables ni puentes turísticos) + feriados manuales (categoría Feriado). En el Horario las clases de un feriado se ven "Sin clase" y se pueden restaurar; las actividades no se ven afectadas.
- Las clases del Horario no aparecen en el Calendario. No hay notificaciones.

---

## 8. Interacción

### Arrastrar y soltar (Tareas)
- Se arrastra **solo desde el asa** (`grip-vertical`), con Pointer Events (mouse, lápiz y touch; `touch-action: none` en el asa para no pelear con el scroll).
- Al presionar: la fila se "levanta" (clon fijo con `--shadow-drag`), queda el hueco punteado en el origen.
- Mientras se mueve: se calcula el grupo bajo el puntero y el índice por la mitad vertical de cada fila pendiente; se muestra la línea de inserción y se resalta el grupo destino. Auto-scroll de 12 px cuando el puntero está a < 90 px del borde superior o < 60 px del inferior.
- Tareas sin fecha: se reordenan y se pueden mover entre días (cambia su `date`, toast "Movida a mañana (14/10)"). Tareas con fecha límite: solo se reordenan dentro del día; los demás días se atenúan y no aceptan el soltado.
- Las completadas no se arrastran y siempre quedan al final.
- El orden es global (`order`); al soltar se reasignan los valores de orden existentes del día destino, sin alterar la posición relativa respecto de otros días.
- Teclado: con el asa enfocada, ↑/↓ reordenan; Re Pág/Av Pág mueven la tarea sin fecha al día anterior/siguiente (no antes de hoy). Se anuncia vía `aria-label` del asa.
- Al soltar y al completar, las filas se reacomodan con FLIP (260 ms, `--ease-standard`).

### Timer
- Estados: inactivo → foco → descanso → foco … → resumen. Al terminar el último foco se abre el **Resumen** (tiempo de foco, descansos, ciclos, tareas completadas durante la sesión) con "Guardar" y "Descartar". "Terminar sesión" abre el resumen en cualquier momento.
- Presets: 25/5 × 4 ciclos, 50/10 × 3, 90/20 × 2, Personalizado (foco 5–180, descanso 1–60, ciclos 1–12; por defecto 40/8 × 3). Durante una sesión los presets se bloquean (se cambian al reiniciar).
- "Saltar descanso" solo está activo en descanso. Sonido: dos tonos cortos (660 y 880 Hz) al terminar cada fase si el switch está activo.
- El título de la pestaña muestra "18:24 · Foco · Tilde" mientras corre.
- Implementación real: calcular el tiempo restante a partir de un `endsAt` (timestamp), no restando 1 por tick, para no derivar si la pestaña queda en segundo plano.
- **Modo foco**: pantalla completa (Fullscreen API si está disponible + capa fija) con solo el timer y las tareas de hoy; "Salir del modo foco" visible arriba a la derecha y Esc.
- Las tareas de hoy se pueden tildar durante la sesión; si hay materia elegida, un switch filtra por ella.

### Transiciones
Drawer: slide 240 ms + scrim fade 180 ms. Diálogo/popover: `pop-in` 180/120 ms. Panel lateral: slide desde la derecha 260 ms. Toast: sube 8 px + fade 180 ms. Completar tarea: check scale .9 → 1, fila baja con FLIP. Barras de progreso: ancho 260 ms. Cambio de tema: inmediato (sin transición global, para no animar todo).

### Touch (tablets en modo escritorio)
- Targets ≥ 40 × 40 en todo control; los que visualmente son más chicos (chips del calendario, ayuda de promedios) extienden su área con pseudo-elementos o crecen con `pointer: coarse`.
- Nada depende del hover: el menú `ellipsis` de las tarjetas está siempre visible; el asa de arrastre se ve siempre en táctil; el lápiz del recuperatorio está siempre en el chip; el `+` de las celdas del calendario se ve al 60 %; la ayuda de promedios abre un popover al tocar; los bloques del horario y los chips del calendario abren un popover con todas sus acciones (Omitir/Restaurar, Editar, Eliminar).
- Acciones destructivas siempre con confirmación y "Deshacer".

---

## 9. i18n y accesibilidad

### Idiomas
- Español (fuente) e inglés. Todos los textos en `prototype/js/i18n.js`, con claves compartidas y plurales `_one`/`_other`.
- Tono: cercano y claro, **sin voseo ni regionalismos marcados**; se evita conjugar en segunda persona (se usan formas impersonales o "tu/tus"). Botones en infinitivo: "Agregar materia", "Guardar", "Omitir esta vez".
- Términos de la facultad: Comisión → *Section*, Cursada → *Coursework*, Parcial → *Midterm*, TP → *Assignment*, Recuperatorio → *Make-up exam*, Cuatrimestre → *Term*. Inglés en variante US.
- El inglés ocupa ~20–30 % más: todos los layouts usan flex con `wrap`, `min-width: 0`, elipsis en nombres de materia, chips con forma corta y tablas con scroll horizontal propio. Verificado a 1024, 1366 y 1440 px en ambos idiomas sin scroll horizontal.
- Convenciones: semana desde el lunes, hora 24 h, fechas DD/MM (con año: DD/MM · AAAA). Números con coma decimal en español (8,5) y punto en inglés (8.5).
- **Fechas y horas en formularios**: los `<input type="date|time">` nativos muestran el formato del sistema operativo (en un navegador en inglés de EE. UU. aparecen MM/DD y 12 h). En la app real usar un selector propio que siempre muestre DD/MM y 24 h.
- Nombres de feriados en ambos idiomas.

### Accesibilidad
- Contraste: ver tabla 3.1 y 3.2 (texto ≥ 4.5:1, elementos de interfaz ≥ 3:1, en ambos temas y sobre cada color de materia).
- Foco visible en todo: anillo de 2 px `--color-focus-ring` con separación (`--shadow-focus`).
- Semántica: botones reales, links para navegación, `role="checkbox|switch|radio|tab|menu|grid|timer|progressbar"` con sus estados `aria-checked|pressed|selected|expanded|current|disabled|invalid`.
- Diálogos: `aria-modal`, foco atrapado, Esc cierra, foco devuelto al disparador. Drawer igual.
- Color nunca solo: prioridad con forma (relleno/contorno) + nombre; categorías del calendario con tipo de borde; estados de tarea con tachado; materia con nombre en el chip; avisos con texto e ícono.
- `aria-live="polite"` en toasts, etiqueta de semana/mes y fase del timer. El timer no anuncia cada segundo (el tiempo es `aria-hidden`; el contenedor `role="timer"` tiene etiqueta).
- Iconos `aria-hidden`; botones solo-ícono con `aria-label` (y tooltip).
- Enlace "Saltar al contenido". `lang` del documento según el idioma elegido.
- `prefers-reduced-motion` respetado.

---

## 10. Decisiones tomadas

1. **Nombre "Tilde"** y logo propio (tilde que termina en check). Verificar disponibilidad de marca y dominio antes del lanzamiento público.
2. **Acento bermellón** (`#E44919` / `#FF754A`): cálido como Claude, saturado, y guiño al Pomodoro. Como blanco sobre `#E44919` da 3,99:1, el acento se usa para marcas sin texto (≥3:1) y existe `--color-accent-fill` (`#BD3403`) para rellenos con texto.
3. **Botón primario en tinta**, no en acento: el acento queda reservado para "hoy/ahora/foco/marcado" y no compite con los colores de materia.
4. **Paleta de 12 colores** en OKLCH con luminosidad fija por rol; se omitió un rojo puro para no confundirse con el acento ni con "vencida". Incluye un marrón (Cacao) y un neutro (Grafito).
5. **Tipografía**: Instrument Serif + Geist. Roboto solo dentro del botón de Google por su guía de marca.
6. **Barra superior** con el título de la sección al lado del botón de menú (siempre visible al hacer scroll) en lugar de un encabezado que se va con el contenido.
7. **Tareas en ancho angosto** (860 px) para que la fila sea legible; Horario y Calendario a ancho completo.
8. **Panel lateral sin velo** para materia y tarea (se sigue viendo la lista); los formularios de alta van en diálogo.
9. **Notas editables en la celda** con fondo sutil para que se note que son campos; error "Entre 0 y 10" dentro de la celda.
10. **Recuperatorio tentativo**: la "opacidad 40–50 %" se aplica al borde y al relleno (45 %), no al texto, para que siga cumpliendo 4.5:1. El texto pasa a gris y peso regular.
11. **Final** con borde doble 3 px y relleno pleno; **TP** punteado sin relleno; **parcial** sólido con relleno suave.
12. **Actividades del Horario** con borde punteado y fondo neutro (las clases van con relleno de color); las **omitidas** con rayado diagonal + tachado.
13. Las **actividades no se marcan como "sin clase"** en feriados (solo las clases); se pueden omitir a mano.
14. El **progreso de materia** cuenta todas sus tareas (cualquier fecha), incluidas las creadas desde el Calendario.
15. **Calendario → Tareas**: parcial, final y TP crean tarea con prioridad alta; el formulario muestra "Aparece en tu lista X días antes" para los tres (la consigna lo pedía para TP; se extendió porque también se estudia para parciales y finales). El recuperatorio crea su tarea recién al confirmarse.
16. **Título por defecto** de una fecha: "Categoría · Materia" con nombre corto (p. ej. "Parcial · Física II", "Parcial · POO").
17. **Desmarcar una subtarea** de una tarea completada la devuelve a pendiente.
18. **Completada una tarea sin fecha arrastrada de días anteriores**, queda registrada en el día en que se completó.
19. **Ordenar por prioridad** es una acción puntual (reordena una vez), no un modo de orden permanente, para no pelear con el arrastre manual.
20. **"Borrar todas"** borra las tareas visibles con el filtro activo (modo, materia y rango), con confirmación que dice la cantidad y "Deshacer".
21. **Selección** reemplaza el checkbox por un círculo de selección y oculta el asa (no se arrastra en modo selección); Esc sale del modo.
22. **Presets** con ciclos por defecto: 25/5 × 4, 50/10 × 3, 90/20 × 2; Personalizado arranca en 40/8 × 3. Sin descanso largo (la consigna no lo pide).
23. **Historial**: gráfico de barras de foco por semana (8 semanas, la actual en acento, valor directo solo en la actual y tooltip en el resto) + barras horizontales por materia + tabla.
24. **Drive**: "Agregar desde Drive" abre el Google Picker (simulado en el prototipo); "Pegar link" detecta el tipo por la URL (`document` → Docs, `spreadsheets` → Hojas, `presentation` → Presentaciones, `drive.google.com/file` → archivo, resto → link). PDF usa `file` porque Lucide no tiene un ícono de PDF.
25. **Ícono de la sección Horario**: `calendar-clock` (Lucide no tiene "horario semanal"); Calendario usa `calendar-days`.
26. **Landing**: capturas = las propias pantallas del prototipo renderizadas a 1440 px y escaladas, en el tema activo; incluye un botón de tema en la barra (además del selector de idioma) porque la landing también tiene modo oscuro.
27. **Fecha de hoy fija en el prototipo** (13/10/2026, la semana del feriado del 12/10) para mostrar todos los estados; se cambia con `?hoy=`.
28. **Fechas/horas**: los inputs nativos del prototipo dependen del idioma del sistema; la app real debe usar selectores propios en DD/MM y 24 h.
29. **Inglés en variante US** ("color", "Fall"), términos académicos adaptados (ver §9).
30. **Datos de ejemplo**: 6 materias del 2C 2026 (5 de una carrera de sistemas + Inglés técnico) y 2 archivadas del 1C 2026, para que los promedios tengan valores reales.
31. Avatares siempre con iniciales en la sección Amigos; en el drawer se usaría la foto de Google si existe.
