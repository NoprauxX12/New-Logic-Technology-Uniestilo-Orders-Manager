-- HU-19 · "Lista para despachar" pasa a ser de terminación.
--
-- Copia de `CHECKPOINTS` en `src/features/workflow/checkpoints.ts`: el único
-- cambio respecto de la versión de `20261005120000_rls_por_rol.sql` es
-- `lista_despacho`, que era de `marcacion`. Las políticas de `avance_seccion`
-- usan esta función, así que con esto la base deja de aceptar esa marca de
-- marcación y la acepta de terminación. `rlsPorRol.test.ts` verifica que las
-- dos copias digan lo mismo.
--
-- Los avances de `lista_despacho` que ya existen quedan como están, firmados por
-- quien los marcó: la bitácora no se reescribe (RNF-05).

create or replace function public.rol_dueno(p_checkpoint public.checkpoint)
returns public.rol
language sql
immutable
set search_path = ''
as $$
  select case p_checkpoint
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
