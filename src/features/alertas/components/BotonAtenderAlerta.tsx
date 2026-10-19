"use client";

import { useActionState } from "react";

import {
  atenderAlertaDeTela,
  type EstadoAtencionAlerta,
} from "@/features/alertas/actions";

/**
 * HU-07 · El botón con el que administración marca la alerta como resuelta.
 *
 * Una sola acción. Quién la atiende sale de la sesión. Al resolverse, la
 * tarjeta sale del tablero, así que aquí solo se pinta el error.
 */

const ESTADO_INICIAL: EstadoAtencionAlerta = { ok: false, mensaje: "" };

type Props = {
  alertaId: string;
};

export function BotonAtenderAlerta({ alertaId }: Props) {
  const [estado, enviar, enviando] = useActionState(
    atenderAlertaDeTela,
    ESTADO_INICIAL,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="alertaId" value={alertaId} />

      {!estado.ok && estado.mensaje ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="min-h-12 self-start rounded-lg bg-stone-700 px-5 text-base font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Marcar como resuelta"}
      </button>
    </form>
  );
}
