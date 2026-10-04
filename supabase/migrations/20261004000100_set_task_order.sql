-- Reordenar varias tareas en una sola llamada (drag & drop, "Ordenar por prioridad").
-- security invoker: corre con los permisos del usuario, así que RLS sigue aplicando.
create or replace function public.set_task_order(task_ids uuid[], sort_orders double precision[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks as t
  set sort_order = v.sort_order
  from unnest(task_ids, sort_orders) as v(id, sort_order)
  where t.id = v.id;
$$;

revoke all on function public.set_task_order(uuid[], double precision[]) from public, anon;
grant execute on function public.set_task_order(uuid[], double precision[]) to authenticated;
