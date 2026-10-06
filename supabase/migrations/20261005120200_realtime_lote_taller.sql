-- HU-10 y HU-11 · El tablero se entera de los lotes a taller por Realtime.
--
-- Los criterios de aceptación piden que al despachar la orden se vea "en
-- confección" en el tablero y que al recibir el tablero lo refleje. El tablero
-- ya escuchaba `avance_seccion`; un lote no es un checkpoint (regla 6), así que
-- hay que publicar también `lote_taller`. RLS sigue aplicando: solo se emite lo
-- que la persona podría leer.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lote_taller'
  ) then
    alter publication supabase_realtime add table public.lote_taller;
  end if;
end $$;
