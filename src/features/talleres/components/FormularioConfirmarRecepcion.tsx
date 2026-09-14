"use client";

import { useActionState } from "react";

import {
  confirmarRecepcion,
  type EstadoFormularioRecepcion,
} from "@/features/talleres/actions";
import { ENTRADA_RECEPCION_VACIA } from "@/features/talleres/formulario";

/**
 * HU-11 · Formulario de confirmación de recepción de un lote.
 *
 * Muestra lo que se envió (criterio de aceptación: comparar contra HU-10) justo
 * encima de la pregunta, para que quien recibe lo tenga a la vista al decidir
 * si llegó completo. No repite el taller ni la fecha de envío: eso ya está en
 * la tarjeta del lote, justo arriba de este formulario.
 */

const ESTADO_INICIAL: EstadoFormularioRecepcion = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_RECEPCION_VACIA,
};

type Props = {
  ordenId: string;
  loteId: string;
  descripcionPrendas: string;
};

export function FormularioConfirmarRecepcion({
  ordenId,
  loteId,
  descripcionPrendas,
}: Props) {
  const [estado, enviar, enviando] = useActionState(
    confirmarRecepcion,
    ESTADO_INICIAL,
  );

  const errorCompleto = estado.errores.completo?.[0];

  return (
    <form
      action={enviar}
      className="flex flex-col gap-4 rounded-lg border border-zinc-300 bg-zinc-50 p-4"
    >
      {estado.ok && estado.mensaje ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      {!estado.ok && estado.mensaje ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <input type="hidden" name="ordenId" value={ordenId} />
      <input type="hidden" name="loteId" value={loteId} />

      <div>
        <p className="text-sm font-medium text-zinc-600">Lo que se envió</p>
        <p className="text-base text-zinc-900">{descripcionPrendas}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium text-zinc-900">
          ¿Llegó todo completo?
        </legend>

        <div className="flex gap-4">
          <label className="flex min-h-11 items-center gap-2 text-base text-zinc-900">
            <input
              type="radio"
              name="completo"
              value="si"
              defaultChecked={estado.valores.completo === "si"}
              className="size-5"
            />
            Sí, completo
          </label>
          <label className="flex min-h-11 items-center gap-2 text-base text-zinc-900">
            <input
              type="radio"
              name="completo"
              value="no"
              defaultChecked={estado.valores.completo === "no"}
              className="size-5"
            />
            No, faltó algo
          </label>
        </div>

        {errorCompleto ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errorCompleto}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`observaciones-${loteId}`}
          className="text-base font-medium text-zinc-900"
        >
          Observaciones (opcional)
        </label>
        <p
          id={`observaciones-ayuda-${loteId}`}
          className="text-sm text-zinc-600"
        >
          Por ejemplo: qué faltó o en qué llegó mal
        </p>
        <textarea
          id={`observaciones-${loteId}`}
          name="observaciones"
          rows={2}
          defaultValue={estado.valores.observaciones}
          aria-describedby={`observaciones-ayuda-${loteId}`}
          className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Confirmar recepción"}
      </button>
    </form>
  );
}
