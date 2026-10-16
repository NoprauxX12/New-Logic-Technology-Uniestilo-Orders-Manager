-- HU-03 · Programar órdenes hacia diseño.
--
-- Secretaría arma la lista de órdenes que diseño debe trabajar, en el orden en
-- que deben trabajarse. No es una lista cerrada de cinco o seis: va agregando
-- las que haga falta, hoy tres y mañana ocho, y lo que agrega después queda
-- después. Por eso la programación son dos datos en la orden y no una entidad
-- nueva: el modelo del dominio del Sprint 0 no tiene ninguna entidad de
-- programación, y `numero_orden_programacion` ya estaba reservada en `orden`
-- desde HU-01 justo para este momento.
--
-- El número lo escribe la secretaria —es el mismo de su hoja— y la posición la
-- pone el sistema: el siguiente del contador. No se deriva de `fecha_hora` del
-- avance porque varias órdenes programadas en el mismo acto comparten el
-- `now()` de la transacción y no habría con qué desempatar el orden de trabajo.
--
-- Escribe en dos tablas —los dos datos en `orden` y la marca en
-- `avance_seccion`—, así que va en una función de Postgres y no en varias
-- llamadas desde la aplicación (ADR 0005): o queda la programación completa, o
-- no queda nada.

-- ---------------------------------------------------------------------------
-- La posición en la hoja
-- ---------------------------------------------------------------------------

alter table public.orden
  add column posicion_programacion integer;

comment on column public.orden.posicion_programacion is
  'HU-03: el orden en que diseño debe trabajar la orden. Lo asigna el sistema, creciente y sin huecos.';

comment on column public.orden.numero_orden_programacion is
  'HU-03: el número de la hoja de programación, escrito por secretaría.';

alter table public.orden
  add constraint orden_posicion_programacion_positiva
    check (posicion_programacion is null or posicion_programacion > 0);

-- Los dos datos nacen juntos: una orden programada tiene número y posición, y
-- una sin programar no tiene ninguno de los dos. Así ninguna consulta tiene que
-- preguntar por los dos para saber si la orden ya está programada.
alter table public.orden
  add constraint orden_programacion_completa
    check (
      (numero_orden_programacion is null) = (posicion_programacion is null)
    );

-- El número no se repite, lo escriban como lo escriban. Mismo criterio que
-- `numero_orden_compra` en HU-01: índice sobre `upper()` y no una constraint,
-- porque la unicidad es sobre el texto normalizado. Los nulos no choca entre
-- sí: un índice único los trata como distintos.
create unique index orden_numero_orden_programacion_unico_idx
  on public.orden (upper(numero_orden_programacion));

-- Dos órdenes no pueden ocupar la misma posición. Además de ser la regla, es lo
-- que vuelve segura la asignación por contador: si dos personas programan a la
-- vez, las dos leen el mismo máximo y la segunda choca aquí en vez de dejar dos
-- órdenes empatadas.
create unique index orden_posicion_programacion_unico_idx
  on public.orden (posicion_programacion);

-- ---------------------------------------------------------------------------
-- Permiso para escribir esas dos columnas
-- ---------------------------------------------------------------------------
-- HU-13 quitó el update sobre `orden` entera y lo concedió solo sobre
-- `numero_factura`, dejando dicho que cada historia tendría que sumar su propio
-- grant. Este es el de HU-03.
--
-- La política no hace falta: `"secretaria registra la factura"` (HU-17) ya
-- autoriza el update de `orden` a secretaría, y las políticas RLS no distinguen
-- columnas. Lo que limita a estas dos columnas es el grant. Su nombre quedó
-- hablando solo de la factura; el día que una tercera historia escriba en
-- `orden` vale la pena renombrarla a algo como "secretaria actualiza lo suyo".

grant update (numero_orden_programacion, posicion_programacion)
  on public.orden to authenticated;

-- ---------------------------------------------------------------------------
-- programar_ordenes_a_diseno
-- ---------------------------------------------------------------------------
-- Recibe las órdenes en el orden en que deben trabajarse, con el número que
-- secretaría escribió para cada una:
--
--   [{"ordenId": "…", "numeroOrdenProgramacion": "PR-104"}, …]
--
-- Devuelve cuántas quedaron programadas.
--
-- Como el resto de funciones del proyecto: SECURITY INVOKER para que respete
-- las políticas RLS, `search_path` vacío y cada tabla calificada. Quién programa
-- sale de `auth.uid()` y no de un parámetro (regla 6).

create or replace function public.programar_ordenes_a_diseno(
  p_programaciones jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_posicion integer;
  v_total integer := 0;
  v_fila record;
begin
  if v_usuario is null then
    raise exception 'No hay una sesión activa'
      using errcode = 'UE006';
  end if;

  -- RLS rechazaría el update de todos modos, pero lo haría sin encontrar la
  -- fila: el mensaje diría que la orden no existe, que es falso y desorienta.
  if public.rol_actual() is distinct from 'secretaria' then
    raise exception 'La programación a diseño la registra secretaría'
      using errcode = 'UE007';
  end if;

  select coalesce(max(posicion_programacion), 0)
  into v_posicion
  from public.orden;

  for v_fila in
    select
      (elemento ->> 'ordenId')::uuid as orden_id,
      trim(elemento ->> 'numeroOrdenProgramacion') as numero
    from jsonb_array_elements(p_programaciones)
      with ordinality as entrada(elemento, indice)
    order by entrada.indice
  loop
    v_posicion := v_posicion + 1;

    update public.orden
    set numero_orden_programacion = v_fila.numero,
        posicion_programacion = v_posicion
    where id = v_fila.orden_id;

    if not found then
      raise exception 'Una de las órdenes de la lista no existe'
        using errcode = 'UE005';
    end if;

    insert into public.avance_seccion (
      orden_id, checkpoint, usuario_id, observaciones
    )
    values (
      v_fila.orden_id,
      'programada_diseno',
      v_usuario,
      'Programación ' || v_fila.numero
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

comment on function public.programar_ordenes_a_diseno is
  'HU-03: guarda el número y la posición de programación de cada orden y marca su etapa de programada a diseño.';

revoke execute on function public.programar_ordenes_a_diseno from public, anon;

grant execute on function public.programar_ordenes_a_diseno to authenticated;
