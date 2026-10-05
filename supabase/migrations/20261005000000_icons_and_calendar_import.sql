-- Tilde · íconos de materias y actividades, importación al Calendario y menú por borde.

-- ---------- íconos ----------
-- Clave de un ícono de Lucide en kebab-case ("flask-conical"). La lista de íconos que ofrece
-- la app vive en el cliente (src/lib/domain/icons.ts): una clave desconocida no se dibuja.

alter table public.subjects
  add column icon text check (icon ~ '^[a-z0-9-]{1,40}$');

alter table public.schedule_events
  add column icon text check (icon ~ '^[a-z0-9-]{1,40}$');

-- ---------- preferencias ----------
-- Abrir el menú al llevar el mouse al borde izquierdo de la pantalla.

alter table public.profiles
  add column edge_menu boolean not null default true;

-- ---------- calendarios vinculados (dirección .ics) ----------

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Dirección privada del calendario: funciona como una contraseña, solo la ve su dueño (RLS).
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  -- Eventos que se ofrecieron y no se importaron (o se borraron después): no se vuelven a proponer.
  skipped text[] not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index calendar_feeds_user_idx on public.calendar_feeds (user_id, created_at);

-- ---------- calendar_events: categoría genérica, hora y origen ----------

alter table public.calendar_events drop constraint calendar_events_category_check;
alter table public.calendar_events add constraint calendar_events_category_check
  check (category in ('parcial', 'final', 'tp', 'recuperatorio', 'feriado', 'evento'));

alter table public.calendar_events
  -- Opcional: los eventos de todo el día no tienen hora.
  add column start_time time,
  -- Identificador del evento en su origen ("ics:<uid>"): reimportar actualiza en vez de duplicar.
  add column external_id text check (char_length(external_id) between 1 and 400),
  -- Calendario vinculado del que vino. Al desvincularlo, los eventos quedan.
  add column feed_id uuid,
  add constraint calendar_events_feed_fk
    foreign key (feed_id, user_id) references public.calendar_feeds (id, user_id) on delete set null (feed_id);

create unique index calendar_events_external_idx on public.calendar_events (user_id, external_id)
  where external_id is not null;

-- ---------- RLS de la tabla nueva ----------

alter table public.calendar_feeds enable row level security;
alter table public.calendar_feeds force row level security;

create policy calendar_feeds_select_own on public.calendar_feeds
  for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_feeds_insert_own on public.calendar_feeds
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_feeds_update_own on public.calendar_feeds
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendar_feeds_delete_own on public.calendar_feeds
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.calendar_feeds from anon;
grant select, insert, update, delete on public.calendar_feeds to authenticated;
