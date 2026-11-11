import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import type { AlertaDelTablero } from "@/lib/alertas/tipos";
import { diasHasta } from "@/lib/ordenes/reglas";
import type { OrdenEnTablero } from "@/lib/ordenes/types";
import { compararPorUrgencia } from "@/lib/ordenes/urgencia";
import { hoyEnBogota } from "@/lib/utils/fechas";

/**
 * HU-21 · Lo que administración tiene por atender hoy, clasificado.
 *
 * Es lo que el asistente señala sin que le pregunten: las órdenes atrasadas, las
 * que están en riesgo de entrega, las que llevan días sin moverse y las alertas
 * sin atender. Puro, sin I/O: recibe lo que `lib/ordenes` y `lib/alertas` ya
 * leyeron y se prueba con stubs. Vive en `lib/` porque decide con el estado
 * derivado de la orden, igual que el tablero.
 *
 * Cada orden aparece una sola vez, en su grupo más urgente: atrasada antes que
 * en riesgo, y en riesgo antes que detenida. Las cerradas no aparecen.
 */

/**
 * Cuántos días sin ningún avance hacen que una orden se considere detenida.
 * Días de calendario en hora de Colombia, como el resto de las fechas.
 */
export const DIAS_SIN_AVANCE_DETENIDA = 3;

/** Dónde está parada la orden: a quién le toca moverla y qué sigue. */
export type Parada = {
  /** El área como se le muestra a una persona: "Corte", "Taller satélite"… */
  area: string;
  /** La etapa que sigue, o lo que se espera del taller. */
  siguiente: string;
  /** Si está en un taller satélite: lo mueve Logística al recibir. */
  enTaller: boolean;
};

export type OrdenPorAtender = {
  orden: OrdenEnTablero;
  /** Días de calendario desde el último avance vigente (o desde el registro). */
  diasSinAvance: number;
  parada: Parada;
};

export type Pendientes = {
  atrasadas: OrdenPorAtender[];
  enRiesgo: OrdenPorAtender[];
  /** A tiempo, pero sin avance hace `DIAS_SIN_AVANCE_DETENIDA` días o más. */
  detenidas: OrdenPorAtender[];
  alertasDeTela: Extract<AlertaDelTablero, { tipo: "falta_tela" }>[];
  avisosDeEntrega: Extract<AlertaDelTablero, { tipo: "proximidad_entrega" }>[];
};

/**
 * Días desde el último avance vigente de la orden. Sin avances, se cuenta desde
 * que se registró: una orden que nadie ha tocado también está detenida.
 */
export function diasSinAvance(orden: OrdenEnTablero, ahora: Date): number {
  const ultimo = orden.etapas
    .flatMap((etapa) =>
      etapa.estado === "completada" && etapa.avance
        ? [etapa.avance.fechaHora]
        : [],
    )
    .sort()
    .at(-1);

  const desde = ultimo ? hoyEnBogota(new Date(ultimo)) : orden.fechaRecepcion;
  return Math.max(0, -diasHasta(desde, ahora));
}

/**
 * Dónde está parada la orden. Con lotes sin recibir está en el taller, aunque
 * la siguiente etapa del flujo sea la llegada a marcación: ahí la mueve
 * Logística cuando confirma la recepción (HU-11).
 */
export function dondeEstaParada(orden: OrdenEnTablero): Parada | null {
  if (orden.lotesEnTaller > 0) {
    return {
      area: "Taller satélite",
      siguiente: `${ETIQUETAS_ROL.logistica} confirma la recepción de las prendas`,
      enTaller: true,
    };
  }

  const sigue = loQueSigue(
    orden.etapas
      .filter((etapa) => etapa.estado === "completada")
      .map((etapa) => etapa.seccion),
    orden.etapaInicial,
  );

  return sigue
    ? {
        area: sigue.responsable,
        siguiente: sigue.checkpoint.etiqueta,
        enTaller: false,
      }
    : null;
}

export function clasificarPendientes(
  ordenes: readonly OrdenEnTablero[],
  alertas: readonly AlertaDelTablero[],
  ahora = new Date(),
): Pendientes {
  const pendientes: Pendientes = {
    atrasadas: [],
    enRiesgo: [],
    detenidas: [],
    alertasDeTela: [],
    avisosDeEntrega: [],
  };

  const porUrgencia = [...ordenes].sort(compararPorUrgencia(ahora));

  for (const orden of porUrgencia) {
    if (orden.semaforo === "entregada") continue;

    const parada = dondeEstaParada(orden);
    if (!parada) continue;

    const item: OrdenPorAtender = {
      orden,
      diasSinAvance: diasSinAvance(orden, ahora),
      parada,
    };

    if (orden.semaforo === "atrasada") {
      pendientes.atrasadas.push(item);
    } else if (orden.semaforo === "en_riesgo") {
      pendientes.enRiesgo.push(item);
    } else if (
      // En el taller el tiempo corre sin avances a propósito: las prendas se
      // están confeccionando afuera. No es una orden olvidada.
      !parada.enTaller &&
      item.diasSinAvance >= DIAS_SIN_AVANCE_DETENIDA
    ) {
      pendientes.detenidas.push(item);
    }
  }

  // Las detenidas, de la que lleva más días quieta a la que menos.
  pendientes.detenidas.sort(
    (una, otra) => otra.diasSinAvance - una.diasSinAvance,
  );

  for (const alerta of alertas) {
    if (alerta.tipo === "falta_tela") pendientes.alertasDeTela.push(alerta);
    else pendientes.avisosDeEntrega.push(alerta);
  }

  pendientes.alertasDeTela.sort((una, otra) =>
    una.fechaCreacion.localeCompare(otra.fechaCreacion),
  );
  pendientes.avisosDeEntrega.sort((uno, otro) =>
    uno.fechaEntrega.localeCompare(otro.fechaEntrega),
  );

  return pendientes;
}

/** Si no hay nada que señalar: ni órdenes por atender ni alertas. */
export function estaAlDia(pendientes: Pendientes): boolean {
  return (
    pendientes.atrasadas.length === 0 &&
    pendientes.enRiesgo.length === 0 &&
    pendientes.detenidas.length === 0 &&
    pendientes.alertasDeTela.length === 0 &&
    pendientes.avisosDeEntrega.length === 0
  );
}
