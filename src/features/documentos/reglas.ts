import {
  buscarCheckpoint,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import { compararPorUrgencia } from "@/lib/ordenes/urgencia";
import { puedeMarcar } from "@/features/workflow/transiciones";

/**
 * HU-13 · Reglas del cierre de una orden.
 *
 * No consultan la base: reciben lo que la orden ya tiene marcado y devuelven la
 * decisión, para poder probarlas sin levantar nada.
 *
 * Casi todo el trabajo lo hace el motor de workflow: como las tres cosas que
 * cierran la orden son checkpoints dentro de la secuencia, el motor ya impide
 * marcarlas antes de que la orden esté lista para despachar, y ya impide cerrar
 * si falta alguna de las tres. Aquí solo se le da nombre a esas reglas.
 */

/** Las tres cosas que hay que reportar antes de completar la orden. */
export const REPORTES_DEL_CIERRE = [
  "etiquetas",
  "documentos_despacho",
  "factura_generada",
] as const;

export type ReporteDelCierre = (typeof REPORTES_DEL_CIERRE)[number];

export type ResultadoCierre =
  { permitido: true } | { permitido: false; mensaje: string };

export function esReporteDelCierre(valor: string): valor is ReporteDelCierre {
  return REPORTES_DEL_CIERRE.some((reporte) => reporte === valor);
}

/** Etiqueta del reporte tal como se le muestra a la secretaria. */
export function etiquetaDelReporte(reporte: ReporteDelCierre): string {
  return buscarCheckpoint(reporte).etiqueta;
}

/** Si la orden ya quedó completada. */
export function estaCompletada(marcados: readonly CheckpointId[]): boolean {
  return marcados.includes("cerrada");
}

/** Los reportes del cierre que todavía faltan. */
export function reportesPendientes(
  marcados: readonly CheckpointId[],
): ReporteDelCierre[] {
  return REPORTES_DEL_CIERRE.filter((reporte) => !marcados.includes(reporte));
}

type Situacion = {
  ordenExiste: boolean;
  marcados: readonly CheckpointId[];
  /** El rol de quien reporta. Sale de la sesión; el motor decide si es el dueño. */
  rol: Rol;
};

/** ¿Se puede reportar esta parte del cierre? */
export function validarReporte({
  ordenExiste,
  marcados,
  reporte,
  rol,
}: Situacion & { reporte: ReporteDelCierre }): ResultadoCierre {
  if (!ordenExiste) {
    return { permitido: false, mensaje: "La orden indicada no existe." };
  }

  const veredicto = puedeMarcar({ checkpoint: reporte, marcados, rol });

  return veredicto.permitido
    ? { permitido: true }
    : { permitido: false, mensaje: veredicto.mensaje };
}

/**
 * ¿Se puede dar la orden por completada?
 *
 * El motor exige que los tres reportes estén marcados, porque van antes de
 * `cerrada` en la secuencia. Aquí solo se traduce ese "no" a un mensaje que
 * nombra lo que falta, que es más útil que "antes hay que marcar X".
 */
export function validarCierre({
  ordenExiste,
  marcados,
  rol,
}: Situacion): ResultadoCierre {
  if (!ordenExiste) {
    return { permitido: false, mensaje: "La orden indicada no existe." };
  }

  const pendientes = reportesPendientes(marcados);

  if (pendientes.length > 0) {
    const faltan = pendientes
      .map((reporte) => etiquetaDelReporte(reporte).toLowerCase())
      .join(", ");

    return {
      permitido: false,
      mensaje: `Antes hay que reportar: ${faltan}.`,
    };
  }

  const veredicto = puedeMarcar({ checkpoint: "cerrada", marcados, rol });

  return veredicto.permitido
    ? { permitido: true }
    : { permitido: false, mensaje: veredicto.mensaje };
}

/**
 * Cómo se ordena la pantalla de cierre de secretaría.
 *
 * Primero lo que ya se puede dar por completado (los tres reportes están hechos),
 * porque es un solo clic y saca la orden de la lista; después las que todavía
 * tienen reportes por hacer, empezando por las que están más cerca de terminar y,
 * a igual avance, por urgencia.
 */
export type OrdenesDeCierre<T> = {
  listas: T[];
  faltanReportes: T[];
};

type ParaCierre = {
  fechaEntrega: string;
  numeroOrdenCompra: string;
  marcados: readonly CheckpointId[];
};

export function agruparOrdenesDeCierre<T extends ParaCierre>(
  ordenes: readonly T[],
  ahora = new Date(),
): OrdenesDeCierre<T> {
  const porUrgencia = compararPorUrgencia(ahora);
  const faltan = (orden: T) => reportesPendientes(orden.marcados).length;

  return {
    listas: ordenes.filter((orden) => faltan(orden) === 0).sort(porUrgencia),
    faltanReportes: ordenes
      .filter((orden) => faltan(orden) > 0)
      .sort(
        (uno, otro) => faltan(uno) - faltan(otro) || porUrgencia(uno, otro),
      ),
  };
}
