import Link from "next/link";

import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import {
  agruparOrdenesDeTalleres,
  describirDiasEnTaller,
} from "@/features/talleres/agrupacion";
import type { OrdenParaTalleres } from "@/features/talleres/queries";
import { derivarSemaforo } from "@/lib/ordenes/reglas";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-10 y HU-11 · Las órdenes con las que logística trabaja. Cada una lleva al
 * detalle, donde se despacha un lote o se confirma su recepción.
 *
 * Logística tiene tres tareas distintas, así que la lista se parte en tres: lo
 * que hay que mandar al taller, lo que está afuera esperando que vuelva (la que
 * lleva más días primero) y, plegado, lo que ya volvió (ver `agrupacion.ts`).
 */

type Props = {
  ordenes: OrdenParaTalleres[];
};

export function ListaOrdenesTalleres({ ordenes }: Props) {
  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">
          No hay órdenes listas para el taller
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando logística marque el recogido y bordado de una orden, aparecerá
          aquí para despacharla.
        </p>
      </div>
    );
  }

  const ahora = new Date();
  const { porDespachar, enElTaller, volvieron } = agruparOrdenesDeTalleres(
    ordenes,
    ahora,
  );

  return (
    <div className="flex flex-col gap-8">
      <Grupo
        titulo="Por despachar a un taller"
        ordenes={porDespachar}
        vacio="No hay órdenes por despachar ahora."
        ahora={ahora}
      />

      <Grupo
        titulo="En el taller, por recibir"
        ordenes={enElTaller}
        vacio="No hay lotes esperando en un taller."
        ahora={ahora}
        conDiasEnTaller
      />

      {volvieron.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Ya volvieron del taller ({volvieron.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">
            <Tarjetas ordenes={volvieron} ahora={ahora} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Grupo({
  titulo,
  ordenes,
  vacio,
  ahora,
  conDiasEnTaller = false,
}: {
  titulo: string;
  ordenes: OrdenParaTalleres[];
  vacio: string;
  ahora: Date;
  conDiasEnTaller?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900">
        {titulo}{" "}
        <span className="font-normal text-zinc-500">({ordenes.length})</span>
      </h2>
      {ordenes.length > 0 ? (
        <Tarjetas
          ordenes={ordenes}
          ahora={ahora}
          conDiasEnTaller={conDiasEnTaller}
        />
      ) : (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {vacio}
        </p>
      )}
    </section>
  );
}

function Tarjetas({
  ordenes,
  ahora,
  conDiasEnTaller = false,
}: {
  ordenes: OrdenParaTalleres[];
  ahora: Date;
  conDiasEnTaller?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {ordenes.map((orden) => (
        <li
          key={orden.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Orden de compra
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-zinc-900">
                  {orden.numeroOrdenCompra}
                </h3>
                <BadgeSemaforo
                  semaforo={derivarSemaforo(orden.fechaEntrega, ahora)}
                />
              </div>
              <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Entrega: {formatearFecha(orden.fechaEntrega)}
              </p>
              <p className="mt-2 text-sm font-medium text-stone-700">
                {orden.estadoTalleres}
              </p>
              {conDiasEnTaller && orden.enTallerDesde ? (
                <p className="mt-1 text-sm font-medium text-zinc-700">
                  {describirDiasEnTaller(orden.enTallerDesde, ahora)}
                </p>
              ) : null}
            </div>

            <Link
              href={`/ordenes/${orden.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800"
            >
              Abrir {orden.numeroOrdenCompra}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
