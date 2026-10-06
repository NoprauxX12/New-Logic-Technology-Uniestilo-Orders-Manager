-- HU-17 · Cada rol solo puede escribir lo de su sección, y nadie entra sin sesión.
--
-- Reemplaza las políticas "temporal HU-17" que dejaron pasar a cualquiera desde
-- HU-01. Hasta hoy, con la URL del proyecto y la llave pública —que viaja en el
-- navegador— se podía leer y escribir toda la base sin iniciar sesión, saltarse
-- el motor de workflow insertando en `avance_seccion` y firmar avances a nombre
-- de cualquier persona. Esto lo cierra en la base, que es la segunda capa que
-- exige la regla 5 (RNF-04): la UI muestra a cada rol lo suyo, y aunque la UI
-- falle, aquí no pasa.
--
-- Dos ideas sostienen todo:
--
-- 1. `rol_actual()` dice qué rol tiene la persona con sesión, leyendo `usuario`.
--    Se lee la tabla y no el claim `user_role` del JWT porque la tabla es la
--    fuente de verdad y no depende de que el hook esté activado en el proyecto
--    hospedado ni de que el token esté fresco.
--
-- 2. `rol_dueno(checkpoint)` repite el mapa checkpoint → rol de
--    `src/features/workflow/checkpoints.ts`. Postgres no puede leer TypeScript,
--    así que se escribe aquí, y un test (`rlsPorRol.test.ts`) comprueba que los
--    dos digan lo mismo. Si cambia el flujo, cambian los dos.
--
-- Lectura: toda persona con sesión lee todo. El taller tiene quince personas y
-- cada sección necesita ver la orden entera para saber si le toca; que cada
-- rol vea solo su pantalla lo hace la aplicación. Escritura: solo el rol dueño,
-- y siempre a su propio nombre (`auth.uid()`), para que la bitácora no se pueda
-- firmar por otro (RNF-05).

-- ---------------------------------------------------------------------------
-- Quién es y qué rol tiene
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER a propósito, y es la única excepción a la regla del ADR 0005:
-- esta función la usan las políticas de `usuario`, y si corriera con los
-- permisos de quien llama, leer `usuario` dispararía la política que a su vez
-- la llama, en un ciclo que Postgres corta con "infinite recursion detected".
-- Es segura porque solo devuelve el rol de la propia persona (`auth.uid()`),
-- no deja escoger a quién consultar.
create or replace function public.rol_actual()
returns public.rol
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.usuario where id = auth.uid()
$$;

comment on function public.rol_actual is
  'HU-17: el rol de la persona con sesión, leído de usuario. Null sin sesión o sin perfil.';

create or replace function public.rol_dueno(p_checkpoint public.checkpoint)
returns public.rol
language sql
immutable
set search_path = ''
as $$
  select case p_checkpoint
    when 'cotizacion_aprobada' then 'secretaria'
    when 'programada_diseno'   then 'secretaria'
    when 'ficha_adjunta'       then 'diseno'
    when 'tela_programada'     then 'secretaria'
    when 'corte_completado'    then 'corte'
    when 'recogido_bordado'    then 'logistica'
    when 'llegada_marcacion'   then 'marcacion'
    when 'lista_despacho'      then 'marcacion'
    when 'etiquetas'           then 'secretaria'
    when 'documentos_despacho' then 'secretaria'
    when 'factura_generada'    then 'secretaria'
    when 'cerrada'             then 'secretaria'
  end::public.rol
$$;

comment on function public.rol_dueno is
  'HU-17: el rol que puede marcar cada checkpoint. Copia de checkpoints.ts verificada por test.';

-- Postgres le da EXECUTE a `public` en toda función nueva, así que quitarle
-- permisos a `anon` no basta: hay que quitárselos a `public` y dárselos solo a
-- `authenticated`. Convención para toda función nueva del proyecto.
revoke execute on function public.rol_actual from public, anon;
revoke execute on function public.rol_dueno from public, anon;
grant execute on function public.rol_actual to authenticated;
grant execute on function public.rol_dueno to authenticated;

-- ---------------------------------------------------------------------------
-- Fuera las políticas temporales
-- ---------------------------------------------------------------------------

drop policy "temporal HU-17: cliente lectura abierta" on public.cliente;
drop policy "temporal HU-17: cliente alta abierta" on public.cliente;
drop policy "temporal HU-17: orden lectura abierta" on public.orden;
drop policy "temporal HU-17: orden alta abierta" on public.orden;
drop policy "temporal HU-17: orden numero de factura" on public.orden;
drop policy "temporal HU-17: item_orden lectura abierta" on public.item_orden;
drop policy "temporal HU-17: item_orden alta abierta" on public.item_orden;
drop policy "temporal HU-17: usuario lectura abierta" on public.usuario;
drop policy "temporal HU-17: avance lectura abierta" on public.avance_seccion;
drop policy "temporal HU-17: avance alta abierta" on public.avance_seccion;
drop policy "temporal HU-17: lote lectura abierta" on public.lote_taller;
drop policy "temporal HU-17: lote alta abierta" on public.lote_taller;
drop policy "temporal HU-17: lote recepcion abierta" on public.lote_taller;
drop policy "temporal HU-17: ficha lectura abierta" on public.ficha_tecnica;
drop policy "temporal HU-17: ficha alta abierta" on public.ficha_tecnica;
drop policy "temporal HU-17: alerta lectura abierta" on public.alerta;
drop policy "temporal HU-17: alerta alta abierta" on public.alerta;
drop policy "temporal HU-17: alerta atencion abierta" on public.alerta;

-- ---------------------------------------------------------------------------
-- Nada para anon
-- ---------------------------------------------------------------------------
-- Sin políticas, anon ya no pasa RLS; pero además se le quitan los permisos de
-- tabla y de función, y los que Supabase le daría por defecto a las tablas que
-- se creen después. Así una tabla nueva sin política nace cerrada para anon.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

-- Las funciones que la aplicación invoca por RPC, solo para quien tiene sesión.
-- `nit_normalizado` la evalúa el índice único de `cliente` al insertar, así que
-- quien registra necesita poder ejecutarla.
revoke execute on function public.registrar_orden from public, anon;
revoke execute on function public.nit_normalizado from public, anon;
grant execute on function public.registrar_orden to authenticated;
grant execute on function public.nit_normalizado to authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from anon;

-- ---------------------------------------------------------------------------
-- Lectura: toda persona con sesión y perfil
-- ---------------------------------------------------------------------------

create policy "lectura con sesion" on public.cliente
  for select to authenticated using (public.rol_actual() is not null);

create policy "lectura con sesion" on public.orden
  for select to authenticated using (public.rol_actual() is not null);

create policy "lectura con sesion" on public.item_orden
  for select to authenticated using (public.rol_actual() is not null);

-- Con perfil se leen los nombres de todos: el tablero los muestra en
-- "reportado por". `rol_actual()` es SECURITY DEFINER justamente para que esta
-- política pueda llamarla sin volver a pasar por sí misma.
create policy "lectura con sesion" on public.usuario
  for select to authenticated using (public.rol_actual() is not null);

create policy "lectura con sesion" on public.avance_seccion
  for select to authenticated using (public.rol_actual() is not null);

create policy "lectura con sesion" on public.lote_taller
  for select to authenticated using (public.rol_actual() is not null);

create policy "lectura con sesion" on public.ficha_tecnica
  for select to authenticated using (public.rol_actual() is not null);

-- ---------------------------------------------------------------------------
-- Escritura: solo el rol dueño, y a su propio nombre
-- ---------------------------------------------------------------------------

-- HU-01: las órdenes las registra administración (vía `registrar_orden`).
create policy "admin registra clientes" on public.cliente
  for insert to authenticated with check (public.rol_actual() = 'admin');

create policy "admin registra ordenes" on public.orden
  for insert to authenticated
  with check (
    public.rol_actual() = 'admin'
    and creado_por = (select auth.uid())
  );

create policy "admin registra prendas" on public.item_orden
  for insert to authenticated with check (public.rol_actual() = 'admin');

-- HU-13: el número de factura lo escribe secretaría. El permiso de columna
-- (`grant update (numero_factura)`) sigue limitando a esa sola columna.
create policy "secretaria registra la factura" on public.orden
  for update to authenticated
  using (public.rol_actual() = 'secretaria')
  with check (public.rol_actual() = 'secretaria');

-- Regla 2 en la base: cada checkpoint lo inserta su rol dueño, firmando con su
-- propio id. La secuencia la sigue verificando el motor; el índice único y el
-- trigger de orden cerrada ya cubren lo demás.
create policy "cada rol marca su checkpoint" on public.avance_seccion
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.rol_actual() = public.rol_dueno(checkpoint)
  );

-- HU-10 y HU-11: logística despacha y recibe, a su nombre.
create policy "logistica despacha" on public.lote_taller
  for insert to authenticated
  with check (
    public.rol_actual() = 'logistica'
    and enviado_por = (select auth.uid())
  );

create policy "logistica recibe" on public.lote_taller
  for update to authenticated
  using (public.rol_actual() = 'logistica')
  with check (
    public.rol_actual() = 'logistica'
    and recibido_por = (select auth.uid())
  );

-- HU-04: la ficha la adjunta diseño.
create policy "diseno adjunta la ficha" on public.ficha_tecnica
  for insert to authenticated
  with check (
    public.rol_actual() = 'diseno'
    and subida_por = (select auth.uid())
  );

-- HU-06, HU-07 y HU-20: una alerta la ve y la atiende su destinatario, y
-- administración ve todas. Las crea secretaría (falta de tela) o administración.
create policy "alerta propia o admin" on public.alerta
  for select to authenticated
  using (
    destinatario_id = (select auth.uid())
    or public.rol_actual() = 'admin'
  );

create policy "secretaria o admin crean alertas" on public.alerta
  for insert to authenticated
  with check (public.rol_actual() in ('secretaria', 'admin'));

create policy "el destinatario atiende su alerta" on public.alerta
  for update to authenticated
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));
