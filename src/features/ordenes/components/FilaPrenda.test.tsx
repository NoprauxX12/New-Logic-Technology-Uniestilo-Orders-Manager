import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilaPrenda } from "@/features/ordenes/components/FilaPrenda";

/**
 * HU-01 · Cada prenda de la orden es un bloque de campos independiente.
 *
 * Todas las filas mandan sus campos con el mismo `name` a propósito: así el
 * navegador los envía repetidos y `leerFormularioOrden` los reagrupa por
 * posición. El `id`, en cambio, tiene que ser único en toda la página, porque es
 * lo que une una etiqueta con su campo. Cuando se repetía, tocar "Cantidad" en
 * la Prenda 2 enfocaba la Cantidad de la Prenda 1 — se nota sobre todo en el
 * celular, donde la etiqueta es buena parte del área que se toca.
 */

function prendas(erroresDeLaSegunda: Record<string, string[]> = {}) {
  return (
    <>
      <FilaPrenda posicion={0} errores={{}} sePuedeQuitar alQuitar={() => {}} />
      <FilaPrenda
        posicion={1}
        errores={erroresDeLaSegunda}
        sePuedeQuitar
        alQuitar={() => {}}
      />
    </>
  );
}

describe("FilaPrenda · campos de varias prendas", () => {
  it("no repite ningún id entre las filas", () => {
    render(prendas());

    const ids = screen.getAllByRole("textbox").map((campo) => campo.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada etiqueta enfoca el campo de su propia prenda", () => {
    render(prendas());
    const [prenda1, prenda2] = screen.getAllByRole("group");

    const cantidad1 = within(prenda1).getByLabelText("Cantidad");
    const cantidad2 = within(prenda2).getByLabelText("Cantidad");

    expect(cantidad1).not.toBe(cantidad2);
  });

  it("engancha el error a la prenda que lo tiene, no a la anterior", () => {
    render(
      prendas({ "items.1.cantidad": ["La cantidad debe ser mayor que cero"] }),
    );
    const [prenda1, prenda2] = screen.getAllByRole("group");

    expect(
      within(prenda2).getByLabelText("Cantidad"),
    ).toHaveAccessibleDescription(/mayor que cero/);
    expect(
      within(prenda1).getByLabelText("Cantidad"),
    ).not.toHaveAccessibleDescription(/mayor que cero/);
  });
});
