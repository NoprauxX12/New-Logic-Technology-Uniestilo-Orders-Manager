"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_VACIA,
  leerFormularioUsuario,
  type EntradaUsuario,
} from "@/features/usuarios/formulario";
import { nuevoUsuarioSchema } from "@/features/usuarios/schemas";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-24 · Crear la cuenta de una persona del taller.
 *
 * Solo administración. Son dos escrituras que no caben en una sola transacción
 * de Postgres, porque la cuenta de autenticación la crea Supabase Auth por su
 * API de administración, no SQL:
 *
 * 1. Se crea la cuenta en Auth con la secret key, ya confirmada para que la
 *    persona pueda entrar de una.
 * 2. Se inserta el perfil en `usuario` con la sesión del administrador, así la
 *    política RLS "admin crea perfiles" vuelve a comprobar el rol en la base.
 *
 * Si el paso 2 falla, se borra la cuenta del paso 1: una cuenta sin perfil
 * puede iniciar sesión pero no ve nada, y se quedaría ahí sin que nadie la
 * vea en la lista.
 *
 * La contraseña inicial la escribe administración y se la dice a la persona.
 * Cuando haya SMTP propio, esto puede pasar a ser una invitación por correo.
 */

export type EstadoFormularioUsuario = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  /** Lo escrito, para volver a pintarlo si hubo error. Nunca la contraseña. */
  valores: EntradaUsuario;
};

/** Violación de unicidad en `usuario.email`. */
const DUPLICADO = "23505";

function soloEntrada(escrito: ReturnType<typeof leerFormularioUsuario>) {
  const { nombre, email, rol } = escrito;
  return { nombre, email, rol };
}

export async function crearUsuario(
  _estadoPrevio: EstadoFormularioUsuario,
  formData: FormData,
): Promise<EstadoFormularioUsuario> {
  const escrito = leerFormularioUsuario(formData);
  const valores = soloEntrada(escrito);

  const quien = await getUsuarioActual();

  if (!quien) {
    return {
      ok: false,
      mensaje: "Inicia sesión para crear cuentas.",
      errores: {},
      valores,
    };
  }

  if (quien.rol !== "admin") {
    return {
      ok: false,
      mensaje: "Las cuentas las crea administración.",
      errores: {},
      valores,
    };
  }

  const validacion = nuevoUsuarioSchema.safeParse(escrito);

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: z.flattenError(validacion.error).fieldErrors,
      valores,
    };
  }

  const nuevo = validacion.data;
  const admin = createAdminClient();

  const { data: cuenta, error: errorCuenta } =
    await admin.auth.admin.createUser({
      email: nuevo.email,
      password: nuevo.password,
      email_confirm: true,
      user_metadata: { nombre: nuevo.nombre },
    });

  if (errorCuenta || !cuenta.user) {
    // Supabase devuelve 422 con `email_exists` cuando el correo ya tiene cuenta.
    if (errorCuenta?.code === "email_exists" || errorCuenta?.status === 422) {
      return {
        ok: false,
        mensaje: "",
        errores: { email: ["Ya hay una cuenta con ese correo"] },
        valores,
      };
    }

    console.error("[HU-24] No se pudo crear la cuenta", errorCuenta);
    return {
      ok: false,
      mensaje: "No se pudo crear la cuenta. Vuelve a intentarlo.",
      errores: {},
      valores,
    };
  }

  const supabase = await createClient();

  const { error: errorPerfil } = await supabase.from("usuario").insert({
    id: cuenta.user.id,
    nombre: nuevo.nombre,
    email: nuevo.email,
    rol: nuevo.rol,
  });

  if (errorPerfil) {
    // Sin perfil la cuenta no sirve y nadie la vería: se deshace el paso 1.
    const { error: errorBorrado } = await admin.auth.admin.deleteUser(
      cuenta.user.id,
    );
    if (errorBorrado) {
      console.error(
        "[HU-24] Quedó una cuenta sin perfil que no se pudo borrar",
        cuenta.user.id,
        errorBorrado,
      );
    }

    if (errorPerfil.code === DUPLICADO) {
      return {
        ok: false,
        mensaje: "",
        errores: { email: ["Ya hay una persona con ese correo"] },
        valores,
      };
    }

    console.error("[HU-24] No se pudo guardar el perfil", errorPerfil);
    return {
      ok: false,
      mensaje: "No se pudo guardar la persona. Vuelve a intentarlo.",
      errores: {},
      valores,
    };
  }

  revalidatePath("/usuarios");

  return {
    ok: true,
    mensaje: `Cuenta creada para ${nuevo.nombre} (${ETIQUETAS_ROL[nuevo.rol]}).`,
    errores: {},
    valores: ENTRADA_VACIA,
  };
}
