"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  agruparErroresCorreccion,
  agruparErroresPlanos,
  leerFormularioCorreccion,
  leerFormularioDevolucion,
  type EntradaFormularioCorreccion,
  type EntradaFormularioDevolucion,
} from "@/features/correcciones/formulario";
import { obtenerOrdenParaCorreccion } from "@/features/correcciones/queries";
import {
  etapasQueQuedanVigentes,
  puedeCrearCorreccion,
  puedeDevolver,
  validarDestino,
  validarPrendasDefectuosas,
} from "@/features/correcciones/reglas";
import {
  devolverOrdenSchema,
  ordenCorreccionSchema,
} from "@/features/correcciones/schemas";
import { buscarCheckpoint, CHECKPOINTS } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-18 · Las dos salidas ante un defecto, ambas solo de administración.
 *
 * - `devolverOrden`: la orden sigue en producción y vuelve a una etapa que ya
 *   tiene marcada. Nada se borra: los avances de esa etapa en adelante quedan
 *   anulados en la bitácora y el track lo muestra.
 * - `crearOrdenDeCorreccion`: la orden ya está cerrada; se crea una orden nueva
 *   enlazada a la original.
 *
 * Las dos validan la entrada con zod, verifican el rol y las reglas con datos
 * leídos de la base, y escriben con una función de Postgres que repite las
 * barreras: una Server Action se puede invocar con un POST directo. Quién actúa
 * sale de la sesión, nunca del formulario (regla 6).
 */

/** Códigos que las funciones de Postgres levantan (ver las migraciones de HU-18). */
const SIN_SESION = "UE006";
const NO_ES_ADMIN = "UE007";
const ORDEN_NO_EXISTE = "UE005";
const ORDEN_COMPLETADA = "UE004";
const DATOS_INVALIDOS = "UE010";
const ETAPA_NO_MARCADA = "UE011";
const ORDEN_NO_CERRADA = "UE012";
const PRENDAS_INVALIDAS = "UE013";
const RLS_RECHAZO = "42501";

function mensajeDeError(codigo: string | undefined): string | null {
  switch (codigo) {
    case SIN_SESION:
      return "Inicia sesión para continuar.";
    case NO_ES_ADMIN:
    case RLS_RECHAZO:
      return "Esto lo hace administración.";
    case ORDEN_NO_EXISTE:
      return "La orden indicada no existe.";
    case ORDEN_COMPLETADA:
      return "La orden ya está completada. Si hay un defecto, crea una orden de corrección.";
    case DATOS_INVALIDOS:
      return "Revisa los campos marcados en rojo.";
    case ETAPA_NO_MARCADA:
      return "La orden no tiene marcada esa etapa, así que no se puede volver a ella.";
    case ORDEN_NO_CERRADA:
      return "La orden todavía no está cerrada. Si va en producción, devuélvela a la etapa que corresponda.";
    case PRENDAS_INVALIDAS:
      return "Revisa las prendas: la cantidad va de 1 hasta la de la orden original y hay que escribir las tallas.";
    default:
      return null;
  }
}

/** Las pantallas que muestran el avance de una orden. */
function actualizarPantallas(ordenId: string) {
  revalidatePath("/tablero");
  revalidatePath(`/tablero/${ordenId}`);
  for (const { ruta } of CHECKPOINTS) {
    if (ruta) revalidatePath(ruta);
  }
}

// ---------------------------------------------------------------------------
// Devolver la orden a una etapa
// ---------------------------------------------------------------------------

export type EstadoDevolucion = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[]>;
  /** Lo escrito, para volver a pintarlo si hubo error. */
  valores: EntradaFormularioDevolucion;
};

export async function devolverOrden(
  _estadoPrevio: EstadoDevolucion,
  formData: FormData,
): Promise<EstadoDevolucion> {
  const escrito = leerFormularioDevolucion(formData);
  const fallo = (
    mensaje: string,
    errores: Record<string, string[]> = {},
  ): EstadoDevolucion => ({ ok: false, mensaje, errores, valores: escrito });

  const usuario = await getUsuarioActual();
  if (!usuario) return fallo("Inicia sesión para devolver la orden.");
  if (usuario.rol !== "admin") {
    return fallo("Devolver una orden a una etapa lo hace administración.");
  }

  const validacion = devolverOrdenSchema.safeParse(escrito);
  if (!validacion.success) {
    return fallo(
      "Revisa los campos marcados en rojo.",
      agruparErroresPlanos(validacion.error),
    );
  }

  const { ordenId, checkpoint, motivo } = validacion.data;

  const situacion = await obtenerSituacionDeOrden(ordenId);
  if (!situacion) return fallo("La orden indicada no existe.");

  const permiso = puedeDevolver({
    marcados: situacion.marcados,
    rol: usuario.rol,
  });
  if (!permiso.permitido) return fallo(permiso.mensaje);

  const destino = validarDestino({
    marcados: situacion.marcados,
    destino: checkpoint,
  });
  if (!destino.permitido) return fallo(destino.mensaje);

  const supabase = await createClient();
  const { error } = await supabase.rpc("devolver_orden_a_etapa", {
    p_orden_id: ordenId,
    p_checkpoint_destino: checkpoint,
    p_motivo: motivo,
  });

  if (error) {
    const conocido = mensajeDeError(error.code);
    if (conocido) return fallo(conocido);

    console.error("[HU-18] No se pudo devolver la orden", error);
    return fallo("No se pudo devolver la orden. Vuelve a intentarlo.");
  }

  actualizarPantallas(ordenId);

  const sigue = loQueSigue(
    etapasQueQuedanVigentes(situacion.marcados, checkpoint),
    situacion.etapaInicial,
  );
  const { etiqueta } = buscarCheckpoint(checkpoint);

  return {
    ok: true,
    mensaje: sigue
      ? `Listo: la orden volvió a «${etiqueta}». Ahora le toca a ${sigue.responsable}.`
      : `Listo: la orden volvió a «${etiqueta}».`,
    errores: {},
    valores: { ordenId, checkpoint: "", motivo: "" },
  };
}

// ---------------------------------------------------------------------------
// Orden de corrección
// ---------------------------------------------------------------------------

export type EstadoCorreccion = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[]>;
  /** Lo escrito, para volver a pintarlo si hubo error. */
  valores: EntradaFormularioCorreccion;
};

export async function crearOrdenDeCorreccion(
  _estadoPrevio: EstadoCorreccion,
  formData: FormData,
): Promise<EstadoCorreccion> {
  const escrito = leerFormularioCorreccion(formData);
  const fallo = (
    mensaje: string,
    errores: Record<string, string[]> = {},
  ): EstadoCorreccion => ({ ok: false, mensaje, errores, valores: escrito });

  const usuario = await getUsuarioActual();
  if (!usuario)
    return fallo("Inicia sesión para crear la orden de corrección.");
  if (usuario.rol !== "admin") {
    return fallo("Las órdenes de corrección las crea administración.");
  }

  const validacion = ordenCorreccionSchema.safeParse(escrito);
  if (!validacion.success) {
    return fallo(
      "Revisa los campos marcados en rojo.",
      agruparErroresCorreccion(validacion.error, escrito),
    );
  }

  const correccion = validacion.data;

  const original = await obtenerOrdenParaCorreccion(correccion.ordenOriginalId);
  if (!original) return fallo("La orden indicada no existe.");

  const permiso = puedeCrearCorreccion({
    marcados: original.marcados,
    rol: usuario.rol,
  });
  if (!permiso.permitido) return fallo(permiso.mensaje);

  const erroresPrendas = validarPrendasDefectuosas(
    correccion.items,
    original.prendas,
  );
  if (Object.keys(erroresPrendas).length > 0) {
    return fallo(
      "Revisa las prendas marcadas en rojo.",
      Object.fromEntries(
        Object.entries(erroresPrendas).map(([itemId, mensaje]) => [
          `cantidad.${itemId}`,
          [mensaje],
        ]),
      ),
    );
  }

  const supabase = await createClient();
  const { data: nuevaId, error } = await supabase.rpc(
    "crear_orden_de_correccion",
    {
      p_orden_original_id: correccion.ordenOriginalId,
      p_fecha_entrega: correccion.fechaEntrega,
      p_motivo: correccion.motivo,
      p_etapa_inicial: correccion.etapaInicial,
      p_items: correccion.items.map((prenda) => ({
        item_id: prenda.itemId,
        cantidad: prenda.cantidad,
        tallas: prenda.tallas,
      })),
    },
  );

  if (error || !nuevaId) {
    const conocido = mensajeDeError(error?.code);
    if (conocido) return fallo(conocido);

    console.error("[HU-18] No se pudo crear la orden de corrección", error);
    return fallo(
      "No se pudo crear la orden de corrección. Vuelve a intentarlo.",
    );
  }

  actualizarPantallas(correccion.ordenOriginalId);

  // `redirect` lanza una excepción especial: tiene que quedar fuera de un try.
  redirect(`/tablero/${nuevaId}`);
}
