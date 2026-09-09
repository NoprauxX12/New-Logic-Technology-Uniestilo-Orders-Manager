"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_USUARIO_ACTUAL } from "@/lib/auth/usuarioActual";

/**
 * Cambia la persona con la que se está trabajando.
 *
 * La cookie solo se puede escribir desde una Server Action: al renderizar no se
 * puede, porque para entonces la respuesta ya va en camino.
 *
 * Y termina redirigiendo a la misma ruta a propósito. Guardar la cookie no
 * basta: el desplegable vive en el layout, y tras una action Next no lo vuelve
 * a renderizar, así que la pantalla seguiría mostrando la selección vieja
 * aunque la cookie ya estuviera bien guardada. El redirect obliga a pedir la
 * página otra vez, y ahí sí se lee la cookie nueva. Va con `"replace"` para no
 * llenar el historial del navegador cada vez que alguien cambia de persona.
 */

/** Adónde volver. Solo rutas de esta aplicación. */
function rutaSegura(valor: FormDataEntryValue | null): string {
  if (typeof valor !== "string") return "/";
  // Tiene que ser una ruta interna: `//otro-sitio.com` también empieza por "/".
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  return valor;
}

export async function cambiarUsuarioActual(formData: FormData) {
  const usuarioId = formData.get("usuarioId");
  const ruta = rutaSegura(formData.get("ruta"));
  const cookieStore = await cookies();

  if (typeof usuarioId !== "string" || usuarioId === "") {
    cookieStore.delete(COOKIE_USUARIO_ACTUAL);
  } else {
    cookieStore.set(COOKIE_USUARIO_ACTUAL, usuarioId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Fuera de cualquier try/catch: `redirect` funciona lanzando.
  redirect(ruta, "replace");
}
