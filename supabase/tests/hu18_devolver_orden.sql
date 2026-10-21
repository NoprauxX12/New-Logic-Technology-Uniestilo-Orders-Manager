-- HU-18 · Devolver una orden a una etapa anterior (pruebas de la base).
--
-- Corren sobre la base con el seed. Todo ocurre dentro de una transacción que
-- se deshace al final. Usuarios del seed: admin a1, secretaria a2, corte a4.

begin;

select plan(31);

-- Quién actúa: lo que el JWT diría. Se usa `set local role` + claims, igual
-- que lo hace PostgREST.
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

-- OC-5003 (f3): avances hasta el corte. OC-5007 (f7): cerrada.

-- ---------------------------------------------------------------------------
-- Quién puede devolver
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');  -- secretaría
select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'tela_programada', 'x')$$,
  'UE007', null, 'un rol distinto de admin no puede devolver una orden'
);

select pg_temp.como(null);
select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'tela_programada', 'x')$$,
  'UE006', null, 'sin sesión no se puede devolver'
);

-- ---------------------------------------------------------------------------
-- Reglas del destino y del motivo
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');  -- admin

select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'tela_programada', '   ')$$,
  'UE010', null, 'el motivo es obligatorio'
);

select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'recogido_bordado', 'Falla')$$,
  'UE011', null, 'no se devuelve a una etapa que la orden no tiene marcada'
);

select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f7', 'corte_completado', 'Falla')$$,
  'UE004', null, 'una orden cerrada no se devuelve'
);

select throws_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000ff', 'corte_completado', 'Falla')$$,
  'UE005', null, 'la orden tiene que existir'
);

-- ---------------------------------------------------------------------------
-- Admin devuelve OC-5003 a "Tela programada"
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'tela_programada', 'La tela vino con otro tono')$$,
  'administración devuelve la orden a una etapa que tiene marcada'
);

reset role;

select is(
  (select count(*)::int from public.avance_seccion where orden_id = '00000000-0000-0000-0000-0000000000f3'),
  6,
  'ningún avance se borra: las 6 filas siguen en la bitácora'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = '00000000-0000-0000-0000-0000000000f3' and anulado_por is null),
  4,
  'quedan 4 avances vigentes (hasta la ficha técnica)'
);

select is(
  (select array_agg(checkpoint::text order by checkpoint)
     from public.avance_seccion
    where orden_id = '00000000-0000-0000-0000-0000000000f3' and anulado_por is not null),
  array['tela_programada', 'corte_completado'],
  'se anulan la etapa de destino y las posteriores'
);

select is(
  (select usuario_id::text from public.avance_seccion
    where orden_id = '00000000-0000-0000-0000-0000000000f3' and checkpoint = 'corte_completado'),
  '00000000-0000-0000-0000-0000000000a4',
  'el avance anulado conserva quién lo marcó'
);

select is(
  (select r.motivo || '|' || r.checkpoint_destino || '|' || r.creado_por
     from public.reproceso r where r.orden_id = '00000000-0000-0000-0000-0000000000f3'),
  'La tela vino con otro tono|tela_programada|00000000-0000-0000-0000-0000000000a1',
  'el reproceso guarda motivo, destino y quién (de la sesión)'
);

-- ---------------------------------------------------------------------------
-- La bitácora sigue siendo inmutable
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.avance_seccion set observaciones = 'editado' where orden_id = '00000000-0000-0000-0000-0000000000f2'$$,
  'UE014', null, 'un update directo de un avance se rechaza (aun siendo dueño)'
);

select throws_ok(
  $$update public.avance_seccion set anulado_por = (select id from public.reproceso limit 1)
     where orden_id = '00000000-0000-0000-0000-0000000000f2'$$,
  'UE014', null, 'anular un avance a mano, fuera de la función, se rechaza'
);

select throws_ok(
  $$delete from public.avance_seccion where orden_id = '00000000-0000-0000-0000-0000000000f2'$$,
  'UE014', null, 'borrar un avance se rechaza'
);

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$update public.avance_seccion set observaciones = 'editado'$$,
  'administración puede intentar editar la bitácora...'
);

reset role;

select is(
  (select count(*)::int from public.avance_seccion where observaciones = 'editado'),
  0,
  '...pero sin política de update, RLS no deja ninguna fila'
);

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  $$insert into public.reproceso (orden_id, checkpoint_destino, motivo)
    values ('00000000-0000-0000-0000-0000000000f2', 'ficha_adjunta', 'Falsa')$$,
  '42501', null, 'un reproceso no se inserta a mano: solo con la función'
);

select pg_temp.como('00000000-0000-0000-0000-0000000000a2');  -- secretaría

select throws_ok(
  $$insert into public.avance_seccion (orden_id, checkpoint, usuario_id, anulado_por)
    values ('00000000-0000-0000-0000-0000000000f1', 'cotizacion_enviada',
            '00000000-0000-0000-0000-0000000000a2', (select id from public.reproceso limit 1))$$,
  '42501', null, 'tampoco se inserta un avance ya anulado'
);

-- ---------------------------------------------------------------------------
-- La etapa se puede volver a marcar
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');  -- secretaría

select lives_ok(
  $$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
    values ('00000000-0000-0000-0000-0000000000f3', 'tela_programada', '00000000-0000-0000-0000-0000000000a2')$$,
  'la etapa anulada se vuelve a marcar (el índice único es parcial)'
);

select throws_ok(
  $$insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
    values ('00000000-0000-0000-0000-0000000000f3', 'tela_programada', '00000000-0000-0000-0000-0000000000a2')$$,
  '23505', null, 'pero no dos vigentes de la misma etapa'
);

reset role;

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = '00000000-0000-0000-0000-0000000000f3' and checkpoint = 'tela_programada'),
  2,
  'la etapa tiene dos filas: la anulada y la nueva'
);

-- ---------------------------------------------------------------------------
-- Lo que lee avances ignora los anulados
-- ---------------------------------------------------------------------------

-- Lote a taller: exige el recogido vigente.
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f4', 'recogido_bordado', 'Bordado torcido')$$,
  'se devuelve OC-5004 al recogido y bordado'
);
reset role;

select throws_ok(
  $$insert into public.lote_taller (orden_id, taller, descripcion_prendas, enviado_por)
    values ('00000000-0000-0000-0000-0000000000f4', 'Taller X', '10 overoles', '00000000-0000-0000-0000-0000000000a5')$$,
  'UE001', null, 'no se despacha un lote si el recogido quedó anulado'
);

-- Programar tela: exige la ficha técnica vigente.
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f2', 'ficha_adjunta', 'Ficha desactualizada')$$,
  'se devuelve OC-5002 a la ficha técnica'
);
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$select public.programar_tela('00000000-0000-0000-0000-0000000000f2', '[]'::jsonb)$$,
  'P0001', 'Primero debe estar marcada la ficha técnica',
  'programar tela exige la ficha vigente'
);
reset role;

-- Alertas de entrega: el área sale de los avances vigentes.
create temp table generadas as select public.generar_alertas_proximidad_entrega(10) as n;

select ok(
  (select n from generadas) > 0
  and exists (
    select 1 from public.alerta
    where orden_id = '00000000-0000-0000-0000-0000000000f3'
      and tipo = 'proximidad_entrega'
      and detalle like '%y está en Corte'
  ),
  'la alerta de entrega ignora el corte anulado y ubica la orden en Corte'
);

-- Devolver hasta antes de la programación libera la hoja.
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.devolver_orden_a_etapa('00000000-0000-0000-0000-0000000000f3', 'programada_diseno', 'Cambió el diseño')$$,
  'se devuelve OC-5003 a la programación a diseño'
);
reset role;

select is(
  (select numero_orden_programacion from public.orden where id = '00000000-0000-0000-0000-0000000000f3'),
  null::integer,
  'la hoja de programación queda libre para programarla de nuevo'
);

-- ---------------------------------------------------------------------------
-- Seed coherente
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.avance_seccion a
     join public.reproceso r on r.id = a.anulado_por
    where r.orden_id = '00000000-0000-0000-0000-0000000000fa'),
  1,
  'el seed trae OC-5010 con un corte anulado por una devolución'
);

select is(
  (select count(*)::int from public.avance_seccion
    where orden_id = '00000000-0000-0000-0000-0000000000fa'
      and checkpoint = 'corte_completado' and anulado_por is null),
  1,
  'y su corte rehecho vigente'
);

select * from finish();

rollback;
