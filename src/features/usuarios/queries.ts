import "server-only";

import type { Rol } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/** HU-24 · Las personas que ya tienen cuenta, para que administración las vea. */

export type UsuarioListado = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  creadoEn: string;
};

export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, email, rol, creado_en")
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
    creadoEn: fila.creado_en,
  }));
}
