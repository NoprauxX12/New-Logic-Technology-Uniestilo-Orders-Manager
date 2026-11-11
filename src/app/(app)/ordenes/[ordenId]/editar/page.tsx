import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioEditarOrden } from "@/features/ordenes/components/FormularioEditarOrden";
import { puedeEditarOrden } from "@/features/ordenes/edicion";
import { obtenerOrdenParaEditar } from "@/features/ordenes/queries";

export const metadata: Metadata = {
  title: "Editar orden · Uniestilo",
};

/**
 * Editar una orden, hasta cotización aprobada inclusive (`docs/adr/0012`). Solo
 * enruta: la regla vive en la feature y la action y la base la repiten.
 */

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function EditarOrdenPage({ params }: Props) {
  const { ordenId } = await params;

  const usuario = await exigirAcceso(`/ordenes/${ordenId}/editar`);
  const orden = await obtenerOrdenParaEditar(ordenId);

  if (!orden) notFound();

  const veredicto = puedeEditarOrden({
    marcados: orden.marcados,
    etapaInicial: orden.etapaInicial,
    rol: usuario.rol,
  });

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href={`/tablero/${orden.id}`}
          className="text-sm font-medium text-stone-700 hover:text-stone-900"
        >
          ← Volver a la orden
        </Link>

        <header className="mt-4 mb-8 space-y-1">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Editar orden {orden.numeroOrdenCompra}
          </h1>
        </header>

        {veredicto.permitido ? (
          <FormularioEditarOrden
            ordenId={orden.id}
            valores={orden.entrada}
            otrasOrdenesDelCliente={orden.otrasOrdenesDelCliente}
          />
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base font-medium text-amber-900">
            {veredicto.mensaje}
          </p>
        )}
      </main>
    </div>
  );
}
