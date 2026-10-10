import "server-only";

import { z } from "zod";

import {
  detallarOrden,
  filtrarOrdenes,
  filtrarPorEstado,
  FILTROS_ORDENES,
  resumirOrden,
} from "@/features/asistente/formato";
import { CHECKPOINTS_DISPONIBLES } from "@/features/workflow/checkpoints";
import { herramienta, type Herramientas } from "@/lib/ai";
import {
  listarOrdenesTablero,
  obtenerDetalleOrden,
  obtenerResumenTablero,
} from "@/lib/ordenes/estadoOrden";

/**
 * HU-15 · Lo único que el modelo puede hacer con los datos: tres consultas de
 * solo lectura, con su entrada validada por zod. No existe ninguna herramienta
 * que escriba, así que "la IA solo informa" (regla 10) se cumple por
 * construcción y no por confianza en el modelo.
 *
 * Leen con el cliente de Supabase de la sesión de quien pregunta, así que las
 * políticas RLS aplican igual que en el tablero (RNF-04).
 */

const MAX_RESULTADOS_BUSQUEDA = 5;
const MAX_RESULTADOS_LISTA = 15;

export function crearHerramientas(ahora = new Date()): Herramientas {
  return {
    buscarOrdenes: herramienta({
      description:
        "Busca órdenes por su número de orden de compra (por ejemplo OC-5003 o solo 5003) o por el nombre del cliente. Úsala primero cuando la persona nombre una orden o un cliente; devuelve el ordenId que necesita estadoDeOrden.",
      inputSchema: z.object({
        texto: z
          .string()
          .min(1)
          .describe("Número de la orden o parte del nombre del cliente"),
      }),
      execute: async ({ texto }) => {
        const coincidencias = filtrarOrdenes(
          await listarOrdenesTablero(),
          texto,
        );
        return {
          encontradas: coincidencias.length,
          ordenes: coincidencias
            .slice(0, MAX_RESULTADOS_BUSQUEDA)
            .map((orden) => resumirOrden(orden, ahora)),
          ...(coincidencias.length === 0
            ? { nota: "No hay ninguna orden que coincida con ese texto." }
            : {}),
        };
      },
    }),

    estadoDeOrden: herramienta({
      description:
        "Devuelve el estado completo de una orden: en qué etapa va, quién marcó cada etapa y cuándo, qué falta y a quién le toca, lotes en taller y fecha de entrega. Necesita el ordenId que devuelve buscarOrdenes.",
      inputSchema: z.object({
        ordenId: z.uuid().describe("El id de la orden (uuid)"),
      }),
      execute: async ({ ordenId }) => {
        const detalle = await obtenerDetalleOrden(ordenId);
        if (!detalle) {
          return { encontrada: false, nota: "No existe una orden con ese id." };
        }
        return {
          encontrada: true,
          orden: detallarOrden(detalle, CHECKPOINTS_DISPONIBLES, ahora),
        };
      },
    }),

    resumenOrdenes: herramienta({
      description:
        "Cuenta y lista las órdenes según un filtro: todas, atrasadas, en riesgo de entrega, en producción, sin empezar o terminadas. Úsala para preguntas como cuántas órdenes hay o cuáles están atrasadas.",
      inputSchema: z.object({
        filtro: z.enum(FILTROS_ORDENES).default("todas"),
      }),
      execute: async ({ filtro }) => {
        const ordenes = await listarOrdenesTablero();
        const filtradas = filtrarPorEstado(ordenes, filtro);
        return {
          filtro,
          totales: await obtenerResumenTablero(ordenes),
          cantidad: filtradas.length,
          ordenes: filtradas
            .slice(0, MAX_RESULTADOS_LISTA)
            .map((orden) => resumirOrden(orden, ahora)),
          ...(filtradas.length > MAX_RESULTADOS_LISTA
            ? {
                nota: `Se muestran ${MAX_RESULTADOS_LISTA} de ${filtradas.length}.`,
              }
            : {}),
        };
      },
    }),
  };
}
