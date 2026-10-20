import {
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";

/**
 * HU-06 · Reglas para avisar que falta tela.
 *
 * Una alerta no es un checkpoint —es entidad propia con destinatario y estado
 * (regla 7)—, así que esto no lo decide el motor de workflow. Vive aquí, puro y
 * sin base de datos, para probarlo sin levantar nada. La base repite lo
 * importante: RLS exige el rol y el destinatario, y un índice único impide dos
 * alertas de tela abiertas en la misma orden.
 */

/** El único rol que valida telas y avisa cuando falta (HU-06). */
export const ROL_QUE_AVISA_TELA: Rol = "secretaria";

/**
 * Con el corte hecho, la tela ya se usó: avisar que falta no tiene sentido. La
 * validación de telas va antes del corte (Reunión 2 con Néstor).
 */
const CHECKPOINT_QUE_CIERRA_EL_AVISO: CheckpointId = "corte_completado";

export type ResultadoAlerta =
  { permitido: true } | { permitido: false; mensaje: string };

type Situacion = {
  /** Lo que la orden ya tiene marcado. */
  marcados: readonly CheckpointId[];
  /** Si ya hay una alerta de tela cuya tela no ha llegado (HU-22). */
  tieneAlertaAbierta: boolean;
  /** El rol de quien quiere avisar. Sale de la sesión, nunca del formulario. */
  rol: Rol;
};

/**
 * ¿Puede esta persona avisar que falta tela en esta orden?
 *
 * El orden de las comprobaciones decide el mensaje: primero quién, después en
 * qué punto va la orden, y al final si ya se avisó.
 */
export function puedeAvisarFaltaDeTela({
  marcados,
  tieneAlertaAbierta,
  rol,
}: Situacion): ResultadoAlerta {
  if (rol !== ROL_QUE_AVISA_TELA) {
    return {
      permitido: false,
      mensaje: `La falta de tela la avisa ${ETIQUETAS_ROL[ROL_QUE_AVISA_TELA]}.`,
    };
  }

  if (marcados.includes("cerrada")) {
    return {
      permitido: false,
      mensaje: "La orden ya está completada.",
    };
  }

  if (marcados.includes(CHECKPOINT_QUE_CIERRA_EL_AVISO)) {
    return {
      permitido: false,
      mensaje: "Esta orden ya pasó por corte: la tela ya está en la empresa.",
    };
  }

  if (tieneAlertaAbierta) {
    return {
      permitido: false,
      mensaje:
        "Ya se avisó que falta tela en esta orden. Cuando llegue, márcalo aquí.",
    };
  }

  return { permitido: true };
}

/**
 * HU-22 · ¿Puede esta persona marcar que llegó la tela de esta orden?
 *
 * Lo marca secretaría, que es quien recibe la tela y quien avisó que faltaba.
 * Solo tiene sentido si hay una alerta de tela sin llegada: sin aviso previo
 * no hay nada que liberar.
 */
export function puedeMarcarLlegadaDeTela({
  esperandoTela,
  rol,
}: {
  esperandoTela: boolean;
  rol: Rol;
}): ResultadoAlerta {
  if (rol !== ROL_QUE_AVISA_TELA) {
    return {
      permitido: false,
      mensaje: `La llegada de la tela la marca ${ETIQUETAS_ROL[ROL_QUE_AVISA_TELA]}.`,
    };
  }

  if (!esperandoTela) {
    return {
      permitido: false,
      mensaje: "Esta orden no está esperando tela.",
    };
  }

  return { permitido: true };
}

/**
 * HU-07 · ¿Puede esta persona marcar la alerta de tela como resuelta?
 *
 * La resuelve administración en el tablero. Atenderla no es lo mismo que
 * recibir la tela (HU-22): la fila se queda, solo deja de estar pendiente.
 */
export function puedeAtenderAlerta({ rol }: { rol: Rol }): ResultadoAlerta {
  if (rol !== "admin") {
    return {
      permitido: false,
      mensaje: "Las alertas de tela las resuelve Administración.",
    };
  }

  return { permitido: true };
}

/** Lo que hace falta saber de una persona de administración para avisarle. */
export type Administrador = {
  id: string;
  /** Cuándo se creó la cuenta, en ISO. */
  creadoEn: string;
};

/**
 * A quién le llega la alerta de tela: a administración, que es quien hace el
 * pedido (en Uniestilo, Néstor).
 *
 * `alerta.destinatario_id` es una persona y no un rol, para que la alerta
 * conserve su dueño aunque cambien los roles. Si hay más de una cuenta de
 * administración, se escoge la más antigua: la del dueño, que fue la primera.
 * Es determinista, así que dos avisos de la misma orden van a la misma
 * persona. `null` si no hay ninguna activa.
 */
export function destinatarioDeAlertaTela(
  administradores: readonly Administrador[],
): string | null {
  if (administradores.length === 0) return null;

  const [primero] = [...administradores].sort((uno, otro) =>
    uno.creadoEn.localeCompare(otro.creadoEn),
  );

  return primero.id;
}
