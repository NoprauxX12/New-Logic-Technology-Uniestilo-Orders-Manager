import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoProgramacion } from "@/features/programacion/actions";
import { FormularioProgramacion } from "@/features/programacion/components/FormularioProgramacion";
import { ENTRADA_VACIA } from "@/features/programacion/formulario";
import type { OrdenPorProgramar } from "@/features/programacion/queries";

/**
 * HU-03 · El formulario con el que se arma la hoja.
 *
 * La action de verdad importa `server-only` y el cliente de Supabase, que no se
 * pueden cargar en jsdom, así que se reemplaza por una función falsa. Lo que se
 * prueba es el comportamiento de la pantalla: que la posición sea el orden en
 * que se tocan las órdenes, que no haya tope, y que mande un par
 * `ordenId` + número por cada orden agregada.
 */

const programarOrdenes = vi.hoisted(() => vi.fn());

vi.mock("@/features/programacion/actions", () => ({
  programarOrdenes,
  ESTADO_INICIAL: {
    ok: false,
    mensaje: "",
    errores: {},
    valores: { programaciones: [] },
  },
}));

const ESTADO_OK: EstadoProgramacion = {
  ok: true,
  mensaje: "Listo: 2 órdenes quedaron programadas a diseño.",
  errores: {},
  valores: ENTRADA_VACIA,
};

function orden(
  id: string,
  razonSocial: string,
  referencias: { id: string; descripcion: string; cantidad: number }[],
): OrdenPorProgramar {
  return {
    id,
    numeroOrdenCompra: `OC-${id.slice(-2)}`,
    razonSocial,
    fechaIngreso: "2026-09-28",
    fechaEntrega: "2026-11-02",
    referencias,
    totalPrendas: referencias.reduce((total, r) => total + r.cantidad, 0),
    marcados: [],
  };
}

const ORDENES: OrdenPorProgramar[] = [
  orden("00000000-0000-0000-0000-0000000000f1", "Colegio San Ignacio", [
    { id: "i1", descripcion: "Camisas blancas", cantidad: 120 },
    { id: "i2", descripcion: "Pantalones grises", cantidad: 120 },
  ]),
  orden("00000000-0000-0000-0000-0000000000f8", "Ferretería La 33", [
    { id: "i3", descripcion: "Camisa tipo polo", cantidad: 60 },
  ]),
  orden("00000000-0000-0000-0000-0000000000f9", "Clínica del Norte", [
    { id: "i4", descripcion: "Bata antifluido", cantidad: 40 },
  ]),
];

function agregar(razonSocial: string) {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(razonSocial) }),
  );
}

describe("FormularioProgramacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    programarOrdenes.mockResolvedValue(ESTADO_OK);
  });

  it("muestra las órdenes por programar con sus referencias y su total", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(
      screen.getByRole("button", { name: /Colegio San Ignacio/ }),
    ).toHaveTextContent("2 referencias · 240 prendas");
  });

  it("no se puede guardar una hoja vacía", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(
      screen.getByRole("button", { name: "Programar a diseño" }),
    ).toBeDisabled();
  });

  it("la posición es el orden en que se tocan, no el de la lista", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    agregar("Clínica del Norte");
    agregar("Colegio San Ignacio");

    expect(screen.getByLabelText("1 · Clínica del Norte")).toBeInTheDocument();
    expect(
      screen.getByLabelText("2 · Colegio San Ignacio"),
    ).toBeInTheDocument();
  });

  it("al quitar una orden, las siguientes se renumeran", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    agregar("Colegio San Ignacio");
    agregar("Ferretería La 33");
    agregar("Clínica del Norte");
    agregar("Ferretería La 33");

    expect(
      screen.getByLabelText("1 · Colegio San Ignacio"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("2 · Clínica del Norte")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ferretería La 33/)).toBeNull();
  });

  it("deja agregar todas las que haya: cinco o seis no es un tope", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    for (const razonSocial of [
      "Colegio San Ignacio",
      "Ferretería La 33",
      "Clínica del Norte",
    ]) {
      agregar(razonSocial);
    }

    expect(screen.getByText("3 órdenes")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Programar a diseño" }),
    ).toBeEnabled();
  });

  it("manda un par de orden y número por cada orden agregada", async () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    agregar("Colegio San Ignacio");
    agregar("Ferretería La 33");

    fireEvent.change(screen.getByLabelText("1 · Colegio San Ignacio"), {
      target: { value: "PR-104" },
    });
    fireEvent.change(screen.getByLabelText("2 · Ferretería La 33"), {
      target: { value: "PR-105" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Programar a diseño" }));

    await waitFor(() => expect(programarOrdenes).toHaveBeenCalled());

    const formData = programarOrdenes.mock.calls[0][1] as FormData;

    expect(formData.getAll("ordenId")).toEqual([
      "00000000-0000-0000-0000-0000000000f1",
      "00000000-0000-0000-0000-0000000000f8",
    ]);
    expect(formData.getAll("numeroOrdenProgramacion")).toEqual([
      "PR-104",
      "PR-105",
    ]);
  });

  it("pinta el error de la action junto a la orden que lo causó", async () => {
    programarOrdenes.mockResolvedValue({
      ok: false,
      mensaje: "Cambia los números de programación que ya están usados.",
      errores: {
        "00000000-0000-0000-0000-0000000000f1": [
          "Ese número de programación ya está usado.",
        ],
      },
      valores: {
        programaciones: [
          {
            ordenId: "00000000-0000-0000-0000-0000000000f1",
            numeroOrdenProgramacion: "PR-104",
          },
        ],
      },
    } satisfies EstadoProgramacion);

    render(<FormularioProgramacion ordenes={ORDENES} />);

    agregar("Colegio San Ignacio");
    fireEvent.click(screen.getByRole("button", { name: "Programar a diseño" }));

    expect(
      await screen.findByText("Ese número de programación ya está usado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cambia los números de programación que ya están usados.",
      ),
    ).toBeInTheDocument();
  });

  it("no pide escoger quién programa: eso sale de la sesión", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText(/quién programa/i)).toBeNull();
  });
});
