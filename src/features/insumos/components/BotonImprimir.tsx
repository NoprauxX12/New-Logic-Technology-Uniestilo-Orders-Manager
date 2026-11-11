"use client";

/** HU-23 · Abre el diálogo de impresión del navegador con el listado. */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800"
    >
      Imprimir listado
    </button>
  );
}
