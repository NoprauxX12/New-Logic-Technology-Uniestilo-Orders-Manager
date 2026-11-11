import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccionEditarOrden } from "@/features/ordenes/components/AccionEditarOrden";

describe("AccionEditarOrden", () => {
  it("si se puede, ofrece «Editar orden» hacia su pantalla", () => {
    render(<AccionEditarOrden ordenId="o1" veredicto={{ permitido: true }} />);

    expect(screen.getByRole("link", { name: "Editar orden" })).toHaveAttribute(
      "href",
      "/ordenes/o1/editar",
    );
  });

  it("si no, no hay enlace: dice por qué", () => {
    render(
      <AccionEditarOrden
        ordenId="o1"
        veredicto={{ permitido: false, mensaje: "Ya pasó a diseño." }}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Ya pasó a diseño.")).toBeInTheDocument();
  });
});
