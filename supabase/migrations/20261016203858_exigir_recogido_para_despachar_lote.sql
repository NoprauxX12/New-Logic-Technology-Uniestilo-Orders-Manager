-- HU-09 · No se despacha un lote de una orden que no esté recogida y bordada.
--
-- En el taller, lo cortado se recoge y se borda antes de mandarlo a un taller
-- satélite (HU-08 → HU-09 → HU-10). Mientras HU-09 no tenía pantalla, el
-- despacho solo exigía el corte (`exigir_corte_para_despachar`). Ahora que
-- logística marca el recogido y bordado, el despacho exige ese paso: si no, un
-- lote podía salir sin él y la orden quedaba frenada después en marcación.
--
-- El recogido ya exige el corte por la secuencia del motor, así que exigirlo
-- aquí cubre las dos cosas. Se conserva el código de error UE001 ("falta la
-- etapa previa al despacho") para que la action no cambie de contrato.
--
-- Igual que antes, la aplicación lo comprueba primero para dar un mensaje
-- claro; esto es la última barrera ante un POST directo.

drop trigger lote_taller_exige_corte_completado on public.lote_taller;
drop function public.exigir_corte_para_despachar();

create or replace function public.exigir_recogido_para_despachar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = new.orden_id
      and checkpoint = 'recogido_bordado'
  ) then
    raise exception 'La orden todavía no tiene el recogido y bordado'
      using errcode = 'UE001';
  end if;

  return new;
end;
$$;

comment on function public.exigir_recogido_para_despachar is
  'HU-09/HU-10: impide crear un lote a taller si la orden no está recogida y bordada.';

create trigger lote_taller_exige_recogido_bordado
  before insert on public.lote_taller
  for each row
  execute function public.exigir_recogido_para_despachar();
