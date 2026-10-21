import Link from "next/link";
import type { ReactNode } from "react";

import { EstadoVacioTablero } from "@/features/tablero/components/EstadoVacioTablero";
import { FilaOrden } from "@/features/tablero/components/FilaOrden";
import { FiltrosTableroBarra } from "@/features/tablero/components/FiltrosTableroBarra";
import { ResumenMetricas } from "@/features/tablero/components/ResumenMetricas";
import {
  hayFiltros,
  type ConteosTablero,
  type FiltrosTablero,
} from "@/lib/ordenes/filtros";
import type { OrdenEnTablero, ResumenTablero } from "@/lib/ordenes/types";

type Props = {
  /** Las órdenes que quedan después de filtrar, ya en orden de urgencia. */
  ordenes: OrdenEnTablero[];
  /** Cuántas órdenes hay en total, sin filtro. */
  totalOrdenes: number;
  filtros: FiltrosTablero;
  conteos: ConteosTablero;
  resumen: ResumenTablero;
  /** HU-07: las alertas de tela pendientes, arriba de las órdenes. */
  avisos?: ReactNode;
};

export function TableroOrdenes({
  ordenes,
  totalOrdenes,
  filtros,
  conteos,
  resumen,
  avisos,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-stone-600">Uniestilo</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Tablero de producción
        </h1>
        <p className="text-sm text-zinc-600">
          Órdenes activas y avance por etapa. Una fila por orden; cada etapa
          completada o pendiente.
        </p>
      </header>

      {avisos}

      <ResumenMetricas resumen={resumen} />

      {resumen.atrasadas > 0 || resumen.enRiesgo > 0 ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {resumen.atrasadas > 0
            ? `${resumen.atrasadas} orden${resumen.atrasadas === 1 ? "" : "es"} atrasada${resumen.atrasadas === 1 ? "" : "s"}`
            : null}
          {resumen.atrasadas > 0 && resumen.enRiesgo > 0 ? " y " : null}
          {resumen.enRiesgo > 0 ? `${resumen.enRiesgo} en riesgo` : null}
          {" — revisar prioridad de producción."}
        </p>
      ) : null}

      {totalOrdenes > 0 ? (
        <FiltrosTableroBarra
          filtros={filtros}
          conteos={conteos}
          mostradas={ordenes.length}
          total={totalOrdenes}
        />
      ) : null}

      {totalOrdenes === 0 ? (
        <EstadoVacioTablero />
      ) : ordenes.length === 0 && hayFiltros(filtros) ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center"
        >
          <p className="text-lg font-medium text-zinc-800">
            Ninguna orden coincide
          </p>
          <p className="max-w-sm text-sm text-zinc-600">
            Prueba con otras palabras o quita los filtros para ver todas.
          </p>
          <Link
            href="/tablero"
            className="inline-flex min-h-11 items-center rounded-lg bg-stone-700 px-5 text-base font-medium text-white hover:bg-stone-800"
          >
            Quitar filtros
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {ordenes.map((orden) => (
            <li key={orden.id}>
              <FilaOrden orden={orden} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
