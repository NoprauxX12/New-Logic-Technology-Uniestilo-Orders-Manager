-- avance_seccion: la bitácora de checkpoints.
--
-- Cada checkpoint lo inserta solo su rol dueño (rol_dueno), a su nombre; no se
-- repite; no se edita ni se borra (RNF-05); y una orden cerrada queda
-- congelada (trigger UE004).
--
-- El mapa checkpoint -> rol dueño está escrito a mano aquí a propósito: es el
-- oráculo independiente contra el que se compara lo que la base permite. Que
-- coincida con src/features/workflow/checkpoints.ts lo prueba un test de Vitest.

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
select pg_temp.crear_usuario('b5', 'diseno', false);

-- Una orden por checkpoint (ids 1001..1013) más tres sueltas: 1014 (inactivos),
-- 1015 (firma ajena y duplicados), 1016 (se cierra).
select pg_temp.orden_nueva(n) from generate_series(1001, 1016) n;

create temp table dueno (n int, checkpoint public.checkpoint, sufijo text);
insert into dueno values
  (1001, 'cotizacion_enviada',  'a2'),
  (1002, 'cotizacion_aprobada', 'a2'),
  (1003, 'programada_diseno',   'a2'),
  (1004, 'ficha_adjunta',       'a3'),
  (1005, 'tela_programada',     'a2'),
  (1006, 'corte_completado',    'a4'),
  (1007, 'recogido_bordado',    'a5'),
  (1008, 'llegada_marcacion',   'a6'),
  (1009, 'lista_despacho',      'a7'),
  (1010, 'etiquetas',           'a2'),
  (1011, 'documentos_despacho', 'a2'),
  (1012, 'factura_generada',    'a2'),
  (1013, 'cerrada',             'a2');

select plan(123);

select is(
  (select count(*)::int from dueno d
    where d.checkpoint = any(enum_range(null::public.checkpoint))),
  13,
  'el mapa de dueños cubre los 13 checkpoints (sin él, la matriz sería incompleta)'
);

-- ---------------------------------------------------------------------------
-- Nadie marca el checkpoint de otro (primero los rechazos, para que la orden
-- siga abierta cuando se prueba el de "cerrada")
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta(r.sufijo, format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, %L, '00000000-0000-0000-0000-0000000000%s')$q$,
    pg_temp.id(d.n), d.checkpoint, r.sufijo)),
  '42501',
  format('%s no puede marcar %s', r.rol, d.checkpoint)
)
from dueno d
cross join (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol)
where r.sufijo <> d.sufijo;

select is(
  pg_temp.intenta(d.sufijo, format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, %L, '00000000-0000-0000-0000-0000000000%s')$q$,
    pg_temp.id(d.n), d.checkpoint, d.sufijo)),
  'ok:1',
  format('el dueño marca %s', d.checkpoint)
)
from dueno d;

-- ---------------------------------------------------------------------------
-- Firma
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a2', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a1')$q$, pg_temp.id(1015))),
  '42501',
  'secretaría no puede firmar un avance a nombre de admin'
);

select is(
  pg_temp.intenta('a2', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(1015))),
  '42501',
  'secretaría no puede firmar un avance a nombre de otro rol'
);

select is(
  pg_temp.intenta('b1', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000b1')$q$, pg_temp.id(1014))),
  '42501',
  'una secretaria desactivada no puede marcar su propio checkpoint'
);

select is(
  pg_temp.intenta('b5', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'ficha_adjunta', '00000000-0000-0000-0000-0000000000b5')$q$, pg_temp.id(1014))),
  '42501',
  'una persona de diseño desactivada no puede marcar la ficha'
);

select is(
  pg_temp.intenta('a2', $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
    values (gen_random_uuid(), 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a2')$q$),
  '23503',
  'no se marca un avance sobre una orden que no existe'
);

-- ---------------------------------------------------------------------------
-- Sin duplicados
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a2', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a2')$q$, pg_temp.id(1001))),
  '23505',
  'el dueño no puede marcar dos veces el mismo checkpoint'
);

select is(
  pg_temp.intenta('postgres', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'ficha_adjunta', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(1004))),
  '23505',
  'el índice único (orden, checkpoint) también frena a quien salta la RLS'
);

-- ---------------------------------------------------------------------------
-- Inmutable: ni update ni delete, para nadie
-- ---------------------------------------------------------------------------

select is_empty(
  $$select policyname from pg_policies
    where schemaname = 'public' and tablename = 'avance_seccion'
      and cmd in ('UPDATE', 'DELETE', 'ALL')$$,
  'avance_seccion no tiene políticas de UPDATE ni de DELETE'
);

select is(
  pg_temp.intenta(r.sufijo, 'update public.avance_seccion set observaciones = ''editado'', usuario_id = ''00000000-0000-0000-0000-0000000000a1'''),
  'ok:0',
  format('%s no puede editar ningún avance', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion'),
  ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  pg_temp.intenta(r.sufijo, 'delete from public.avance_seccion'),
  'ok:0',
  format('%s no puede borrar ningún avance', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion'),
  ('b1', 'secretaria desactivada')
) as r(sufijo, rol);

select is(
  (select count(*)::int from public.avance_seccion where orden_id = pg_temp.id(1001)),
  1,
  'tras todos los intentos de editar y borrar, la bitácora sigue intacta'
);

-- ---------------------------------------------------------------------------
-- Orden cerrada: congelada (UE004), incluso para el dueño legítimo
-- ---------------------------------------------------------------------------

select pg_temp.avance(pg_temp.id(1016), 'cerrada');

select is(
  pg_temp.intenta('a2', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a2')$q$, pg_temp.id(1016))),
  'UE004',
  'secretaría no puede agregar un avance a una orden cerrada'
);

select is(
  pg_temp.intenta('a3', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'ficha_adjunta', '00000000-0000-0000-0000-0000000000a3')$q$, pg_temp.id(1016))),
  'UE004',
  'diseño tampoco, aunque la ficha sea suya'
);

select is(
  pg_temp.intenta('postgres', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'corte_completado', '00000000-0000-0000-0000-0000000000a4')$q$, pg_temp.id(1016))),
  'UE004',
  'ni siquiera quien salta la RLS puede tocar una orden cerrada (es un trigger)'
);

select is(
  pg_temp.intenta('a2', $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
    values ('00000000-0000-0000-0000-0000000000f7', 'etiquetas', '00000000-0000-0000-0000-0000000000a2')$q$),
  'UE004',
  'la orden cerrada del seed (OC-5007) también está congelada'
);

select is(
  pg_temp.intenta('a2', format(
    $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
       values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a2')$q$, pg_temp.id(1014))),
  'ok:1',
  'una orden abierta, en cambio, sí admite el avance (control del bloque anterior)'
);

-- ---------------------------------------------------------------------------
-- Auditoría: la hora del avance
-- ---------------------------------------------------------------------------

select count(pg_temp.intenta('a2', format(
  $q$insert into public.avance_seccion (orden_id, checkpoint, usuario_id, fecha_hora)
     values (%L, 'cotizacion_enviada', '00000000-0000-0000-0000-0000000000a2', now() - interval '30 days')$q$,
  pg_temp.id(1015)))) as intentos_de_fechar_en_el_pasado;

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = pg_temp.id(1015) and fecha_hora < now() - interval '1 day'),
  0,
  'un avance no puede quedar fechado en el pasado por quien lo marca'
);

select * from finish();
rollback;
