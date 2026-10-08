import "server-only";

import type { Rol } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/** HU-24 · Las personas que ya tienen cuenta, para que administración las vea. */

export type UsuarioListado = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  /** false: la cuenta está desactivada, sin acceso, con su rastro intacto. */
  activo: boolean;
  creadoEn: string;
};

export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, email, rol, activo, creado_en")
    .order("activo", { ascending: false })
    .order("nombre");

  if (error) {
    console.error("[HU-24] No se pudieron leer las personas", error);
    throw new Error("No se pudieron leer las personas.");
  }

  return data.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
    activo: fila.activo,
    creadoEn: fila.creado_en,
  }));
}

/** Una persona por id, o `null`. Lo usa la action antes de modificarla. */
export async function obtenerUsuario(
  id: string,
): Promise<UsuarioListado | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, email, rol, activo, creado_en")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[HU-24] No se pudo leer la persona", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    nombre: data.nombre,
    email: data.email,
    rol: data.rol,
    activo: data.activo,
    creadoEn: data.creado_en,
  };
}
