import type { EntradaFormularioOrden } from "@/features/ordenes/formulario";
import {
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import { esTallaje, TALLAJE_OTRO, TALLAJES } from "@/lib/ordenes/tallas";

/**
 * Editar una orden: hasta cotización aprobada inclusive y solo administración
 * (`docs/adr/0012`).
 *
 * Reglas puras: deciden qué se muestra y dan el mensaje en lenguaje del taller.
 * La barrera real es `editar_orden` en la base, que repite la regla por si
 * alguien invoca la action o la API directamente.
 *
 * Los `marcados` son siempre los avances VIGENTES de la orden: si una devolución
 * anuló el paso a diseño (HU-18), la orden vuelve a ser editable.
 */

/** Desde esta etapa, inclusive, la orden ya no se edita. */
export const PRIMERA_ETAPA_NO_EDITABLE: CheckpointId = "programada_diseno";

const POSICION = new Map<CheckpointId, number>(
  CHECKPOINTS.map((checkpoint, posicion) => [checkpoint.id, posicion]),
);

function yaPasoADiseno(checkpoint: CheckpointId): boolean {
  const limite = POSICION.get(PRIMERA_ETAPA_NO_EDITABLE) ?? 0;
  return (POSICION.get(checkpoint) ?? 0) >= limite;
}

export type VeredictoEdicion =
  { permitido: true } | { permitido: false; mensaje: string };

export function puedeEditarOrden({
  marcados,
  etapaInicial,
  rol,
}: {
  marcados: readonly CheckpointId[];
  /** HU-18: por dónde entró una orden de corrección; null en las demás. */
  etapaInicial: CheckpointId | null;
  rol: Rol;
}): VeredictoEdicion {
  if (rol !== "admin") {
    return {
      permitido: false,
      mensaje: `Editar una orden lo hace ${ETIQUETAS_ROL.admin}.`,
    };
  }

  if (marcados.includes("cerrada")) {
    return {
      permitido: false,
      mensaje:
        "Esta orden ya está cerrada y no se puede editar. Si hay un defecto, crea una orden de corrección.",
    };
  }

  if (marcados.some(yaPasoADiseno)) {
    return {
      permitido: false,
      mensaje:
        "Esta orden ya pasó a diseño y no se puede editar. Si hay que corregirla, primero devuélvela a «Programada a diseño».",
    };
  }

  // La etapa de entrada no es un avance: la corrección pudo no tener ninguno.
  // Si entra justo por la programación a diseño, todavía no ha pasado.
  if (
    etapaInicial &&
    etapaInicial !== PRIMERA_ETAPA_NO_EDITABLE &&
    yaPasoADiseno(etapaInicial)
  ) {
    return {
      permitido: false,
      mensaje:
        "Esta orden de corrección entra al proceso después de diseño y no se puede editar.",
    };
  }

  return { permitido: true };
}

/**
 * Las cantidades por talla a partir del texto guardado (`XS:10, S:20`), para
 * volver a llenar la cuadrícula. `null` si el texto no se puede leer con ese
 * tallaje: se escribió a mano o con tallas que no son de ahí.
 */
export function leerCantidadesPorTalla(
  tallaje: string,
  tallas: string,
): Record<string, string> | null {
  if (!esTallaje(tallaje)) return null;

  const permitidas: readonly string[] = TALLAJES[tallaje].tallas;
  const cantidades: Record<string, string> = {};

  for (const parte of tallas.split(",")) {
    const coincidencia = /^\s*([^:\s]+)\s*:\s*(\d+)\s*$/.exec(parte);
    if (!coincidencia || !permitidas.includes(coincidencia[1])) return null;
    cantidades[coincidencia[1]] = coincidencia[2];
  }

  return cantidades;
}

/** Una prenda tal como sale de la base. */
export type PrendaGuardada = {
  id: string;
  descripcion: string;
  cantidad: number;
  tallas: string;
  tallaje: string | null;
  valor: number;
  observaciones: string | null;
};

/** La orden tal como sale de la base. */
export type OrdenGuardada = {
  numeroOrdenCompra: string;
  fechaIngreso: string;
  fechaEntrega: string;
  observaciones: string | null;
  nit: string;
  razonSocial: string;
  contactoNombre: string;
  contactoCelular: string;
  prendas: readonly PrendaGuardada[];
};

/**
 * Lo guardado, como lo espera el formulario. Las prendas anteriores al tallaje,
 * o con tallas que no cuadran con su tallaje, se muestran como «otro»: con las
 * tallas escritas tal como están.
 */
export function entradaDesdeOrden(
  orden: OrdenGuardada,
): EntradaFormularioOrden {
  return {
    numeroOrdenCompra: orden.numeroOrdenCompra,
    nit: orden.nit,
    razonSocial: orden.razonSocial,
    contactoNombre: orden.contactoNombre,
    contactoCelular: orden.contactoCelular,
    fechaIngreso: orden.fechaIngreso,
    fechaEntrega: orden.fechaEntrega,
    observaciones: orden.observaciones ?? "",
    items: orden.prendas.map((prenda) => {
      const cantidadesPorTalla = prenda.tallaje
        ? leerCantidadesPorTalla(prenda.tallaje, prenda.tallas)
        : null;

      return {
        itemId: prenda.id,
        descripcion: prenda.descripcion,
        cantidad: String(prenda.cantidad),
        tallas: prenda.tallas,
        valor: String(prenda.valor),
        observaciones: prenda.observaciones ?? "",
        tallaje: cantidadesPorTalla ? (prenda.tallaje ?? "") : TALLAJE_OTRO,
        cantidadesPorTalla: cantidadesPorTalla ?? undefined,
      };
    }),
  };
}
