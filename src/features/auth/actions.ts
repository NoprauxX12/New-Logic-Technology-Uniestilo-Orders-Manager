"use server";

import { redirect } from "next/navigation";

import { CUENTAS_DEMO } from "@/features/auth/cuentasDemo";
import { rutaSegura } from "@/features/auth/rutaSegura";
import { iniciarSesionSchema } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-16 · Iniciar y cerrar sesión.
 *
 * Van juntas en el mismo archivo porque las dos son la fachada de
 * `supabase.auth`: nada más en la aplicación llama a `signInWithPassword` ni a
 * `signOut` directamente.
 */

/** Lo que la action le devuelve al formulario de login. */
export type EstadoIniciarSesion = {
  ok: boolean;
  mensaje: string;
  /** Lo escrito, para no borrar el correo si la contraseña estaba mal. La
   *  contraseña nunca se guarda aquí. */
  email: string;
};

export async function iniciarSesion(
  _estadoPrevio: EstadoIniciarSesion,
  formData: FormData,
): Promise<EstadoIniciarSesion> {
  const escrito = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const validacion = iniciarSesionSchema.safeParse(escrito);

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Escribe tu correo y tu contraseña.",
      email: escrito.email,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validacion.data);

  if (error) {
    // HU-24: una cuenta desactivada queda bloqueada en Auth. Decirle a la
    // persona que revise su contraseña la haría intentar en vano.
    if (error.code === "user_banned") {
      return {
        ok: false,
        mensaje: "Tu cuenta está desactivada. Habla con administración.",
        email: escrito.email,
      };
    }

    // Supabase distingue credenciales inválidas de otros fallos, pero al
    // taller no le sirve saber cuál de las dos fue: los dos mensajes serían
    // "revisa lo que escribiste", así que se juntan en uno.
    console.error("[HU-16] No se pudo iniciar sesión", error);
    return {
      ok: false,
      mensaje: "El correo o la contraseña no son correctos.",
      email: escrito.email,
    };
  }

  // Fuera de cualquier try/catch: `redirect` funciona lanzando.
  redirect(rutaSegura(formData.get("next")), "replace");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login", "replace");
}

/**
 * Acceso rápido del login, solo en local: entra con una cuenta del seed sin
 * escribir nada. La contraseña del seed vive aquí, en el servidor, y la action
 * se niega fuera de desarrollo aunque alguien la invoque con un POST directo.
 */
const CONTRASENA_DEL_SEED = "uniestilo123";

export async function iniciarSesionRapido(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    redirect("/login");
  }

  const email = String(formData.get("email") ?? "");
  const cuenta = CUENTAS_DEMO.find((c) => c.email === email);
  if (!cuenta) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: cuenta.email,
    password: CONTRASENA_DEL_SEED,
  });

  if (error) {
    console.error("[HU-16] Falló el acceso rápido del seed", error);
    redirect("/login");
  }

  redirect("/", "replace");
}
