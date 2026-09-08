"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { marcarCorteCompletado } from "@/features/workflow/actions";
import type { OrdenParaCorte } from "@/features/workflow/queries";

type Props = {
  ordenes: OrdenParaCorte[];
};

export function ListaOrdenesCorte({ ordenes }: Props) {
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
    <div className="space-y-4">
      {ordenes.map((orden) => (
        <TarjetaOrdenCorte key={orden.id} orden={orden} />
      ))}
    </div>
  );
}

function TarjetaOrdenCorte({ orden }: { orden: OrdenParaCorte }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [mensaje, setMensaje] = useState("");

  function completarCorte() {
    setMensaje("");

    iniciarTransicion(async () => {
      const resultado = await marcarCorteCompletado(orden.id);
      setMensaje(resultado.mensaje);

      if (resultado.ok) {
        router.refresh();
      }
    });
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Orden de compra</p>

          <h2 className="text-lg font-semibold text-zinc-900">
            {orden.numeroOrdenCompra}
          </h2>

          <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>

          <p className="mt-1 text-sm text-zinc-500">
            Entrega: {orden.fechaEntrega}
          </p>
        </div>

        {orden.corteCompletado ? (
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-100 px-4 py-2 font-medium text-emerald-800">
            Corte completado
          </span>
        ) : (
          <button
            type="button"
            disabled={pendiente}
            onClick={completarCorte}
            className="min-h-11 rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {pendiente ? "Guardando..." : "Marcar corte completado"}
          </button>
        )}
      </div>

      {mensaje && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            orden.corteCompletado
              ? "bg-emerald-50 text-emerald-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {mensaje}
        </p>
      )}
    </article>
  );
}
