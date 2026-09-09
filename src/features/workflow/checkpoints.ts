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
};

/**
 * El orden del arreglo ES la secuencia del flujo: un checkpoint solo se puede
 * marcar cuando todos los anteriores ya están marcados.
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
  },
  {
    id: "programada_diseno",
    etiqueta: "Programada a diseño",
    rolDueno: "secretaria",
  },
  {
    id: "ficha_adjunta",
    etiqueta: "Ficha técnica adjunta",
    rolDueno: "diseno",
  },
  {
    id: "tela_programada",
    etiqueta: "Tela programada",
    rolDueno: "secretaria",
  },
  {
    id: "corte_completado",
    etiqueta: "Corte completado",
    rolDueno: "corte",
  },
  {
    id: "recogido_bordado",
    etiqueta: "Recogido y bordado",
    rolDueno: "logistica",
  },
  {
    id: "llegada_marcacion",
    etiqueta: "Llegada a marcación",
    rolDueno: "marcacion",
  },
  {
    // PENDIENTE (CLAUDE.md): HU-19 la marca "terminación (Marcela)", que no es
    // ninguno de los seis roles del modelo. Queda en `marcacion` de forma
    // provisional para no bloquear el sprint. Cuando el equipo decida, se
    // cambia aquí y —si resulta ser un rol nuevo— en una migración del enum.
    id: "lista_despacho",
    etiqueta: "Lista para despachar",
    rolDueno: "marcacion",
  },
  {
    id: "cerrada",
    etiqueta: "Orden cerrada",
    rolDueno: "secretaria",
  },
] as const satisfies readonly Checkpoint[];

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
