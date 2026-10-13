-- HU-16 · El rol de cada persona viaja en su JWT.
--
-- Supabase permite engancharse a la emisión del token (un "Custom Access Token
-- Hook"): antes de firmarlo, llama a esta función y le deja meter claims
-- propios. Se usa para meter el rol de `usuario` como `user_role`, así HU-17
-- puede escribir políticas RLS que lean `(auth.jwt() ->> 'user_role')` sin
-- consultar la tabla en cada fila.
--
-- Por ahora nadie lee ese claim todavía: `getUsuarioActual()` sigue
-- consultando `usuario` directamente, que es más simple y no depende de que el
-- token esté fresco. Esta migración deja la infraestructura lista para cuando
-- haga falta, sin arriesgar romper el login por adelantar su uso.
--
-- El patrón —permisos y política aparte, sin SECURITY DEFINER— es el que
-- documenta Supabase para estos hooks: quien invoca la función es el rol
-- `supabase_auth_admin`, y son sus propios permisos los que le abren paso a
-- `usuario`, no los del dueño de la función.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
-- search_path vacío: obliga a calificar cada tabla con su esquema (regla del
-- repo para toda función de Postgres).
set search_path = ''
as $$
declare
  claims jsonb;
  rol_usuario public.rol;
begin
  select rol into rol_usuario
  from public.usuario
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if rol_usuario is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(rol_usuario));
  else
    -- Cuentas de `auth.users` sin fila en `usuario` (no debería pasar con las
    -- seis del seed, pero un hook nunca puede fallar: si fallara, nadie podría
    -- iniciar sesión).
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook is
  'Custom Access Token Hook (HU-16): agrega el rol de usuario.rol como claim user_role en el JWT. Lo invoca supabase_auth_admin al emitir cada token.';

-- Solo el servicio de auth puede llamarla y leer la tabla. Nadie desde el
-- navegador necesita ejecutar esto directamente.
grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on public.usuario to supabase_auth_admin;

create policy "auth admin lee el rol para el hook del JWT"
  on public.usuario
  as permissive
  for select
  to supabase_auth_admin
  using (true);
