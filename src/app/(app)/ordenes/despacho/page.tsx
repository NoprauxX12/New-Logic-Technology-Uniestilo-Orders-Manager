import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import { obtenerOrdenesParaSeccion } from "@/features/workflow/queries";

export const metadata: Metadata = {
  title: "Órdenes para despachar · Uniestilo",
};

/** HU-19 · Pantalla de salida a despacho. Solo enruta: lista y action genéricas. */
export default async function OrdenesDespachoPage() {
  const usuario = await exigirAcceso("/ordenes/despacho");

  const ordenes = await obtenerOrdenesParaSeccion(
    "lista_despacho",
    usuario.rol,
  );

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Órdenes para despachar
          </h1>
          <p className="text-base text-zinc-600">
            Marca las órdenes que ya quedaron listas para salir al cliente. Con
            eso le quedan a secretaría para el cierre.
          </p>
        </header>

        <ListaOrdenesSeccion ordenes={ordenes} checkpoint="lista_despacho" />
      </main>
    </div>
  );
}
