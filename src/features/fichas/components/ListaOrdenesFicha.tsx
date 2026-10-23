"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import {
  adjuntarFichaTecnica,
  type ResultadoFicha,
} from "@/features/fichas/actions";
import type { OrdenParaFicha } from "@/features/fichas/queries";
import { agruparOrdenesDeSeccion } from "@/features/workflow/agrupacion";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import { derivarSemaforo } from "@/lib/ordenes/reglas";
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
  const [aviso, setAviso] = useState<string | null>(null);

  // Diseño puede adjuntar otra versión de una ficha vieja, así que lo ya marcado
  // se muestra sin límite de días (plegado, y sin las órdenes cerradas).
  const { paraMarcar, enEspera, hechas } = useMemo(
    () =>
      agruparOrdenesDeSeccion(ordenes, new Date(), { diasDeMarcadas: null }),
    [ordenes],
  );

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

  const tarjetas = (lista: OrdenParaFicha[]) => (
    <ul className="flex flex-col gap-4">
      {lista.map((orden) => (
        <li key={orden.id}>
          <TarjetaFicha orden={orden} alAdjuntar={setAviso} />
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
          Para adjuntar ahora{" "}
          <span className="font-normal text-zinc-500">
            ({paraMarcar.length})
          </span>
        </h2>

        {paraMarcar.length > 0 ? (
          tarjetas(paraMarcar as OrdenParaFicha[])
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="font-medium text-zinc-900">
              No hay fichas por adjuntar ahora
            </p>
            {enEspera.length > 0 ? (
              <p className="mt-1 text-sm text-zinc-600">
                {enEspera.length === 1
                  ? "Hay 1 orden esperando que termine una etapa anterior."
                  : `Hay ${enEspera.length} órdenes esperando que terminen etapas anteriores.`}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {enEspera.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Todavía no llegan a esta etapa ({enEspera.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">
            {tarjetas(enEspera as OrdenParaFicha[])}
          </div>
        </details>
      ) : null}

      {hechas.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Con ficha adjunta ({hechas.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">
            {tarjetas(hechas as OrdenParaFicha[])}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TarjetaFicha({
  orden,
  alAdjuntar,
}: {
  orden: OrdenParaFicha;
  /** El aviso de éxito sube a la lista: al adjuntar, la tarjeta cambia de grupo. */
  alAdjuntar: (mensaje: string) => void;
}) {
  const [estado, enviar, enviando] = useActionState(
    async (previo: ResultadoFicha, formData: FormData) => {
      const resultado = await adjuntarFichaTecnica(previo, formData);
      if (resultado.ok) alAdjuntar(resultado.mensaje);
      return resultado;
    },
    ESTADO_INICIAL,
  );
  const idArchivo = useId();
  const idMotivo = useId();

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Orden de compra</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">
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

        {estado.mensaje && !estado.ok ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {estado.mensaje}
          </p>
        ) : null}
      </div>
    </article>
  );
}
