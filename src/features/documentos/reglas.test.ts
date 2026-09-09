import { describe, expect, it } from "vitest";

import {
  esReporteDelCierre,
  estaCompletada,
  reportesPendientes,
  validarCierre,
  validarReporte,
} from "@/features/documentos/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";

/**
 * HU-13 · Las reglas del cierre. Aquí está el riesgo del dominio: que una orden
 * quede completada sin haber reportado las tres cosas, que se cierre antes de
 * estar lista para despachar, o que se cierre dos veces.
 */

const HASTA_LISTA_DESPACHO: CheckpointId[] = [
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
  "corte_completado",
  "recogido_bordado",
  "llegada_marcacion",
  "lista_despacho",
];

const CON_LOS_TRES_REPORTES: CheckpointId[] = [
  ...HASTA_LISTA_DESPACHO,
  "etiquetas",
  "documentos_despacho",
  "factura_generada",
];

const EN_MARCACION: CheckpointId[] = HASTA_LISTA_DESPACHO.slice(0, 7);

describe("esReporteDelCierre", () => {
  it("reconoce los tres reportes", () => {
    expect(esReporteDelCierre("etiquetas")).toBe(true);
    expect(esReporteDelCierre("documentos_despacho")).toBe(true);
    expect(esReporteDelCierre("factura_generada")).toBe(true);
  });

  it("rechaza cualquier otra etapa", () => {
    expect(esReporteDelCierre("cerrada")).toBe(false);
    expect(esReporteDelCierre("corte_completado")).toBe(false);
  });
});

describe("validarReporte", () => {
  it("deja reportar las etiquetas cuando la orden está lista para despachar", () => {
    const resultado = validarReporte({
      ordenExiste: true,
      marcados: HASTA_LISTA_DESPACHO,
      reporte: "etiquetas",
    });

    expect(resultado).toEqual({ permitido: true });
  });

  it("no deja reportar si la orden todavía no está lista para despachar", () => {
    const resultado = validarReporte({
      ordenExiste: true,
      marcados: EN_MARCACION,
      reporte: "etiquetas",
    });

    expect(resultado).toMatchObject({ permitido: false });
  });

  it("no deja repetir un reporte ya hecho", () => {
    const resultado = validarReporte({
      ordenExiste: true,
      marcados: [...HASTA_LISTA_DESPACHO, "etiquetas"],
      reporte: "etiquetas",
    });

    expect(resultado).toMatchObject({ permitido: false });
  });

  it("no deja reportar sobre una orden que no existe", () => {
    const resultado = validarReporte({
      ordenExiste: false,
      marcados: HASTA_LISTA_DESPACHO,
      reporte: "etiquetas",
    });

    expect(resultado).toMatchObject({ permitido: false });
  });
});

describe("reportesPendientes", () => {
  it("los lista todos cuando no se ha reportado nada", () => {
    expect(reportesPendientes(HASTA_LISTA_DESPACHO)).toEqual([
      "etiquetas",
      "documentos_despacho",
      "factura_generada",
    ]);
  });

  it("no deja ninguno cuando ya están los tres", () => {
    expect(reportesPendientes(CON_LOS_TRES_REPORTES)).toEqual([]);
  });
});

describe("validarCierre", () => {
  it("completa la orden cuando están los tres reportes", () => {
    const resultado = validarCierre({
      ordenExiste: true,
      marcados: CON_LOS_TRES_REPORTES,
    });

    expect(resultado).toEqual({ permitido: true });
  });

  it("no completa si falta alguno de los tres, y dice cuál", () => {
    const resultado = validarCierre({
      ordenExiste: true,
      marcados: [...HASTA_LISTA_DESPACHO, "etiquetas", "factura_generada"],
    });

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "documentos de despacho",
    );
  });

  it("no completa una orden que no está lista para despachar", () => {
    const resultado = validarCierre({
      ordenExiste: true,
      marcados: EN_MARCACION,
    });

    expect(resultado).toMatchObject({ permitido: false });
  });

  it("no deja cerrar dos veces la misma orden", () => {
    const resultado = validarCierre({
      ordenExiste: true,
      marcados: [...CON_LOS_TRES_REPORTES, "cerrada"],
    });

    expect(resultado).toMatchObject({ permitido: false });
  });
});

describe("estaCompletada", () => {
  it("distingue una orden cerrada de una que solo tiene los reportes", () => {
    expect(estaCompletada(CON_LOS_TRES_REPORTES)).toBe(false);
    expect(estaCompletada([...CON_LOS_TRES_REPORTES, "cerrada"])).toBe(true);
  });
});
