import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import type { Rol } from "@/lib/auth/usuarioActual";

/**
 * HU-16 · A dónde manda el botón de cada rol al entrar.
 *
 * Diseño (HU-04) todavía no tiene pantalla propia: su historia es de otro
 * sprint. Mientras tanto ve un aviso. No se le manda al tablero porque con
 * HU-17 el tablero es solo de administración.
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
      { etiqueta: "Crear cuentas", ruta: "/usuarios" },
    ],
    aviso: null,
  },
  secretaria: {
    botones: [{ etiqueta: "Cerrar órdenes", ruta: "/ordenes/cierre" }],
    aviso: null,
  },
  diseno: {
    botones: [],
    aviso:
      "Tu pantalla para adjuntar la ficha técnica todavía no existe. Cuando esté lista, aparecerá aquí.",
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
    botones: [
      { etiqueta: "Despachar y recibir lotes", ruta: "/ordenes/talleres" },
    ],
    aviso: null,
  },
  marcacion: {
    botones: [
      {
        etiqueta: `Marcar ${buscarCheckpoint("llegada_marcacion").etiqueta.toLowerCase()}`,
        ruta: "/ordenes/marcacion",
      },
      {
        // HU-19 la marca marcación de forma provisional (ver pendientes).
        etiqueta: `Marcar ${buscarCheckpoint("lista_despacho").etiqueta.toLowerCase()}`,
        ruta: "/ordenes/despacho",
      },
    ],
    aviso: null,
  },
};

/** La vista de inicio de una persona, según su rol. */
export function vistaDeRol(rol: Rol): VistaDeRol {
  return VISTAS[rol];
}
