"use client";

import { useActionState } from "react";

import {
  marcarLlegadaDeTela,
  type EstadoLlegadaTela,
} from "@/features/alertas/actions";

/**
 * HU-22 · El botón con el que secretaría marca que llegó la tela.
 *
 * Una sola acción (RNF-08) y ninguna pregunta: quién la recibió sale de la
 * sesión y la hora la pone la base. Al marcar con éxito, la tarjeta deja de
 * estar esperando tela y este botón desaparece; la confirmación que queda a la
 * vista es la fecha de llegada que pinta la lista. Por eso aquí solo se pinta
 * el error: un "listo" que se desmonta al instante no lo alcanzaría a leer
 * nadie.
 */

const ESTADO_INICIAL: EstadoLlegadaTela = { ok: false, mensaje: "" };

type Props = {
  ordenId: string;
};

export function BotonLlegadaTela({ ordenId }: Props) {
  const [estado, enviar, enviando] = useActionState(
    marcarLlegadaDeTela,
    ESTADO_INICIAL,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="ordenId" value={ordenId} />

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
        {enviando ? "Guardando…" : "Ya llegó la tela"}
      </button>
    </form>
  );
}
