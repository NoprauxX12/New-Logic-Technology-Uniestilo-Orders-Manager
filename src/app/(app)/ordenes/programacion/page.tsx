import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioProgramacion } from "@/features/programacion/components/FormularioProgramacion";
import { HojaDeProgramacion } from "@/features/programacion/components/HojaDeProgramacion";
import {
  listarHojaDeProgramacion,
  listarOrdenesPorProgramar,
} from "@/features/programacion/queries";

export const metadata: Metadata = {
  title: "Programar a diseño · Uniestilo",
};

/** HU-03 · Pantalla de programación a diseño. Es de secretaría (HU-17). */
export default async function ProgramacionPage() {
  await exigirAcceso("/ordenes/programacion");

  const [porProgramar, hoja] = await Promise.all([
    listarOrdenesPorProgramar(),
    listarHojaDeProgramacion(),
  ]);

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
        <header className="space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Programar a diseño
          </h1>
          <p className="text-base text-zinc-600">
            Arma la lista de órdenes que diseño debe trabajar, en el orden en
            que deben trabajarse. Puedes seguir agregando en otro momento.
          </p>
        </header>

        <FormularioProgramacion ordenes={porProgramar} />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            Hoja de programación
          </h2>
          <p className="text-sm text-zinc-600">
            Lo que diseño ya tiene para trabajar, en orden.
          </p>

          <HojaDeProgramacion ordenes={hoja} />
        </section>
      </main>
    </div>
  );
}
