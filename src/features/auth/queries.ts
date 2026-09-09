import "server-only";

import type { UsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/** Lecturas de personas y roles. */

/**
 * Todas las personas del sistema, para el desplegable del layout.
 *
 * Cuando exista el login (HU-16) esto deja de servir para escoger quién eres y
 * pasa a ser la administración de usuarios.
 */
export async function listarUsuarios(): Promise<UsuarioActual[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, rol")
    .order("nombre");

  if (error) {
    console.error("[auth] No se pudieron listar las personas", error);
    return [];
  }

  return data ?? [];
}
