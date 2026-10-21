-- Triggers del dominio: despacho a taller (UE001), corte esperando tela
-- (UE006) y llegada de tela inmutable y solo de secretaría (UE007).

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

-- 2001: sin recogido. 2002: recogida y bordada. 2003: con el corte pero sin
-- recogido. 2004: con la tela programada y una alerta de falta de tela abierta.
-- 2005: otra con alerta abierta (nadie la va a resolver) y una de entrega para secretaría.
select pg_temp.orden_nueva(n) from generate_series(2001, 2005) n;
select pg_temp.avance(pg_temp.id(2002), 'recogido_bordado');
select pg_temp.avance(pg_temp.id(2003), 'corte_completado');
select pg_temp.avance(pg_temp.id(2004), 'tela_programada');

insert into public.alerta (id, tipo, orden_id, destinatario_id, creada_por, detalle) values
  (pg_temp.id(7001), 'falta_tela', pg_temp.id(2004), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'Faltan 20 metros'),
  (pg_temp.id(7002), 'falta_tela', pg_temp.id(2005), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'Faltan 10 metros'),
  (pg_temp.id(7003), 'proximidad_entrega', pg_temp.id(2005), '00000000-0000-0000-0000-0000000000a2', null, 'Entrega pronto');

select plan(26);

-- ---------------------------------------------------------------------------
-- Despacho a taller: exige el recogido y bordado (UE001)
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('postgres', format(
    $q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
       values (%L, 'Taller', '5 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(2001))),
  'UE001',
  'no se despacha a taller una orden sin recogido y bordado (ni saltándose la RLS)'
);

select is(
  pg_temp.intenta('a5', format(
    $q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
       values (%L, 'Taller', '5 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(2001))),
  'UE001',
  'logística tampoco puede despachar una orden sin recogido y bordado'
);

select is(
  pg_temp.intenta('a5', format(
    $q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
       values (%L, 'Taller', '5 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(2003))),
  'UE001',
  'el corte completado no basta: se exige el recogido y bordado'
);

select is(
  pg_temp.intenta('a5', format(
    $q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
       values (%L, 'Taller', '5 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(2002))),
  'ok:1',
  'con el recogido y bordado hecho, logística despacha'
);

select is(
  pg_temp.intenta('a5', format(
    $q$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
       values (%L, 'Otro taller', '3 prendas', '00000000-0000-0000-0000-0000000000a5')$q$, pg_temp.id(2002))),
  'ok:1',
  'una orden puede repartirse en varios lotes'
);

-- ---------------------------------------------------------------------------
-- Corte: no mientras la orden espere tela (UE006)
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor('a4', format('select public.orden_espera_tela(%L)::text', pg_temp.id(2004))),
  'true',
  'una orden con alerta de tela sin llegada está esperando tela'
);

select is(
  pg_temp.valor('a4', format('select public.orden_espera_tela(%L)::text', pg_temp.id(2001))),
  'false',
  'una orden sin alerta de tela no espera nada'
);

select is(
  pg_temp.valor('a4', format('select count(*)::text from public.ordenes_esperando_tela() as e(orden_id) where orden_id = %L', pg_temp.id(2004))),
  '1',
  'ordenes_esperando_tela() lista la orden que espera tela (corte puede preguntarlo)'
);

select is(
  pg_temp.valor('a4', format('select count(*)::text from public.ordenes_esperando_tela() as e(orden_id) where orden_id = %L', pg_temp.id(2001))),
  '0',
  'y no lista la que no espera'
);

select is(
  pg_temp.intenta('a4', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'corte_completado', '00000000-0000-0000-0000-0000000000a4')$q$, pg_temp.id(2004))),
  'UE006',
  'corte no puede marcar el corte de una orden que espera tela'
);

select is(
  pg_temp.intenta('postgres', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'corte_completado', '00000000-0000-0000-0000-0000000000a4')$q$, pg_temp.id(2004))),
  'UE006',
  'ni siquiera saltándose la RLS (es un trigger)'
);

select is(
  pg_temp.intenta('a3', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'ficha_adjunta', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(2004))),
  'ok:1',
  'esperar tela solo frena el corte: los demás checkpoints siguen'
);

-- ---------------------------------------------------------------------------
-- La llegada de tela: solo secretaría, con hora y firma del servidor
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a1', format(
    $q$update public.alerta set tela_llegada_en = now(), tela_recibida_por = '00000000-0000-0000-0000-0000000000a1'
       where id = %L$q$, pg_temp.id(7002))),
  '42501',
  'ni admin (el destinatario de la alerta) puede marcar la llegada de la tela'
);

select is(
  pg_temp.intenta('a4', format(
    $q$update public.alerta set tela_llegada_en = now(), tela_recibida_por = '00000000-0000-0000-0000-0000000000a4'
       where id = %L$q$, pg_temp.id(7002))),
  'ok:0',
  'corte no ve la alerta de tela: no puede marcar que llegó (la RLS filtra la fila)'
);

select is(
  pg_temp.intenta('a2', format(
    $q$update public.alerta set tela_llegada_en = now(), tela_recibida_por = '00000000-0000-0000-0000-0000000000a2'
       where id = %L$q$, pg_temp.id(7003))),
  '23514',
  'la llegada de tela solo existe en alertas de falta de tela (alerta_llegada_tela_completa)'
);

select is(
  pg_temp.valor('a4', format('select public.orden_espera_tela(%L)::text', pg_temp.id(2005))),
  'true',
  'tras los intentos ajenos, la orden 2005 sigue esperando tela'
);

select is(
  pg_temp.intenta('a2', format(
    $q$update public.alerta set tela_llegada_en = '2000-01-01', tela_recibida_por = '00000000-0000-0000-0000-0000000000a1'
       where id = %L$q$, pg_temp.id(7001))),
  'ok:1',
  'secretaría marca la llegada de la tela'
);

select is(
  (select tela_llegada_en = now() from public.alerta where id = pg_temp.id(7001)),
  true,
  'la hora de llegada la pone el servidor, no la que mande el cliente'
);

select is(
  (select tela_recibida_por::text from public.alerta where id = pg_temp.id(7001)),
  '00000000-0000-0000-0000-0000000000a2',
  'quien recibió la tela sale de la sesión, no del cliente'
);

select is(
  (select estado::text || ' ' || (fecha_atencion = now())::text from public.alerta where id = pg_temp.id(7001)),
  'atendida true',
  'marcar la llegada deja la alerta atendida'
);

select is(
  pg_temp.valor('a4', format('select public.orden_espera_tela(%L)::text', pg_temp.id(2004))),
  'false',
  'con la tela llegada, la orden ya no espera'
);

select is(
  pg_temp.intenta('a4', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'corte_completado', '00000000-0000-0000-0000-0000000000a4')$q$, pg_temp.id(2004))),
  'ok:1',
  'con la tela llegada, corte puede marcar el corte'
);

-- Inmutable (UE007)
select is(
  pg_temp.intenta('a1', format(
    $q$update public.alerta set tela_llegada_en = now() + interval '1 day' where id = %L$q$, pg_temp.id(7001))),
  'ok:0',
  'la hora de llegada de la tela no se cambia después (ninguna política deja tocar una alerta atendida)'
);

select is(
  pg_temp.intenta('a1', format(
    $q$update public.alerta set tela_recibida_por = '00000000-0000-0000-0000-0000000000a1' where id = %L$q$, pg_temp.id(7001))),
  'ok:0',
  'quién recibió la tela no se cambia después (ninguna política deja tocar una alerta atendida)'
);

select is(
  pg_temp.intenta('postgres', format(
    $q$update public.alerta set tela_llegada_en = null, tela_recibida_por = null where id = %L$q$, pg_temp.id(7001))),
  'UE007',
  'la llegada no se borra, ni saltándose la RLS'
);

select is(
  pg_temp.intenta('a2', format(
    $q$update public.alerta set tela_llegada_en = now() + interval '1 day' where id = %L$q$, pg_temp.id(7001))),
  'ok:0',
  'secretaría tampoco la rehace: la política solo la deja marcar si aún no llegó'
);

select * from finish();
rollback;
