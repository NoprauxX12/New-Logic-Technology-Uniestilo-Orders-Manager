import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { exigirAcceso } from "@/features/auth/guardia";
import { BotonImprimir } from "@/features/insumos/components/BotonImprimir";
import { HojaDeInsumos } from "@/features/insumos/components/HojaDeInsumos";
import { obtenerListadoDeInsumos } from "@/features/insumos/queries";

export const metadata: Metadata = {
  title: "Listado de insumos · Uniestilo",
};

type Props = {
  params: Promise<{ ordenId: string }>;
};

/** HU-23 · El listado de insumos de una orden, listo para imprimir. */
export default async function ListadoDeInsumosPage({ params }: Props) {
  const { ordenId } = await params;
  await exigirAcceso(`/ordenes/insumos/${ordenId}`);

  const listado = await obtenerListadoDeInsumos(ordenId);
  if (!listado) notFound();

  return (
    <div className="flex-1 bg-zinc-50 print:bg-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/ordenes/insumos"
            className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Volver a insumos
          </Link>
          <BotonImprimir />
        </div>

        <HojaDeInsumos listado={listado} />
      </main>
    </div>
  );
}
