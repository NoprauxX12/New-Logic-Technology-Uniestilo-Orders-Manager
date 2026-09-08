-- HU-01 · El cliente se reconoce por el NIT sin importar cómo se escriba.
--
-- El NIT es la llave con la que se decide si una orden va a un cliente que ya
-- existe o crea uno nuevo (ADR 0004). Se guardaba y se comparaba como texto
-- exacto, así que la misma empresa escrita `900.123.456-7` en una orden y
-- `9001234567` en la siguiente quedaba como dos clientes distintos, y sus
-- órdenes repartidas entre los dos.
--
-- Ahora la comparación se hace sobre el NIT normalizado —solo los dígitos—,
-- mientras que la columna sigue guardando lo que escribieron, que es como
-- aparece en los documentos del cliente.
--
-- Fuera de alcance a propósito: separar el dígito de verificación. `900123456`
-- y `900123456-7` siguen siendo dos clientes, porque decidir si el NIT de
-- Uniestilo incluye el DV es una definición del negocio, no del código.

-- ---------------------------------------------------------------------------
-- Normalización
-- ---------------------------------------------------------------------------
-- Es `immutable` porque un índice solo puede construirse sobre una expresión
-- que siempre devuelva lo mismo para la misma entrada. Cambiar esta función
-- después obliga a reconstruir el índice de abajo: el índice guarda los valores
-- que la función devolvía cuando se escribieron las filas.

create or replace function public.nit_normalizado(p_nit text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(p_nit, '[^0-9]', '', 'g')
$$;

comment on function public.nit_normalizado is
  'Deja solo los dígitos del NIT. Es la llave con la que se identifica al cliente.';

-- ---------------------------------------------------------------------------
-- Unicidad del cliente
-- ---------------------------------------------------------------------------
-- El unique de la columna sale sobrando: uno sobre el NIT normalizado ya impide
-- también el duplicado exacto.

alter table public.cliente
  drop constraint cliente_nit_key;

create unique index cliente_nit_unico_idx
  on public.cliente (public.nit_normalizado(nit));

-- ---------------------------------------------------------------------------
-- registrar_orden
-- ---------------------------------------------------------------------------
-- Se vuelve a crear completa (así funciona `create or replace`) con dos cambios
-- respecto a la versión anterior: el `on conflict` y la búsqueda del cliente
-- ahora comparan el NIT normalizado en vez del texto exacto. El resto del
-- cuerpo es igual.

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
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe tener al menos una prenda';
  end if;

  -- Cliente: se identifica por NIT normalizado. Si ya existe, se reutiliza tal
  -- cual está; no se le sobrescriben los datos con lo que se haya escrito en
  -- este formulario, para no pisar la ficha del cliente sin querer.
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

grant execute on function public.nit_normalizado to anon, authenticated;
