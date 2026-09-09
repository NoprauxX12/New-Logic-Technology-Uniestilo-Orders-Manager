"use client";

import { useActionState } from "react";

import {
  cerrarOrden,
  reportarFactura,
  reportarParteDelCierre,
  type ResultadoCierre,
} from "@/features/documentos/actions";
import { reportesPendientes } from "@/features/documentos/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";

/**
 * HU-13 · Una orden lista para despachar, con sus tres reportes y el cierre.
 *
 * Cada reporte es su propio formulario porque ocurren en momentos distintos, y
 * el botón de completar solo aparece cuando los tres están: desde la pantalla
 * no hay forma de intentar cerrar una orden a medias.
 */

export type OrdenEnCierre = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  numeroFactura: string | null;
  marcados: CheckpointId[];
};

type Props = {
  orden: OrdenEnCierre;
  /** Quién está reportando, escogido arriba en la pantalla. */
  usuarioId: string;
};

const ESTADO_INICIAL: ResultadoCierre = { ok: false, mensaje: "" };

const BOTON =
  "min-h-12 self-start rounded-lg border border-zinc-400 px-4 text-base font-medium text-zinc-900 hover:bg-zinc-100 disabled:text-zinc-500";

function formatearFecha(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function Aviso({ estado }: { estado: ResultadoCierre }) {
  if (!estado.mensaje) return null;

  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={
        estado.ok
          ? "text-sm font-medium text-emerald-800"
          : "text-sm font-medium text-red-700"
      }
    >
      {estado.mensaje}
    </p>
  );
}

function Reportado({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <li className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
      <p className="text-base font-medium text-emerald-900">{titulo}</p>
      <p className="text-sm text-emerald-800">{detalle ?? "Reportado"}</p>
    </li>
  );
}

export function FilaOrdenCierre({ orden, usuarioId }: Props) {
  const [estadoEtiquetas, enviarEtiquetas, enviandoEtiquetas] = useActionState(
    reportarParteDelCierre,
    ESTADO_INICIAL,
  );
  const [estadoDocumentos, enviarDocumentos, enviandoDocumentos] =
    useActionState(reportarParteDelCierre, ESTADO_INICIAL);
  const [estadoFactura, enviarFactura, enviandoFactura] = useActionState(
    reportarFactura,
    ESTADO_INICIAL,
  );
  const [estadoCierre, enviarCierre, enviandoCierre] = useActionState(
    cerrarOrden,
    ESTADO_INICIAL,
  );

  const sinPersona = usuarioId === "";
  const pendientes = reportesPendientes(orden.marcados);
  const listaParaCerrar = pendientes.length === 0;

  const tiene = (checkpoint: CheckpointId) =>
    orden.marcados.includes(checkpoint);

  return (
    <li className="rounded-lg border border-zinc-300 bg-white px-4 py-4">
      <header className="mb-3 space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900">
          Orden {orden.numeroOrdenCompra}
        </h2>
        <p className="text-base text-zinc-600">
          {orden.razonSocial} · entrega el {formatearFecha(orden.fechaEntrega)}
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {tiene("etiquetas") ? (
          <Reportado titulo="Etiquetas asignadas" />
        ) : (
          <li className="rounded-lg border border-zinc-200 px-4 py-3">
            <form action={enviarEtiquetas} className="flex flex-col gap-2">
              <input type="hidden" name="ordenId" value={orden.id} />
              <input type="hidden" name="usuarioId" value={usuarioId} />
              <input type="hidden" name="reporte" value="etiquetas" />
              <p className="text-base font-medium text-zinc-900">
                Etiquetas asignadas
              </p>
              <Aviso estado={estadoEtiquetas} />
              <button
                type="submit"
                disabled={enviandoEtiquetas || sinPersona}
                className={BOTON}
              >
                {enviandoEtiquetas ? "Guardando…" : "Reportar etiquetas"}
              </button>
            </form>
          </li>
        )}

        {tiene("documentos_despacho") ? (
          <Reportado titulo="Documentos de despacho generados" />
        ) : (
          <li className="rounded-lg border border-zinc-200 px-4 py-3">
            <form action={enviarDocumentos} className="flex flex-col gap-2">
              <input type="hidden" name="ordenId" value={orden.id} />
              <input type="hidden" name="usuarioId" value={usuarioId} />
              <input type="hidden" name="reporte" value="documentos_despacho" />
              <p className="text-base font-medium text-zinc-900">
                Documentos de despacho generados
              </p>
              <Aviso estado={estadoDocumentos} />
              <button
                type="submit"
                disabled={enviandoDocumentos || sinPersona}
                className={BOTON}
              >
                {enviandoDocumentos ? "Guardando…" : "Reportar documentos"}
              </button>
            </form>
          </li>
        )}

        {tiene("factura_generada") ? (
          <Reportado
            titulo="Factura generada"
            detalle={
              orden.numeroFactura
                ? `Factura ${orden.numeroFactura}`
                : "Factura reportada"
            }
          />
        ) : (
          <li className="rounded-lg border border-zinc-200 px-4 py-3">
            <form action={enviarFactura} className="flex flex-col gap-3">
              <input type="hidden" name="ordenId" value={orden.id} />
              <input type="hidden" name="usuarioId" value={usuarioId} />
              <p className="text-base font-medium text-zinc-900">
                Factura generada en el sistema externo
              </p>
              <Aviso estado={estadoFactura} />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`numeroFactura-${orden.id}`}
                  className="text-base font-medium text-zinc-900"
                >
                  Número de la factura
                </label>
                <p
                  id={`numeroFactura-${orden.id}-ayuda`}
                  className="text-sm text-zinc-600"
                >
                  El número con el que quedó en el sistema de facturación
                </p>
                <input
                  id={`numeroFactura-${orden.id}`}
                  name="numeroFactura"
                  type="text"
                  aria-describedby={`numeroFactura-${orden.id}-ayuda`}
                  className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={enviandoFactura || sinPersona}
                className={BOTON}
              >
                {enviandoFactura ? "Guardando…" : "Reportar factura"}
              </button>
            </form>
          </li>
        )}
      </ul>

      {listaParaCerrar ? (
        <form action={enviarCierre} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="ordenId" value={orden.id} />
          <input type="hidden" name="usuarioId" value={usuarioId} />
          <Aviso estado={estadoCierre} />
          <button
            type="submit"
            disabled={enviandoCierre || sinPersona}
            className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
          >
            {enviandoCierre ? "Guardando…" : "Dar la orden por completada"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-zinc-600">
          Faltan {pendientes.length} de 3 reportes para poder completarla.
        </p>
      )}
    </li>
  );
}
