"use client";

import { useActionState } from "react";

import {
  atenderAvisoDeEntrega,
  type EstadoAtencionAlerta,
} from "@/features/alertas/actions";

/**
 * HU-20 · El botón "Ya lo vi" de un aviso de entrega.
 *
 * Una sola acción. Quién lo marca sale de la sesión. Al marcarlo, el aviso sale
 * de la lista, así que aquí solo se pinta el error.
 */

const ESTADO_INICIAL: EstadoAtencionAlerta = { ok: false, mensaje: "" };

type Props = {
  alertaId: string;
};

export function BotonYaLoVi({ alertaId }: Props) {
  const [estado, enviar, enviando] = useActionState(
    atenderAvisoDeEntrega,
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
        className="min-h-12 self-start rounded-lg bg-stone-700 px-6 text-base font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Ya lo vi"}
      </button>
    </form>
  );
}
