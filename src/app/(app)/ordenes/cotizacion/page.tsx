import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import { repartirPorCotizacion } from "@/features/workflow/cotizacion";
import { obtenerOrdenesParaSeccion } from "@/features/workflow/queries";

export const metadata: Metadata = {
  title: "Cotizaciones · Uniestilo",
};

/**
 * HU-02 · Pantalla de cotización. Solo enruta: la lista y la action son las
 * genéricas del motor. Cada orden muestra únicamente el paso que le toca:
 * primero marcar la cotización enviada y, cuando el cliente responde, marcarla
 * aprobada. No se adjunta nada.
 */
export default async function CotizacionesPage() {
  const usuario = await exigirAcceso("/ordenes/cotizacion");

  const [enviadas, aprobadas] = await Promise.all([
    obtenerOrdenesParaSeccion("cotizacion_enviada", usuario.rol),
    obtenerOrdenesParaSeccion("cotizacion_aprobada", usuario.rol),
  ]);

  const { porEnviar, porAprobar } = repartirPorCotizacion(enviadas, aprobadas);
  const hayAlgo = porEnviar.length > 0 || porAprobar.length > 0;

  return (
    <div className="flex-1 bg-zinc-50">
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-zinc-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Cotizaciones
          </h1>
          <p className="text-base text-zinc-600">
            Marca cuando envías la cotización y cuando el cliente la aprueba.
          </p>
        </header>

        {hayAlgo ? null : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="font-medium text-zinc-900">
              No hay cotizaciones pendientes
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Cuando se registre una orden nueva, aparecerá aquí.
            </p>
          </div>
        )}

        {porEnviar.length > 0 ? (
          <section className="mb-10" aria-labelledby="por-enviar">
            <h2
              id="por-enviar"
              className="mb-4 text-lg font-semibold text-zinc-900"
            >
              Por enviar
            </h2>
            <ListaOrdenesSeccion
              ordenes={porEnviar}
              checkpoint="cotizacion_enviada"
            />
          </section>
        ) : null}

        {porAprobar.length > 0 ? (
          <section aria-labelledby="por-aprobar">
            <h2
              id="por-aprobar"
              className="mb-4 text-lg font-semibold text-zinc-900"
            >
              Esperando que el cliente la apruebe
            </h2>
            <ListaOrdenesSeccion
              ordenes={porAprobar}
              checkpoint="cotizacion_aprobada"
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
