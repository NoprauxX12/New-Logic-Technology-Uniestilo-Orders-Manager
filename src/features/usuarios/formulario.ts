/**
 * HU-24 · Traducción entre el formulario HTML y el esquema.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y estas son puras.
 */

/** Lo escrito, en crudo. La contraseña no se devuelve nunca a la pantalla. */
export type EntradaUsuario = {
  nombre: string;
  email: string;
  rol: string;
};

export const ENTRADA_VACIA: EntradaUsuario = {
  nombre: "",
  email: "",
  rol: "",
};

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

export function leerFormularioUsuario(formData: FormData): EntradaUsuario & {
  password: string;
} {
  return {
    nombre: texto(formData.get("nombre")),
    email: texto(formData.get("email")),
    rol: texto(formData.get("rol")),
    password: texto(formData.get("password")),
  };
}
