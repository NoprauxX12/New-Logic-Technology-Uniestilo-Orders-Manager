-- HU-22 · La secretaria marca que llegó la tela, y eso libera la orden a corte.
--
-- HU-06 dejó la alerta de tela; esta historia la cierra por el otro lado. Son
-- cuatro piezas, y todas van en la base porque una server action se puede
-- invocar con un POST directo:
--
-- 1. La llegada como dato: cuándo llegó y quién la recibió (RNF-05).
-- 2. Qué significa "esperando tela": la alerta sigue abierta mientras la tela
--    no llegue, aunque administración ya la haya atendido (ya hizo el pedido).
--    Atender (HU-07) y recibir (HU-22) son dos hechos distintos.
-- 3. El bloqueo: una orden esperando tela no se puede marcar como cortada.
-- 4. El permiso: secretaría marca la llegada a su nombre, y una vez marcada no
--    se cambia.

-- ---------------------------------------------------------------------------
-- 1. La llegada de la tela
-- ---------------------------------------------------------------------------

alter table public.alerta
  add column tela_llegada_en timestamptz,
  add column tela_recibida_por uuid references public.usuario (id);

comment on column public.alerta.tela_llegada_en is
  'HU-22: cuándo llegó la tela. Mientras sea null, la orden está esperando tela y no pasa a corte.';
comment on column public.alerta.tela_recibida_por is
  'HU-22: quién de secretaría marcó que llegó la tela. Sale de la sesión.';

-- Los dos datos van juntos, y solo en las alertas de tela.
alter table public.alerta
  add constraint alerta_llegada_tela_completa check (
    (tela_llegada_en is null and tela_recibida_por is null)
    or
    (tela_llegada_en is not null
      and tela_recibida_por is not null
      and tipo = 'falta_tela')
  ),
  add constraint alerta_llegada_tela_no_anterior check (
    tela_llegada_en is null or tela_llegada_en >= fecha_creacion
  );

-- ---------------------------------------------------------------------------
-- 2. "Abierta" pasa a ser "la tela no ha llegado"
-- ---------------------------------------------------------------------------
-- HU-06 contaba como abierta la alerta pendiente. Pero si administración la
-- atiende —hizo el pedido— la tela sigue sin estar en la empresa: avisar otra
-- vez sería ruido, y la orden tiene que seguir frenada.

drop index public.alerta_falta_tela_abierta_idx;

create unique index alerta_falta_tela_abierta_idx
  on public.alerta (orden_id)
  where tipo = 'falta_tela' and tela_llegada_en is null;

-- ---------------------------------------------------------------------------
-- 3. ¿La orden está esperando tela?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER a propósito, como `rol_actual()`. Quien marca el corte es
-- de corte, y corte no puede leer `alerta` (es de secretaría y administración).
-- Con los permisos de quien llama, la consulta no vería ninguna fila y diría
-- siempre que no: el bloqueo no bloquearía nada, sin dar ningún error.
--
-- Es segura porque solo devuelve un sí o un no, o la lista de órdenes: nunca
-- el detalle de la alerta ni a quién se le mandó.

create or replace function public.orden_espera_tela(p_orden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.alerta
    where orden_id = p_orden_id
      and tipo = 'falta_tela'
      and tela_llegada_en is null
  )
$$;

comment on function public.orden_espera_tela is
  'HU-22: si la orden tiene una alerta de tela sin llegada. Solo responde sí o no.';

-- La misma pregunta para una lista: las pantallas por sección la necesitan
-- para todas las órdenes a la vez, y una llamada por orden sería una consulta
-- por tarjeta.
create or replace function public.ordenes_esperando_tela()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select orden_id
  from public.alerta
  where tipo = 'falta_tela'
    and tela_llegada_en is null
$$;

comment on function public.ordenes_esperando_tela is
  'HU-22: los ids de las órdenes que esperan tela. Sin el detalle de la alerta.';

-- Convención del proyecto (HU-17): fuera `public` y `anon`, solo con sesión.
revoke execute on function public.orden_espera_tela from public, anon;
revoke execute on function public.ordenes_esperando_tela from public, anon;
grant execute on function public.orden_espera_tela to authenticated;
grant execute on function public.ordenes_esperando_tela to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. El bloqueo en la base
-- ---------------------------------------------------------------------------
-- El motor de workflow lo comprueba antes, para dar un mensaje claro; esto es
-- la última barrera, igual que `exigir_corte_para_despachar` (HU-10).

create or replace function public.exigir_tela_para_cortar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.checkpoint = 'corte_completado'
     and public.orden_espera_tela(new.orden_id) then
    raise exception 'La orden está esperando tela y todavía no se puede cortar'
      using errcode = 'UE006';
  end if;

  return new;
end;
$$;

comment on function public.exigir_tela_para_cortar is
  'HU-22: impide marcar el corte de una orden que todavía espera tela.';

create trigger avance_seccion_exige_tela_para_cortar
  before insert on public.avance_seccion
  for each row
  execute function public.exigir_tela_para_cortar();

-- ---------------------------------------------------------------------------
-- 4. Quién marca la llegada, y que no se cambie
-- ---------------------------------------------------------------------------
-- Las políticas RLS no distinguen columnas pero los permisos sí, así que se
-- quita el update sobre la tabla entera y se concede solo sobre lo que alguien
-- tiene que escribir: el estado de la atención (HU-07) y la llegada (HU-22).
-- Es el mismo patrón que `numero_factura` en HU-13.

revoke update on public.alerta from authenticated;

grant update (estado, fecha_atencion, tela_llegada_en, tela_recibida_por)
  on public.alerta to authenticated;

create policy "secretaria marca la llegada de la tela" on public.alerta
  for update to authenticated
  using (
    tipo = 'falta_tela'
    and tela_llegada_en is null
    and public.rol_actual() = 'secretaria'
  )
  with check (
    tipo = 'falta_tela'
    and public.rol_actual() = 'secretaria'
    and tela_recibida_por = (select auth.uid())
  );

-- Las políticas de update se suman (OR): el destinatario también puede
-- actualizar su alerta, y con los permisos de columna podría escribir la
-- llegada. El trigger cierra eso, y además:
--
-- - pone la hora en el servidor, para que no venga del navegador (RNF-05);
-- - da la alerta por atendida si administración no alcanzó a atenderla: con la
--   tela en la empresa ya no hay nada que resolver;
-- - impide cambiar una llegada ya registrada (la auditoría no se edita).

create or replace function public.proteger_llegada_de_tela()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.tela_llegada_en is not null then
    if new.tela_llegada_en is distinct from old.tela_llegada_en
       or new.tela_recibida_por is distinct from old.tela_recibida_por then
      raise exception 'La llegada de la tela ya quedó registrada y no se cambia'
        using errcode = 'UE007';
    end if;

    return new;
  end if;

  if new.tela_llegada_en is not null then
    if public.rol_actual() is distinct from 'secretaria' then
      raise exception 'La llegada de la tela la marca secretaría'
        using errcode = '42501';
    end if;

    new.tela_llegada_en := now();
    new.tela_recibida_por := (select auth.uid());

    if new.estado = 'pendiente' then
      new.estado := 'atendida';
      new.fecha_atencion := now();
    end if;
  end if;

  return new;
end;
$$;

comment on function public.proteger_llegada_de_tela is
  'HU-22: la llegada de la tela la marca secretaría, con hora del servidor, y no se cambia después.';

create trigger alerta_protege_llegada_de_tela
  before update on public.alerta
  for each row
  execute function public.proteger_llegada_de_tela();
