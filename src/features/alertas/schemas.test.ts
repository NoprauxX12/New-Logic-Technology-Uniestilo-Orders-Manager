import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  atenderAlertaSchema,
  avisarFaltaDeTelaSchema,
} from "@/features/alertas/schemas";

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f2";

const AVISO_VALIDO = {
  ordenId: ORDEN_ID,
  detalle: "Faltan 40 metros de tela impermeable azul",
};

type ErroresPorCampo = Record<string, string[] | undefined>;

function erroresDe(entrada: unknown): ErroresPorCampo {
  const resultado = avisarFaltaDeTelaSchema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors as ErroresPorCampo;
}

describe("avisarFaltaDeTelaSchema", () => {
  it("acepta un aviso con la orden y el detalle", () => {
    expect(avisarFaltaDeTelaSchema.safeParse(AVISO_VALIDO).success).toBe(true);
  });

  it("pide el detalle de qué tela falta", () => {
    expect(erroresDe({ ...AVISO_VALIDO, detalle: "" }).detalle).toContain(
      "Escribe qué tela falta y cuánta",
    );
  });

  it("un detalle de puros espacios cuenta como vacío", () => {
    expect(erroresDe({ ...AVISO_VALIDO, detalle: "   " }).detalle).toContain(
      "Escribe qué tela falta y cuánta",
    );
  });

  it("quita los espacios sobrantes del detalle", () => {
    const resultado = avisarFaltaDeTelaSchema.safeParse({
      ...AVISO_VALIDO,
      detalle: "  Faltan 40 metros  ",
    });

    expect(resultado.success && resultado.data.detalle).toBe(
      "Faltan 40 metros",
    );
  });

  it("no acepta un detalle de más de 1000 caracteres", () => {
    expect(
      erroresDe({ ...AVISO_VALIDO, detalle: "a".repeat(1001) }).detalle,
    ).toContain("El detalle es muy largo");
  });

  it("rechaza una orden que no es un identificador válido", () => {
    expect(
      erroresDe({ ...AVISO_VALIDO, ordenId: "OC-5002" }).ordenId,
    ).toContain("No se sabe de qué orden es este aviso");
  });

  it("ignora un destinatario o un remitente que lleguen en el formulario", () => {
    const resultado = avisarFaltaDeTelaSchema.safeParse({
      ...AVISO_VALIDO,
      destinatarioId: "00000000-0000-0000-0000-0000000000a2",
      creadaPor: "00000000-0000-0000-0000-0000000000a1",
    });

    expect(resultado.success).toBe(true);
    expect(resultado.success && Object.keys(resultado.data).sort()).toEqual([
      "detalle",
      "ordenId",
    ]);
  });
});

describe("atenderAlertaSchema (HU-07)", () => {
  it("acepta el id de la alerta y nada más", () => {
    const resultado = atenderAlertaSchema.safeParse({
      alertaId: "00000000-0000-0000-0000-0000000000b1",
      usuarioId: "00000000-0000-0000-0000-0000000000a1",
    });

    expect(resultado.success).toBe(true);
    expect(resultado.success && Object.keys(resultado.data)).toEqual([
      "alertaId",
    ]);
  });

  it("rechaza un id que no identifica una alerta", () => {
    const resultado = atenderAlertaSchema.safeParse({ alertaId: "la-alerta" });

    expect(resultado.success).toBe(false);
  });
});
