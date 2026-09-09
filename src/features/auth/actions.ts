"use server";

import { redirect } from "next/navigation";

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

/**
 * Adónde volver tras entrar. Solo rutas de esta aplicación: el proxy la pone
 * en la URL (`?next=`) cuando manda a `/login` a alguien sin sesión, y eso es
 * texto que llega de la petición, no algo en lo que se pueda confiar sin más.
 */
function rutaSegura(valor: FormDataEntryValue | null): string {
  if (typeof valor !== "string" || valor === "") return "/";
  // Tiene que ser una ruta interna: `//otro-sitio.com` también empieza por "/".
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  return valor;
}

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
