-- Marcación y terminación pasan a ser un solo rol: `terminacion`.
--
-- La Product Owner pidió juntarlos: la misma sección marca la llegada a
-- marcación (HU-12) y la orden lista para despachar (HU-19). Las etapas del
-- flujo no cambian; cambia quién las marca.
--
-- El valor `marcacion` se queda en el enum `rol` sin usarse: Postgres no deja
-- quitar un valor de un enum sin recrear el tipo, y de él dependen funciones y
-- políticas. Una restricción impide volver a asignarlo.
--
-- La bitácora no se toca (RNF-05): lo que marcó cada persona sigue firmado
-- por ella.

-- ---------------------------------------------------------------------------
-- 1. Las cuentas de marcación pasan a terminación
-- ---------------------------------------------------------------------------

update public.usuario
set rol = 'terminacion'
where rol = 'marcacion';

alter table public.usuario
  add constraint usuario_rol_marcacion_retirado
    check (rol <> 'marcacion');

comment on constraint usuario_rol_marcacion_retirado on public.usuario is
  'El rol marcacion se unió a terminacion: ya no se asigna a nadie.';

-- ---------------------------------------------------------------------------
-- 2. Terminación es la dueña de "llegada a marcación"
-- ---------------------------------------------------------------------------
-- Copia de `CHECKPOINTS` en `src/features/workflow/checkpoints.ts`: el único
-- cambio respecto de `20261110100100_validar_insumos.sql` es el dueño de
-- `llegada_marcacion`. `rlsPorRol.test.ts` verifica que las dos copias digan
-- lo mismo.

create or replace function public.rol_dueno(p_checkpoint public.checkpoint)
returns public.rol
language sql
immutable
set search_path = ''
as $$
  select case p_checkpoint
    when 'cotizacion_enviada'  then 'secretaria'
    when 'cotizacion_aprobada' then 'secretaria'
    when 'programada_diseno'   then 'secretaria'
    when 'ficha_adjunta'       then 'diseno'
    when 'tela_programada'     then 'secretaria'
    when 'insumos_validados'   then 'secretaria'
    when 'corte_completado'    then 'corte'
    when 'recogido_bordado'    then 'logistica'
    when 'llegada_marcacion'   then 'terminacion'
    when 'lista_despacho'      then 'terminacion'
    when 'etiquetas'           then 'secretaria'
    when 'documentos_despacho' then 'secretaria'
    when 'factura_generada'    then 'secretaria'
    when 'cerrada'             then 'secretaria'
  end::public.rol
$$;

comment on function public.rol_dueno is
  'HU-17: el rol que puede marcar cada checkpoint. Copia de checkpoints.ts verificada por test.';
