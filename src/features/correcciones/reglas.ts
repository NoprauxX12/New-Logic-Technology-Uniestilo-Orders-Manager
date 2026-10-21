import {
  buscarCheckpoint,
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";

/**
 * HU-18 · Reglas puras de las dos salidas ante un defecto: devolver la orden a
 * una etapa mientras va en producción, y crear una orden de corrección cuando
 * ya está cerrada.
 *
 * Sin base de datos ni `server-only`: reciben lo que la orden tiene vigente y
 * devuelven un veredicto, igual que el motor de workflow. La base repite las
 * reglas más importantes (`devolver_orden_a_etapa`, `crear_orden_de_correccion`)
 * por si alguien invoca la action con un POST directo.
 *
 * Los `marcados` son siempre los avances VIGENTES de la orden.
 */

/** Largo máximo del motivo; el mismo `check` de la base. */
export const MOTIVO_MAXIMO = 500;

/** Largo máximo de las tallas escritas a mano; igual que en la base. */
export const TALLAS_MAXIMO = 300;

/** Por defecto una corrección entra por el corte: el defecto suele ser de confección. */
export const ETAPA_DE_ENTRADA_POR_DEFECTO: CheckpointId = "corte_completado";

const POSICION = new Map<CheckpointId, number>(
  CHECKPOINTS.map((checkpoint, posicion) => [checkpoint.id, posicion]),
);

function posicion(checkpoint: CheckpointId): number {
  return POSICION.get(checkpoint) ?? -1;
}

export type Veredicto =
  { permitido: true } | { permitido: false; mensaje: string };

// ---------------------------------------------------------------------------
// Devolver la orden a una etapa
// ---------------------------------------------------------------------------

/** Las etapas vigentes de la orden, en el orden del flujo. */
function vigentesEnOrden(marcados: readonly CheckpointId[]): CheckpointId[] {
  return CHECKPOINTS.map((checkpoint) => checkpoint.id).filter((id) =>
    marcados.includes(id),
  );
}

/**
 * A qué etapas se puede devolver la orden: las que tiene vigentes. Ninguna si
 * ya está cerrada (para eso es la orden de corrección).
 */
export function etapasParaDevolver(
  marcados: readonly CheckpointId[],
): CheckpointId[] {
  if (marcados.includes("cerrada")) return [];
  return vigentesEnOrden(marcados);
}

/**
 * Qué avances quedan anulados al devolver a `destino`: esa etapa y todas las
 * vigentes que la siguen en el flujo. Lo que viene antes no se toca.
 */
export function etapasQueSeAnulan(
  marcados: readonly CheckpointId[],
  destino: CheckpointId,
): CheckpointId[] {
  return vigentesEnOrden(marcados).filter(
    (id) => posicion(id) >= posicion(destino),
  );
}

/** Lo que queda vigente después de devolver a `destino`. */
export function etapasQueQuedanVigentes(
  marcados: readonly CheckpointId[],
  destino: CheckpointId,
): CheckpointId[] {
  return vigentesEnOrden(marcados).filter(
    (id) => posicion(id) < posicion(destino),
  );
}

/** ¿Quién puede devolver una orden? Solo administración. */
export function puedeDevolver({
  marcados,
  rol,
}: {
  marcados: readonly CheckpointId[];
  rol: Rol;
}): Veredicto {
  if (rol !== "admin") {
    return {
      permitido: false,
      mensaje: `Devolver una orden a una etapa lo hace ${ETIQUETAS_ROL.admin}.`,
    };
  }

  if (marcados.includes("cerrada")) {
    return {
      permitido: false,
      mensaje:
        "La orden ya está completada. Si hay un defecto, crea una orden de corrección.",
    };
  }

  if (etapasParaDevolver(marcados).length === 0) {
    return {
      permitido: false,
      mensaje:
        "La orden todavía no tiene ninguna etapa marcada a la que volver.",
    };
  }

  return { permitido: true };
}

/** El destino tiene que ser una etapa que la orden tiene vigente. */
export function validarDestino({
  marcados,
  destino,
}: {
  marcados: readonly CheckpointId[];
  destino: CheckpointId;
}): Veredicto {
  if (!etapasParaDevolver(marcados).includes(destino)) {
    return {
      permitido: false,
      mensaje: `"${buscarCheckpoint(destino).etiqueta}" no está marcada en esta orden, así que no se puede volver a ella.`,
    };
  }
  return { permitido: true };
}

// ---------------------------------------------------------------------------
// Orden de corrección
// ---------------------------------------------------------------------------

/** ¿Quién puede crear una orden de corrección? Administración, sobre una orden cerrada. */
export function puedeCrearCorreccion({
  marcados,
  rol,
}: {
  marcados: readonly CheckpointId[];
  rol: Rol;
}): Veredicto {
  if (rol !== "admin") {
    return {
      permitido: false,
      mensaje: `Las órdenes de corrección las crea ${ETIQUETAS_ROL.admin}.`,
    };
  }

  if (!marcados.includes("cerrada")) {
    return {
      permitido: false,
      mensaje:
        "La orden todavía no está cerrada. Si va en producción, devuélvela a la etapa que corresponda.",
    };
  }

  return { permitido: true };
}

/**
 * Por dónde puede entrar una corrección: las etapas desde las que puede llegar
 * al final sin avances previos. La lista es explícita, no derivada: una etapa
 * nueva del flujo no debe ofrecerse hasta que alguien verifique que la orden
 * puede completarla.
 *
 * Quedan fuera dos etapas que atascarían la orden, porque la corrección nace
 * sin avances:
 * - `tela_programada`: `programar_tela` exige la ficha técnica vigente.
 * - `llegada_marcacion`: exige un lote recibido, y despachar un lote exige el
 *   recogido y bordado vigente.
 * Y las de cierre (etiquetas, documentos, factura), que vienen después de
 * "lista para despachar". La base lo repite (`orden_etapa_inicial_valida`).
 */
export const ETAPAS_DE_ENTRADA = [
  "cotizacion_enviada",
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "corte_completado",
  "recogido_bordado",
  "lista_despacho",
] as const satisfies readonly CheckpointId[];

/** ¿Es una etapa por la que puede entrar una corrección? */
export function esEtapaDeEntrada(
  valor: string,
): valor is (typeof ETAPAS_DE_ENTRADA)[number] {
  return ETAPAS_DE_ENTRADA.some((etapa) => etapa === valor);
}

/**
 * El número de la orden de corrección: el de la orden corregida más `-C` y el
 * consecutivo de sus correcciones (`OC-5007-C1`, `OC-5007-C2`…). Si el candidato
 * ya existe, sin distinguir mayúsculas, se sigue con el siguiente: es lo mismo
 * que hace `crear_orden_de_correccion` en la base.
 *
 * @param yaCreadas cuántas correcciones tiene ya esa orden.
 * @param existentes los números de orden de compra que ya existen con ese prefijo.
 */
export function numeroDeCorreccion(
  numeroOriginal: string,
  yaCreadas: number,
  existentes: readonly string[],
): string {
  const ocupados = new Set(existentes.map((numero) => numero.toUpperCase()));
  let consecutivo = yaCreadas + 1;
  while (ocupados.has(`${numeroOriginal}-C${consecutivo}`.toUpperCase())) {
    consecutivo += 1;
  }
  return `${numeroOriginal}-C${consecutivo}`;
}

export type PrendaOriginal = {
  id: string;
  descripcion: string;
  cantidad: number;
};

export type PrendaDefectuosa = {
  itemId: string;
  cantidad: number;
  tallas: string;
};

export type ErroresDePrendas = Record<string, string>;

/**
 * Las prendas defectuosas contra las de la orden original: tienen que ser de
 * la orden, no repetirse, y la cantidad va de 1 hasta la que tenía la orden.
 * Devuelve los errores por `itemId` (vacío si todo está bien).
 */
export function validarPrendasDefectuosas(
  elegidas: readonly PrendaDefectuosa[],
  originales: readonly PrendaOriginal[],
): ErroresDePrendas {
  const errores: ErroresDePrendas = {};
  const vistas = new Set<string>();

  for (const prenda of elegidas) {
    const original = originales.find((o) => o.id === prenda.itemId);

    if (!original) {
      errores[prenda.itemId] = "Esa prenda no es de la orden original.";
      continue;
    }

    if (vistas.has(prenda.itemId)) {
      errores[prenda.itemId] = "Esa prenda está repetida.";
      continue;
    }
    vistas.add(prenda.itemId);

    if (!Number.isInteger(prenda.cantidad) || prenda.cantidad < 1) {
      errores[prenda.itemId] = "La cantidad debe ser de 1 en adelante.";
    } else if (prenda.cantidad > original.cantidad) {
      errores[prenda.itemId] =
        `La orden original tenía ${original.cantidad}: no puede ser más.`;
    }
  }

  return errores;
}
