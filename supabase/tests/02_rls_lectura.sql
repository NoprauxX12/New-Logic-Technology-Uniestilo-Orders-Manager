-- RLS de lectura.
--
-- Qué ve cada rol en cada tabla (ADR 0007: toda persona con sesión y perfil
-- activo lee todo; las alertas son la excepción), que anon no ve ni la
-- existencia de las tablas, y que una cuenta desactivada o sin perfil queda
-- afuera aunque su JWT sea válido (rol_actual() devuelve null).

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

-- Una cuenta desactivada (secretaria y admin) y una con sesión pero sin perfil.
select pg_temp.crear_usuario('b1', 'secretaria', false);
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

-- Una alerta dirigida a cada cuenta desactivada: sin ellas, comprobar que no
-- ven alertas sería un chequeo vacío.
insert into public.alerta (tipo, orden_id, destinatario_id, detalle)
select 'proximidad_entrega', '00000000-0000-0000-0000-0000000000f4', u, 'alerta de prueba'
from unnest(array[
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'
]::uuid[]) u;

select plan(110);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('anon', format('select 1 from public.%I', t)),
  '42501',
  format('anon no puede leer %s (sin permiso de tabla)', t)
)
from unnest(array[
  'cliente', 'orden', 'item_orden', 'avance_seccion',
  'lote_taller', 'ficha_tecnica', 'alerta', 'usuario'
]) as t;

select is(
  pg_temp.intenta('anon', 'select 1 from storage.objects'),
  'ok:0',
  'anon no ve ningún objeto de Storage'
);

select is(
  pg_temp.valor('anon', 'select public.rol_actual()::text'),
  'ERR:42501',
  'anon ni siquiera puede preguntar por su rol'
);

-- ---------------------------------------------------------------------------
-- Cada rol activo lee lo mismo (todo) en las tablas del flujo
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta(r.sufijo, format('select 1 from public.%I', t)),
  'ok:' || pg_temp.total(t),
  format('%s lee todas las filas de %s', r.rol, t)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol)
cross join unnest(array[
  'cliente', 'orden', 'item_orden', 'avance_seccion',
  'lote_taller', 'ficha_tecnica', 'usuario'
]) as t;

select ok(
  pg_temp.total(t) > 0,
  format('el seed trae filas de %s (si no, los chequeos de lectura serían vacíos)', t)
)
from unnest(array[
  'cliente', 'orden', 'item_orden', 'avance_seccion',
  'lote_taller', 'ficha_tecnica', 'usuario', 'alerta'
]) as t;

-- ---------------------------------------------------------------------------
-- Alertas: cada quien ve las suyas; admin ve todas; secretaría ve las de tela
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a1', 'select 1 from public.alerta'),
  'ok:' || pg_temp.total('alerta'),
  'admin ve todas las alertas'
);

select is(
  pg_temp.intenta('a2', 'select 1 from public.alerta'),
  'ok:' || (select count(*) from public.alerta
             where tipo = 'falta_tela' or destinatario_id = '00000000-0000-0000-0000-0000000000a2'),
  'secretaría ve las alertas de falta de tela y las suyas'
);

select is(
  pg_temp.intenta('a5', 'select 1 from public.alerta'),
  'ok:' || (select count(*) from public.alerta
             where destinatario_id = '00000000-0000-0000-0000-0000000000a5'),
  'logística ve solo las alertas que le llegan a ella'
);

select is(
  pg_temp.intenta(r.sufijo, 'select 1 from public.alerta'),
  'ok:' || (select count(*) from public.alerta
             where destinatario_id = ('00000000-0000-0000-0000-0000000000' || r.sufijo)::uuid),
  format('%s ve solo las alertas que le llegan a él (ninguna ajena)', r.rol)
)
from (values
  ('a3', 'diseno'), ('a4', 'corte'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a4', 'select 1 from public.alerta'),
  'ok:0',
  'corte no ve ninguna de las alertas del seed (ninguna es para corte)'
);

-- ---------------------------------------------------------------------------
-- rol_actual(): lo que decide todo lo demás
-- ---------------------------------------------------------------------------

select is(
  pg_temp.valor(r.sufijo, 'select public.rol_actual()::text'),
  r.rol,
  format('rol_actual() de %s es %s', r.sufijo, r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol);

select is(
  pg_temp.valor(x.sufijo, 'select public.rol_actual()::text'),
  null,
  format('rol_actual() de %s es null (%s)', x.sufijo, x.motivo)
)
from (values
  ('b1', 'cuenta desactivada'), ('b2', 'admin desactivado'), ('b3', 'sin perfil')
) as x(sufijo, motivo);

-- ---------------------------------------------------------------------------
-- Cuenta desactivada o sin perfil: el JWT es válido pero no ve nada
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta(p.sufijo, format('select 1 from public.%I', t)),
  'ok:0',
  format('%s no ve nada de %s', p.descripcion, t)
)
from (values
  ('b1', 'la secretaria desactivada'),
  ('b2', 'el admin desactivado'),
  ('b3', 'quien tiene sesión pero no perfil')
) as p(sufijo, descripcion)
cross join unnest(array[
  'cliente', 'orden', 'item_orden', 'avance_seccion',
  'lote_taller', 'ficha_tecnica', 'usuario'
]) as t;

-- La política "alerta propia o admin" solo mira destinatario_id = auth.uid(),
-- sin pasar por rol_actual(): una cuenta desactivada sigue viendo sus alertas.
select is(
  pg_temp.intenta(p.sufijo, 'select 1 from public.alerta'),
  'ok:0',
  format('%s no ve ninguna alerta', p.descripcion)
)
from (values
  ('b1', 'la secretaria desactivada'),
  ('b2', 'el admin desactivado'),
  ('b3', 'quien tiene sesión pero no perfil')
) as p(sufijo, descripcion);

-- Desactivar a alguien le quita el acceso al instante, sin tocar su JWT.
update public.usuario set activo = false
where id = '00000000-0000-0000-0000-0000000000a4';

select is(
  pg_temp.intenta('a4', 'select 1 from public.orden'),
  'ok:0',
  'al desactivar a corte (a4), deja de ver las órdenes en la misma sesión'
);

select * from finish();
rollback;
