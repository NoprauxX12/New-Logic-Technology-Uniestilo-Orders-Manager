import { enlaceDeOrden } from "@/features/asistente/formato";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import type { OrdenPorAtender, Pendientes } from "@/lib/ordenes/pendientes";
import { estaAlDia } from "@/lib/ordenes/pendientes";
import { diasHasta } from "@/lib/ordenes/reglas";
import { formatearFecha, hoyEnBogota } from "@/lib/utils/fechas";

/**
 * HU-21 · Cómo se cuenta lo pendiente: al modelo, para que redacte el resumen
 * proactivo, y a la persona directamente cuando no hay modelo.
 *
 * Las sugerencias se arman aquí, con los datos, y no las inventa el modelo: así
 * cada una nombra el área y la etapa reales, y siempre en condicional
 * ("Podrías…"). El asistente señala; la decisión es de administración
 * (regla 10).
 *
 * Puro, sin I/O: recibe lo que `lib/ordenes/pendientes` ya clasificó.
 */

/** Cuántas órdenes de cada grupo se cuentan con detalle; del resto, cuántas son. */
export const MAX_POR_GRUPO = 5;

export type OrdenPendienteParaModelo = {
  numeroOrdenCompra: string;
  cliente: string;
  prendas: string;
  cantidadTotal: number;
  fechaEntrega: string;
  /** "se venció hace 2 días", "entrega mañana", "entrega en 3 días". */
  plazo: string;
  /** El área donde está parada: a quién le toca moverla. */
  dondeEsta: string;
  queSigue: string;
  diasSinAvance: number;
  sugerencia: string;
  enlace: string;
};

export type AlertaTelaParaModelo = {
  numeroOrdenCompra: string;
  cliente: string;
  detalle: string;
  avisoDe: string;
  /** "hoy", "hace 3 días". */
  abiertaDesde: string;
  sugerencia: string;
  enlace: string;
};

type Grupo<T> = { total: number; ordenes: T[] };

export type PendientesParaModelo = {
  alDia: boolean;
  atrasadas: Grupo<OrdenPendienteParaModelo>;
  enRiesgo: Grupo<OrdenPendienteParaModelo>;
  detenidas: Grupo<OrdenPendienteParaModelo>;
  alertasDeTela: Grupo<AlertaTelaParaModelo>;
  avisosDeEntregaSinRevisar: number;
  sugerenciaAvisos: string | null;
};

const ENLACE_TABLERO = "/tablero";

function dias(n: number): string {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

/** El plazo de entrega en palabras del taller, contado desde hoy en Colombia. */
export function frasePlazo(fechaEntrega: string, ahora: Date): string {
  const faltan = diasHasta(fechaEntrega, ahora);
  if (faltan < 0) return `se venció hace ${dias(-faltan)}`;
  if (faltan === 0) return "entrega hoy";
  if (faltan === 1) return "entrega mañana";
  return `entrega en ${dias(faltan)}`;
}

/** Desde cuándo está abierta una alerta: "hoy", "hace 1 día". */
function fraseDesde(momentoIso: string, ahora: Date): string {
  const hace = Math.max(
    0,
    -diasHasta(hoyEnBogota(new Date(momentoIso)), ahora),
  );
  return hace === 0 ? "hoy" : `hace ${dias(hace)}`;
}

type Situacion = "atrasada" | "en_riesgo" | "detenida";

/** Lo que administración podría hacer con esta orden. Nunca una orden. */
export function sugerenciaParaOrden(
  { parada, diasSinAvance, orden }: OrdenPorAtender,
  situacion: Situacion,
): string {
  const logistica = ETIQUETAS_ROL.logistica;

  if (parada.enTaller) {
    return situacion === "atrasada"
      ? `Podrías pedirle a ${logistica} que confirme con el taller cuándo devuelve las prendas y avisarle al cliente si la entrega se corre.`
      : `Podrías confirmar con ${logistica} que el taller devuelve las prendas a tiempo.`;
  }

  switch (situacion) {
    case "atrasada":
      return `Podrías preguntarle a ${parada.area} qué le falta para «${parada.siguiente}» y avisarle al cliente si la entrega se corre.`;
    case "en_riesgo":
      return `Podrías confirmar con ${parada.area} que «${parada.siguiente}» alcanza antes del ${formatearFecha(orden.fechaEntrega)}.`;
    case "detenida":
      return `Lleva ${dias(diasSinAvance)} sin avance: podrías preguntarle a ${parada.area} si algo la frenó.`;
  }
}

function ordenParaModelo(
  item: OrdenPorAtender,
  situacion: Situacion,
  ahora: Date,
): OrdenPendienteParaModelo {
  const { orden, parada, diasSinAvance } = item;
  return {
    numeroOrdenCompra: orden.numeroOrdenCompra,
    cliente: orden.razonSocial,
    prendas: orden.prenda,
    cantidadTotal: orden.cantidad,
    fechaEntrega: formatearFecha(orden.fechaEntrega),
    plazo: frasePlazo(orden.fechaEntrega, ahora),
    dondeEsta: parada.area,
    queSigue: parada.siguiente,
    diasSinAvance,
    sugerencia: sugerenciaParaOrden(item, situacion),
    enlace: enlaceDeOrden(orden.id),
  };
}

function grupo<T, U>(
  elementos: readonly T[],
  aModelo: (elemento: T) => U,
  maximo: number,
): Grupo<U> {
  return {
    total: elementos.length,
    ordenes: elementos.slice(0, maximo).map(aModelo),
  };
}

export function pendientesParaModelo(
  pendientes: Pendientes,
  ahora = new Date(),
  maximo = MAX_POR_GRUPO,
): PendientesParaModelo {
  const avisos = pendientes.avisosDeEntrega.length;

  return {
    alDia: estaAlDia(pendientes),
    atrasadas: grupo(
      pendientes.atrasadas,
      (item) => ordenParaModelo(item, "atrasada", ahora),
      maximo,
    ),
    enRiesgo: grupo(
      pendientes.enRiesgo,
      (item) => ordenParaModelo(item, "en_riesgo", ahora),
      maximo,
    ),
    detenidas: grupo(
      pendientes.detenidas,
      (item) => ordenParaModelo(item, "detenida", ahora),
      maximo,
    ),
    alertasDeTela: grupo(
      pendientes.alertasDeTela,
      (alerta) => ({
        numeroOrdenCompra: alerta.numeroOrdenCompra,
        cliente: alerta.razonSocial,
        detalle: alerta.detalle,
        avisoDe: alerta.enviadaPor,
        abiertaDesde: fraseDesde(alerta.fechaCreacion, ahora),
        sugerencia:
          "Podrías hacer el pedido de la tela y marcar la alerta como resuelta en el tablero.",
        enlace: enlaceDeOrden(alerta.ordenId),
      }),
      maximo,
    ),
    avisosDeEntregaSinRevisar: avisos,
    sugerenciaAvisos:
      avisos > 0
        ? "Podrías revisarlos en el tablero y marcar «Ya lo vi» en los que ya tengas en cuenta."
        : null,
  };
}

// ---------------------------------------------------------------------------
// El resumen sin modelo
// ---------------------------------------------------------------------------

export const RESUMEN_AL_DIA =
  "Revisé las órdenes: hoy no hay atrasadas, en riesgo de entrega ni detenidas, y no tienes alertas sin atender.";

const CIERRE =
  "Son sugerencias: las decisiones las tomas tú. Pregúntame por cualquier orden para ver el detalle.";

function consultala(enlace: string): string {
  return `[Consúltala aquí](${enlace})`;
}

function restantes(grupo: Grupo<unknown>): string[] {
  const faltan = grupo.total - grupo.ordenes.length;
  return faltan > 0
    ? [`- Y ${faltan} más: las ves todas en el [tablero](${ENLACE_TABLERO}).`]
    : [];
}

function seccionOrdenes(
  titulo: string,
  { total, ordenes }: Grupo<OrdenPendienteParaModelo>,
  describir: (orden: OrdenPendienteParaModelo) => string,
): string[] {
  if (total === 0) return [];
  return [
    `**${titulo} (${total})**`,
    ...ordenes.map(
      (orden) =>
        `- ${orden.numeroOrdenCompra} de ${orden.cliente}: ${describir(orden)} ${orden.sugerencia} ${consultala(orden.enlace)}`,
    ),
    ...restantes({ total, ordenes }),
    "",
  ];
}

/**
 * El resumen proactivo armado sin IA, con los mismos datos y las mismas
 * sugerencias. Es lo que ve administración si el modelo no está configurado o
 * no respondió: el asistente sigue señalando lo pendiente aunque el proveedor
 * falle.
 */
export function redactarResumenSinIA(datos: PendientesParaModelo): string {
  if (datos.alDia) return RESUMEN_AL_DIA;

  const lineas = [
    "Esto es lo que tienes pendiente hoy:",
    "",
    ...seccionOrdenes(
      "Atrasadas",
      datos.atrasadas,
      (orden) =>
        `${orden.plazo} (${orden.fechaEntrega}). Está en ${orden.dondeEsta}.`,
    ),
    ...seccionOrdenes(
      "En riesgo de entrega",
      datos.enRiesgo,
      (orden) =>
        `${orden.plazo} (${orden.fechaEntrega}). Está en ${orden.dondeEsta}.`,
    ),
    ...seccionOrdenes(
      "Sin avance hace días",
      datos.detenidas,
      (orden) => `está en ${orden.dondeEsta}, sigue «${orden.queSigue}».`,
    ),
    ...(datos.alertasDeTela.total > 0
      ? [
          `**Alertas de tela sin atender (${datos.alertasDeTela.total})**`,
          ...datos.alertasDeTela.ordenes.map(
            (alerta) =>
              `- ${alerta.numeroOrdenCompra} de ${alerta.cliente}: «${alerta.detalle}», avisó ${alerta.avisoDe} ${alerta.abiertaDesde}. ${alerta.sugerencia} ${consultala(alerta.enlace)}`,
          ),
          ...restantes(datos.alertasDeTela),
          "",
        ]
      : []),
    ...(datos.avisosDeEntregaSinRevisar > 0
      ? [
          `**Avisos de entrega sin revisar: ${datos.avisosDeEntregaSinRevisar}.** ${datos.sugerenciaAvisos ?? ""} Están en el [tablero](${ENLACE_TABLERO}).`,
          "",
        ]
      : []),
    CIERRE,
  ];

  return lineas.join("\n").trim();
}
