import "server-only";

import { redirect } from "next/navigation";

import { puedeEntrar } from "@/features/auth/accesoPorRuta";
import { getUsuarioActual, type UsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * HU-17 · La guardia que cada página llama primero.
 *
 * Sin sesión manda al login y vuelve después a esta misma ruta. Con sesión pero
 * sin permiso para esta pantalla manda a la portada, que le dice a la persona
 * que esa pantalla no es de su sección y le ofrece las suyas.
 *
 * Es la primera capa (RNF-04): la segunda son las políticas RLS, que rechazan
 * la escritura aunque alguien llegue a la pantalla por otro camino.
 */
export async function exigirAcceso(ruta: string): Promise<UsuarioActual> {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    redirect(`/login?next=${encodeURIComponent(ruta)}`);
  }

  if (!puedeEntrar(usuario.rol, ruta)) {
    redirect(`/?sinAcceso=${encodeURIComponent(ruta)}`);
  }

  return usuario;
}
