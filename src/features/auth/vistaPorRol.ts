import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import type { Rol } from "@/lib/auth/usuarioActual";

/**
 * HU-16 · A dónde manda el botón de cada rol al entrar.
 *
 * Diseño (HU-04) y logística (HU-09/HU-11) todavía no tienen pantalla propia:
 * sus historias son de otros sprints. Mientras tanto ven el tablero y un aviso,
 * para que la sesión no sea un callejón sin salida.
 *
 * Las etiquetas de corte y marcación salen de `checkpoints.ts` y no se repiten
 * a mano (regla 4): son el mismo texto que ya usa `AccionMarcarAvance`.
 */

export type BotonVista = {
  etiqueta: string;
  ruta: string;
};

export type VistaDeRol = {
  /** Qué puede hacer esta persona hoy. */
  botones: BotonVista[];
  /** Se muestra cuando el rol todavía no tiene una pantalla propia. */
  aviso: string | null;
};

const VISTAS: Record<Rol, VistaDeRol> = {
  admin: {
    botones: [
      { etiqueta: "Ver el tablero", ruta: "/tablero" },
      { etiqueta: "Registrar una orden", ruta: "/ordenes/nueva" },
    ],
    aviso: null,
  },
  secretaria: {
    botones: [{ etiqueta: "Cerrar órdenes", ruta: "/ordenes/cierre" }],
    aviso: null,
  },
  diseno: {
    botones: [{ etiqueta: "Ver el tablero", ruta: "/tablero" }],
    aviso: "Tu pantalla para adjuntar la ficha técnica todavía no existe.",
  },
  corte: {
    botones: [
      {
        etiqueta: `Marcar ${buscarCheckpoint("corte_completado").etiqueta.toLowerCase()}`,
        ruta: "/ordenes/corte",
      },
    ],
    aviso: null,
  },
  logistica: {
    botones: [{ etiqueta: "Ver el tablero", ruta: "/tablero" }],
    aviso:
      "Tu pantalla de recogido y bordado todavía no existe. Para despachar un lote a un taller, entra a una orden desde el tablero.",
  },
  marcacion: {
    botones: [
      {
        etiqueta: `Marcar ${buscarCheckpoint("llegada_marcacion").etiqueta.toLowerCase()}`,
        ruta: "/ordenes/marcacion",
      },
    ],
    aviso: null,
  },
};

/** La vista de inicio de una persona, según su rol. */
export function vistaDeRol(rol: Rol): VistaDeRol {
  return VISTAS[rol];
}
