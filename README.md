# Tilde

Webapp para estudiantes universitarios. Se cargan las **materias** y todo lo demás gira alrededor de ellas:
horario, tareas, calendario, notas y sesiones de estudio. El color de cada materia la identifica en toda la app.

- **Inicio** — materias (con documentos de Drive y progreso de sus tareas), notas con promedios y archivadas.
- **Horario** — grilla semanal de 07:00 a 23:00 con clases, actividades recurrentes, excepciones y feriados, a
  cualquier minuto (18:50–21:33). Se exporta como imagen para usar de fondo de pantalla: con la medida de la pantalla
  del dispositivo o en 16:9, 16:10, 9:16 o 9:19,5; trece temas completos (paleta, tipografía, esquinas y fondo), vista
  grande y el horario escrito en cada bloque si hace falta.
- **Tareas** — lista por día con subtareas, prioridad, arrastre de pendientes, entregas con anticipación y drag & drop.
  Se ven hoy, los próximos 7 o 30 días, todas, hasta una fecha o un día puntual, con varios criterios de orden.
  Se pueden importar desde un JSON (por ejemplo, un plan armado por una IA).
- **Calendario** — vista mensual con parciales, finales, TP (que generan su tarea), recuperatorios y feriados nacionales.
  Importa fechas de un archivo `.ics` o de un calendario vinculado (Google Calendar, Outlook, iCloud).
- **Sesiones de estudio** — timer con presets, modo foco, modo examen, timer flotante, tareas de hoy (con sus
  subtareas), historial editable y un "Wrapped" de la semana, el mes o el cuatrimestre.

Las materias se ordenan arrastrándolas en Inicio. Cada materia (y cada actividad del horario) puede llevar un ícono además de su color
(más de 250, agrupados por área y con buscador). El color de acento de la
app se elige en Ajustes entre los de la paleta.

Mobile first: se usa desde un teléfono de 320 px hasta el escritorio, se puede instalar y sigue funcionando sin conexión
(los cambios se guardan en el dispositivo y se suben al volver). En español e inglés, con tema claro y oscuro.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind 4 · componentes estilo shadcn/ui sobre Radix ·
Supabase (Auth con Google, Postgres, RLS) · TanStack Query · Zod · next-intl · @dnd-kit · lucide-react · Vitest · Playwright.

Todo corre en planes gratuitos:

> **Vercel Hobby es solo para uso personal y no comercial.** Si el proyecto se monetiza hay que migrar a un plan pago
> (o a otro hosting).
>
> **Supabase Free pausa el proyecto tras una semana sin actividad.** Se reactiva desde el panel ("Restore project")
> y los datos no se pierden.

## Puesta en marcha

Los pasos con credenciales (proyecto de Supabase, cliente OAuth de Google, API key del Picker) están en
**[docs/SETUP.md](docs/SETUP.md)**, con las URL de redirección, los scopes y cada variable de entorno.

```bash
npm install
cp .env.example .env.local   # completar según docs/SETUP.md
npm run dev                  # http://localhost:3000
```

Sin Supabase configurado la landing funciona igual, pero no se puede iniciar sesión.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` · `npm run start` | Build de producción y servidor |
| `npm run typecheck` | Tipos (`next typegen` + `tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest: lógica de dominio, RLS y paridad de mensajes |
| `npm run test:e2e` | Playwright: flujos principales, layout de 320 a 1440 px, teléfono, touch y sin conexión |
| `npm run check` | typecheck + lint + test + build |
| `npm run db:start` · `db:stop` · `db:reset` | Supabase local (Docker o Podman) |
| `npm run db:types` | Regenera los tipos de la base |
| `npm run seed:demo` | Crea la cuenta demo con datos de ejemplo |
| `npm run screenshots` | Captura cada sección (claro y oscuro, computadora y teléfono) en `public/landing/` |
| `npm run og-image` | Arma la imagen para compartir el link (`public/og/`) a partir de la captura de Materias |

## Tests

- **Unitarios (Vitest).** Toda la lógica de negocio vive en funciones puras en `src/lib/domain/` y se testea ahí:
  `tasksForDay` (tarea diaria, arrastre, ventana, vencida, completada), progreso por unidades, promedios,
  `occurrencesForWeek` (recurrencias, excepciones, feriados, superposiciones), timer por timestamps, feriados,
  el lector de `.ics` (zonas horarias y repeticiones), la importación de tareas y de fechas, la geometría del
  fondo exportado y la detección del gesto hacia el borde.
- **RLS (`tests/rls.test.ts`).** Dos usuarios reales contra el Supabase local: uno no puede leer, modificar, borrar ni
  colgar filas de los datos del otro. Si el Supabase local no está levantado, el test se saltea con un aviso.
- **E2E (Playwright).** Corren contra la app y el Supabase local. Como el login de Google no se puede automatizar, la
  sesión se crea con el service role (`scripts/lib/test-session.ts`), que se niega a correr en producción o contra un
  Supabase que no sea local.

```bash
# Con Podman (con Docker no hace falta):
systemctl --user start podman.socket
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock

npm run db:start
npx supabase status -o env   # copiar API_URL, ANON_KEY y SERVICE_ROLE_KEY a .env.local
npm run test
npm run test:e2e             # levanta la app si no está corriendo
```

## Landing y capturas

Las capturas de la landing son reales. Con el Supabase local y la app corriendo:

```bash
npm run seed:demo      # recrea la cuenta demo (demo@tilde.test) con materias, horario, tareas, fechas y sesiones
npm run screenshots    # public/landing/<sección>-<light|dark>.png y <sección>-<light|dark>-mobile.png
npm run og-image       # public/og/<es|en>.png, la imagen al compartir el link (usa la captura de Materias)
```

`seed:demo` borra y vuelve a crear la cuenta demo cada vez. El "hoy" de la demo es fijo (martes 18/08/2026) para
que las capturas salgan siempre iguales; se cambia con `DEMO_TODAY=AAAA-MM-DD` en ambos comandos.

## Estructura

```
design/                 diseño de referencia: DESIGN.md, assets y prototipo
docs/                   SETUP.md (credenciales), DECISIONS.md (decisiones y conflictos), PROMPT.md (consigna)
data/                   respaldo de feriados nacionales (ver data/README.md)
messages/               textos en español e inglés
supabase/migrations/    esquema, RLS y funciones
scripts/                seed de la demo, screenshots y sesión de prueba
e2e/ · tests/           Playwright · Vitest (RLS y mensajes)
src/app/[locale]/       rutas: landing (/ y /en) y app (/app, /app/schedule, /app/todo, /app/calendar, /app/study)
src/lib/domain/         reglas de negocio puras, con sus tests al lado
src/lib/queries/        datos: TanStack Query + Supabase, con updates optimistas
src/components/         ui/ (primitivas) y una carpeta por sección
src/styles/             tokens del diseño, theme de Tailwind y un archivo de estilos por área (mobile first)
src/lib/offline/        modo sin conexión: cola de cambios y copia local de los datos
public/sw.js            service worker: las pantallas de la app abren sin red
```

Las convenciones y reglas duras del proyecto están en [CLAUDE.md](CLAUDE.md); las decisiones tomadas (incluidos los
conflictos entre el diseño y la consigna), en [docs/DECISIONS.md](docs/DECISIONS.md).

## Pendientes conocidos

- **Google Picker ("Agregar desde Drive").** Implementado, pero sin probar de punta a punta: necesita las credenciales
  de Google. Qué verificar al cargarlas está en [docs/SETUP.md](docs/SETUP.md#3-google-picker-agregar-documentos-desde-drive).
  Mientras tanto "Pegar link" cubre el caso.
- **Feriados de 2027.** El calendario oficial todavía no está publicado; los trasladables se calculan con la Ley 27.399.
  Hay que volver a verificarlos (ver `data/README.md`).
- **Calendario vinculado.** La descarga por el servidor está probada contra calendarios públicos reales de Google
  Calendar; falta probarla con la dirección secreta de un calendario personal (misma forma de dirección y de archivo).
- **Sin probar en un teléfono de verdad.** El diseño mobile y el modo sin conexión están verificados con tests en
  Chromium emulando un teléfono (320–390 px, táctil), no en iOS Safari ni en un Android real.
- **Fuera de alcance:** amigos y lo social, notificaciones, kanban, notas parciales
  múltiples por materia, días no laborables y puentes, exportación de datos y escribir en Google Calendar (la
  vinculación es de una sola vía: Tilde lee).
