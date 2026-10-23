import {
  FilaOrdenCierre,
  type OrdenEnCierre,
} from "@/features/documentos/components/FilaOrdenCierre";
import { agruparOrdenesDeCierre } from "@/features/documentos/reglas";

/**
 * HU-13 · Las órdenes listas para despachar, con lo que falta para cerrarlas.
 *
 * Primero las que ya se pueden dar por completadas (un clic), después las que
 * todavía tienen reportes por hacer, empezando por las más avanzadas.
 *
 * Quién reporta sale de la sesión (HU-16): aquí no se escoge a nadie. Por eso
 * este componente ya no necesita estado y puede ser un Server Component.
 */

type Props = {
  ordenes: OrdenEnCierre[];
};

export function ListaOrdenesCierre({ ordenes }: Props) {
  if (ordenes.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-300 bg-white px-4 py-6 text-base text-zinc-600">
        No hay órdenes listas para despachar en este momento.
      </p>
    );
  }

  const { listas, faltanReportes } = agruparOrdenesDeCierre(ordenes);

  return (
    <div className="flex flex-col gap-8">
      {listas.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Listas para dar por completadas{" "}
            <span className="font-normal text-zinc-500">({listas.length})</span>
          </h2>
          <ul className="flex flex-col gap-4">
            {listas.map((orden) => (
              <FilaOrdenCierre key={orden.id} orden={orden} />
            ))}
          </ul>
        </section>
      ) : null}

      {faltanReportes.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Faltan reportes{" "}
            <span className="font-normal text-zinc-500">
              ({faltanReportes.length})
            </span>
          </h2>
          <ul className="flex flex-col gap-4">
            {faltanReportes.map((orden) => (
              <FilaOrdenCierre key={orden.id} orden={orden} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
