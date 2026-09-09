-- Base de avances · Registro de por dónde va cada orden.
--
-- Esta es la tabla sobre la que se paran las seis historias de marcado (HU-08,
-- HU-10, HU-11, HU-12, HU-19, HU-13) y el tablero (HU-14).
--
-- Regla 1: el estado de una orden NO se guarda. No hay columna `estado` en
-- `orden`; el estado es la agregación de las filas de esta tabla. Una orden sin
-- filas aquí está, por definición, apenas "Registrada".
--
-- Regla 3: esto es una bitácora de auditoría inmutable (RNF-05). Una fila dice
-- quién marcó qué y cuándo, y no se edita ni se borra nunca. Un error se
-- corrige con un registro nuevo o con una orden de corrección (HU-18).

-- ---------------------------------------------------------------------------
-- checkpoint
-- ---------------------------------------------------------------------------
-- Los nueve puntos que marca alguien durante la vida de una orden, en el orden
-- del flujo. Salen del modelo entidad-relación del equipo.
--
-- El despacho y la recepción de lotes a taller NO están aquí a propósito: son
-- entidad propia (`lote_taller`, regla 6), porque una orden se reparte en varios
-- lotes y HU-11 confronta lo recibido contra lo enviado. Un checkpoint no puede
-- representar eso.
--
-- La SECUENCIA —qué checkpoint va después de cuál y qué rol es dueño de cada
-- uno— no vive aquí sino en `src/features/workflow/checkpoints.ts` (regla 4).
-- Este enum solo declara qué valores existen; que no se salten pasos lo verifica
-- el motor. Ampliarlo después se puede (`alter type ... add value`); reordenarlo
-- o renombrar un valor, no.

create type public.checkpoint as enum (
  'cotizacion_aprobada',    -- HU-02
  'programada_diseno',      -- HU-03
  'ficha_adjunta',          -- HU-04
  'tela_programada',        -- HU-05
  'corte_completado',       -- HU-08
  'recogido_bordado',       -- HU-09
  'llegada_marcacion',      -- HU-12
  'lista_despacho',         -- HU-19
  'cerrada'                 -- HU-13
);

-- ---------------------------------------------------------------------------
-- avance_seccion
-- ---------------------------------------------------------------------------
-- Sin `on delete cascade` en ninguna de las dos referencias: la auditoría no se
-- arrastra cuando se borra otra cosa. Postgres bloquea el borrado de una orden o
-- de un usuario que tengan avances, que es justo lo que queremos.

create table public.avance_seccion (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),
  checkpoint public.checkpoint not null,

  -- Quién lo marcó. Obligatorio: es la mitad de lo que exige RNF-05.
  usuario_id uuid not null references public.usuario (id),

  fecha_hora timestamptz not null default now(),

  -- Lo que quiera dejar anotado quien marca ("faltaron 3 camisas talla M").
  observaciones text
);

-- Un checkpoint se marca una sola vez por orden (regla 2). El motor también lo
-- valida, pero aquí queda garantizado aunque la validación falle.
-- Sirve además como índice de lectura por orden, que es como consulta el
-- tablero: `orden_id` va de primero en la llave.
create unique index avance_seccion_orden_checkpoint_idx
  on public.avance_seccion (orden_id, checkpoint);

comment on table public.avance_seccion is
  'Bitácora inmutable: cada fila es un checkpoint marcado por alguien en una orden. El estado de la orden se deriva de aquí.';

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Ninguna tabla se crea sin RLS (regla 5).
--
-- ATENCIÓN — POLÍTICAS TEMPORALES Y ABIERTAS, como las de HU-01. Mientras no
-- exista login (HU-16) no hay a quién identificar; HU-17 las reemplaza por
-- políticas donde cada rol solo puede insertar los checkpoints de su sección,
-- derivadas de `checkpoints.ts`.
--
-- No se otorga update ni delete, y eso NO es temporal: la auditoría es inmutable
-- (regla 3). Esas dos políticas no deben existir nunca.

alter table public.avance_seccion enable row level security;

create policy "temporal HU-17: avance lectura abierta"
  on public.avance_seccion for select to anon, authenticated using (true);

create policy "temporal HU-17: avance alta abierta"
  on public.avance_seccion for insert to anon, authenticated with check (true);
