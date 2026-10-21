-- HU-13 + HU-18 · La factura tras una devolución (pruebas de la base).
--
-- El número de factura es inmutable mientras la orden tenga la factura
-- reportada o esté cerrada. Si administración devuelve la orden a antes de
-- `factura_generada`, el avance queda anulado y el número huérfano se puede
-- reemplazar; el avance anulado conserva la observación de la factura vieja.

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

-- 6001: lista para el cierre, con factura reportada y devuelta.
-- 6002: igual, pero se cierra al final.
select pg_temp.orden_nueva(6001);
select pg_temp.orden_nueva(6002);
select pg_temp.avance(pg_temp.id(n), cp)
from unnest(array[6001, 6002]) n,
     unnest(array['etiquetas', 'documentos_despacho']::public.checkpoint[]) cp;

select plan(11);

select ok(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-1')::text$q$, pg_temp.id(6001))) ~ '^[0-9a-f-]{36}$',
  'secretaría reporta la primera factura'
);

select is(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-2')::text$q$, pg_temp.id(6001))),
  'ERR:UE015',
  'sin devolver, un segundo número distinto sigue rechazado (UE015)'
);

select is(
  pg_temp.intenta('a2', format($q$update public.orden set numero_factura = 'FV-2' where id = %L$q$, pg_temp.id(6001))),
  'UE015',
  'y el UPDATE directo del número también (UE015)'
);

select ok(
  pg_temp.valor('a1', format($q$select public.devolver_orden_a_etapa(%L, 'documentos_despacho', 'Factura equivocada')::text$q$, pg_temp.id(6001))) ~ '^[0-9a-f-]{36}$',
  'administración devuelve la orden a antes de la factura'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = pg_temp.id(6001) and checkpoint = 'factura_generada' and anulado_por is null),
  0,
  'el avance de la factura quedó anulado'
);

select pg_temp.avance(pg_temp.id(6001), 'documentos_despacho');

select ok(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-2')::text$q$, pg_temp.id(6001))) ~ '^[0-9a-f-]{36}$',
  'tras la devolución se reporta otra factura distinta'
);

select is(
  (select numero_factura from public.orden where id = pg_temp.id(6001)),
  'FV-2',
  'el número de la orden es el nuevo'
);

select is(
  (select observaciones from public.avance_seccion
    where orden_id = pg_temp.id(6001) and checkpoint = 'factura_generada' and anulado_por is not null),
  'Factura FV-1',
  'el avance anulado conserva la observación de la factura vieja'
);

select is(
  pg_temp.valor('a2', format($q$select public.reportar_factura(%L, 'FV-3')::text$q$, pg_temp.id(6001))),
  'ERR:UE015',
  'con la nueva factura vigente, otro cambio vuelve a rechazarse (UE015)'
);

select pg_temp.avance(pg_temp.id(6002), 'factura_generada');
update public.orden set numero_factura = 'FV-9' where id = pg_temp.id(6002);
select pg_temp.avance(pg_temp.id(6002), 'cerrada');

select is(
  pg_temp.intenta('a2', format($q$update public.orden set numero_factura = 'FV-10' where id = %L$q$, pg_temp.id(6002))),
  'UE015',
  'con la orden cerrada el número no se cambia (UE015)'
);

select is(
  pg_temp.valor('a1', format($q$select public.devolver_orden_a_etapa(%L, 'factura_generada', 'x')::text$q$, pg_temp.id(6002))),
  'ERR:UE004',
  'y una orden cerrada no se devuelve, así que el número no queda huérfano (UE004)'
);

select * from finish();
rollback;
