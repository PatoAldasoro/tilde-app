# Prompt para Claude Code

> Ponelo en la raíz del repo, junto a la carpeta `design/` que entrega la IA de diseño, y arrancá Claude Code en modo plan.

## Objetivo

Construir la webapp descrita acá: una app para estudiantes universitarios donde se cargan materias y todo lo demás (horario, tareas, calendario, notas, sesiones de estudio) gira alrededor de ellas. Tiene que funcionar de punta a punta y no costar nada.

## Cómo trabajar

1. Leé `design/DESIGN.md` y mirá el prototipo en `design/prototype/` antes de escribir código. En lo visual manda el diseño; en el comportamiento manda este documento. Si encontrás un conflicto, anotalo en `docs/DECISIONS.md` y seguí.
2. Creá un `CLAUDE.md` con el stack, los comandos, las convenciones y las reglas duras de este documento.
3. Planificá antes de programar y trabajá por fases (más abajo). Al cerrar cada fase corré typecheck, lint, tests y build, y que estén en verde antes de pasar a la siguiente. Un commit por fase con mensaje descriptivo.
4. No me hagas preguntas salvo que estés bloqueado. Lo único que no podés hacer vos son los pasos con credenciales (proyecto de Supabase, cliente OAuth de Google, API key del Picker): escribí `docs/SETUP.md` con el paso a paso exacto (URLs de redirección, scopes, variables de entorno) y seguí con todo lo demás.
5. Nunca commitees secretos. Dejá un `.env.example`.
6. Poné la lógica de negocio en funciones puras bajo `src/lib/domain/` (progreso, visibilidad de tareas, recurrencias, promedios, timer) y testeala con Vitest. La UI solo las consume.

## Stack (todo gratis)

- **Next.js** (App Router) con **TypeScript estricto**, **Tailwind** y **shadcn/ui**, en sus versiones estables actuales. Los tokens del diseño pasan a variables CSS y al theme de Tailwind; el tema claro/oscuro se cambia con una clase o `data-theme`. Personalizá shadcn con esos tokens.
- **Íconos: solo `lucide-react`.** Nada de emojis, otras librerías de íconos ni SVG dibujados a mano. Excepciones: la "G" oficial de Google en el botón de login y el logo de la app.
- **Supabase**: Auth con proveedor Google, Postgres y **RLS en todas las tablas** (cada fila lleva `user_id` y las políticas solo permiten `auth.uid() = user_id`). Migraciones en `supabase/migrations`.
- **Hosting**: Vercel, plan Hobby. Hobby es solo para uso personal y no comercial; si el proyecto se monetiza hay que migrar. Dejalo anotado en el README. Anotá también que en el plan gratuito de Supabase el proyecto se pausa tras una semana sin actividad y se reactiva desde el panel.
- **Drag & drop**: `@dnd-kit` con sensores de puntero, touch y teclado.
- **i18n**: `next-intl`, español por defecto e inglés. El idioma se guarda en el perfil y en una cookie. La landing tiene que ser indexable en ambos idiomas. Ningún texto hardcodeado en los componentes.
- **Datos**: TanStack Query con updates optimistas y validación con Zod.
- **Fechas**: los días se guardan como `date` (YYYY-MM-DD) y las horas como `time`, sin zona horaria, para evitar corrimientos. "Hoy" se calcula en la zona del usuario (por defecto `America/Argentina/Buenos_Aires`). Semana desde el lunes, formato 24 h.
- **Tests**: Vitest para la lógica pura y Playwright para los flujos principales y los screenshots.
- **Pantallas**: desktop y tablets de 10 a 13 pulgadas en modo desktop (1024 a 1366 px, con touch). No hagas layouts mobile. Targets táctiles de 40 px o más y nada que dependa solo de hover.
- **Accesibilidad**: foco visible, navegación por teclado (incluido el drag & drop), contraste AA, `prefers-reduced-motion`.

## Estructura de la app

- `/` es la landing pública. "Continuar con Google" inicia sesión y lleva a `/app`; si ya hay sesión, la landing redirige a la app.
- Secciones de la app: Inicio (`/app`), Horario (`/app/schedule`), Tareas (`/app/todo`), Calendario (`/app/calendar`) y Sesiones de estudio (`/app/study`).
- "Notas" es una pestaña dentro de Inicio, junto a "Materias". Hay también un botón "Archivadas".
- Un botón de menú hamburguesa fijo arriba a la izquierda abre un drawer que se superpone al contenido y se oculta. Contiene las secciones, el perfil, Ajustes, el selector de tema (claro, oscuro, sistema) y el selector de idioma.
- Ajustes: idioma, tema, días visibles del Horario, días por defecto con que las entregas aparecen antes en Tareas y cerrar sesión.
- Etiquetas de las secciones (ES / EN): Inicio / Home, Horario / Schedule, Tareas / To-do, Calendario / Calendar, Sesiones de estudio / Study sessions.

## Reglas de negocio

### Materias
- Campos: nombre (obligatorio), comisión, docente, cuatrimestre (año y período, por ejemplo 2C 2026), créditos (entero, opcional), color (clave de la paleta del diseño, no un hex), nota de cursada, nota del final y archivada.
- Menú de la materia: editar, archivar y eliminar (con confirmación; borra en cascada sus datos).
- Archivar saca la materia de Inicio, Horario, Tareas y del selector de Sesiones de estudio. Sus datos se conservan, sigue contando en Notas y se ve en "Archivadas", donde se puede desarchivar. El Calendario sigue mostrando sus eventos como historial.
- El color de la materia se usa en todas las secciones.

### Documentos de la materia
- Se guardan como referencias (nombre, URL, id de Drive, tipo), nunca el archivo. Se abren en una pestaña nueva.
- **Agregar desde Drive**: Google Picker con el scope `https://www.googleapis.com/auth/drive.file` únicamente (evita la verificación pesada de Google si después se lanza público). El token para el Picker se pide aparte del login, con Google Identity Services (`google.accounts.oauth2.initTokenClient`); no dependas del `provider_token` de Supabase, que no se renueva.
- **Pegar link**: validar que sea un link de Google Drive o Docs y guardarlo con nombre editable.
- Implementá primero "Pegar link" y después el Picker. Si el Picker se complica, dejalo documentado como pendiente en `docs/SETUP.md`.

### Progreso
- Unidades: una tarea sin subtareas cuenta como 1; una tarea con subtareas cuenta por sus subtareas (la principal no se suma aparte). Porcentaje = unidades completadas / unidades totales.
- Sin unidades, el progreso es **100 %**.
- Progreso de la materia: todas las tareas de esa materia, de cualquier fecha.
- Progreso del día: las tareas visibles ese día (incluye las arrastradas y las de fecha límite en ventana).

### Tareas
- La materia es opcional. Prioridad: ninguna, baja, media, alta. Subtareas de un solo nivel.
- **Tareas diarias** (sin `due_date`): viven en `planned_date` (por defecto el día en que se crean). Si al terminar el día no se completaron, se **arrastran**: se muestran en hoy con la etiqueta "de ayer" o "hace N días" hasta completarse. El arrastre solo afecta a la vista de hoy; no reescribe fechas pasadas.
- **Tareas con fecha límite** (`due_date` y `lead_days`, "aparecer X días antes"): aparecen todos los días desde `due_date − lead_days` hasta `due_date`, y después de la fecha límite como "Vencida" si siguen pendientes. Dejan de aparecer los días posteriores al que se completaron (ese día se ven en gris). Etiquetas: "Entrega en N días", "Vence hoy", "Vencida".
- Escribí `tasksForDay(tasks, day, today)` como función pura, con tests para: tarea diaria, arrastre, ventana, vencida y completada.
- **Completar**: una tarea con subtareas solo se puede completar cuando todas están completas (checkbox deshabilitado con tooltip mientras haya pendientes). Al completar la última subtarea se completa sola, y al desmarcar cualquier subtarea se desmarca la principal.
- **Completadas**: se ven en gris y bajan al fondo de su día.
- **Orden**: un `sort_order` por tarea. Reordenar dentro de un día lo actualiza (índices fraccionarios o reindexado). Hay un botón "Ordenar por prioridad".
- **Drag & drop**: reordenar dentro de un día y mover entre días. Mover entre días solo aplica a tareas diarias (actualiza `planned_date`); las de fecha límite solo se reordenan dentro de un día.
- **Vistas y filtros**: "General" o "Por materia", filtro por fecha (hoy, próximos 7 días, fecha puntual) y barra de progreso por día, con la de hoy destacada.
- **Borrado**: modo "Seleccionar" con barra "Borrar (N)" y "Borrar todas" (respeta el filtro activo). Ambos piden confirmación con la cantidad y dan un toast "Deshacer" de unos 8 segundos.

### Calendario
- Solo vista mensual, lunes primero. Hasta 3 chips por día y "+N más".
- Categorías (lista cerrada): `parcial`, `final`, `tp`, `recuperatorio`, `feriado`. El color viene de la materia y cada categoría se diferencia por borde y opacidad según el diseño. Los feriados son grises y no tienen materia.
- **Recuperatorio**: `confirmed = false` se muestra atenuado; un clic alterna `confirmed` y lo pasa a color pleno (o de vuelta a atenuado). Edición desde un ícono de lápiz visible, no solo en hover.
- **TP genera tarea**: al crear un TP se elige `lead_days` (por defecto, el valor de Ajustes) y se crea una tarea con título "TP · <título>", la misma materia, `due_date` = fecha del evento, `lead_days` y `source_calendar_event_id`. Editar el evento (fecha, materia, título, `lead_days`) actualiza la tarea vinculada. Completar la tarea no toca el evento. Borrar el evento borra su tarea vinculada. Parcial, final y recuperatorio no generan tareas.
- **Feriados nacionales de Argentina**: fuente `https://api.argentinadatos.com/v1/feriados/{año}`, que devuelve `fecha`, `nombre` y `tipo` (valores vistos: `inamovible`, `trasladable` y `puente`). **Descartá `puente`**: son días no laborables, no feriados. Consultala desde el servidor con caché (año visible y vecinos) y mantené un JSON de respaldo en el repo (`data/feriados-2026.json` y `data/feriados-2027.json`) por si la API falla. Al generar el respaldo, contrastá contra el calendario oficial en argentina.gob.ar. En particular, la API de 2026 trae "Visita del papa León XIV" (2026-11-09) como `inamovible`: verificá esa entrada antes de incluirla.
- Los feriados manuales son eventos con categoría `feriado` guardados por usuario. Los nacionales no se guardan en la base.
- Las clases del Horario no aparecen en el Calendario. Sin notificaciones.

### Horario
- Grilla semanal de 07:00 a 23:00 en pasos de 30 minutos. Lunes a viernes por defecto; el usuario agrega o quita días, incluyendo sábado y domingo (se guarda en el perfil).
- Se ve la semana actual con fechas reales y flechas para navegar. Indicador de la hora actual en hoy.
- **Clases**: una materia tiene varios bloques semanales; cada bloque lleva día, inicio, fin y aula (pueden ser aulas distintas). Se repiten todas las semanas mientras la materia no esté archivada. Color de la materia.
- **Eventos fuera de las materias**: título, color de la paleta, hora de inicio y fin, y repetición: ninguna (en una fecha), todos los días, o días específicos de la semana, con fecha de fin opcional.
- Escribí `occurrencesForWeek(weekStart, blocks, events, exceptions, holidays)` como función pura, con tests.
- **Excepciones** (`schedule_exceptions`): `skip` omite una ocurrencia puntual (se ve atenuada y rayada, con "Restaurar"). Un feriado (nacional o manual) atenúa las clases de ese día como "Sin clase"; una excepción `keep` indica que hubo clase igual. Los feriados no afectan a los eventos externos.
- Los bloques superpuestos se reparten el ancho de la columna. Crear con clic en un hueco de la grilla (precarga día y hora) o con el botón "Agregar".

### Notas
- Escala de 0 a 10, decimales permitidos, validada.
- Promedio de la materia = (cursada + final) / 2, **solo si existen ambas notas**; si falta una es `null` y la materia queda fuera de los promedios.
- Promedio simple = media de los promedios de materia no nulos.
- Promedio ponderado = Σ(promedio × créditos) / Σ(créditos), solo con materias que tengan promedio y créditos mayores a 0.
- Dos alcances: **cuatrimestre actual** (materias no archivadas) y **general** (archivadas y no archivadas). Se muestran los cuatro números arriba de la tabla, con 2 decimales y "—" si no hay datos.
- Tabla con una fila por materia, edición en la misma celda, archivadas con etiqueta y estilo atenuado.

### Sesiones de estudio
- **Timer** basado en timestamps, no en acumular `setInterval`: guardá el instante en que termina la fase y calculá el restante, para que sobreviva a pestañas en segundo plano. Persistí la sesión activa para recuperarla al recargar y mostrá el tiempo restante en `document.title`.
- **Presets**: Pomodoro 25/5, 50/10, 90/20 y Personalizado (foco, descanso, cantidad de ciclos). Controles: iniciar, pausar, reiniciar y saltar descanso. Indicador de fase y de ciclo ("Ciclo 2 de 4").
- **Sonido** al terminar cada fase, generado con la Web Audio API (sin archivos de audio), con interruptor guardado.
- **Modo foco**: pantalla completa (Fullscreen API) con solo el timer y las tareas de hoy.
- **Materia** opcional. Panel con las tareas de hoy (`tasksForDay(today)`), que se pueden tildar durante la sesión; con materia elegida hay un interruptor para filtrar por ella.
- **Guardado**: al terminar o detener se muestra un resumen y se guarda la sesión con foco y descanso reales, ciclos completados, preset, materia, `started_at`, `ended_at` y las tareas tildadas entre el inicio y el fin (`study_session_tasks`).
- **Historial**: lista de sesiones y totales por semana (lunes a domingo) y por materia, con gráfico de barras simple en SVG o con una librería liviana.
- **Amigos**: no se implementa. Ni pestaña ni placeholder. Dejá `study_sessions` con `user_id` para poder extenderlo después.

## Modelo de datos (propuesta; ajustalo y documentalo)

Todas las tablas llevan `user_id` y RLS.

- `profiles`: `user_id`, `locale`, `theme`, `visible_weekdays`, `default_task_lead_days`, `timezone`.
- `subjects`: `id`, `name`, `commission`, `teacher`, `term_year`, `term_period`, `credits`, `color_key`, `grade_course`, `grade_final`, `archived_at`.
- `subject_documents`: `id`, `subject_id`, `source` (`drive` o `link`), `name`, `url`, `drive_file_id`, `mime_type`.
- `schedule_blocks`: `id`, `subject_id`, `weekday`, `start_time`, `end_time`, `room`.
- `schedule_events`: `id`, `title`, `color_key`, `start_time`, `end_time`, `recurrence` (`none`, `daily` o `weekdays`), `weekdays`, `date`, `start_date`, `until_date`.
- `schedule_exceptions`: `id`, `target_type` (`block` o `event`), `target_id`, `date`, `kind` (`skip` o `keep`).
- `tasks`: `id`, `subject_id` (nullable), `title`, `priority`, `planned_date`, `due_date`, `lead_days`, `sort_order`, `completed_at`, `source_calendar_event_id`.
- `subtasks`: `id`, `task_id`, `title`, `sort_order`, `completed_at`.
- `calendar_events`: `id`, `subject_id` (nullable), `category`, `title`, `date`, `confirmed`, `lead_days`.
- `study_sessions`: `id`, `subject_id` (nullable), `preset`, `started_at`, `ended_at`, `focus_seconds`, `break_seconds`, `cycles_completed`.
- `study_session_tasks`: `session_id`, `task_id`.

## Landing y screenshots

- Construí la landing según el diseño: barra superior con "Continuar con Google" fija, hero y un bloque por funcionalidad (Materias, Horario, Tareas, Calendario, Notas, Sesiones de estudio) con título, una frase y un screenshot. Sin secciones extra.
- Los screenshots son **reales**: `scripts/seed-demo.ts` carga una cuenta demo con datos de ejemplo y `scripts/screenshots.ts` (Playwright) captura cada sección en claro y oscuro en `public/landing/`. La landing muestra la variante del tema activo. Documentá `npm run seed:demo` y `npm run screenshots`.
- El login de Google no se puede automatizar. Para los e2e y los screenshots creá una sesión de prueba con el service role de Supabase, solo en entorno local o de test y nunca en producción.

## Fases

0. **Base**: repo, Next, TypeScript, Tailwind y shadcn, tokens y temas desde el diseño, i18n, Supabase (migraciones y RLS), login con Google, layout con drawer, perfil y Ajustes. Aceptación: login, drawer, tema e idioma funcionando.
1. **Materias y Notas**: CRUD, archivar y desarchivar, documentos (link primero, Picker después), pestaña Notas con promedios. Tests de promedios.
2. **Tareas**: modelo, `tasksForDay`, subtareas, completado, drag & drop, prioridad, filtros, progreso y borrado. Conectá el progreso de las materias. Tests.
3. **Calendario**: vista mensual, categorías, recuperatorios, feriados (API más respaldo) y TP que genera tarea. Tests.
4. **Horario**: grilla, bloques, eventos recurrentes, excepciones y feriados. Tests de recurrencia.
5. **Sesiones de estudio**: timer, presets, tareas del día, guardado e historial. Tests.
6. **Landing, seed demo y screenshots.**
7. **Pulido**: estados vacíos, de error y de carga, accesibilidad, revisión a 1024, 1366 y 1440 px, README y SETUP.

## Criterios de aceptación globales

- Un usuario no puede leer ni modificar datos de otro (test de RLS).
- Todos los textos existen en español e inglés y el layout aguanta el inglés.
- Los íconos son solo de Lucide (más la "G" de Google y el logo).
- Todo funciona con teclado y con touch, incluido el drag & drop.
- Un clic en un recuperatorio lo confirma y le da color pleno.
- Progreso: 100 % sin tareas, y el de las materias coincide con el de las tareas.
- `typecheck`, `lint`, `test` y `build` en verde.

## Fuera de alcance

Amigos y todo lo social, layouts mobile, notificaciones y recordatorios, kanban, modo offline, notas parciales múltiples por materia, días no laborables y puentes, importación y exportación.
