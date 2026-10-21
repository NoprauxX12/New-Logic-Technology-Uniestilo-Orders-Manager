-- reportar_factura (HU-13) y generar_alertas_proximidad_entrega (HU-20).
--
-- La factura: solo secretaría, a su nombre, todo o nada, una vez. Las alertas
-- de entrega: no las ejecuta nadie con sesión, no se duplican al correrlas
-- otra vez, van a administración y al área en que está la orden, y no se
-- generan para órdenes cerradas ni lejanas ni a personas desactivadas.

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
select pg_temp.crear_usuario('b2', 'admin', false);

-- Fecha de hoy como la ve la función (Bogotá).
create function pg_temp.hoy() returns date language sql as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- Facturas: 4001 abierta, 4002 cerrada (con factura previa), 4003 abierta (factura en blanco).
select pg_temp.orden_nueva(4001);
select pg_temp.orden_nueva(4002);
select pg_temp.orden_nueva(4003);
update public.orden set numero_factura = 'FV-OLD' where id = pg_temp.id(4002);
select pg_temp.avance(pg_temp.id(4002), 'cerrada');

-- Alertas de entrega.
--  5001 entrega mañana, sin avances (le toca cotización) y ya con una alerta para admin
--  5002 vencida hace 2 días, recogida y con un lote en el taller
--  5003 entrega en 10 días (lejos)
--  5004 entrega mañana pero cerrada
--  5005 entrega hoy, lista para despachar (le toca el cierre)
select pg_temp.orden_nueva(5001, pg_temp.hoy() + 1);
select pg_temp.orden_nueva(5002, pg_temp.hoy() - 2);
select pg_temp.orden_nueva(5003, pg_temp.hoy() + 10);
select pg_temp.orden_nueva(5004, pg_temp.hoy() + 1);
select pg_temp.orden_nueva(5005, pg_temp.hoy());
select pg_temp.avance(pg_temp.id(5002), cp)
from unnest(array['cotizacion_enviada', 'cotizacion_aprobada', 'programada_diseno', 'ficha_adjunta',
                  'tela_programada', 'corte_completado', 'recogido_bordado']::public.checkpoint[]) cp;
select pg_temp.avance(pg_temp.id(5004), 'cerrada');
select pg_temp.avance(pg_temp.id(5005), cp)
from unnest(array['cotizacion_enviada', 'cotizacion_aprobada', 'programada_diseno', 'ficha_adjunta',
                  'tela_programada', 'corte_completado', 'recogido_bordado', 'llegada_marcacion',
                  'lista_despacho']::public.checkpoint[]) cp;
insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
values (pg_temp.id(5002), 'Taller Alertas', '4 prendas', '00000000-0000-0000-0000-0000000000a5');
insert into public.alerta (id, tipo, orden_id, destinatario_id, detalle)
values (pg_temp.id(9001), 'proximidad_entrega', pg_temp.id(5001), '00000000-0000-0000-0000-0000000000a1', 'preexistente');

create temp table antes as
select count(*) as n from public.alerta where tipo = 'proximidad_entrega';
create temp table corrida as
select public.generar_alertas_proximidad_entrega() as n;

-- Los destinatarios de las alertas de una orden, ordenados, como texto.
create function pg_temp.destinatarios(p_orden int) returns text language sql as $$
  select coalesce(string_agg(right(destinatario_id::text, 2), ',' order by destinatario_id), '-')
  from public.alerta where tipo = 'proximidad_entrega' and orden_id = pg_temp.id(p_orden)
$$;

select plan(38);

-- ---------------------------------------------------------------------------
-- reportar_factura
-- ---------------------------------------------------------------------------

select ok(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, '  FV-999  ')::text$q$, pg_temp.id(4001))) ~ '^[0-9a-f-]{36}$',
  'secretaría reporta la factura y recibe el id del avance'
);

select is(
  (select numero_factura from public.orden where id = pg_temp.id(4001)),
  'FV-999',
  'el número de factura queda guardado sin espacios'
);

select is(
  (select usuario_id::text || ' ' || observaciones from public.avance_seccion
    where orden_id = pg_temp.id(4001) and checkpoint = 'factura_generada'),
  '00000000-0000-0000-0000-0000000000a2 Factura FV-999',
  'el avance factura_generada queda firmado por quien tiene la sesión'
);

select is(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-000')::text$q$, pg_temp.id(4001))),
  'ERR:23505',
  'la factura de una orden no se reporta dos veces'
);

select is(
  (select numero_factura from public.orden where id = pg_temp.id(4001)),
  'FV-999',
  'y el segundo intento no pisó el número (todo o nada)'
);

select is(
  pg_temp.valor(r.sufijo, format($q$select public.reportar_factura(%L, 'FV-777')::text$q$, pg_temp.id(4003))),
  'ERR:UE005',
  format('%s no puede reportar facturas (la RLS no le deja tocar la orden)', r.rol)
)
from (values
  ('a1', 'admin'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b1', 'una secretaria desactivada')
) as r(sufijo, rol);

select is(
  (select numero_factura is null from public.orden where id = pg_temp.id(4003)),
  true,
  'ninguno de esos intentos dejó un número de factura'
);

select is(
  pg_temp.valor('anon', format($q$select public.reportar_factura(%L, 'FV-1')::text$q$, pg_temp.id(4003))),
  'ERR:42501',
  'anon no puede ejecutar reportar_factura'
);

select is(
  pg_temp.valor('postgres', format($q$select public.reportar_factura(%L, 'FV-1')::text$q$, pg_temp.id(4003))),
  'ERR:UE006',
  'sin sesión se niega'
);

select is(
  pg_temp.valor('a2', $q$select public.reportar_factura(gen_random_uuid(), 'FV-1')::text$q$),
  'ERR:UE005',
  'una orden que no existe se rechaza'
);

select is(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-NEW')::text$q$, pg_temp.id(4002))),
  'ERR:UE004',
  'a una orden cerrada no se le reporta factura (UE004)'
);

select is(
  (select numero_factura from public.orden where id = pg_temp.id(4002)),
  'FV-OLD',
  'y el rechazo deshizo el cambio del número en la orden cerrada'
);

select todo_start('HALLAZGO: secretaría puede cambiar numero_factura de una orden ya cerrada (o con factura) con un UPDATE directo: solo el avance está congelado, no la columna');
select is(
  pg_temp.intenta('a2', format($q$update public.orden set numero_factura = 'FV-CAMBIADA' where id = %L$q$, pg_temp.id(4002))),
  'ok:0',
  'el número de factura de una orden cerrada no se puede cambiar'
);
select is(
  pg_temp.intenta('a2', format($q$update public.orden set numero_factura = 'FV-CAMBIADA' where id = %L$q$, pg_temp.id(4001))),
  'ok:0',
  'el número de una factura ya reportada no se puede cambiar'
);
select todo_end();

select todo_start('HALLAZGO: reportar_factura acepta un número de factura en blanco (no hay validación en la función ni check en la tabla)');
select is(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, '   ')::text$q$, pg_temp.id(4003))),
  'ERR:23514',
  'la factura en blanco se rechaza'
);
select todo_end();

-- ---------------------------------------------------------------------------
-- generar_alertas_proximidad_entrega
-- ---------------------------------------------------------------------------

select is(
  (select n from corrida)::bigint,
  (select count(*) from public.alerta where tipo = 'proximidad_entrega') - (select n from antes),
  'la función devuelve exactamente cuántas alertas nuevas creó'
);

select is(
  pg_temp.destinatarios(5001),
  'a1,a2',
  'entrega mañana, en cotización: administración y secretaría (y no las cuentas desactivadas)'
);

select is(
  (select detalle from public.alerta
    where orden_id = pg_temp.id(5001) and destinatario_id = '00000000-0000-0000-0000-0000000000a1'),
  'preexistente',
  'la alerta que ya existía para admin no se pisó ni se duplicó'
);

select alike(
  (select detalle from public.alerta
    where orden_id = pg_temp.id(5001) and destinatario_id = '00000000-0000-0000-0000-0000000000a2'),
  'La orden PT-5001 de Colegio San Ignacio entrega mañana (%) y está en Cotización',
  'el detalle dice qué orden, de qué cliente, cuándo se entrega y en qué área está'
);

select is(
  pg_temp.destinatarios(5002),
  'a1,a5,a6',
  'vencida y en el taller: administración, logística (por el lote) y marcación (la que sigue)'
);

select alike(
  (select detalle from public.alerta
    where orden_id = pg_temp.id(5002) and destinatario_id = '00000000-0000-0000-0000-0000000000a6'),
  'La orden PT-5002 de Colegio San Ignacio se venció hace 2 días (%) y está en el taller',
  'el detalle de una vencida cuenta los días y dice que está en el taller'
);

select is(
  pg_temp.destinatarios(5003),
  '-',
  'una entrega a 10 días no genera alerta'
);

select is(
  pg_temp.destinatarios(5004),
  '-',
  'una orden cerrada no genera alerta aunque entregue mañana'
);

select is(
  pg_temp.destinatarios(5005),
  'a1,a2',
  'lista para despachar y entrega hoy: administración y secretaría (le toca el cierre)'
);

select alike(
  (select detalle from public.alerta
    where orden_id = pg_temp.id(5005) and destinatario_id = '00000000-0000-0000-0000-0000000000a2'),
  'La orden PT-5005 de Colegio San Ignacio entrega hoy y está en el cierre de la orden',
  'el detalle de una que entrega hoy lo dice'
);

select is(
  (select count(*)::int from public.alerta
    where tipo = 'proximidad_entrega'
      and destinatario_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')),
  0,
  'a las cuentas desactivadas no les llega ninguna'
);

select is(
  (select count(*)::int from public.alerta
    where orden_id in (pg_temp.id(5001), pg_temp.id(5002), pg_temp.id(5005))
      and tipo = 'proximidad_entrega' and id <> pg_temp.id(9001)
      and (creada_por is not null or estado <> 'pendiente' or fecha_atencion is not null)),
  0,
  'las alertas generadas nacen pendientes y sin autor (las crea el sistema)'
);

select is(
  public.generar_alertas_proximidad_entrega(),
  0,
  'correrla otra vez no crea nada (idempotente)'
);

select is(
  (select count(*)::int from public.alerta where tipo = 'proximidad_entrega' and orden_id = pg_temp.id(5001)),
  2,
  'y las alertas de la 5001 siguen siendo 2'
);

select cmp_ok(
  public.generar_alertas_proximidad_entrega(20),
  '>=', 2,
  'con un margen mayor alcanza a la orden que entrega en 10 días'
);

select is(
  pg_temp.destinatarios(5003),
  'a1,a2',
  'la de 10 días recibe sus alertas al ampliar el margen'
);

select is(
  pg_temp.destinatarios(5004),
  '-',
  'la cerrada sigue sin alertas aunque se amplíe el margen'
);

select * from finish();
rollback;
