"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { puedeEditarOrden } from "@/features/ordenes/edicion";
import {
  ENTRADA_VACIA,
  agruparErrores,
  leerFormularioOrden,
  type EntradaFormularioOrden,
} from "@/features/ordenes/formulario";
import {
  edicionOrdenSchema,
  nuevaOrdenSchema,
} from "@/features/ordenes/schemas";
import { CHECKPOINTS } from "@/features/workflow/checkpoints";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-01 · Registro de una nueva orden.
 *
 * Única vía para guardar una orden. Valida la entrada con el esquema y delega
 * la escritura en la función `registrar_orden` de Postgres, que hace las tres
 * inserciones (cliente, orden, prendas) en una sola transacción.
 *
 * Solo administración registra órdenes (HU-17). El rol se verifica aquí y no
 * únicamente en la pantalla: una Server Action se puede invocar con un POST
 * directo, así que esconder el formulario no impediría nada por sí solo. La
 * base lo repite con RLS, y `registrar_orden` firma `creado_por` con la sesión.
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

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return {
      ok: false,
      mensaje: "Inicia sesión para registrar una orden.",
      errores: {},
      valores: escrito,
    };
  }

  if (usuario.rol !== "admin") {
    return {
      ok: false,
      mensaje: "Las órdenes las registra administración.",
      errores: {},
      valores: escrito,
    };
  }

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

/**
 * Editar una orden, hasta cotización aprobada inclusive (`docs/adr/0012`).
 *
 * Las reglas de aquí dan el mensaje claro; la barrera es `editar_orden`, que
 * repite rol y estado después de tomar un candado sobre la orden. Por eso lo que
 * ella rechaza también se traduce: la orden pudo pasar a diseño mientras la
 * persona llenaba el formulario.
 */

/** Códigos que levanta `editar_orden`. */
const ERRORES_DE_EDICION: Record<string, string> = {
  UE004:
    "Esta orden ya está cerrada y no se puede editar. Si hay un defecto, crea una orden de corrección.",
  UE005: "La orden indicada no existe.",
  UE006: "Inicia sesión para editar la orden.",
  UE007: "Editar una orden lo hace administración.",
  UE010: "Revisa los datos de la orden: falta alguno o no es válido.",
  UE013: "Una de las prendas ya no es de esta orden. Recarga la página.",
  UE016:
    "Esta orden ya pasó a diseño y no se puede editar. Si hay que corregirla, primero devuélvela a «Programada a diseño».",
  "42501": "Editar una orden lo hace administración.",
};

/** El cliente tiene otras órdenes: sus datos no se cambian desde una sola. */
const CLIENTE_COMPARTIDO = "UE017";

export async function editarOrden(
  _estadoPrevio: EstadoFormularioOrden,
  formData: FormData,
): Promise<EstadoFormularioOrden> {
  const escrito = leerFormularioOrden(formData);
  const fallo = (
    mensaje: string,
    errores: Record<string, string[]> = {},
  ): EstadoFormularioOrden => ({
    ok: false,
    mensaje,
    errores,
    valores: escrito,
  });

  const usuario = await getUsuarioActual();
  if (!usuario) return fallo("Inicia sesión para editar la orden.");
  if (usuario.rol !== "admin") {
    return fallo("Editar una orden lo hace administración.");
  }

  const ordenIdEscrito = formData.get("ordenId");
  const validacion = edicionOrdenSchema.safeParse({
    ...escrito,
    ordenId: typeof ordenIdEscrito === "string" ? ordenIdEscrito : "",
  });
  if (!validacion.success) {
    return fallo(
      "Revisa los campos marcados en rojo.",
      agruparErrores(validacion.error),
    );
  }

  const orden = validacion.data;

  const situacion = await obtenerSituacionDeOrden(orden.ordenId);
  if (!situacion) return fallo("La orden indicada no existe.");

  const permiso = puedeEditarOrden({
    marcados: situacion.marcados,
    etapaInicial: situacion.etapaInicial,
    rol: usuario.rol,
  });
  if (!permiso.permitido) return fallo(permiso.mensaje);

  const supabase = await createClient();
  const { data: huboCambios, error } = await supabase.rpc("editar_orden", {
    p_orden_id: orden.ordenId,
    p_numero_orden_compra: orden.numeroOrdenCompra,
    p_nit: orden.nit,
    p_razon_social: orden.razonSocial,
    p_contacto_nombre: orden.contactoNombre,
    p_contacto_celular: orden.contactoCelular,
    p_fecha_ingreso: orden.fechaIngreso,
    p_fecha_entrega: orden.fechaEntrega,
    p_observaciones: orden.observaciones ?? "",
    p_items: orden.items.map((prenda) => ({
      id: prenda.itemId ?? null,
      descripcion: prenda.descripcion,
      cantidad: prenda.cantidad,
      tallas: prenda.tallas,
      tallaje: prenda.tallaje,
      valor: prenda.valor,
      observaciones: prenda.observaciones ?? "",
    })),
  });

  if (error) {
    if (error.code === VIOLACION_DE_UNICIDAD) {
      return fallo("", {
        numeroOrdenCompra: [
          "Ya hay una orden registrada con ese número de orden de compra",
        ],
      });
    }

    if (error.code === CLIENTE_COMPARTIDO) {
      return fallo("", {
        razonSocial: [
          "Este cliente tiene otras órdenes: su razón social y su contacto no se cambian desde una sola orden. Déjalos como estaban.",
        ],
      });
    }

    const conocido = ERRORES_DE_EDICION[error.code];
    if (conocido) return fallo(conocido);

    console.error("[Edición] No se pudo editar la orden", error);
    return fallo("No se pudieron guardar los cambios. Vuelve a intentarlo.");
  }

  if (!huboCambios) return fallo("No cambiaste ningún dato de la orden.");

  revalidatePath("/tablero");
  revalidatePath(`/tablero/${orden.ordenId}`);
  for (const { ruta } of CHECKPOINTS) {
    if (ruta) revalidatePath(ruta);
  }

  // `redirect` lanza una excepción especial: tiene que quedar fuera de un try.
  redirect(`/tablero/${orden.ordenId}`);
}
