"use server";

import { revalidatePath } from "next/cache";

import {
  ENTRADA_VACIA,
  leerFormularioProgramacion,
  type EntradaProgramacion,
} from "@/features/programacion/formulario";
import {
  puedeProgramar,
  ROL_DE_PROGRAMACION,
  validarHoja,
} from "@/features/programacion/reglas";
import { programarOrdenesSchema } from "@/features/programacion/schemas";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-03 · Programar órdenes hacia diseño.
 *
 * Una sola action para toda la hoja: la secretaria agrega las órdenes que haga
 * falta, las acomoda en el orden en que deben trabajarse y confirma una vez. O
 * quedan todas programadas en la misma hoja o no queda ninguna, porque la
 * escritura la hace una función de Postgres (ADR 0005).
 *
 * El recorrido es el de siempre: el esquema revisa lo que llegó, las reglas de
 * la hoja comprueban lo que el motor no puede saber, el motor de workflow dice
 * si cada orden puede marcar esta etapa y con qué rol (regla 2), y la base
 * vuelve a comprobarlo con RLS, los índices únicos y el trigger de las órdenes
 * cerradas, porque una server action se puede invocar con un POST directo.
 *
 * Quién programa sale de la sesión, nunca del formulario (regla 6).
 */

export type EstadoProgramacion = {
  ok: boolean;
  mensaje: string;
  /** Errores por `ordenId`, para pintarlos junto a la orden que los causó. */
  errores: Record<string, string[]>;
  /** Lo que se había armado, para no perderlo si algo salió mal. */
  valores: EntradaProgramacion;
};

export const ESTADO_INICIAL: EstadoProgramacion = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_VACIA,
};

/** Violación de unicidad: esa hoja y ese turno ya existían. */
const DUPLICADO = "23505";
/** La orden ya está completada (trigger de HU-13). */
const ORDEN_COMPLETADA = "UE004";
/** Una de las órdenes de la hoja no existe. */
const ORDEN_INEXISTENTE = "UE005";
/** La función no encontró sesión. */
const SIN_SESION = "UE006";
/** Quien programa no es secretaría. */
const ROL_EQUIVOCADO = "UE007";
/** La hoja llegó vacía. */
const HOJA_VACIA = "UE008";
/** RLS rechazó la fila: el rol o la firma no corresponden. */
const RLS_RECHAZO = "42501";

function fallo(
  mensaje: string,
  valores: EntradaProgramacion,
  errores: Record<string, string[]> = {},
): EstadoProgramacion {
  return { ok: false, mensaje, errores, valores };
}

function mensajeConocido(codigo: string | undefined): string | null {
  switch (codigo) {
    case SIN_SESION:
      return "Tu sesión se cerró. Vuelve a entrar para programar.";
    case ROL_EQUIVOCADO:
    case RLS_RECHAZO:
      return `La programación a diseño la registra ${ETIQUETAS_ROL[ROL_DE_PROGRAMACION]}.`;
    case HOJA_VACIA:
      return "Agrega al menos una orden a la programación.";
    case ORDEN_INEXISTENTE:
      return "Una de las órdenes ya no existe. Vuelve a abrir la pantalla.";
    case ORDEN_COMPLETADA:
      return "Una de las órdenes ya está completada y no admite más cambios.";
    case DUPLICADO:
      return "Alguien programó al mismo tiempo que tú. Vuelve a intentarlo.";
    default:
      return null;
  }
}

export async function programarOrdenes(
  _estadoPrevio: EstadoProgramacion,
  formData: FormData,
): Promise<EstadoProgramacion> {
  const entrada = leerFormularioProgramacion(formData);

  const validacion = programarOrdenesSchema.safeParse(entrada);

  if (!validacion.success) {
    return fallo(
      validacion.error.issues[0]?.message ??
        "Revisa la programación antes de guardarla.",
      entrada,
    );
  }

  const { ordenes } = validacion.data;

  const hoja = validarHoja(ordenes);
  if (!hoja.valida) return fallo(hoja.mensaje, entrada);

  const usuario = await getUsuarioActual();
  if (!usuario) {
    return fallo("Inicia sesión para programar las órdenes.", entrada);
  }

  if (usuario.rol !== ROL_DE_PROGRAMACION) {
    return fallo(
      `La programación a diseño la registra ${ETIQUETAS_ROL[ROL_DE_PROGRAMACION]}.`,
      entrada,
    );
  }

  // El motor decide orden por orden: una puede estar lista y otra no.
  const errores: Record<string, string[]> = {};

  for (const ordenId of ordenes) {
    const situacion = await obtenerSituacionDeOrden(ordenId);

    if (!situacion) {
      errores[ordenId] = ["Esta orden ya no existe."];
      continue;
    }

    const veredicto = puedeProgramar(situacion.marcados, usuario.rol);
    if (!veredicto.permitido) errores[ordenId] = [veredicto.mensaje];
  }

  if (Object.keys(errores).length > 0) {
    return fallo(
      "Algunas órdenes de la hoja no se pueden programar todavía. Quítalas y vuelve a intentar.",
      entrada,
      errores,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("programar_ordenes_a_diseno", {
    p_ordenes: ordenes,
  });

  if (error) {
    const conocido = mensajeConocido(error.code);
    if (conocido) return fallo(conocido, entrada);

    console.error("[HU-03] No se pudo programar la hoja", error);
    return fallo(
      "No se pudo guardar la programación. Vuelve a intentarlo.",
      entrada,
    );
  }

  revalidatePath("/ordenes/programacion");
  revalidatePath("/tablero");
  for (const ordenId of ordenes) {
    revalidatePath(`/tablero/${ordenId}`);
  }

  const cuantas = ordenes.length;

  return {
    ok: true,
    mensaje: `Listo: la programación #${data} quedó con ${cuantas} ${
      cuantas === 1 ? "orden" : "órdenes"
    }.`,
    errores: {},
    valores: ENTRADA_VACIA,
  };
}
