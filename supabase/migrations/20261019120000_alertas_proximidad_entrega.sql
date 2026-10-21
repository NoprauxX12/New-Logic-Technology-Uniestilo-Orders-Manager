-- HU-20 · Alertar por proximidad a la fecha de entrega.
--
-- Una vez al día la base revisa las órdenes que no se han cerrado. Si a una le
-- faltan 3 días o menos para la entrega (o ya se pasó), avisa a TODA la
-- administración activa y a las cuentas del área donde está parada la orden.
-- Las alertas son filas de `alerta` (regla 8), no mensajes que se pierden.
--
-- Se genera en la base con pg_cron y no con un cron de Vercel: así escribir en
-- las tablas del dominio no exige la secret key en la aplicación.
--
-- Los 3 días están en un solo lugar de la aplicación
-- (`DIAS_ALERTA_ENTREGA` en `src/features/alertas/reglas.ts`) y aquí como valor
-- por defecto de la función; un test comprueba que coincidan.

-- ---------------------------------------------------------------------------
-- 1. Una alerta de entrega por orden y por persona
-- ---------------------------------------------------------------------------
-- No mira el estado: quien ya la atendió no la vuelve a recibir al día
-- siguiente. Si la orden cambia de área, el nuevo destinatario sí recibe la
-- suya, porque es otra pareja (orden, persona).

create unique index alerta_proximidad_entrega_unica_idx
  on public.alerta (orden_id, destinatario_id)
  where tipo = 'proximidad_entrega';

-- ---------------------------------------------------------------------------
-- 2. La función que genera las alertas
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque escribe alertas a nombre del sistema (`creada_por`
-- queda vacío: ninguna persona la creó) y para todos los destinatarios, cosa
-- que ninguna política de RLS le permite a un usuario. Por eso no la puede
-- ejecutar nadie con sesión: solo el dueño de la función, que es quien corre el
-- job de pg_cron.
--
-- El área donde está parada la orden es el rol dueño de la siguiente etapa: la
-- primera, en el orden del enum `checkpoint` (que es el orden del flujo), que
-- queda por delante de la etapa más avanzada ya marcada. Si la orden tiene un
-- lote en taller sin recibir, el área incluye también a logística.
--
-- Devuelve cuántas alertas creó. Es idempotente: correrla dos veces el mismo día
-- no duplica nada.

create or replace function public.generar_alertas_proximidad_entrega(
  p_dias integer default 3
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- "Hoy" es el día en Colombia, no el del servidor (que está en UTC).
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_creadas integer;
begin
  with candidatas as (
    select
      o.id as orden_id,
      o.numero_orden_compra,
      o.fecha_entrega,
      c.razon_social,
      (o.fecha_entrega - v_hoy) as dias,
      siguiente.etapa,
      exists (
        select 1
        from public.lote_taller l
        where l.orden_id = o.id
          and l.recibido_completo is null
      ) as en_taller
    from public.orden o
    join public.cliente c on c.id = o.cliente_id
    cross join lateral (
      select max(a.checkpoint) as ultimo
      from public.avance_seccion a
      where a.orden_id = o.id
    ) as avanzado
    cross join lateral (
      select e as etapa
      from unnest(enum_range(null::public.checkpoint)) as e
      where avanzado.ultimo is null or e > avanzado.ultimo
      order by e
      limit 1
    ) as siguiente
    where (o.fecha_entrega - v_hoy) <= p_dias
      and not exists (
        select 1
        from public.avance_seccion a
        where a.orden_id = o.id
          and a.checkpoint = 'cerrada'
      )
  ),
  con_area as (
    select
      cand.*,
      case
        when cand.en_taller then 'el taller'
        else case cand.etapa::text
          when 'cotizacion_enviada'  then 'Cotización'
          when 'cotizacion_aprobada' then 'Cotización'
          when 'programada_diseno'   then 'Programación a diseño'
          when 'ficha_adjunta'       then 'Diseño'
          when 'tela_programada'     then 'Programación de tela'
          when 'corte_completado'    then 'Corte'
          when 'recogido_bordado'    then 'Recogido y bordado'
          when 'llegada_marcacion'   then 'Marcación'
          when 'lista_despacho'      then 'Terminación'
          else 'el cierre de la orden'
        end
      end as area
    from candidatas cand
  ),
  destinatarios as (
    select a.orden_id, u.id as usuario_id
    from con_area a
    join public.usuario u
      on u.activo
     and (
       u.rol = 'admin'
       or u.rol = public.rol_dueno(a.etapa)
       or (a.en_taller and u.rol = 'logistica')
     )
  ),
  nuevas as (
    insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    select
      'proximidad_entrega',
      a.orden_id,
      d.usuario_id,
      null,
      'La orden ' || a.numero_orden_compra || ' de ' || a.razon_social || ' '
        || case
             when a.dias < 0 then
               'se venció hace ' || (-a.dias)
                 || case when a.dias = -1 then ' día' else ' días' end
             when a.dias = 0 then 'entrega hoy'
             when a.dias = 1 then 'entrega mañana'
             else 'entrega en ' || a.dias || ' días'
           end
        || case
             when a.dias = 0 then ''
             else ' (' || to_char(a.fecha_entrega, 'DD/MM') || ')'
           end
        || ' y está en ' || a.area
    from con_area a
    join destinatarios d on d.orden_id = a.orden_id
    on conflict (orden_id, destinatario_id) where tipo = 'proximidad_entrega'
    do nothing
    returning 1
  )
  select count(*) into v_creadas from nuevas;

  return v_creadas;
end;
$$;

comment on function public.generar_alertas_proximidad_entrega is
  'HU-20: crea las alertas de entrega próxima o vencida (a administración y al área de la orden). La corre pg_cron cada día; nadie con sesión puede ejecutarla.';

-- Postgres le da EXECUTE a `public` por defecto, y Supabase se lo da además a
-- `anon`, `authenticated` y `service_role` al crear funciones en `public`.
revoke execute on function public.generar_alertas_proximidad_entrega(integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. El job diario: 6:00 a. m. hora de Colombia (11:00 UTC)
-- ---------------------------------------------------------------------------
-- `cron.schedule` con el mismo nombre reemplaza el job, así que la migración se
-- puede repetir. Si la extensión no se puede habilitar en el entorno, se avisa
-- y no se rompe la migración: la función sigue existiendo y se puede correr a
-- mano (en el proyecto hospedado, Database → Extensions → pg_cron).

do $$
begin
  create extension if not exists pg_cron;

  perform cron.schedule(
    'alertas-proximidad-entrega',
    '0 11 * * *',
    'select public.generar_alertas_proximidad_entrega()'
  );
exception
  when others then
    raise warning 'HU-20: no se pudo agendar el job de pg_cron (%). Habilita la extensión y agéndalo a mano.', sqlerrm;
end $$;
