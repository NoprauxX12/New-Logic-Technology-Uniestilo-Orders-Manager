import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  esEtapaDeEntrada,
  ETAPA_DE_ENTRADA_POR_DEFECTO,
  ETAPAS_DE_ENTRADA,
  etapasParaDevolver,
  etapasQueQuedanVigentes,
  etapasQueSeAnulan,
  numeroDeCorreccion,
  puedeCrearCorreccion,
  puedeDevolver,
  validarDestino,
  validarPrendasDefectuosas,
} from "@/features/correcciones/reglas";
import {
  CHECKPOINTS,
  type CheckpointId,
} from "@/features/workflow/checkpoints";

const SECUENCIA = CHECKPOINTS.map((c) => c.id);
const hasta = (id: CheckpointId) =>
  SECUENCIA.slice(0, SECUENCIA.indexOf(id) + 1);

describe("etapasParaDevolver", () => {
  it("son las etapas vigentes, en el orden del flujo", () => {
    expect(etapasParaDevolver(["corte_completado", "ficha_adjunta"])).toEqual([
      "ficha_adjunta",
      "corte_completado",
    ]);
  });

  it("no hay ninguna si la orden está cerrada: para eso es la corrección", () => {
    expect(etapasParaDevolver(SECUENCIA)).toEqual([]);
  });

  it("no hay ninguna si la orden no tiene nada marcado", () => {
    expect(etapasParaDevolver([])).toEqual([]);
  });
});

describe("qué se anula al devolver", () => {
  const marcados = hasta("recogido_bordado");

  it("se anulan el destino y todo lo que le sigue", () => {
    expect(etapasQueSeAnulan(marcados, "corte_completado")).toEqual([
      "corte_completado",
      "recogido_bordado",
    ]);
  });

  it("lo anterior queda vigente", () => {
    expect(etapasQueQuedanVigentes(marcados, "corte_completado")).toEqual(
      hasta("tela_programada"),
    );
  });

  it("devolver a la última etapa marcada rehace solo esa", () => {
    expect(etapasQueSeAnulan(marcados, "recogido_bordado")).toEqual([
      "recogido_bordado",
    ]);
  });

  it("anulados y vigentes juntos son todo lo que había marcado", () => {
    const destino: CheckpointId = "ficha_adjunta";
    expect(
      [
        ...etapasQueQuedanVigentes(marcados, destino),
        ...etapasQueSeAnulan(marcados, destino),
      ].sort(),
    ).toEqual([...marcados].sort());
  });
});

describe("puedeDevolver / validarDestino", () => {
  it("solo administración devuelve una orden", () => {
    for (const rol of [
      "secretaria",
      "diseno",
      "corte",
      "logistica",
      "marcacion",
      "terminacion",
    ] as const) {
      expect(
        puedeDevolver({ marcados: hasta("corte_completado"), rol }),
      ).toMatchObject({
        permitido: false,
      });
    }
    expect(
      puedeDevolver({ marcados: hasta("corte_completado"), rol: "admin" }),
    ).toEqual({ permitido: true });
  });

  it("una orden cerrada no se devuelve y se manda a la orden de corrección", () => {
    const veredicto = puedeDevolver({ marcados: SECUENCIA, rol: "admin" });

    expect(veredicto.permitido).toBe(false);
    expect(!veredicto.permitido && veredicto.mensaje).toMatch(/corrección/);
  });

  it("una orden sin avances no tiene a dónde volver", () => {
    expect(puedeDevolver({ marcados: [], rol: "admin" }).permitido).toBe(false);
  });

  it("el destino tiene que ser una etapa vigente", () => {
    const marcados = hasta("corte_completado");

    expect(validarDestino({ marcados, destino: "tela_programada" })).toEqual({
      permitido: true,
    });
    expect(
      validarDestino({ marcados, destino: "recogido_bordado" }),
    ).toMatchObject({
      permitido: false,
    });
  });
});

describe("puedeCrearCorreccion", () => {
  it("solo administración, y solo sobre una orden cerrada", () => {
    expect(puedeCrearCorreccion({ marcados: SECUENCIA, rol: "admin" })).toEqual(
      {
        permitido: true,
      },
    );
    expect(
      puedeCrearCorreccion({ marcados: SECUENCIA, rol: "secretaria" })
        .permitido,
    ).toBe(false);
    expect(
      puedeCrearCorreccion({ marcados: hasta("lista_despacho"), rol: "admin" }),
    ).toMatchObject({ permitido: false });
  });
});

describe("etapa de entrada de una corrección", () => {
  it("por defecto entra por el corte", () => {
    expect(ETAPA_DE_ENTRADA_POR_DEFECTO).toBe("corte_completado");
    expect(ETAPAS_DE_ENTRADA).toContain(ETAPA_DE_ENTRADA_POR_DEFECTO);
  });

  it("llega hasta 'lista para despachar': las de cierre no sirven de entrada", () => {
    expect(ETAPAS_DE_ENTRADA.at(-1)).toBe("lista_despacho");
    for (const cierre of [
      "etiquetas",
      "documentos_despacho",
      "factura_generada",
      "cerrada",
    ]) {
      expect(esEtapaDeEntrada(cierre)).toBe(false);
    }
    expect(esEtapaDeEntrada("corte_completado")).toBe(true);
  });

  it("coincide con la restricción de la base (orden_etapa_inicial_valida)", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261021100100_orden_de_correccion.sql",
      ),
      "utf8",
    );

    expect(sql).toMatch(/etapa_inicial <= 'lista_despacho'/);
    expect(ETAPAS_DE_ENTRADA.at(-1)).toBe("lista_despacho");
  });
});

describe("numeroDeCorreccion", () => {
  it("la primera corrección es C1", () => {
    expect(numeroDeCorreccion("OC-5007", 0, [])).toBe("OC-5007-C1");
  });

  it("sigue el consecutivo de las correcciones que ya tiene la orden", () => {
    expect(numeroDeCorreccion("OC-5007", 1, ["OC-5007-C1"])).toBe("OC-5007-C2");
    expect(numeroDeCorreccion("OC-5007", 2, ["OC-5007-C1", "OC-5007-C2"])).toBe(
      "OC-5007-C3",
    );
  });

  it("salta un número ocupado, sin distinguir mayúsculas", () => {
    expect(numeroDeCorreccion("OC-5007", 1, ["oc-5007-c2"])).toBe("OC-5007-C3");
  });
});

describe("validarPrendasDefectuosas", () => {
  const originales = [
    { id: "a", descripcion: "Camisas", cantidad: 450 },
    { id: "b", descripcion: "Pantalones", cantidad: 10 },
  ];

  it("acepta de 1 hasta la cantidad de la orden original", () => {
    expect(
      validarPrendasDefectuosas(
        [
          { itemId: "a", cantidad: 1, tallas: "S:1" },
          { itemId: "b", cantidad: 10, tallas: "M:10" },
        ],
        originales,
      ),
    ).toEqual({});
  });

  it("rechaza más unidades de las que tenía la orden", () => {
    const errores = validarPrendasDefectuosas(
      [{ itemId: "b", cantidad: 11, tallas: "M:11" }],
      originales,
    );

    expect(errores.b).toMatch(/tenía 10/);
  });

  it("rechaza cero, negativos y decimales", () => {
    for (const cantidad of [0, -3, 1.5]) {
      expect(
        validarPrendasDefectuosas(
          [{ itemId: "a", cantidad, tallas: "S" }],
          originales,
        ).a,
      ).toBeDefined();
    }
  });

  it("rechaza una prenda de otra orden y una repetida", () => {
    expect(
      validarPrendasDefectuosas(
        [{ itemId: "z", cantidad: 1, tallas: "S" }],
        originales,
      ).z,
    ).toMatch(/no es de la orden/);
    expect(
      validarPrendasDefectuosas(
        [
          { itemId: "a", cantidad: 1, tallas: "S" },
          { itemId: "a", cantidad: 2, tallas: "M" },
        ],
        originales,
      ).a,
    ).toMatch(/repetida/);
  });
});
