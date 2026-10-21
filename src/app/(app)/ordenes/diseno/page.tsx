import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesFicha } from "@/features/fichas/components/ListaOrdenesFicha";
import { obtenerOrdenesParaFicha } from "@/features/fichas/queries";

export const metadata: Metadata = {
  title: "Ficha técnica · Uniestilo",
};

/** HU-04 · Pantalla de diseño: adjuntar la ficha técnica a la orden. */
export default async function OrdenesDisenoPage() {
  const usuario = await exigirAcceso("/ordenes/diseno");
  const ordenes = await obtenerOrdenesParaFicha(usuario.rol);

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Ficha técnica
          </h1>
          <p className="text-base text-zinc-600">
            Sube el archivo de la ficha técnica a cada orden. El resto del
            equipo también lo puede ver.
          </p>
        </header>

        <ListaOrdenesFicha ordenes={ordenes} />
      </main>
    </div>
  );
}
