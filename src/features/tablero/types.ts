import type { CheckpointId } from "@/features/workflow/checkpoints";

/**
 * Formas de dominio del tablero (HU-14).
 * `queries.ts` mapea filas de la base a estos tipos.
 * El "estado" de la orden NO se guarda: se deriva de `avances` + fechas.
 */

/** Fila de auditoría inmutable (`avance_seccion`). */
export type AvanceSeccion = {
  seccion: CheckpointId;
  usuarioId: string;
  usuarioNombre: string;
  fechaHora: string; // ISO
  observacion?: string;
};

/** Cabecera de orden (`orden` + cliente, prendas y lotes). */
export type OrdenResumen = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  prenda: string;
  cantidad: number;
  fechaRecepcion: string; // ISO date (`fecha_ingreso`)
  fechaEntrega: string; // ISO date
  tallerNombre: string | null;
};

/** Semáforo derivado en aplicación (no columna editable). */
export type SemaforoOrden = "a_tiempo" | "en_riesgo" | "atrasada";

export type EstadoEtapa = "completada" | "pendiente";

export type EtapaTablero = {
  seccion: CheckpointId;
  etiqueta: string;
  estado: EstadoEtapa;
  /** Quién y cuándo — solo si está completada (criterio HU-14). */
  avance: AvanceSeccion | null;
};

/** Fila del tablero: orden + etapas derivadas. */
export type OrdenEnTablero = OrdenResumen & {
  semaforo: SemaforoOrden;
  etapas: EtapaTablero[];
  etapasCompletadas: number;
  etapasTotales: number;
};

export type ResumenTablero = {
  totalOrdenes: number;
  enProduccion: number;
  atrasadas: number;
  enRiesgo: number;
};

export type DetalleOrden = OrdenEnTablero & {
  avances: AvanceSeccion[];
};
