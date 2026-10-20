"use client";

import { useActionState, useState } from "react";

import { programarTela } from "@/features/ordenes/telaActions";
import type { OrdenParaTela } from "@/features/ordenes/telaQueries";

type Props = {
  orden: OrdenParaTela;
};

export function FormularioProgramarTela({ orden }: Props) {
  const [abierto, setAbierto] = useState(false);

  const [campos, setCampos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      orden.items.flatMap((item) => [
        [`${item.id}.tipoTela`, item.tipo_tela ?? ""],
        [`${item.id}.cantidadTela`, item.cantidad_tela?.toString() ?? ""],
        [`${item.id}.unidadTela`, item.unidad_tela ?? ""],
        [`${item.id}.observacionesTela`, item.observaciones_tela ?? ""],
      ]),
    ),
  );

  const [estado, accion, pendiente] = useActionState(programarTela, {
    ok: false,
    mensaje: "",
  });

  function actualizarCampo(nombre: string, valor: string) {
    setCampos((anteriores) => ({
      ...anteriores,
      [nombre]: valor,
    }));
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xl font-semibold">{orden.numeroOrdenCompra}</h2>

      <p className="mt-1 text-zinc-600">{orden.razonSocial}</p>

      {estado.mensaje ? (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`mt-4 rounded-lg p-3 ${
            estado.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {estado.mensaje}
        </p>
      ) : null}

      {!abierto && !estado.ok ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-4 min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800"
        >
          Ver ítems y programar tela
        </button>
      ) : null}

      {abierto && !estado.ok ? (
        <form
          action={accion}
          onReset={(evento) => evento.preventDefault()}
          className="mt-5 space-y-5"
        >
          <input type="hidden" name="ordenId" value={orden.id} />

          <p className="text-sm text-zinc-600">
            Consulta la ficha técnica y registra la cantidad total de tela
            necesaria para cada ítem, no por prenda individual.
          </p>

          {orden.items.map((item) => (
            <fieldset
              key={item.id}
              disabled={pendiente}
              className="min-w-0 rounded-lg border border-zinc-200 p-4"
            >
              <legend className="px-2 font-semibold">{item.descripcion}</legend>

              <input type="hidden" name="itemId" value={item.id} />

              <p className="mb-4 text-sm text-zinc-600">
                Prendas: {item.cantidad} · Tallas: {item.tallas}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="font-medium">Tipo de tela</span>

                  <input
                    name={`${item.id}.tipoTela`}
                    value={campos[`${item.id}.tipoTela`] ?? ""}
                    onChange={(evento) =>
                      actualizarCampo(
                        `${item.id}.tipoTela`,
                        evento.target.value,
                      )
                    }
                    required
                    maxLength={200}
                    className="min-h-12 w-full rounded-lg border border-zinc-400 px-3"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="font-medium">Cantidad total de tela</span>

                  <input
                    name={`${item.id}.cantidadTela`}
                    value={campos[`${item.id}.cantidadTela`] ?? ""}
                    onChange={(evento) =>
                      actualizarCampo(
                        `${item.id}.cantidadTela`,
                        evento.target.value,
                      )
                    }
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="Ejemplo: 12,5"
                    className="min-h-12 w-full rounded-lg border border-zinc-400 px-3"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="font-medium">Unidad</span>

                  <select
                    name={`${item.id}.unidadTela`}
                    value={campos[`${item.id}.unidadTela`] ?? ""}
                    onChange={(evento) =>
                      actualizarCampo(
                        `${item.id}.unidadTela`,
                        evento.target.value,
                      )
                    }
                    required
                    className="min-h-12 w-full rounded-lg border border-zinc-400 bg-white px-3"
                  >
                    <option value="">Selecciona una unidad</option>
                    <option value="metros">Metros</option>
                    <option value="kilos">Kilos</option>
                  </select>
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="font-medium">
                    Observaciones de tela (opcional)
                  </span>

                  <textarea
                    name={`${item.id}.observacionesTela`}
                    value={campos[`${item.id}.observacionesTela`] ?? ""}
                    onChange={(evento) =>
                      actualizarCampo(
                        `${item.id}.observacionesTela`,
                        evento.target.value,
                      )
                    }
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-400 px-3 py-2"
                  />
                </label>
              </div>
            </fieldset>
          ))}

          <button
            type="submit"
            disabled={pendiente || orden.items.length === 0}
            className="min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendiente ? "Guardando…" : "Programar tela"}
          </button>
        </form>
      ) : null}
    </article>
  );
}
