import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import { EstadoVacioTablero } from "@/features/tablero/components/EstadoVacioTablero";
import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";
import type { ConteosTablero } from "@/lib/ordenes/filtros";
import { SIN_FILTROS } from "@/lib/ordenes/filtros";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tablero",
}));

const CONTEOS_VACIOS: ConteosTablero = {
  filtro: { atrasadas: 0, en_riesgo: 0, esta_semana: 0 },
  donde: { corte: 0, bordado: 0, taller: 0, marcacion: 0 },
};

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
        totalOrdenes={0}
        filtros={SIN_FILTROS}
        conteos={CONTEOS_VACIOS}
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
        totalOrdenes={0}
        filtros={SIN_FILTROS}
        conteos={CONTEOS_VACIOS}
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
        totalOrdenes={0}
        filtros={SIN_FILTROS}
        conteos={CONTEOS_VACIOS}
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

  it("avisa que ninguna orden coincide y ofrece quitar los filtros", () => {
    render(
      <TableroOrdenes
        ordenes={[]}
        totalOrdenes={5}
        filtros={{ q: "zzz", filtro: null, donde: null }}
        conteos={CONTEOS_VACIOS}
        resumen={{
          totalOrdenes: 5,
          enProduccion: 0,
          atrasadas: 0,
          enRiesgo: 0,
        }}
      />,
    );

    expect(screen.getByText("Ninguna orden coincide")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Quitar filtros" }),
    ).toHaveAttribute("href", "/tablero");
    expect(screen.getByText("0 de 5 órdenes")).toBeInTheDocument();
  });
});
