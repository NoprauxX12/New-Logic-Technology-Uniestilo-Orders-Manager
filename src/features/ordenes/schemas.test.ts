import { describe, expect, it } from "vitest";
import { z } from "zod";

import { agruparErrores } from "@/features/ordenes/formulario";
import { nuevaOrdenSchema } from "@/features/ordenes/schemas";

/**
 * HU-01 · Pruebas del esquema de registro de orden.
 * Cubren los criterios de aceptación que se pueden verificar sin base de datos.
 * El de "no se repite el # de orden de compra" se garantiza con la restricción
 * unique de la migración, así que se prueba contra la base, no aquí.
 */

/** Orden válida mínima. Cada prueba cambia solo lo que quiere romper. */
function ordenValida(cambios: Record<string, unknown> = {}) {
  return {
    numeroOrdenCompra: "OC-4412",
    nit: "900.123.456-7",
    razonSocial: "Universidad EAFIT",
    contactoNombre: "Laura Gómez",
    contactoCelular: "3001234567",
    fechaIngreso: "2026-09-01",
    fechaEntrega: "2026-09-30",
    observaciones: "Entregar en la sede de Medellín",
    items: [
      {
        descripcion: "Camisas ejecutivas blancas",
        cantidad: "240",
        tallas: "S:60, M:100, L:80",
        valor: "18500000",
      },
    ],
    ...cambios,
  };
}

/** Mensajes de error por campo, como los va a mostrar el formulario. */
function erroresPorCampo(
  entrada: unknown,
): Record<string, string[] | undefined> {
  const resultado = nuevaOrdenSchema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors;
}

describe("nuevaOrdenSchema · orden completa", () => {
  it("acepta una orden con todos los campos", () => {
    const resultado = nuevaOrdenSchema.safeParse(ordenValida());

    expect(resultado.success).toBe(true);
  });

  it("convierte cantidad y valor de texto a número", () => {
    const resultado = nuevaOrdenSchema.parse(ordenValida());

    expect(resultado.items[0].cantidad).toBe(240);
    expect(resultado.items[0].valor).toBe(18500000);
  });

  it("quita los espacios sobrantes de los textos", () => {
    const resultado = nuevaOrdenSchema.parse(
      ordenValida({ razonSocial: "  Universidad EAFIT  " }),
    );

    expect(resultado.razonSocial).toBe("Universidad EAFIT");
  });
});

describe("nuevaOrdenSchema · campos obligatorios", () => {
  it("observaciones es el único campo opcional de la orden", () => {
    const { observaciones, ...sinObservaciones } = ordenValida();

    expect(observaciones).toBeDefined();
    expect(nuevaOrdenSchema.safeParse(sinObservaciones).success).toBe(true);
  });

  it("observaciones también es opcional en cada prenda", () => {
    const resultado = nuevaOrdenSchema.safeParse(ordenValida());

    expect(resultado.success).toBe(true);
  });

  it.each([
    "numeroOrdenCompra",
    "razonSocial",
    "contactoNombre",
    "fechaIngreso",
    "fechaEntrega",
  ])("rechaza la orden si falta %s", (campo) => {
    const errores = erroresPorCampo(ordenValida({ [campo]: "" }));

    expect(errores[campo]).toBeDefined();
  });

  it("señala cuál campo falta, no un error genérico", () => {
    const errores = erroresPorCampo(ordenValida({ razonSocial: "" }));

    expect(errores.razonSocial?.[0]).toContain("razón social");
    expect(errores.numeroOrdenCompra).toBeUndefined();
  });
});

describe("nuevaOrdenSchema · fechas", () => {
  it("rechaza una entrega anterior al ingreso", () => {
    const errores = erroresPorCampo(
      ordenValida({ fechaIngreso: "2026-09-10", fechaEntrega: "2026-09-01" }),
    );

    expect(errores.fechaEntrega?.[0]).toContain(
      "no puede ser anterior a la fecha de ingreso",
    );
  });

  it("acepta que la entrega sea el mismo día del ingreso", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      ordenValida({ fechaIngreso: "2026-09-10", fechaEntrega: "2026-09-10" }),
    );

    expect(resultado.success).toBe(true);
  });

  it("rechaza una fecha que no tenga formato de fecha", () => {
    const errores = erroresPorCampo(
      ordenValida({ fechaEntrega: "30/09/2026" }),
    );

    expect(errores.fechaEntrega).toBeDefined();
  });
});

describe("nuevaOrdenSchema · prendas", () => {
  it("exige al menos una prenda", () => {
    const errores = erroresPorCampo(ordenValida({ items: [] }));

    expect(errores.items?.[0]).toContain("al menos una prenda");
  });

  it.each([
    ["0", "mayor que cero"],
    ["-5", "mayor que cero"],
    ["4.5", "sin decimales"],
    ["muchas", "número"],
  ])("rechaza la cantidad %s", (cantidad, esperado) => {
    const entrada = ordenValida();
    entrada.items[0].cantidad = cantidad;

    const resultado = nuevaOrdenSchema.safeParse(entrada);

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error.issues[0].message).toContain(esperado);
  });

  it("rechaza un valor negativo", () => {
    const entrada = ordenValida();
    entrada.items[0].valor = "-1000";

    const resultado = nuevaOrdenSchema.safeParse(entrada);

    expect(resultado.success).toBe(false);
  });

  it("acepta un valor con decimales", () => {
    const entrada = ordenValida();
    entrada.items[0].valor = "18500000.50";

    expect(nuevaOrdenSchema.parse(entrada).items[0].valor).toBe(18500000.5);
  });

  it("apunta al índice de la prenda que tiene el error", () => {
    const entrada = ordenValida();
    entrada.items.push({
      descripcion: "Pantalones",
      cantidad: "0",
      tallas: "M:10",
      valor: "500000",
    });

    const resultado = nuevaOrdenSchema.safeParse(entrada);

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error.issues[0].path).toEqual(["items", 1, "cantidad"]);
  });
});

describe("nuevaOrdenSchema · datos del cliente", () => {
  it("rechaza un NIT con letras", () => {
    const errores = erroresPorCampo(ordenValida({ nit: "900ABC456" }));

    expect(errores.nit?.[0]).toContain("números");
  });

  it("acepta un NIT con puntos y guion", () => {
    expect(
      nuevaOrdenSchema.safeParse(ordenValida({ nit: "900.123.456-7" })).success,
    ).toBe(true);
  });

  it.each(["", ".....", "-.-.-", "12.3"])(
    "rechaza el NIT %s porque no tiene números suficientes",
    (nit) => {
      const errores = erroresPorCampo(ordenValida({ nit }));

      expect(errores.nit).toBeDefined();
    },
  );

  it("rechaza un celular con letras", () => {
    const errores = erroresPorCampo(
      ordenValida({ contactoCelular: "no tiene" }),
    );

    expect(errores.contactoCelular).toBeDefined();
  });

  it("acepta un celular escrito con espacios", () => {
    expect(
      nuevaOrdenSchema.safeParse(
        ordenValida({ contactoCelular: "300 123 4567" }),
      ).success,
    ).toBe(true);
  });
});

describe("nuevaOrdenSchema · tallaje", () => {
  function conPrenda(prenda: Record<string, unknown>) {
    return ordenValida({
      items: [
        {
          descripcion: "Camisas",
          valor: "1000",
          cantidad: "",
          tallas: "",
          ...prenda,
        },
      ],
    });
  }

  function errores(entrada: unknown) {
    const resultado = nuevaOrdenSchema.safeParse(entrada);
    return resultado.success ? {} : agruparErrores(resultado.error);
  }

  it("la cantidad es la suma de las tallas y el texto sale en el formato de siempre", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      conPrenda({
        tallaje: "superior_hombre",
        cantidadesPorTalla: { M: "40", S: "20", L: "30", XL: "" },
      }),
    );

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.items[0]).toMatchObject({
      cantidad: 90,
      tallas: "S:20, M:40, L:30",
      tallaje: "superior_hombre",
    });
  });

  it("ignora la cantidad y las tallas que lleguen escritas: manda la cuadrícula", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      conPrenda({
        tallaje: "inferior_dama",
        cantidad: "9999",
        tallas: "XS:9999",
        cantidadesPorTalla: { "8": "5", "10": "7" },
      }),
    );

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.items[0]).toMatchObject({
      cantidad: 12,
      tallas: "8:5, 10:7",
    });
  });

  it("exige al menos una talla con prendas", () => {
    expect(
      errores(
        conPrenda({
          tallaje: "superior_hombre",
          cantidadesPorTalla: { S: "", M: "0" },
        }),
      )["items.0.tallas"]?.[0],
    ).toContain("al menos una talla");
  });

  it("rechaza una talla que no es del tallaje elegido", () => {
    expect(
      errores(
        conPrenda({
          tallaje: "inferior_hombre",
          cantidadesPorTalla: { M: "5" },
        }),
      )["items.0.tallas"]?.[0],
    ).toContain("no es de este tallaje");
  });

  it("rechaza cantidades con decimales o negativas", () => {
    for (const cantidad of ["2.5", "-3", "abc"]) {
      expect(
        errores(
          conPrenda({
            tallaje: "superior_hombre",
            cantidadesPorTalla: { S: cantidad },
          }),
        )["items.0.tallas"]?.[0],
      ).toContain("números enteros");
    }
  });

  it("pide elegir el tallaje cuando llega vacío o desconocido", () => {
    for (const tallaje of ["", "talla_unica"]) {
      expect(errores(conPrenda({ tallaje }))["items.0.tallaje"]?.[0]).toContain(
        "Elige",
      );
    }
  });

  it("con 'otro' se escriben la cantidad y las tallas, como antes", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      conPrenda({ tallaje: "otro", cantidad: "50", tallas: "Única:50" }),
    );

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.items[0]).toMatchObject({
      cantidad: 50,
      tallas: "Única:50",
      tallaje: "otro",
    });

    expect(
      errores(conPrenda({ tallaje: "otro" }))["items.0.cantidad"],
    ).toBeDefined();
    expect(
      errores(conPrenda({ tallaje: "otro" }))["items.0.tallas"],
    ).toBeDefined();
  });

  it("sin tallaje (quien no pasa por el formulario) se comporta como 'otro'", () => {
    const resultado = nuevaOrdenSchema.safeParse(ordenValida());

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.items[0].tallaje).toBe("otro");
    expect(resultado.data.items[0].cantidad).toBe(240);
  });

  it("señala todos los errores de la prenda de una vez", () => {
    const campos = Object.keys(
      errores(
        conPrenda({
          descripcion: "",
          valor: "",
          tallaje: "superior_dama",
          cantidadesPorTalla: {},
        }),
      ),
    );

    expect(campos).toEqual(
      expect.arrayContaining([
        "items.0.descripcion",
        "items.0.valor",
        "items.0.tallas",
      ]),
    );
  });
});
