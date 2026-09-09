-- HU-13 · Una orden completada ya no admite cambios en sus etapas.
--
-- Va como trigger y no como comprobación en la aplicación porque cada historia
-- marca su etapa por su cuenta —HU-08 el corte, HU-12 la marcación, HU-19 la
-- salida— y cada una lo hace desde su propia action. Un trigger las cubre a
-- todas, incluidas las que todavía no están escritas, sin que nadie tenga que
-- acordarse de la regla.
--
-- La edición y el borrado no hace falta comprobarlos: `avance_seccion` no tiene
-- políticas de update ni de delete, así que RLS ya los niega.

create or replace function public.impedir_avance_en_orden_cerrada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.avance_seccion
    where orden_id = new.orden_id
      and checkpoint = 'cerrada'
  ) then
    raise exception 'La orden ya está completada y no admite más cambios'
      using errcode = 'UE004';
  end if;

  return new;
end;
$$;

comment on function public.impedir_avance_en_orden_cerrada is
  'HU-13: rechaza cualquier avance nuevo sobre una orden que ya está completada.';

create trigger avance_seccion_no_tocar_orden_cerrada
  before insert on public.avance_seccion
  for each row
  execute function public.impedir_avance_en_orden_cerrada();
