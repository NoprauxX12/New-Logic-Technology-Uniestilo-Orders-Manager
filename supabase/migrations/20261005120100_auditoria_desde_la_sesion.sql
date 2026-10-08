-- HU-01 y HU-13 · Quién registró y quién facturó sale de la sesión, no del formulario.
--
-- Dos agujeros de la misma forma:
--
-- - `registrar_orden` nunca escribía `orden.creado_por`: desde HU-01 todas las
--   órdenes quedaban sin quién las registró, cuando la columna existía
--   justamente para eso.
-- - `reportar_factura` recibía `p_usuario_id` del formulario, así que cualquier
--   persona con sesión podía firmar la factura a nombre de otra (RNF-05).
--
-- Las dos funciones toman ahora la persona de `auth.uid()`. Como son SECURITY
-- INVOKER (ADR 0005), las políticas de HU-17 exigen además que ese id sea el de
-- quien inserta y que su rol sea el dueño: aquí solo se deja de pedir el dato.

-- ---------------------------------------------------------------------------
-- registrar_orden: misma firma, escribe creado_por
-- ---------------------------------------------------------------------------

create or replace function public.registrar_orden(
  p_numero_orden_compra text,
  p_nit text,
  p_razon_social text,
  p_contacto_nombre text,
  p_contacto_celular text,
  p_fecha_ingreso date,
  p_fecha_entrega date,
  p_observaciones text,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_cliente_id uuid;
  v_orden_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para registrar una orden'
      using errcode = 'UE006';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe tener al menos una prenda';
  end if;

  insert into public.cliente (
    nit, razon_social, contacto_nombre, contacto_celular
  )
  values (
    p_nit, p_razon_social, p_contacto_nombre, p_contacto_celular
  )
  on conflict (public.nit_normalizado(nit)) do nothing
  returning id into v_cliente_id;

  if v_cliente_id is null then
    select id into v_cliente_id
    from public.cliente
    where public.nit_normalizado(nit) = public.nit_normalizado(p_nit);
  end if;

  insert into public.orden (
    numero_orden_compra,
    cliente_id,
    fecha_ingreso,
    fecha_entrega,
    observaciones,
    creado_por
  )
  values (
    p_numero_orden_compra,
    v_cliente_id,
    p_fecha_ingreso,
    p_fecha_entrega,
    nullif(p_observaciones, ''),
    auth.uid()
  )
  returning id into v_orden_id;

  insert into public.item_orden (
    orden_id, descripcion, cantidad, tallas, valor, observaciones
  )
  select
    v_orden_id,
    item->>'descripcion',
    (item->>'cantidad')::integer,
    item->>'tallas',
    (item->>'valor')::numeric,
    nullif(item->>'observaciones', '')
  from jsonb_array_elements(p_items) as item;

  return v_orden_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reportar_factura: ya no recibe quién reporta
-- ---------------------------------------------------------------------------
-- Cambia la firma, así que no sirve `create or replace`: se borra la vieja.

drop function public.reportar_factura(uuid, text, uuid);

create function public.reportar_factura(
  p_orden_id uuid,
  p_numero_factura text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_avance_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para reportar la factura'
      using errcode = 'UE006';
  end if;

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
    auth.uid(),
    'Factura ' || trim(p_numero_factura)
  )
  returning id into v_avance_id;

  return v_avance_id;
end;
$$;

comment on function public.reportar_factura is
  'HU-13: guarda el número de la factura externa en la orden y marca factura_generada a nombre de quien tiene la sesión.';

revoke execute on function public.reportar_factura from public, anon;
grant execute on function public.reportar_factura to authenticated;
