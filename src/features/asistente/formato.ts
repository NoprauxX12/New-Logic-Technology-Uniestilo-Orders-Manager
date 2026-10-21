import type { Checkpoint, CheckpointId } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import { diasHasta } from "@/lib/ordenes/reglas";
import type {
  DetalleOrden,
  OrdenEnTablero,
  SemaforoOrden,
} from "@/lib/ordenes/types";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-15 · Cómo se le cuenta una orden al modelo.
 *
 * Reglas puras: reciben lo que `lib/ordenes` ya derivó y lo traducen a objetos
 * planos, en lenguaje del taller y con las fechas como se leen en Marinilla,
 * para que el modelo responda con eso y no tenga que interpretar ids ni ISO.
 * Sin I/O: se prueban con stubs.
 */

const ETIQUETA_SEMAFORO: Record<SemaforoOrden, string> = {
  a_tiempo: "a tiempo",
  en_riesgo: "en riesgo (entrega en 3 días o menos)",
  atrasada: "atrasada (la fecha de entrega ya pasó)",
};

export type FiltroOrdenes =
  | "todas"
  | "atrasadas"
  | "en_riesgo"
  | "en_produccion"
  | "sin_empezar"
  | "terminadas";

export const FILTROS_ORDENES: readonly FiltroOrdenes[] = [
  "todas",
  "atrasadas",
  "en_riesgo",
  "en_produccion",
  "sin_empezar",
  "terminadas",
];

export type OrdenParaModelo = {
  ordenId: string;
  numeroOrdenCompra: string;
  cliente: string;
  prendas: string;
  cantidadTotal: number;
  fechaIngreso: string;
  fechaEntrega: string;
  diasParaEntrega: number;
  semaforo: string;
  /** La última etapa marcada, o que todavía no se ha marcado ninguna. */
  etapaActual: string;
  loQueSigue: { etapa: string; responsable: string } | null;
  avance: string;
  talleres: string;
  /** La pantalla de la orden en el tablero, para el "Consúltala aquí". */
  enlace: string;
};

export type HistorialEtapa = {
  etapa: string;
  quien: string;
  cuando: string;
  observacion?: string;
};

export type DetalleParaModelo = OrdenParaModelo & {
  /** Las etapas marcadas, en el orden en que se marcaron. */
  historial: HistorialEtapa[];
  /** Las etapas que faltan y que hoy se pueden marcar, en orden del flujo. */
  etapasPendientes: string[];
};

function fechaHoraDelTaller(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

function marcados(orden: OrdenEnTablero): CheckpointId[] {
  return orden.etapas
    .filter((etapa) => etapa.estado === "completada")
    .map((etapa) => etapa.seccion);
}

function etapaActual(orden: OrdenEnTablero): string {
  const completadas = orden.etapas.filter(
    (etapa) => etapa.estado === "completada",
  );
  const ultima = completadas[completadas.length - 1];
  return ultima ? ultima.etiqueta : "Registrada, sin etapas marcadas todavía";
}

function describirLoQueSigue(
  orden: OrdenEnTablero,
): OrdenParaModelo["loQueSigue"] {
  const siguiente = loQueSigue(marcados(orden));
  if (!siguiente) return null;
  return {
    etapa: siguiente.checkpoint.etiqueta,
    responsable: siguiente.responsable,
  };
}

export function resumirOrden(
  orden: OrdenEnTablero,
  ahora = new Date(),
): OrdenParaModelo {
  return {
    ordenId: orden.id,
    numeroOrdenCompra: orden.numeroOrdenCompra,
    cliente: orden.razonSocial,
    prendas: orden.prenda,
    cantidadTotal: orden.cantidad,
    fechaIngreso: formatearFecha(orden.fechaRecepcion),
    fechaEntrega: formatearFecha(orden.fechaEntrega),
    diasParaEntrega: diasHasta(orden.fechaEntrega, ahora),
    semaforo: ETIQUETA_SEMAFORO[orden.semaforo],
    etapaActual: etapaActual(orden),
    loQueSigue: describirLoQueSigue(orden),
    avance: `${orden.etapasCompletadas} de ${orden.etapasTotales} etapas`,
    talleres: orden.estadoTalleres,
    enlace: enlaceDeOrden(orden.id),
  };
}

export function enlaceDeOrden(ordenId: string): string {
  return `/tablero/${ordenId}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Si el texto tiene forma de id de orden (uuid) y no de número o cliente. */
export function pareceUuid(texto: string): boolean {
  return UUID.test(texto.trim());
}

export function detallarOrden(
  detalle: DetalleOrden,
  disponibles: readonly Pick<Checkpoint, "id" | "etiqueta">[],
  ahora = new Date(),
): DetalleParaModelo {
  const porSeccion = new Map(
    detalle.etapas.map((etapa) => [etapa.seccion, etapa]),
  );

  return {
    ...resumirOrden(detalle, ahora),
    historial: detalle.avances.map((avance) => ({
      etapa: porSeccion.get(avance.seccion)?.etiqueta ?? avance.seccion,
      quien: avance.usuarioNombre,
      cuando: fechaHoraDelTaller(avance.fechaHora),
      ...(avance.observacion ? { observacion: avance.observacion } : {}),
    })),
    etapasPendientes: disponibles
      .filter(
        (checkpoint) => porSeccion.get(checkpoint.id)?.estado === "pendiente",
      )
      .map((checkpoint) => checkpoint.etiqueta),
  };
}

/**
 * Sin tildes ni virgulillas, sin mayúsculas y sin espacios de sobra, para
 * comparar lo que escribe la persona con lo que hay en la base.
 */
export function normalizar(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Los modelos escriben "OC‑5003" con guion no separable; en la base es "-".
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .toLowerCase()
      .trim()
  );
}

/**
 * Las órdenes cuyo número de orden de compra o cliente contienen el texto.
 * "5003" encuentra "OC-5003"; "colegio" encuentra "Colegio San José".
 */
export function filtrarOrdenes(
  ordenes: readonly OrdenEnTablero[],
  texto: string,
): OrdenEnTablero[] {
  const buscado = normalizar(texto);
  if (!buscado) return [];

  return ordenes.filter(
    (orden) =>
      normalizar(orden.numeroOrdenCompra).includes(buscado) ||
      normalizar(orden.razonSocial).includes(buscado),
  );
}

export function filtrarPorEstado(
  ordenes: readonly OrdenEnTablero[],
  filtro: FiltroOrdenes,
): OrdenEnTablero[] {
  switch (filtro) {
    case "todas":
      return [...ordenes];
    case "atrasadas":
      return ordenes.filter((orden) => orden.semaforo === "atrasada");
    case "en_riesgo":
      return ordenes.filter((orden) => orden.semaforo === "en_riesgo");
    case "en_produccion":
      return ordenes.filter(
        (orden) =>
          orden.etapasCompletadas > 0 &&
          orden.etapasCompletadas < orden.etapasTotales,
      );
    case "sin_empezar":
      return ordenes.filter((orden) => orden.etapasCompletadas === 0);
    case "terminadas":
      return ordenes.filter(
        (orden) =>
          orden.etapasTotales > 0 &&
          orden.etapasCompletadas === orden.etapasTotales,
      );
  }
}
