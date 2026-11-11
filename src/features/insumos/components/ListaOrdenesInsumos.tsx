"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EnlaceDetalleOrden } from "@/components/EnlaceDetalleOrden";
import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import { FormularioInsumos } from "@/features/insumos/components/FormularioInsumos";
import { ListadoDeInsumos } from "@/features/insumos/components/ListadoDeInsumos";
import { PrendasDeLaOrden } from "@/features/insumos/components/PrendasDeLaOrden";
import type { OrdenParaInsumos } from "@/features/insumos/queries";
import {
  agruparOrdenesDeSeccion,
  DIAS_DE_MARCADAS,
} from "@/features/workflow/agrupacion";
import { derivarSemaforo } from "@/lib/ordenes/reglas";
import { formatearDia, formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-23 · La lista de validación de insumos. Contesta «¿qué hago ahora?» como
 * las demás listas de trabajo: arriba las órdenes a las que les toca, por
 * urgencia; debajo y plegado lo que todavía no llega a esta etapa; al final,
 * plegado, lo validado esta semana con su listado.
 */

type Props = {
  ordenes: OrdenParaInsumos[];
};

export function ListaOrdenesInsumos({ ordenes }: Props) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const { paraMarcar, enEspera, hechas } = useMemo(
    () => agruparOrdenesDeSeccion(ordenes),
    [ordenes],
  );

  function alValidar(mensaje: string) {
    setAviso(mensaje);
    router.refresh();
  }

  const tarjetas = (lista: OrdenParaInsumos[]) => (
    <ul className="flex flex-col gap-4">
      {lista.map((orden) => (
        <li key={orden.id}>
          <TarjetaInsumos orden={orden} alValidar={alValidar} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-8">
      {aviso ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {aviso}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          Para validar ahora{" "}
          <span className="font-normal text-zinc-500">
            ({paraMarcar.length})
          </span>
        </h2>

        {paraMarcar.length > 0 ? (
          tarjetas(paraMarcar)
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="font-medium text-zinc-900">
              No hay órdenes para validar ahora
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Una orden llega aquí cuando ya tiene la tela programada.
            </p>
          </div>
        )}
      </section>

      {enEspera.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Todavía no llegan a esta etapa ({enEspera.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">
            {tarjetas(enEspera)}
          </div>
        </details>
      ) : null}

      {hechas.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Validadas en los últimos {DIAS_DE_MARCADAS} días ({hechas.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">{tarjetas(hechas)}</div>
        </details>
      ) : null}
    </div>
  );
}

function TarjetaInsumos({
  orden,
  alValidar,
}: {
  orden: OrdenParaInsumos;
  alValidar: (mensaje: string) => void;
}) {
  return (
    <article
      aria-labelledby={`orden-${orden.id}`}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Orden de compra</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`orden-${orden.id}`}
              className="text-lg font-semibold text-zinc-900"
            >
              {orden.numeroOrdenCompra}
            </h3>
            {orden.yaMarcada ? null : (
              <BadgeSemaforo semaforo={derivarSemaforo(orden.fechaEntrega)} />
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
          <p className="mt-1 text-sm text-zinc-500">
            Entrega: {formatearFecha(orden.fechaEntrega)}
          </p>
          <EnlaceDetalleOrden
            ordenId={orden.id}
            numeroOrdenCompra={orden.numeroOrdenCompra}
          />
        </div>

        <Link
          href={`/ordenes/insumos/${orden.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          Ver listado para imprimir
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <PrendasDeLaOrden prendas={orden.prendas} />
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">
              Ficha técnica
            </p>
            <FichasAdjuntas fichas={orden.fichas} />
          </div>
        </div>

        <div>
          {orden.yaMarcada ? (
            <div className="flex flex-col gap-2">
              <p className="inline-flex min-h-11 items-center self-start rounded-lg bg-emerald-100 px-4 py-2 font-medium text-emerald-800">
                Insumos validados
                {orden.fechaMarcado
                  ? ` el ${formatearDia(orden.fechaMarcado)}`
                  : ""}
              </p>
              <ListadoDeInsumos listado={orden.listado} />
            </div>
          ) : orden.veredicto.permitido ? (
            <FormularioInsumos ordenId={orden.id} alValidar={alValidar} />
          ) : (
            <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {orden.veredicto.mensaje}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
