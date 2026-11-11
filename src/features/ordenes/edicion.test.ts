import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  entradaDesdeOrden,
  leerCantidadesPorTalla,
  PRIMERA_ETAPA_NO_EDITABLE,
  puedeEditarOrden,
} from "@/features/ordenes/edicion";
import { leerFormularioOrden } from "@/features/ordenes/formulario";
import { edicionOrdenSchema } from "@/features/ordenes/schemas";
import {
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";

const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);
const hasta = (id: CheckpointId) =>
  SECUENCIA.slice(0, SECUENCIA.indexOf(id) + 1);
const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

const comoAdmin = (
  marcados: readonly CheckpointId[],
  etapaInicial: CheckpointId | null = null,
) => puedeEditarOrden({ marcados, etapaInicial, rol: "admin" });

describe("puedeEditarOrden", () => {
  it("administración edita hasta cotización aprobada, inclusive", () => {
    expect(comoAdmin([]).permitido).toBe(true);
    expect(comoAdmin(hasta("cotizacion_enviada")).permitido).toBe(true);
    expect(comoAdmin(hasta("cotizacion_aprobada")).permitido).toBe(true);
  });

  it("desde que pasa a diseño ya no, en ninguna etapa posterior", () => {
    const posteriores = SECUENCIA.slice(
      SECUENCIA.indexOf(PRIMERA_ETAPA_NO_EDITABLE),
    );

    expect(posteriores).toHaveLength(12);
    for (const etapa of posteriores) {
      expect(comoAdmin(hasta(etapa)).permitido).toBe(false);
      // Aunque falten las anteriores: las órdenes viejas las pasaron de largo.
      expect(comoAdmin([etapa]).permitido).toBe(false);
    }
  });

  it("el mensaje de una orden en producción está en lenguaje del taller", () => {
    expect(comoAdmin(hasta("ficha_adjunta"))).toEqual({
      permitido: false,
      mensaje: expect.stringContaining("ya pasó a diseño"),
    });
  });

  it("una orden cerrada dice que está cerrada y ofrece la corrección", () => {
    expect(comoAdmin(hasta("cerrada"))).toEqual({
      permitido: false,
      mensaje: expect.stringContaining("orden de corrección"),
    });
  });

  it("ningún otro rol edita, en ningún estado", () => {
    for (const rol of ROLES.filter((candidato) => candidato !== "admin")) {
      for (const marcados of [[], hasta("cotizacion_aprobada")]) {
        expect(puedeEditarOrden({ marcados, etapaInicial: null, rol })).toEqual(
          {
            permitido: false,
            mensaje: expect.stringContaining("Administración"),
          },
        );
      }
    }
  });

  describe("orden de corrección, según su etapa de entrada", () => {
    it.each(["cotizacion_enviada", "cotizacion_aprobada", "programada_diseno"])(
      "entrando por %s se edita mientras no la programen",
      (etapa) => {
        expect(comoAdmin([], etapa as CheckpointId).permitido).toBe(true);
      },
    );

    it.each(["ficha_adjunta", "corte_completado", "lista_despacho"])(
      "entrando por %s ya pasó diseño: no se edita aunque no tenga avances",
      (etapa) => {
        expect(comoAdmin([], etapa as CheckpointId)).toEqual({
          permitido: false,
          mensaje: expect.stringContaining("después de diseño"),
        });
      },
    );

    it("entrando por la programación, tampoco una vez programada", () => {
      expect(
        comoAdmin(["programada_diseno"], "programada_diseno").permitido,
      ).toBe(false);
    });
  });
});

describe("la base dice lo mismo que esta regla", () => {
  const MIGRACIONES = join(process.cwd(), "supabase", "migrations");

  const sql = readdirSync(MIGRACIONES)
    .filter((nombre) => nombre.endsWith(".sql"))
    .sort()
    .map((nombre) => readFileSync(join(MIGRACIONES, nombre), "utf8"))
    .filter((texto) => /function public\.editar_orden/i.test(texto))
    .at(-1);

  it("existe la función", () => {
    expect(sql).toBeDefined();
  });

  it("editar_orden corta en la misma etapa y solo mira los avances vigentes", () => {
    const cuerpo = sql?.match(
      /function public\.editar_orden[\s\S]*?using errcode = 'UE016'/i,
    )?.[0];

    expect(cuerpo).toContain(
      `checkpoint >= '${PRIMERA_ETAPA_NO_EDITABLE}'::public.checkpoint`,
    );
    expect(cuerpo).toContain(
      `etapa_inicial > '${PRIMERA_ETAPA_NO_EDITABLE}'::public.checkpoint`,
    );
    expect(cuerpo).toMatch(/anulado_por is null/);
  });
});

describe("edicionOrdenSchema", () => {
  const ID = "00000000-0000-0000-0000-0000000000f3";
  const VALIDA = {
    ordenId: ID,
    numeroOrdenCompra: "OC-1",
    nit: "900.111.222-3",
    razonSocial: "Colegio",
    contactoNombre: "Marta",
    contactoCelular: "3000000000",
    fechaIngreso: "2026-11-01",
    fechaEntrega: "2026-11-20",
    observaciones: "",
    items: [
      {
        itemId: ID,
        descripcion: "Camisa",
        cantidad: "5",
        tallas: "M:5",
        tallaje: "otro",
        valor: "100",
      },
    ],
  };

  it("acepta una orden válida y conserva el id de cada prenda", () => {
    const resultado = edicionOrdenSchema.safeParse(VALIDA);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.ordenId).toBe(ID);
    expect(resultado.data?.items[0].itemId).toBe(ID);
  });

  it("una prenda nueva, con el id en blanco, queda sin id", () => {
    const resultado = edicionOrdenSchema.safeParse({
      ...VALIDA,
      items: [{ ...VALIDA.items[0], itemId: "" }],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.items[0].itemId).toBeUndefined();
  });

  it("rechaza un id de orden o de prenda que no es un id", () => {
    expect(
      edicionOrdenSchema.safeParse({ ...VALIDA, ordenId: "x" }).success,
    ).toBe(false);
    expect(
      edicionOrdenSchema.safeParse({
        ...VALIDA,
        items: [{ ...VALIDA.items[0], itemId: "x" }],
      }).success,
    ).toBe(false);
  });

  it("repite las reglas del registro: la entrega no va antes del ingreso", () => {
    const resultado = edicionOrdenSchema.safeParse({
      ...VALIDA,
      fechaEntrega: "2026-10-01",
    });

    expect(resultado.error?.issues[0].path).toEqual(["fechaEntrega"]);
  });

  it("repite las reglas del registro: la orden no se queda sin prendas", () => {
    expect(edicionOrdenSchema.safeParse({ ...VALIDA, items: [] }).success).toBe(
      false,
    );
  });
});

describe("leerFormularioOrden · al editar", () => {
  it("cada prenda conserva su id y su clave, por posición", () => {
    const formData = new FormData();
    for (const [itemId, clave] of [
      ["id-1", "fila-0"],
      ["", "fila-3"],
    ]) {
      formData.append("descripcion", "Prenda");
      formData.append("itemId", itemId);
      formData.append("clave", clave);
    }

    expect(
      leerFormularioOrden(formData).items.map(({ itemId, clave }) => ({
        itemId,
        clave,
      })),
    ).toEqual([
      { itemId: "id-1", clave: "fila-0" },
      { itemId: "", clave: "fila-3" },
    ]);
  });
});

describe("leerCantidadesPorTalla", () => {
  it("vuelve a llenar la cuadrícula con el texto guardado", () => {
    expect(
      leerCantidadesPorTalla("superior_hombre", "S:20, M:40, L:30"),
    ).toEqual({ S: "20", M: "40", L: "30" });
  });

  it("no lee tallas que no son de ese tallaje", () => {
    expect(leerCantidadesPorTalla("superior_hombre", "28:5")).toBeNull();
  });

  it("no lee un texto escrito a mano", () => {
    expect(
      leerCantidadesPorTalla("superior_hombre", "varias tallas"),
    ).toBeNull();
  });

  it("«otro» no tiene cuadrícula", () => {
    expect(leerCantidadesPorTalla("otro", "S:20")).toBeNull();
  });
});

describe("entradaDesdeOrden", () => {
  const ORDEN = {
    numeroOrdenCompra: "OC-1",
    fechaIngreso: "2026-11-01",
    fechaEntrega: "2026-11-20",
    observaciones: null,
    nit: "900.111.222-3",
    razonSocial: "Colegio",
    contactoNombre: "Marta",
    contactoCelular: "3000000000",
    prendas: [],
  };

  const prenda = {
    id: "p1",
    descripcion: "Camisa",
    cantidad: 90,
    tallas: "S:20, M:70",
    tallaje: "superior_hombre",
    valor: 1500.5,
    observaciones: null,
  };

  it("lo vacío de la base se muestra como campo en blanco", () => {
    expect(entradaDesdeOrden(ORDEN).observaciones).toBe("");
  });

  it("una prenda con tallaje llena su cuadrícula y conserva su id", () => {
    expect(entradaDesdeOrden({ ...ORDEN, prendas: [prenda] }).items[0]).toEqual(
      {
        itemId: "p1",
        descripcion: "Camisa",
        cantidad: "90",
        tallas: "S:20, M:70",
        valor: "1500.5",
        observaciones: "",
        tallaje: "superior_hombre",
        cantidadesPorTalla: { S: "20", M: "70" },
      },
    );
  });

  it("una prenda anterior al tallaje se muestra como «otro», con sus tallas", () => {
    const [item] = entradaDesdeOrden({
      ...ORDEN,
      prendas: [{ ...prenda, tallaje: null, tallas: "Surtidas" }],
    }).items;

    expect(item.tallaje).toBe("otro");
    expect(item.tallas).toBe("Surtidas");
    expect(item.cantidadesPorTalla).toBeUndefined();
  });

  it("con tallas que no cuadran con el tallaje, no se pierden: van como «otro»", () => {
    const [item] = entradaDesdeOrden({
      ...ORDEN,
      prendas: [{ ...prenda, tallas: "Surtidas" }],
    }).items;

    expect(item.tallaje).toBe("otro");
    expect(item.tallas).toBe("Surtidas");
  });
});
