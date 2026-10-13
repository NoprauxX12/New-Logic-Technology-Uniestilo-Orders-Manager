import type { ZodError } from "zod";

/**
 * HU-01 · Traducción entre el formulario HTML y el esquema de validación.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y estas dos son puras: así se pueden probar
 * sin levantar servidor ni base de datos.
 */

/** Una prenda tal como la escribió la persona, sin convertir ni validar. */
export type EntradaPrenda = {
  descripcion: string;
  cantidad: string;
  tallas: string;
  valor: string;
  observaciones: string;
};

/**
 * Lo que el formulario mandó, en crudo. La action lo devuelve junto con los
 * errores para que la pantalla pueda volver a pintar lo escrito: React 19
 * limpia los campos al terminar una action, y sin esto un error borraría todo.
 */
export type EntradaFormularioOrden = {
  numeroOrdenCompra: string;
  nit: string;
  razonSocial: string;
  contactoNombre: string;
  contactoCelular: string;
  fechaIngreso: string;
  fechaEntrega: string;
  observaciones: string;
  items: EntradaPrenda[];
};

/** Formulario en blanco: al abrir la pantalla y después de guardar. */
export const ENTRADA_VACIA: EntradaFormularioOrden = {
  numeroOrdenCompra: "",
  nit: "",
  razonSocial: "",
  contactoNombre: "",
  contactoCelular: "",
  fechaIngreso: "",
  fechaEntrega: "",
  observaciones: "",
  items: [],
};

function texto(valor: FormDataEntryValue | null | undefined): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Agrupa los errores de zod por campo.
 *
 * La clave es la ruta del campo tal como la nombra el formulario: `razonSocial`
 * para los de la orden, `items.1.cantidad` para los de la segunda prenda.
 */
export function agruparErrores(error: ZodError): Record<string, string[]> {
  const errores: Record<string, string[]> = {};

  for (const problema of error.issues) {
    const campo = problema.path.join(".") || "formulario";
    errores[campo] = [...(errores[campo] ?? []), problema.message];
  }

  return errores;
}

/**
 * Arma el objeto que espera `nuevaOrdenSchema`.
 *
 * Las prendas llegan como campos repetidos: el formulario manda un
 * `descripcion`, un `cantidad`, etc. por cada fila, y aquí se vuelven a juntar
 * respetando el orden en que el navegador los envió.
 */
export function leerFormularioOrden(
  formData: FormData,
): EntradaFormularioOrden {
  const descripciones = formData.getAll("descripcion");
  const cantidades = formData.getAll("cantidad");
  const tallas = formData.getAll("tallas");
  const valores = formData.getAll("valor");
  const observacionesItem = formData.getAll("observacionesItem");

  return {
    numeroOrdenCompra: texto(formData.get("numeroOrdenCompra")),
    nit: texto(formData.get("nit")),
    razonSocial: texto(formData.get("razonSocial")),
    contactoNombre: texto(formData.get("contactoNombre")),
    contactoCelular: texto(formData.get("contactoCelular")),
    fechaIngreso: texto(formData.get("fechaIngreso")),
    fechaEntrega: texto(formData.get("fechaEntrega")),
    observaciones: texto(formData.get("observaciones")),
    items: descripciones.map((_, indice) => ({
      descripcion: texto(descripciones[indice]),
      cantidad: texto(cantidades[indice]),
      tallas: texto(tallas[indice]),
      valor: texto(valores[indice]),
      observaciones: texto(observacionesItem[indice]),
    })),
  };
}
