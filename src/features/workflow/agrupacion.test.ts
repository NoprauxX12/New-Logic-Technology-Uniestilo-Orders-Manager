import { describe, expect, it } from "vitest";

import {
  agruparOrdenesDeSeccion,
  DIAS_DE_MARCADAS,
  ordenarPorAntiguedad,
  ordenarPorLlegada,
} from "@/features/workflow/agrupacion";
import type { OrdenParaSeccion } from "@/features/workflow/queries";

/**
 * Las listas de las secciones responden «¿qué hago ahora?»: lo que le toca a la
 * sección arriba y por urgencia, lo que aún no llega debajo, lo ya hecho al
 * final, y lo cerrado en ningún lado.
 */

const AHORA = new Date("2026-10-23T15:00:00Z"); // 10 a. m. en Bogotá

/** Días desde hoy, en formato de fecha: -3 es «hace tres días». */
function dia(desplazamiento: number): string {
  const d = new Date(AHORA);
  d.setUTCDate(d.getUTCDate() + desplazamiento);
  return d.toISOString().slice(0, 10);
}

function orden(
  numero: string,
  cambios: Partial<OrdenParaSeccion> = {},
): OrdenParaSeccion {
  return {
    id: numero,
    numeroOrdenCompra: numero,
    razonSocial: "Cliente",
    fechaEntrega: dia(30),
    fechaIngreso: dia(-5),
    yaMarcada: false,
    fechaMarcado: null,
    veredicto: { permitido: true },
    fichas: [],
    cerrada: false,
    noAplica: false,
    etapasFaltantes: 0,
    ...cambios,
  };
}

const bloqueada = (faltan: number): Partial<OrdenParaSeccion> => ({
  veredicto: {
    permitido: false,
    motivo: "fuera_de_secuencia",
    mensaje: "Antes hay que marcar «Tela programada».",
  },
  etapasFaltantes: faltan,
});

const numeros = (lista: OrdenParaSeccion[]) =>
  lista.map((o) => o.numeroOrdenCompra);

describe("agruparOrdenesDeSeccion · los tres grupos", () => {
  it("separa lo que toca marcar, lo que aún no llega y lo ya marcado", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("YA", {
          yaMarcada: true,
          fechaMarcado: AHORA.toISOString(),
        }),
        orden("ESPERA", bloqueada(2)),
        orden("MARCAR"),
      ],
      AHORA,
    );

    expect(numeros(grupos.paraMarcar)).toEqual(["MARCAR"]);
    expect(numeros(grupos.enEspera)).toEqual(["ESPERA"]);
    expect(numeros(grupos.hechas)).toEqual(["YA"]);
  });

  it("las órdenes cerradas no aparecen en ningún grupo", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("CERRADA-MARCADA", {
          cerrada: true,
          yaMarcada: true,
          fechaMarcado: AHORA.toISOString(),
        }),
        orden("CERRADA", { cerrada: true }),
      ],
      AHORA,
    );

    expect(grupos).toEqual({ paraMarcar: [], enEspera: [], hechas: [] });
  });

  it("una orden que pasó de largo la etapa no aparece (no se puede marcar ni se espera)", () => {
    const grupos = agruparOrdenesDeSeccion(
      [orden("PASO", { noAplica: true, ...bloqueada(0) })],
      AHORA,
    );

    expect(grupos).toEqual({ paraMarcar: [], enEspera: [], hechas: [] });
  });

  it("si solo falta el rol (administración mirando corte) sigue siendo de esta etapa", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("ADMIN", {
          veredicto: {
            permitido: false,
            motivo: "rol_no_autorizado",
            mensaje: "«Corte completado» lo marca Corte.",
          },
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.paraMarcar)).toEqual(["ADMIN"]);
  });

  it("un requisito pendiente (esperando tela) la deja en espera, aunque sea la etapa que sigue", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("TELA", {
          veredicto: {
            permitido: false,
            motivo: "requisito_pendiente",
            mensaje: "La orden está esperando tela.",
          },
          etapasFaltantes: 0,
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.enEspera)).toEqual(["TELA"]);
  });
});

describe("agruparOrdenesDeSeccion · el orden dentro de cada grupo", () => {
  it("para marcar: primero las atrasadas, luego las en riesgo, luego por fecha de entrega", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("LEJOS", { fechaEntrega: dia(40) }),
        orden("CERCA", { fechaEntrega: dia(20) }),
        orden("RIESGO", { fechaEntrega: dia(2) }),
        orden("ATRASADA", { fechaEntrega: dia(-4) }),
      ],
      AHORA,
    );

    expect(numeros(grupos.paraMarcar)).toEqual([
      "ATRASADA",
      "RIESGO",
      "CERCA",
      "LEJOS",
    ]);
  });

  it("de dos atrasadas, primero la que lleva más días de retraso", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("POCO", { fechaEntrega: dia(-1) }),
        orden("MUCHO", { fechaEntrega: dia(-9) }),
      ],
      AHORA,
    );

    expect(numeros(grupos.paraMarcar)).toEqual(["MUCHO", "POCO"]);
  });

  it("en espera: primero las que están más cerca de llegar a la sección", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("LEJOS", bloqueada(5)),
        orden("CERCA", bloqueada(1)),
        orden("MEDIA", bloqueada(3)),
      ],
      AHORA,
    );

    expect(numeros(grupos.enEspera)).toEqual(["CERCA", "MEDIA", "LEJOS"]);
  });

  it("en espera, a igual distancia gana la más urgente", () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("TRANQUILA", { ...bloqueada(2), fechaEntrega: dia(40) }),
        orden("URGENTE", { ...bloqueada(2), fechaEntrega: dia(1) }),
      ],
      AHORA,
    );

    expect(numeros(grupos.enEspera)).toEqual(["URGENTE", "TRANQUILA"]);
  });

  it("ya marcadas: la más reciente primero", () => {
    const hace = (horas: number) =>
      new Date(AHORA.getTime() - horas * 3600_000).toISOString();

    const grupos = agruparOrdenesDeSeccion(
      [
        orden("VIEJA", { yaMarcada: true, fechaMarcado: hace(48) }),
        orden("NUEVA", { yaMarcada: true, fechaMarcado: hace(2) }),
      ],
      AHORA,
    );

    expect(numeros(grupos.hechas)).toEqual(["NUEVA", "VIEJA"]);
  });
});

describe("agruparOrdenesDeSeccion · lo ya marcado caduca", () => {
  const hace = (dias: number) =>
    new Date(AHORA.getTime() - dias * 24 * 3600_000).toISOString();

  it(`se sigue mostrando ${DIAS_DE_MARCADAS} días y después sale de la lista`, () => {
    const grupos = agruparOrdenesDeSeccion(
      [
        orden("DENTRO", {
          yaMarcada: true,
          fechaMarcado: hace(DIAS_DE_MARCADAS - 1),
        }),
        orden("FUERA", {
          yaMarcada: true,
          fechaMarcado: hace(DIAS_DE_MARCADAS + 1),
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.hechas)).toEqual(["DENTRO"]);
  });

  it("una marcada sin fecha no se muestra: no hay cómo saber si es reciente", () => {
    const grupos = agruparOrdenesDeSeccion(
      [orden("SIN-FECHA", { yaMarcada: true, fechaMarcado: null })],
      AHORA,
    );

    expect(grupos.hechas).toEqual([]);
  });
});

describe("agruparOrdenesDeSeccion · casos límite", () => {
  it("una lista vacía da tres grupos vacíos", () => {
    expect(agruparOrdenesDeSeccion([], AHORA)).toEqual({
      paraMarcar: [],
      enEspera: [],
      hechas: [],
    });
  });

  it("no modifica la lista que recibe", () => {
    const entrada = [orden("B", { fechaEntrega: dia(9) }), orden("A")];
    const copia = [...entrada];

    agruparOrdenesDeSeccion(entrada, AHORA);

    expect(entrada).toEqual(copia);
  });

  it("la urgencia se cuenta en hora de Bogotá: a las 8 p. m. lo que vence hoy no es «atrasada»", () => {
    // 2026-10-24T01:00Z son las 8 p. m. del 23 en Colombia.
    const nocheEnColombia = new Date("2026-10-24T01:00:00Z");

    const grupos = agruparOrdenesDeSeccion(
      [
        orden("VENCE-HOY", { fechaEntrega: "2026-10-23" }),
        orden("MAÑANA", { fechaEntrega: "2026-10-24" }),
        orden("AYER", { fechaEntrega: "2026-10-22" }),
      ],
      nocheEnColombia,
    );

    expect(numeros(grupos.paraMarcar)).toEqual(["AYER", "VENCE-HOY", "MAÑANA"]);
  });
});

describe("ordenarPorLlegada y ordenarPorAntiguedad", () => {
  it("por llegada: la que entró primero va primero", () => {
    const lista = ordenarPorLlegada([
      orden("NUEVA", { fechaIngreso: dia(-1) }),
      orden("VIEJA", { fechaIngreso: dia(-20) }),
      orden("MEDIA", { fechaIngreso: dia(-7) }),
    ]);

    expect(numeros(lista)).toEqual(["VIEJA", "MEDIA", "NUEVA"]);
  });

  it("por antigüedad: la que lleva más tiempo en su estado va primero; sin fecha, al final", () => {
    const lista = ordenarPorAntiguedad([
      orden("RECIENTE", { fechaMarcado: "2026-10-22T10:00:00Z" }),
      orden("SIN-FECHA"),
      orden("ANTIGUA", { fechaMarcado: "2026-10-10T10:00:00Z" }),
    ]);

    expect(numeros(lista)).toEqual(["ANTIGUA", "RECIENTE", "SIN-FECHA"]);
  });
});
