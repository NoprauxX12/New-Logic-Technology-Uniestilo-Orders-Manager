"use server";

import {
  ENTRADA_VACIA,
  agruparErrores,
  leerFormularioOrden,
  type EntradaFormularioOrden,
} from "@/features/ordenes/formulario";
import { nuevaOrdenSchema } from "@/features/ordenes/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-01 · Registro de una nueva orden.
 *
 * Única vía para guardar una orden. Valida la entrada con el esquema y delega
 * la escritura en la función `registrar_orden` de Postgres, que hace las tres
 * inserciones (cliente, orden, prendas) en una sola transacción.
 *
 * Nota de seguridad: una Server Action se puede invocar con un POST directo,
 * sin pasar por el formulario. Hoy no hay a quién autenticar porque el login
 * llega en HU-16; la verificación de sesión y rol se agrega aquí en HU-17,
 * junto con el cierre de las políticas RLS abiertas.
 */

/** Lo que la action le devuelve al formulario. */
export type EstadoFormularioOrden = {
  ok: boolean;
  /** Mensaje general, para lo que no pertenece a un campo concreto. */
  mensaje: string;
  /** Errores por campo, con la ruta como clave (`items.1.cantidad`). */
  errores: Record<string, string[]>;
  /** Lo escrito, para volver a pintarlo si hubo error. Vacío tras guardar. */
  valores: EntradaFormularioOrden;
};

/** Código de Postgres para "violación de restricción única". */
const VIOLACION_DE_UNICIDAD = "23505";

export async function registrarOrden(
  _estadoPrevio: EstadoFormularioOrden,
  formData: FormData,
): Promise<EstadoFormularioOrden> {
  const escrito = leerFormularioOrden(formData);
  const validacion = nuevaOrdenSchema.safeParse(escrito);

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: agruparErrores(validacion.error),
      valores: escrito,
    };
  }

  const orden = validacion.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("registrar_orden", {
    p_numero_orden_compra: orden.numeroOrdenCompra,
    p_nit: orden.nit,
    p_razon_social: orden.razonSocial,
    p_contacto_nombre: orden.contactoNombre,
    p_contacto_celular: orden.contactoCelular,
    p_fecha_ingreso: orden.fechaIngreso,
    p_fecha_entrega: orden.fechaEntrega,
    p_observaciones: orden.observaciones ?? "",
    p_items: orden.items,
  });

  if (error) {
    if (error.code === VIOLACION_DE_UNICIDAD) {
      return {
        ok: false,
        mensaje: "",
        errores: {
          numeroOrdenCompra: [
            "Ya hay una orden registrada con ese número de orden de compra",
          ],
        },
        valores: escrito,
      };
    }

    console.error("[HU-01] No se pudo registrar la orden", error);
    return {
      ok: false,
      mensaje: "No se pudo guardar la orden. Vuelve a intentarlo.",
      errores: {},
      valores: escrito,
    };
  }

  return {
    ok: true,
    mensaje: `Orden ${orden.numeroOrdenCompra} registrada.`,
    errores: {},
    valores: ENTRADA_VACIA,
  };
}
