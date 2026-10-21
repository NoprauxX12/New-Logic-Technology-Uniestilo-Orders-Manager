-- Storage: el bucket `fichas` (HU-04).
--
-- Privado; lo lee cualquiera con sesión y perfil activo; solo diseño sube, y
-- solo a la carpeta de una orden que existe (`<orden_id>/<archivo>`); nadie
-- reescribe ni borra; anon no ve nada; no se pueden crear ni cambiar buckets.

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

select pg_temp.crear_usuario('b5', 'diseno', false);
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b3',
  'authenticated', 'authenticated', 'b3@prueba.test', now(), now(), now(),
  '{}', '{}', '', '', '', ''
);

-- Un bucket ajeno con un objeto, para comprobar que fichas no abre las demás puertas.
insert into storage.buckets (id, name, public) values ('otro-prueba', 'otro-prueba', false);
insert into storage.objects (bucket_id, name)
values ('otro-prueba', '00000000-0000-0000-0000-0000000000f1/secreto.pdf');
-- Una ficha ya subida (la del seed, o esta si el seed no sube archivos).
insert into storage.objects (bucket_id, name)
values ('fichas', '00000000-0000-0000-0000-0000000000f1/existente.pdf');

select plan(36);

select is(
  (select count(*)::int from storage.buckets where id = 'fichas' and not public),
  1,
  'el bucket fichas existe y es privado'
);

-- ---------------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------------

select ok(
  (select count(*) from storage.objects where bucket_id = 'fichas') >= 1,
  'hay al menos una ficha (si no, los chequeos de lectura serían vacíos)'
);

select is(
  pg_temp.intenta(r.sufijo, 'select 1 from storage.objects where bucket_id = ''fichas'''),
  'ok:' || (select count(*) from storage.objects where bucket_id = 'fichas'),
  format('%s lee todas las fichas', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno'), ('a4', 'corte'),
  ('a5', 'logistica'), ('a6', 'marcacion'), ('a7', 'terminacion')
) as r(sufijo, rol);

select is(
  pg_temp.intenta(r.sufijo, 'select 1 from storage.objects where bucket_id = ''fichas'''),
  'ok:0',
  format('%s no ve ninguna ficha', r.rol)
)
from (values
  ('anon', 'anon'), ('b5', 'diseño desactivado'), ('b3', 'quien tiene sesión pero no perfil')
) as r(sufijo, rol);

select is(
  pg_temp.intenta('a1', 'select 1 from storage.objects where bucket_id = ''otro-prueba'''),
  'ok:0',
  'ni admin lee objetos de un bucket que no tiene política'
);

-- ---------------------------------------------------------------------------
-- Escritura
-- ---------------------------------------------------------------------------

select is(
  pg_temp.intenta('a3', $q$insert into storage.objects (bucket_id, name)
    values ('fichas', '00000000-0000-0000-0000-0000000000f1/nueva.pdf')$q$),
  'ok:1',
  'diseño sube una ficha a la carpeta de una orden que existe'
);

select is(
  pg_temp.intenta('a3', $q$insert into storage.objects (bucket_id, name)
    values ('fichas', '00000000-0000-0000-0000-00000000dead/nueva.pdf')$q$),
  '42501',
  'diseño no puede subir a la carpeta de una orden que no existe'
);

select is(
  pg_temp.intenta('a3', $q$insert into storage.objects (bucket_id, name)
    values ('fichas', 'suelta.pdf')$q$),
  '42501',
  'diseño no puede subir un archivo fuera de la carpeta de una orden'
);

select is(
  pg_temp.intenta('a3', $q$insert into storage.objects (bucket_id, name)
    values ('otro-prueba', '00000000-0000-0000-0000-0000000000f1/otra.pdf')$q$),
  '42501',
  'diseño no puede subir a otro bucket'
);

select is(
  pg_temp.intenta(r.sufijo, format($q$insert into storage.objects (bucket_id, name)
    values ('fichas', '00000000-0000-0000-0000-0000000000f1/de-%s.pdf')$q$, r.sufijo)),
  '42501',
  format('%s no puede subir fichas', r.rol)
)
from (values
  ('anon', 'anon'), ('a1', 'admin'), ('a2', 'secretaria'), ('a4', 'corte'), ('a5', 'logistica'),
  ('a6', 'marcacion'), ('a7', 'terminacion'), ('b5', 'diseño desactivado')
) as r(sufijo, rol);

select is(
  pg_temp.intenta(r.sufijo, 'update storage.objects set name = ''00000000-0000-0000-0000-0000000000f1/cambiada.pdf'' where bucket_id = ''fichas'''),
  'ok:0',
  format('%s no puede renombrar ni reemplazar una ficha', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno')
) as r(sufijo, rol);

-- Storage además bloquea el DELETE directo con un trigger (42501): cualquiera de las dos salidas es "no se borra".
select ok(
  pg_temp.intenta(r.sufijo, 'delete from storage.objects where bucket_id = ''fichas''') in ('ok:0', '42501'),
  format('%s no puede borrar una ficha', r.rol)
)
from (values
  ('a1', 'admin'), ('a2', 'secretaria'), ('a3', 'diseno')
) as r(sufijo, rol);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'fichas' and name like '%/existente.pdf'),
  1,
  'la ficha existente sigue intacta tras los intentos'
);

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

select ok(
  pg_temp.intenta('a1', 'insert into storage.buckets (id, name, public) values (''publico-hack'', ''publico-hack'', true)') in ('42501', 'ok:0'),
  'admin no puede crear un bucket desde la API'
);

select ok(
  pg_temp.intenta('a3', 'update storage.buckets set public = true where id = ''fichas''') in ('42501', 'ok:0'),
  'diseño no puede volver público el bucket de fichas'
);

select is(
  (select public from storage.buckets where id = 'fichas'),
  false,
  'el bucket fichas sigue privado'
);

select is(
  (select count(*)::int from storage.buckets where id = 'publico-hack'),
  0,
  'no quedó ningún bucket público creado'
);

select * from finish();
rollback;
