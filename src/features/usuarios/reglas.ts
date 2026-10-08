import type { Rol } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Quién puede hacer qué sobre una cuenta.
 *
 * Pura, sin base de datos. Solo administración administra cuentas, y hay tres
 * cosas que no puede hacerse a sí misma —cambiarse el rol, desactivarse y
 * borrarse—: si el único admin del taller lo hiciera, nadie podría volver a
 * crear cuentas. La base repite el "solo admin" con RLS; el "no a ti misma" es
 * una regla de la aplicación.
 */

export type AccionSobreCuenta =
  "editar" | "cambiar_rol" | "cambiar_contrasena" | "desactivar" | "borrar";

export type ResultadoAdministrar =
  { permitido: true } | { permitido: false; mensaje: string };

const PROHIBIDAS_SOBRE_SI_MISMA = new Set<AccionSobreCuenta>([
  "cambiar_rol",
  "desactivar",
  "borrar",
]);

export function puedeAdministrar({
  quien,
  objetivoId,
  accion,
}: {
  quien: { id: string; rol: Rol };
  objetivoId: string;
  accion: AccionSobreCuenta;
}): ResultadoAdministrar {
  if (quien.rol !== "admin") {
    return {
      permitido: false,
      mensaje: "Las cuentas las administra administración.",
    };
  }

  if (quien.id === objetivoId && PROHIBIDAS_SOBRE_SI_MISMA.has(accion)) {
    return {
      permitido: false,
      mensaje:
        "No puedes cambiar el rol, desactivar ni borrar tu propia cuenta. Pídeselo a otra persona de administración.",
    };
  }

  return { permitido: true };
}
