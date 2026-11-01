-- Editar una orden hasta «cotización aprobada», inclusive. Solo administración.
--
-- Hasta hoy una orden registrada no se podía editar: las correcciones eran una
-- orden nueva (HU-18). Ahora administración puede corregir lo capturado en el
-- registro (HU-01) mientras la orden no haya pasado a diseño: mientras no tenga
-- un avance VIGENTE de `programada_diseno` ni de una etapa posterior. Si una
-- devolución (HU-18) anuló esos avances, vuelve a ser editable. Ver `docs/adr/0012`.
--
-- La regla vive aquí, no en la aplicación: nadie tiene permiso directo para
-- cambiar esos datos, ni siquiera administración. La única vía es la función
-- `editar_orden`, que verifica rol y estado y deja el rastro en `edicion_orden`.
-- Así una llamada directa a la API tampoco se salta el rastro.

-- ---------------------------------------------------------------------------
-- 1. edicion_orden: quién cambió qué y cuándo (RNF-05)
-- ---------------------------------------------------------------------------

create table public.edicion_orden (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),

  -- Solo lo que cambió, con su valor de antes y de después:
  --   {"orden":   {"fecha_entrega": {"antes": "...", "despues": "..."}},
  --    "cliente": {"nit": {...}},
  --    "prendas": {"agregadas": [...], "quitadas": [...], "cambiadas": [...]}}
  cambios jsonb not null,

  -- Quién lo hizo: sale de la sesión, nunca de un parámetro (regla 6).
  creado_por uuid not null default auth.uid() references public.usuario (id),
  creado_en timestamptz not null default now(),

  constraint edicion_orden_con_cambios
    check (jsonb_typeof(cambios) = 'object' and cambios <> '{}'::jsonb)
);

create index edicion_orden_orden_id_idx on public.edicion_orden (orden_id);

comment on table public.edicion_orden is
  'Rastro de las ediciones de una orden. Inmutable: sin update ni delete, y sin insert directo (solo editar_orden).';

alter table public.edicion_orden enable row level security;

create policy "lectura con sesion" on public.edicion_orden
  for select to authenticated using (public.rol_actual() is not null);

revoke all on public.edicion_orden from anon, authenticated;
grant select on public.edicion_orden to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nadie toca directo los datos del registro
-- ---------------------------------------------------------------------------
-- `orden` e `item_orden` ya solo dejaban actualizar columnas de otras etapas
-- (`numero_factura` y la tela), que siguen igual. Lo que faltaba era el INSERT
-- de prendas: administración podía agregarle prendas por la API a cualquier
-- orden, también a una ya en producción o cerrada, y sin rastro. Se quita y las
-- dos funciones que crean órdenes pasan a escribir con los permisos de su dueño.
--
-- Los DELETE y el UPDATE de `cliente` no tenían política, así que RLS ya los
-- filtraba en silencio. Sin el permiso, se rechazan de frente.

drop policy "admin registra prendas" on public.item_orden;

revoke insert, delete on public.item_orden from authenticated;
revoke delete on public.orden from authenticated;
revoke update, delete on public.cliente from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Las funciones que crean órdenes siguen siendo la vía para las prendas
-- ---------------------------------------------------------------------------
-- Excepción al ADR 0005, como `programar_ordenes_a_diseno`: sin permiso de
-- INSERT sobre las prendas, SECURITY INVOKER ya no alcanza. Por eso cada una
-- hace ella misma lo que hacía RLS: exigir sesión y rol de administración.

-- Mismo cuerpo que en 20261018123000; se agregan la barrera de rol, con el mismo
-- código que devolvía RLS, y SECURITY DEFINER.
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
security definer
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

  if public.rol_actual() is distinct from 'admin'::public.rol then
    raise exception 'Las órdenes las registra administración'
      using errcode = '42501';
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

-- Esta ya exige sesión y rol en su cuerpo (20261021100100).
alter function public.crear_orden_de_correccion(uuid, date, text, public.checkpoint, jsonb)
  security definer;

-- ---------------------------------------------------------------------------
-- 4. campos_cambiados
-- ---------------------------------------------------------------------------

create function public.campos_cambiados(p_antes jsonb, p_despues jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      campo,
      jsonb_build_object('antes', p_antes -> campo, 'despues', p_despues -> campo)
    ),
    '{}'::jsonb
  )
  from jsonb_object_keys(p_despues) as campo
  where p_antes -> campo is distinct from p_despues -> campo
$$;

comment on function public.campos_cambiados is
  'Los campos de p_despues cuyo valor difiere de p_antes, con su valor de antes y de después.';

revoke execute on function public.campos_cambiados(jsonb, jsonb) from public, anon;
grant execute on function public.campos_cambiados(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. editar_orden
-- ---------------------------------------------------------------------------
-- Devuelve si hubo algo que cambiar: sin cambios no deja rastro.
--
-- Prendas (`p_items`): la lista completa como debe quedar. Con `id` se actualiza
-- esa prenda (conserva la tela si ya la tenía), sin `id` se crea, y la que no
-- venga se borra.
--
-- Cliente: `cliente` es una tabla compartida entre órdenes, y una orden no puede
-- cambiar en silencio las demás.
--   - NIT distinto: la orden pasa al cliente de ese NIT, y se crea si no existe.
--     Si ya existe, conserva sus datos (igual que al registrar); nunca se tocan.
--   - Mismo NIT y otros datos: se actualiza el cliente solo si esta es su única
--     orden. Si tiene más, se rechaza (UE017).
--
-- `for update` sobre la orden serializa contra lo que la haría pasar de etapa:
-- marcar un avance toma un candado sobre la orden al validar su llave foránea, y
-- programarla la actualiza. Por eso el estado se lee después del candado.
--
-- SECURITY DEFINER, como `programar_ordenes_a_diseno`: es la única vía para
-- escribir estos datos. Las barreras de rol y de estado son las de abajo.

create function public.editar_orden(
  p_orden_id uuid,
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
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero text := trim(coalesce(p_numero_orden_compra, ''));
  v_nit text := trim(coalesce(p_nit, ''));
  v_razon_social text := trim(coalesce(p_razon_social, ''));
  v_contacto_nombre text := trim(coalesce(p_contacto_nombre, ''));
  v_contacto_celular text := trim(coalesce(p_contacto_celular, ''));
  v_observaciones text := nullif(trim(coalesce(p_observaciones, '')), '');
  v_orden public.orden%rowtype;
  v_cliente public.cliente%rowtype;
  v_cliente_id uuid;
  v_orden_antes jsonb;
  v_cliente_antes jsonb;
  v_prendas_antes jsonb;
  v_prendas_despues jsonb;
  v_diferencia jsonb;
  v_agregadas jsonb;
  v_quitadas jsonb;
  v_cambiadas jsonb;
  v_cambios jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa'
      using errcode = 'UE006';
  end if;

  if public.rol_actual() is distinct from 'admin'::public.rol then
    raise exception 'Editar una orden lo hace administración'
      using errcode = 'UE007';
  end if;

  select * into v_orden
  from public.orden
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden indicada no existe'
      using errcode = 'UE005';
  end if;

  if exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint = 'cerrada'
      and anulado_por is null
  ) then
    raise exception 'La orden ya está cerrada y no se puede editar'
      using errcode = 'UE004';
  end if;

  -- El orden del enum es el del flujo. Una corrección que entra después de
  -- diseño ya pasó por ahí, aunque todavía no tenga ningún avance.
  if v_orden.etapa_inicial > 'programada_diseno'::public.checkpoint or exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint >= 'programada_diseno'::public.checkpoint
      and anulado_por is null
  ) then
    raise exception 'La orden ya pasó a diseño y no se puede editar'
      using errcode = 'UE016';
  end if;

  -- Lo mismo que valida el esquema de la aplicación y que un `check` no cubre.
  if length(v_numero) not between 1 and 50
     or length(v_nit) > 20
     or length(public.nit_normalizado(v_nit)) < 5
     or length(v_razon_social) not between 1 and 200
     or length(v_contacto_nombre) not between 1 and 150
     or length(v_contacto_celular) not between 7 and 20
     or length(coalesce(v_observaciones, '')) > 2000
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Revisa los datos de la orden: falta alguno o no es válido'
      using errcode = 'UE010';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(
      descripcion text, tallas text, observaciones text
    )
    where length(trim(coalesce(x.descripcion, ''))) not between 1 and 300
       or length(trim(coalesce(x.tallas, ''))) not between 1 and 300
       or length(trim(coalesce(x.observaciones, ''))) > 1000
  ) then
    raise exception 'Revisa las prendas: falta algún dato o no es válido'
      using errcode = 'UE010';
  end if;

  if (
    select count(x.id) <> count(distinct x.id)
    from jsonb_to_recordset(p_items) as x(id uuid)
  ) or exists (
    select 1
    from jsonb_to_recordset(p_items) as x(id uuid)
    where x.id is not null
      and not exists (
        select 1
        from public.item_orden i
        where i.id = x.id and i.orden_id = p_orden_id
      )
  ) then
    raise exception 'Hay prendas repetidas o que no son de esta orden'
      using errcode = 'UE013';
  end if;

  v_orden_antes := jsonb_build_object(
    'numero_orden_compra', v_orden.numero_orden_compra,
    'fecha_ingreso', v_orden.fecha_ingreso,
    'fecha_entrega', v_orden.fecha_entrega,
    'observaciones', v_orden.observaciones
  );

  select coalesce(
    jsonb_object_agg(i.id, jsonb_build_object(
      'descripcion', i.descripcion,
      'cantidad', i.cantidad,
      'tallas', i.tallas,
      'tallaje', i.tallaje,
      'valor', i.valor,
      'observaciones', i.observaciones
    )),
    '{}'::jsonb
  ) into v_prendas_antes
  from public.item_orden i
  where i.orden_id = p_orden_id;

  -- -------------------------------------------------------------------------
  -- Cliente
  -- -------------------------------------------------------------------------

  select * into v_cliente
  from public.cliente
  where id = v_orden.cliente_id
  for update;

  v_cliente_antes := jsonb_build_object(
    'nit', v_cliente.nit,
    'razon_social', v_cliente.razon_social,
    'contacto_nombre', v_cliente.contacto_nombre,
    'contacto_celular', v_cliente.contacto_celular
  );

  v_cliente_id := v_cliente.id;

  if public.nit_normalizado(v_nit) <> public.nit_normalizado(v_cliente.nit) then
    v_cliente_id := null;

    insert into public.cliente (
      nit, razon_social, contacto_nombre, contacto_celular
    )
    values (
      v_nit, v_razon_social, v_contacto_nombre, v_contacto_celular
    )
    on conflict (public.nit_normalizado(nit)) do nothing
    returning id into v_cliente_id;

    if v_cliente_id is null then
      select id into v_cliente_id
      from public.cliente
      where public.nit_normalizado(nit) = public.nit_normalizado(v_nit);
    end if;
  elsif not exists (
    select 1
    from public.orden
    where cliente_id = v_cliente.id
      and id <> p_orden_id
  ) then
    update public.cliente
    set nit = v_nit,
        razon_social = v_razon_social,
        contacto_nombre = v_contacto_nombre,
        contacto_celular = v_contacto_celular
    where id = v_cliente.id;
  elsif (v_razon_social, v_contacto_nombre, v_contacto_celular)
        is distinct from
        (v_cliente.razon_social, v_cliente.contacto_nombre, v_cliente.contacto_celular) then
    raise exception 'Este cliente tiene otras órdenes: sus datos no se cambian desde una sola orden'
      using errcode = 'UE017';
  end if;

  -- -------------------------------------------------------------------------
  -- Orden
  -- -------------------------------------------------------------------------

  update public.orden
  set numero_orden_compra = v_numero,
      cliente_id = v_cliente_id,
      fecha_ingreso = p_fecha_ingreso,
      fecha_entrega = p_fecha_entrega,
      observaciones = v_observaciones
  where id = p_orden_id
  returning * into v_orden;

  -- -------------------------------------------------------------------------
  -- Prendas
  -- -------------------------------------------------------------------------

  delete from public.item_orden i
  where i.orden_id = p_orden_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_items) as x(id uuid)
      where x.id = i.id
    );

  -- Las prendas anteriores al tallaje lo tienen vacío y el formulario las
  -- muestra como «otro»: guardarlas sin tocar no es un cambio.
  update public.item_orden i
  set descripcion = trim(x.descripcion),
      cantidad = x.cantidad,
      tallas = trim(x.tallas),
      tallaje = case
        when i.tallaje is null and x.tallaje = 'otro' then null
        else nullif(x.tallaje, '')
      end,
      valor = x.valor,
      observaciones = nullif(trim(coalesce(x.observaciones, '')), '')
  from jsonb_to_recordset(p_items) as x(
    id uuid,
    descripcion text,
    cantidad integer,
    tallas text,
    tallaje text,
    valor numeric,
    observaciones text
  )
  where i.id = x.id;

  insert into public.item_orden (
    orden_id, descripcion, cantidad, tallas, tallaje, valor, observaciones
  )
  select
    p_orden_id,
    trim(x.descripcion),
    x.cantidad,
    trim(x.tallas),
    nullif(x.tallaje, ''),
    x.valor,
    nullif(trim(coalesce(x.observaciones, '')), '')
  from jsonb_to_recordset(p_items) as x(
    id uuid,
    descripcion text,
    cantidad integer,
    tallas text,
    tallaje text,
    valor numeric,
    observaciones text
  )
  where x.id is null;

  -- -------------------------------------------------------------------------
  -- Rastro: solo lo que de verdad cambió
  -- -------------------------------------------------------------------------

  v_diferencia := public.campos_cambiados(v_orden_antes, jsonb_build_object(
    'numero_orden_compra', v_orden.numero_orden_compra,
    'fecha_ingreso', v_orden.fecha_ingreso,
    'fecha_entrega', v_orden.fecha_entrega,
    'observaciones', v_orden.observaciones
  ));

  if v_diferencia <> '{}'::jsonb then
    v_cambios := v_cambios || jsonb_build_object('orden', v_diferencia);
  end if;

  select * into v_cliente
  from public.cliente
  where id = v_cliente_id;

  v_diferencia := public.campos_cambiados(v_cliente_antes, jsonb_build_object(
    'nit', v_cliente.nit,
    'razon_social', v_cliente.razon_social,
    'contacto_nombre', v_cliente.contacto_nombre,
    'contacto_celular', v_cliente.contacto_celular
  ));

  if v_diferencia <> '{}'::jsonb then
    v_cambios := v_cambios || jsonb_build_object('cliente', v_diferencia);
  end if;

  select coalesce(
    jsonb_object_agg(i.id, jsonb_build_object(
      'descripcion', i.descripcion,
      'cantidad', i.cantidad,
      'tallas', i.tallas,
      'tallaje', i.tallaje,
      'valor', i.valor,
      'observaciones', i.observaciones
    )),
    '{}'::jsonb
  ) into v_prendas_despues
  from public.item_orden i
  where i.orden_id = p_orden_id;

  select coalesce(jsonb_agg(despues.value), '[]'::jsonb) into v_agregadas
  from jsonb_each(v_prendas_despues) as despues
  where not v_prendas_antes ? despues.key;

  select coalesce(jsonb_agg(antes.value), '[]'::jsonb) into v_quitadas
  from jsonb_each(v_prendas_antes) as antes
  where not v_prendas_despues ? antes.key;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', antes.key,
      'descripcion', antes.value -> 'descripcion',
      'campos', public.campos_cambiados(antes.value, despues.value)
    )),
    '[]'::jsonb
  ) into v_cambiadas
  from jsonb_each(v_prendas_antes) as antes
  join jsonb_each(v_prendas_despues) as despues on despues.key = antes.key
  where antes.value <> despues.value;

  if v_agregadas <> '[]'::jsonb
     or v_quitadas <> '[]'::jsonb
     or v_cambiadas <> '[]'::jsonb then
    v_cambios := v_cambios || jsonb_build_object('prendas', jsonb_build_object(
      'agregadas', v_agregadas,
      'quitadas', v_quitadas,
      'cambiadas', v_cambiadas
    ));
  end if;

  if v_cambios = '{}'::jsonb then
    return false;
  end if;

  insert into public.edicion_orden (orden_id, cambios)
  values (p_orden_id, v_cambios);

  return true;
end;
$$;

comment on function public.editar_orden is
  'Corrige los datos del registro de una orden que aún no pasa a diseño y deja el rastro en edicion_orden. Solo administración.';

revoke execute on function public.editar_orden(
  uuid, text, text, text, text, text, date, date, text, jsonb
) from public, anon;

grant execute on function public.editar_orden(
  uuid, text, text, text, text, text, date, date, text, jsonb
) to authenticated;
