"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import {
  marcarCheckpoint,
  type EstadoMarcado,
} from "@/features/workflow/actions";
import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import type { OrdenParaSeccion } from "@/features/workflow/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * La lista con la que una sección marca su etapa: una tarjeta por orden y un
 * solo botón (RNF-08). Sirve para corte (HU-08), marcación (HU-12) y cualquier
 * etapa que tenga pantalla propia; lo que cambia es el `checkpoint`.
 *
 * Cuando el motor no deja marcar, el botón queda deshabilitado con el motivo
 * al lado, en lenguaje del taller, en vez de desaparecer. Una etapa ya marcada
 * se muestra como hecha.
 */

type Props = {
  ordenes: OrdenParaSeccion[];
  checkpoint: CheckpointId;
};

export function ListaOrdenesSeccion({ ordenes, checkpoint }: Props) {
  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">No hay órdenes registradas</p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando se registre una orden, aparecerá en esta lista.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {ordenes.map((orden) => (
        <li key={orden.id}>
          <TarjetaOrden orden={orden} checkpoint={checkpoint} />
        </li>
      ))}
    </ul>
  );
}

function TarjetaOrden({
  orden,
  checkpoint,
}: {
  orden: OrdenParaSeccion;
  checkpoint: CheckpointId;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [estado, setEstado] = useState<EstadoMarcado | null>(null);
  const idMotivo = useId();

  const { etiqueta } = buscarCheckpoint(checkpoint);
  const accion = `Marcar ${etiqueta.toLowerCase()}`;

  function marcar() {
    setEstado(null);
    iniciarTransicion(async () => {
      const resultado = await marcarCheckpoint(orden.id, checkpoint);
      setEstado(resultado);
      if (resultado.ok) router.refresh();
    });
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Orden de compra</p>
          <h2 className="text-lg font-semibold text-zinc-900">
            {orden.numeroOrdenCompra}
          </h2>
          <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
          <p className="mt-1 text-sm text-zinc-500">
            Entrega: {formatearFecha(orden.fechaEntrega)}
          </p>
        </div>

        {orden.yaMarcada ? (
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-100 px-4 py-2 font-medium text-emerald-800">
            {etiqueta}
          </span>
        ) : orden.veredicto.permitido ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={marcar}
            className="min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {pendiente ? "Guardando…" : accion}
          </button>
        ) : (
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              disabled
              aria-describedby={idMotivo}
              className="min-h-12 rounded-lg bg-zinc-400 px-5 font-semibold text-white"
            >
              {accion}
            </button>
            <p id={idMotivo} className="text-sm text-zinc-700 sm:text-right">
              {orden.veredicto.mensaje}
            </p>
          </div>
        )}
      </div>

      {estado?.mensaje ? (
        <p
          role={estado.ok ? "status" : "alert"}
          className={[
            "mt-4 rounded-lg px-4 py-3 text-sm",
            estado.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800",
          ].join(" ")}
        >
          {estado.mensaje}
        </p>
      ) : null}
    </article>
  );
}
