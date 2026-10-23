-- HU-18 · Orden de corrección de una orden cerrada (pruebas de la base).
--
-- OC-5007 (f7) está cerrada y ya tiene una corrección en el seed (OC-5007-C1).
-- Usuarios del seed: admin a1, secretaria a2.

begin;

select plan(26);

create function pg_temp.como(p_usuario text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    case when p_usuario is null then '{"role":"authenticated"}'
         else json_build_object('sub', p_usuario, 'role', 'authenticated')::text end,
    true
  );
  set local role authenticated;
end $$;

grant execute on function pg_temp.como(text) to public;

-- La prenda de OC-5007 (450 unidades).
create temp table prenda as
  select id from public.item_orden
  where orden_id = '00000000-0000-0000-0000-0000000000f7';
grant select on prenda to public;

create temp table creada (id uuid);
grant all on creada to public;

select is(
  (select orden_original_id::text from public.orden where numero_orden_compra = 'OC-5007-C1'),
  '00000000-0000-0000-0000-0000000000f7',
  'el seed trae OC-5007-C1 enlazada a OC-5007'
);

-- ---------------------------------------------------------------------------
-- Quién puede
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');  -- secretaría
select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE007', null, 'un rol distinto de admin no crea correcciones'
);

select pg_temp.como(null);
select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE006', null, 'sin sesión no se crea una corrección'
);

-- ---------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');  -- admin

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f6', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from public.item_orden where orden_id = '00000000-0000-0000-0000-0000000000f6' limit 1), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE012', null, 'una orden que no está cerrada no admite orden de corrección'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 451, 'tallas', 'S:451')))$$,
  'UE013', null, 'la cantidad no puede pasar la de la orden original'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 0, 'tallas', 'S:0')))$$,
  'UE013', null, 'la cantidad es de 1 en adelante'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', '  ')))$$,
  'UE013', null, 'las tallas son obligatorias'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object(
        'item_id', (select id from public.item_orden where orden_id = '00000000-0000-0000-0000-0000000000f6' limit 1),
        'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE013', null, 'la prenda tiene que ser de la orden original'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'corte_completado',
      jsonb_build_array(
        jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5'),
        jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'M:5')))$$,
  'UE013', null, 'la misma prenda no se repite'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, '', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE010', null, 'el motivo es obligatorio'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'cerrada',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE010', null, 'la etapa de entrada no puede ser de cierre'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'tela_programada',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE010', null, 'la tela programada no sirve de entrada: la corrección no tiene la ficha vigente'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Defecto', 'llegada_marcacion',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE010', null, 'la llegada a marcación no sirve de entrada: no hay lote que recibir sin el recogido'
);

select throws_ok(
  $$select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', ((now() at time zone 'America/Bogota')::date - 1), 'Defecto', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 5, 'tallas', 'S:5')))$$,
  'UE010', null, 'la entrega no puede ser anterior a hoy'
);

-- ---------------------------------------------------------------------------
-- Crear
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into creada select public.crear_orden_de_correccion(
      '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Costura abierta', 'corte_completado',
      jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 12, 'tallas', 'S:8, M:4')))$$,
  'administración crea la orden de corrección'
);

reset role;

select is(
  (select o.numero_orden_compra from public.orden o where o.id = (select id from creada)),
  'OC-5007-C2',
  'el número sigue al consecutivo de correcciones (el seed ya trae la C1)'
);

select is(
  (select (o.orden_original_id = '00000000-0000-0000-0000-0000000000f7'
           and o.cliente_id = f.cliente_id
           and o.etapa_inicial = 'corte_completado'
           and o.creado_por = '00000000-0000-0000-0000-0000000000a1'
           and o.fecha_ingreso = (now() at time zone 'America/Bogota')::date
           and o.fecha_entrega = current_date + 10
           and o.observaciones like '%OC-5007%Costura abierta%')
     from public.orden o, public.orden f
    where o.id = (select id from creada) and f.id = o.orden_original_id),
  true,
  'queda enlazada, con el mismo cliente, la etapa de entrada y el motivo'
);

select is(
  (select i.cantidad || '|' || i.tallas || '|' || i.tallaje || '|' || i.valor
     from public.item_orden i where i.orden_id = (select id from creada)),
  '12|S:8, M:4|otro|0.00',
  'la prenda lleva la cantidad defectuosa, tallas en texto y valor 0'
);

select is(
  (select count(*)::int from public.avance_seccion where orden_id = (select id from creada)),
  0,
  'no se fabrican avances en nombre de otras secciones'
);

-- Un número ocupado a mano (en minúsculas) no choca: se toma el siguiente libre.
insert into public.orden (numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega)
select 'oc-5007-c3', cliente_id, current_date, current_date + 5
from public.orden where id = '00000000-0000-0000-0000-0000000000f7';

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
delete from creada;
insert into creada select public.crear_orden_de_correccion(
  '00000000-0000-0000-0000-0000000000f7', current_date + 10, 'Otra', 'recogido_bordado',
  jsonb_build_array(jsonb_build_object('item_id', (select id from prenda), 'cantidad', 450, 'tallas', 'Todas')));
reset role;

select is(
  (select upper(o.numero_orden_compra) from public.orden o where o.id = (select id from creada)),
  'OC-5007-C4',
  'si el número candidato ya existe (aunque sea en minúsculas) toma el siguiente libre'
);

select throws_ok(
  $$update public.orden set etapa_inicial = 'corte_completado' where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514', null, 'solo una orden de corrección puede tener etapa inicial'
);

select throws_ok(
  $$update public.orden set etapa_inicial = 'cerrada' where numero_orden_compra = 'OC-5007-C1'$$,
  '23514', null, 'la etapa inicial no puede ser de cierre'
);

select throws_ok(
  $$update public.orden set etapa_inicial = 'tela_programada' where numero_orden_compra = 'OC-5007-C1'$$,
  '23514', null, 'la restricción de la base también rechaza la tela programada como entrada'
);

select throws_ok(
  $$update public.orden set etapa_inicial = 'llegada_marcacion' where numero_orden_compra = 'OC-5007-C1'$$,
  '23514', null, 'y la llegada a marcación'
);

select is(
  (select count(*)::int from public.orden where orden_original_id = '00000000-0000-0000-0000-0000000000f7'),
  3,
  'la original ve sus correcciones: C1 del seed, C2 y C4'
);

-- Alertas: una corrección sin avances está parada en su etapa inicial.
create temp table generadas as select public.generar_alertas_proximidad_entrega(30) as n;

select ok(
  (select n from generadas) > 0
  and exists (
    select 1 from public.alerta
    where orden_id = (select id from public.orden where numero_orden_compra = 'OC-5007-C1')
      and tipo = 'proximidad_entrega'
      and detalle like '%y está en Corte'
  ),
  'la alerta de entrega ubica la corrección en su etapa inicial (Corte)'
);

select * from finish();

rollback;
