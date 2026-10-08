import {
  FilaOrdenCierre,
  type OrdenEnCierre,
} from "@/features/documentos/components/FilaOrdenCierre";

/**
 * HU-13 · Las órdenes listas para despachar, con lo que falta para cerrarlas.
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

  return (
    <ul className="flex flex-col gap-4">
      {ordenes.map((orden) => (
        <FilaOrdenCierre key={orden.id} orden={orden} />
      ))}
    </ul>
  );
}
