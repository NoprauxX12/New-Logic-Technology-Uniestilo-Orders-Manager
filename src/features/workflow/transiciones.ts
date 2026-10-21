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
 * aquí. El motor verifica cuatro cosas —que el checkpoint no esté ya marcado,
 * que sea el siguiente de la secuencia, que el rol de quien marca sea el dueño
 * de esa sección, y que se cumpla el requisito extra que la etapa declare en
 * `checkpoints.ts`, si tiene uno—.
 *
 * Son funciones puras, sin base de datos ni `server-only`: reciben lo que la
 * orden ya tiene marcado y devuelven un veredicto. Así se pueden probar sin
 * levantar nada, que es donde vive el riesgo del dominio.
 *
 * La base respalda una de las tres por su cuenta: el índice único sobre
 * `(orden_id, checkpoint)` impide el duplicado aunque esta validación falle.
 */

export type MotivoRechazo =
  | "ya_marcado"
  | "todavia_no_disponible"
  | "fuera_de_secuencia"
  | "rol_no_autorizado"
  | "requisito_pendiente";

export type ResultadoMarcado =
  | { permitido: true }
  | { permitido: false; motivo: MotivoRechazo; mensaje: string };

/**
 * Qué lugar ocupa, en la secuencia, la etapa más avanzada que la orden ya
 * tiene marcada. `-1` si todavía no tiene ninguna.
 */
function posicionDelAvance(marcados: readonly CheckpointId[]): number {
  const yaEsta = new Set(marcados);
  return CHECKPOINTS.reduce(
    (ultima, checkpoint, posicion) =>
      yaEsta.has(checkpoint.id) ? posicion : ultima,
    -1,
  );
}

/**
 * Las etapas que esta orden se saltó sin que nadie hiciera nada mal: quedaron
 * atrás de su avance sin marcarse, porque cuando la orden pasó por ahí esa
 * etapa todavía no se podía marcar en el sistema. Es lo que le pasa a una orden
 * que ya iba en corte el día que se enciende la programación a diseño.
 *
 * No son pendientes: no se pueden marcar, no cuentan en el avance y el tablero
 * las muestra como "No aplicó".
 */
export function etapasQueNoAplicaron(
  marcados: readonly CheckpointId[],
): CheckpointId[] {
  const yaEsta = new Set(marcados);
  const ultima = posicionDelAvance(marcados);

  return CHECKPOINTS.filter(
    (checkpoint, posicion) => posicion < ultima && !yaEsta.has(checkpoint.id),
  ).map((checkpoint) => checkpoint.id);
}

/**
 * El checkpoint que sigue: el primero que todavía no se ha marcado, contando
 * solo las etapas que ya tienen pantalla y que están por delante del avance de
 * la orden. Devuelve `null` cuando la orden ya recorrió todo lo que hoy se
 * puede marcar.
 *
 * Se saltan las que no están disponibles a propósito: sus historias son de
 * otros sprints, y exigirlas dejaría trancada cualquier orden nueva. Por la
 * misma razón se ignoran las que quedaron atrás del avance de la orden: una
 * etapa que se enciende con la orden ya en curso no la puede trancar, y como
 * solo se marca la siguiente, tampoco se puede marcar después de haberla
 * pasado. Una orden nueva sí las recorre todas.
 */
export function siguienteCheckpoint(
  marcados: readonly CheckpointId[],
): CheckpointId | null {
  const yaEsta = new Set(marcados);
  const ultima = posicionDelAvance(marcados);

  return (
    CHECKPOINTS.find(
      (checkpoint, posicion) =>
        posicion > ultima &&
        checkpoint.disponible &&
        !yaEsta.has(checkpoint.id),
    )?.id ?? null
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
  /**
   * Si logística ya confirmó la recepción de algún lote (HU-11). Solo lo mira
   * la etapa que declara el requisito `recepcion_de_taller`; si no se informa,
   * se asume que no.
   */
  recepcionConfirmada?: boolean;
  /**
   * Si la orden tiene una alerta de tela sin llegada (HU-06, HU-22). Solo lo
   * mira la etapa que declara el requisito `tela_en_empresa`; si no se
   * informa, se asume que no.
   */
  esperandoTela?: boolean;
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
  recepcionConfirmada = false,
  esperandoTela = false,
}: Peticion): ResultadoMarcado {
  const { etiqueta, rolDueno, disponible, requisito } =
    buscarCheckpoint(checkpoint);

  if (marcados.includes(checkpoint)) {
    return {
      permitido: false,
      motivo: "ya_marcado",
      mensaje: `"${etiqueta}" ya está marcado en esta orden.`,
    };
  }

  if (!disponible) {
    return {
      permitido: false,
      motivo: "todavia_no_disponible",
      mensaje: `"${etiqueta}" todavía no se puede marcar en el sistema.`,
    };
  }

  if (etapasQueNoAplicaron(marcados).includes(checkpoint)) {
    return {
      permitido: false,
      motivo: "fuera_de_secuencia",
      mensaje: `"${etiqueta}" ya no aplica en esta orden: va más adelante.`,
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

  if (requisito === "recepcion_de_taller" && !recepcionConfirmada) {
    return {
      permitido: false,
      motivo: "requisito_pendiente",
      mensaje: `${ETIQUETAS_ROL.logistica} debe confirmar primero la recepción de las prendas del taller.`,
    };
  }

  if (requisito === "tela_en_empresa" && esperandoTela) {
    return {
      permitido: false,
      motivo: "requisito_pendiente",
      mensaje: `La orden está esperando tela. ${ETIQUETAS_ROL.secretaria} tiene que marcar que llegó.`,
    };
  }

  return { permitido: true };
}
