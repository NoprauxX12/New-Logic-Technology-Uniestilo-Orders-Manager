-- Privilegios de tabla para `authenticated`.
--
-- Postgres exige dos cosas para tocar una fila: el privilegio sobre la tabla
-- (GRANT) y que alguna política RLS lo permita. Las migraciones anteriores solo
-- escribieron las políticas: la base local reparte los GRANT por defecto, pero
-- un proyecto hospedado nuevo no, y todo fallaba con "permission denied for
-- table" (42501) antes de que RLS entrara a mirar.
--
-- Cada GRANT de aquí es la unión de lo que las políticas ya permiten; RLS sigue
-- siendo quien decide quién lo ejerce. `avance_seccion` queda sin update ni
-- delete (RNF-05) y `anon` no recibe nada.

grant select on
  public.alerta,
  public.avance_seccion,
  public.cliente,
  public.ficha_tecnica,
  public.item_orden,
  public.lote_taller,
  public.orden,
  public.usuario
to authenticated;

grant insert on
  public.alerta,
  public.avance_seccion,
  public.cliente,
  public.ficha_tecnica,
  public.item_orden,
  public.lote_taller,
  public.orden,
  public.usuario
to authenticated;

-- `orden` (numero_factura) y `alerta` (atención y llegada de tela) ya tienen su
-- `grant update (...)` por columna en migraciones anteriores.
grant update on public.lote_taller to authenticated;
grant update, delete on public.usuario to authenticated;
