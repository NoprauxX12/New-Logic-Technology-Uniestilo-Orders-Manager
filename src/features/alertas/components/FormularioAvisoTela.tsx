"use client";

import { useActionState } from "react";

import {
  avisarFaltaDeTela,
  type EstadoFormularioAviso,
} from "@/features/alertas/actions";
import { ENTRADA_AVISO_VACIA } from "@/features/alertas/formulario";

/**
 * HU-06 · El formulario para avisar que falta tela en una orden.
 *
 * Una sola pregunta y un solo botón (RNF-08): qué tela falta. El número de la
 * orden viaja oculto; quién avisa y a quién le llega no se preguntan, porque
 * los decide el sistema.
 *
 * Es componente de cliente porque necesita el estado que devuelve la action
 * para pintar el error del campo o la confirmación.
 */

const ESTADO_INICIAL: EstadoFormularioAviso = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_AVISO_VACIA,
};

type Props = {
  ordenId: string;
};

export function FormularioAvisoTela({ ordenId }: Props) {
  const [estado, enviar, enviando] = useActionState(
    avisarFaltaDeTela,
    ESTADO_INICIAL,
  );

  const idCampo = `detalle-${ordenId}`;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;
  const errorDetalle = estado.errores.detalle?.[0];

  return (
    <form action={enviar} className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-1">
        <label
          htmlFor={idCampo}
          className="text-base font-medium text-zinc-900"
        >
          ¿Qué tela falta?
        </label>
        <p id={idAyuda} className="text-sm text-zinc-600">
          Por ejemplo: faltan 40 metros de tela impermeable azul
        </p>
        <textarea
          id={idCampo}
          name="detalle"
          rows={2}
          defaultValue={estado.valores.detalle}
          aria-invalid={Boolean(errorDetalle)}
          aria-describedby={errorDetalle ? `${idAyuda} ${idError}` : idAyuda}
          className={[
            "min-h-12 rounded-lg border bg-white px-3 py-2 text-base text-zinc-900",
            "focus:ring-2 focus:ring-stone-500 focus:outline-none",
            errorDetalle ? "border-red-600" : "border-zinc-300",
          ].join(" ")}
        />
        {errorDetalle ? (
          <p id={idError} className="text-sm font-medium text-red-700">
            {errorDetalle}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="min-h-12 self-start rounded-lg bg-stone-700 px-5 text-base font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Enviando…" : "Avisar a administración"}
      </button>
    </form>
  );
}
