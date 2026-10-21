import {
  buscarCheckpoint,
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { etapasQueNoAplicaron } from "@/features/workflow/transiciones";
import type {
  AvanceAnulado,
  AvanceSeccion,
  EtapaTablero,
  OrdenEnTablero,
  ResumenTablero,
  SemaforoOrden,
} from "@/lib/ordenes/types";

/**
 * Reglas puras para derivar el estado de una orden (HU-14, HU-15). Sin I/O ni
 * "server-only": fáciles de testear. En `lib/` porque las comparten el tablero
 * y el asistente.
 */

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

/**
 * "Paula Henao (Secretaría)": quien marcó una etapa, con el rol que le toca a
 * esa etapa. El rol sale del dueño del checkpoint y no de la cuenta: cada etapa
 * la marca un solo rol (RLS lo garantiza), y así el historial no cambia si
 * después a la persona le cambian el rol.
 */
export function describirQuienMarco(
  nombre: string,
  seccion: CheckpointId,
): string {
  return `${nombre} (${ETIQUETAS_ROL[buscarCheckpoint(seccion).rolDueno]})`;
}

/**
 * Las etapas de la orden con su estado, a partir de los avances VIGENTES. Los
 * anulados por una devolución (HU-18) no cuentan para el estado, pero se
 * adjuntan a su etapa para que el track muestre que se devolvió. Una orden de
 * corrección declara su `etapaInicial`: las anteriores no le aplican.
 */
export function armarEtapas(
  avances: AvanceSeccion[],
  anulados: AvanceAnulado[] = [],
  etapaInicial: CheckpointId | null = null,
): EtapaTablero[] {
  const porSeccion = new Map(avances.map((a) => [a.seccion, a]));
  const noAplicaron = new Set(
    etapasQueNoAplicaron(
      avances.map((avance) => avance.seccion),
      etapaInicial,
    ),
  );

  return CHECKPOINTS.map((cp) => {
    const avance = porSeccion.get(cp.id) ?? null;
    return {
      seccion: cp.id,
      etiqueta: cp.etiqueta,
      estado: avance
        ? ("completada" as const)
        : noAplicaron.has(cp.id)
          ? ("no_aplico" as const)
          : ("pendiente" as const),
      avance,
      anulados: anulados
        .filter((anulado) => anulado.seccion === cp.id)
        .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
    };
  });
}

/**
 * Cuántas etapas lleva la orden sobre cuántas se pueden marcar hoy. Las que
 * todavía no tienen pantalla no cuentan como pendientes: si contaran, una orden
 * que ya terminó todo su recorrido se vería al 67 % y nunca al 100 %.
 */
export function contarProgreso(etapas: EtapaTablero[]): {
  completadas: number;
  totales: number;
} {
  // Las que la orden pasó de largo tampoco cuentan: no se pueden marcar.
  const disponibles = etapas.filter(
    (etapa) =>
      buscarCheckpoint(etapa.seccion).disponible &&
      etapa.estado !== "no_aplico",
  );

  return {
    completadas: disponibles.filter((etapa) => etapa.estado === "completada")
      .length,
    totales: disponibles.length,
  };
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
