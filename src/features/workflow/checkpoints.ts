import type { Database } from "@/types/database.types";

/**
 * Fuente única de la secuencia de checkpoints y del rol dueño de cada uno
 * (regla 4 de CLAUDE.md). De aquí se derivan la UI, las actions y —cuando
 * llegue HU-17— las políticas RLS. Si cambia el flujo, cambia este archivo y
 * una migración.
 *
 * Los tipos salen del enum de la base, no se escriben a mano: si alguien agrega
 * un checkpoint en una migración y regenera `database.types.ts`, este archivo
 * deja de compilar hasta que lo actualicen.
 */

export type CheckpointId = Database["public"]["Enums"]["checkpoint"];
export type Rol = Database["public"]["Enums"]["rol"];

export type Checkpoint = {
  id: CheckpointId;
  /** Como se lee en pantalla, en lenguaje del taller (RNF-08/09/10). */
  etiqueta: string;
  /** El único rol que puede marcarlo. */
  rolDueno: Rol;
  /** La historia que construye la pantalla para marcarlo. */
  hu: string;
  /**
   * Dónde se marca esta etapa. `null` mientras su pantalla no exista.
   *
   * Vive aquí para que nadie tenga que mantener aparte un mapa de "esta etapa
   * se marca en tal página": la línea de tiempo de una orden saca de aquí el
   * enlace. Cada historia pone su ruta cuando construye su pantalla.
   */
  ruta: string | null;
  /**
   * Si el sistema ya permite marcarlo.
   *
   * El flujo del taller tiene nueve etapas, pero el Sprint 1 solo construye
   * cuatro: las otras cinco son de historias del Sprint 2 y 3 y todavía no
   * tienen pantalla. Sin esta marca, una orden recién registrada se quedaría
   * trancada para siempre en la primera etapa, porque el motor exigiría marcar
   * algo que nadie puede marcar.
   *
   * El motor ignora las que están en `false` al calcular cuál sigue, y el
   * tablero las muestra como todavía no disponibles en vez de pendientes. Cada
   * sprint que construye una de estas historias la pone en `true`, y al final
   * del Sprint 3 todas lo están.
   */
  disponible: boolean;
};

/**
 * El orden del arreglo ES la secuencia del flujo: un checkpoint solo se puede
 * marcar cuando todos los anteriores *disponibles* ya están marcados.
 *
 * El despacho y la recepción de lotes a taller (HU-10, HU-11) no están aquí:
 * son entidad propia (`lote_taller`, regla 6) porque una orden se reparte en
 * varios lotes y no cabe en un punto único de la línea.
 */
export const CHECKPOINTS = [
  {
    id: "cotizacion_aprobada",
    etiqueta: "Cotización aprobada",
    rolDueno: "secretaria",
    hu: "HU-02",
    disponible: false,
    ruta: null,
  },
  {
    id: "programada_diseno",
    etiqueta: "Programada a diseño",
    rolDueno: "secretaria",
    hu: "HU-03",
    disponible: false,
    ruta: null,
  },
  {
    id: "ficha_adjunta",
    etiqueta: "Ficha técnica adjunta",
    rolDueno: "diseno",
    hu: "HU-04",
    disponible: false,
    ruta: null,
  },
  {
    id: "tela_programada",
    etiqueta: "Tela programada",
    rolDueno: "secretaria",
    hu: "HU-05",
    disponible: false,
    ruta: null,
  },
  {
    id: "corte_completado",
    etiqueta: "Corte completado",
    rolDueno: "corte",
    hu: "HU-08",
    disponible: true,
    ruta: "/ordenes/corte",
  },
  {
    id: "recogido_bordado",
    etiqueta: "Recogido y bordado",
    rolDueno: "logistica",
    hu: "HU-09",
    disponible: false,
    ruta: null,
  },
  {
    id: "llegada_marcacion",
    etiqueta: "Llegada a marcación",
    rolDueno: "marcacion",
    hu: "HU-12",
    disponible: true,
    ruta: "/ordenes/marcacion",
  },
  {
    // PENDIENTE (CLAUDE.md): HU-19 la marca "terminación (Marcela)", que no es
    // ninguno de los seis roles del modelo. Queda en `marcacion` de forma
    // provisional para no bloquear el sprint. Cuando el equipo decida, se
    // cambia aquí y —si resulta ser un rol nuevo— en una migración del enum.
    id: "lista_despacho",
    etiqueta: "Lista para despachar",
    rolDueno: "marcacion",
    hu: "HU-19",
    disponible: true,
    ruta: null,
  },
  {
    id: "cerrada",
    etiqueta: "Orden cerrada",
    rolDueno: "secretaria",
    hu: "HU-13",
    disponible: true,
    ruta: null,
  },
] as const satisfies readonly Checkpoint[];

/**
 * Las etapas que hoy se pueden marcar, en el orden del flujo. Es la secuencia
 * que exige el motor; las demás se saltan hasta que su historia exista.
 */
export const CHECKPOINTS_DISPONIBLES = CHECKPOINTS.filter(
  (checkpoint) => checkpoint.disponible,
);

/** Nombre de cada rol como se le muestra a una persona. */
export const ETIQUETAS_ROL: Record<Rol, string> = {
  admin: "Administración",
  secretaria: "Secretaría",
  diseno: "Diseño",
  corte: "Corte",
  logistica: "Logística",
  marcacion: "Marcación",
};

const POR_ID = new Map<CheckpointId, Checkpoint>(
  CHECKPOINTS.map((checkpoint) => [checkpoint.id, checkpoint]),
);

/**
 * El checkpoint con ese id. Nunca devuelve `undefined`: el tipo `CheckpointId`
 * solo admite valores que están en `CHECKPOINTS`, y un test lo verifica.
 */
export function buscarCheckpoint(id: CheckpointId): Checkpoint {
  const checkpoint = POR_ID.get(id);
  if (!checkpoint) {
    throw new Error(`Checkpoint desconocido: ${id}`);
  }
  return checkpoint;
}
