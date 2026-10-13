import { EstadoVacioTablero } from "@/features/tablero/components/EstadoVacioTablero";
import { FilaOrden } from "@/features/tablero/components/FilaOrden";
import { ResumenMetricas } from "@/features/tablero/components/ResumenMetricas";
import type { OrdenEnTablero, ResumenTablero } from "@/features/tablero/types";

type Props = {
  ordenes: OrdenEnTablero[];
  resumen: ResumenTablero;
};

export function TableroOrdenes({ ordenes, resumen }: Props) {
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

      {ordenes.length === 0 ? (
        <EstadoVacioTablero />
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
