import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import {
  puedeMarcar,
  type EtapaInicial,
  type ResultadoMarcado,
} from "@/features/workflow/transiciones";

/**
 * Reglas de la programación a diseño (HU-03).
 *
 * Son puras, sin base de datos ni `server-only`: reciben lo que la orden ya
 * tiene marcado o lo que la secretaria armó en pantalla, y devuelven un
 * veredicto. Aquí vive el riesgo del dominio, así que aquí van los tests.
 *
 * Quién puede marcar la etapa y en qué momento de la secuencia no se decide
 * aquí: eso es del motor de workflow (regla 2). Esto solo añade lo que el motor
 * no sabe, que es si la hoja que se armó tiene sentido.
 */

/** La etapa que esta historia marca. */
export const CHECKPOINT_PROGRAMACION: CheckpointId = "programada_diseno";

/** El rol dueño de la programación, según `checkpoints.ts`. */
export const ROL_DE_PROGRAMACION: Rol = "secretaria";

/**
 * Cuántas órdenes caben en una hoja de programación.
 *
 * La hoja de papel del taller llega a nueve (PROGRAMACION #24), así que esto no
 * es el tamaño de una tanda: es una barrera contra un error de dedo, para que
 * nadie mande cincuenta órdenes de un clic. La historia habla de cinco o seis
 * porque es lo que suele caber, no porque sea un límite.
 *
 * Si la PO pide otro número, se cambia aquí y en ningún otro lado: la pantalla,
 * la validación y los mensajes salen de esta constante.
 */
export const MAXIMO_POR_HOJA = 20;

export type ResultadoHoja =
  { valida: true } | { valida: false; mensaje: string };

/**
 * ¿Se puede programar esta orden?
 *
 * Es el motor quien responde; esto solo evita que cada pantalla y cada action
 * repitan el nombre del checkpoint.
 */
export function puedeProgramar(
  marcados: readonly CheckpointId[],
  rol: Rol,
  etapaInicial?: EtapaInicial,
): ResultadoMarcado {
  return puedeMarcar({
    checkpoint: CHECKPOINT_PROGRAMACION,
    marcados,
    rol,
    etapaInicial,
  });
}

/**
 * ¿Tiene sentido la hoja que se armó?
 *
 * El orden del arreglo ES el orden de trabajo, así que no se reordena nada
 * aquí: solo se verifica que haya al menos una orden, que ninguna esté dos
 * veces y que no se pase del tope.
 */
export function validarHoja(ordenes: readonly string[]): ResultadoHoja {
  if (ordenes.length === 0) {
    return {
      valida: false,
      mensaje: "Agrega al menos una orden a la programación.",
    };
  }

  if (ordenes.length > MAXIMO_POR_HOJA) {
    return {
      valida: false,
      mensaje: `En una programación caben hasta ${MAXIMO_POR_HOJA} órdenes. Deja el resto para la siguiente.`,
    };
  }

  if (new Set(ordenes).size !== ordenes.length) {
    return {
      valida: false,
      mensaje: "Una de las órdenes está dos veces en la programación.",
    };
  }

  return { valida: true };
}

/**
 * La lista con la orden de `posicion` movida un puesto arriba o abajo.
 *
 * Es lo que hacen las flechas de la pantalla: la secretaria no escribe turnos
 * ni arrastra nada, toca una flecha y la orden cambia de puesto con su vecina.
 * Si el movimiento se sale de la lista, devuelve la misma lista sin tocar, para
 * que el componente no tenga que preguntar si el botón iba deshabilitado.
 */
export function moverEnLista(
  ordenes: readonly string[],
  posicion: number,
  direccion: "arriba" | "abajo",
): string[] {
  const destino = direccion === "arriba" ? posicion - 1 : posicion + 1;

  if (posicion < 0 || posicion >= ordenes.length) return [...ordenes];
  if (destino < 0 || destino >= ordenes.length) return [...ordenes];

  const movida = [...ordenes];
  [movida[posicion], movida[destino]] = [movida[destino], movida[posicion]];

  return movida;
}

/** Cuántas prendas suma un conjunto de referencias. */
export function totalDePrendas(
  referencias: readonly { cantidad: number }[],
): number {
  return referencias.reduce(
    (total, referencia) => total + referencia.cantidad,
    0,
  );
}
