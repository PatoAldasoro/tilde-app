-- Tilde · orden de las materias a mano y más datos en las sesiones de estudio.

-- ---------- materias: orden elegido por el usuario (arrastrar en Inicio) ----------

alter table public.subjects
  add column sort_order double precision not null default 0;

-- Las que ya existen quedan en el orden en que se crearon.
update public.subjects as s
set sort_order = ranked.position
from (
  select id, row_number() over (partition by user_id order by created_at, id) as position
  from public.subjects
) as ranked
where ranked.id = s.id;

create index subjects_order_idx on public.subjects (user_id, sort_order);

-- ---------- sesiones de estudio ----------

-- Modo examen: un solo bloque largo, sin descansos.
alter table public.study_sessions drop constraint study_sessions_preset_check;
alter table public.study_sessions add constraint study_sessions_preset_check
  check (preset in ('25-5', '50-10', '90-20', 'custom', 'exam'));

alter table public.study_sessions
  -- Subtareas tildadas entre el inicio y el fin de la sesión.
  add column subtasks_completed smallint not null default 0 check (subtasks_completed >= 0),
  -- Modo examen: cuántas veces se salió de la página y cuánto tiempo en total.
  add column away_count smallint not null default 0 check (away_count >= 0),
  add column away_seconds integer not null default 0 check (away_seconds >= 0);
