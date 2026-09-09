import {
  buscarCheckpoint,
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";

/**
 * Reglas del motor de workflow (regla 2 de CLAUDE.md).
 *
 * Ninguna action inserta en `avance_seccion` por su cuenta: primero pregunta
 * aquí. El motor verifica tres cosas —que el checkpoint no esté ya marcado, que
 * sea el siguiente de la secuencia, y que el rol de quien marca sea el dueño de
 * esa sección—.
 *
 * Son funciones puras, sin base de datos ni `server-only`: reciben lo que la
 * orden ya tiene marcado y devuelven un veredicto. Así se pueden probar sin
 * levantar nada, que es donde vive el riesgo del dominio.
 *
 * La base respalda una de las tres por su cuenta: el índice único sobre
 * `(orden_id, checkpoint)` impide el duplicado aunque esta validación falle.
 */

export type MotivoRechazo =
  "ya_marcado" | "fuera_de_secuencia" | "rol_no_autorizado";

export type ResultadoMarcado =
  | { permitido: true }
  | { permitido: false; motivo: MotivoRechazo; mensaje: string };

/**
 * El checkpoint que sigue en la secuencia: el primero que todavía no se ha
 * marcado. Devuelve `null` cuando la orden ya recorrió todo el flujo.
 */
export function siguienteCheckpoint(
  marcados: readonly CheckpointId[],
): CheckpointId | null {
  const yaEsta = new Set(marcados);
  return (
    CHECKPOINTS.find((checkpoint) => !yaEsta.has(checkpoint.id))?.id ?? null
  );
}

/** Cuántos checkpoints lleva la orden, para la barra de avance del tablero. */
export function checkpointsCompletados(
  marcados: readonly CheckpointId[],
): number {
  const yaEsta = new Set(marcados);
  return CHECKPOINTS.filter((checkpoint) => yaEsta.has(checkpoint.id)).length;
}

type Peticion = {
  /** El checkpoint que se quiere marcar. */
  checkpoint: CheckpointId;
  /** Lo que la orden ya tiene marcado, en cualquier orden. */
  marcados: readonly CheckpointId[];
  /** El rol de quien está marcando. */
  rol: Rol;
};

/**
 * ¿Se puede marcar este checkpoint?
 *
 * El orden de las verificaciones importa para el mensaje: si ya está marcado,
 * eso es lo que hay que decir, aunque además la persona no tuviera el rol.
 */
export function puedeMarcar({
  checkpoint,
  marcados,
  rol,
}: Peticion): ResultadoMarcado {
  const { etiqueta, rolDueno } = buscarCheckpoint(checkpoint);

  if (marcados.includes(checkpoint)) {
    return {
      permitido: false,
      motivo: "ya_marcado",
      mensaje: `"${etiqueta}" ya está marcado en esta orden.`,
    };
  }

  const siguiente = siguienteCheckpoint(marcados);
  if (siguiente !== checkpoint) {
    const falta = siguiente ? buscarCheckpoint(siguiente).etiqueta : null;
    return {
      permitido: false,
      motivo: "fuera_de_secuencia",
      mensaje: falta
        ? `Antes hay que marcar "${falta}".`
        : `Esta orden ya terminó su recorrido.`,
    };
  }

  if (rol !== rolDueno) {
    return {
      permitido: false,
      motivo: "rol_no_autorizado",
      mensaje: `"${etiqueta}" lo marca ${ETIQUETAS_ROL[rolDueno]}.`,
    };
  }

  return { permitido: true };
}
