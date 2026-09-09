import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BadgeSemaforo } from "@/features/tablero/components/BadgeSemaforo";
import { EstadoVacioTablero } from "@/features/tablero/components/EstadoVacioTablero";
import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";

describe("EstadoVacioTablero", () => {
  it("muestra mensaje útil cuando no hay órdenes", () => {
    render(<EstadoVacioTablero />);

    expect(screen.getByText(/no hay órdenes registradas/i)).toBeInTheDocument();
  });
});

describe("BadgeSemaforo", () => {
  it("muestra la etiqueta según el semáforo", () => {
    const { rerender } = render(<BadgeSemaforo semaforo="atrasada" />);
    expect(screen.getByText("Atrasada")).toBeInTheDocument();

    rerender(<BadgeSemaforo semaforo="en_riesgo" />);
    expect(screen.getByText("En riesgo")).toBeInTheDocument();

    rerender(<BadgeSemaforo semaforo="a_tiempo" />);
    expect(screen.getByText("A tiempo")).toBeInTheDocument();
  });
});

describe("TableroOrdenes", () => {
  it("muestra estado vacío si la lista viene vacía", () => {
    render(
      <TableroOrdenes
        ordenes={[]}
        resumen={{
          totalOrdenes: 0,
          enProduccion: 0,
          atrasadas: 0,
          enRiesgo: 0,
        }}
      />,
    );

    expect(screen.getByText(/no hay órdenes registradas/i)).toBeInTheDocument();
  });

  it("muestra banner cuando hay atrasadas o en riesgo", () => {
    render(
      <TableroOrdenes
        ordenes={[]}
        resumen={{
          totalOrdenes: 0,
          enProduccion: 0,
          atrasadas: 1,
          enRiesgo: 1,
        }}
      />,
    );

    expect(
      screen.getByText(/1 orden atrasada y 1 en riesgo/i),
    ).toBeInTheDocument();
  });

  it("no muestra banner si no hay atrasadas ni en riesgo", () => {
    render(
      <TableroOrdenes
        ordenes={[]}
        resumen={{
          totalOrdenes: 0,
          enProduccion: 0,
          atrasadas: 0,
          enRiesgo: 0,
        }}
      />,
    );

    expect(screen.queryByText(/revisar prioridad/i)).not.toBeInTheDocument();
  });
});
