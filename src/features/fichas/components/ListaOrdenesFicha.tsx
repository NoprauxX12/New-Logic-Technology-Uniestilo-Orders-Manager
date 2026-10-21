"use client";

import { useActionState, useId } from "react";

import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import {
  adjuntarFichaTecnica,
  type ResultadoFicha,
} from "@/features/fichas/actions";
import type { OrdenParaFicha } from "@/features/fichas/queries";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-04 · Lista con la que Diseño adjunta la ficha técnica. Una tarjeta por
 * orden y una sola acción (RNF-08): elegir el archivo y subirlo. Si la etapa
 * todavía no estaba marcada, la action la marca por el motor.
 */

const ESTADO_INICIAL: ResultadoFicha = { ok: false, mensaje: "" };

const { etiqueta } = buscarCheckpoint("ficha_adjunta");

type Props = {
  ordenes: OrdenParaFicha[];
};

export function ListaOrdenesFicha({ ordenes }: Props) {
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
          <TarjetaFicha orden={orden} />
        </li>
      ))}
    </ul>
  );
}

function TarjetaFicha({ orden }: { orden: OrdenParaFicha }) {
  const [estado, enviar, enviando] = useActionState(
    adjuntarFichaTecnica,
    ESTADO_INICIAL,
  );
  const idArchivo = useId();
  const idMotivo = useId();

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
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
          <span className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-emerald-100 px-4 py-2 font-medium text-emerald-800">
            {etiqueta}
          </span>
        ) : null}

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">
            Ficha técnica
          </p>
          <FichasAdjuntas fichas={orden.fichas} />
        </div>

        {orden.puedeAdjuntar ? (
          <form action={enviar} className="flex flex-col gap-3">
            <input type="hidden" name="ordenId" value={orden.id} />
            <label
              htmlFor={idArchivo}
              className="text-base font-medium text-zinc-900"
            >
              {orden.fichas.length > 0
                ? "Adjuntar otra ficha técnica"
                : "Archivo de la ficha técnica"}
            </label>
            <p className="text-sm text-zinc-600">
              PDF, JPG, PNG o Excel. Máximo 10 MB.
            </p>
            <input
              id={idArchivo}
              name="archivo"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-800"
            />
            <button
              type="submit"
              disabled={enviando}
              className="min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:self-start"
            >
              {enviando ? "Subiendo…" : "Adjuntar ficha técnica"}
            </button>
          </form>
        ) : orden.yaMarcada ? null : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled
              aria-describedby={idMotivo}
              className="min-h-12 rounded-lg bg-zinc-400 px-5 font-semibold text-white sm:self-start"
            >
              Adjuntar ficha técnica
            </button>
            <p id={idMotivo} className="text-sm text-zinc-700">
              {orden.veredicto.permitido ? null : orden.veredicto.mensaje}
            </p>
          </div>
        )}

        {estado.mensaje ? (
          <p
            role={estado.ok ? "status" : "alert"}
            className={[
              "rounded-lg px-4 py-3 text-sm",
              estado.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800",
            ].join(" ")}
          >
            {estado.mensaje}
          </p>
        ) : null}
      </div>
    </article>
  );
}
