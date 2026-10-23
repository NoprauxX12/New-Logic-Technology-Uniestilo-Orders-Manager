import { derivarSemaforo } from "@/lib/ordenes/reglas";
import type { SemaforoOrden } from "@/lib/ordenes/types";

/**
 * El criterio de urgencia con el que se ordenan las listas de trabajo: primero
 * las atrasadas, luego las en riesgo y luego las que van a tiempo; a igual
 * urgencia, la de entrega más cercana. Es el mismo para todas las pantallas, así
 * que vive aquí y no se repite en cada una.
 */

const RANGO: Record<SemaforoOrden, number> = {
  atrasada: 0,
  en_riesgo: 1,
  a_tiempo: 2,
  entregada: 3,
};

type ConEntrega = { fechaEntrega: string; numeroOrdenCompra: string };

/** Para `sort`: la más urgente primero. El desempate final es el número de orden. */
export function compararPorUrgencia(
  ahora: Date,
): (uno: ConEntrega, otro: ConEntrega) => number {
  return (uno, otro) =>
    RANGO[derivarSemaforo(uno.fechaEntrega, ahora)] -
      RANGO[derivarSemaforo(otro.fechaEntrega, ahora)] ||
    uno.fechaEntrega.localeCompare(otro.fechaEntrega) ||
    uno.numeroOrdenCompra.localeCompare(otro.numeroOrdenCompra);
}
