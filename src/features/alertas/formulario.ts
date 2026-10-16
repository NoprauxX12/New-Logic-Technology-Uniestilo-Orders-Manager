/**
 * HU-06 · Traducción entre el formulario HTML y el esquema de validación.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y estas son puras.
 */

/** Lo que la persona escribió, en crudo. */
export type EntradaAvisoTela = {
  detalle: string;
};

/** Formulario en blanco: al abrir la pantalla y después de avisar. */
export const ENTRADA_AVISO_VACIA: EntradaAvisoTela = { detalle: "" };

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Lo escrito en el formulario. La action lo devuelve junto con los errores para
 * volver a pintarlo: React 19 limpia los campos al terminar una action.
 */
export function leerFormularioAviso(formData: FormData): EntradaAvisoTela {
  return { detalle: texto(formData.get("detalle")) };
}

/** La orden del aviso, que viaja en un campo oculto. */
export function leerOrdenId(formData: FormData): string {
  return texto(formData.get("ordenId"));
}
