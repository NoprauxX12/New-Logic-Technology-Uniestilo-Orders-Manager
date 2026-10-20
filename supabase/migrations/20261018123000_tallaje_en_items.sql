-- HU-01 · El tallaje de cada prenda.
--
-- Las tallas se escribían a mano en `item_orden.tallas` ("S:20, M:40, L:30") y
-- nada validaba que fueran tallas reales ni que sumaran la cantidad. Ahora el
-- formulario ofrece los cuatro tallajes de Uniestilo (superior e inferior, de
-- hombre y de dama) y la cantidad de cada talla; la cantidad de la prenda es la
-- suma.
--
-- Lo que se guarda en `tallas` sigue siendo el mismo texto, así que nada de lo
-- que lo lee (el detalle de la orden, el despacho a taller) cambia. Lo único
-- nuevo es de qué tallaje salió: superior e inferior de dama tienen las mismas
-- tallas (2 a 24) y sin esta columna no habría cómo saber cuál se usó.
--
-- Las órdenes que ya existen quedan con `tallaje` vacío y se muestran igual
-- que antes. La lista de tallas de cada tallaje vive en
-- `src/lib/ordenes/tallas.ts`; aquí solo están sus identificadores.

alter table public.item_orden
  add column tallaje text;

alter table public.item_orden
  add constraint item_orden_tallaje_valido
    check (
      tallaje is null
      or tallaje in (
        'superior_hombre',
        'inferior_hombre',
        'superior_dama',
        'inferior_dama',
        'otro'
      )
    );

comment on column public.item_orden.tallaje is
  'HU-01: el tallaje del que salen las tallas (superior/inferior, hombre/dama) u "otro" si se escribieron a mano. Vacío en las órdenes anteriores.';

-- Misma función y misma firma que en 20261005120100; solo se guarda además el
-- tallaje de cada prenda (`create or replace` conserva los permisos).
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
    orden_id, descripcion, cantidad, tallas, tallaje, valor, observaciones
  )
  select
    v_orden_id,
    item->>'descripcion',
    (item->>'cantidad')::integer,
    item->>'tallas',
    nullif(item->>'tallaje', ''),
    (item->>'valor')::numeric,
    nullif(item->>'observaciones', '')
  from jsonb_array_elements(p_items) as item;

  return v_orden_id;
end;
$$;
