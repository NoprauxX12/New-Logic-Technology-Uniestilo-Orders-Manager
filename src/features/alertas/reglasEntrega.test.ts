import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIAS_ALERTA_ENTREGA,
  debeAlertarEntrega,
  diasParaEntrega,
  frasePlazoEntrega,
  puedeAtenderAlertaDeEntrega,
} from "@/features/alertas/reglas";

/**
 * HU-20 · Las reglas puras de la alerta de entrega. La generación vive en la
 * base (pg_cron); aquí se prueba lo que la aplicación sabe de ella.
 */

describe("diasParaEntrega", () => {
  it("cuenta los días que faltan", () => {
    expect(diasParaEntrega("2026-10-23", "2026-10-20")).toBe(3);
    expect(diasParaEntrega("2026-10-20", "2026-10-20")).toBe(0);
  });

  it("es negativo cuando la entrega ya pasó", () => {
    expect(diasParaEntrega("2026-10-18", "2026-10-20")).toBe(-2);
  });

  it("no se descuadra al cruzar el fin de mes", () => {
    expect(diasParaEntrega("2026-11-01", "2026-10-30")).toBe(2);
  });
});

describe("debeAlertarEntrega", () => {
  it("avisa a 3 días", () => {
    expect(debeAlertarEntrega(3)).toBe(true);
  });

  it("no avisa a 4 días", () => {
    expect(debeAlertarEntrega(4)).toBe(false);
  });

  it("avisa de lo vencido", () => {
    expect(debeAlertarEntrega(-5)).toBe(true);
  });
});

describe("frasePlazoEntrega", () => {
  it.each([
    [3, "Entrega en 3 días"],
    [2, "Entrega en 2 días"],
    [1, "Entrega mañana"],
    [0, "Entrega hoy"],
    [-1, "Se venció hace 1 día"],
    [-2, "Se venció hace 2 días"],
  ])("con %i días dice «%s»", (dias, frase) => {
    expect(frasePlazoEntrega(dias)).toBe(frase);
  });
});

describe("puedeAtenderAlertaDeEntrega", () => {
  it("deja marcarla a su destinatario", () => {
    expect(
      puedeAtenderAlertaDeEntrega({ destinatarioId: "a", usuarioId: "a" })
        .permitido,
    ).toBe(true);
  });

  it("no deja marcar la de otra persona", () => {
    const veredicto = puedeAtenderAlertaDeEntrega({
      destinatarioId: "a",
      usuarioId: "b",
    });

    expect(veredicto.permitido).toBe(false);
  });
});

describe("DIAS_ALERTA_ENTREGA y la migración", () => {
  it("la función de la base usa los mismos días por defecto", () => {
    const carpeta = join(process.cwd(), "supabase", "migrations");
    const archivo = readdirSync(carpeta).find((nombre) =>
      nombre.endsWith("_alertas_proximidad_entrega.sql"),
    );

    if (!archivo) throw new Error("Falta la migración de HU-20");

    const sql = readFileSync(join(carpeta, archivo), "utf8");
    const porDefecto = sql.match(/p_dias\s+integer\s+default\s+(\d+)/i);

    expect(porDefecto?.[1]).toBe(String(DIAS_ALERTA_ENTREGA));
  });
});
