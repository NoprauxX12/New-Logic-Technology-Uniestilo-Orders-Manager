/**
 * Traducción entre el formulario de insumos y lo que la action valida.
 *
 * Vive fuera de `actions.ts` porque un archivo `"use server"` solo puede
 * exportar funciones asíncronas, y esta es pura.
 *
 * La pantalla manda una casilla `insumo` por cada insumo marcado y, al lado,
 * su `detalle.<insumo>`. Solo cuentan los marcados: el detalle de una casilla
 * desmarcada se ignora aunque tenga texto.
 */

export type EntradaInsumos = {
  ordenId: string;
  insumos: { insumo: string; detalle: string }[];
};

export function leerFormularioInsumos(formData: FormData): EntradaInsumos {
  return {
    ordenId: String(formData.get("ordenId") ?? ""),
    insumos: formData.getAll("insumo").map((valor) => {
      const insumo = String(valor);
      return {
        insumo,
        detalle: String(formData.get(`detalle.${insumo}`) ?? ""),
      };
    }),
  };
}
