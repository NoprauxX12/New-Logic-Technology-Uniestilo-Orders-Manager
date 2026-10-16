import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import {
  puedeMarcar,
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
 * no sabe, que es si la lista que se armó tiene sentido.
 */

/** La etapa que esta historia marca. */
export const CHECKPOINT_PROGRAMACION: CheckpointId = "programada_diseno";

/** El rol dueño de la programación, según `checkpoints.ts`. */
export const ROL_DE_PROGRAMACION: Rol = "secretaria";

/** Una orden agregada a la hoja, con el número que secretaría le escribió. */
export type OrdenProgramada = {
  ordenId: string;
  numeroOrdenProgramacion: string;
};

export type ResultadoLista =
  { valida: true } | { valida: false; mensaje: string };

/**
 * El número de programación comparado sin distinguir mayúsculas ni espacios de
 * más, igual que el índice único de la base. "pr-104" y " PR-104 " son el mismo.
 */
export function numeroNormalizado(valor: string): string {
  return valor.trim().toUpperCase();
}

/**
 * ¿Se puede programar esta orden?
 *
 * Es el motor quien responde; esto solo evita que cada pantalla y cada action
 * repitan el nombre del checkpoint.
 */
export function puedeProgramar(
  marcados: readonly CheckpointId[],
  rol: Rol,
): ResultadoMarcado {
  return puedeMarcar({ checkpoint: CHECKPOINT_PROGRAMACION, marcados, rol });
}

/**
 * ¿Tiene sentido la lista que se armó?
 *
 * No hay un tope de órdenes: la secretaria agrega las que haga falta, tres u
 * ocho, y en rondas distintas. Lo que sí se verifica es que no haya una orden
 * dos veces, que ninguna quede sin número y que dos órdenes no lleven el mismo.
 *
 * El orden del arreglo ES el orden de trabajo, así que no se reordena nada aquí.
 */
export function validarLista(
  seleccion: readonly OrdenProgramada[],
): ResultadoLista {
  if (seleccion.length === 0) {
    return {
      valida: false,
      mensaje: "Agrega al menos una orden a la programación.",
    };
  }

  const ordenesVistas = new Set<string>();
  const numerosVistos = new Set<string>();

  for (const fila of seleccion) {
    if (ordenesVistas.has(fila.ordenId)) {
      return {
        valida: false,
        mensaje: "Una de las órdenes está dos veces en la lista.",
      };
    }
    ordenesVistas.add(fila.ordenId);

    const numero = numeroNormalizado(fila.numeroOrdenProgramacion);

    if (numero === "") {
      return {
        valida: false,
        mensaje: "Falta el número de programación de una de las órdenes.",
      };
    }

    if (numerosVistos.has(numero)) {
      return {
        valida: false,
        mensaje: `El número de programación ${numero} está repetido en la lista.`,
      };
    }
    numerosVistos.add(numero);
  }

  return { valida: true };
}

/** Cuántas prendas suma una orden, para mostrarla antes de agregarla. */
export function totalDePrendas(
  referencias: readonly { cantidad: number }[],
): number {
  return referencias.reduce(
    (total, referencia) => total + referencia.cantidad,
    0,
  );
}
