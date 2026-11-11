import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioDespacharTaller } from "@/features/talleres/components/FormularioDespacharTaller";
import { LotesDeLaOrden } from "@/features/talleres/components/LotesDeLaOrden";
import { obtenerOrdenParaDespacho } from "@/features/talleres/queries";
import {
  puedeDespachar,
  puedeVerTalleres,
  ROL_DE_TALLERES,
} from "@/features/talleres/reglas";
import { describirEstadoDeTalleres } from "@/lib/talleres/estadoLotes";
import { formatearFecha } from "@/lib/utils/fechas";

export const metadata: Metadata = {
  title: "Orden · Uniestilo",
};

/**
 * El detalle de una orden, el mismo para todos los roles: para quién es, la
 * entrega, las prendas con sus tallas y la ficha técnica. Los talleres por los
 * que ha pasado solo los ven terminación, logística y administración. Es de solo lectura, salvo para logística, que desde aquí
 * despacha a taller y recibe los lotes (HU-10 y HU-11).
 *
 * Solo enruta: los datos los trae `queries.ts`, la decisión de si se puede
 * despachar la toman las reglas de la feature y el guardado vive en la action.
 */

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function OrdenPage({ params }: Props) {
  const { ordenId } = await params;

  const usuario = await exigirAcceso(`/ordenes/${ordenId}`);
  const orden = await obtenerOrdenParaDespacho(ordenId);

  if (!orden) notFound();

  const permiso = puedeDespachar(orden.marcados, usuario.rol);
  const yaDespachada = orden.lotes.length > 0;
  // Solo logística despacha y recibe; los demás roles leen.
  const esLogistica = usuario.rol === ROL_DE_TALLERES;
  // De qué taller viene la orden solo lo ven terminación, logística y admin.
  const veTalleres = puedeVerTalleres(usuario.rol);
  const totalPrendas = orden.prendas.reduce(
    (total, prenda) => total + prenda.cantidad,
    0,
  );

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
          <h2 className="text-lg font-semibold text-zinc-900">Para quién es</h2>
          <dl className="flex flex-col gap-1 text-base text-zinc-700">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">Cliente:</dt>
              <dd className="font-medium text-zinc-900">{orden.razonSocial}</dd>
            </div>
            {orden.contactoNombre ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-zinc-500">Contacto:</dt>
                <dd>
                  {orden.contactoNombre}
                  {orden.contactoCelular ? ` · ${orden.contactoCelular}` : ""}
                </dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">Entrega:</dt>
              <dd>{formatearFecha(orden.fechaEntrega)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">Pedido recibido:</dt>
              <dd>{formatearFecha(orden.fechaIngreso)}</dd>
            </div>
          </dl>
          {orden.observaciones ? (
            <p className="text-base text-zinc-700">{orden.observaciones}</p>
          ) : null}
        </section>

        {veTalleres ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Estado en talleres
            </h2>
            <p className="text-base text-zinc-700">
              {describirEstadoDeTalleres(orden.lotes)}
            </p>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Ficha técnica</h2>
          <FichasAdjuntas fichas={orden.fichas} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">
            Prendas{" "}
            <span className="font-normal text-zinc-500">
              ({totalPrendas} en total)
            </span>
          </h2>
          <ul className="flex flex-col gap-2 text-base text-zinc-700">
            {orden.prendas.map((prenda) => (
              <li
                key={prenda.id}
                className="rounded-lg border border-zinc-200 px-3 py-2"
              >
                <p className="font-medium text-zinc-900">
                  {prenda.cantidad} × {prenda.descripcion}
                </p>
                <p className="text-sm text-zinc-600">Tallas: {prenda.tallas}</p>
                {prenda.observaciones ? (
                  <p className="text-sm text-zinc-600">
                    {prenda.observaciones}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {veTalleres ? (
          <LotesDeLaOrden
            ordenId={orden.id}
            lotes={orden.lotes}
            puedeConfirmar={esLogistica}
          />
        ) : null}

        {esLogistica ? (
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
        ) : null}
      </main>
    </div>
  );
}
