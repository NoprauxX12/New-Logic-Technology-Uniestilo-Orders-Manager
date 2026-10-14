import { z } from "zod";

/**
 * HU-06 · Validación del aviso de falta de tela.
 *
 * Lo usan el formulario y la server action. El detalle es lo que la historia
 * pide además del número de orden: qué tela falta y cuánta, para que
 * administración pueda hacer el pedido sin tener que preguntar.
 *
 * No pide quién avisa ni a quién: lo primero sale de la sesión (HU-16) y lo
 * segundo lo decide el sistema. Un campo así lo podría cambiar cualquiera.
 */
export const avisarFaltaDeTelaSchema = z.object({
  // `guid` y no `uuid`: los identificadores del seed son legibles a propósito
  // (`…-0000000000f2`) y no cumplen la versión de la RFC 4122.
  ordenId: z.guid({ error: "No se sabe de qué orden es este aviso" }),

  detalle: z
    .string()
    .trim()
    .min(1, "Escribe qué tela falta y cuánta")
    .max(1000, "El detalle es muy largo"),
});

/** Datos ya validados y sin espacios sobrantes. */
export type AvisoFaltaDeTela = z.infer<typeof avisarFaltaDeTelaSchema>;

/**
 * HU-22 · Marcar que llegó la tela. Solo viaja la orden: quién la recibió sale
 * de la sesión y la hora la pone la base.
 */
export const marcarLlegadaDeTelaSchema = z.object({
  ordenId: z.guid({ error: "No se sabe de qué orden llegó la tela" }),
});
