"use client";

import { useActionState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import {
  despacharLote,
  type EstadoFormularioDespacho,
} from "@/features/talleres/actions";
import { ENTRADA_VACIA } from "@/features/talleres/formulario";

/**
 * HU-10 · Formulario de despacho de un lote a un taller satélite.
 *
 * Es un componente de cliente porque necesita el estado que devuelve la action
 * para pintar los errores. Una sola acción en la pantalla (RNF-08): quien está
 * en logística abre la orden, escribe el taller y despacha.
 *
 * No pregunta quién despacha: lo sabe la action por la sesión (HU-16).
 */

const ESTADO_INICIAL: EstadoFormularioDespacho = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_VACIA,
};

type Props = {
  ordenId: string;
};

export function FormularioDespacharTaller({ ordenId }: Props) {
  const [estado, enviar, enviando] = useActionState(
    despacharLote,
    ESTADO_INICIAL,
  );

  return (
    <form action={enviar} className="flex flex-col gap-6">
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

      <CampoTexto
        nombre="taller"
        etiqueta="¿A qué taller se envió?"
        ayuda="El nombre con el que ustedes lo conocen"
        marcador="Taller Marinilla Centro"
        errores={estado.errores.taller}
        valorInicial={estado.valores.taller}
      />

      <CampoTexto
        nombre="descripcionPrendas"
        etiqueta="¿Qué prendas se enviaron?"
        ayuda="Por ejemplo: 250 polos verdes talla S y M"
        errores={estado.errores.descripcionPrendas}
        valorInicial={estado.valores.descripcionPrendas}
      />

      <button
        type="submit"
        disabled={enviando}
        className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Marcar como despachado"}
      </button>
    </form>
  );
}
