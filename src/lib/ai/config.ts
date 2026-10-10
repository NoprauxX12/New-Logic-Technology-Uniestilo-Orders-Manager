import { z } from "zod";

/**
 * HU-15 · Configuración del asistente, leída de las variables de entorno.
 *
 * Se valida al usarla y no al cargar el módulo: así el build en CI y en Vercel
 * no exige la llave, y si falta, la aplicación sigue en pie y el panel dice que
 * el asistente no está configurado. Todas son solo de servidor: ninguna va con
 * `NEXT_PUBLIC_`.
 *
 * Pura: recibe el objeto de variables para poder probarse sin tocar
 * `process.env`.
 */

export const PROVEEDORES = ["groq"] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

export type ConfigIA = {
  proveedor: Proveedor;
  apiKey: string;
  modelo: string;
  /** Cuántos mensajes previos de la conversación se mandan al modelo. */
  maxMensajesContexto: number;
  maxTokensRespuesta: number;
  temperatura: number;
  /** Cuántas consultas puede encadenar el modelo antes de responder. */
  maxPasosHerramientas: number;
  tiempoMaximoMs: number;
};

const entero = (minimo: number, maximo: number) =>
  z.coerce.number().int().min(minimo).max(maximo);

const schema = z.object({
  IA_PROVEEDOR: z.enum(PROVEEDORES).default("groq"),
  IA_API_KEY: z.string().trim().min(1),
  IA_MODELO: z.string().trim().min(1).default("llama-3.3-70b-versatile"),
  IA_MAX_MENSAJES_CONTEXTO: entero(1, 200).default(20),
  IA_MAX_TOKENS_RESPUESTA: entero(50, 8000).default(600),
  IA_TEMPERATURA: z.coerce.number().min(0).max(2).default(0.2),
  IA_MAX_PASOS_HERRAMIENTAS: entero(1, 10).default(4),
  IA_TIEMPO_MAXIMO_MS: entero(1000, 120_000).default(20_000),
});

export type ResultadoConfigIA =
  { ok: true; config: ConfigIA } | { ok: false; motivo: string };

/** Una variable vacía (`IA_MODELO=`) cuenta como no definida: toma el defecto. */
function sinVacias(variables: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(variables).filter(
      ([clave, valor]) =>
        clave.startsWith("IA_") && valor !== undefined && valor !== "",
    ),
  );
}

export function leerConfigIA(
  variables: Record<string, string | undefined> = process.env,
): ResultadoConfigIA {
  const resultado = schema.safeParse(sinVacias(variables));

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return { ok: false, motivo: `Variables de IA inválidas → ${problemas}` };
  }

  const v = resultado.data;
  return {
    ok: true,
    config: {
      proveedor: v.IA_PROVEEDOR,
      apiKey: v.IA_API_KEY,
      modelo: v.IA_MODELO,
      maxMensajesContexto: v.IA_MAX_MENSAJES_CONTEXTO,
      maxTokensRespuesta: v.IA_MAX_TOKENS_RESPUESTA,
      temperatura: v.IA_TEMPERATURA,
      maxPasosHerramientas: v.IA_MAX_PASOS_HERRAMIENTAS,
      tiempoMaximoMs: v.IA_TIEMPO_MAXIMO_MS,
    },
  };
}
