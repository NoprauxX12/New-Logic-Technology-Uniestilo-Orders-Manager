import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/**
 * Quién está actuando en el sistema.
 *
 * Es el único lugar de la aplicación que responde esa pregunta. Las actions no
 * saben de dónde sale la persona: le preguntan a esta función.
 *
 * Sale de la sesión real de Supabase Auth (HU-16): `supabase.auth.getUser()`
 * revalida contra el servidor de Auth en vez de confiar en la cookie sin más,
 * y de ahí se relee `usuario` para el nombre y el rol. El JWT ya trae el rol
 * como claim `user_role` (ver la migración `..._hook_rol_en_jwt.sql`), pero
 * esta función sigue consultando la tabla: es más simple, no depende de que el
 * token esté fresco, y dejar el claim sin usar todavía no cuesta nada. HU-17
 * lo aprovechará para las políticas RLS.
 *
 * Vive en `lib/` y no en `features/auth/` porque la necesitan varias features
 * —workflow, talleres, tablero, documentos— y una feature no puede importar de
 * otra.
 */

export type Rol = Database["public"]["Enums"]["rol"];

export type UsuarioActual = {
  id: string;
  nombre: string;
  rol: Rol;
};

/**
 * La persona que inició sesión, o `null` si nadie ha entrado.
 *
 * Devuelve `null` en vez de lanzar para que cada action y cada página decidan
 * qué hacer: la mayoría manda a `/login`, pero el mensaje varía.
 */
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: errorSesion,
  } = await supabase.auth.getUser();

  if (errorSesion || !user) return null;

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] No se pudo leer el usuario actual", error);
    return null;
  }

  return data;
}
