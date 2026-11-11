/**
 * Formas de las alertas pendientes que ve administración (HU-07, HU-20). Las
 * usan el tablero, que las pinta, y el asistente (HU-21), que las señala; por
 * eso viven en `lib/` y no en una feature (ADR 0003).
 *
 * Solo tipos: sin I/O, se pueden importar desde reglas puras y componentes.
 */

/** Una alerta de tela pendiente, como la ve administración en el tablero. */
export type AlertaTelaEnTablero = {
  tipo: "falta_tela";
  id: string;
  ordenId: string;
  detalle: string;
  fechaCreacion: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  enviadaPor: string;
};

/** Una alerta de entrega próxima, pendiente, para quien la recibió (HU-20). */
export type AvisoDeEntrega = {
  tipo: "proximidad_entrega";
  id: string;
  ordenId: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  /** `YYYY-MM-DD`, para calcular el plazo al momento de mirar. */
  fechaEntrega: string;
};

export type AlertaDelTablero = AlertaTelaEnTablero | AvisoDeEntrega;
