import "server-only";

import type { Rol } from "@/features/workflow/checkpoints";
import {
  obtenerOrdenesParaSeccion,
  type OrdenParaSeccion,
} from "@/features/workflow/queries";

/**
 * HU-04 · Órdenes como las ve Diseño: el veredicto del motor más si esta
 * persona puede adjuntar. Administración entra a la pantalla (HU-17) pero no
 * sube: RLS y el rol dueño se lo impiden.
 */

export type OrdenParaFicha = OrdenParaSeccion & {
  puedeAdjuntar: boolean;
};

export async function obtenerOrdenesParaFicha(
  rol: Rol,
): Promise<OrdenParaFicha[]> {
  const ordenes = await obtenerOrdenesParaSeccion("ficha_adjunta", rol);

  return ordenes.map((orden) => ({
    ...orden,
    puedeAdjuntar:
      rol === "diseno" && (orden.veredicto.permitido || orden.yaMarcada),
  }));
}
