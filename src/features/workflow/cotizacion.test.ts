import { describe, expect, it } from "vitest";

import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import { repartirPorCotizacion } from "@/features/workflow/cotizacion";
import type { OrdenParaSeccion } from "@/features/workflow/queries";
import {
  puedeMarcar,
  siguienteCheckpoint,
  type ResultadoMarcado,
} from "@/features/workflow/transiciones";

/**
 * HU-02 · La cotización se envía y después se aprueba, y las dos van antes de
 * programar a diseño. Primero el motor (la cabeza de la secuencia) y después
 * el reparto de la pantalla.
 */

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

describe("motor · cotización (HU-02)", () => {
  it("una orden nueva empieza por la cotización enviada", () => {
    expect(siguienteCheckpoint([])).toBe("cotizacion_enviada");
  });

  it("recorre enviada, aprobada y programada a diseño, en ese orden", () => {
    const marcados: CheckpointId[] = [];

    for (const checkpoint of [
      "cotizacion_enviada",
      "cotizacion_aprobada",
      "programada_diseno",
    ] as const) {
      expect(siguienteCheckpoint(marcados)).toBe(checkpoint);
      expect(
        puedeMarcar({ checkpoint, marcados, rol: "secretaria" }).permitido,
      ).toBe(true);
      marcados.push(checkpoint);
    }
  });

  it("no se puede aprobar una cotización que no se ha enviado", () => {
    const resultado = puedeMarcar({
      checkpoint: "cotizacion_aprobada",
      marcados: [],
      rol: "secretaria",
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("fuera_de_secuencia");
    expect(resultado.mensaje).toContain("Cotización enviada");
  });

  it("no se puede programar a diseño sin la cotización aprobada", () => {
    const resultado = puedeMarcar({
      checkpoint: "programada_diseno",
      marcados: ["cotizacion_enviada"],
      rol: "secretaria",
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.mensaje).toContain("Cotización aprobada");
  });

  it("solo secretaría marca las dos etapas", () => {
    for (const rol of ROLES.filter((r) => r !== "secretaria")) {
      const resultado = puedeMarcar({
        checkpoint: "cotizacion_enviada",
        marcados: [],
        rol,
      });

      expect(resultado.permitido).toBe(false);
      if (resultado.permitido) continue;
      expect(resultado.motivo).toBe("rol_no_autorizado");
    }

    expect(buscarCheckpoint("cotizacion_enviada").rolDueno).toBe("secretaria");
    expect(buscarCheckpoint("cotizacion_aprobada").rolDueno).toBe("secretaria");
  });

  it("las dos se marcan en la misma pantalla", () => {
    expect(buscarCheckpoint("cotizacion_enviada").ruta).toBe(
      "/ordenes/cotizacion",
    );
    expect(buscarCheckpoint("cotizacion_aprobada").ruta).toBe(
      "/ordenes/cotizacion",
    );
  });
});

const PERMITIDO: ResultadoMarcado = { permitido: true };
const FUERA: ResultadoMarcado = {
  permitido: false,
  motivo: "fuera_de_secuencia",
  mensaje: "x",
};
const OTRO_ROL: ResultadoMarcado = {
  permitido: false,
  motivo: "rol_no_autorizado",
  mensaje: "x",
};

function orden(
  id: string,
  yaMarcada: boolean,
  veredicto: ResultadoMarcado,
): OrdenParaSeccion {
  return {
    id,
    numeroOrdenCompra: id,
    razonSocial: "Cliente",
    fechaEntrega: "2026-12-01",
    fechaIngreso: "2026-09-01",
    yaMarcada,
    fechaMarcado: null,
    veredicto,
    fichas: [],
    cerrada: false,
    noAplica: false,
    etapasFaltantes: 0,
  };
}

describe("repartirPorCotizacion", () => {
  it("una orden sin enviar va a 'por enviar'", () => {
    const { porEnviar, porAprobar } = repartirPorCotizacion(
      [orden("a", false, PERMITIDO)],
      [orden("a", false, FUERA)],
    );

    expect(porEnviar.map((o) => o.id)).toEqual(["a"]);
    expect(porAprobar).toEqual([]);
  });

  it("una orden enviada va a 'por aprobar' y trae la vista de la aprobación", () => {
    const aprobada = orden("a", false, PERMITIDO);
    const { porEnviar, porAprobar } = repartirPorCotizacion(
      [orden("a", true, FUERA)],
      [aprobada],
    );

    expect(porEnviar).toEqual([]);
    expect(porAprobar).toEqual([aprobada]);
  });

  it("una orden aprobada ya no aparece", () => {
    const resultado = repartirPorCotizacion(
      [orden("a", true, FUERA)],
      [orden("a", true, FUERA)],
    );

    expect(resultado).toEqual({ porEnviar: [], porAprobar: [] });
  });

  it("una orden que avanzó sin cotización no aparece", () => {
    const resultado = repartirPorCotizacion(
      [orden("a", false, FUERA)],
      [orden("a", false, FUERA)],
    );

    expect(resultado).toEqual({ porEnviar: [], porAprobar: [] });
  });

  it("administración ve lo pendiente aunque no sea quien marca", () => {
    const { porEnviar, porAprobar } = repartirPorCotizacion(
      [orden("a", false, OTRO_ROL), orden("b", true, FUERA)],
      [orden("a", false, FUERA), orden("b", false, OTRO_ROL)],
    );

    expect(porEnviar.map((o) => o.id)).toEqual(["a"]);
    expect(porAprobar.map((o) => o.id)).toEqual(["b"]);
  });
});
