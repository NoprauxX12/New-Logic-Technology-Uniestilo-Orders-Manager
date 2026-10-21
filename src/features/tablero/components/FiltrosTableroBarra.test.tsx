import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiltrosTableroBarra } from "@/features/tablero/components/FiltrosTableroBarra";
import type { ConteosTablero, FiltrosTablero } from "@/lib/ordenes/filtros";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/tablero",
}));

const CONTEOS: ConteosTablero = {
  filtro: { atrasadas: 2, en_riesgo: 1, esta_semana: 3 },
  donde: { corte: 4, bordado: 0, taller: 1, marcacion: 2 },
};
const SIN: FiltrosTablero = { q: "", filtro: null, donde: null };

function dibujar(filtros: FiltrosTablero = SIN, mostradas = 10) {
  return render(
    <FiltrosTableroBarra
      filtros={filtros}
      conteos={CONTEOS}
      mostradas={mostradas}
      total={10}
    />,
  );
}

describe("FiltrosTableroBarra", () => {
  beforeEach(() => {
    replace.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("muestra el conteo en cada botón", () => {
    dibujar();
    expect(screen.getByRole("button", { name: /Atrasadas/ })).toHaveTextContent(
      "2",
    );
    expect(screen.getByRole("button", { name: /En taller/ })).toHaveTextContent(
      "1",
    );
  });

  it("al tocar un botón escribe el filtro en la URL", () => {
    dibujar();
    fireEvent.click(screen.getByRole("button", { name: /Atrasadas/ }));
    expect(replace).toHaveBeenCalledWith("/tablero?filtro=atrasadas", {
      scroll: false,
    });
  });

  it("tocar el botón activo lo quita y conserva los demás", () => {
    dibujar({ q: "san", filtro: "atrasadas", donde: "corte" });
    fireEvent.click(screen.getByRole("button", { name: /Atrasadas/ }));
    expect(replace).toHaveBeenCalledWith("/tablero?q=san&donde=corte", {
      scroll: false,
    });
  });

  it("busca al dejar de escribir, no en cada letra", () => {
    dibujar();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "san jose" },
    });
    expect(replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(replace).toHaveBeenCalledWith("/tablero?q=san+jose", {
      scroll: false,
    });
  });

  it("sin filtros no muestra Limpiar ni el conteo; con filtros sí", () => {
    const { unmount } = dibujar();
    expect(screen.queryByRole("button", { name: "Limpiar" })).toBeNull();
    expect(screen.queryByText(/ de 10 órdenes/)).toBeNull();
    unmount();

    dibujar({ q: "", filtro: "en_riesgo", donde: null }, 1);
    expect(screen.getByText("1 de 10 órdenes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(replace).toHaveBeenCalledWith("/tablero", { scroll: false });
  });

  it("marca como presionado el botón activo", () => {
    dibujar({ q: "", filtro: null, donde: "taller" });
    expect(screen.getByRole("button", { name: /En taller/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
