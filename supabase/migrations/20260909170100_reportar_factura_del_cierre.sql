-- HU-13 · Reportar la factura generada en el sistema externo.
--
-- El sistema no factura (regla 8 del dominio): solo registra que la factura se
-- emitió y guarda su número, que es la columna `numero_factura` que HU-01 dejó
-- creada en `orden` justamente para este momento.
--
-- Escribe en dos tablas —el número en `orden` y la marca en `avance_seccion`—,
-- así que va en una función de Postgres y no en dos llamadas desde la
-- aplicación (ADR 0005): o quedan las dos, o no queda ninguna.
--
-- Los otros dos reportes del cierre (etiquetas y documentos de despacho) son
-- una sola inserción en `avance_seccion`, así que los hace la action.

-- ---------------------------------------------------------------------------
-- Permiso para escribir el número de factura
-- ---------------------------------------------------------------------------
-- `orden` no tenía política de update: una orden registrada no se edita. El
-- cierre es la excepción, y solo sobre una columna. Como las políticas RLS no
-- distinguen columnas pero los permisos sí, se quita el update sobre la tabla
-- entera y se concede únicamente sobre `numero_factura`.
--
-- Cuando otra historia necesite escribir su propia columna (HU-03 con
-- `numero_orden_programacion`, por ejemplo) tendrá que sumar su propio grant.
--
-- La política es temporal y abierta como el resto del esquema; HU-17 la cierra
-- para que solo la secretaria pueda hacerlo.

revoke update on public.orden from anon, authenticated;

grant update (numero_factura) on public.orden to anon, authenticated;

create policy "temporal HU-17: orden numero de factura"
  on public.orden for update to anon, authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- reportar_factura
-- ---------------------------------------------------------------------------
-- Como el resto de funciones del proyecto: SECURITY INVOKER, para que respete
-- las políticas RLS, y search_path vacío con cada tabla calificada.

create or replace function public.reportar_factura(
  p_orden_id uuid,
  p_numero_factura text,
  p_usuario_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_avance_id uuid;
begin
  update public.orden
  set numero_factura = trim(p_numero_factura)
  where id = p_orden_id;

  if not found then
    raise exception 'La orden indicada no existe'
      using errcode = 'UE005';
  end if;

  insert into public.avance_seccion (
    orden_id, checkpoint, usuario_id, observaciones
  )
  values (
    p_orden_id,
    'factura_generada',
    p_usuario_id,
    'Factura ' || trim(p_numero_factura)
  )
  returning id into v_avance_id;

  return v_avance_id;
end;
$$;

comment on function public.reportar_factura is
  'HU-13: guarda el número de la factura externa en la orden y marca la etapa de factura generada.';

grant execute on function public.reportar_factura to anon, authenticated;
