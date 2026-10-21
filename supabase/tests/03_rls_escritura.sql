-- RLS de escritura.
--
-- anon no escribe nada; cada tabla solo la escribe el rol que debe, y firmando
-- con su propio id (nadie firma a nombre de otro); una cuenta desactivada no
-- puede nada; las tablas sin política de UPDATE/DELETE no se tocan.
--
-- Una escritura que la RLS filtra en silencio sale como 'ok:0'; la que se
-- rechaza de frente, como '42501'.

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
          current_date, p_entrega, '00000000-0000-0000-0000-0000000000a1');
  insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor)
  values (pg_temp.id(p_n), 'Prenda de prueba', 10, 'M:10', 1000);
  return pg_temp.id(p_n);
end $$;

-- Personas de prueba: a1..a7 son las del seed. Desactivadas: secretaria (b1),
-- admin (b2), diseno (b5), logistica (b6). Activas extra: logistica (b4),
-- admin (b7).
select pg_temp.crear_usuario('b1', 'secretaria', false);
select pg_temp.crear_usuario('b2', 'admin', false);
select pg_temp.crear_usuario('b4', 'logistica');
select pg_temp.crear_usuario('b5', 'diseno', false);
select pg_temp.crear_usuario('b6', 'logistica', false);
select pg_temp.crear_usuario('b7', 'admin');

-- Órdenes: 1 sin avances; 2 con la tela ya programada; 3 recogida y bordada
-- (puede despachar a taller) con un lote pendiente (901) y uno recibido (902).
select pg_temp.orden_nueva(1);
select pg_temp.orden_nueva(2);
select pg_temp.orden_nueva(3);
select pg_temp.avance(pg_temp.id(2), 'tela_programada');
select pg_temp.avance(pg_temp.id(3), 'recogido_bordado');

insert into public.lote_taller (id, orden_id, taller, descripcion_prendas, enviado_por) values
  (pg_temp.id(901), pg_temp.id(3), 'Taller Uno', '5 prendas', '00000000-0000-0000-0000-0000000000a5'),
  (pg_temp.id(903), pg_temp.id(3), 'Taller Tres', '5 prendas', '00000000-0000-0000-0000-0000000000a5');
insert into public.lote_taller (
  id, orden_id, taller, descripcion_prendas, enviado_por,
  recibido_completo, fecha_recepcion, recibido_por
) values (
  pg_temp.id(902), pg_temp.id(3), 'Taller Dos', '5 prendas', '00000000-0000-0000-0000-0000000000a5',
  true, now(), '00000000-0000-0000-0000-0000000000a5'
);

select plan(185);

-- ---------------------------------------------------------------------------
-- anon: nada de nada
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('anon', op),
  '42501',
  format('anon no puede %s', op)
)
from (
  select format('insert into public.%I default values', t) as op
  from unnest(array['cliente', 'orden', 'item_orden', 'avance_seccion', 'lote_taller', 'ficha_tecnica', 'alerta', 'usuario']) t
  union all
  select format('update public.%I set id = id', t)
  from unnest(array['cliente', 'orden', 'item_orden', 'avance_seccion', 'lote_taller', 'ficha_tecnica', 'alerta', 'usuario']) t
  union all
  select format('delete from public.%I', t)
  from unnest(array['cliente', 'orden', 'item_orden', 'avance_seccion', 'lote_taller', 'ficha_tecnica', 'alerta', 'usuario']) t
) ops;

select is(
  pg_temp.valor('anon', f),
  'ERR:42501',
  format('anon no puede ejecutar %s', f)
)
from unnest(array[
  $q$select public.registrar_orden('X', '1', 'x', 'x', 'x', current_date, current_date, null, '[]')$q$,
  $q$select public.reportar_factura(gen_random_uuid(), 'F')$q$,
  $q$select public.programar_ordenes_a_diseno(array[gen_random_uuid()])$q$,
  $q$select public.programar_tela(gen_random_uuid(), '[]')$q$,
  $q$select public.orden_espera_tela(gen_random_uuid())$q$,
  $q$select public.ordenes_esperando_tela()$q$,
  $q$select public.nit_normalizado('1-2')$q$,
  $q$select public.rol_dueno('cerrada')$q$,
  $q$select public.generar_alertas_proximidad_entrega()$q$
]) f;

select is(
  pg_temp.valor('a1', $q$select public.generar_alertas_proximidad_entrega()$q$),
  'ERR:42501',
  'ni siquiera admin puede correr la generación de alertas de entrega'
);

-- ---------------------------------------------------------------------------
-- cliente: solo admin crea
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta(r.sufijo, format(
    $q$insert into public.cliente (nit, razon_social, contacto_nombre, contacto_celular)
       values ('NIT-%s', 'Cliente %s', 'Contacto', '300')$q$, r.sufijo, r.sufijo)),
  case when r.rol = 'admin' then 'ok:1' else '42501' end,
  format('%s %s crear un cliente', r.rol, case when r.rol = 'admin' then 'puede' else 'no puede' end)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion'),
  ('b2', 'admin desactivado'), ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$update public.cliente set razon_social = 'Otro'$q$),
  'ok:0',
  'nadie edita un cliente (no hay política de UPDATE), ni admin'
);

select is(
  pg_temp.intenta('a1', $q$delete from public.cliente$q$),
  'ok:0',
  'nadie borra un cliente, ni admin'
);

-- ---------------------------------------------------------------------------
-- orden: solo admin crea, a su nombre; secretaría solo toca el número de factura
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a1', $q$insert into public.orden (numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
    values ('ADM-1', '00000000-0000-0000-0000-0000000000c1', current_date, current_date + 5, '00000000-0000-0000-0000-0000000000a1')$q$),
  'ok:1',
  'admin crea una orden a su nombre'
);

select is(
  pg_temp.intenta('a1', $q$insert into public.orden (numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
    values ('ADM-2', '00000000-0000-0000-0000-0000000000c1', current_date, current_date + 5, '00000000-0000-0000-0000-0000000000a2')$q$),
  '42501',
  'admin no puede crear una orden a nombre de otra persona'
);

select is(
  pg_temp.intenta('a1', $q$insert into public.orden (numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega)
    values ('ADM-3', '00000000-0000-0000-0000-0000000000c1', current_date, current_date + 5)$q$),
  '42501',
  'admin no puede crear una orden sin dejar quién la creó'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.orden (numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega, creado_por)
    values ('X-%s', '00000000-0000-0000-0000-0000000000c1', current_date, current_date + 5, '00000000-0000-0000-0000-0000000000%s')$q$, r.sufijo, r.sufijo)),
  '42501',
  format('%s no puede crear una orden', r.rol)
)
from (values
  ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b2', 'admin desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a2', $q$update public.orden set numero_factura = 'FV-1' where numero_orden_compra = 'PT-1'$q$),
  'ok:1',
  'secretaría puede registrar el número de factura'
);

select is(
  pg_temp.intenta(r.sufijo, $q$update public.orden set numero_factura = 'FV-2' where numero_orden_compra = 'PT-1'$q$),
  'ok:0',
  format('%s no puede registrar el número de factura (la RLS filtra la fila)', r.rol)
)
from (values
  ('a1', 'admin'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a2', format('update public.orden set %s where numero_orden_compra = ''PT-1''', c)),
  '42501',
  format('secretaría no puede escribir %s directamente en orden', split_part(c, ' =', 1))
)
from unnest(array[
  'fecha_entrega = current_date',
  'numero_orden_programacion = 9',
  'posicion_programacion = 9',
  'numero_orden_compra = ''HACK''',
  'creado_por = ''00000000-0000-0000-0000-0000000000a2''',
  'cliente_id = ''00000000-0000-0000-0000-0000000000c2'''
]) c;

select is(
  pg_temp.intenta('a1', $q$update public.orden set fecha_entrega = current_date$q$),
  '42501',
  'admin tampoco puede reescribir la fecha de entrega con un UPDATE'
);

select is(
  pg_temp.intenta('a1', $q$delete from public.orden$q$),
  'ok:0',
  'nadie borra una orden, ni admin'
);

-- ---------------------------------------------------------------------------
-- item_orden: admin crea; secretaría programa la tela (solo antes de programarla)
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor)
    values (%L, 'Extra', 1, 'M:1', 10)$q$, pg_temp.id(1))),
  case when r.rol = 'admin' then 'ok:1' else '42501' end,
  format('%s %s agregar una prenda', r.rol, case when r.rol = 'admin' then 'puede' else 'no puede' end)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion'), ('b2', 'admin desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a2', format($q$update public.item_orden set tipo_tela = 'Poliéster', cantidad_tela = 10, unidad_tela = 'metros' where orden_id = %L$q$, pg_temp.id(1))),
  'ok:2',
  'secretaría escribe la tela de las prendas de una orden sin tela programada'
);

select is(
  pg_temp.intenta('a2', format($q$update public.item_orden set cantidad_tela = 99 where orden_id = %L$q$, pg_temp.id(2))),
  'ok:0',
  'secretaría ya no cambia la tela de una orden con la tela programada'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$update public.item_orden set cantidad_tela = 99 where orden_id = %L$q$, pg_temp.id(1))),
  'ok:0',
  format('%s no escribe la tela de las prendas', r.rol)
)
from (values
  ('a1', 'admin'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$delete from public.item_orden$q$),
  'ok:0',
  'nadie borra prendas, ni admin'
);

select todo_start('HALLAZGO: secretaría puede cambiar cantidad, valor y descripción de una prenda con un UPDATE directo (item_orden conserva UPDATE sobre todas las columnas)');
select is(
  pg_temp.intenta('a2', format('update public.item_orden set %s where orden_id = %L', c, pg_temp.id(1))),
  '42501',
  format('secretaría no puede escribir %s en item_orden', split_part(c, ' =', 1))
)
from unnest(array['valor = 1', 'cantidad = 1', 'descripcion = ''x''', 'tallas = ''x''']) c;
select todo_end();

-- ---------------------------------------------------------------------------
-- lote_taller: logística despacha y recibe, a su nombre
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a5', format($q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
    values (%L, 'Taller X', '3 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(3))),
  'ok:1',
  'logística despacha un lote a su nombre'
);

select is(
  pg_temp.intenta('a5', format($q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
    values (%L, 'Taller X', '3 prendas', '00000000-0000-0000-0000-0000000000a2')$q$, pg_temp.id(3))),
  '42501',
  'logística no puede despachar un lote a nombre de otra persona'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
    values (%L, 'Taller X', '3 prendas', '00000000-0000-0000-0000-0000000000%s')$q$, pg_temp.id(3), r.sufijo)),
  '42501',
  format('%s no puede despachar un lote', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol);

-- La cuenta desactivada ni siquiera ve los avances, así que el trigger que
-- exige el recogido (UE001) la rechaza antes de que llegue la política: igual
-- queda afuera.
select is(
  pg_temp.intenta('b6', format($q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
    values (%L, 'Taller X', '3 prendas', '00000000-0000-0000-0000-0000000000b6')$q$, pg_temp.id(3))),
  'UE001',
  'logística desactivada no puede despachar un lote'
);

select is(
  pg_temp.intenta('b4', format($q$update public.lote_taller set recibido_completo = true, fecha_recepcion = now(),
      recibido_por = '00000000-0000-0000-0000-0000000000b4' where id = %L$q$, pg_temp.id(901))),
  'ok:1',
  'logística confirma la recepción de un lote a su nombre'
);

select is(
  pg_temp.intenta('a5', format($q$update public.lote_taller set recibido_completo = true, fecha_recepcion = now(),
      recibido_por = '00000000-0000-0000-0000-0000000000a2' where id = %L$q$, pg_temp.id(901))),
  '42501',
  'logística no puede confirmar la recepción a nombre de otra persona'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$update public.lote_taller set recibido_completo = true, fecha_recepcion = now(),
      recibido_por = '00000000-0000-0000-0000-0000000000%s' where id = %L$q$, r.sufijo, pg_temp.id(901))),
  'ok:0',
  format('%s no puede confirmar la recepción de un lote (la RLS filtra la fila)', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b6', 'logistica desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$delete from public.lote_taller$q$),
  'ok:0',
  'nadie borra un lote, ni admin'
);

-- Las reglas de coherencia de la recepción las garantiza la tabla, no la UI.
select is(
  pg_temp.intenta('postgres', format($q$update public.lote_taller set recibido_completo = true where id = %L$q$, pg_temp.id(903))),
  '23514',
  'la recepción exige quién y cuándo juntos (lote_taller_recepcion_completa)'
);

select is(
  pg_temp.intenta('postgres', format($q$update public.lote_taller set recibido_completo = true, recibido_por = '00000000-0000-0000-0000-0000000000a5',
      fecha_recepcion = fecha_envio - interval '1 day' where id = %L$q$, pg_temp.id(903))),
  '23514',
  'la recepción no puede ser anterior al envío (lote_taller_recepcion_no_anterior)'
);

select todo_start('HALLAZGO: la política "logistica recibe" solo exige recibido_por = auth.uid(); un lote ya recibido se puede reescribir (otra persona, otros datos) y se puede cambiar enviado_por');
select is(
  pg_temp.intenta('b4', format($q$update public.lote_taller set recibido_completo = false, recibido_por = '00000000-0000-0000-0000-0000000000b4'
      where id = %L$q$, pg_temp.id(902))),
  'ok:0',
  'un lote ya recibido no se vuelve a recibir ni se reescribe quién lo recibió'
);
select is(
  pg_temp.intenta('b4', format($q$update public.lote_taller set enviado_por = '00000000-0000-0000-0000-0000000000a2',
      recibido_completo = true, fecha_recepcion = now(), recibido_por = '00000000-0000-0000-0000-0000000000b4'
      where id = %L$q$, pg_temp.id(901))),
  '42501',
  'nadie puede cambiar quién envió un lote'
);
select todo_end();

-- ---------------------------------------------------------------------------
-- ficha_tecnica: diseño sube, a su nombre
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a3', format($q$insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por)
    values (%L, 'x/ficha.pdf', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(1))),
  'ok:1',
  'diseño adjunta una ficha a su nombre'
);

select is(
  pg_temp.intenta('a3', format($q$insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por)
    values (%L, 'x/ficha.pdf', '00000000-0000-0000-0000-0000000000a2')$q$, pg_temp.id(1))),
  '42501',
  'diseño no puede adjuntar una ficha a nombre de otra persona'
);

select is(
  pg_temp.intenta('a3', format($q$insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por)
    values (%L, '   ', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(1))),
  '23514',
  'la ruta de la ficha no puede estar vacía'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por)
    values (%L, 'x/ficha.pdf', '00000000-0000-0000-0000-0000000000%s')$q$, pg_temp.id(1), r.sufijo)),
  '42501',
  format('%s no puede adjuntar una ficha', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b5', 'diseno desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a3', $q$update public.ficha_tecnica set archivo_ruta = 'otra/ruta.pdf'$q$),
  'ok:0',
  'una ficha no se edita (no hay política de UPDATE), ni diseño'
);

select is(
  pg_temp.intenta('a3', $q$delete from public.ficha_tecnica$q$),
  'ok:0',
  'una ficha no se borra, ni diseño'
);

-- ---------------------------------------------------------------------------
-- alerta: quién crea y quién atiende
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'Falta tela')$q$, pg_temp.id(1))),
  'ok:1',
  'secretaría envía una alerta de falta de tela a administración'
);

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'Otra vez')$q$, pg_temp.id(1))),
  '23505',
  'no puede haber dos alertas de tela abiertas para la misma orden'
);

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'A nombre de admin')$q$, pg_temp.id(2))),
  '42501',
  'secretaría no puede enviar una alerta a nombre de otra persona'
);

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a2', 'A logística')$q$, pg_temp.id(2))),
  '42501',
  'la alerta de falta de tela solo puede ir a un admin'
);

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'A admin inactivo')$q$, pg_temp.id(2))),
  '42501',
  'la alerta de falta de tela no puede ir a un admin desactivado'
);

select is(
  pg_temp.intenta('a2', format($q$insert into public.alerta (tipo, orden_id, destinatario_id, detalle)
    values ('falta_tela', %L, '00000000-0000-0000-0000-0000000000b7', 'Sin firmar')$q$, pg_temp.id(2))),
  'ok:1',
  'si no se indica creada_por, queda la persona de la sesión (default auth.uid())'
);

select is(
  (select creada_por::text from public.alerta where orden_id = pg_temp.id(2)),
  '00000000-0000-0000-0000-0000000000a2',
  'la alerta sin firma explícita quedó firmada por la sesión'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    values ('proximidad_entrega', %L, '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000%s', 'x')$q$, pg_temp.id(3), r.sufijo)),
  '42501',
  format('%s no puede crear alertas', r.rol)
)
from (values
  ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'), ('a6', 'marcacion'),
  ('a7', 'terminacion'), ('b1', 'secretaria desactivada'), ('b2', 'admin desactivado')
) as r(sufijo, rol);

-- Atender: cada destinatario la suya. Alertas de entrega de la orden 3.
insert into public.alerta (id, tipo, orden_id, destinatario_id, detalle) values
  (pg_temp.id(801), 'proximidad_entrega', pg_temp.id(3), '00000000-0000-0000-0000-0000000000a1', 'para admin'),
  (pg_temp.id(802), 'proximidad_entrega', pg_temp.id(3), '00000000-0000-0000-0000-0000000000a5', 'para logística'),
  (pg_temp.id(803), 'proximidad_entrega', pg_temp.id(3), '00000000-0000-0000-0000-0000000000b7', 'para el otro admin');

select is(
  pg_temp.intenta('a5', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(802))),
  'ok:1',
  'el destinatario atiende su alerta'
);

select is(
  (select fecha_atencion = now() from public.alerta where id = pg_temp.id(802)),
  true,
  'la hora de atención la pone el servidor'
);

select is(
  pg_temp.intenta('a5', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(801))),
  'ok:0',
  'logística no atiende la alerta de administración'
);

select is(
  pg_temp.intenta('a1', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(803))),
  'ok:0',
  'un admin no atiende la alerta de entrega de otro admin'
);

select is(
  pg_temp.intenta('a1', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(802))),
  'ok:0',
  'admin no atiende la alerta de entrega de logística'
);

select is(
  pg_temp.intenta('a1', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(801))),
  'ok:1',
  'admin atiende la alerta de entrega que le llegó a él'
);

select is(
  pg_temp.intenta('b7', format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where orden_id = %L and tipo = 'falta_tela'$q$, pg_temp.id(1))),
  'ok:1',
  'cualquier admin atiende una alerta de falta de tela, aunque sea de otro admin'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$update public.alerta set estado = 'atendida', fecha_atencion = now() where id = %L$q$, pg_temp.id(803))),
  'ok:0',
  format('%s no atiende la alerta de otra persona', r.rol)
)
from (values
  ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'), ('a6', 'marcacion'),
  ('a7', 'terminacion'), ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$delete from public.alerta$q$),
  'ok:0',
  'nadie borra una alerta, ni admin'
);

select is(
  pg_temp.intenta('a1', $q$update public.alerta set detalle = 'cambiado'$q$),
  '42501',
  'el detalle de una alerta no se puede cambiar (sin permiso de columna)'
);

select todo_start('HALLAZGO: el destinatario puede reabrir o reescribir la hora de una alerta ya atendida (la política de UPDATE no pone condición sobre el estado)');
select is(
  pg_temp.intenta('a5', format($q$update public.alerta set estado = 'pendiente', fecha_atencion = null where id = %L$q$, pg_temp.id(802))),
  'ok:0',
  'una alerta atendida no se reabre'
);
select is(
  pg_temp.intenta('a1', format($q$update public.alerta set fecha_atencion = fecha_creacion where id = %L$q$, pg_temp.id(801))),
  'ok:0',
  'la hora en que se atendió una alerta no se reescribe'
);
select todo_end();

-- ---------------------------------------------------------------------------
-- usuario: solo admin administra personas
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', s::uuid, 'authenticated', 'authenticated',
       right(s, 2) || '@nuevo.test', now(), now(), now(), '{}', '{}', '', '', '', ''
from unnest(array[
  '00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000c9',
  '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
  '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4',
  '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000d6',
  '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000d8'
]) s;

-- Un perfil sin rastro para que admin lo pueda borrar, y otro para probar quién no puede.
insert into public.usuario (id, nombre, email, rol)
values ('00000000-0000-0000-0000-0000000000c9', 'Sin rastro', 'c9@nuevo.test', 'corte');

select is(
  pg_temp.intenta('a1', $q$insert into public.usuario (id, nombre, email, rol)
    values ('00000000-0000-0000-0000-0000000000c8', 'Nueva Persona', 'c8@nuevo.test', 'corte')$q$),
  'ok:1',
  'admin crea el perfil de una persona'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into public.usuario (id, nombre, email, rol)
    values ('00000000-0000-0000-0000-0000000000%s', 'Intruso', '%s@nuevo.test', 'admin')$q$, r.nuevo, r.nuevo)),
  '42501',
  format('%s no puede crear perfiles (menos aún uno admin)', r.rol)
)
from (values
  ('a2', 'secretaria', 'd1'), ('a3', 'diseno', 'd2'), ('a4', 'corte', 'd3'),
  ('a5', 'logistica', 'd4'), ('a6', 'marcacion', 'd5'), ('a7', 'terminacion', 'd6'),
  ('b2', 'admin desactivado', 'd7')
) as r(sufijo, rol, nuevo);

select is(
  pg_temp.intenta('a1', $q$update public.usuario set nombre = 'Renombrada' where id = '00000000-0000-0000-0000-0000000000a3'$q$),
  'ok:1',
  'admin edita un perfil'
);

select is(
  pg_temp.intenta('a2', $q$update public.usuario set rol = 'admin' where id = '00000000-0000-0000-0000-0000000000a2'$q$),
  'ok:0',
  'nadie se asciende a sí mismo: secretaría no puede cambiarse el rol'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$update public.usuario set activo = false where id = '00000000-0000-0000-0000-0000000000%s'$q$, r.sufijo)),
  'ok:0',
  format('%s no puede editar su propio perfil', r.rol)
)
from (values
  ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'), ('a6', 'marcacion'), ('b2', 'admin desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$delete from public.usuario where id = '00000000-0000-0000-0000-0000000000a2'$q$),
  '23503',
  'admin no borra a quien ya dejó rastro (avances): se desactiva, no se borra'
);

select is(
  pg_temp.intenta('a1', $q$delete from public.usuario where id = '00000000-0000-0000-0000-0000000000c8'$q$),
  'ok:1',
  'admin borra a quien no dejó rastro'
);

select is(
  pg_temp.intenta(r.sufijo, $q$delete from public.usuario where id = '00000000-0000-0000-0000-0000000000c9'$q$),
  'ok:0',
  format('%s no borra perfiles', r.rol)
)
from (values
  ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b2', 'admin desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', $q$update public.usuario set activo = false where id = '00000000-0000-0000-0000-0000000000a6'$q$),
  'ok:1',
  'admin desactiva una cuenta'
);

select is(
  pg_temp.intenta('a6', $q$select 1 from public.orden$q$),
  'ok:0',
  'la cuenta recién desactivada ya no ve nada'
);

select * from finish();
rollback;
