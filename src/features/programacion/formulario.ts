/**
 * Traducción entre el formulario de programación y lo que la action valida.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y esta es pura.
 *
 * La pantalla manda un campo oculto por cada orden agregada. El navegador los
 * entrega en el orden en que están en el documento, que es el orden en que la
 * secretaria dejó la hoja después de mover las flechas, y ese es el orden de
 * trabajo. Por eso basta con leerlos en fila.
 */

export type EntradaProgramacion = {
  ordenes: string[];
};

export const ENTRADA_VACIA: EntradaProgramacion = { ordenes: [] };

export function leerFormularioProgramacion(
  formData: FormData,
): EntradaProgramacion {
  return { ordenes: formData.getAll("ordenId").map(String) };
}
