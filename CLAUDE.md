@AGENTS.md

# Tilde

Webapp para estudiantes universitarios: se cargan materias y todo lo demás (horario, tareas, calendario,
notas, sesiones de estudio) gira alrededor de ellas. La consigna original está en `docs/PROMPT.md`; el
diseño, en `design/DESIGN.md` y `design/prototype/`. **En lo visual manda el diseño; en el comportamiento,
la consigna.** Los conflictos y las decisiones propias se anotan en `docs/DECISIONS.md`, que también registra los
cambios pedidos después de la entrega (desde el punto 22): esos mandan sobre el diseño y la consigna.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript estricto. `src/proxy.ts` es el antiguo middleware.
- Tailwind 4 + componentes estilo shadcn/ui (`src/components/ui`, sobre Radix) con los tokens del diseño.
- Supabase: Auth (Google), Postgres y RLS en todas las tablas. Migraciones en `supabase/migrations`.
- TanStack Query (updates optimistas) + Zod. `next-intl` (es por defecto, en). `@dnd-kit`. `lucide-react`.
- Vitest (lógica pura, RLS, mensajes) y Playwright (e2e y screenshots). Hosting: Vercel Hobby.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:3000` |
| `npm run typecheck` · `npm run lint` · `npm run test` · `npm run build` | Las cuatro verificaciones. `npm run check` corre todas |
| `npm run test:e2e` | Playwright contra la app y el Supabase local |
| `npm run db:start` · `db:stop` · `db:reset` | Supabase local (Docker o Podman). `db:reset` reaplica las migraciones |
| `npm run db:types` | Regenera `src/lib/supabase/database.types.ts` desde la base local |
| `npm run seed:demo` · `npm run screenshots` | Cuenta demo y capturas de la landing (`public/landing/`) |

Con Podman: `systemctl --user start podman.socket` y `export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock`.

## Estructura

- `src/app/[locale]/` — rutas. `/` landing (estática, indexable en `/` y `/en`); `/app`, `/app/schedule`,
  `/app/todo`, `/app/calendar`, `/app/study`. Fuera del segmento de idioma: `/auth/callback`, `/api/*`
  (`holidays`, `keepalive`, `ical`: descarga de calendarios vinculados).
- `src/lib/domain/` — **toda la lógica de negocio, en funciones puras** con tests al lado (`*.test.ts`).
- `src/lib/queries/` — hooks de datos (TanStack Query + Supabase del navegador, pasan por RLS).
- `src/components/ui/` — primitivas; `src/components/<sección>/` — pantallas.
- `src/styles/` — `tokens.css` (tokens del diseño, claro/oscuro), `theme.css` (los registra en Tailwind),
  `tilde.css` (componentes portados del prototipo), `extra.css` (lo que el prototipo no tenía).
- `messages/es.json`, `messages/en.json` — todos los textos.

## Reglas duras

1. **Lógica en `src/lib/domain/`**, pura y testeada con Vitest (progreso, visibilidad de tareas,
   recurrencias, promedios, timer). La UI solo la consume: nada de reglas de negocio en componentes.
2. **RLS en todas las tablas.** Cada fila lleva `user_id` y las políticas solo permiten `auth.uid() = user_id`.
   Las FK entre tablas son compuestas `(id, user_id)`. Toda tabla nueva entra al bucle de políticas de la migración
   y a `tests/rls.test.ts`.
3. **Íconos: solo `lucide-react`.** Sin emojis, sin otras librerías, sin SVG a mano. Excepciones: la "G" de
   Google (`google-button.tsx`) y el logo (`logo.tsx`). Los gráficos (barras del historial, anillo del timer) no son íconos.
   Los íconos que se pueden elegir para una materia o actividad son una lista cerrada: `src/lib/domain/icons.ts`
   (clave) + `src/components/subject-icon.tsx` (componente) + un mensaje `icon_<clave>` en cada idioma.
4. **Ningún texto hardcodeado** en componentes: todo en `messages/*.json`, en ambos idiomas (lo verifica
   `tests/messages.test.ts`). Tono: cercano, sin voseo, botones en infinitivo. Inglés en variante US.
5. **Fechas:** los días son `YYYY-MM-DD` (`date`) y las horas `HH:MM` (`time`), sin zona horaria. Nunca `new Date()`
   para decidir "hoy": usar `useToday()` (zona del perfil, por defecto `America/Argentina/Buenos_Aires`).
   Semana desde el lunes (1 = lunes … 7 = domingo), formato 24 h, fechas visibles como DD/MM.
6. **Colores:** solo tokens (`var(--color-*)`, utilidades de Tailwind generadas de ellos). El color de una materia
   es una clave de la paleta (`color_key`), nunca un hex: se aplica con la clase `subj-<clave>` y las variables `--s-*`.
   Única excepción: el color de fondo que el usuario elige al exportar el horario (es contenido suyo, no interfaz).
7. **Pantallas:** desktop y tablets en modo escritorio (1024–1440 px, con touch). Sin layouts mobile. Targets ≥ 40 px,
   nada que dependa solo de hover, foco visible, todo operable con teclado, `prefers-reduced-motion`.
8. **Secretos:** nunca en el repo. `.env.local` está ignorado; `.env.example` documenta las variables.
   `SUPABASE_SERVICE_ROLE_KEY` solo en scripts y tests locales (`scripts/lib/test-session.ts`), nunca en producción.
9. **Fuera de alcance:** amigos y lo social, mobile, notificaciones, kanban, offline, notas parciales múltiples,
   días no laborables y puentes, exportación de datos y escribir en calendarios externos. Sí hay: importar tareas
   (JSON), importar fechas (.ics o calendario vinculado, siempre con vista previa) y exportar el horario como imagen.
10. **Servidor:** `/api/ical` es lo único que descarga una dirección dada por el usuario. Solo acepta los servicios
    de `normalizeFeedUrl` (`src/lib/domain/calendar-import.ts`) y exige sesión; no ampliar esa lista a "cualquier URL".

## Convenciones

- Las clases de `tilde.css` no deben llamarse igual que una utilidad de Tailwind (la utilidad gana: por eso el
  bloque del Horario es `.sched-block` y no `.block`).
- Componentes cliente con `"use client"`; las páginas (`page.tsx`) son de servidor y solo arman metadata + vista.
- Mutaciones: `useOptimistic` de `src/lib/queries/table.ts` (aplica en caché, revierte si falla).
- Los ids se generan en el cliente (`crypto.randomUUID()`), así el optimista y la base coinciden.
- Confirmaciones con `confirm()` y avisos con `toast()` (`src/components/ui`). Borrados de tareas: toast "Deshacer" de 8 s.
- Al cerrar una fase: `npm run check` en verde y un commit.
