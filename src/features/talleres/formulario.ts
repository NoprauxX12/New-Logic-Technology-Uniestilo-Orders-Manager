/**
 * HU-10 · Traducción entre el formulario HTML y el esquema de validación.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y estas son puras.
 */

/** Lo que la persona escribió o escogió, en crudo. */
export type EntradaDespacho = {
  taller: string;
  descripcionPrendas: string;
  enviadoPor: string;
};

/** Formulario en blanco: al abrir la pantalla y después de despachar. */
export const ENTRADA_VACIA: EntradaDespacho = {
  taller: "",
  descripcionPrendas: "",
  enviadoPor: "",
};

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Lo escrito en el formulario. La action lo devuelve junto con los errores para
 * volver a pintarlo: React 19 limpia los campos al terminar una action, y sin
 * esto un error de validación borraría lo que se acababa de escribir.
 */
export function leerFormularioDespacho(formData: FormData): EntradaDespacho {
  return {
    taller: texto(formData.get("taller")),
    descripcionPrendas: texto(formData.get("descripcionPrendas")),
    enviadoPor: texto(formData.get("enviadoPor")),
  };
}

/** La orden a la que pertenece el despacho, que viaja en un campo oculto. */
export function leerOrdenId(formData: FormData): string {
  return texto(formData.get("ordenId"));
}
