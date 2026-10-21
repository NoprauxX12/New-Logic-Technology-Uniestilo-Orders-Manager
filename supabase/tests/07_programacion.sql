-- programar_ordenes_a_diseno (HU-03) y programar_tela (HU-05).
--
-- La primera arma la hoja de programación: solo secretaría, atómica, no
-- reprograma, y es la única forma de escribir la hoja y el turno. La segunda
-- guarda la tela de todas las prendas de una orden y marca tela_programada:
-- rol, ficha previa, bloqueo y validaciones.

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

select pg_temp.crear_usuario('b1', 'secretaria', false);

-- 3001..3007: para armar hojas (3007 está cerrada y sin programar).
-- 3010: con ficha y dos prendas. 3011: sin ficha. 3012: con la tela ya
-- programada. 3013: con el corte hecho.
select pg_temp.orden_nueva(n) from generate_series(3001, 3007) n;
select pg_temp.orden_nueva(n) from generate_series(3010, 3013) n;
insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor)
values (pg_temp.id(3010), 'Segunda prenda', 4, 'S:4', 500);
select pg_temp.avance(pg_temp.id(3007), 'cerrada');
select pg_temp.avance(pg_temp.id(n), 'ficha_adjunta') from unnest(array[3010, 3012, 3013]) n;
select pg_temp.avance(pg_temp.id(3012), 'tela_programada');
select pg_temp.avance(pg_temp.id(3013), 'corte_completado');

-- La hoja que sigue a la última del seed.
create temp table base as
select coalesce(max(numero_orden_programacion), 0) as hoja from public.orden;

-- El arreglo de ids que recibe programar_ordenes_a_diseno.
create function pg_temp.hoja(variadic p_n int[]) returns text language sql as $$
  select 'array[' || string_agg(format('%L::uuid', pg_temp.id(n)), ',' order by ord) || ']'
  from unnest(p_n) with ordinality as x(n, ord)
$$;

-- La tela de todas las prendas de una orden, en el JSON que recibe programar_tela.
create function pg_temp.tela(
  p_orden uuid, p_tipo text, p_cant numeric, p_unidad text, p_obs text default null
) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', id, 'tipo_tela', p_tipo, 'cantidad_tela', p_cant,
    'unidad_tela', p_unidad, 'observaciones_tela', p_obs) order by id), '[]')
  from public.item_orden where orden_id = p_orden
$$;

create function pg_temp.programar(p_orden int, p_items text) returns text language sql as $$
  select format('select public.programar_tela(%L, %s)::text', pg_temp.id(p_orden), p_items)
$$;

select plan(70);

-- ---------------------------------------------------------------------------
-- programar_ordenes_a_diseno
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3003, 3001, 3002))),
  (select (hoja + 1)::text from base),
  'secretaría arma la hoja siguiente a la última (consecutivo del sistema)'
);

select is(
  (select array_agg(posicion_programacion order by numero_orden_compra) from public.orden
    where id in (pg_temp.id(3001), pg_temp.id(3002), pg_temp.id(3003))),
  array[2, 3, 1],
  'cada orden recibe el turno en que vino en el arreglo (3003 es la 1.ª, 3001 la 2.ª, 3002 la 3.ª)'
);

select is(
  (select count(distinct numero_orden_programacion)::int from public.orden
    where id in (pg_temp.id(3001), pg_temp.id(3002), pg_temp.id(3003))),
  1,
  'las tres quedan en la misma hoja'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id in (pg_temp.id(3001), pg_temp.id(3002), pg_temp.id(3003))
      and checkpoint = 'programada_diseno'
      and usuario_id = '00000000-0000-0000-0000-0000000000a2'
      and observaciones = 'Programación ' || (select hoja + 1 from base)),
  3,
  'cada una queda con su avance programada_diseno firmado por secretaría'
);

select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3004, 3005))),
  (select (hoja + 2)::text from base),
  'la hoja siguiente suma uno'
);

-- Atomicidad: una orden ya programada tumba toda la hoja.
select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3006, 3001))),
  'ERR:UE005',
  'una hoja con una orden ya programada se rechaza (no se reprograma)'
);

select is(
  (select numero_orden_programacion is null and posicion_programacion is null
     from public.orden where id = pg_temp.id(3006)),
  true,
  'y las otras órdenes de esa hoja quedaron sin programar (todo o nada)'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = pg_temp.id(3006) and checkpoint = 'programada_diseno'),
  0,
  'ni se marcó su avance'
);

select is(
  (select posicion_programacion from public.orden where id = pg_temp.id(3001)),
  2,
  'la orden ya programada conserva su turno'
);

select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(array[%L::uuid, gen_random_uuid()])::text', pg_temp.id(3006))),
  'ERR:UE005',
  'una orden que no existe tumba toda la hoja'
);

select is(
  (select numero_orden_programacion is null from public.orden where id = pg_temp.id(3006)),
  true,
  'y la válida de esa hoja no se programó'
);

select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3006, 3006))),
  'ERR:UE005',
  'la misma orden dos veces en la hoja se rechaza'
);

select is(
  (select numero_orden_programacion is null from public.orden where id = pg_temp.id(3006)),
  true,
  'y no quedó programada a medias'
);

select is(
  pg_temp.valor('a2', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3007))),
  'ERR:UE004',
  'una orden cerrada no se programa (el trigger UE004 tumba la hoja)'
);

select is(
  (select numero_orden_programacion is null from public.orden where id = pg_temp.id(3007)),
  true,
  'y la orden cerrada no quedó con hoja asignada'
);

select is(
  pg_temp.valor('a2', 'select public.programar_ordenes_a_diseno(array[]::uuid[])::text'),
  'ERR:UE008',
  'una hoja vacía se rechaza'
);

select is(
  pg_temp.valor('a2', 'select public.programar_ordenes_a_diseno(null)::text'),
  'ERR:UE008',
  'una hoja nula se rechaza'
);

-- Quién puede
select is(
  pg_temp.valor(r.sufijo, format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3006))),
  'ERR:UE007',
  format('%s no puede programar a diseño', r.rol)
)
from (values
  ('a1', 'admin'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b1', 'una secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.valor('anon', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3006))),
  'ERR:42501',
  'anon no puede ejecutarla'
);

select is(
  pg_temp.valor('postgres', format('select public.programar_ordenes_a_diseno(%s)::text', pg_temp.hoja(3006))),
  'ERR:UE006',
  'sin sesión se niega'
);

select is(
  (select numero_orden_programacion is null from public.orden where id = pg_temp.id(3006)),
  true,
  'ningún intento no autorizado programó la orden'
);

-- La hoja y el turno solo se escriben por la función.
select is(
  pg_temp.intenta('a2', format('update public.orden set numero_orden_programacion = 99, posicion_programacion = 1 where id = %L', pg_temp.id(3006))),
  '42501',
  'secretaría no puede escribir la hoja y el turno con un UPDATE directo'
);

select is(
  pg_temp.intenta('a1', format('update public.orden set numero_orden_programacion = 99, posicion_programacion = 1 where id = %L', pg_temp.id(3006))),
  '42501',
  'admin tampoco'
);

-- Restricciones de la tabla (las prueba quien salta la RLS).
select is(
  pg_temp.intenta('postgres', format('update public.orden set numero_orden_programacion = %s, posicion_programacion = 1 where id = %L', (select hoja + 1 from base), pg_temp.id(3006))),
  '23505',
  'no puede haber dos órdenes con el mismo turno en la misma hoja'
);

select is(
  pg_temp.intenta('postgres', format('update public.orden set numero_orden_programacion = 50 where id = %L', pg_temp.id(3006))),
  '23514',
  'hoja sin turno es incoherente (orden_programacion_completa)'
);

select is(
  pg_temp.intenta('postgres', format('update public.orden set numero_orden_programacion = 0, posicion_programacion = 0 where id = %L', pg_temp.id(3006))),
  '23514',
  'hoja y turno deben ser positivos (orden_programacion_positiva)'
);

-- ---------------------------------------------------------------------------
-- programar_tela
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
  0,
  'antes de programar tela no hay bloqueos de aplicación'
);

-- Quién puede
select is(
  pg_temp.mensaje(r.sufijo, pg_temp.programar(3010, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'')', pg_temp.id(3010)))),
  'Solo secretaría puede programar la tela',
  format('%s no puede programar la tela', r.rol)
)
from (values
  ('a1', 'admin'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b1', 'una secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.valor('anon', pg_temp.programar(3010, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'')', pg_temp.id(3010)))),
  'ERR:42501',
  'anon no puede ejecutarla'
);

-- Condiciones de la orden
select is(
  pg_temp.mensaje('a2', pg_temp.programar(3011, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'')', pg_temp.id(3011)))),
  'Primero debe estar marcada la ficha técnica',
  'sin ficha técnica no se programa la tela'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3012, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'')', pg_temp.id(3012)))),
  'Esta orden ya no admite programar tela',
  'con la tela ya programada no se vuelve a programar'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3013, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'')', pg_temp.id(3013)))),
  'Esta orden ya no admite programar tela',
  'con el corte hecho tampoco'
);

select is(
  pg_temp.mensaje('a2', 'select public.programar_tela(gen_random_uuid(), ''[]''::jsonb)::text'),
  'La orden indicada no existe',
  'una orden que no existe se rechaza'
);

-- Forma de los datos
select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, 'null::jsonb')),
  'Los datos de las prendas no son válidos',
  'items nulo se rechaza'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, '''{"a":1}''::jsonb')),
  'Los datos de las prendas no son válidos',
  'items que no es un arreglo se rechaza'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 0', pg_temp.id(3010)))),
  'Los datos de las prendas no son válidos',
  'un objeto suelto en vez de arreglo se rechaza'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('jsonb_build_array(pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 0)', pg_temp.id(3010)))),
  'Debes completar todas las prendas de la orden',
  'faltan prendas: hay que completar todas'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('jsonb_build_array(pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 0, pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 0)', pg_temp.id(3010), pg_temp.id(3010)))),
  'Hay prendas repetidas o sin identificar',
  'la misma prenda dos veces se rechaza'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format(
    'jsonb_build_array(pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 0, jsonb_set(pg_temp.tela(%L, ''Algodón'', 10, ''metros'') -> 1, ''{item_id}'', to_jsonb((select id from public.item_orden where orden_id = %L limit 1))))',
    pg_temp.id(3010), pg_temp.id(3010), pg_temp.id(3011)))),
  'Revisa los datos de tela de cada prenda',
  'una prenda de otra orden se rechaza'
);

-- Valores inválidos
select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('pg_temp.tela(%L, %s, %s, %s)', pg_temp.id(3010), v.tipo, v.cant, v.unidad))),
  'Revisa los datos de tela de cada prenda',
  v.caso
)
from (values
  ('''Algodón''', '0', '''metros''', 'cantidad cero'),
  ('''Algodón''', '-5', '''metros''', 'cantidad negativa'),
  ('''Algodón''', '1.234', '''metros''', 'cantidad con más de 2 decimales'),
  ('''Algodón''', '100000000', '''metros''', 'cantidad por encima del máximo'),
  ('''Algodón''', 'null', '''metros''', 'cantidad nula'),
  ('''Algodón''', '10', '''litros''', 'unidad que no existe'),
  ('''Algodón''', '10', 'null', 'unidad nula'),
  ('''   ''', '10', '''metros''', 'tipo de tela en blanco'),
  ('null', '10', '''metros''', 'tipo de tela nulo'),
  ('repeat(''x'', 201)', '10', '''metros''', 'tipo de tela de más de 200 caracteres')
) as v(tipo, cant, unidad, caso);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('pg_temp.tela(%L, ''Algodón'', 10, ''metros'', repeat(''x'', 1001))', pg_temp.id(3010)))),
  'Revisa los datos de tela de cada prenda',
  'observaciones de más de 1000 caracteres'
);

select is(
  pg_temp.valor('a2', pg_temp.programar(3010, format('jsonb_set(pg_temp.tela(%L, ''Algodón'', 10, ''metros''), ''{0,cantidad_tela}'', ''"abc"'')', pg_temp.id(3010)))),
  'ERR:22P02',
  'una cantidad que no es número se rechaza'
);

select is(
  (select count(*)::int from public.item_orden
    where orden_id = pg_temp.id(3010) and (tipo_tela is not null or cantidad_tela is not null)),
  0,
  'después de todos los rechazos, las prendas de la 3010 siguen sin tela'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = pg_temp.id(3010) and checkpoint = 'tela_programada'),
  0,
  'y no se marcó tela_programada'
);

-- Camino feliz
select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('pg_temp.tela(%L, ''  Popelina  '', 12.5, ''kilos'', ''  '')', pg_temp.id(3010)))),
  null,
  'secretaría programa la tela de todas las prendas de la orden'
);

select is(
  (select count(*)::int from public.item_orden
    where orden_id = pg_temp.id(3010) and tipo_tela = 'Popelina' and cantidad_tela = 12.5
      and unidad_tela = 'kilos' and observaciones_tela is null),
  2,
  'las dos prendas quedaron con la tela (tipo sin espacios, observación vacía como nula)'
);

select is(
  (select usuario_id::text from public.avance_seccion
    where orden_id = pg_temp.id(3010) and checkpoint = 'tela_programada'),
  '00000000-0000-0000-0000-0000000000a2',
  'tela_programada quedó firmada por secretaría'
);

select cmp_ok(
  (select count(*)::int from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
  '>=', 1,
  'la función toma un bloqueo por orden (pg_advisory_xact_lock) para no programar la misma orden dos veces a la vez'
);

select is(
  pg_temp.mensaje('a2', pg_temp.programar(3010, format('pg_temp.tela(%L, ''Otra'', 1, ''metros'')', pg_temp.id(3010)))),
  'Esta orden ya no admite programar tela',
  'la tela de una orden no se programa dos veces'
);

select * from finish();
rollback;
