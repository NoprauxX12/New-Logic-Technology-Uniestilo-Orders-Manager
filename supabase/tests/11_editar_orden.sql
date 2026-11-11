-- Editar una orden hasta «cotización aprobada», inclusive (docs/adr/0012).
--
-- Solo admin; se editan los datos del registro y las prendas; una devolución la
-- reactiva; nadie escribe esos datos directo por la API; cada edición deja
-- rastro; y lo que escribe en esas tablas más adelante sigue funcionando.

begin;
create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Ayudas (viven solo en esta transacción, en pg_temp; cada archivo trae las suyas)
-- ---------------------------------------------------------------------------
-- Quién actúa: 'anon', 'postgres' (sin restricciones, para armar los datos) o
-- el sufijo del usuario: 'a1'..'a7' son los del seed (admin, secretaria,
-- diseno, corte, logistica, marcacion, terminacion) y 'b1'.. los que crea cada
-- archivo. El claim `sub` hace que auth.uid() devuelva ese usuario.

create function pg_temp.como(p_quien text) returns void language plpgsql as $$
begin
  if p_quien = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  elsif p_quien = 'postgres' then
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', ('00000000-0000-0000-0000-0000000000' || p_quien)::uuid,
        'role', 'authenticated'
      )::text,
      true
    );
    execute 'set local role authenticated';
  end if;
end $$;

-- Ejecuta una sentencia como `p_quien` y devuelve 'ok:<filas>' o el SQLSTATE
-- del error. Un error no aborta la transacción del archivo. Una escritura que
-- la RLS filtra en silencio devuelve 'ok:0'.
create function pg_temp.intenta(p_quien text, p_sql text) returns text
language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.como(p_quien);
  begin
    if p_sql ~* '^\s*(select|with)' then
      execute 'select count(*) from (' || p_sql || ') q' into n;
    else
      execute p_sql;
      get diagnostics n = row_count;
    end if;
  exception when others then
    perform pg_temp.como('postgres');
    return sqlstate;
  end;
  perform pg_temp.como('postgres');
  return 'ok:' || n;
end $$;

-- Evalúa una consulta de un solo valor (p. ej. llamar a una función) como
-- `p_quien`: devuelve el valor como texto, o 'ERR:<sqlstate>' si falla.
create function pg_temp.valor(p_quien text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_quien);
  begin
    execute p_sql into v;
  exception when others then
    perform pg_temp.como('postgres');
    return 'ERR:' || sqlstate;
  end;
  perform pg_temp.como('postgres');
  return v;
end $$;

-- El mensaje de error (o null si no falló) de una sentencia.
create function pg_temp.mensaje(p_quien text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_quien);
  begin
    execute p_sql into v;
  exception when others then
    perform pg_temp.como('postgres');
    return sqlerrm;
  end;
  perform pg_temp.como('postgres');
  return null;
end $$;

-- Cuenta + perfil de una persona de prueba. Corre como postgres.
create function pg_temp.crear_usuario(
  p_sufijo text, p_rol public.rol, p_activo boolean default true
) returns void language plpgsql as $$
declare v_id uuid := ('00000000-0000-0000-0000-0000000000' || p_sufijo)::uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_sufijo || '@prueba.test', now(), now(), now(), '{}', '{}', '', '', '', ''
  );
  insert into public.usuario (id, nombre, email, rol, activo)
  values (v_id, 'Prueba ' || p_sufijo, p_sufijo || '@prueba.test', p_rol, p_activo);
end $$;

-- Un avance firmado por quien corresponde, sin pasar por RLS (arma el escenario).
create function pg_temp.avance(
  p_orden uuid, p_checkpoint public.checkpoint, p_firma text default null
) returns void language plpgsql as $$
begin
  insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
  values (
    p_orden, p_checkpoint,
    ('00000000-0000-0000-0000-0000000000' || coalesce(p_firma, case public.rol_dueno(p_checkpoint)
       when 'secretaria' then 'a2' when 'diseno' then 'a3' when 'corte' then 'a4'
       when 'logistica' then 'a5' when 'marcacion' then 'a6' when 'terminacion' then 'a7'
       else 'a1' end))::uuid
  );
end $$;

-- Cuántas filas tiene la tabla sin ninguna restricción (para comparar lo que ve cada rol).
create function pg_temp.total(p_tabla text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I', p_tabla) into n;
  return n;
end $$;

-- Id fijo y legible para las filas que crea cada archivo.
create function pg_temp.id(p_n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000' || lpad(p_n::text, 4, '0'))::uuid
$$;

select pg_temp.crear_usuario('b2', 'admin', false);
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b3',
  'authenticated', 'authenticated', 'b3@prueba.test', now(), now(), now(),
  '{}', '{}', '', '', '', ''
);

-- Una orden n con su propio cliente (el id n + 5000) y una prenda (el id n + 1000).
create function pg_temp.orden(p_n int) returns uuid language plpgsql as $$
begin
  insert into public.cliente (id, nit, razon_social, contacto_nombre, contacto_celular)
  values (pg_temp.id(p_n + 5000), '7' || lpad(p_n::text, 9, '0'), 'Cliente ' || p_n, 'Contacto', '3000000000');
  insert into public.orden (id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
  values (pg_temp.id(p_n), 'ED-' || p_n, pg_temp.id(p_n + 5000), current_date, current_date + 30,
          '00000000-0000-0000-0000-0000000000a1');
  insert into public.item_orden (id, orden_id, descripcion, cantidad, tallas, tallaje, valor)
  values (pg_temp.id(p_n + 1000), pg_temp.id(p_n), 'Camisa', 10, 'M:10', 'otro', 1000);
  return pg_temp.id(p_n);
end $$;

-- Los avances de la orden n hasta la etapa dada, inclusive, en el orden del flujo.
create function pg_temp.avanzar(p_n int, p_hasta public.checkpoint) returns void language plpgsql as $$
declare e public.checkpoint;
begin
  foreach e in array enum_range(null::public.checkpoint) loop
    exit when e > p_hasta;
    perform pg_temp.avance(pg_temp.id(p_n), e);
  end loop;
end $$;

-- La prenda de `pg_temp.orden`, como la manda el formulario sin cambios.
create function pg_temp.prenda(p_n int, p_campos jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', pg_temp.id(p_n + 1000), 'descripcion', 'Camisa', 'cantidad', 10,
    'tallas', 'M:10', 'tallaje', 'otro', 'valor', 1000
  ) || p_campos
$$;

-- La llamada a `editar_orden` con los datos de `pg_temp.orden`, salvo lo que
-- venga en `p_campos` (claves: numero, nit, razon, contacto, celular, ingreso,
-- entrega, observaciones, items).
create function pg_temp.llamada(p_n int, p_campos jsonb default '{}') returns text language sql as $$
  with d as (
    select jsonb_build_object(
      'numero', 'ED-' || p_n,
      'nit', '7' || lpad(p_n::text, 9, '0'),
      'razon', 'Cliente ' || p_n,
      'contacto', 'Contacto',
      'celular', '3000000000',
      'ingreso', current_date,
      'entrega', current_date + 30,
      'observaciones', null,
      'items', jsonb_build_array(pg_temp.prenda(p_n))
    ) || p_campos as c
  )
  select format(
    'select public.editar_orden(%L::uuid, %L, %L, %L, %L, %L, %L::date, %L::date, %L, %L::jsonb)::text',
    pg_temp.id(p_n), c->>'numero', c->>'nit', c->>'razon', c->>'contacto', c->>'celular',
    c->>'ingreso', c->>'entrega', c->>'observaciones', c->>'items'
  )
  from d
$$;

create function pg_temp.ediciones(p_n int) returns int language sql as $$
  select count(*)::int from public.edicion_orden where orden_id = pg_temp.id(p_n)
$$;

select plan(183);

-- ---------------------------------------------------------------------------
-- Admin sí, hasta cotización aprobada inclusive
-- ---------------------------------------------------------------------------

select pg_temp.orden(1);

select is(
  pg_temp.valor('a1', pg_temp.llamada(1, jsonb_build_object('entrega', current_date + 40))),
  'true',
  'admin edita una orden recién registrada'
);

select is(
  (select fecha_entrega from public.orden where id = pg_temp.id(1)),
  current_date + 40,
  'la edición quedó guardada'
);

select is(pg_temp.ediciones(1), 1, 'la edición deja una fila de rastro');

select is(
  (select creado_por::text from public.edicion_orden where orden_id = pg_temp.id(1)),
  '00000000-0000-0000-0000-0000000000a1',
  'el rastro dice quién: la persona de la sesión'
);

select is(
  (select cambios from public.edicion_orden where orden_id = pg_temp.id(1)),
  jsonb_build_object('orden', jsonb_build_object('fecha_entrega', jsonb_build_object(
    'antes', current_date + 30, 'despues', current_date + 40))),
  'el rastro dice qué: solo lo que cambió, con su valor de antes y de después'
);

select ok(
  (select creado_en is not null from public.edicion_orden where orden_id = pg_temp.id(1)),
  'el rastro dice cuándo'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(1, jsonb_build_object('entrega', current_date + 40))),
  'false',
  'guardar sin cambiar nada no es una edición'
);

select is(pg_temp.ediciones(1), 1, 'y no deja rastro');

select pg_temp.orden(2);
select pg_temp.avanzar(2, 'cotizacion_enviada');
select is(
  pg_temp.valor('a1', pg_temp.llamada(2, '{"observaciones":"Con cotización enviada"}')),
  'true',
  'con la cotización enviada se puede editar'
);

select pg_temp.orden(3);
select pg_temp.avanzar(3, 'cotizacion_aprobada');
select is(
  pg_temp.valor('a1', pg_temp.llamada(3, '{"observaciones":"Con cotización aprobada"}')),
  'true',
  'con la cotización aprobada todavía se puede editar'
);

-- ---------------------------------------------------------------------------
-- Admin no, desde que pasa a diseño
-- ---------------------------------------------------------------------------

create temp table etapas_posteriores as
select e, 100 + row_number() over (order by e) as n
from unnest(enum_range('programada_diseno'::public.checkpoint, null)) as e;

select pg_temp.orden(n::int), pg_temp.avanzar(n::int, e) from etapas_posteriores;

select is(
  pg_temp.valor('a1', pg_temp.llamada(n::int, '{"observaciones":"No debe quedar"}')),
  case when e = 'cerrada' then 'ERR:UE004' else 'ERR:UE016' end,
  format('con «%s» admin ya no edita', e)
)
from etapas_posteriores
order by e;

select is(
  (select count(*)::int from public.orden o join etapas_posteriores t on o.id = pg_temp.id(t.n::int)
    where o.observaciones is not null),
  0,
  'ninguno de esos intentos cambió la orden'
);

select is(
  (select count(*)::int from public.edicion_orden r join etapas_posteriores t on r.orden_id = pg_temp.id(t.n::int)),
  0,
  'ni dejó rastro'
);

-- Basta un avance vigente de una etapa posterior, aunque falten los anteriores
-- (las órdenes viejas pasaron de largo etapas que aún no se marcaban).
select pg_temp.orden(4);
select pg_temp.avance(pg_temp.id(4), 'corte_completado');
select is(
  pg_temp.valor('a1', pg_temp.llamada(4, '{"observaciones":"x"}')),
  'ERR:UE016',
  'un solo avance posterior ya la vuelve no editable'
);

-- ---------------------------------------------------------------------------
-- Otro rol, nunca
-- ---------------------------------------------------------------------------

select pg_temp.orden(5);

select is(
  pg_temp.valor(r.sufijo, pg_temp.llamada(5, '{"observaciones":"No debe quedar"}')),
  'ERR:UE007',
  format('%s no edita órdenes', r.rol)
)
from (values
  ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'),
  ('b2', 'un admin desactivado'), ('b3', 'quien tiene sesión pero no perfil')
) as r(sufijo, rol);

select is(
  pg_temp.valor('anon', pg_temp.llamada(5, '{"observaciones":"No debe quedar"}')),
  'ERR:42501',
  'anon no puede ejecutar la función'
);

select is(
  pg_temp.valor('postgres', pg_temp.llamada(5, '{"observaciones":"No debe quedar"}')),
  'ERR:UE006',
  'sin sesión la función se niega'
);

select is(
  (select observaciones from public.orden where id = pg_temp.id(5)),
  null,
  'ninguno de esos intentos cambió la orden'
);

-- ---------------------------------------------------------------------------
-- Directo a la API: nadie, ni admin, ni con la orden todavía editable
-- ---------------------------------------------------------------------------

create temp table quienes as
select * from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol);

select is(
  pg_temp.intenta(q.sufijo, format(s.sentencia, pg_temp.id(5))),
  '42501',
  format('%s no puede: %s', q.rol, s.nombre)
)
from quienes q
cross join (values
  ('cambiar los datos de la orden', 'update public.orden set fecha_entrega = current_date + 99, observaciones = ''x'' where id = %L'),
  ('cambiar el número de la orden', 'update public.orden set numero_orden_compra = ''ROBADO'' where id = %L'),
  ('cambiar el cliente de la orden', 'update public.orden set cliente_id = ''00000000-0000-0000-0000-0000000000c2'' where id = %L'),
  ('borrar la orden', 'delete from public.orden where id = %L'),
  ('agregar una prenda', $s$insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor) values (%L, 'Extra', 1, 'M:1', 10)$s$),
  ('borrar las prendas', 'delete from public.item_orden where orden_id = %L'),
  ('cambiar una prenda', 'update public.item_orden set cantidad = 99, valor = 1, descripcion = ''x'' where orden_id = %L'),
  ('editar el cliente', 'update public.cliente set razon_social = ''x'' where id in (select cliente_id from public.orden where id = %L)'),
  ('borrar el cliente', 'delete from public.cliente where id in (select cliente_id from public.orden where id = %L)'),
  ('escribir en el rastro', $s$insert into public.edicion_orden (orden_id, cambios) values (%L, '{"a":1}')$s$),
  ('reescribir el rastro', 'update public.edicion_orden set cambios = ''{"a":1}'' where orden_id = %L'),
  ('borrar el rastro', 'delete from public.edicion_orden where orden_id = %L')
) as s(nombre, sentencia);

-- Y con la orden ya en producción, igual.
select is(
  pg_temp.intenta('a1', format($s$insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor) values (%L, 'Extra', 1, 'M:1', 10)$s$, pg_temp.id(4))),
  '42501',
  'admin no le agrega prendas a una orden en producción'
);

select is(
  (select count(*)::int from public.item_orden where orden_id = pg_temp.id(5)),
  1,
  'la orden sigue con su única prenda'
);

select is(
  (select fecha_entrega from public.orden where id = pg_temp.id(5)),
  current_date + 30,
  'y con su fecha de entrega'
);

-- Las columnas de la tela, con la política de secretaría, no le sirven a admin.
select is(
  pg_temp.intenta('a1', format('update public.item_orden set cantidad_tela = 5 where orden_id = %L', pg_temp.id(5))),
  'ok:0',
  'admin no escribe la tela de una prenda'
);

select ok(
  pg_temp.intenta('a3', 'select 1 from public.edicion_orden') ~ '^ok:[1-9]',
  'quien tiene sesión puede leer el rastro'
);

select is(
  pg_temp.intenta('anon', 'select 1 from public.edicion_orden'),
  '42501',
  'anon no lee el rastro'
);

select is(
  pg_temp.intenta('b2', 'select 1 from public.edicion_orden'),
  'ok:0',
  'una cuenta desactivada no lee el rastro'
);

-- ---------------------------------------------------------------------------
-- Una devolución la reactiva
-- ---------------------------------------------------------------------------

select pg_temp.orden(6);
select pg_temp.avanzar(6, 'corte_completado');

update public.item_orden
set tipo_tela = 'Algodón', cantidad_tela = 12, unidad_tela = 'metros'
where id = pg_temp.id(1006);

select is(
  pg_temp.valor('a1', pg_temp.llamada(6, '{"observaciones":"Antes de devolver"}')),
  'ERR:UE016',
  'en producción no se edita'
);

select ok(
  pg_temp.valor('a1', format($q$select public.devolver_orden_a_etapa(%L, 'ficha_adjunta', 'Faltó un detalle')::text$q$, pg_temp.id(6))) ~ '^[0-9a-f-]{36}$',
  'admin la devuelve a la ficha técnica'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(6, '{"observaciones":"Devuelta a ficha"}')),
  'ERR:UE016',
  'sigue sin poder editarse: la programación a diseño sigue vigente'
);

select ok(
  pg_temp.valor('a1', format($q$select public.devolver_orden_a_etapa(%L, 'programada_diseno', 'Hay que corregir el pedido')::text$q$, pg_temp.id(6))) ~ '^[0-9a-f-]{36}$',
  'admin la devuelve a la programación a diseño'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(6, jsonb_build_object(
    'observaciones', 'Devuelta a programación',
    'items', jsonb_build_array(pg_temp.prenda(6, '{"cantidad":15,"tallas":"M:15"}'))
  ))),
  'true',
  'con esos avances anulados vuelve a ser editable'
);

select is(
  (select array[cantidad::text, tipo_tela, cantidad_tela::text, unidad_tela]
     from public.item_orden where id = pg_temp.id(1006)),
  array['15', 'Algodón', '12.00', 'metros'],
  'editar una prenda conserva la tela que ya tenía'
);

select pg_temp.avance(pg_temp.id(6), 'programada_diseno');
select is(
  pg_temp.valor('a1', pg_temp.llamada(6, '{"observaciones":"Otra vez"}')),
  'ERR:UE016',
  'al volver a pasar a diseño deja de ser editable'
);

select is(
  (select count(*)::int from public.avance_seccion where orden_id = pg_temp.id(6)),
  8,
  'la edición no tocó la bitácora: siguen los 7 avances de antes (con insumos, HU-23) y el nuevo'
);

-- ---------------------------------------------------------------------------
-- Lo que escribe en esas tablas más adelante sigue funcionando
-- ---------------------------------------------------------------------------

select pg_temp.orden(7);
select pg_temp.avanzar(7, 'cotizacion_aprobada');

select ok(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(array[%L::uuid])::text', pg_temp.id(7))) ~ '^[0-9]+$',
  'secretaría programa la orden a diseño (hoja y turno)'
);

select ok(
  (select numero_orden_programacion is not null from public.orden where id = pg_temp.id(7)),
  'la hoja de programación quedó escrita'
);

select pg_temp.avance(pg_temp.id(7), 'ficha_adjunta');

select is(
  pg_temp.intenta('a2', format($q$update public.item_orden set tipo_tela = 'Lino' where orden_id = %L$q$, pg_temp.id(7))),
  'ok:1',
  'secretaría escribe directo los datos de tela'
);

select is(
  pg_temp.valor('a2', format(
    $q$select public.programar_tela(%L, %L::jsonb)::text$q$,
    pg_temp.id(7),
    jsonb_build_array(jsonb_build_object(
      'item_id', pg_temp.id(1007), 'tipo_tela', 'Algodón', 'cantidad_tela', 10, 'unidad_tela', 'metros'
    ))
  )),
  '',
  'secretaría programa la tela con la función'
);

select pg_temp.orden(8);
select pg_temp.avanzar(8, 'documentos_despacho');

select ok(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-11')::text$q$, pg_temp.id(8))) ~ '^[0-9a-f-]{36}$',
  'secretaría reporta la factura en el cierre'
);

select is(
  (select numero_factura from public.orden where id = pg_temp.id(8)),
  'FV-11',
  'el número de factura quedó escrito'
);

select ok(
  pg_temp.valor('a1', $q$select public.registrar_orden('ED-NUEVA', '700.000.999-1', 'Nuevo', 'Contacto', '3000000000', current_date, current_date + 5, null,
    '[{"descripcion":"Gorra","cantidad":3,"tallas":"U:3","tallaje":"otro","valor":5}]')::text$q$) ~ '^[0-9a-f-]{36}$',
  'registrar una orden sigue funcionando'
);

select is(
  (select count(*)::int from public.item_orden i join public.orden o on o.id = i.orden_id
    where o.numero_orden_compra = 'ED-NUEVA'),
  1,
  'y guarda sus prendas'
);

select pg_temp.orden(9);
select pg_temp.avanzar(9, 'cerrada');

select ok(
  pg_temp.valor('a1', format(
    $q$select public.crear_orden_de_correccion(%L, current_date + 5, 'Costura mala', 'corte_completado', %L::jsonb)::text$q$,
    pg_temp.id(9),
    jsonb_build_array(jsonb_build_object('item_id', pg_temp.id(1009), 'cantidad', 2, 'tallas', 'M:2'))
  )) ~ '^[0-9a-f-]{36}$',
  'crear una orden de corrección que entra después de diseño sigue funcionando'
);

select is(
  (select count(*)::int from public.item_orden i join public.orden o on o.id = i.orden_id
    where o.orden_original_id = pg_temp.id(9)),
  1,
  'y guarda sus prendas'
);

select is(
  pg_temp.valor('a2', format(
    $q$select public.crear_orden_de_correccion(%L, current_date + 5, 'Costura mala', 'corte_completado', %L::jsonb)::text$q$,
    pg_temp.id(9),
    jsonb_build_array(jsonb_build_object('item_id', pg_temp.id(1009), 'cantidad', 2, 'tallas', 'M:2'))
  )),
  'ERR:UE007',
  'la corrección sigue siendo solo de administración'
);

-- ---------------------------------------------------------------------------
-- Órdenes de corrección: cuentan desde su etapa de entrada
-- ---------------------------------------------------------------------------

create function pg_temp.correccion(p_n int, p_etapa public.checkpoint) returns void language plpgsql as $$
begin
  perform pg_temp.orden(p_n);
  update public.orden
  set orden_original_id = pg_temp.id(9), etapa_inicial = p_etapa
  where id = pg_temp.id(p_n);
end $$;

select pg_temp.correccion(10, 'corte_completado');
select is(
  pg_temp.valor('a1', pg_temp.llamada(10, '{"observaciones":"x"}')),
  'ERR:UE016',
  'una corrección que entra por el corte ya pasó diseño: no se edita, aunque no tenga avances'
);

select pg_temp.correccion(11, 'programada_diseno');
select is(
  pg_temp.valor('a1', pg_temp.llamada(11, '{"observaciones":"x"}')),
  'true',
  'una corrección que entra por la programación a diseño sí, hasta que la programen'
);

select pg_temp.correccion(12, 'cotizacion_aprobada');
select is(
  pg_temp.valor('a1', pg_temp.llamada(12, '{"observaciones":"x"}')),
  'true',
  'una corrección que entra por la cotización también'
);

-- ---------------------------------------------------------------------------
-- Prendas: agregar, cambiar y quitar en una sola edición
-- ---------------------------------------------------------------------------

select pg_temp.orden(20);
insert into public.item_orden (id, orden_id, descripcion, cantidad, tallas, tallaje, valor)
values (pg_temp.id(2020), pg_temp.id(20), 'Pantalón', 4, 'L:4', 'otro', 500);

select is(
  pg_temp.valor('a1', pg_temp.llamada(20, jsonb_build_object('items', jsonb_build_array(
    pg_temp.prenda(20, '{"valor":2000}'),
    '{"descripcion":"  Gorra  ","cantidad":3,"tallas":"U:3","tallaje":"otro","valor":5,"observaciones":""}'::jsonb
  )))),
  'true',
  'admin agrega, cambia y quita prendas a la vez'
);

select is(
  (select array_agg(descripcion || ':' || valor::text order by descripcion)
     from public.item_orden where orden_id = pg_temp.id(20)),
  array['Camisa:2000.00', 'Gorra:5.00'],
  'la orden quedó con las prendas pedidas'
);

select is(
  (select cambios #> '{prendas,cambiadas,0,campos}' from public.edicion_orden where orden_id = pg_temp.id(20)),
  '{"valor": {"antes": 1000.00, "despues": 2000.00}}'::jsonb,
  'el rastro dice qué cambió en la prenda'
);

select is(
  (select cambios #>> '{prendas,quitadas,0,descripcion}' from public.edicion_orden where orden_id = pg_temp.id(20)),
  'Pantalón',
  'el rastro guarda la prenda quitada'
);

select is(
  (select cambios #>> '{prendas,agregadas,0,descripcion}' from public.edicion_orden where orden_id = pg_temp.id(20)),
  'Gorra',
  'el rastro guarda la prenda agregada'
);

select pg_temp.orden(21);

select is(
  pg_temp.valor('a1', pg_temp.llamada(21, jsonb_build_object('items', jsonb_build_array(pg_temp.prenda(20))))),
  'ERR:UE013',
  'no se puede tocar una prenda de otra orden'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(21, jsonb_build_object('items', jsonb_build_array(pg_temp.prenda(21), pg_temp.prenda(21))))),
  'ERR:UE013',
  'ni repetir una prenda'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(21, '{"items":[]}')),
  'ERR:UE010',
  'una orden no se queda sin prendas'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(21, jsonb_build_object('items', jsonb_build_array(pg_temp.prenda(21, '{"descripcion":"   "}'))))),
  'ERR:UE010',
  'una prenda no se queda sin descripción'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(21, jsonb_build_object(
    'entrega', current_date + 50,
    'items', jsonb_build_array(pg_temp.prenda(21, '{"cantidad":0}'))
  ))),
  'ERR:23514',
  'una cantidad de cero rechaza la edición'
);

select is(
  (select fecha_entrega from public.orden where id = pg_temp.id(21)),
  current_date + 30,
  'todo o nada: la fecha tampoco cambió'
);

select is(pg_temp.ediciones(21), 0, 'y no hay rastro de los intentos fallidos');

-- Una prenda anterior al tallaje se muestra como «otro»: no es un cambio.
select pg_temp.orden(22);
update public.item_orden set tallaje = null where id = pg_temp.id(1022);

select is(
  pg_temp.valor('a1', pg_temp.llamada(22)),
  'false',
  'guardar sin tocar una prenda sin tallaje no es una edición'
);

select is(
  (select tallaje from public.item_orden where id = pg_temp.id(1022)),
  null,
  'y sigue sin tallaje'
);

-- ---------------------------------------------------------------------------
-- Datos de la orden
-- ---------------------------------------------------------------------------

select pg_temp.orden(23);

select is(
  pg_temp.valor('a1', pg_temp.llamada(23, '{"numero":"ed-1"}')),
  'ERR:23505',
  'el número de orden no se repite, sin distinguir mayúsculas'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(23, '{"numero":"   "}')),
  'ERR:UE010',
  'el número no se queda en blanco'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(23, '{"nit":"..."}')),
  'ERR:UE010',
  'el NIT no se queda sin números'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(23, jsonb_build_object('entrega', current_date - 1))),
  'ERR:23514',
  'la entrega no puede ser anterior al ingreso'
);

select is(
  pg_temp.valor('a1', format(
    $q$select public.editar_orden(gen_random_uuid(), 'X', '12345', 'x', 'x', '3000000', current_date, current_date, null, '[]')::text$q$
  )),
  'ERR:UE005',
  'una orden que no existe se rechaza'
);

-- ---------------------------------------------------------------------------
-- Cliente compartido: una orden no cambia en silencio las demás
-- ---------------------------------------------------------------------------

select pg_temp.orden(30);
select is(
  pg_temp.valor('a1', pg_temp.llamada(30, '{"razon":"Nombre corregido","celular":"3111111111"}')),
  'true',
  'si es la única orden del cliente, sus datos se corrigen'
);

select is(
  (select razon_social from public.cliente where id = pg_temp.id(5030)),
  'Nombre corregido',
  'el cliente quedó corregido'
);

select is(
  (select cambios #>> '{cliente,razon_social,antes}' from public.edicion_orden where orden_id = pg_temp.id(30)),
  'Cliente 30',
  'y el rastro lo dice'
);

-- Dos órdenes del mismo cliente.
select pg_temp.orden(31);
insert into public.orden (id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
values (pg_temp.id(32), 'ED-32', pg_temp.id(5031), current_date, current_date + 30,
        '00000000-0000-0000-0000-0000000000a1');

select is(
  pg_temp.valor('a1', pg_temp.llamada(31, '{"razon":"Otro nombre"}')),
  'ERR:UE017',
  'si el cliente tiene otras órdenes, su razón social no se cambia desde una'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(31, '{"celular":"3222222222"}')),
  'ERR:UE017',
  'ni su contacto'
);

select is(
  (select razon_social || '|' || contacto_celular from public.cliente where id = pg_temp.id(5031)),
  'Cliente 31|3000000000',
  'el cliente compartido sigue igual'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(31, '{"nit":"7.000.000.031"}')),
  'false',
  'escribir el mismo NIT con otro formato no es un cambio'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(31, '{"observaciones":"Con cliente compartido"}')),
  'true',
  'los demás datos de la orden sí se editan'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(31, '{"nit":"900.111.222-3","razon":"No debe quedar"}')),
  'true',
  'cambiar a un NIT que ya existe pasa la orden a ese cliente'
);

select is(
  (select cliente_id::text from public.orden where id = pg_temp.id(31)),
  '00000000-0000-0000-0000-0000000000c1',
  'la orden quedó con el cliente de ese NIT'
);

select is(
  (select razon_social from public.cliente where id = '00000000-0000-0000-0000-0000000000c1'),
  'Colegio San Ignacio',
  'y ese cliente conserva sus datos: no se reescriben desde una orden'
);

select is(
  (select cliente_id::text from public.orden where id = pg_temp.id(32)),
  pg_temp.id(5031)::text,
  'la otra orden sigue con su cliente'
);

select is(
  (select cambios #>> '{cliente,nit,despues}' from public.edicion_orden
    where orden_id = pg_temp.id(31) order by creado_en desc, cambios ? 'cliente' desc limit 1),
  '900.111.222-3',
  'el rastro dice a qué cliente pasó'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada(32, '{"nit":"123.456.789-0","razon":"Cliente nuevo","items":[{"descripcion":"Camisa","cantidad":1,"tallas":"M:1","tallaje":"otro","valor":1}]}')),
  'true',
  'un NIT que no existe crea el cliente'
);

select is(
  (select c.razon_social from public.orden o join public.cliente c on c.id = o.cliente_id where o.id = pg_temp.id(32)),
  'Cliente nuevo',
  'y la orden queda con él'
);

select * from finish();
rollback;
