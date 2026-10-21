-- HU-02 · Secretaría es la dueña de "cotización enviada".
--
-- Copia de `CHECKPOINTS` en `src/features/workflow/checkpoints.ts`: el único
-- cambio respecto de la versión de `20261019100100_terminacion_marca_lista_para_despachar.sql`
-- es `cotizacion_enviada`. Las políticas de `avance_seccion` usan esta función,
-- así que con esto la base acepta esa marca de secretaría y de nadie más.
-- `rlsPorRol.test.ts` verifica que las dos copias digan lo mismo.

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
    when 'corte_completado'    then 'corte'
    when 'recogido_bordado'    then 'logistica'
    when 'llegada_marcacion'   then 'marcacion'
    when 'lista_despacho'      then 'terminacion'
    when 'etiquetas'           then 'secretaria'
    when 'documentos_despacho' then 'secretaria'
    when 'factura_generada'    then 'secretaria'
    when 'cerrada'             then 'secretaria'
  end::public.rol
$$;

comment on function public.rol_dueno is
  'HU-17: el rol que puede marcar cada checkpoint. Copia de checkpoints.ts verificada por test.';
