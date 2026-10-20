import { fireEvent, render, screen, within } from "@testing-library/react";
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

/** Las dos filas con "Otro", donde se escriben cantidad y tallas a mano. */
const ESCRITAS = {
  descripcion: "",
  cantidad: "",
  tallas: "",
  valor: "",
  observaciones: "",
  tallaje: "otro",
};

function prendas(erroresDeLaSegunda: Record<string, string[]> = {}) {
  return (
    <>
      <FilaPrenda
        posicion={0}
        errores={{}}
        valores={ESCRITAS}
        sePuedeQuitar
        alQuitar={() => {}}
      />
      <FilaPrenda
        posicion={1}
        errores={erroresDeLaSegunda}
        valores={ESCRITAS}
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

/**
 * Las tallas se eligen: primero el tallaje y luego cuántas prendas de cada
 * talla. La cantidad de la prenda es la suma y se muestra sola.
 */
describe("FilaPrenda · tallaje", () => {
  function fila(valores?: Parameters<typeof FilaPrenda>[0]["valores"]) {
    return render(
      <FilaPrenda
        posicion={2}
        errores={{}}
        valores={valores}
        sePuedeQuitar
        alQuitar={() => {}}
      />,
    );
  }

  function elegir(tallaje: string) {
    fireEvent.change(screen.getByLabelText(/qué tipo de prenda/i), {
      target: { value: tallaje },
    });
  }

  it("ofrece los cuatro tallajes y 'Otro'", () => {
    fila();

    const opciones = within(screen.getByLabelText(/qué tipo de prenda/i))
      .getAllByRole("option")
      .map((opcion) => opcion.textContent);

    expect(opciones).toEqual([
      "Elige una opción",
      "Superior hombre",
      "Inferior hombre",
      "Superior dama",
      "Inferior dama",
      "Otro (escribir las tallas)",
    ]);
  });

  it("mientras no se elige tallaje no muestra casillas ni campos de tallas", () => {
    fila();

    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tallas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("XS")).not.toBeInTheDocument();
  });

  it("muestra una casilla por talla del tallaje elegido, nombrada por prenda y talla", () => {
    fila();
    elegir("superior_hombre");

    expect(screen.getByLabelText("XXS")).toHaveAttribute("name", "talla.2.XXS");
    expect(screen.getByLabelText("6XL")).toHaveAttribute("name", "talla.2.6XL");
    expect(screen.queryByLabelText("28")).not.toBeInTheDocument();
  });

  it("la cantidad es la suma de las casillas y se actualiza al escribir", () => {
    fila();
    elegir("inferior_hombre");

    expect(screen.getByRole("status")).toHaveTextContent("Total: 0 prendas");

    fireEvent.change(screen.getByLabelText("30"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("32"), { target: { value: "8" } });

    expect(screen.getByRole("status")).toHaveTextContent("Total: 20 prendas");
  });

  it("lo ilegible o negativo no suma", () => {
    fila();
    elegir("superior_dama");

    fireEvent.change(screen.getByLabelText("2"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("4"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("6"), { target: { value: "3" } });

    expect(screen.getByRole("status")).toHaveTextContent("Total: 3 prendas");
  });

  it("manda cantidad y tallas siempre, para no desalinear las prendas", () => {
    const { container } = fila();

    // Sin elegir, con tallaje y con "Otro": en los tres casos hay un `cantidad`
    // y un `tallas` por fila, como pide leerFormularioOrden.
    for (const tallaje of ["", "superior_hombre", "otro"]) {
      elegir(tallaje);
      expect(container.querySelectorAll('[name="cantidad"]')).toHaveLength(1);
      expect(container.querySelectorAll('[name="tallas"]')).toHaveLength(1);
    }
  });

  it("con 'Otro' vuelven los campos de siempre", () => {
    fila();
    elegir("otro");

    expect(screen.getByLabelText("Cantidad")).toBeInTheDocument();
    expect(screen.getByLabelText("Tallas")).toBeInTheDocument();
    expect(screen.queryByLabelText("XS")).not.toBeInTheDocument();
  });

  it("conserva lo escrito si la orden volvió con errores", () => {
    fila({
      descripcion: "Camisas",
      cantidad: "",
      tallas: "",
      valor: "1",
      observaciones: "",
      tallaje: "superior_hombre",
      cantidadesPorTalla: { S: "20", M: "40" },
    });

    expect(screen.getByLabelText(/qué tipo de prenda/i)).toHaveValue(
      "superior_hombre",
    );
    expect(screen.getByLabelText("S")).toHaveValue("20");
    expect(screen.getByRole("status")).toHaveTextContent("Total: 60 prendas");
  });

  it("muestra los errores del tallaje y de las tallas", () => {
    render(
      <FilaPrenda
        posicion={0}
        errores={{
          "items.0.tallaje": ["Elige para qué tipo de prenda son las tallas"],
        }}
        sePuedeQuitar
        alQuitar={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Elige para qué tipo/);
  });
});
