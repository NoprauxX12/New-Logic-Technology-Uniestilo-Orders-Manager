import type { Metadata } from "next";
import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import { obtenerOrdenesParaSeccion } from "@/features/workflow/queries";

export const metadata: Metadata = {
  title: "Recogido y bordado · Uniestilo",
};

export default async function OrdenesRecogidoBordadoPage() {
  const usuario = await exigirAcceso("/ordenes/recogido-bordado");

  const ordenes = await obtenerOrdenesParaSeccion(
    "recogido_bordado",
    usuario.rol,
  );

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Recogido y bordado
          </h1>
          <p className="text-base text-zinc-600">
            Marca este avance cuando la recogida y el bordado estén completos.
            La orden debe tener el corte finalizado.
          </p>
        </header>

        <ListaOrdenesSeccion ordenes={ordenes} checkpoint="recogido_bordado" />
      </main>
    </div>
  );
}
