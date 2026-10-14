import "server-only";

import {
  puedeAvisarFaltaDeTela,
  type Administrador,
  type ResultadoAlerta,
} from "@/features/alertas/reglas";
import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-06 · Lecturas de la pantalla de telas.
 *
 * La pantalla muestra las órdenes que todavía no pasan por corte, que es donde
 * tiene sentido validar la tela. Una orden con un aviso pendiente lo muestra en
 * vez del formulario: el estado sale de las filas de `alerta`, no de una
 * columna de la orden (regla 1).
 */

/** Un aviso de tela que sigue pendiente. */
export type AvisoPendiente = {
  detalle: string;
  fechaCreacion: string;
};

export type OrdenParaTelas = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  avisoPendiente: AvisoPendiente | null;
  /** Lo que las reglas dicen de avisar en esta orden, para quien mira. */
  veredicto: ResultadoAlerta;
};

type AlertaFila = {
  tipo: string;
  estado: string;
  detalle: string;
  fecha_creacion: string;
};

/** El aviso de tela pendiente de la orden, si lo hay. */
function avisoPendienteDe(
  alertas: readonly AlertaFila[],
): AvisoPendiente | null {
  const pendiente = alertas.find(
    (alerta) => alerta.tipo === "falta_tela" && alerta.estado === "pendiente",
  );

  return pendiente
    ? { detalle: pendiente.detalle, fechaCreacion: pendiente.fecha_creacion }
    : null;
}

export async function listarOrdenesParaTelas(
  rol: Rol,
): Promise<OrdenParaTelas[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_entrega,
       cliente ( razon_social ),
       avance_seccion ( checkpoint ),
       alerta ( tipo, estado, detalle, fecha_creacion )`,
    )
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[HU-06] No se pudieron leer las órdenes", error);
    throw new Error("No se pudieron leer las órdenes.");
  }

  return data.flatMap((orden) => {
    const marcados = orden.avance_seccion.map((avance) => avance.checkpoint);

    // Con el corte hecho la tela ya se usó, y una orden completada ya salió.
    if (marcados.includes("corte_completado") || marcados.includes("cerrada")) {
      return [];
    }

    const avisoPendiente = avisoPendienteDe(orden.alerta);

    return [
      {
        id: orden.id,
        numeroOrdenCompra: orden.numero_orden_compra,
        razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
        fechaEntrega: orden.fecha_entrega,
        avisoPendiente,
        veredicto: puedeAvisarFaltaDeTela({
          marcados,
          tieneAlertaAbierta: avisoPendiente !== null,
          rol,
        }),
      },
    ];
  });
}

/** Lo que la action necesita saber de la orden antes de escribir. */
export type SituacionParaAviso = {
  numeroOrdenCompra: string;
  marcados: CheckpointId[];
  tieneAlertaAbierta: boolean;
};

/** La situación de la orden, o `null` si la orden no existe. */
export async function obtenerSituacionParaAviso(
  ordenId: string,
): Promise<SituacionParaAviso | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `numero_orden_compra,
       avance_seccion ( checkpoint ),
       alerta ( tipo, estado, detalle, fecha_creacion )`,
    )
    .eq("id", ordenId)
    .maybeSingle();

  if (error) {
    console.error("[HU-06] No se pudo leer la orden", error);
    throw new Error("No se pudo leer la orden.");
  }

  if (!data) return null;

  return {
    numeroOrdenCompra: data.numero_orden_compra,
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    tieneAlertaAbierta: avisoPendienteDe(data.alerta) !== null,
  };
}

/** Las cuentas de administración activas, que es a quien le llega el aviso. */
export async function obtenerAdministradores(): Promise<Administrador[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, creado_en")
    .eq("rol", "admin")
    .eq("activo", true);

  if (error) {
    console.error("[HU-06] No se pudo leer administración", error);
    throw new Error("No se pudo leer administración.");
  }

  return data.map((admin) => ({ id: admin.id, creadoEn: admin.creado_en }));
}
