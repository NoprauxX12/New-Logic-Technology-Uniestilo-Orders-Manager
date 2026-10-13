-- El tablero (HU-14) se entera de un avance nuevo por Realtime, sin recargar.
-- La publicación `supabase_realtime` ya existe; hay que incluir esta tabla
-- para que el INSERT llegue al navegador. El SELECT de RLS sigue aplicando:
-- solo se emite lo que el cliente podría leer.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'avance_seccion'
  ) then
    alter publication supabase_realtime add table public.avance_seccion;
  end if;
end $$;
