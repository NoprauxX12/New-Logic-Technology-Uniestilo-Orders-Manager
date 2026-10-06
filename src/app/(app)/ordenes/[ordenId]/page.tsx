import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FormularioDespacharTaller } from "@/features/talleres/components/FormularioDespacharTaller";
import { LotesDeLaOrden } from "@/features/talleres/components/LotesDeLaOrden";
import { obtenerOrdenParaDespacho } from "@/features/talleres/queries";
import { puedeDespachar, ROL_DE_TALLERES } from "@/features/talleres/reglas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { describirEstadoDeTalleres } from "@/lib/talleres/estadoLotes";
import { formatearFecha } from "@/lib/utils/fechas";

export const metadata: Metadata = {
  title: "Orden · Uniestilo",
};

/**
 * HU-10 y HU-11 · Detalle de una orden para logística: despacho a taller y
 * recepción de lotes.
 *
 * Solo enruta: los datos los trae `queries.ts`, la decisión de si se puede
 * despachar la toman las reglas de la feature y el guardado vive en la action.
 */

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function OrdenPage({ params }: Props) {
  const { ordenId } = await params;

  const [orden, usuario] = await Promise.all([
    obtenerOrdenParaDespacho(ordenId),
    getUsuarioActual(),
  ]);

  if (!usuario) redirect("/login");
  if (!orden) notFound();

  const permiso = puedeDespachar(orden.marcados, usuario.rol);
  const yaDespachada = orden.lotes.length > 0;
  const esLogistica = usuario.rol === ROL_DE_TALLERES;

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <header className="space-y-1">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Orden {orden.numeroOrdenCompra}
          </h1>
          <p className="text-base text-zinc-600">
            {orden.razonSocial} · entrega el{" "}
            {formatearFecha(orden.fechaEntrega)}
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">
            Estado en talleres
          </h2>
          <p className="text-base text-zinc-700">
            {describirEstadoDeTalleres(orden.lotes)}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Prendas</h2>
          <ul className="flex flex-col gap-1 text-base text-zinc-700">
            {orden.prendas.map((prenda) => (
              <li key={prenda.id}>
                {prenda.cantidad} × {prenda.descripcion} ({prenda.tallas})
              </li>
            ))}
          </ul>
        </section>

        <LotesDeLaOrden
          ordenId={orden.id}
          lotes={orden.lotes}
          puedeConfirmar={esLogistica}
        />

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            {yaDespachada ? "Despachar otro lote" : "Despachar a un taller"}
          </h2>

          {yaDespachada ? (
            <p className="text-base text-zinc-600">
              Si el resto de la orden va para otro taller, regístralo aquí.
            </p>
          ) : null}

          {permiso.permitido ? (
            <FormularioDespacharTaller ordenId={orden.id} />
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base font-medium text-amber-900">
              {permiso.mensaje}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
