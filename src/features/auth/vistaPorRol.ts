import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import type { Rol } from "@/lib/auth/usuarioActual";

/**
 * HU-16 · A dónde manda el botón de cada rol al entrar.
 *
 * Las etiquetas de las etapas salen de `checkpoints.ts` y no se repiten a
 * mano (regla 4): son el mismo texto que ya usa `AccionMarcarAvance`.
 * El tablero es solo de administración (HU-17).
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
    botones: [
      { etiqueta: "Cerrar órdenes", ruta: "/ordenes/cierre" },
      // HU-06: avisar a administración que falta tela.
      { etiqueta: "Validar telas", ruta: "/ordenes/telas" },
    ],
    aviso: null,
  },
  diseno: {
    botones: [
      {
        etiqueta: "Adjuntar ficha técnica",
        ruta: "/ordenes/diseno",
      },
    ],
    aviso: null,
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
      // En el orden del flujo: lo cortado se recoge y borda (HU-09) antes de
      // despacharlo a un taller (HU-10).
      {
        etiqueta: `Marcar ${buscarCheckpoint("recogido_bordado").etiqueta.toLowerCase()}`,
        ruta: "/ordenes/recogido-bordado",
      },
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
