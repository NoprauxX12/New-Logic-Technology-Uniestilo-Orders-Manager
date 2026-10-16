import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TextoAsistente } from "@/features/asistente/components/TextoAsistente";

describe("TextoAsistente", () => {
  it("pinta negritas y viñetas", () => {
    render(
      <TextoAsistente
        texto={
          "**Órdenes atrasadas**\n\n- OC-5005 de Clínica del Norte\n- OC-5004 de Transportes La Mesa"
        }
      />,
    );

    expect(screen.getByText("Órdenes atrasadas").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("convierte las rutas de la aplicación en enlaces y avisa al tocarlos", () => {
    const alNavegar = vi.fn();
    render(
      <TextoAsistente
        texto="Va en corte. [Consúltala aquí](/tablero/00000000-0000-0000-0000-0000000000f3)"
        alNavegar={alNavegar}
      />,
    );

    const enlace = screen.getByRole("link", { name: "Consúltala aquí" });
    expect(enlace).toHaveAttribute(
      "href",
      "/tablero/00000000-0000-0000-0000-0000000000f3",
    );

    fireEvent.click(enlace);
    expect(alNavegar).toHaveBeenCalledTimes(1);
  });

  it("deja como texto cualquier dirección que no sea de la aplicación", () => {
    render(<TextoAsistente texto="Mira [esto](https://ejemplo.com)." />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/esto/)).toBeInTheDocument();
  });

  it("no inyecta HTML crudo", () => {
    render(<TextoAsistente texto={'Hola <img src=x onerror="alert(1)">'} />);

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Hola")).toBeInTheDocument();
  });

  it("si llega una tabla, la deja desplazar de lado", () => {
    render(
      <TextoAsistente
        texto={"| OC | Cliente |\n|----|---------|\n| OC-5003 | Colegio |"}
      />,
    );

    const tabla = screen.getByRole("table");
    expect(tabla.parentElement).toHaveClass("overflow-x-auto");
  });
});
