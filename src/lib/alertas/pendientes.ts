import "server-only";

import type { AlertaTelaEnTablero, AvisoDeEntrega } from "@/lib/alertas/tipos";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-07, HU-20 y HU-21 · Las alertas que todavía nadie atiende.
 *
 * Las lee el tablero de administración para pintarlas y el asistente para
 * señalarlas sin que le pregunten; por eso viven en `lib/` (ADR 0003). Son
 * lecturas con el cliente de la sesión: RLS decide qué filas ve cada quien.
 *
 * - Las de tela (HU-06) son de toda administración: se muestran todas.
 * - Las de entrega (HU-20) son de cada persona: se filtra por la sesión además
 *   de por RLS, porque administración puede leerlas todas pero cada quien
 *   atiende solo las suyas.
 */

export async function listarAlertasDeTela(): Promise<AlertaTelaEnTablero[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("alerta")
    .select(
      `id,
       orden_id,
       detalle,
       fecha_creacion,
       orden ( numero_orden_compra, cliente ( razon_social ) ),
       creador:creada_por ( nombre )`,
    )
    .eq("tipo", "falta_tela")
    .eq("estado", "pendiente")
    .order("fecha_creacion", { ascending: true });

  if (error) {
    console.error("[HU-07] No se pudieron leer las alertas", error);
    throw new Error("No se pudieron leer las alertas de tela.");
  }

  return data.map((alerta) => ({
    tipo: "falta_tela" as const,
    id: alerta.id,
    ordenId: alerta.orden_id,
    detalle: alerta.detalle,
    fechaCreacion: alerta.fecha_creacion,
    numeroOrdenCompra: alerta.orden?.numero_orden_compra ?? "Sin orden",
    razonSocial: alerta.orden?.cliente?.razon_social ?? "Sin cliente",
    enviadaPor: alerta.creador?.nombre ?? "Secretaría",
  }));
}

/**
 * HU-20 · Los avisos de entrega pendientes de la persona que mira. Las más
 * urgentes (entrega más cercana) van primero.
 */
export async function listarAvisosDeEntrega(): Promise<AvisoDeEntrega[]> {
  const usuario = await getUsuarioActual();

  if (!usuario) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("alerta")
    .select(
      `id,
       orden_id,
       orden ( numero_orden_compra, fecha_entrega, cliente ( razon_social ) )`,
    )
    .eq("tipo", "proximidad_entrega")
    .eq("estado", "pendiente")
    .eq("destinatario_id", usuario.id);

  if (error) {
    console.error("[HU-20] No se pudieron leer los avisos de entrega", error);
    throw new Error("No se pudieron leer los avisos de entrega.");
  }

  return data
    .flatMap((alerta) =>
      alerta.orden
        ? [
            {
              tipo: "proximidad_entrega" as const,
              id: alerta.id,
              ordenId: alerta.orden_id,
              numeroOrdenCompra: alerta.orden.numero_orden_compra,
              razonSocial: alerta.orden.cliente?.razon_social ?? "Sin cliente",
              fechaEntrega: alerta.orden.fecha_entrega,
            },
          ]
        : [],
    )
    .sort((uno, otro) => uno.fechaEntrega.localeCompare(otro.fechaEntrega));
}

/**
 * HU-21 · Cuántas alertas tiene sin atender la persona que mira, sin traer las
 * filas: es lo que suma el número del botón del asistente, que se calcula en
 * cada pantalla de administración.
 */
export async function contarAlertasPendientes(): Promise<number> {
  const usuario = await getUsuarioActual();

  if (!usuario) return 0;

  const supabase = await createClient();

  const [tela, entrega] = await Promise.all([
    supabase
      .from("alerta")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "falta_tela")
      .eq("estado", "pendiente"),
    supabase
      .from("alerta")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "proximidad_entrega")
      .eq("estado", "pendiente")
      .eq("destinatario_id", usuario.id),
  ]);

  const error = tela.error ?? entrega.error;
  if (error) {
    console.error("[HU-21] No se pudieron contar las alertas", error);
    throw new Error("No se pudieron contar las alertas.");
  }

  return (tela.count ?? 0) + (entrega.count ?? 0);
}
