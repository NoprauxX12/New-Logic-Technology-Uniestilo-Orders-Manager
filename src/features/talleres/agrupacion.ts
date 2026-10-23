import type { OrdenParaTalleres } from "@/features/talleres/queries";
import { compararPorUrgencia } from "@/lib/ordenes/urgencia";

/**
 * Cómo se ordena la lista de talleres de logística (HU-10, HU-11).
 *
 * Logística no tiene una sola tarea sino tres, y cada orden está en una:
 *
 * 1. **Por despachar**: recogida y bordada, todavía sin ningún lote en un taller.
 *    Primero las más urgentes.
 * 2. **En el taller, por recibir**: tiene lotes afuera. Primero la que lleva más
 *    días fuera, que es la que más riesgo de retraso tiene.
 * 3. **Ya volvieron**: todos sus lotes regresaron. Plegado: no hay nada urgente,
 *    pero sigue a mano por si hay que despachar otro lote.
 *
 * Función pura: recibe lo que la consulta ya derivó de los lotes.
 */

export type OrdenesDeTalleres = {
  porDespachar: OrdenParaTalleres[];
  enElTaller: OrdenParaTalleres[];
  volvieron: OrdenParaTalleres[];
};

export function agruparOrdenesDeTalleres(
  ordenes: readonly OrdenParaTalleres[],
  ahora = new Date(),
): OrdenesDeTalleres {
  const porDespachar: OrdenParaTalleres[] = [];
  const enElTaller: OrdenParaTalleres[] = [];
  const volvieron: OrdenParaTalleres[] = [];

  for (const orden of ordenes) {
    if (orden.lotesTotales === 0) porDespachar.push(orden);
    else if (orden.lotesSinRecibir > 0) enElTaller.push(orden);
    else volvieron.push(orden);
  }

  const porUrgencia = compararPorUrgencia(ahora);

  porDespachar.sort(porUrgencia);
  enElTaller.sort(
    (uno, otro) =>
      // El que salió primero (fecha más vieja) va primero.
      (uno.enTallerDesde ?? "9999").localeCompare(
        otro.enTallerDesde ?? "9999",
      ) || porUrgencia(uno, otro),
  );
  volvieron.sort(porUrgencia);

  return { porDespachar, enElTaller, volvieron };
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** «Lleva 3 días en el taller», o «Salió hoy». */
export function describirDiasEnTaller(
  enTallerDesde: string,
  ahora = new Date(),
): string {
  const dias = Math.floor(
    (ahora.getTime() - Date.parse(enTallerDesde)) / MS_DIA,
  );
  if (dias <= 0) return "Salió hoy al taller";
  return dias === 1
    ? "Lleva 1 día en el taller"
    : `Lleva ${dias} días en el taller`;
}
