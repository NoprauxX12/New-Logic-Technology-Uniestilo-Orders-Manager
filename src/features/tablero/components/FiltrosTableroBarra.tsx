"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  hayFiltros,
  type ConteosTablero,
  type Donde,
  type FiltroRapido,
  type FiltrosTablero,
} from "@/lib/ordenes/filtros";

const ETIQUETA_FILTRO: Record<FiltroRapido, string> = {
  atrasadas: "Atrasadas",
  en_riesgo: "En riesgo",
  esta_semana: "Entrega esta semana",
};

const ETIQUETA_DONDE: Record<Donde, string> = {
  corte: "Corte",
  bordado: "Bordado",
  taller: "En taller",
  marcacion: "Marcación",
};

const MS_ESPERA_BUSQUEDA = 300;

type Props = {
  filtros: FiltrosTablero;
  conteos: ConteosTablero;
  /** Órdenes que se ven con el filtro puesto. */
  mostradas: number;
  /** Órdenes que hay en total. */
  total: number;
};

function Chip({
  etiqueta,
  cuantas,
  activo,
  onClick,
}: {
  etiqueta: string;
  cuantas: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-medium",
        activo
          ? "border-stone-700 bg-stone-700 text-white"
          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100",
      ].join(" ")}
    >
      {etiqueta}
      <span
        className={[
          "rounded-full px-2 text-sm tabular-nums",
          activo ? "bg-white/20" : "bg-zinc-100 text-zinc-700",
        ].join(" ")}
      >
        {cuantas}
      </span>
    </button>
  );
}

/**
 * HU-14 · Búsqueda y botones rápidos del tablero. El estado vive en la URL
 * (`?q=&filtro=&donde=`) y el servidor es quien filtra: esto solo la escribe.
 */
export function FiltrosTableroBarra({
  filtros,
  conteos,
  mostradas,
  total,
}: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const [texto, setTexto] = useState(filtros.q);
  const [qAnterior, setQAnterior] = useState(filtros.q);

  // Si la URL cambia desde fuera (Limpiar, atrás del navegador), el cuadro la sigue.
  if (filtros.q !== qAnterior) {
    setQAnterior(filtros.q);
    setTexto(filtros.q);
  }

  function ir(siguiente: FiltrosTablero) {
    const params = new URLSearchParams();
    if (siguiente.q.trim()) params.set("q", siguiente.q.trim());
    if (siguiente.filtro) params.set("filtro", siguiente.filtro);
    if (siguiente.donde) params.set("donde", siguiente.donde);
    const consulta = params.toString();
    router.replace(consulta ? `${ruta}?${consulta}` : ruta, { scroll: false });
  }

  // Espera a que la persona deje de escribir para no pedir datos en cada letra.
  useEffect(() => {
    if (texto.trim() === filtros.q) return;
    const espera = setTimeout(() => {
      ir({ ...filtros, q: texto });
    }, MS_ESPERA_BUSQUEDA);
    return () => clearTimeout(espera);
    // `ir` solo depende de `ruta` y `router`, estables entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, filtros]);

  const activos = hayFiltros(filtros);

  return (
    <section aria-label="Filtrar órdenes" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por código o cliente"
          aria-label="Buscar por código o cliente"
          className="min-h-11 w-full flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 sm:max-w-md"
        />
        {activos ? (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              router.replace(ruta, { scroll: false });
            }}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-400 px-4 text-base font-medium text-stone-800 hover:bg-stone-100"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Filtros rápidos"
        className="flex flex-wrap gap-2"
      >
        {(Object.keys(ETIQUETA_FILTRO) as FiltroRapido[]).map((clave) => (
          <Chip
            key={clave}
            etiqueta={ETIQUETA_FILTRO[clave]}
            cuantas={conteos.filtro[clave]}
            activo={filtros.filtro === clave}
            onClick={() =>
              ir({
                ...filtros,
                filtro: filtros.filtro === clave ? null : clave,
              })
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">Dónde está:</span>
        <div
          role="group"
          aria-label="Dónde está"
          className="flex flex-wrap gap-2"
        >
          {(Object.keys(ETIQUETA_DONDE) as Donde[]).map((clave) => (
            <Chip
              key={clave}
              etiqueta={ETIQUETA_DONDE[clave]}
              cuantas={conteos.donde[clave]}
              activo={filtros.donde === clave}
              onClick={() =>
                ir({
                  ...filtros,
                  donde: filtros.donde === clave ? null : clave,
                })
              }
            />
          ))}
        </div>
      </div>

      {activos ? (
        <p role="status" className="text-sm text-zinc-600">
          {mostradas} de {total} {total === 1 ? "orden" : "órdenes"}
        </p>
      ) : null}
    </section>
  );
}
