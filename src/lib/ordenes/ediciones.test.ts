import { describe, expect, it } from "vitest";

import { describirCambios } from "@/lib/ordenes/ediciones";

describe("describirCambios", () => {
  it("cuenta lo que cambió en la orden con su valor de antes y de después", () => {
    expect(
      describirCambios({
        orden: {
          fecha_entrega: { antes: "2026-11-01", despues: "2026-11-05" },
          observaciones: { antes: null, despues: "Urgente" },
        },
      }),
    ).toEqual([
      "Fecha de entrega: 2026-11-01 → 2026-11-05",
      "Observaciones: (vacío) → Urgente",
    ]);
  });

  it("dice cuando el cambio es del cliente", () => {
    expect(
      describirCambios({
        cliente: { nit: { antes: "900.111.222-3", despues: "901.444.555-6" } },
      }),
    ).toEqual(["Cliente · NIT: 900.111.222-3 → 901.444.555-6"]);
  });

  it("cuenta las prendas agregadas, quitadas y cambiadas", () => {
    expect(
      describirCambios({
        prendas: {
          agregadas: [{ descripcion: "Gorra", cantidad: 3 }],
          quitadas: [{ descripcion: "Pantalón", cantidad: 4 }],
          cambiadas: [
            {
              id: "1",
              descripcion: "Camisa",
              campos: { cantidad: { antes: 10, despues: 15 } },
            },
          ],
        },
      }),
    ).toEqual([
      "Se agregó la prenda: Gorra",
      "Se quitó la prenda: Pantalón",
      "Camisa · Cantidad: 10 → 15",
    ]);
  });

  it("muestra el tallaje con su nombre, no con el identificador", () => {
    expect(
      describirCambios({
        prendas: {
          agregadas: [],
          quitadas: [],
          cambiadas: [
            {
              descripcion: "Camisa",
              campos: {
                tallaje: { antes: "otro", despues: "superior_dama" },
              },
            },
          ],
        },
      }),
    ).toEqual(["Camisa · Tallaje: Otro → Superior dama"]);
  });

  it("si no entiende lo guardado no se rompe la pantalla", () => {
    expect(describirCambios({ orden: "algo raro" })).toEqual([
      "Se cambiaron datos de la orden.",
    ]);
  });
});
