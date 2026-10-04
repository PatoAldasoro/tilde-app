-- Tilde · esquema inicial
-- Reglas: todas las tablas llevan user_id y RLS (auth.uid() = user_id).
-- Los días se guardan como date y las horas como time, sin zona horaria.
-- Las claves foráneas son compuestas (id, user_id) para que una fila nunca
-- pueda referenciar datos de otro usuario.

-- ---------- helpers ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_color_key(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in (
    'frambuesa', 'mandarina', 'ambar', 'lima', 'pino', 'turquesa',
    'cielo', 'cobalto', 'uva', 'fucsia', 'cacao', 'grafito'
  );
$$;

-- ---------- profiles ----------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'es' check (locale in ('es', 'en')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  -- ISO: 1 = lunes … 7 = domingo
  visible_weekdays smallint[] not null default '{1,2,3,4,5}'
    check (visible_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(visible_weekdays) >= 1),
  default_task_lead_days smallint not null default 3 check (default_task_lead_days between 0 and 30),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- subjects ----------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  commission text check (char_length(commission) <= 60),
  teacher text check (char_length(teacher) <= 120),
  term_year smallint check (term_year between 2000 and 2100),
  -- 1 = 1C, 2 = 2C, 0 = anual, 3 = verano
  term_period smallint check (term_period in (0, 1, 2, 3)),
  credits smallint check (credits between 0 and 99),
  color_key text not null check (public.is_color_key(color_key)),
  grade_course numeric(4, 2) check (grade_course between 0 and 10),
  grade_final numeric(4, 2) check (grade_final between 0 and 10),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index subjects_user_idx on public.subjects (user_id, created_at);
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------- subject_documents (referencias, nunca el archivo) ----------

create table public.subject_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  source text not null check (source in ('drive', 'link')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  drive_file_id text,
  mime_type text,
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index subject_documents_subject_idx on public.subject_documents (user_id, subject_id);

-- ---------- calendar_events ----------

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  category text not null check (category in ('parcial', 'final', 'tp', 'recuperatorio', 'feriado')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  date date not null,
  -- Solo tiene sentido en recuperatorios: false = tentativo (atenuado).
  confirmed boolean not null default true,
  -- Solo en TP: días de anticipación de la tarea vinculada.
  lead_days smallint check (lead_days between 0 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  check (category <> 'feriado' or subject_id is null)
);

create index calendar_events_date_idx on public.calendar_events (user_id, date);
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------- tasks ----------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  -- Tarea diaria: vive en planned_date. Tarea con fecha límite: due_date + lead_days.
  planned_date date,
  due_date date,
  lead_days smallint check (lead_days between 0 and 60),
  sort_order double precision not null default 0,
  completed_at timestamptz,
  -- TP del Calendario que generó esta tarea. Borrar el evento borra la tarea.
  source_calendar_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (source_calendar_event_id, user_id) references public.calendar_events (id, user_id) on delete cascade,
  check (planned_date is not null or due_date is not null),
  check (due_date is null or lead_days is not null)
);

create index tasks_user_idx on public.tasks (user_id, sort_order);
create index tasks_subject_idx on public.tasks (user_id, subject_id);
create unique index tasks_source_event_idx on public.tasks (source_calendar_event_id)
  where source_calendar_event_id is not null;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------- subtasks (un solo nivel) ----------

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  sort_order double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index subtasks_task_idx on public.subtasks (user_id, task_id, sort_order);

-- ---------- schedule ----------

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text check (char_length(room) <= 60),
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  check (end_time > start_time)
);

create index schedule_blocks_user_idx on public.schedule_blocks (user_id, weekday);

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  color_key text not null check (public.is_color_key(color_key)),
  start_time time not null,
  end_time time not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekdays')),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  -- recurrence = 'none': ocurre en date. Si se repite: desde start_date hasta until_date (opcional).
  date date,
  start_date date,
  until_date date,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (recurrence <> 'none' or date is not null),
  check (recurrence <> 'weekdays' or cardinality(weekdays) >= 1),
  check (until_date is null or start_date is null or until_date >= start_date)
);

create index schedule_events_user_idx on public.schedule_events (user_id);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('block', 'event')),
  target_id uuid not null,
  date date not null,
  -- skip: se omite esa ocurrencia. keep: hubo clase igual aunque sea feriado.
  kind text not null check (kind in ('skip', 'keep')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, date)
);

create index schedule_exceptions_date_idx on public.schedule_exceptions (user_id, date);

-- target_id es polimórfico: sin FK, se limpia con triggers.
create or replace function public.delete_schedule_exceptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.schedule_exceptions
  where target_type = tg_argv[0] and target_id = old.id and user_id = old.user_id;
  return old;
end;
$$;

create trigger schedule_blocks_cleanup after delete on public.schedule_blocks
  for each row execute function public.delete_schedule_exceptions('block');
create trigger schedule_events_cleanup after delete on public.schedule_events
  for each row execute function public.delete_schedule_exceptions('event');

-- ---------- study sessions ----------

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  -- user_id queda listo para extender a "Amigos" más adelante.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  preset text not null check (preset in ('25-5', '50-10', '90-20', 'custom')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  focus_seconds integer not null check (focus_seconds >= 0),
  break_seconds integer not null check (break_seconds >= 0),
  cycles_completed smallint not null check (cycles_completed >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- Al eliminar la materia el tiempo estudiado se conserva, sin materia.
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  check (ended_at >= started_at)
);

create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);

-- Tareas tildadas entre el inicio y el fin de la sesión. Guarda el título para que
-- el historial no cambie si después se borra la tarea.
create table public.study_session_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  task_id uuid,
  title text not null,
  created_at timestamptz not null default now(),
  unique (session_id, task_id),
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade,
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);

create index study_session_tasks_session_idx on public.study_session_tasks (user_id, session_id);

-- ---------- RLS: cada fila es de su dueño ----------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'subjects', 'subject_documents', 'calendar_events', 'tasks', 'subtasks',
    'schedule_blocks', 'schedule_events', 'schedule_exceptions', 'study_sessions', 'study_session_tasks'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
