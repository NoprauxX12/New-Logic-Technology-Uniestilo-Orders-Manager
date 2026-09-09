import type { Rol } from "@/features/workflow/checkpoints";

/**
 * Quién está marcando un avance.
 *
 * Decisión provisional del Sprint 1. `avance_seccion.usuario_id` es obligatorio
 * —cada avance tiene que decir quién y cuándo (RNF-05)— pero el login llega en
 * HU-16. Mientras tanto todas las historias de marcado toman de aquí a quien
 * marca, en vez de repartir el UUID del seed por cada action.
 *
 * HU-16 reemplaza el cuerpo por la sesión real (el usuario de `auth.getUser()`
 * y su fila en `usuario`) sin que cambien la firma ni las llamadas. Por eso ya
 * es asíncrona aunque hoy no espere nada, y por eso el UUID no se exporta:
 * nadie más debería conocerlo.
 */

export type UsuarioActual = {
  id: string;
  nombre: string;
  rol: Rol;
};

/** Sandra Vélez, de marcación. Sale de `supabase/seed.sql`. */
const USUARIO_DE_MARCACION: UsuarioActual = {
  id: "00000000-0000-0000-0000-0000000000a6",
  nombre: "Sandra Vélez",
  rol: "marcacion",
};

export async function usuarioActual(): Promise<UsuarioActual> {
  return { ...USUARIO_DE_MARCACION };
}
