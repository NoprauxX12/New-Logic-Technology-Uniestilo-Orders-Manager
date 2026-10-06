import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import { obtenerOrdenesParaSeccion } from "@/features/workflow/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export const metadata: Metadata = {
  title: "Órdenes para marcación · Uniestilo",
};

/** HU-12 · Pantalla de marcación. Solo enruta: la lista y la action son genéricas. */
export default async function OrdenesMarcacionPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const ordenes = await obtenerOrdenesParaSeccion(
    "llegada_marcacion",
    usuario.rol,
  );

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Órdenes para marcación
          </h1>
          <p className="text-base text-zinc-600">
            Registra las órdenes recibidas por el área de marcación.
          </p>
        </header>

        <ListaOrdenesSeccion ordenes={ordenes} checkpoint="llegada_marcacion" />
      </main>
    </div>
  );
}
