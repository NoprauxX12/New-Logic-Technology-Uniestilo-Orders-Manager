import type { ZodError } from "zod";

/**
 * Traducción entre el formulario de programación y lo que la action valida.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y estas son puras.
 *
 * La pantalla manda dos campos repetidos, uno por orden agregada: el `ordenId`
 * oculto y el número que se escribió. El navegador los entrega en el orden en
 * que están en el documento, que es el orden en que la secretaria las agregó, y
 * ese es el orden de trabajo. Por eso se emparejan por posición y no por nombre.
 */

export type FilaProgramacion = {
  ordenId: string;
  numeroOrdenProgramacion: string;
};

export type EntradaProgramacion = {
  programaciones: FilaProgramacion[];
};

export const ENTRADA_VACIA: EntradaProgramacion = { programaciones: [] };

export function leerFormularioProgramacion(
  formData: FormData,
): EntradaProgramacion {
  const ordenes = formData.getAll("ordenId").map(String);
  const numeros = formData.getAll("numeroOrdenProgramacion").map(String);

  return {
    programaciones: ordenes.map((ordenId, posicion) => ({
      ordenId,
      numeroOrdenProgramacion: numeros[posicion] ?? "",
    })),
  };
}

/**
 * Los errores de zod agrupados por orden, para pintar cada mensaje junto al
 * campo que lo causó. La clave es el `ordenId` y no la posición, porque la
 * pantalla renumera la lista cuando se quita una orden.
 *
 * Lo que no pertenezca a una orden concreta —la lista vacía, por ejemplo— queda
 * bajo la clave `lista`.
 */
export function erroresPorOrden(
  error: ZodError,
  entrada: EntradaProgramacion,
): Record<string, string[]> {
  const errores: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const [, posicion] = issue.path;
    const fila =
      typeof posicion === "number"
        ? entrada.programaciones[posicion]
        : undefined;
    const clave = fila ? fila.ordenId : "lista";

    errores[clave] = [...(errores[clave] ?? []), issue.message];
  }

  return errores;
}
