-- Esquema y permisos: lo que no depende de los datos.
--
-- Toda tabla con RLS, nada legible por anon, el bucket de fichas privado, y
-- quién puede ejecutar qué función. Si alguien agrega una tabla sin RLS o una
-- función con EXECUTE para PUBLIC, este archivo lo avisa.
--
-- Se corre con `npm run test:db`.

begin;
create extension if not exists pgtap with schema extensions;

-- Funciones del dominio que cualquier persona con sesión puede llamar (el
-- resto de las funciones de `public` o es de trigger o es interna).
create function pg_temp.funciones_de(p_rol text, p_trigger boolean)
returns text[] language sql as $$
  select coalesce(array_agg(p.proname::text order by p.proname), '{}')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.prorettype = 'trigger'::regtype) = p_trigger
    and has_function_privilege(p_rol, p.oid, 'execute')
$$;

-- Cierto si PUBLIC tiene EXECUTE sobre la función (Postgres lo concede por
-- defecto y quitárselo solo a `anon` no basta).
create function pg_temp.publico_ejecuta(p_oid oid)
returns boolean language sql as $$
  select exists (
    select 1
    from pg_proc p,
         aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = p_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  )
$$;

create function pg_temp.job_de_alertas_agendado()
returns boolean language plpgsql as $$
declare v boolean;
begin
  if to_regclass('cron.job') is null then
    return true; -- sin pg_cron no hay nada que verificar (la migración solo avisa)
  end if;
  execute $q$
    select exists (
      select 1 from cron.job
      where jobname = 'alertas-proximidad-entrega'
        and command = 'select public.generar_alertas_proximidad_entrega()'
    )
  $q$ into v;
  return v;
end $$;

select plan(29);

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas
-- ---------------------------------------------------------------------------

select cmp_ok(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')),
  '>=', 8, 'hay al menos las 8 tablas del dominio (que el chequeo de RLS no sea vacío)'
);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity$$,
  'toda tabla de public tiene RLS habilitada'
);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege('anon', c.oid,
        'select,insert,update,delete,truncate,references,trigger')$$,
  'anon no tiene ningún permiso sobre ninguna tabla de public'
);

select is_empty(
  $$select s.oid::regclass from (
      select c.oid from pg_class c
      where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace offset 0
    ) s
    where has_sequence_privilege('anon', s.oid, 'usage,select,update')$$,
  'anon no tiene permisos sobre las secuencias de public'
);

select is_empty(
  $$select tablename, policyname from pg_policies
    where schemaname in ('public', 'storage')
      and ('anon' = any(roles) or 'public' = any(roles))$$,
  'ninguna política de public ni de storage se aplica a anon ni a public'
);

select is_empty(
  $$select tablename, policyname from pg_policies
    where schemaname in ('public', 'storage')
      and (trim(qual) = 'true' or trim(with_check) = 'true')
      and policyname <> 'auth admin lee el rol para el hook del JWT'$$,
  'ninguna política es "using (true)": no vuelven las políticas temporales de HU-17'
);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = c.relname)$$,
  'toda tabla de public tiene al menos una política (RLS sin políticas la deja inservible)'
);

-- Defensa en profundidad: RLS no se aplica a TRUNCATE, así que el permiso no
-- debería existir. Hoy lo concede el valor por defecto de Supabase.
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('authenticated', c.oid, 'truncate')$$,
  'authenticated no puede hacer TRUNCATE sobre las tablas del dominio'
);

-- ---------------------------------------------------------------------------
-- Columnas: lo que authenticated puede actualizar con UPDATE directo
-- ---------------------------------------------------------------------------

select is(
  (select coalesce(array_agg(column_name::text order by column_name), '{}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'orden'
      and has_column_privilege('authenticated', 'public.orden', column_name, 'update')),
  array['numero_factura'],
  'en orden, authenticated solo puede actualizar numero_factura (la hoja y el turno van por la función)'
);

-- La migración programar_tela_por_item hace `grant update (columnas)`, pero
-- item_orden ya tenía UPDATE sobre toda la tabla por los permisos por defecto
-- de Supabase (a orden y a alerta sí se les hizo `revoke update` antes).
select is(
  (select coalesce(array_agg(column_name::text order by column_name), '{}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'item_orden'
      and has_column_privilege('authenticated', 'public.item_orden', column_name, 'update')),
  array['cantidad_tela', 'observaciones_tela', 'tipo_tela', 'unidad_tela'],
  'en item_orden, authenticated solo actualiza los datos de la tela'
);

select is(
  (select coalesce(array_agg(column_name::text order by column_name), '{}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'alerta'
      and has_column_privilege('authenticated', 'public.alerta', column_name, 'update')),
  array['estado', 'fecha_atencion', 'tela_llegada_en', 'tela_recibida_por'],
  'en alerta, authenticated solo actualiza la atención y la llegada de tela'
);

-- ---------------------------------------------------------------------------
-- Funciones: quién ejecuta qué
-- ---------------------------------------------------------------------------

select is(
  pg_temp.funciones_de('anon', false),
  '{}'::text[],
  'anon no ejecuta ninguna función de public (las que no son de trigger)'
);

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
      and pg_temp.publico_ejecuta(p.oid)$$,
  'PUBLIC no tiene EXECUTE sobre ninguna función de public (las que no son de trigger)'
);

select is(
  pg_temp.funciones_de('authenticated', false),
  array[
    'crear_orden_de_correccion', 'devolver_orden_a_etapa',
    'nit_normalizado', 'orden_espera_tela', 'ordenes_esperando_tela',
    'programar_ordenes_a_diseno', 'programar_tela', 'registrar_orden',
    'reportar_factura', 'rol_actual', 'rol_dueno'
  ],
  'authenticated ejecuta exactamente estas funciones: una nueva exige decidirlo aquí'
);

select ok(
  not has_function_privilege('anon', 'public.generar_alertas_proximidad_entrega(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.generar_alertas_proximidad_entrega(integer)', 'execute')
  and not pg_temp.publico_ejecuta('public.generar_alertas_proximidad_entrega(integer)'::regprocedure),
  'generar_alertas_proximidad_entrega no la ejecuta anon, authenticated ni PUBLIC (solo pg_cron)'
);

select ok(
  not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not pg_temp.publico_ejecuta('public.custom_access_token_hook(jsonb)'::regprocedure)
  and has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'el hook del JWT solo lo ejecuta supabase_auth_admin'
);

-- Las de trigger no se pueden llamar a mano (Postgres lo impide), pero igual
-- no deberían estar abiertas: lo consistente con el resto es cerrarlas.
select is(
  pg_temp.funciones_de('anon', true),
  '{}'::text[],
  'anon no ejecuta funciones de trigger'
);
select is(
  pg_temp.funciones_de('authenticated', true),
  '{}'::text[],
  'authenticated no ejecuta funciones de trigger'
);

-- SECURITY DEFINER es la excepción al ADR 0005: la lista es cerrada.
select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef),
  array[
    'devolver_orden_a_etapa', 'generar_alertas_proximidad_entrega',
    'orden_espera_tela', 'ordenes_esperando_tela',
    'programar_ordenes_a_diseno', 'rol_actual'
  ],
  'las únicas funciones SECURITY DEFINER son las documentadas'
);

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not coalesce(p.proconfig, '{}') && array['search_path=""']$$,
  'toda función de public fija search_path = '''' (nadie puede redirigirla)'
);

-- ---------------------------------------------------------------------------
-- rol_dueno cubre los 13 checkpoints
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from unnest(enum_range(null::public.checkpoint))),
  13,
  'el enum checkpoint tiene 13 valores'
);

select is_empty(
  $$select cp from unnest(enum_range(null::public.checkpoint)) cp
    where public.rol_dueno(cp) is null$$,
  'rol_dueno devuelve un rol para cada uno de los 13 checkpoints'
);

select is(
  (select count(distinct public.rol_dueno(cp))::int
     from unnest(enum_range(null::public.checkpoint)) cp),
  6,
  'los checkpoints los reparten 6 roles (secretaria, diseno, corte, logistica, marcacion, terminacion)'
);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'fichas'),
  false,
  'el bucket fichas es privado'
);

select is(
  (select count(*)::int from storage.buckets where public),
  0,
  'ningún bucket es público'
);

select ok(
  (select count(*) from storage.buckets where id = 'fichas' and file_size_limit = 10485760
     and allowed_mime_types @> array['application/pdf']) = 1,
  'fichas limita el tamaño a 10 MB y permite PDF'
);

-- ---------------------------------------------------------------------------
-- Migraciones y cron
-- ---------------------------------------------------------------------------

select ok(
  pg_temp.job_de_alertas_agendado(),
  'el job diario de alertas de entrega está agendado en pg_cron'
);

select is(
  (select count(*)::int from pg_trigger t
    where not t.tgisinternal
      and t.tgname in (
        'lote_taller_exige_recogido_bordado',
        'avance_seccion_no_tocar_orden_cerrada',
        'avance_seccion_exige_tela_para_cortar',
        'alerta_protege_llegada_de_tela')),
  4,
  'están los 4 triggers del dominio'
);

select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'avance_seccion_orden_checkpoint_idx',
        'orden_numero_orden_compra_unico_idx',
        'cliente_nit_unico_idx',
        'orden_programacion_unica_idx',
        'alerta_falta_tela_abierta_idx',
        'alerta_proximidad_entrega_unica_idx')),
  6,
  'están los 6 índices únicos que sostienen las reglas de unicidad'
);

select * from finish();
rollback;
