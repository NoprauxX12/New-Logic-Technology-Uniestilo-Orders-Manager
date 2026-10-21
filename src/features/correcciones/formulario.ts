import type { ZodError } from "zod";

/**
 * HU-18 · Traducción entre los formularios HTML y los esquemas de validación.
 *
 * Funciones puras fuera de `actions.ts` (un archivo `"use server"` solo exporta
 * funciones asíncronas), para probarlas sin levantar nada.
 */

function texto(valor: FormDataEntryValue | null | undefined): string {
  return typeof valor === "string" ? valor : "";
}

// ---------------------------------------------------------------------------
// Devolver la orden a una etapa
// ---------------------------------------------------------------------------

export type EntradaFormularioDevolucion = {
  ordenId: string;
  checkpoint: string;
  motivo: string;
};

export function leerFormularioDevolucion(
  formData: FormData,
): EntradaFormularioDevolucion {
  return {
    ordenId: texto(formData.get("ordenId")),
    checkpoint: texto(formData.get("checkpoint")),
    motivo: texto(formData.get("motivo")),
  };
}

// ---------------------------------------------------------------------------
// Orden de corrección
// ---------------------------------------------------------------------------

/** Una prenda tal como la escribió la persona, sin convertir ni validar. */
export type EntradaPrendaDefectuosa = {
  itemId: string;
  cantidad: string;
  tallas: string;
};

export type EntradaFormularioCorreccion = {
  ordenOriginalId: string;
  fechaEntrega: string;
  motivo: string;
  etapaInicial: string;
  /** Solo las prendas que la persona marcó como defectuosas. */
  items: EntradaPrendaDefectuosa[];
};

/**
 * Cada prenda de la orden original tiene una casilla `incluir` (con su id como
 * valor) y dos campos con el id en el nombre: `cantidad.<id>` y `tallas.<id>`.
 * Solo las casillas marcadas entran en la corrección.
 */
export function leerFormularioCorreccion(
  formData: FormData,
): EntradaFormularioCorreccion {
  const incluidas = formData
    .getAll("incluir")
    .filter((valor): valor is string => typeof valor === "string");

  return {
    ordenOriginalId: texto(formData.get("ordenOriginalId")),
    fechaEntrega: texto(formData.get("fechaEntrega")),
    motivo: texto(formData.get("motivo")),
    etapaInicial: texto(formData.get("etapaInicial")),
    items: incluidas.map((itemId) => ({
      itemId,
      cantidad: texto(formData.get(`cantidad.${itemId}`)),
      tallas: texto(formData.get(`tallas.${itemId}`)),
    })),
  };
}

/**
 * Los errores de zod por campo. Los de una prenda salen con su id en la clave
 * (`cantidad.<id>`, `tallas.<id>`), porque la pantalla pinta las prendas por
 * id y no por posición.
 */
export function agruparErroresCorreccion(
  error: ZodError,
  escrito: EntradaFormularioCorreccion,
): Record<string, string[]> {
  const errores: Record<string, string[]> = {};

  for (const problema of error.issues) {
    const [primero, posicion, campo] = problema.path;
    let clave: string;

    if (primero === "items" && typeof posicion === "number") {
      const itemId = escrito.items[posicion]?.itemId;
      clave =
        itemId && typeof campo === "string" ? `${campo}.${itemId}` : "items";
    } else {
      clave = problema.path.join(".") || "formulario";
    }

    errores[clave] = [...(errores[clave] ?? []), problema.message];
  }

  return errores;
}

/** Los errores de zod de un formulario plano, con el nombre del campo como clave. */
export function agruparErroresPlanos(
  error: ZodError,
): Record<string, string[]> {
  const errores: Record<string, string[]> = {};

  for (const problema of error.issues) {
    const clave = problema.path.join(".") || "formulario";
    errores[clave] = [...(errores[clave] ?? []), problema.message];
  }

  return errores;
}
