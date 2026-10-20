-- HU-04 · Bucket privado de fichas técnicas y políticas de Storage.
--
-- El archivo vive en `<bucket>/<orden_id>/<archivo>`; en `ficha_tecnica` solo
-- se guarda esa ruta (no una URL firmada, que expira). Quien tiene sesión
-- puede leer; solo diseño sube. No hay update ni delete: una ficha equivocada
-- se corrige subiendo otra.
--
-- Es idempotente a propósito: el bucket y las dos políticas se crearon a mano
-- en el proyecto hospedado antes de que esta migración existiera, así que
-- `db push` las encuentra ya hechas. Los `drop policy if exists` las vuelven a
-- crear iguales en vez de fallar con "already exists".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fichas',
  'fichas',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quien tiene sesion lee las fichas" on storage.objects;
drop policy if exists "diseno sube las fichas" on storage.objects;

create policy "quien tiene sesion lee las fichas"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'fichas'
    and public.rol_actual() is not null
  );

create policy "diseno sube las fichas"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'fichas'
    and public.rol_actual() = 'diseno'
    -- La carpeta es el id de una orden que existe: sin esto, diseño podría
    -- dejar archivos sueltos que no pertenecen a ninguna orden.
    and exists (
      select 1
      from public.orden
      where id::text = (storage.foldername(name))[1]
    )
  );

-- El tablero se entera cuando llega una ficha nueva, no solo cuando se marca
-- el checkpoint (una orden ya marcada puede recibir otra versión del archivo).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ficha_tecnica'
  ) then
    alter publication supabase_realtime add table public.ficha_tecnica;
  end if;
end $$;
