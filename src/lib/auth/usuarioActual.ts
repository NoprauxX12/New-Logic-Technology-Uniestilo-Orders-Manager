import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/**
 * Quién está actuando en el sistema.
 *
 * Es el único lugar de la aplicación que responde esa pregunta. Las actions no
 * saben de dónde sale la persona: le preguntan a esta función. Hoy sale de una
 * cookie que pone el desplegable de `features/auth`; cuando llegue el login
 * (HU-16) saldrá de la sesión de Supabase y solo cambia el cuerpo de aquí.
 *
 * Vive en `lib/` y no en `features/auth/` porque la necesitan varias features
 * —workflow, talleres, tablero— y una feature no puede importar de otra.
 *
 * Existe porque `avance_seccion.usuario_id`, `lote_taller.enviado_por` y
 * `lote_taller.recibido_por` son obligatorios (regla 3, RNF-05) y el Sprint 1
 * no tiene login. La alternativa era que cada historia escribiera un id fijo en
 * su propia action.
 *
 * PROVISIONAL Y SIN SEGURIDAD: cualquiera puede cambiar esa cookie y decir que
 * es otra persona. No pasa nada hoy porque las políticas RLS también están
 * abiertas; las dos cosas se cierran juntas en HU-16 y HU-17.
 */

export type Rol = Database["public"]["Enums"]["rol"];

export type UsuarioActual = {
  id: string;
  nombre: string;
  rol: Rol;
};

export const COOKIE_USUARIO_ACTUAL = "uniestilo_usuario";

/**
 * La persona que está actuando, o `null` si todavía no han escogido ninguna.
 *
 * Devuelve `null` en vez de lanzar para que cada action decida qué decirle a
 * quien está usando la pantalla.
 */
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(COOKIE_USUARIO_ACTUAL)?.value;

  if (!id) return null;

  // Se relee de la base en vez de confiar en la cookie: así el nombre y el rol
  // siempre son los de verdad, y una cookie con un id inventado no sirve.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, rol")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[auth] No se pudo leer el usuario actual", error);
    return null;
  }

  return data;
}
