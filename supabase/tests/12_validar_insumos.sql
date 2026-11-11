-- validar_insumos (HU-23) y la tabla insumo_orden.
--
-- Secretaría guarda el listado de insumos de una orden y marca
-- insumos_validados, todo o nada. El listado es inmutable, solo se escribe en
-- la misma transacción que marca la etapa, y una devolución (HU-18) lo deja
-- atrás sin borrarlo para que se vuelva a validar.

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

-- La llamada a validar_insumos para la orden `p_orden` con el listado `p_lista`.
create function pg_temp.validar(p_orden uuid, p_lista text) returns text language sql as $$
  select format('select public.validar_insumos(%L, %L::jsonb)', p_orden, p_lista)
$$;

-- OC-5002 (seed, f2): con la tela programada, le toca validar insumos.
-- 4001: sin tela. 4002: con la tela, para el chequeo diferido.
select pg_temp.orden_nueva(4001);
select pg_temp.orden_nueva(4002);
select pg_temp.avance(pg_temp.id(4002), 'ficha_adjunta');
select pg_temp.avance(pg_temp.id(4002), 'tela_programada');

create temp table oc5002 as
select '00000000-0000-0000-0000-0000000000f2'::uuid as id;

select plan(30);

-- ---------------------------------------------------------------------------
-- Quién valida y cuándo
-- ---------------------------------------------------------------------------

select is(
  pg_temp.mensaje('a1', pg_temp.validar((select id from oc5002), '[{"insumo":"hilo","detalle":"10 conos"}]')),
  'Solo secretaría puede validar los insumos',
  'administración no valida insumos'
);

select is(
  pg_temp.mensaje('a4', pg_temp.validar((select id from oc5002), '[{"insumo":"hilo","detalle":"10 conos"}]')),
  'Solo secretaría puede validar los insumos',
  'corte no valida insumos'
);

select is(
  pg_temp.valor('anon', pg_temp.validar((select id from oc5002), '[{"insumo":"hilo","detalle":"10 conos"}]')),
  'ERR:42501',
  'anon ni siquiera puede ejecutar la función'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar(pg_temp.id(9999), '[{"insumo":"hilo","detalle":"10 conos"}]')),
  'La orden indicada no existe',
  'la orden tiene que existir'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar(pg_temp.id(4001), '[{"insumo":"hilo","detalle":"10 conos"}]')),
  'Primero debe estar programada la tela',
  'sin la tela programada no se validan insumos'
);

-- ---------------------------------------------------------------------------
-- El listado tiene que tener sentido
-- ---------------------------------------------------------------------------

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[]')),
  'Marca al menos un insumo',
  'un listado vacío no se valida'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '{"insumo":"hilo"}')),
  'Marca al menos un insumo',
  'el listado tiene que ser un arreglo'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"tela","detalle":"20 metros"}]')),
  'Revisa los insumos: cada uno lleva cuánto y cómo',
  'solo los siete insumos del catálogo'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"boton","detalle":"   "}]')),
  'Revisa los insumos: cada uno lleva cuánto y cómo',
  'cada insumo lleva su detalle'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), format('[{"insumo":"boton","detalle":"%s"}]', repeat('x', 301)))),
  'Revisa los insumos: cada uno lleva cuánto y cómo',
  'el detalle tiene un tope de 300 caracteres'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"boton"}]')),
  'Revisa los insumos: cada uno lleva cuánto y cómo',
  'un insumo sin el campo detalle no se valida'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"hilo","detalle":"10 conos"},{"insumo":"hilo","detalle":"5 conos"}]')),
  'Un insumo está dos veces en el listado',
  'un insumo no se repite'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = (select id from oc5002) and checkpoint = 'insumos_validados'),
  0,
  'los intentos fallidos no dejan ningún avance'
);

-- ---------------------------------------------------------------------------
-- Secretaría valida
-- ---------------------------------------------------------------------------

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002),
    '[{"insumo":"hilo","detalle":"  6 conos de hilo azul  "},{"insumo":"cierre","detalle":"80 cierres de 60 cm"}]')),
  null,
  'secretaría valida el listado de OC-5002'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = (select id from oc5002) and checkpoint = 'insumos_validados'
      and anulado_por is null and usuario_id = '00000000-0000-0000-0000-0000000000a2'),
  1,
  'queda un avance insumos_validados vigente firmado por secretaría'
);

select is(
  (select array_agg(i.insumo::text || ':' || i.detalle order by i.insumo)
     from public.insumo_orden i
     join public.avance_seccion a on a.id = i.avance_id
    where i.orden_id = (select id from oc5002) and a.checkpoint = 'insumos_validados'),
  array['hilo:6 conos de hilo azul', 'cierre:80 cierres de 60 cm'],
  'el listado queda colgado de ese avance, con el detalle sin espacios sobrantes'
);

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"boton","detalle":"100"}]')),
  'Los insumos de esta orden ya están validados',
  'no se valida dos veces'
);

-- ---------------------------------------------------------------------------
-- Quién lee y quién escribe en insumo_orden
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a2', 'select 1 from public.insumo_orden'),
  'ok:' || pg_temp.total('insumo_orden'),
  'secretaría lee todo el listado'
);

select is(
  pg_temp.intenta('a1', 'select 1 from public.insumo_orden'),
  'ok:' || pg_temp.total('insumo_orden'),
  'administración lee todo el listado'
);

select is(
  pg_temp.intenta('a4', 'select 1 from public.insumo_orden'),
  'ok:0',
  'corte no ve los insumos'
);

-- OC-5003 (f3) ya tiene insumos validados en el seed, de hace días.
select is(
  pg_temp.intenta('a2', $$insert into public.insumo_orden (orden_id, avance_id, insumo, detalle)
    select orden_id, id, 'resorte', '10 metros' from public.avance_seccion
     where orden_id = '00000000-0000-0000-0000-0000000000f3' and checkpoint = 'insumos_validados'$$),
  '42501',
  'secretaría no le agrega un insumo a una validación ya hecha'
);

select is(
  pg_temp.intenta('a2', $$update public.insumo_orden set detalle = 'otro' where orden_id = '00000000-0000-0000-0000-0000000000f3'$$),
  '42501',
  'el listado validado no se edita'
);

select is(
  pg_temp.intenta('a1', $$delete from public.insumo_orden where orden_id = '00000000-0000-0000-0000-0000000000f3'$$),
  '42501',
  'el listado validado no se borra, ni siquiera administración'
);

-- ---------------------------------------------------------------------------
-- Una validación sin listado no se confirma
-- ---------------------------------------------------------------------------
-- El chequeo es diferido: dentro de esta prueba (que nunca confirma) se pide
-- inmediato para que salte en la sentencia.

set constraints public.avance_insumos_trae_listado immediate;

select throws_ok(
  format($$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
    values (%L, 'insumos_validados', '00000000-0000-0000-0000-0000000000a2')$$, pg_temp.id(4002)),
  'UE018', null,
  'un avance insumos_validados sin insumos se rechaza'
);

set constraints public.avance_insumos_trae_listado deferred;

-- ---------------------------------------------------------------------------
-- Una devolución deja el listado atrás y se vuelve a validar
-- ---------------------------------------------------------------------------

select is(
  pg_temp.mensaje('a1', format($$select public.devolver_orden_a_etapa(%L, 'tela_programada', 'Cambió la tela')$$, (select id from oc5002))),
  null,
  'administración devuelve OC-5002 a la tela'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = (select id from oc5002) and checkpoint = 'insumos_validados'
      and anulado_por is not null),
  1,
  'la validación queda anulada, no borrada'
);

select is(
  (select count(*)::int from public.insumo_orden where orden_id = (select id from oc5002)),
  2,
  'el listado anterior sigue en la base'
);

-- Programar la tela otra vez, ahora firmada en esta transacción.
select pg_temp.avance((select id from oc5002), 'tela_programada');

select is(
  pg_temp.mensaje('a2', pg_temp.validar((select id from oc5002), '[{"insumo":"boton","detalle":"640 botones negros"}]')),
  null,
  'secretaría vuelve a validar con un listado nuevo'
);

select is(
  (select array_agg(i.insumo::text order by i.insumo)
     from public.insumo_orden i
     join public.avance_seccion a on a.id = i.avance_id
    where i.orden_id = (select id from oc5002) and a.anulado_por is null),
  array['boton'],
  'el listado vigente es solo el de la validación nueva'
);

select is(
  (select count(*)::int from public.insumo_orden where orden_id = (select id from oc5002)),
  3,
  'y la base guarda los dos listados: 2 anulados y 1 vigente'
);

select * from finish();
rollback;
