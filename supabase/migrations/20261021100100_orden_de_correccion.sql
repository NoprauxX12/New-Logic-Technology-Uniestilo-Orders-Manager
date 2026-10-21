-- HU-18 · Orden de corrección para una orden ya cerrada.
--
-- Si el defecto aparece después del cierre, la orden original no se toca: se
-- crea una orden NUEVA enlazada con `orden.orden_original_id` (columna que
-- existe desde HU-01). Esta migración agrega:
--
--   1. `orden.etapa_inicial`: la etapa por la que la corrección entra al flujo.
--      Las anteriores se muestran como "No aplicó". No se fabrican avances
--      firmados en nombre de otras secciones: la bitácora solo dice lo que
--      alguien marcó de verdad. Null = la orden recorre todo el flujo.
--   2. `crear_orden_de_correccion`: crea la orden y sus prendas en una sola
--      transacción.
--   3. La alerta de entrega (HU-20) respeta la etapa inicial al calcular en qué
--      área está parada la orden.
--
-- Ver `docs/adr/0011`.

-- ---------------------------------------------------------------------------
-- 1. orden.etapa_inicial
-- ---------------------------------------------------------------------------

alter table public.orden
  add column etapa_inicial public.checkpoint;

-- Solo las correcciones entran a mitad del flujo, y solo por una etapa desde la
-- que pueden llegar al final sin avances previos. Quedan fuera las de cierre
-- (van después de "lista para despachar") y dos que atascarían la orden:
-- "tela_programada" (`programar_tela` exige la ficha técnica vigente) y
-- "llegada_marcacion" (exige un lote recibido, y despachar exige el recogido y
-- bordado vigente).
alter table public.orden
  add constraint orden_etapa_inicial_valida
    check (
      etapa_inicial is null
      or (
        orden_original_id is not null
        and etapa_inicial in (
          'cotizacion_enviada', 'cotizacion_aprobada', 'programada_diseno',
          'ficha_adjunta', 'corte_completado', 'recogido_bordado',
          'lista_despacho'
        )
      )
    );

comment on column public.orden.etapa_inicial is
  'HU-18: etapa por la que una orden de corrección entra al flujo; las anteriores no aplican. Null en las órdenes normales.';

-- Una orden de corrección de la misma original no repite número, ya lo cubre el
-- índice único de `numero_orden_compra`. Este índice solo acelera listar las
-- correcciones de una orden.
create index orden_original_id_idx on public.orden (orden_original_id)
  where orden_original_id is not null;

-- ---------------------------------------------------------------------------
-- 2. crear_orden_de_correccion
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (ADR 0005): `orden` e `item_orden` solo permiten el alta a
-- administración (RLS), y la política de `orden` exige además
-- `creado_por = auth.uid()`. Así RLS sigue siendo la barrera; la función
-- agrega el aviso claro de rol y las reglas de negocio.
--
-- Prendas (`p_items`): arreglo de {item_id, cantidad, tallas}, con `item_id` de
-- una prenda de la original. La cantidad es de 1 hasta la de la original y las
-- tallas son texto libre (tallaje 'otro'), porque lo defectuoso rara vez
-- coincide con la cuadrícula de tallas de la orden. El valor de cada prenda es
-- 0: es trabajo repetido sobre prendas ya cobradas en la original.
--
-- Número: el de la orden corregida + '-C' + consecutivo de sus correcciones
-- (OC-5007-C1, OC-5007-C2…). Si el candidato ya existe (sin distinguir
-- mayúsculas) se sigue con el siguiente.

create function public.crear_orden_de_correccion(
  p_orden_original_id uuid,
  p_fecha_entrega date,
  p_motivo text,
  p_etapa_inicial public.checkpoint,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_original public.orden%rowtype;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_consecutivo integer;
  v_numero text;
  v_orden_id uuid;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa'
      using errcode = 'UE006';
  end if;

  if public.rol_actual() is distinct from 'admin'::public.rol then
    raise exception 'Las órdenes de corrección las crea administración'
      using errcode = 'UE007';
  end if;

  if length(v_motivo) not between 1 and 500 then
    raise exception 'Escribe el motivo de la corrección (máximo 500 letras)'
      using errcode = 'UE010';
  end if;

  if p_etapa_inicial is null or p_etapa_inicial not in (
      'cotizacion_enviada', 'cotizacion_aprobada', 'programada_diseno',
      'ficha_adjunta', 'corte_completado', 'recogido_bordado',
      'lista_despacho'
    ) then
    raise exception 'Elige una etapa de entrada válida para la corrección'
      using errcode = 'UE010';
  end if;

  -- Serializa las correcciones de una misma original: sin esto, dos a la vez
  -- calcularían el mismo consecutivo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_orden_original_id::text, 1)
  );

  select * into v_original
  from public.orden
  where id = p_orden_original_id;

  if not found then
    raise exception 'La orden indicada no existe'
      using errcode = 'UE005';
  end if;

  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_original_id
      and checkpoint = 'cerrada'
      and anulado_por is null
  ) then
    raise exception 'La orden todavía no está cerrada: si va en producción, devuélvela a la etapa que corresponda'
      using errcode = 'UE012';
  end if;

  if p_fecha_entrega is null or p_fecha_entrega < v_hoy then
    raise exception 'La fecha de entrega no puede ser anterior a hoy'
      using errcode = 'UE010';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Elige al menos una prenda defectuosa'
      using errcode = 'UE010';
  end if;

  select count(*) into v_total from jsonb_array_elements(p_items);

  if (
    select count(distinct x.item_id)
    from jsonb_to_recordset(p_items) as x(item_id uuid)
  ) <> v_total then
    raise exception 'Hay prendas repetidas o sin identificar'
      using errcode = 'UE013';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(
      item_id uuid, cantidad integer, tallas text
    )
    left join public.item_orden i
      on i.id = x.item_id and i.orden_id = p_orden_original_id
    where i.id is null
      or x.cantidad is null
      or x.cantidad < 1
      or x.cantidad > i.cantidad
      or length(trim(coalesce(x.tallas, ''))) not between 1 and 300
  ) then
    raise exception 'Revisa las prendas: la cantidad va de 1 hasta la de la orden original y hay que escribir las tallas'
      using errcode = 'UE013';
  end if;

  select count(*) + 1 into v_consecutivo
  from public.orden
  where orden_original_id = p_orden_original_id;

  loop
    v_numero := v_original.numero_orden_compra || '-C' || v_consecutivo;
    exit when not exists (
      select 1
      from public.orden
      where upper(numero_orden_compra) = upper(v_numero)
    );
    v_consecutivo := v_consecutivo + 1;
  end loop;

  insert into public.orden (
    numero_orden_compra,
    cliente_id,
    fecha_ingreso,
    fecha_entrega,
    observaciones,
    orden_original_id,
    etapa_inicial,
    creado_por
  )
  values (
    v_numero,
    v_original.cliente_id,
    v_hoy,
    p_fecha_entrega,
    'Corrección de ' || v_original.numero_orden_compra || '. Motivo: ' || v_motivo,
    p_orden_original_id,
    p_etapa_inicial,
    auth.uid()
  )
  returning id into v_orden_id;

  insert into public.item_orden (
    orden_id, descripcion, cantidad, tallas, tallaje, valor, observaciones
  )
  select
    v_orden_id,
    i.descripcion,
    x.cantidad,
    trim(x.tallas),
    'otro',
    0,
    'Prenda defectuosa de ' || v_original.numero_orden_compra
  from jsonb_to_recordset(p_items) as x(
    item_id uuid, cantidad integer, tallas text
  )
  join public.item_orden i on i.id = x.item_id;

  return v_orden_id;
end;
$$;

comment on function public.crear_orden_de_correccion is
  'HU-18: crea una orden de corrección enlazada a una orden cerrada, con las prendas defectuosas elegidas y la etapa por la que entra al flujo. Solo administración.';

revoke execute on function public.crear_orden_de_correccion(uuid, date, text, public.checkpoint, jsonb)
  from public, anon;

grant execute on function public.crear_orden_de_correccion(uuid, date, text, public.checkpoint, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. HU-20 respeta la etapa inicial
-- ---------------------------------------------------------------------------
-- Una corrección sin avances todavía está parada en su etapa inicial, no en
-- la primera del flujo. Mismo cuerpo que en la migración anterior; solo cambia
-- el cálculo de `siguiente`.

create or replace function public.generar_alertas_proximidad_entrega(
  p_dias integer default 3
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
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
        and a.anulado_por is null
    ) as avanzado
    cross join lateral (
      select e as etapa
      from unnest(enum_range(null::public.checkpoint)) as e
      where (avanzado.ultimo is null or e > avanzado.ultimo)
        and (o.etapa_inicial is null or e >= o.etapa_inicial)
      order by e
      limit 1
    ) as siguiente
    where (o.fecha_entrega - v_hoy) <= p_dias
      and not exists (
        select 1
        from public.avance_seccion a
        where a.orden_id = o.id
          and a.checkpoint = 'cerrada'
          and a.anulado_por is null
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

revoke execute on function public.generar_alertas_proximidad_entrega(integer)
  from public, anon, authenticated, service_role;
