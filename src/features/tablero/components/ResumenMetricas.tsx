import type { ResumenTablero } from "@/features/tablero/types";

const TARJETAS: {
  clave: keyof ResumenTablero;
  etiqueta: string;
  resaltar?: "atrasada" | "riesgo";
}[] = [
  { clave: "totalOrdenes", etiqueta: "Total órdenes" },
  { clave: "enProduccion", etiqueta: "En producción" },
  { clave: "atrasadas", etiqueta: "Atrasadas", resaltar: "atrasada" },
  { clave: "enRiesgo", etiqueta: "En riesgo", resaltar: "riesgo" },
];

export function ResumenMetricas({ resumen }: { resumen: ResumenTablero }) {
  return (
    <section
      aria-label="Resumen del tablero"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {TARJETAS.map(({ clave, etiqueta, resaltar }) => (
        <div
          key={clave}
          className={[
            "rounded-xl border border-zinc-200 bg-white px-4 py-3",
            resaltar === "atrasada" && resumen.atrasadas > 0
              ? "border-rose-200 bg-rose-50"
              : "",
            resaltar === "riesgo" && resumen.enRiesgo > 0
              ? "border-amber-200 bg-amber-50"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {etiqueta}
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 tabular-nums">
            {resumen[clave]}
          </p>
        </div>
      ))}
    </section>
  );
}
