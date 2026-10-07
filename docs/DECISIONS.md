# Decisiones

Registro de conflictos entre el diseño (`design/`) y la consigna (`docs/PROMPT.md`), y de las decisiones
tomadas donde ninguno de los dos definía algo. Regla general: **en lo visual manda el diseño; en el
comportamiento manda la consigna.**

## Conflictos diseño ↔ consigna (gana la consigna)

| # | Diseño | Consigna | Qué se hizo |
|---|---|---|---|
| 1 | Parcial, final y TP crean una tarea (prioridad alta); el recuperatorio la crea al confirmarse. | Solo el TP genera tarea. | Solo TP. El campo "aparece X días antes" se muestra únicamente para TP. Confirmar un recuperatorio solo cambia su aspecto. |
| 2 | Pestaña "Amigos" marcada como "solo diseño". | No se implementa: ni pestaña ni placeholder. | Sin pestaña. Se quitaron sus estilos y textos. `study_sessions` conserva `user_id` para extenderlo. |
| 3 | Progreso de materia = tareas completadas / tareas. | Por unidades: una tarea con subtareas cuenta por sus subtareas. | Unidades (`src/lib/domain/progress.ts`). El texto de la tarjeta sigue contando tareas. |
| 4 | Toast de 6 s. | "Deshacer" de unos 8 segundos. | Los toasts con "Deshacer" duran 8 s; el resto, 6 s. |
| 5 | "Pegar link" acepta cualquier página (el resto se guarda como "link"). | Validar que sea un link de Google Drive o Docs. | Solo `drive.google.com` y `docs.google.com`; otro dominio muestra error. |
| 6 | Eliminar una materia deja sus tareas sin materia. | Eliminar borra en cascada sus datos. | Cascada: tareas, horarios, fechas y documentos. Las sesiones de estudio quedan sin materia (ver 12). |
| 7 | Cuatrimestre como texto libre ("2C 2026"). | Año y período. | Dos campos: período (1C, 2C, anual, verano) y año. |
| 8 | Etiqueta extra "Entrega mañana". | Etiquetas: "Entrega en N días", "Vence hoy", "Vencida". | Se mantiene "Entrega mañana" para N = 1: es redacción, no comportamiento. |

## Decisiones propias

9. **Idioma en la URL.** `/` y `/app` en español; `/en` y `/en/app` en inglés (`next-intl`, prefijo "as-needed").
   Así la landing queda indexable en ambos idiomas con `hreflang`. El idioma elegido se guarda en el perfil y en la
   cookie `NEXT_LOCALE`; `src/proxy.ts` redirige las URL sin prefijo según la cookie. No se detecta por
   `Accept-Language`: español es el valor por defecto real.
10. **Tema.** `data-theme` en `<html>`, aplicado por un script en `<head>` antes del primer pintado. La preferencia
    vive en `localStorage` (para evitar el parpadeo) y en el perfil (para otros dispositivos); al entrar manda el perfil.
11. **Estilos.** El CSS del prototipo se portó casi literal a `src/styles/tilde.css` dentro de `@layer components`,
    y los tokens se registran en el theme de Tailwind (`src/styles/theme.css`, generado desde `tokens.css`).
    Las primitivas (diálogo, menú, popover) son componentes estilo shadcn sobre Radix con las clases del diseño.
12. **Modelo de datos.** Se siguió la propuesta con estos ajustes:
    - FK compuestas `(id, user_id)` en todas las relaciones: una fila no puede apuntar a datos de otro usuario.
    - `subjects.term_period` es `smallint` (1 = 1C, 2 = 2C, 0 = anual, 3 = verano).
    - `study_sessions.subject_id` usa `on delete set null`: al eliminar una materia el tiempo estudiado se conserva.
    - `study_session_tasks` tiene `id` propio, `task_id` nullable (`set null`) y guarda el `title`: el historial
      no cambia si después se borra la tarea.
    - `tasks.source_calendar_event_id` con `on delete cascade`: borrar el TP borra su tarea en la propia base.
    - `schedule_exceptions` se limpia con triggers al borrar el bloque o el evento (`target_id` es polimórfico).
    - Días de la semana en ISO: 1 = lunes … 7 = domingo.
13. **Perfil.** Lo crea un trigger sobre `auth.users`. En el primer ingreso adopta el idioma de la landing desde la
    que se hizo el login.
14. **Sesión de prueba.** `scripts/lib/test-session.ts` crea usuarios con email y contraseña vía service role y arma
    las cookies de `@supabase/ssr`. No hay ninguna ruta de "login de prueba" en la app: el atajo vive solo en scripts
    y tests, y se niega a correr en producción o contra un Supabase que no sea local.
15. **Feriados nacionales.** `GET /api/holidays?year=` consulta `api.argentinadatos.com` desde el servidor (caché de un día)
    y cae a `data/feriados-{año}.json` si falla. Se descartan los `puente`. El cliente pide el año visible y sus vecinos.
    - **09/11/2026, "Visita del papa León XIV":** verificado el 04/10/2026 contra el calendario oficial de
      argentina.gob.ar: es feriado nacional inamovible (Decreto 1103/2026). Se incluye. Los del 10/11 y 11/11 son locales
      y no entran.
    - **2027 es provisorio:** el calendario oficial todavía no está publicado y la API trae los trasladables en su fecha
      original. `normalizeHolidays` los mueve según la Ley 27.399 (misma regla que reproduce el calendario 2026).
      Detalle en `data/README.md`.
    - Los nombres se muestran traducidos (`holiday_*` en `messages/`); un feriado desconocido usa el nombre de la API.
16. **Calendario → Tareas.** Solo el TP genera tarea ("TP · <título>", o la materia si el evento no tiene título).
    Si la tarea de un TP se borra a mano, editar el evento no la recrea: el popover del TP ofrece "Crear su tarea en Tareas".
    En Tareas, los campos que vienen del evento (título, materia, fecha, anticipación) quedan de solo lectura.
    El título de un evento es opcional: vacío muestra "Categoría · Materia".
17. **Tareas: qué se ve cada día.** Además de las reglas de la consigna: una tarea completada se ve el día en que se
    completó; una diaria completada después de su día sigue figurando en su día original (no se reescriben fechas);
    una de fecha límite completada se ve desde el inicio de su ventana hasta el día en que se completó.
    El progreso del día y su contador usan unidades (subtareas), igual que el de las materias.
18. **Orden de tareas.** Un `sort_order` global por tarea. Reordenar reparte entre las tareas del día los mismos valores
    que ya tenían, así no cambia su posición respecto de otros días. "Ordenar por prioridad" es una acción puntual.
19. **Horario.** `occurrencesForWeek(weekStart, blocks, events, exceptions, holidays)` recibe solo los bloques de
    materias no archivadas (`blocksOfActiveSubjects`) y las fechas feriado (nacionales + manuales del Calendario).
    - Una ocurrencia tiene una sola excepción: `skip` (omitida) o `keep` (hubo clase aunque sea feriado).
      "Restaurar" una omitida borra la excepción; en un feriado crea el `keep`.
    - Las actividades recurrentes no tienen fecha de inicio por defecto (`start_date` queda `null`): se ven en todas
      las semanas hasta `until_date`, igual que las clases.
    - Horas con selector propio en pasos de 30 minutos entre 07:00 y 23:00 (siempre 24 h).
    - Los huecos de la grilla se activan con puntero o touch; con teclado se usa el botón "Agregar".
20. **Sesiones de estudio.**
    - El timer guarda el instante en que termina la fase (`phaseEndsAt`) y calcula el restante contra el reloj
      (`src/lib/domain/timer.ts`). Si pasaron varias fases sin ticks (pestaña dormida), las recorre todas y cada
      fase nueva empieza donde terminó la anterior.
    - El estado vive en un store fuera de React (`src/lib/study-store.ts`) y se persiste en `localStorage`
      (`tilde-study`): sigue corriendo al cambiar de sección y se recupera al recargar. El título de la pestaña
      muestra "18:24 · Foco · Tilde".
    - El interruptor de sonido también se guarda ahí (es una preferencia del dispositivo, no del perfil).
    - "Terminar sesión" y el fin del último foco abren el resumen, que exige guardar o descartar. Se guardan los
      tiempos **reales** de foco y descanso (las pausas no cuentan) y las tareas con `completed_at` entre el inicio
      y el fin, tildadas desde cualquier sección.
    - El historial muestra foco por semana (8 semanas, lunes a domingo, según el día de inicio en la zona del
      usuario) y por materia, con las barras del diseño (HTML + CSS, sin librería).
    - Sin descanso largo y sin pestaña "Amigos" (ver 2).
21. **Landing y capturas.** La landing es estática (SSG) en `/` y `/en`, con `hreflang`, `robots.txt` y `sitemap.xml`;
    la app con sesión lleva `noindex`. Las capturas son reales: `npm run seed:demo` carga la cuenta demo y
    `npm run screenshots` las toma con Playwright en claro y oscuro (`public/landing/<sección>-<tema>.png`).
    - El "hoy" de la demo es fijo (martes 18/08/2026, semana del feriado del 17/08) y el script fija el reloj del
      navegador en ese día, así las capturas salen siempre iguales. Tiene que ser una fecha pasada: con el reloj
      adelantado el cliente de Supabase creería que la sesión venció.
    - Se rinden las dos variantes de cada imagen y el CSS muestra la del tema activo (`data-theme`); la oculta no
      se descarga (`loading="lazy"`).

## Cambios pedidos después de la entrega (05/10/2026)

Pedidos directos del usuario. Donde chocan con el diseño o con la consigna original, **mandan estos**.

22. **Subtareas en "Tareas de hoy" (Sesiones).** La lista chica al lado del timer no dejaba ver las subtareas, y una
    tarea con subtareas pendientes no se puede completar: quedaba trabada. Ahora cada tarea con subtareas muestra
    su contador y un botón para desplegarlas (también en el modo foco); tocar la casilla bloqueada las despliega.
23. **Encabezado del Horario.** Cambia el diseño: el **día** (Lun, Mar…) va grande y en negrita, la fecha chica al
    lado, y el resaltado de "hoy" pasa del número al día.
24. **Íconos de materias y actividades.** Columna `icon` (clave de Lucide en kebab-case) en `subjects` y
    `schedule_events`. La lista es cerrada (64 íconos, `src/lib/domain/icons.ts`) para que el selector sea una
    grilla y no un buscador; la base solo valida la forma de la clave, así se pueden sumar íconos sin migración.
    Sin ícono, todo se ve como antes (punto de color). Aparece en: tarjeta y panel de la materia, chips de tareas,
    filtro "Por materia", bloques y popovers del Horario, chips del Calendario, notas, historial y el fondo exportado.
25. **Importar tareas (JSON).** Pensado para pegar la respuesta de una IA: el diálogo arma el pedido (con el formato,
    las materias propias y la fecha de hoy) y acepta la respuesta tal cual, con texto alrededor o en un bloque de código.
    - Formato recomendado: `{ "tasks": [{ "title", "date", "due", "lead_days", "subject", "priority", "subtasks" }] }`.
      Se aceptan variantes razonables (lista suelta, agrupado por día o por fecha, claves en español).
    - `date` = día en que se hace (tarea diaria). Con `due` es una entrega: aparece desde `date` (o con `lead_days`,
      o con la anticipación del perfil) hasta la fecha límite. Sin fecha, queda para hoy.
    - Una materia que no existe no frena nada: la tarea entra sin materia y se avisa. Lo que no se entiende se lista
      y el resto se importa igual. Máximo 500 tareas por vez. El toast permite deshacer.
26. **Importar fechas al Calendario (.ics).** El lector es propio (`src/lib/domain/ics.ts`, sin dependencias).
    - Hace falta una **sexta categoría, "Evento"**, para lo que no es parcial, final, TP, recuperatorio ni feriado
      (un cumpleaños, un turno). Se dibuja con una barra a la izquierda. La categoría y la materia se proponen a partir
      del título y se pueden cambiar antes de importar.
    - Las fechas del Calendario ganan una **hora opcional** (`start_time`): los eventos importados la traen y se
      puede cargar a mano. Se ve en el detalle y en la lista del día.
    - Cada fecha importada guarda `external_id`: reimportar no duplica; si cambió de día u hora se ofrece como
      "Cambió de fecha" y solo actualiza eso (la categoría, la materia y el título que tenga en Tilde no se pisan).
    - Los eventos que se repiten van en una sola fila y **sin marcar**: lo de todas las semanas va en el Horario.
    - Un TP importado crea su tarea, como cualquier TP. Por defecto se importa de hoy a un año.
27. **Vincular Google Calendar: por la dirección secreta .ics, no con OAuth.**
    - Con OAuth, el permiso de lectura de Calendar es un scope "sensible": para que entre cualquier persona Google
      exige verificar la app, y el token del navegador dura una hora y no se renueva solo, así que tampoco habría
      sincronización real. La dirección privada .ics no necesita configurar nada en Google Cloud, no vence y
      también sirve para Outlook e iCloud.
    - `/api/ical` la descarga en el servidor (el navegador no puede por CORS). Para que no sea una pasarela abierta:
      exige sesión, solo acepta `calendar.google.com`, `outlook.office365.com`, `outlook.live.com` y `*.icloud.com`,
      valida cada redirección, corta a los 6 MB y a los 10 s, y no guarda ni registra nada.
    - La dirección se guarda en `calendar_feeds` (RLS): funciona como una contraseña y solo la ve su dueño.
    - Al abrir el Calendario se vuelve a leer en segundo plano (cada 6 h como mucho) y **se avisa** si hay fechas
      nuevas o con cambios. **Nunca se importa nada solo.** Lo ofrecido y no elegido, y lo que se borra después,
      queda en `skipped` y no se vuelve a proponer marcado.
    - Es de una sola vía: Tilde lee el calendario, no escribe en él.
28. **Exportar el horario como fondo de pantalla.** PNG dibujado en un `<canvas>` con los tokens y las tipografías
    del diseño (sin librerías de captura: sale nítido a cualquier tamaño). La estructura sigue los dos diseños que
    hizo el usuario para el horario exportado (06/10/2026); los colores y la tipografía son los de la app.
    - **Contenido:** la semana tipo (clases y actividades recurrentes vigentes), sin fechas, sin excepciones ni
      feriados y sin las actividades de un solo día. Se dibujan los días visibles del Horario y solo el rango de
      horas ocupado.
    - **Tabla a pantalla casi completa**, con una fila por media hora (las horas enteras, más marcadas) y una fila
      de cierre con la hora en que termina el horario. En vertical cubre el 90 % del alto.
    - **Bloques:** ícono y nombre, el aula en una pastilla y la comisión de la materia en la esquina. No llevan
      horario escrito: lo da la grilla. En horizontal el contenido va a la izquierda; en vertical (columnas
      angostas), centrado y con el ícono arriba. Pueden ser plenos (color de la materia de fondo, como en los
      diseños del usuario) o suaves (como en el Horario de la app).
    - **Formatos:** 16:9 (3840 × 2160) y 16:10 (3840 × 2400) en horizontal; 9:16 (2160 × 3840) y 9:19,5
      (2160 × 4680) en vertical. Los dos nuevos son las proporciones de los diseños del usuario: una notebook
      recorta los costados de una imagen 16:9, y un teléfono actual hace lo mismo con una 9:16.
    - **Fondo:** liso (el del tema), con manchas de los colores de las materias, o un color a elección (selector
      de color del navegador más su código). Ese color es contenido de quien exporta, no un color de la interfaz:
      es la única excepción a "solo tokens". El tema (claro u oscuro) se elige aparte del de la app.
    - Las opciones se recuerdan en el dispositivo (`localStorage`, `tilde-wallpaper`).
29. **Menú por el borde izquierdo.** Llevar el mouse al borde abre el menú solo si parece intencional
    (`src/lib/domain/edge-intent.ts`): un tramo largo y casi horizontal hacia la izquierda más una pausa corta contra
    el borde (90 ms), o una llegada lenta y una pausa larga (480 ms). No cuenta llegar en diagonal o bordeando, con
    un botón apretado (arrastre, selección), con un diálogo abierto, recién escrito en un campo, ni si el puntero
    sale de la ventana. Después de abrirse hay que alejarse 96 px para que vuelva a estar disponible. Un menú
    abierto así se cierra solo al alejar el mouse, salvo que se lo use. Es solo para mouse, y se apaga en Ajustes
    (`profiles.edge_menu`). El botón del menú sigue ahí: nada depende solo del hover.
30. **Color de acento a elección (06/10/2026).** En Ajustes se puede cambiar el naranja de la app por cualquiera de
    los 12 colores de la paleta de materias (o volver al original, "Naranja Tilde").
    - No se inventan colores: cada token del acento se arma con los tonos que la paleta ya tiene para ese color,
      en claro y en oscuro (`vivid` → acento y foco, `solid` + `on-solid` → rellenos con texto, `soft` + `on-soft`
      → fondos suaves y texto). Las reglas están al final de `tokens.css` y se activan con `<html data-accent>`.
    - Cambia todo lo que usa el acento: resaltados de "hoy", pestañas, casillas, interruptores, anillo del timer,
      foco del teclado y el símbolo del logo. Los colores de las materias no cambian.
    - Se guarda en el perfil (`profiles.accent_color`, `null` = original) y también en el dispositivo, igual que
      el tema: un script en `<head>` lo aplica antes del primer pintado para que no parpadee en naranja.
31. **El idioma, solo en Ajustes (06/10/2026).** El menú lateral traía el selector de idioma junto al de tema
    (como en el prototipo). Por pedido del usuario el idioma queda únicamente en Ajustes; el tema sigue en los dos.
32. **Dependencias sin avisos al instalar (06/10/2026).**
    - **ESLint 10.** La 9 quedó sin soporte. `eslint-config-next` todavía trae tres plugins (`import`, `jsx-a11y`,
      `react`) que declaran ESLint 9 como máximo, aunque funcionan con la 10: `overrides` en `package.json` deja
      asentada esa excepción, y `eslint.config.mjs` le pasa a `eslint-plugin-react` la versión de React ya
      resuelta (la detectaba con una API que ESLint 10 quitó). Se comprobó con un archivo de prueba que las reglas
      de los seis plugins siguen marcando lo mismo que antes. Cuando `eslint-config-next` actualice esos plugins,
      los `overrides` se pueden quitar.
    - **`allowScripts`.** npm 12 (el que usa Vercel) ya no corre scripts de instalación de las dependencias sin
      una decisión explícita. Los cuatro que aparecen (`esbuild`, `@swc/core`, `@parcel/watcher`, `unrs-resolver`)
      solo verifican o compilan un binario que ya llega precompilado: quedan denegados. El build, los tests y el
      lint pasan con esos scripts bloqueados.

## Tercera tanda de cambios (07/10/2026)

33. **Orden de las materias a mano.** `subjects.sort_order` (las que ya existían quedan por antigüedad). En Inicio se
    arrastran desde cualquier parte de la tarjeta con el mouse o el dedo, y con el teclado desde un asa (Espacio la
    levanta, las flechas la mueven). Ese orden vale en toda la app: filtros, selectores, notas. Una nueva va al final.
34. **Sesiones incompletas.** "Reiniciar" ya no tira lo estudiado: si hay al menos un minuto de foco abre el resumen
    (que dice cuántos ciclos quedaron hechos de los planeados) para guardar o descartar. Con menos, vuelve al inicio.
35. **Ajustar el tiempo a mano** (menú del reloj con el signo más): adelantar o atrasar 1 o 5 minutos, cortar el foco
    y volver a empezar la fase. Adelantar cuenta ese tiempo como hecho (se siguió con el timer frenado); atrasar lo
    descuenta (el timer corrió de más). No pasa del principio ni del final de la fase. Un foco cortado antes de
    tiempo suma sus minutos pero no cuenta como ciclo completado.
36. **Sonido a elección.** Cinco sonidos generados en el navegador (sin archivos), volumen y botón de prueba; elegir
    uno lo hace sonar. Se guarda en el dispositivo, junto con el resto de la configuración de la sesión.
37. **Modo examen.** Un solo bloque de 1:30, 2, 2:30 o 3 horas.
    - No hay descansos ni se ajusta el tiempo, y el botón principal entrega. Pausar se puede, pero a propósito un
      paso más lejos: en el menú del reloj ("Opciones del examen"), con un texto que recuerda que un examen de
      verdad no se pausa. Reanudar sí queda a un clic. En pausa el reloj no corre, las salidas de la página no se
      anotan y siguen el rojo, la pantalla completa y la lista de tareas oculta. (Pedido posterior; al principio no
      se podía pausar.)
    - Mientras dura, el acento de toda la app pasa a un rojo que solo existe para esto (`--exam-*`), por encima del
      acento elegido en Ajustes. Con el modo elegido y sin empezar, solo cambia la tarjeta del timer.
    - Salir de la página (otra pestaña, otra ventana) suena una alarma (se puede apagar) y queda anotado: cuántas
      veces y cuánto tiempo. Se ve en el reloj, en el resumen y en el historial. La ventana flotante es del
      navegador, no de la página: tocarla le saca el foco a Tilde y cuenta como salida.
    - Al empezar pasa solo a pantalla completa (el modo foco), y mientras dura no se muestra la lista de tareas, ni
      ahí ni en la vista normal. Salir de la pantalla completa no corta el examen ni cuenta como salida. Si el
      examen se retoma después de recargar la página no vuelve a pantalla completa solo: el navegador solo lo
      permite a partir de un clic.
38. **Timer flotante.** Es la ventana de imagen en imagen de los videos del navegador: sin marco, siempre encima.
    El timer se dibuja en un canvas (`src/lib/pip-canvas.ts`: rectángulo redondeado con el borde de progreso, fase,
    detalle y reloj, con los tokens del tema, el acento y el rojo de examen) que se transmite como video
    (`captureStream`) a un `<video>` invisible, y ese video es el que va a la ventana.
    - Reemplaza a la primera versión (Document Picture-in-Picture), que abría una ventana del navegador con su barra
      de título: se pidió sin marco, o sacar la función.
    - El botón de reproducir y pausar de la ventana maneja el timer: por Media Session donde el navegador lo usa
      (Chromium) y por la pausa del video donde lo maneja directo (Firefox). El video va en marcha o detenido igual
      que el timer, para que el botón muestre lo que va a hacer. Los navegadores detienen el video al cerrar la
      ventana: eso no pausa la sesión (`CLOSE_GRACE_MS` en `pip-store.ts`). En un examen la ventana no maneja nada.
    - El tic del timer sale de un Worker (`src/lib/ticker.ts`): los timers de una página en segundo plano se frenan.
    - Límites: en la ventana no hay HTML, así que no hay más botones que los del navegador (cerrar, volver a la
      pestaña, reproducir y pausar) y el contenido no es accesible para lectores de pantalla (el timer de la página
      sí). Recargar la página la cierra.
    - Si el navegador no tiene la API o la rechaza, el mismo botón activa un recuadro flotante dentro de la app, que
      acompaña al cambiar de sección.
39. **Historial editable.** Cada sesión tiene un menú (editar, eliminar con deshacer) y se puede anotar una a mano.
    Se corrigen fecha, hora, materia, tipo, foco, descansos, ciclos, subtareas y la lista de lo que se hizo: si el
    texto coincide con una tarea queda enlazada; si no, se guarda solo el texto.
40. **Subtareas en el registro.** `study_sessions.subtasks_completed`: las subtareas tildadas entre el inicio y el fin,
    en el resumen y en una columna del historial.
41. **Wrapped.** Resumen de la semana, el mes o el cuatrimestre en tarjetas: foco total y comparación, materia
    estrella y la olvidada, mejor día, racha y horario preferido, tareas y entregas, sesión más larga y cierre.
    - Los números son reales (`src/lib/domain/wrapped.ts`); una tarjeta sin datos no aparece.
    - Un período en curso se compara contra el mismo tramo del anterior, no contra el período entero.
    - Cuatrimestre según el calendario académico argentino: marzo a julio, agosto a diciembre, y el verano.
42. **El tooltip de una tarea bloqueada** se dibuja fuera de su contenedor (portal), para que un panel con scroll no
    lo recorte. **El logo** usa el naranja de la marca y ya no sigue al acento elegido.
