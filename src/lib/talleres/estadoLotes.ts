/**
 * Cómo se lee el estado de una orden en cuanto a talleres (HU-10, HU-11).
 *
 * El estado no se guarda en ninguna columna (regla 1): se deriva de los lotes.
 * Vive en `lib/` y no en la feature `talleres` porque también lo muestra el
 * tablero, y una feature no importa de otra.
 */

/** Lo mínimo que hay que saber de un lote para saber si sigue afuera. */
export type LoteEnviado = { recibido: boolean };

/** Los lotes que todavía están en el taller, sin confirmar su recepción. */
export function lotesEnTaller<T extends LoteEnviado>(lotes: readonly T[]): T[] {
  return lotes.filter((lote) => !lote.recibido);
}

export function describirEstadoDeTalleres(
  lotes: readonly LoteEnviado[],
): string {
  if (lotes.length === 0) return "Todavía no ha salido a ningún taller.";

  const afuera = lotesEnTaller(lotes).length;

  if (afuera === 0) return "Todo el trabajo volvió del taller.";
  if (afuera === 1 && lotes.length === 1) return "En confección.";

  return `En confección · ${afuera} de ${lotes.length} lotes todavía en taller.`;
}
