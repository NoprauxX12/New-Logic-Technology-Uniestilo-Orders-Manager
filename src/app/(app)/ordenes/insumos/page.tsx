import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesInsumos } from "@/features/insumos/components/ListaOrdenesInsumos";
import { listarOrdenesParaInsumos } from "@/features/insumos/queries";

export const metadata: Metadata = {
  title: "Validar insumos · Uniestilo",
};

/** HU-23 · Secretaría valida los insumos de cada orden antes del corte. */
export default async function OrdenesInsumosPage() {
  const usuario = await exigirAcceso("/ordenes/insumos");
  const ordenes = await listarOrdenesParaInsumos(usuario.rol);

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Validar insumos
          </h1>
          <p className="text-base text-zinc-600">
            Saca de la orden de compra los insumos que lleva cada orden (hilo,
            resorte, cierre, botón, hilo de bordar, sublimado, estampado) y
            márcalos como validados.
          </p>
        </header>

        <ListaOrdenesInsumos ordenes={ordenes} />
      </main>
    </div>
  );
}
