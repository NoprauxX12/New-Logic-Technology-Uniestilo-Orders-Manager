import { INSUMOS, type TipoInsumo } from "@/features/insumos/catalogo";
import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import {
  puedeMarcar,
  type EtapaInicial,
  type ResultadoMarcado,
} from "@/features/workflow/transiciones";

/**
 * Reglas de la validación de insumos (HU-23).
 *
 * Puras, sin base de datos ni `server-only`. Quién valida y en qué momento lo
 * decide el motor de workflow (regla 2); esto solo evita que cada pantalla y
 * la action repitan el nombre del checkpoint, y ordena el listado.
 */

/** La etapa que esta historia marca. */
export const CHECKPOINT_INSUMOS: CheckpointId = "insumos_validados";

/** El rol dueño de la validación, según `checkpoints.ts`. */
export const ROL_DE_INSUMOS: Rol = "secretaria";

/** ¿Se pueden validar los insumos de esta orden? Lo responde el motor. */
export function puedeValidarInsumos(
  marcados: readonly CheckpointId[],
  rol: Rol,
  etapaInicial?: EtapaInicial,
): ResultadoMarcado {
  return puedeMarcar({
    checkpoint: CHECKPOINT_INSUMOS,
    marcados,
    rol,
    etapaInicial,
  });
}

/** Un insumo del listado: cuál y cuánto, en palabras del taller. */
export type InsumoDelListado = {
  insumo: TipoInsumo;
  detalle: string;
};

/** Una fila de `insumo_orden` con lo que importa de la validación que la creó. */
export type FilaDeInsumo = InsumoDelListado & {
  /** El avance que la validó; `anuladoPor` deja de ser null tras una devolución. */
  avance: { anuladoPor: string | null } | null;
};

const POSICION = new Map<TipoInsumo, number>(
  INSUMOS.map((insumo, posicion) => [insumo.id, posicion]),
);

/** El listado en el orden del catálogo, que es como se lee en el taller. */
export function ordenarListado<T extends InsumoDelListado>(
  listado: readonly T[],
): T[] {
  return [...listado].sort(
    (uno, otro) =>
      (POSICION.get(uno.insumo) ?? 0) - (POSICION.get(otro.insumo) ?? 0),
  );
}

/**
 * El listado vigente de una orden: el de la validación que no se anuló.
 *
 * Una devolución (HU-18) anula el avance y deja sus filas en la base; la
 * validación siguiente crea filas nuevas. Lo que cuenta es solo lo vigente.
 */
export function listadoVigente(
  filas: readonly FilaDeInsumo[],
): InsumoDelListado[] {
  return ordenarListado(
    filas
      .filter((fila) => fila.avance !== null && fila.avance.anuladoPor === null)
      .map(({ insumo, detalle }) => ({ insumo, detalle })),
  );
}
