import type { Metadata } from "next";

import { ListaOrdenesCierre } from "@/features/documentos/components/ListaOrdenesCierre";
import {
  listarOrdenesParaCierre,
  obtenerUsuariosDeSecretaria,
} from "@/features/documentos/queries";

export const metadata: Metadata = {
  title: "Cerrar órdenes · Uniestilo",
};

/**
 * HU-13 · Pantalla de cierre. Solo enruta: los datos los trae `queries.ts` y
 * las decisiones las toman las reglas de la feature.
 *
 * La lista solo muestra órdenes listas para despachar que todavía no se han
 * completado, así que una orden cerrada desaparece de aquí sola: es el criterio
 * de que sale del listado de órdenes en curso.
 */
export default async function CerrarOrdenesPage() {
  const [ordenes, personal] = await Promise.all([
    listarOrdenesParaCierre(),
    obtenerUsuariosDeSecretaria(),
  ]);

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Cerrar órdenes
          </h1>

          <p className="text-base text-zinc-600">
            Reporta las etiquetas, los documentos de despacho y la factura. Con
            las tres, la orden queda completada.
          </p>
        </header>

        <ListaOrdenesCierre ordenes={ordenes} personal={personal} />
      </main>
    </div>
  );
}
