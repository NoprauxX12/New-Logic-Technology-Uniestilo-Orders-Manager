import "server-only";

import {
  contarAlertasPendientes,
  listarAlertasDeTela,
  listarAvisosDeEntrega,
} from "@/lib/alertas/pendientes";
import { listarOrdenesTablero } from "@/lib/ordenes/estadoOrden";
import {
  clasificarPendientes,
  type Pendientes,
} from "@/lib/ordenes/pendientes";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";
import { hoyEnBogota } from "@/lib/utils/fechas";

/**
 * HU-21 · Lo que el asistente lee para señalar sin que le pregunten. Con el
 * cliente de la sesión: RLS aplica igual que en el tablero (RNF-04).
 */

/** Todo lo pendiente de hoy, clasificado. Lo usan el resumen y la herramienta. */
export async function leerPendientes(ahora = new Date()): Promise<Pendientes> {
  const [ordenes, tela, entrega] = await Promise.all([
    listarOrdenesTablero(),
    listarAlertasDeTela(),
    listarAvisosDeEntrega(),
  ]);

  return clasificarPendientes(ordenes, [...tela, ...entrega], ahora);
}

/**
 * Las órdenes atrasadas, sin armar su estado completo: la fecha de entrega ya
 * pasó (en Colombia) y no tienen el cierre vigente.
 */
async function contarAtrasadas(ahora: Date): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select("id, avance_seccion ( checkpoint )")
    .lt("fecha_entrega", hoyEnBogota(ahora))
    .is(AVANCE_VIGENTE, null);

  if (error) {
    throw new Error(`No se pudieron contar las atrasadas: ${error.message}`);
  }

  return data.filter(
    (orden) =>
      !orden.avance_seccion.some((avance) => avance.checkpoint === "cerrada"),
  ).length;
}

/**
 * El número del botón del asistente: órdenes atrasadas más alertas sin
 * atender. Se calcula en cada pantalla de administración, así que solo cuenta.
 *
 * Si la lectura falla devuelve 0 y lo registra: un número que no se pudo
 * calcular no puede tumbar la pantalla que la persona abrió.
 */
export async function contarPorAtender(ahora = new Date()): Promise<number> {
  try {
    const [atrasadas, alertas] = await Promise.all([
      contarAtrasadas(ahora),
      contarAlertasPendientes(),
    ]);
    return atrasadas + alertas;
  } catch (error) {
    console.error("[HU-21] No se pudo contar lo pendiente", error);
    return 0;
  }
}
