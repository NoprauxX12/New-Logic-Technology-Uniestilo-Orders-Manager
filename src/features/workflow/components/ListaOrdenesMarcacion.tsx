"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  marcarLlegadaMarcacion,
  type ResultadoLlegadaMarcacion,
} from "@/features/workflow/accionesMarcacion";
import type { OrdenParaMarcacion } from "@/features/workflow/consultasMarcacion";

type ListaOrdenesMarcacionProps = {
  ordenes: OrdenParaMarcacion[];
};

export function ListaOrdenesMarcacion({ ordenes }: ListaOrdenesMarcacionProps) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [resultadoPorOrden, setResultadoPorOrden] = useState<
    Record<string, ResultadoLlegadaMarcacion>
  >({});

  function registrarLlegada(ordenId: string) {
    iniciarTransicion(async () => {
      const resultado = await marcarLlegadaMarcacion(ordenId);

      setResultadoPorOrden((resultadosActuales) => ({
        ...resultadosActuales,
        [ordenId]: resultado,
      }));

      if (resultado.ok) {
        router.refresh();
      }
    });
  }

  if (ordenes.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-600">
        No hay órdenes registradas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {ordenes.map((orden) => {
        const resultado = resultadoPorOrden[orden.id];

        return (
          <article
            key={orden.id}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="text-sm text-zinc-500">Orden de compra</p>

                <h2 className="text-xl font-semibold text-zinc-900">
                  {orden.numeroOrdenCompra}
                </h2>

                <p className="mt-1 text-zinc-700">{orden.razonSocial}</p>

                <p className="mt-1 text-sm text-zinc-500">
                  Entrega: {orden.fechaEntrega}
                </p>
              </div>

              {orden.llegadaRegistrada ? (
                <span className="rounded-xl bg-emerald-100 px-5 py-3 font-medium text-emerald-800">
                  Llegada registrada
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!orden.puedeMarcar || pendiente}
                  onClick={() => registrarLlegada(orden.id)}
                  className="rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {pendiente ? "Registrando..." : "Marcar llegada a marcación"}
                </button>
              )}
            </div>

            {!orden.llegadaRegistrada && !orden.puedeMarcar ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {orden.motivoNoDisponible}
              </p>
            ) : null}

            {resultado ? (
              <p
                aria-live="polite"
                className={[
                  "mt-4 rounded-lg px-4 py-3 text-sm",
                  resultado.ok
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-800",
                ].join(" ")}
              >
                {resultado.mensaje}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
