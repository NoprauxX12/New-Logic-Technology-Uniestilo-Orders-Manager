-- registrar_orden (HU-01, ADR 0005): una sola transacción para cliente, orden
-- y prendas; solo admin; el autor sale de la sesión; el cliente se reutiliza
-- por NIT normalizado; el número de orden de compra es único sin importar
-- mayúsculas.

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

-- Una orden recién registrada (sin avances) con una prenda, para el cliente c1 del seed.
create function pg_temp.orden_nueva(p_n int, p_entrega date default current_date + 30)
returns uuid language plpgsql as $$
begin
  insert into public.orden (id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
  values (pg_temp.id(p_n), 'PT-' || p_n, '00000000-0000-0000-0000-0000000000c1',
          least(current_date, p_entrega), p_entrega, '00000000-0000-0000-0000-0000000000a1');
  insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor)
  values (pg_temp.id(p_n), 'Prenda de prueba', 10, 'M:10', 1000);
  return pg_temp.id(p_n);
end $$;

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

-- Arma la llamada: número de orden de compra, NIT, fechas e ítems (JSON).
create function pg_temp.llamada(
  p_numero text, p_nit text,
  p_items text default '[{"descripcion":"Camisa","cantidad":5,"tallas":"M:5","tallaje":"superior_hombre","valor":1000},{"descripcion":"Pantalón","cantidad":3,"tallas":"L:3","valor":2500.50,"observaciones":"Bota recta"}]',
  p_ingreso text default 'current_date', p_entrega text default 'current_date + 10'
) returns text language sql as $$
  select format(
    $f$select public.registrar_orden(%L, %L, 'Razón Social Prueba', 'Contacto', '300 000 0000', %s, %s, 'obs', %L::jsonb)::text$f$,
    p_numero, p_nit, p_ingreso, p_entrega, p_items)
$$;

select plan(39);

-- ---------------------------------------------------------------------------
-- Camino feliz, con cliente que ya existe (c1 = '900.111.222-3')
-- ---------------------------------------------------------------------------

create temp table resultado as
select pg_temp.valor('a1', pg_temp.llamada('RO-1', '9001112223')) as orden_id;

select ok(
  (select orden_id ~ '^[0-9a-f-]{36}$' from resultado),
  'admin registra una orden y recibe su id'
);

select is(
  (select creado_por::text from public.orden where id = (select orden_id::uuid from resultado)),
  '00000000-0000-0000-0000-0000000000a1',
  'creado_por es la persona de la sesión'
);

select is(
  (select count(*)::int from public.item_orden where orden_id = (select orden_id::uuid from resultado)),
  2,
  'se guardaron las dos prendas'
);

select is(
  (select cliente_id::text from public.orden where id = (select orden_id::uuid from resultado)),
  '00000000-0000-0000-0000-0000000000c1',
  'el NIT escrito de otra forma (sin puntos ni guion) reutiliza al cliente existente'
);

select is(
  (select count(*)::int from public.cliente),
  3,
  'no se creó un cliente nuevo (siguen los 3 del seed)'
);

select is(
  (select tallaje from public.item_orden
    where orden_id = (select orden_id::uuid from resultado) and descripcion = 'Camisa'),
  'superior_hombre',
  'el tallaje de la prenda queda guardado'
);

select is(
  (select valor from public.item_orden
    where orden_id = (select orden_id::uuid from resultado) and descripcion = 'Pantalón'),
  2500.50::numeric,
  'el valor de la prenda se guarda tal cual'
);

select is(
  pg_temp.intenta('postgres', 'select 1 from public.avance_seccion a join public.orden o on o.id = a.orden_id where o.numero_orden_compra = ''RO-1'''),
  'ok:0',
  'una orden recién registrada no tiene avances: su estado se deriva, no se guarda'
);

select is(
  (select count(*)::int from public.cliente
    where public.nit_normalizado(nit) = '9001112223'),
  1,
  'el NIT con puntos, con guion o sin ellos es siempre el mismo cliente'
);

select ok(
  pg_temp.valor('a1', pg_temp.llamada('RO-1B', '900-111-222.3')) ~ '^[0-9a-f-]{36}$',
  'otra forma de escribir el mismo NIT sigue reutilizando al cliente'
);

select is(
  (select count(*)::int from public.cliente),
  3,
  'y tampoco crea un cliente'
);

-- ---------------------------------------------------------------------------
-- Cliente nuevo
-- ---------------------------------------------------------------------------

select ok(
  pg_temp.valor('a1', pg_temp.llamada('RO-2', '999.888.777-6')) ~ '^[0-9a-f-]{36}$',
  'un NIT que no existe crea al cliente y la orden'
);

select is(
  (select count(*)::int from public.cliente where public.nit_normalizado(nit) = '9998887776'),
  1,
  'el cliente nuevo quedó creado'
);

-- ---------------------------------------------------------------------------
-- Atomicidad: si algo falla, no queda nada (ni orden, ni cliente, ni prendas)
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor('a1', pg_temp.llamada('ro-1', '111.222.333-4')),
  'ERR:23505',
  'el número de orden de compra se repite aunque cambien las mayúsculas'
);

select is(
  (select count(*)::int from public.cliente where public.nit_normalizado(nit) = '1112223334'),
  0,
  'la orden repetida no dejó creado a su cliente nuevo'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada('RO-ATOM-1', '222.333.444-5',
    '[{"descripcion":"Buena","cantidad":5,"tallas":"M:5","valor":100},{"descripcion":"Mala","cantidad":0,"tallas":"M:0","valor":100}]')),
  'ERR:23514',
  'una prenda con cantidad 0 rechaza toda la orden'
);

select is(
  (select (select count(*) from public.orden where numero_orden_compra = 'RO-ATOM-1')
        + (select count(*) from public.cliente where public.nit_normalizado(nit) = '2223334445')
        + (select count(*) from public.item_orden where descripcion in ('Buena', 'Mala'))),
  0::bigint,
  'no quedó ni orden, ni cliente, ni la prenda buena: todo o nada'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada('RO-ATOM-2', '333.444.555-6',
    '[{"descripcion":"Buena","cantidad":5,"tallas":"M:5","valor":100},{"cantidad":5,"tallas":"M:5","valor":100}]')),
  'ERR:23502',
  'una prenda sin descripción rechaza toda la orden'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada('RO-ATOM-3', '333.444.555-6',
    '[{"descripcion":"Mala","cantidad":5,"tallas":"M:5","valor":-1}]')),
  'ERR:23514',
  'un valor negativo rechaza la orden'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada('RO-ATOM-4', '333.444.555-6',
    '[{"descripcion":"Mala","cantidad":5,"tallas":"M:5","valor":1,"tallaje":"inventado"}]')),
  'ERR:23514',
  'un tallaje que no existe rechaza la orden'
);

select is(
  pg_temp.valor('a1', pg_temp.llamada('RO-ATOM-5', '333.444.555-6',
    '[{"descripcion":"Mala","cantidad":5,"tallas":"M:5","valor":1}]', 'current_date', 'current_date - 1')),
  'ERR:23514',
  'la entrega no puede ser anterior al ingreso'
);

select is(
  (select (select count(*) from public.orden where numero_orden_compra like 'RO-ATOM-%')
        + (select count(*) from public.cliente where public.nit_normalizado(nit) = '3334445556')),
  0::bigint,
  'ninguno de esos intentos dejó huellas'
);

-- ---------------------------------------------------------------------------
-- Una orden sin prendas no existe
-- ---------------------------------------------------------------------------

select is(
  pg_temp.mensaje('a1', pg_temp.llamada('RO-VACIA', '444.555.666-7', '[]')),
  'La orden debe tener al menos una prenda',
  'una orden sin prendas se rechaza con un mensaje claro'
);

select is(
  pg_temp.valor('a1', format($q$select public.registrar_orden('RO-NULA', '444.555.666-7', 'x', 'x', 'x', current_date, current_date, null, null)::text$q$)),
  'ERR:P0001',
  'items null también se rechaza'
);

select is(
  (select (select count(*) from public.orden where numero_orden_compra in ('RO-VACIA', 'RO-NULA'))
        + (select count(*) from public.cliente where public.nit_normalizado(nit) = '4445556667')),
  0::bigint,
  'sin prendas no se crea ni la orden ni el cliente'
);

-- ---------------------------------------------------------------------------
-- Quién puede llamarla
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor(r.sufijo, pg_temp.llamada('RO-X-' || r.sufijo, '555.666.777-8')),
  'ERR:42501',
  format('%s no puede registrar órdenes', r.rol)
)
from (values
  ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'),
  ('b2', 'un admin desactivado'), ('b3', 'quien tiene sesión pero no perfil')
) as r(sufijo, rol);

select is(
  pg_temp.valor('anon', pg_temp.llamada('RO-ANON', '555.666.777-8')),
  'ERR:42501',
  'anon no puede ejecutar la función'
);

select is(
  pg_temp.valor('postgres', pg_temp.llamada('RO-SIN-SESION', '555.666.777-8')),
  'ERR:UE006',
  'sin sesión (auth.uid() nulo) la función se niega a registrar'
);

select is(
  (select (select count(*) from public.orden where numero_orden_compra like 'RO-X-%' or numero_orden_compra in ('RO-ANON', 'RO-SIN-SESION'))
        + (select count(*) from public.cliente where public.nit_normalizado(nit) = '5556667778')),
  0::bigint,
  'ninguno de los intentos no autorizados dejó huellas'
);

-- ---------------------------------------------------------------------------
-- Nadie puede firmar la orden por otro: no hay parámetro para el autor
-- ---------------------------------------------------------------------------

select is_empty(
  $$select proname from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('registrar_orden', 'reportar_factura', 'programar_tela', 'programar_ordenes_a_diseno')
      and proargnames::text ~* '(usuario|creado|autor|enviado|recibido)'$$,
  'ninguna función de escritura recibe el autor como parámetro: sale de auth.uid()'
);

-- ---------------------------------------------------------------------------
-- nit_normalizado
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor('a3', $q$select public.nit_normalizado('901.444.555-6 ')$q$),
  '9014445556',
  'nit_normalizado deja solo los dígitos'
);

select is(
  pg_temp.valor('a3', $q$select public.nit_normalizado(null)$q$),
  null,
  'nit_normalizado(null) es null'
);

select * from finish();
rollback;
