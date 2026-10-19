import "server-only";

import {
  puedeAvisarFaltaDeTela,
  puedeMarcarLlegadaDeTela,
  type Administrador,
  type ResultadoAlerta,
} from "@/features/alertas/reglas";
import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-06 y HU-22 · Lecturas de la pantalla de telas.
 *
 * La pantalla muestra las órdenes que todavía no pasan por corte, que es donde
 * tiene sentido validar la tela. Cada orden está en uno de dos estados, y los
 * dos salen de las filas de `alerta`, no de una columna de la orden (regla 1):
 *
 * - esperando tela: tiene una alerta de tela sin llegada. Se muestra el aviso
 *   y el botón para marcar que llegó (HU-22).
 * - sin espera: se muestra el formulario para avisar (HU-06), y si la tela de
 *   un aviso anterior ya llegó, cuándo.
 */

/** Un aviso de tela cuya tela todavía no ha llegado. */
export type AvisoAbierto = {
  detalle: string;
  fechaCreacion: string;
  /** Si administración ya lo atendió (hizo el pedido). La tela puede no haber llegado. */
  atendido: boolean;
};

export type OrdenParaTelas = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  avisoAbierto: AvisoAbierto | null;
  /** Cuándo llegó la tela del aviso más reciente, si ya llegó. */
  ultimaLlegada: string | null;
  /** HU-06: lo que las reglas dicen de avisar en esta orden, para quien mira. */
  veredictoAviso: ResultadoAlerta;
  /** HU-22: lo que las reglas dicen de marcar que llegó la tela. */
  veredictoLlegada: ResultadoAlerta;
};

type AlertaFila = {
  tipo: string;
  estado: string;
  detalle: string;
  fecha_creacion: string;
  tela_llegada_en: string | null;
};

function deTela(alertas: readonly AlertaFila[]): AlertaFila[] {
  return alertas.filter((alerta) => alerta.tipo === "falta_tela");
}

/** El aviso de tela abierto de la orden, si lo hay: la tela no ha llegado. */
function avisoAbiertoDe(alertas: readonly AlertaFila[]): AvisoAbierto | null {
  const abierta = deTela(alertas).find(
    (alerta) => alerta.tela_llegada_en === null,
  );

  return abierta
    ? {
        detalle: abierta.detalle,
        fechaCreacion: abierta.fecha_creacion,
        atendido: abierta.estado === "atendida",
      }
    : null;
}

/** La llegada de tela más reciente de la orden, si alguna vez llegó. */
function ultimaLlegadaDe(alertas: readonly AlertaFila[]): string | null {
  const llegadas = deTela(alertas)
    .map((alerta) => alerta.tela_llegada_en)
    .filter((fecha): fecha is string => fecha !== null)
    .sort();

  return llegadas[llegadas.length - 1] ?? null;
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
       alerta ( tipo, estado, detalle, fecha_creacion, tela_llegada_en )`,
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

    const avisoAbierto = avisoAbiertoDe(orden.alerta);
    const esperandoTela = avisoAbierto !== null;

    return [
      {
        id: orden.id,
        numeroOrdenCompra: orden.numero_orden_compra,
        razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
        fechaEntrega: orden.fecha_entrega,
        avisoAbierto,
        ultimaLlegada: ultimaLlegadaDe(orden.alerta),
        veredictoAviso: puedeAvisarFaltaDeTela({
          marcados,
          tieneAlertaAbierta: esperandoTela,
          rol,
        }),
        veredictoLlegada: puedeMarcarLlegadaDeTela({ esperandoTela, rol }),
      },
    ];
  });
}

/** Lo que las actions necesitan saber de la orden antes de escribir. */
export type SituacionParaAviso = {
  numeroOrdenCompra: string;
  marcados: CheckpointId[];
  /** Si tiene una alerta de tela cuya tela no ha llegado. */
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
       alerta ( tipo, estado, detalle, fecha_creacion, tela_llegada_en )`,
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
    tieneAlertaAbierta: avisoAbiertoDe(data.alerta) !== null,
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

/** Una alerta de tela pendiente, como la ve administración en el tablero. */
export type AlertaTelaEnTablero = {
  id: string;
  detalle: string;
  fechaCreacion: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  enviadaPor: string;
};

/**
 * HU-07 · Las alertas de tela que siguen pendientes.
 *
 * Atendida no sale: marcarla resuelta la saca del tablero sin borrar la fila.
 * Las de proximidad de entrega (HU-20) no son esta historia.
 */
export async function listarAlertasDeTelaPendientes(): Promise<
  AlertaTelaEnTablero[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("alerta")
    .select(
      `id,
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
    id: alerta.id,
    detalle: alerta.detalle,
    fechaCreacion: alerta.fecha_creacion,
    numeroOrdenCompra: alerta.orden?.numero_orden_compra ?? "Sin orden",
    razonSocial: alerta.orden?.cliente?.razon_social ?? "Sin cliente",
    enviadaPor: alerta.creador?.nombre ?? "Secretaría",
  }));
}
