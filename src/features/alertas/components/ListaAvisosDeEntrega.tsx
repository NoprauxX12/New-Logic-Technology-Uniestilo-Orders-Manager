import { BotonYaLoVi } from "@/features/alertas/components/BotonYaLoVi";
import type { AvisoDeEntrega } from "@/features/alertas/queries";
import { frasePlazoEntrega } from "@/features/alertas/reglas";
import { diasHasta } from "@/lib/ordenes/reglas";

/**
 * HU-20 · Bloque "Avisos": las entregas que se acercan, con un botón grande
 * para marcar cada una como vista. Si no hay ninguna, no ocupa espacio.
 *
 * El plazo ("Entrega hoy", "Se venció hace 2 días") se calcula al mirar. El
 * `detalle` guardado en la alerta no se muestra: quedó escrito el día que se
 * generó ("entrega en 3 días") y hoy podría decir otra cosa.
 */

type Props = {
  avisos: readonly AvisoDeEntrega[];
  /** El momento desde el que se cuenta el plazo; por defecto, ahora. */
  ahora?: Date;
};

export function ListaAvisosDeEntrega({ avisos, ahora }: Props) {
  if (avisos.length === 0) return null;

  return (
    <section
      aria-label="Avisos"
      className="flex w-full max-w-xl flex-col gap-3 text-left"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Avisos</h2>
      <ul className="flex flex-col gap-3">
        {avisos.map((aviso) => {
          const dias = diasHasta(aviso.fechaEntrega, ahora);
          const urgente = dias <= 0;

          return (
            <li
              key={aviso.id}
              className={`flex flex-col gap-3 rounded-xl border p-4 ${
                urgente
                  ? "border-red-300 bg-red-50"
                  : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="space-y-1">
                <p
                  className={`text-base font-semibold ${
                    urgente ? "text-red-900" : "text-amber-950"
                  }`}
                >
                  {frasePlazoEntrega(dias)} · {aviso.numeroOrdenCompra}
                </p>
                <p className="text-sm text-zinc-700">{aviso.razonSocial}</p>
              </div>
              <BotonYaLoVi alertaId={aviso.id} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
