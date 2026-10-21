-- HU-20 · Cada quien atiende solo sus alertas de entrega.
--
-- "admin atiende alertas pendientes" (HU-07) dejaba a cualquier cuenta de
-- administración marcar atendida CUALQUIER alerta pendiente, incluida la de
-- entrega que le llegó a corte o a logística. Las de tela siguen siendo de
-- toda la administración; las de entrega, solo de su destinatario (que ya
-- puede atenderlas con "el destinatario atiende su alerta").

drop policy "admin atiende alertas pendientes" on public.alerta;

create policy "admin atiende alertas pendientes"
  on public.alerta
  for update
  to authenticated
  using (
    public.rol_actual() = 'admin'
    and estado = 'pendiente'
    and (tipo = 'falta_tela' or destinatario_id = (select auth.uid()))
  )
  with check (
    public.rol_actual() = 'admin'
    and estado = 'atendida'
    and (tipo = 'falta_tela' or destinatario_id = (select auth.uid()))
  );
