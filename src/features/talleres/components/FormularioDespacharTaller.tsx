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
 * Mientras no exista el login (HU-16), quien despacha se escoge de una lista;
 * `avance_seccion` y `lote_taller` exigen un usuario de verdad, no un nombre
 * escrito a mano. Cuando llegue la sesión, ese campo desaparece.
 */

const ESTADO_INICIAL: EstadoFormularioDespacho = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_VACIA,
};

type Props = {
  ordenId: string;
  /** Personal de logística, que es quien puede despachar. */
  personal: { id: string; nombre: string }[];
};

export function FormularioDespacharTaller({ ordenId, personal }: Props) {
  const [estado, enviar, enviando] = useActionState(
    despacharLote,
    ESTADO_INICIAL,
  );

  const errorDePersona = estado.errores.enviadoPor?.[0];

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

      <div className="flex flex-col gap-1">
        <label
          htmlFor="enviadoPor"
          className="text-base font-medium text-zinc-900"
        >
          ¿Quién hace el despacho?
        </label>

        <p id="enviadoPor-ayuda" className="text-sm text-zinc-600">
          Mientras no exista el ingreso con usuario, escoge quién lo registra
        </p>

        <select
          id="enviadoPor"
          name="enviadoPor"
          defaultValue={estado.valores.enviadoPor}
          aria-invalid={Boolean(errorDePersona)}
          aria-describedby={
            errorDePersona
              ? "enviadoPor-ayuda enviadoPor-error"
              : "enviadoPor-ayuda"
          }
          className={[
            "min-h-12 rounded-lg border bg-white px-3 text-base text-zinc-900",
            "focus:ring-2 focus:ring-stone-500 focus:outline-none",
            errorDePersona ? "border-red-600" : "border-zinc-300",
          ].join(" ")}
        >
          <option value="">Escoge una persona</option>
          {personal.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </select>

        {errorDePersona ? (
          <p
            id="enviadoPor-error"
            role="alert"
            className="text-sm font-medium text-red-700"
          >
            {errorDePersona}
          </p>
        ) : null}
      </div>

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
