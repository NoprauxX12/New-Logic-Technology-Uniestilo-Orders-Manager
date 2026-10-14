import type { Metadata } from "next";

import { ListaOrdenesTelas } from "@/features/alertas/components/ListaOrdenesTelas";
import { listarOrdenesParaTelas } from "@/features/alertas/queries";
import { exigirAcceso } from "@/features/auth/guardia";

export const metadata: Metadata = {
  title: "Telas · Uniestilo",
};

/** HU-06 · Pantalla de secretaría para avisar que falta tela. Solo enruta. */
export default async function OrdenesTelasPage() {
  const usuario = await exigirAcceso("/ordenes/telas");

  const ordenes = await listarOrdenesParaTelas(usuario.rol);

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Validar telas
          </h1>
          <p className="text-base text-zinc-600">
            Si para alguna orden falta tela, avísale a administración para que
            haga el pedido.
          </p>
        </header>

        <ListaOrdenesTelas ordenes={ordenes} />
      </main>
    </div>
  );
}
