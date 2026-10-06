import type { Metadata } from "next";
import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import { obtenerOrdenesParaSeccion } from "@/features/workflow/queries";

export const metadata: Metadata = {
  title: "Órdenes para corte · Uniestilo",
};

/** HU-08 · Pantalla de corte. Solo enruta: la lista y la action son genéricas. */
export default async function OrdenesCortePage() {
  const usuario = await exigirAcceso("/ordenes/corte");

  const ordenes = await obtenerOrdenesParaSeccion(
    "corte_completado",
    usuario.rol,
  );

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Órdenes para corte
          </h1>
          <p className="text-base text-zinc-600">
            Marca las órdenes cuyo proceso de corte ya finalizó.
          </p>
        </header>

        <ListaOrdenesSeccion ordenes={ordenes} checkpoint="corte_completado" />
      </main>
    </div>
  );
}
