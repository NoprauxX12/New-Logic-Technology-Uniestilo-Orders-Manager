import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioProgramacion } from "@/features/programacion/components/FormularioProgramacion";
import { HojaDeProgramacion } from "@/features/programacion/components/HojaDeProgramacion";
import {
  listarHojasDeProgramacion,
  listarOrdenesPorProgramar,
} from "@/features/programacion/queries";

export const metadata: Metadata = {
  title: "Programar a diseño · Uniestilo",
};

/** HU-03 · Pantalla de programación a diseño. Es de secretaría (HU-17). */
export default async function ProgramacionPage() {
  await exigirAcceso("/ordenes/programacion");

  const [porProgramar, hojas] = await Promise.all([
    listarOrdenesPorProgramar(),
    listarHojasDeProgramacion(),
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
            Arma la programación con las órdenes que diseño debe trabajar, en el
            orden en que deben trabajarse. Las que no alcancen quedan para la
            siguiente.
          </p>
        </header>

        <FormularioProgramacion ordenes={porProgramar} />

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Programaciones hechas
          </h2>

          {hojas.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600">
              Todavía no has armado ninguna programación.
            </p>
          ) : (
            hojas.map((hoja) => (
              <HojaDeProgramacion key={hoja.numero} hoja={hoja} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
