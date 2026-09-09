"use client";

import { useState } from "react";

import {
  FilaOrdenCierre,
  type OrdenEnCierre,
} from "@/features/documentos/components/FilaOrdenCierre";

/**
 * HU-13 · Las órdenes listas para despachar, con lo que falta para cerrarlas.
 *
 * Quién reporta se escoge una sola vez arriba y vale para toda la pantalla:
 * `avance_seccion.usuario_id` es obligatorio y todavía no hay login (HU-16),
 * así que pedirlo en cada botón sería insoportable. Cuando llegue la sesión,
 * este selector desaparece.
 */

type Props = {
  ordenes: OrdenEnCierre[];
  /** Personal de secretaría, que es quien cierra. */
  personal: { id: string; nombre: string }[];
};

export function ListaOrdenesCierre({ ordenes, personal }: Props) {
  const [usuarioId, setUsuarioId] = useState("");

  if (ordenes.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-300 bg-white px-4 py-6 text-base text-zinc-600">
        No hay órdenes listas para despachar en este momento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="usuarioId"
          className="text-base font-medium text-zinc-900"
        >
          ¿Quién está reportando?
        </label>

        <p id="usuarioId-ayuda" className="text-sm text-zinc-600">
          Mientras no exista el ingreso con usuario, escoge tu nombre para que
          quede el registro
        </p>

        <select
          id="usuarioId"
          value={usuarioId}
          onChange={(evento) => setUsuarioId(evento.target.value)}
          aria-describedby="usuarioId-ayuda"
          className="min-h-12 max-w-sm rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
        >
          <option value="">Escoge una persona</option>
          {personal.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </select>
      </div>

      <ul className="flex flex-col gap-4">
        {ordenes.map((orden) => (
          <FilaOrdenCierre key={orden.id} orden={orden} usuarioId={usuarioId} />
        ))}
      </ul>
    </div>
  );
}
