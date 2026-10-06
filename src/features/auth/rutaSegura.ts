/**
 * HU-16 · Adónde volver tras entrar.
 *
 * El proxy pone la ruta original en la URL (`?next=`) cuando manda a `/login`
 * a alguien sin sesión. Eso es texto que llega de la petición, así que solo se
 * acepta una ruta interna de esta aplicación; cualquier otra cosa vuelve a `/`.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y esta es pura.
 */
export function rutaSegura(valor: FormDataEntryValue | null): string {
  if (typeof valor !== "string" || valor === "") return "/";

  // Tiene que empezar por una sola barra. `//otro-sitio.com` también empieza
  // por "/", y `/\otro-sitio.com` lo normaliza el navegador a `//`: las dos
  // sacarían a la persona del sitio.
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  if (valor.includes("\\")) return "/";

  return valor;
}
