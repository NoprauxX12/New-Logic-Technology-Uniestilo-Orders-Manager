-- HU-07 · Administración ve la alerta de tela en el tablero y la resuelve.
--
-- El destinatario ya podía actualizar su alerta. En el tablero entra cualquier
-- cuenta de administración, así que cualquiera de ellas puede marcarla
-- atendida. No se borra: sale de la lista porque deja de estar pendiente.
--
-- La hora de atención la pone la base, no el navegador. Atender no es recibir
-- la tela (HU-22): esta migración no toca la llegada.

create policy "admin atiende alertas pendientes"
  on public.alerta
  for update
  to authenticated
  using (
    public.rol_actual() = 'admin'
    and estado = 'pendiente'
  )
  with check (
    public.rol_actual() = 'admin'
    and estado = 'atendida'
  );

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

  if old.estado = 'pendiente' and new.estado = 'atendida' then
    new.fecha_atencion := now();
  end if;

  return new;
end;
$$;

-- El tablero se entera cuando secretaría avisa y cuando administración resuelve.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alerta'
  ) then
    alter publication supabase_realtime add table public.alerta;
  end if;
end $$;
