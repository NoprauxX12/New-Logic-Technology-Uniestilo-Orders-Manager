-- HU-06 · La secretaria avisa al administrador que falta tela para una orden.
--
-- La tabla `alerta` ya existe (base de avances) con sus políticas por rol
-- (HU-17). A esta historia le faltan tres cosas, y las tres van en la base
-- porque una server action se puede invocar con un POST directo:
--
-- 1. Quién la envió. `alerta` guardaba a quién le llega pero no quién la
--    mandó, y la auditoría (RNF-05) pide las dos mitades.
-- 2. Que no se repita. Una orden con una alerta de tela abierta no necesita
--    otra: el administrador ya está enterado.
-- 3. Que llegue a quien tiene que llegar. La alerta de tela es para
--    administración (Néstor hace el pedido); la política de alta solo miraba
--    el rol de quien crea, no a quién se le manda.
--
-- Y una cuarta para HU-22: secretaría tiene que ver las alertas de tela, para
-- saber qué órdenes están esperando tela y marcar cuando llegue. Hoy solo las
-- ve su destinatario o administración.

-- ---------------------------------------------------------------------------
-- 1. Quién la envió
-- ---------------------------------------------------------------------------
-- Admite nulos solo por las filas que pudieran existir antes de esta migración
-- en el proyecto hospedado, de las que no se sabe quién las creó. Las nuevas
-- siempre lo llevan: el default lo toma de la sesión y la política de alta
-- exige que sea la propia persona.

alter table public.alerta
  add column creada_por uuid references public.usuario (id) default auth.uid();

comment on column public.alerta.creada_por is
  'HU-06: quien envió la alerta. Sale de la sesión; la política de alta impide firmar a nombre de otro.';

-- ---------------------------------------------------------------------------
-- 2. Una sola alerta de tela abierta por orden
-- ---------------------------------------------------------------------------
-- Índice único parcial: solo cuenta las de tela que siguen pendientes. Una vez
-- atendida (HU-07), la orden puede volver a necesitar otra.

create unique index alerta_falta_tela_abierta_idx
  on public.alerta (orden_id)
  where tipo = 'falta_tela' and estado = 'pendiente';

-- ---------------------------------------------------------------------------
-- 3. Alta: a nombre propio, y la de tela solo a administración
-- ---------------------------------------------------------------------------
-- La subconsulta a `usuario` corre con los permisos de quien inserta; con
-- sesión y perfil se leen todos los perfiles ("lectura con sesion"), así que
-- puede comprobar el rol del destinatario. `destinatario_id` va sin calificar:
-- es la columna de la fila nueva, porque `usuario` no tiene una con ese nombre.

drop policy "secretaria o admin crean alertas" on public.alerta;

create policy "secretaria o admin crean alertas a su nombre" on public.alerta
  for insert to authenticated
  with check (
    public.rol_actual() in ('secretaria', 'admin')
    and creada_por = (select auth.uid())
    and (
      tipo <> 'falta_tela'
      or exists (
        select 1
        from public.usuario
        where usuario.id = destinatario_id
          and usuario.rol = 'admin'
          and usuario.activo
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Secretaría ve las alertas de tela
-- ---------------------------------------------------------------------------
-- Todas las de tela, no solo las que creó: en el taller puede haber más de una
-- persona en secretaría, y la que recibe la tela (HU-22) no siempre es la que
-- avisó que faltaba. Las de proximidad de entrega (HU-20) siguen siendo solo de
-- su destinatario y de administración.

create policy "secretaria lee alertas de tela" on public.alerta
  for select to authenticated
  using (
    tipo = 'falta_tela'
    and public.rol_actual() = 'secretaria'
  );
