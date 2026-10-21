import "server-only";

import { z } from "zod";

import {
  detallarOrden,
  pareceUuid,
  resumirOrden,
} from "@/features/asistente/formato";
import {
  filtrarOrdenes,
  filtrarPorEstado,
  FILTROS_ORDENES,
} from "@/lib/ordenes/filtros";
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
 *
 * Los esquemas son deliberadamente laxos (`z.string()` y no `z.uuid()`): el
 * proveedor valida los argumentos contra el JSON Schema antes de llamarnos y
 * un patrón estricto convierte un id que no sea RFC 4122 —como los del seed—
 * en un error 400 que tumba toda la respuesta. Lo que no cuadre se resuelve
 * aquí y se le explica al modelo en la salida.
 */

const MAX_RESULTADOS_BUSQUEDA = 5;
const MAX_RESULTADOS_LISTA = 15;

export function crearHerramientas(ahora = new Date()): Herramientas {
  return {
    buscarOrdenes: herramienta({
      description:
        "Busca órdenes por su número de orden de compra (por ejemplo OC-5003 o solo 5003) o por el nombre del cliente. Devuelve un resumen de cada coincidencia con su enlace.",
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
        "Devuelve el estado completo de una orden: en qué etapa va, quién marcó cada etapa y cuándo, qué falta y a quién le toca, lotes en taller, fecha de entrega y el enlace para consultarla. Recibe el número de orden de compra (OC-5003 o 5003), el nombre del cliente, o el ordenId que devolvió buscarOrdenes.",
      inputSchema: z.object({
        orden: z
          .string()
          .min(1)
          .describe(
            "Número de orden de compra, nombre del cliente u ordenId de la orden",
          ),
      }),
      execute: async ({ orden }) => {
        if (pareceUuid(orden)) {
          const detalle = await obtenerDetalleOrden(orden.trim());
          return detalle
            ? {
                encontrada: true,
                orden: detallarOrden(detalle, CHECKPOINTS_DISPONIBLES, ahora),
              }
            : { encontrada: false, nota: "No existe una orden con ese id." };
        }

        const coincidencias = filtrarOrdenes(
          await listarOrdenesTablero(),
          orden,
        );

        if (coincidencias.length === 0) {
          return {
            encontrada: false,
            nota: "No hay ninguna orden con ese número ni de ese cliente.",
          };
        }

        if (coincidencias.length > 1) {
          return {
            encontrada: false,
            nota: "Hay varias órdenes que coinciden; pregunta cuál quiere.",
            ordenes: coincidencias
              .slice(0, MAX_RESULTADOS_BUSQUEDA)
              .map((candidata) => resumirOrden(candidata, ahora)),
          };
        }

        const detalle = await obtenerDetalleOrden(coincidencias[0].id);
        return detalle
          ? {
              encontrada: true,
              orden: detallarOrden(detalle, CHECKPOINTS_DISPONIBLES, ahora),
            }
          : { encontrada: false, nota: "La orden ya no está disponible." };
      },
    }),

    resumenOrdenes: herramienta({
      description:
        "Cuenta y lista las órdenes según un filtro: todas, atrasadas, en riesgo de entrega, en producción, sin empezar o terminadas. Úsala para preguntas como cuántas órdenes hay, cuáles están atrasadas o cuáles se entregan pronto.",
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
