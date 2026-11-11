import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormularioOrden } from "@/features/ordenes/components/FormularioOrden";
import type { EntradaFormularioOrden } from "@/features/ordenes/formulario";

/**
 * Al editar, cada fila representa una prenda guardada. El riesgo es que quitar
 * una fila del medio corra las posiciones y el id de una prenda quede pegado a
 * los datos de otra: la base actualizaría la prenda equivocada.
 */

function prenda(itemId: string, descripcion: string) {
  return {
    itemId,
    descripcion,
    cantidad: "5",
    tallas: "M:5",
    valor: "100",
    observaciones: "",
    tallaje: "otro",
  };
}

const VALORES: EntradaFormularioOrden = {
  numeroOrdenCompra: "OC-1",
  nit: "900.111.222-3",
  razonSocial: "Colegio",
  contactoNombre: "Marta",
  contactoCelular: "3000000000",
  fechaIngreso: "2026-11-01",
  fechaEntrega: "2026-11-20",
  observaciones: "",
  items: [
    prenda("id-camisa", "Camisa"),
    prenda("id-pantalon", "Pantalón"),
    prenda("id-gorra", "Gorra"),
  ],
};

function renderizar() {
  return render(
    <FormularioOrden
      accion={vi.fn()}
      valoresIniciales={VALORES}
      ordenId="orden-1"
      textoGuardar="Guardar cambios"
      ayudaCliente="Ayuda"
    />,
  );
}

function filas() {
  return screen.getAllByRole("group").map((fila) => ({
    descripcion:
      within(fila).getByLabelText<HTMLInputElement>("¿Qué prenda es?").value,
    itemId: fila.querySelector<HTMLInputElement>('input[name="itemId"]')?.value,
  }));
}

describe("FormularioOrden · editar", () => {
  it("arranca con lo guardado, cada prenda con su id", () => {
    renderizar();

    expect(screen.getByLabelText<HTMLInputElement>("NIT").value).toBe(
      "900.111.222-3",
    );
    expect(filas()).toEqual([
      { descripcion: "Camisa", itemId: "id-camisa" },
      { descripcion: "Pantalón", itemId: "id-pantalon" },
      { descripcion: "Gorra", itemId: "id-gorra" },
    ]);
  });

  it("dice cuál orden es", () => {
    const { container } = renderizar();

    expect(
      container.querySelector<HTMLInputElement>('input[name="ordenId"]')?.value,
    ).toBe("orden-1");
  });

  it("quitar una prenda del medio no mezcla el id de una con los datos de otra", () => {
    renderizar();

    const pantalon = screen.getByRole("group", { name: "Prenda 2" });
    fireEvent.click(
      within(pantalon).getByRole("button", { name: "Quitar esta prenda" }),
    );

    expect(filas()).toEqual([
      { descripcion: "Camisa", itemId: "id-camisa" },
      { descripcion: "Gorra", itemId: "id-gorra" },
    ]);
  });

  it("una prenda agregada va sin id: es nueva", () => {
    renderizar();

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar otra prenda" }),
    );

    expect(filas().at(-1)).toEqual({ descripcion: "", itemId: "" });
  });
});
