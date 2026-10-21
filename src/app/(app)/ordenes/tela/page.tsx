import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioProgramarTela } from "@/features/ordenes/components/FormularioProgramarTela";
import { obtenerOrdenesParaTela } from "@/features/ordenes/telaQueries";

export const metadata: Metadata = {
  title: "Programar tela · Uniestilo",
};

export default async function OrdenesTelaPage() {
  await exigirAcceso("/ordenes/tela");

  const ordenes = await obtenerOrdenesParaTela();

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-2">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Programar tela
          </h1>
          <p className="text-zinc-600">
            Registra la tela necesaria para cada ítem de las órdenes que ya
            tienen la ficha técnica marcada.
          </p>
        </header>

        <div className="space-y-5">
          {ordenes.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-600">
              No hay órdenes pendientes de programar tela con ficha técnica
              marcada.
            </p>
          ) : (
            ordenes.map((orden) => (
              <FormularioProgramarTela key={orden.id} orden={orden} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
