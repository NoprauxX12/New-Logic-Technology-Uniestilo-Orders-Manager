import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormularioDespacharTaller } from "@/features/talleres/components/FormularioDespacharTaller";
import {
  obtenerOrdenParaDespacho,
  obtenerUsuariosDeLogistica,
  type LoteDespachado,
} from "@/features/talleres/queries";
import {
  describirEstadoDeTalleres,
  puedeDespachar,
} from "@/features/talleres/reglas";

export const metadata: Metadata = {
  title: "Orden · Uniestilo",
};

/**
 * HU-10 · Detalle de una orden y despacho a taller.
 *
 * Solo enruta: los datos los trae `queries.ts`, la decisión de si se puede
 * despachar la toman las reglas de la feature y el guardado vive en la action.
 *
 * El fondo se fija en blanco igual que en la pantalla de registro, mientras el
 * equipo decide qué hacer con el modo oscuro.
 */

type Props = {
  params: Promise<{ ordenId: string }>;
};

/** Las fechas llegan como 2026-09-09. Se parten a mano para no correr el día. */
function formatearFecha(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearMomento(momentoIso: string): string {
  return new Date(momentoIso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function TarjetaLote({ lote }: { lote: LoteDespachado }) {
  return (
    <li className="rounded-lg border border-zinc-300 bg-white px-4 py-3">
      <p className="text-base font-semibold text-zinc-900">{lote.taller}</p>
      <p className="text-base text-zinc-700">{lote.descripcionPrendas}</p>
      <p className="mt-1 text-sm text-zinc-600">
        Despachado el {formatearMomento(lote.fechaEnvio)}
        {lote.enviadoPor ? ` por ${lote.enviadoPor}` : ""}
      </p>
      <p className="text-sm font-medium text-zinc-700">
        {lote.recibido ? "Ya volvió del taller" : "Todavía en el taller"}
      </p>
      {lote.observacionesRecepcion ? (
        <p className="text-sm text-zinc-600">{lote.observacionesRecepcion}</p>
      ) : null}
    </li>
  );
}

export default async function OrdenPage({ params }: Props) {
  const { ordenId } = await params;

  const [orden, personalDeLogistica] = await Promise.all([
    obtenerOrdenParaDespacho(ordenId),
    obtenerUsuariosDeLogistica(),
  ]);

  if (!orden) notFound();

  const permiso = puedeDespachar(orden.marcados);
  const yaDespachada = orden.lotes.length > 0;

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

        {yaDespachada ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              Lotes enviados a taller
            </h2>
            <ul className="flex flex-col gap-3">
              {orden.lotes.map((lote) => (
                <TarjetaLote key={lote.id} lote={lote} />
              ))}
            </ul>
          </section>
        ) : null}

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
            <FormularioDespacharTaller
              ordenId={orden.id}
              personal={personalDeLogistica}
            />
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
