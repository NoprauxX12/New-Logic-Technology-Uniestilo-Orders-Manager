import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesTalleres } from "@/features/talleres/components/ListaOrdenesTalleres";
import { listarOrdenesParaTalleres } from "@/features/talleres/queries";

export const metadata: Metadata = {
  title: "Órdenes para taller · Uniestilo",
};

/** HU-10 y HU-11 · Pantalla de logística. Solo enruta. */
export default async function OrdenesTalleresPage() {
  await exigirAcceso("/ordenes/talleres");

  const ordenes = await listarOrdenesParaTalleres();

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Órdenes para taller
          </h1>
          <p className="text-base text-zinc-600">
            Abre una orden para despachar un lote a un taller o confirmar que
            volvió.
          </p>
        </header>

        <ListaOrdenesTalleres ordenes={ordenes} />
      </main>
    </div>
  );
}
