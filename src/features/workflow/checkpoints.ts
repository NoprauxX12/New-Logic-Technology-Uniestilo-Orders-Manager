/**
 * Etapas de avance que se registran en `avance_seccion`.
 *
 * Esta lista es la fuente central para que la interfaz y las reglas del
 * workflow utilicen los mismos identificadores que la base de datos.
 */
export const CHECKPOINTS = [
  {
    id: "corte_completado",
    etiqueta: "Corte completado",
    rolDueno: "corte",
  },
  {
    id: "llegada_marcacion",
    etiqueta: "Llegada a marcación",
    rolDueno: "marcacion",
  },
  {
    id: "lista_despacho",
    etiqueta: "Lista para despachar",
    rolDueno: "terminacion",
  },
  {
    id: "cerrada",
    etiqueta: "Orden completada",
    rolDueno: "secretaria",
  },
] as const;

export type CheckpointId = (typeof CHECKPOINTS)[number]["id"];

export function obtenerCheckpoint(id: CheckpointId) {
  return CHECKPOINTS.find((checkpoint) => checkpoint.id === id);
}
