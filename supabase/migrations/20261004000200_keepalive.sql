-- Ping liviano para el cron diario (/api/keepalive): Supabase Free pausa los proyectos tras
-- una semana sin actividad. No expone datos: solo devuelve la hora del servidor.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
