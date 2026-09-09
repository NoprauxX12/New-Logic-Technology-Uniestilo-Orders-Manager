import { CHECKPOINTS } from "@/features/workflow/checkpoints";
import type {
  AvanceSeccion,
  EtapaTablero,
  OrdenEnTablero,
  ResumenTablero,
  SemaforoOrden,
} from "@/features/tablero/types";

/** Reglas puras del tablero (HU-14). Sin I/O ni "server-only": fáciles de testear. */

const MS_DIA = 24 * 60 * 60 * 1000;
export const DIAS_EN_RIESGO = 3;

/** Diferencia en días de calendario (ignora la hora del reloj). */
export function diasHasta(fechaIso: string, ahora = new Date()): number {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const entrega = new Date(anio, mes - 1, dia);
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((entrega.getTime() - hoy.getTime()) / MS_DIA);
}

export function derivarSemaforo(
  fechaEntrega: string,
  ahora = new Date(),
): SemaforoOrden {
  const dias = diasHasta(fechaEntrega, ahora);
  if (dias < 0) return "atrasada";
  if (dias <= DIAS_EN_RIESGO) return "en_riesgo";
  return "a_tiempo";
}

export function armarEtapas(avances: AvanceSeccion[]): EtapaTablero[] {
  const porSeccion = new Map(avances.map((a) => [a.seccion, a]));

  return CHECKPOINTS.map((cp) => {
    const avance = porSeccion.get(cp.id) ?? null;
    return {
      seccion: cp.id,
      etiqueta: cp.etiqueta,
      estado: avance ? ("completada" as const) : ("pendiente" as const),
      avance,
    };
  });
}

export function resumirTablero(ordenes: OrdenEnTablero[]): ResumenTablero {
  return {
    totalOrdenes: ordenes.length,
    enProduccion: ordenes.filter(
      (o) => o.etapasCompletadas > 0 && o.etapasCompletadas < o.etapasTotales,
    ).length,
    atrasadas: ordenes.filter((o) => o.semaforo === "atrasada").length,
    enRiesgo: ordenes.filter((o) => o.semaforo === "en_riesgo").length,
  };
}
