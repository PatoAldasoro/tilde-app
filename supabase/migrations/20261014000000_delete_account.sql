-- Borrar la cuenta desde Ajustes. Borra la fila de quien llama en auth.users y, por las FK con
-- "on delete cascade", todos sus datos (perfil, materias, tareas, fechas, horario, sesiones…).
-- Es security definer porque auth.users no se puede tocar desde el cliente; solo borra al usuario
-- de la sesión (auth.uid()), nunca a otro.
create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
