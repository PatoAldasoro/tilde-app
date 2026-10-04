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
