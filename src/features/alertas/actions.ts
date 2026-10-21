"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_AVISO_VACIA,
  leerFormularioAviso,
  leerOrdenId,
  type EntradaAvisoTela,
} from "@/features/alertas/formulario";
import {
  obtenerAdministradores,
  obtenerSituacionParaAviso,
} from "@/features/alertas/queries";
import {
  destinatarioDeAlertaTela,
  puedeAtenderAlerta,
  puedeAtenderAlertaDeEntrega,
  puedeAvisarFaltaDeTela,
  puedeMarcarLlegadaDeTela,
} from "@/features/alertas/reglas";
import {
  atenderAlertaSchema,
  avisarFaltaDeTelaSchema,
  marcarLlegadaDeTelaSchema,
} from "@/features/alertas/schemas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-06 · Avisar a administración que falta tela para una orden.
 *
 * Única vía para crear una alerta de tela. El orden de las verificaciones es el
 * mismo de las demás actions del proyecto:
 *
 * 1. El esquema revisa lo que se escribió (el detalle es obligatorio).
 * 2. La persona sale de la sesión (HU-16), nunca de un campo del formulario.
 * 3. Las reglas de la feature comprueban el rol, el punto en que va la orden y
 *    que no haya ya un aviso pendiente.
 * 4. La base repite lo importante: RLS exige el rol, la firma y que el
 *    destinatario sea de administración, y el índice único impide el aviso
 *    doble aunque dos personas lo manden a la vez.
 *
 * Avisar no marca ningún checkpoint: una alerta es entidad propia con
 * destinatario y estado (regla 7), y la atiende administración en HU-07.
 */

/** Lo que la action le devuelve al formulario. */
export type EstadoFormularioAviso = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  valores: EntradaAvisoTela;
};

/** Violación del índice único: ya hay un aviso de tela pendiente. */
const VIOLACION_DE_UNICIDAD = "23505";
/** RLS rechazó la fila: el rol, la firma o el destinatario no corresponden. */
const RLS_RECHAZO = "42501";

function fallo(
  mensaje: string,
  valores: EntradaAvisoTela,
): EstadoFormularioAviso {
  return { ok: false, mensaje, errores: {}, valores };
}

export async function avisarFaltaDeTela(
  _estadoPrevio: EstadoFormularioAviso,
  formData: FormData,
): Promise<EstadoFormularioAviso> {
  const escrito = leerFormularioAviso(formData);
  const validacion = avisarFaltaDeTelaSchema.safeParse({
    ...escrito,
    ordenId: leerOrdenId(formData),
  });

  if (!validacion.success) {
    const errores = z.flattenError(validacion.error).fieldErrors;

    // Un ordenId inválido no es algo que la persona pueda corregir en un campo.
    if (errores.ordenId) {
      return fallo(
        "No se pudo identificar la orden. Vuelve a abrir la pantalla.",
        escrito,
      );
    }

    return {
      ok: false,
      mensaje: "Revisa el campo marcado en rojo.",
      errores,
      valores: escrito,
    };
  }

  const { ordenId, detalle } = validacion.data;

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return fallo("Inicia sesión para avisar que falta tela.", escrito);
  }

  const [situacion, administradores] = await Promise.all([
    obtenerSituacionParaAviso(ordenId),
    obtenerAdministradores(),
  ]);

  if (!situacion) return fallo("No encontramos esa orden.", escrito);

  const permiso = puedeAvisarFaltaDeTela({
    marcados: situacion.marcados,
    tieneAlertaAbierta: situacion.tieneAlertaAbierta,
    rol: usuario.rol,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje, escrito);

  const destinatarioId = destinatarioDeAlertaTela(administradores);

  if (!destinatarioId) {
    console.error("[HU-06] No hay ninguna cuenta de administración activa");
    return fallo(
      "No hay nadie en administración para recibir el aviso. Pide que activen una cuenta.",
      escrito,
    );
  }

  const supabase = await createClient();

  // `fecha_creacion` la pone el `default now()` de la columna, no el navegador:
  // una hora que viniera del cliente sería falsificable (RNF-05).
  const { error } = await supabase.from("alerta").insert({
    tipo: "falta_tela",
    orden_id: ordenId,
    destinatario_id: destinatarioId,
    creada_por: usuario.id,
    detalle,
  });

  if (error) {
    if (error.code === VIOLACION_DE_UNICIDAD) {
      revalidatePath("/ordenes/telas");
      return fallo(
        "Otra persona ya avisó que falta tela en esta orden.",
        ENTRADA_AVISO_VACIA,
      );
    }

    if (error.code === RLS_RECHAZO) {
      return fallo("La falta de tela la avisa Secretaría.", escrito);
    }

    console.error("[HU-06] No se pudo crear la alerta", error);
    return fallo("No se pudo enviar el aviso. Vuelve a intentarlo.", escrito);
  }

  revalidatePath("/ordenes/telas");
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje: `Aviso enviado a administración por la orden ${situacion.numeroOrdenCompra}.`,
    errores: {},
    valores: ENTRADA_AVISO_VACIA,
  };
}

/**
 * HU-22 · Marcar que llegó la tela de una orden, lo que la libera a corte.
 *
 * Mismo orden que el aviso: esquema, sesión, reglas, y la base respalda. La
 * hora y quién la recibió los pone el trigger de la base aunque aquí se manden:
 * la action los envía solo para que la fila pase la política de RLS.
 *
 * Marcar la llegada no marca ningún checkpoint. Lo que cambia es que la orden
 * deja de estar esperando tela, y el motor de workflow vuelve a dejar marcar el
 * corte (requisito `tela_en_empresa` en `checkpoints.ts`).
 */

/** Lo que la action le devuelve al botón. */
export type EstadoLlegadaTela = {
  ok: boolean;
  mensaje: string;
};

/** El trigger de HU-22: la llegada ya estaba registrada. */
const LLEGADA_YA_REGISTRADA = "UE007";

export async function marcarLlegadaDeTela(
  _estadoPrevio: EstadoLlegadaTela,
  formData: FormData,
): Promise<EstadoLlegadaTela> {
  const validacion = marcarLlegadaDeTelaSchema.safeParse({
    ordenId: leerOrdenId(formData),
  });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "No se pudo identificar la orden. Vuelve a abrir la pantalla.",
    };
  }

  const { ordenId } = validacion.data;

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return {
      ok: false,
      mensaje: "Inicia sesión para marcar que llegó la tela.",
    };
  }

  const situacion = await obtenerSituacionParaAviso(ordenId);

  if (!situacion) return { ok: false, mensaje: "No encontramos esa orden." };

  const permiso = puedeMarcarLlegadaDeTela({
    esperandoTela: situacion.tieneAlertaAbierta,
    rol: usuario.rol,
  });

  if (!permiso.permitido) return { ok: false, mensaje: permiso.mensaje };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("alerta")
    .update({
      tela_llegada_en: new Date().toISOString(),
      tela_recibida_por: usuario.id,
    })
    .eq("orden_id", ordenId)
    .eq("tipo", "falta_tela")
    .is("tela_llegada_en", null)
    .select("id");

  if (error) {
    if (error.code === RLS_RECHAZO) {
      return {
        ok: false,
        mensaje: "La llegada de la tela la marca Secretaría.",
      };
    }

    if (error.code === LLEGADA_YA_REGISTRADA) {
      revalidatePath("/ordenes/telas");
      return {
        ok: false,
        mensaje: "La llegada de esta tela ya estaba marcada.",
      };
    }

    console.error("[HU-22] No se pudo marcar la llegada de la tela", error);
    return {
      ok: false,
      mensaje: "No se pudo marcar la llegada. Vuelve a intentarlo.",
    };
  }

  // Ninguna fila cambió: otra persona la marcó entre la lectura y la escritura.
  if (data.length === 0) {
    revalidatePath("/ordenes/telas");
    return {
      ok: false,
      mensaje: "Otra persona ya marcó que llegó la tela de esta orden.",
    };
  }

  // La orden queda libre para corte: su pantalla y el tablero tienen que verlo.
  revalidatePath("/ordenes/telas");
  revalidatePath("/ordenes/corte");
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje: `Tela recibida. La orden ${situacion.numeroOrdenCompra} ya puede pasar a corte.`,
  };
}

/**
 * HU-07 · Marcar una alerta de tela como resuelta para que salga del tablero.
 *
 * No se borra: queda atendida, con fecha de atención. Eso no libera la orden
 * a corte; la tela la marca secretaría cuando llega (HU-22).
 */

export type EstadoAtencionAlerta = {
  ok: boolean;
  mensaje: string;
};

export async function atenderAlertaDeTela(
  _estadoPrevio: EstadoAtencionAlerta,
  formData: FormData,
): Promise<EstadoAtencionAlerta> {
  const validacion = atenderAlertaSchema.safeParse({
    alertaId: formData.get("alertaId"),
  });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "No se pudo identificar la alerta. Vuelve a abrir el tablero.",
    };
  }

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return {
      ok: false,
      mensaje: "Inicia sesión para resolver la alerta.",
    };
  }

  const permiso = puedeAtenderAlerta({ rol: usuario.rol });

  if (!permiso.permitido) return { ok: false, mensaje: permiso.mensaje };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("alerta")
    .update({
      estado: "atendida",
      fecha_atencion: new Date().toISOString(),
    })
    .eq("id", validacion.data.alertaId)
    .eq("tipo", "falta_tela")
    .eq("estado", "pendiente")
    .select("id");

  if (error) {
    if (error.code === RLS_RECHAZO) {
      return {
        ok: false,
        mensaje: "Las alertas de tela las resuelve Administración.",
      };
    }

    console.error("[HU-07] No se pudo resolver la alerta", error);
    return {
      ok: false,
      mensaje: "No se pudo resolver la alerta. Vuelve a intentarlo.",
    };
  }

  if (data.length === 0) {
    const { data: sigue } = await supabase
      .from("alerta")
      .select("estado")
      .eq("id", validacion.data.alertaId)
      .maybeSingle();

    revalidatePath("/tablero");

    if (sigue?.estado === "pendiente") {
      return {
        ok: false,
        mensaje: "No se pudo resolver la alerta. Vuelve a intentarlo.",
      };
    }

    return {
      ok: false,
      mensaje: "Esa alerta ya estaba resuelta.",
    };
  }

  revalidatePath("/tablero");
  revalidatePath("/ordenes/telas");

  return { ok: true, mensaje: "Alerta resuelta." };
}

/**
 * HU-20 · "Ya lo vi": el destinatario marca atendido su aviso de entrega.
 *
 * Cada quien atiende solo el suyo: la regla lo comprueba con la sesión, y la
 * base lo repite (RLS y el filtro por destinatario). La fila no se borra.
 */
export async function atenderAvisoDeEntrega(
  _estadoPrevio: EstadoAtencionAlerta,
  formData: FormData,
): Promise<EstadoAtencionAlerta> {
  const validacion = atenderAlertaSchema.safeParse({
    alertaId: formData.get("alertaId"),
  });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "No se pudo identificar el aviso. Vuelve a abrir la pantalla.",
    };
  }

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return { ok: false, mensaje: "Inicia sesión para marcar el aviso." };
  }

  const supabase = await createClient();

  const { data: alerta } = await supabase
    .from("alerta")
    .select("destinatario_id, estado")
    .eq("id", validacion.data.alertaId)
    .eq("tipo", "proximidad_entrega")
    .maybeSingle();

  if (!alerta) return { ok: false, mensaje: "No encontramos ese aviso." };

  const permiso = puedeAtenderAlertaDeEntrega({
    destinatarioId: alerta.destinatario_id,
    usuarioId: usuario.id,
  });

  if (!permiso.permitido) return { ok: false, mensaje: permiso.mensaje };

  const { data, error } = await supabase
    .from("alerta")
    .update({
      estado: "atendida",
      fecha_atencion: new Date().toISOString(),
    })
    .eq("id", validacion.data.alertaId)
    .eq("tipo", "proximidad_entrega")
    .eq("destinatario_id", usuario.id)
    .eq("estado", "pendiente")
    .select("id");

  if (error) {
    console.error("[HU-20] No se pudo marcar el aviso", error);
    return {
      ok: false,
      mensaje: "No se pudo marcar el aviso. Vuelve a intentarlo.",
    };
  }

  revalidatePath("/");
  revalidatePath("/tablero");

  if (data.length === 0) {
    return { ok: false, mensaje: "Ese aviso ya estaba marcado." };
  }

  return { ok: true, mensaje: "Listo." };
}
