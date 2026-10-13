-- HU-10 · No se despacha un lote de una orden cuyo corte no esté completado.
--
-- El despacho a taller no es un checkpoint —es una fila de `lote_taller`, por la
-- regla 6—, así que esta condición no la puede verificar el motor de workflow:
-- no hay transición que validar. Vive aquí, en la base, porque una server action
-- se puede invocar con un POST directo sin pasar por el formulario, y porque así
-- la regla protege también a cualquier otra ruta que inserte lotes más adelante
-- (HU-11 al recibir, o una carga de datos).
--
-- La aplicación la comprueba antes, para poder dar un mensaje claro; esto es la
-- última barrera.

create or replace function public.exigir_corte_para_despachar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = new.orden_id
      and checkpoint = 'corte_completado'
  ) then
    raise exception 'La orden todavía no tiene el corte completado'
      using errcode = 'UE001';
  end if;

  return new;
end;
$$;

comment on function public.exigir_corte_para_despachar is
  'HU-10: impide crear un lote a taller si la orden no tiene el corte completado.';

create trigger lote_taller_exige_corte_completado
  before insert on public.lote_taller
  for each row
  execute function public.exigir_corte_para_despachar();
