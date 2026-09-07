import type { Metadata } from "next";

import { FormularioNuevaOrden } from "@/features/ordenes/components/FormularioNuevaOrden";

export const metadata: Metadata = {
  title: "Registrar orden · Uniestilo",
};

/**
 * HU-01 · Pantalla de registro. Solo enruta: la lógica vive en la feature.
 *
 * El fondo se fija en blanco a propósito. El `globals.css` heredado del
 * andamiaje oscurece el `body` cuando el sistema está en modo oscuro, pero la
 * aplicación no tiene todavía una paleta para ese modo y el texto quedaría
 * ilegible. Qué hacer con el tema oscuro es una decisión de todo el equipo.
 */
export default function NuevaOrdenPage() {
  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Registrar una orden
          </h1>
          <p className="text-base text-zinc-600">
            Los datos del pedido y las prendas que hay que confeccionar.
          </p>
        </header>

        <FormularioNuevaOrden />
      </main>
    </div>
  );
}
