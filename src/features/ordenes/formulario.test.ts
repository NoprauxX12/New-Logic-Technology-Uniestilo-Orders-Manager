import { describe, expect, it } from "vitest";

import {
  agruparErrores,
  leerFormularioOrden,
} from "@/features/ordenes/formulario";
import { nuevaOrdenSchema } from "@/features/ordenes/schemas";

/**
 * HU-01 · Pruebas de la traducción formulario → esquema.
 * Aquí vive el riesgo de que las prendas se mezclen entre filas.
 */

/** Construye el FormData que enviaría el navegador. */
function formularioCon(
  orden: Record<string, string>,
  prendas: Record<string, string>[] = [],
) {
  const formData = new FormData();

  for (const [campo, valor] of Object.entries(orden)) {
    formData.set(campo, valor);
  }

  // Cada prenda agrega otra repetición de los mismos nombres de campo.
  for (const prenda of prendas) {
    formData.append("descripcion", prenda.descripcion ?? "");
    formData.append("cantidad", prenda.cantidad ?? "");
    formData.append("tallas", prenda.tallas ?? "");
    formData.append("valor", prenda.valor ?? "");
    formData.append("observacionesItem", prenda.observaciones ?? "");
  }

  return formData;
}

const ORDEN_BASE = {
  numeroOrdenCompra: "OC-4412",
  nit: "900.123.456-7",
  razonSocial: "Universidad EAFIT",
  contactoNombre: "Laura Gómez",
  contactoCelular: "3001234567",
  fechaIngreso: "2026-09-01",
  fechaEntrega: "2026-09-30",
  observaciones: "",
};

describe("leerFormularioOrden", () => {
  it("lee los campos de la orden", () => {
    const datos = leerFormularioOrden(formularioCon(ORDEN_BASE));

    expect(datos.numeroOrdenCompra).toBe("OC-4412");
    expect(datos.razonSocial).toBe("Universidad EAFIT");
    expect(datos.fechaEntrega).toBe("2026-09-30");
  });

  it("devuelve texto vacío para un campo que el formulario no envió", () => {
    const datos = leerFormularioOrden(new FormData());

    expect(datos.numeroOrdenCompra).toBe("");
    expect(datos.items).toEqual([]);
  });

  it("arma una prenda por fila sin mezclar los valores", () => {
    const datos = leerFormularioOrden(
      formularioCon(ORDEN_BASE, [
        {
          descripcion: "Camisas",
          cantidad: "240",
          tallas: "M:240",
          valor: "18500000",
        },
        {
          descripcion: "Pantalones",
          cantidad: "100",
          tallas: "L:100",
          valor: "9000000",
        },
      ]),
    );

    expect(datos.items).toHaveLength(2);
    expect(datos.items[0]).toMatchObject({
      descripcion: "Camisas",
      cantidad: "240",
      valor: "18500000",
    });
    expect(datos.items[1]).toMatchObject({
      descripcion: "Pantalones",
      cantidad: "100",
      valor: "9000000",
    });
  });

  it("conserva la posición de la prenda a la que le falta un dato", () => {
    const datos = leerFormularioOrden(
      formularioCon(ORDEN_BASE, [
        {
          descripcion: "Camisas",
          cantidad: "240",
          tallas: "M:240",
          valor: "1",
        },
        {
          descripcion: "Pantalones",
          cantidad: "",
          tallas: "L:100",
          valor: "2",
        },
      ]),
    );

    expect(datos.items[1].cantidad).toBe("");
    expect(datos.items[1].descripcion).toBe("Pantalones");
  });

  it("produce datos que el esquema acepta", () => {
    const datos = leerFormularioOrden(
      formularioCon(ORDEN_BASE, [
        {
          descripcion: "Camisas",
          cantidad: "240",
          tallas: "M:240",
          valor: "18500000",
        },
      ]),
    );

    expect(nuevaOrdenSchema.safeParse(datos).success).toBe(true);
  });
});

describe("agruparErrores", () => {
  it("agrupa los errores de la orden por nombre de campo", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      leerFormularioOrden(
        formularioCon({ ...ORDEN_BASE, razonSocial: "" }, [
          { descripcion: "Camisas", cantidad: "240", tallas: "M", valor: "1" },
        ]),
      ),
    );

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    const errores = agruparErrores(resultado.error);

    expect(errores.razonSocial?.[0]).toContain("razón social");
    expect(errores.numeroOrdenCompra).toBeUndefined();
  });

  it("apunta al número de la prenda que tiene el error", () => {
    const resultado = nuevaOrdenSchema.safeParse(
      leerFormularioOrden(
        formularioCon(ORDEN_BASE, [
          { descripcion: "Camisas", cantidad: "240", tallas: "M", valor: "1" },
          { descripcion: "Pantalones", cantidad: "0", tallas: "L", valor: "2" },
        ]),
      ),
    );

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    const errores = agruparErrores(resultado.error);

    expect(errores["items.1.cantidad"]?.[0]).toContain("mayor que cero");
    expect(errores["items.0.cantidad"]).toBeUndefined();
  });
});
