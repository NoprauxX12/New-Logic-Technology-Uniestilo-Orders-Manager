-- HU-03 · Programar órdenes hacia diseño.
--
-- Secretaría arma la hoja de programación: la lista de órdenes que diseño debe
-- trabajar, en el orden en que deben trabajarse. La hoja de papel que usan hoy
-- se titula "PROGRAMACION # 24" y numera las órdenes de 1 a 9 por dentro, así
-- que son dos datos distintos y los dos van en la orden:
--
--   numero_orden_programacion  a qué hoja pertenece (la misma para todas las
--                              órdenes de esa tanda)
--   posicion_programacion      su turno dentro de esa hoja (1, 2, 3…)
--
-- No hay entidad nueva: el modelo del dominio del Sprint 0 no tiene ninguna de
-- programación, y `numero_orden_programacion` ya estaba reservada en `orden`
-- desde HU-01 para este momento. Ver `docs/adr/0010`.
--
-- Los dos números los pone el sistema; la secretaria no escribe ninguno. El de
-- la hoja es el siguiente del contador, y el turno sale del orden en que ella
-- dejó las órdenes en pantalla.
--
-- Escribe en dos tablas —los dos datos en `orden` y la marca en
-- `avance_seccion`—, así que va en una función de Postgres y no en varias
-- llamadas desde la aplicación (ADR 0005): o queda la hoja completa, o no queda
-- nada.

-- ---------------------------------------------------------------------------
-- Las dos columnas
-- ---------------------------------------------------------------------------

-- HU-01 la dejó como texto cuando todavía no se sabía qué era. Es un
-- consecutivo que lleva el sistema, así que entero: se necesita `max() + 1` y,
-- como texto, la hoja 10 iría antes de la 9 al ordenar. La tabla no tiene
-- ningún valor en esta columna todavía, así que la conversión no toca datos.
alter table public.orden
  alter column numero_orden_programacion type integer
    using numero_orden_programacion::integer;

alter table public.orden
  add column posicion_programacion integer;

comment on column public.orden.numero_orden_programacion is
  'HU-03: la hoja de programación a la que pertenece la orden. Consecutivo del sistema.';

comment on column public.orden.posicion_programacion is
  'HU-03: el turno de la orden dentro de su hoja, 1 a n, en el orden en que debe trabajarse.';

alter table public.orden
  add constraint orden_programacion_positiva
    check (
      (numero_orden_programacion is null or numero_orden_programacion > 0)
      and (posicion_programacion is null or posicion_programacion > 0)
    );

-- Los dos datos nacen juntos: una orden programada tiene hoja y turno, y una
-- sin programar no tiene ninguno de los dos. Así ninguna consulta tiene que
-- preguntar por ambos para saber si la orden ya está programada.
alter table public.orden
  add constraint orden_programacion_completa
    check (
      (numero_orden_programacion is null) = (posicion_programacion is null)
    );

-- Dentro de una hoja no se repite el turno. Además de ser la regla, es lo que
-- vuelve segura la asignación por contador: si dos personas programan a la vez,
-- las dos leen el mismo máximo y la segunda choca aquí en vez de dejar dos
-- hojas con el mismo número. Los nulos no chocan entre sí.
create unique index orden_programacion_unica_idx
  on public.orden (numero_orden_programacion, posicion_programacion);

-- ---------------------------------------------------------------------------
-- Sin permiso directo sobre esas dos columnas
-- ---------------------------------------------------------------------------
-- HU-13 quitó el update sobre `orden` entera y lo concedió solo sobre
-- `numero_factura`. Aquí no se concede nada más, a propósito: con un `grant
-- update` de estas columnas, secretaría podía cambiar desde la API la hoja o el
-- turno de cualquier orden ya programada, sin pasar por la función y sin dejar
-- rastro en la bitácora (la política de update de `orden` no distingue filas
-- ni columnas). La única vía para escribirlas es `programar_ordenes_a_diseno`,
-- que corre con los permisos de su dueño (ver abajo).

-- ---------------------------------------------------------------------------
-- programar_ordenes_a_diseno
-- ---------------------------------------------------------------------------
-- Recibe las órdenes de la hoja en el orden en que deben trabajarse y devuelve
-- el número de hoja que les tocó, para poder decírselo a la secretaria.
--
-- SECURITY DEFINER, como `orden_espera_tela` (HU-22): es la única vía para
-- escribir la hoja y el turno, que `authenticated` no puede tocar directo. Por
-- eso la función hace ella misma lo que haría RLS —exige sesión y el rol de
-- secretaría— y solo escribe órdenes sin programar. Las demás barreras siguen
-- en pie porque no dependen de quién llama: el índice único de `avance_seccion`,
-- el trigger de la orden cerrada y el que firma el avance con la sesión.
-- `search_path` vacío y cada tabla calificada. Quién programa sale de
-- `auth.uid()` y no de un parámetro (regla 6).

create or replace function public.programar_ordenes_a_diseno(
  p_ordenes uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_hoja integer;
  v_fila record;
begin
  if v_usuario is null then
    raise exception 'No hay una sesión activa'
      using errcode = 'UE006';
  end if;

  -- Con SECURITY DEFINER no hay RLS que lo ataje: esta es la barrera del rol.
  if public.rol_actual() is distinct from 'secretaria' then
    raise exception 'La programación a diseño la registra secretaría'
      using errcode = 'UE007';
  end if;

  if p_ordenes is null or array_length(p_ordenes, 1) is null then
    raise exception 'La hoja de programación está vacía'
      using errcode = 'UE008';
  end if;

  select coalesce(max(numero_orden_programacion), 0) + 1
  into v_hoja
  from public.orden;

  for v_fila in
    select orden_id, turno
    from unnest(p_ordenes) with ordinality as entrada(orden_id, turno)
    order by entrada.turno
  loop
    update public.orden
    set numero_orden_programacion = v_hoja,
        posicion_programacion = v_fila.turno
    where id = v_fila.orden_id
      and posicion_programacion is null;

    -- Una orden ya programada no cambia de hoja ni de turno: el update no la
    -- encuentra y la hoja entera se deshace.
    if not found then
      raise exception 'Una de las órdenes de la hoja no existe o ya está programada'
        using errcode = 'UE005';
    end if;

    insert into public.avance_seccion (
      orden_id, checkpoint, usuario_id, observaciones
    )
    values (
      v_fila.orden_id,
      'programada_diseno',
      v_usuario,
      'Programación ' || v_hoja
    );
  end loop;

  return v_hoja;
end;
$$;

comment on function public.programar_ordenes_a_diseno is
  'HU-03: arma una hoja de programación con las órdenes recibidas, en ese orden, y marca su etapa de programada a diseño.';

revoke execute on function public.programar_ordenes_a_diseno from public, anon;

grant execute on function public.programar_ordenes_a_diseno to authenticated;
