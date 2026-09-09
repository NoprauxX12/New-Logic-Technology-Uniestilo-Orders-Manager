import type { SemaforoOrden } from "@/features/tablero/types";

const ETIQUETA: Record<SemaforoOrden, string> = {
  a_tiempo: "A tiempo",
  en_riesgo: "En riesgo",
  atrasada: "Atrasada",
};

const CLASE: Record<SemaforoOrden, string> = {
  a_tiempo: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  en_riesgo: "bg-amber-50 text-amber-900 ring-amber-200",
  atrasada: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function BadgeSemaforo({ semaforo }: { semaforo: SemaforoOrden }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CLASE[semaforo]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ETIQUETA[semaforo]}
    </span>
  );
}
