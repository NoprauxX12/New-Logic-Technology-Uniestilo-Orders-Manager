-- HU-01 · Función que registra una orden completa en una sola transacción.
--
-- Guardar una orden toca tres tablas: cliente, orden e item_orden. Hechas como
-- tres llamadas separadas desde la aplicación, un fallo a mitad de camino deja
-- una orden sin prendas. Dentro de una función de Postgres las tres se aplican
-- todas o ninguna.
--
-- Resuelve además la carrera del "buscar o crear cliente": si dos personas
-- registran al mismo cliente nuevo a la vez, el `on conflict` evita el duplicado.
--
-- Se ejecuta con los permisos de quien la llama (SECURITY INVOKER, el valor por
-- defecto), así que respeta las políticas RLS de las tres tablas. No usar
-- SECURITY DEFINER aquí: saltaría RLS y HU-17 perdería el control por rol.

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
-- search_path vacío: obliga a calificar cada tabla con su esquema y evita que
-- alguien redirija la función a tablas suyas.
set search_path = ''
as $$
declare
  v_cliente_id uuid;
  v_orden_id uuid;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe tener al menos una prenda';
  end if;

  -- Cliente: se identifica por NIT. Si ya existe, se reutiliza tal cual está;
  -- no se le sobrescriben los datos con lo que se haya escrito en este
  -- formulario, para no pisar la ficha del cliente sin querer.
  insert into public.cliente (
    nit, razon_social, contacto_nombre, contacto_celular
  )
  values (
    p_nit, p_razon_social, p_contacto_nombre, p_contacto_celular
  )
  on conflict (nit) do nothing
  returning id into v_cliente_id;

  if v_cliente_id is null then
    select id into v_cliente_id from public.cliente where nit = p_nit;
  end if;

  -- Orden. Si el número de orden de compra ya existe, la restricción unique
  -- levanta el error 23505 y toda la transacción se deshace.
  insert into public.orden (
    numero_orden_compra,
    cliente_id,
    fecha_ingreso,
    fecha_entrega,
    observaciones
  )
  values (
    p_numero_orden_compra,
    v_cliente_id,
    p_fecha_ingreso,
    p_fecha_entrega,
    nullif(p_observaciones, '')
  )
  returning id into v_orden_id;

  -- Prendas: una fila por elemento del arreglo JSON que manda el formulario.
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

comment on function public.registrar_orden is
  'HU-01: registra cliente, orden e ítems en una sola transacción. Devuelve el id de la orden.';

-- Quién puede invocarla. `anon` está mientras no exista login (HU-16); se quita
-- junto con las políticas RLS abiertas cuando llegue HU-17.
grant execute on function public.registrar_orden to anon, authenticated;
