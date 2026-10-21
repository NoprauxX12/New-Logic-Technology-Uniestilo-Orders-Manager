import type { CheckpointId } from "@/features/workflow/checkpoints";
import type { FichaVisible } from "@/lib/storage/fichas";

/**
 * Formas de dominio del estado de una orden (HU-14, HU-15).
 * `estadoOrden.ts` mapea filas de la base a estos tipos.
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
  /** HU-10 y HU-11: derivado de los lotes ("En confección", "Todo volvió"…). */
  estadoTalleres: string;
  /** Lotes enviados a taller que todavía no se han recibido (HU-11). */
  lotesEnTaller: number;
  /** HU-04: si diseño ya subió al menos un archivo. */
  tieneFicha: boolean;
};

/** Semáforo derivado en aplicación (no columna editable). */
export type SemaforoOrden = "a_tiempo" | "en_riesgo" | "atrasada";

/**
 * `no_aplico`: la orden pasó de largo esta etapa porque, cuando iba por ahí, la
 * etapa todavía no se podía marcar en el sistema. No es un pendiente.
 */
export type EstadoEtapa = "completada" | "pendiente" | "no_aplico";

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
  /** URLs firmadas para abrir el archivo (expiran; no se guardan). */
  fichas: FichaVisible[];
};
