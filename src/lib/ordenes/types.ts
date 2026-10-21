import type { CheckpointId } from "@/features/workflow/checkpoints";
import type { FichaVisible } from "@/lib/storage/fichas";

/**
 * Formas de dominio del estado de una orden (HU-14, HU-15).
 * `estadoOrden.ts` mapea filas de la base a estos tipos.
 * El "estado" de la orden NO se guarda: se deriva de `avances` + fechas.
 */

/**
 * Fila de auditoría inmutable (`avance_seccion`). Cuando se habla de "los
 * avances" de una orden son los VIGENTES; los que una devolución anuló (HU-18)
 * se conservan aparte como `AvanceAnulado`.
 */
export type AvanceSeccion = {
  seccion: CheckpointId;
  usuarioId: string;
  usuarioNombre: string;
  fechaHora: string; // ISO
  observacion?: string;
};

/** Un avance que una devolución dejó sin vigencia (HU-18). Sigue en la bitácora. */
export type AvanceAnulado = AvanceSeccion & {
  /** La devolución que lo anuló. */
  devolucionId: string;
};

/** Una devolución de la orden a una etapa anterior (HU-18, tabla `reproceso`). */
export type Devolucion = {
  id: string;
  /** La etapa a la que volvió la orden. */
  destino: CheckpointId;
  motivo: string;
  porNombre: string;
  fechaHora: string; // ISO
};

/** Una orden vista desde otra: la original de una corrección o una corrección suya. */
export type EnlaceOrden = {
  id: string;
  numeroOrdenCompra: string;
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
  /** HU-18: por qué etapa entró al flujo una orden de corrección; null si recorre todo. */
  etapaInicial: CheckpointId | null;
  /** HU-18: la orden cerrada que esta corrige, si es una orden de corrección. */
  ordenOriginal: EnlaceOrden | null;
  /** HU-18: las órdenes de corrección que se crearon a partir de esta. */
  correcciones: EnlaceOrden[];
  /** HU-18: las veces que se devolvió a una etapa anterior, de la más vieja a la más nueva. */
  devoluciones: Devolucion[];
};

/**
 * Semáforo derivado en aplicación (no columna editable). `entregada` es una
 * orden con el avance `cerrada` vigente: ya salió, así que la fecha no la
 * vuelve atrasada ni en riesgo.
 */
export type SemaforoOrden = "a_tiempo" | "en_riesgo" | "atrasada" | "entregada";

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
  /**
   * HU-18: las veces que esta etapa estuvo marcada y una devolución la anuló,
   * de la más vieja a la más nueva. Se muestran en el track como "Devuelta".
   */
  anulados: AvanceAnulado[];
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
  /** Los avances vigentes. Los anulados están en cada etapa (`anulados`). */
  avances: AvanceSeccion[];
  /** URLs firmadas para abrir el archivo (expiran; no se guardan). */
  fichas: FichaVisible[];
};
