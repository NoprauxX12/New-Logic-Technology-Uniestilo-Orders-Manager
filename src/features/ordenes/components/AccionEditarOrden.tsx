import Link from "next/link";

import type { VeredictoEdicion } from "@/features/ordenes/edicion";

type Props = {
  ordenId: string;
  veredicto: VeredictoEdicion;
};

/** «Editar orden» si se puede; si no, el porqué. Solo para administración. */
export function AccionEditarOrden({ ordenId, veredicto }: Props) {
  if (!veredicto.permitido) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        {veredicto.mensaje}
      </p>
    );
  }

  return (
    <Link
      href={`/ordenes/${ordenId}/editar`}
      className="inline-flex min-h-12 items-center justify-center self-start rounded-lg border border-stone-400 px-4 text-base font-medium text-stone-800 hover:bg-stone-100"
    >
      Editar orden
    </Link>
  );
}
