import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import type { OrdenParaSeccion } from "@/features/workflow/queries";

/**
 * La lista con la que una sección marca su etapa (HU-08 corte, HU-12
 * marcación). Una sola pantalla para todas: lo que cambia es el checkpoint.
 *
 * La action se sustituye porque importarla arrastra `server-only`. Aquí se
 * prueba qué se pinta según el veredicto del motor, no el envío.
 */

vi.mock("@/features/workflow/actions", () => ({
  marcarCheckpoint: vi.fn(),
}));

import { marcarCheckpoint } from "@/features/workflow/actions";

// `useRouter` exige el App Router montado; en jsdom no lo hay.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { etiqueta } = buscarCheckpoint("corte_completado");

function orden(parcial: Partial<OrdenParaSeccion>): OrdenParaSeccion {
  return {
    id: "00000000-0000-0000-0000-0000000000f2",
    numeroOrdenCompra: "OC-5002",
    razonSocial: "Colegio San Ignacio",
    fechaEntrega: "2026-10-17",
    fechaIngreso: "2026-09-01",
    yaMarcada: false,
    fechaMarcado: null,
    veredicto: { permitido: true },
    fichas: [],
    cerrada: false,
    noAplica: false,
    etapasFaltantes: 0,
    ...parcial,
  };
}

describe("ListaOrdenesSeccion", () => {
  it("avisa cuando no hay órdenes", () => {
    render(<ListaOrdenesSeccion ordenes={[]} checkpoint="corte_completado" />);

    expect(screen.getByText(/no hay órdenes/i)).toBeInTheDocument();
  });

  it("ofrece marcar la etapa cuando el motor lo permite", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[orden({})]}
        checkpoint="corte_completado"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: new RegExp(`marcar ${etiqueta}`, "i"),
      }),
    ).toBeEnabled();
  });

  it("deshabilita el botón y dice por qué cuando el motor no deja", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[
          orden({
            veredicto: {
              permitido: false,
              motivo: "fuera_de_secuencia",
              mensaje: 'Antes hay que marcar "Tela programada".',
            },
          }),
        ]}
        checkpoint="corte_completado"
      />,
    );

    const boton = screen.getByRole("button", {
      name: new RegExp(`marcar ${etiqueta}`, "i"),
    });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/Tela programada/);
  });

  it("muestra la etapa como hecha en vez de un botón cuando ya se marcó", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[
          orden({ yaMarcada: true, fechaMarcado: new Date().toISOString() }),
        ]}
        checkpoint="corte_completado"
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(new RegExp(etiqueta, "i"))).toBeInTheDocument();
  });
});

/**
 * Cómo se arma la lista: lo que le toca a la sección arriba y por urgencia, lo
 * que aún no llega plegado debajo, lo ya marcado plegado al final, y lo cerrado
 * en ningún lado. La regla de fondo está en `agrupacion.test.ts`; aquí se prueba
 * lo que se pinta.
 */
describe("ListaOrdenesSeccion · grupos", () => {
  const bloqueada: Partial<OrdenParaSeccion> = {
    veredicto: {
      permitido: false,
      motivo: "fuera_de_secuencia",
      mensaje: 'Antes hay que marcar "Tela programada".',
    },
    etapasFaltantes: 2,
  };

  function pintar(ordenes: OrdenParaSeccion[], props = {}) {
    return render(
      <ListaOrdenesSeccion
        ordenes={ordenes}
        checkpoint="corte_completado"
        {...props}
      />,
    );
  }

  it("pone arriba lo que toca marcar, con su conteo, y plega lo demás", () => {
    pintar([
      orden({ id: "a", numeroOrdenCompra: "OC-MARCAR" }),
      orden({ id: "b", numeroOrdenCompra: "OC-ESPERA", ...bloqueada }),
      orden({
        id: "c",
        numeroOrdenCompra: "OC-HECHA",
        yaMarcada: true,
        fechaMarcado: new Date().toISOString(),
      }),
    ]);

    expect(
      screen.getByRole("heading", { name: /Para marcar ahora \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todavía no llegan a esta etapa (1)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Marcadas en los últimos 7 días \(1\)/),
    ).toBeInTheDocument();

    // Los dos grupos secundarios arrancan plegados.
    for (const resumen of screen.getAllByText(/\(1\)$/, {
      selector: "summary",
    })) {
      expect(resumen.closest("details")).not.toHaveAttribute("open");
    }
  });

  it("dentro de «para marcar» van primero las atrasadas y luego las de entrega más cercana", () => {
    const manana = new Date(Date.now() + 40 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const ayer = new Date(Date.now() - 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const lejos = new Date(Date.now() + 90 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    pintar([
      orden({ id: "1", numeroOrdenCompra: "OC-LEJOS", fechaEntrega: lejos }),
      orden({ id: "2", numeroOrdenCompra: "OC-ATRASADA", fechaEntrega: ayer }),
      orden({ id: "3", numeroOrdenCompra: "OC-CERCA", fechaEntrega: manana }),
    ]);

    const titulos = screen
      .getAllByRole("heading", { level: 3 })
      .map((encabezado) => encabezado.textContent);

    expect(titulos).toEqual(["OC-ATRASADA", "OC-CERCA", "OC-LEJOS"]);
  });

  it("una orden cerrada no se muestra en ningún grupo", () => {
    pintar([
      orden({ id: "x", numeroOrdenCompra: "OC-CERRADA", cerrada: true }),
      orden({ id: "y", numeroOrdenCompra: "OC-ABIERTA" }),
    ]);

    expect(screen.queryByText("OC-CERRADA")).toBeNull();
    expect(screen.getByText("OC-ABIERTA")).toBeInTheDocument();
  });

  it("si nada toca marcar, lo dice y cuenta cuántas esperan", () => {
    pintar([
      orden({ id: "b", ...bloqueada }),
      orden({ id: "c", ...bloqueada }),
    ]);

    expect(
      screen.getByText("No hay órdenes para marcar ahora"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Hay 2 órdenes esperando que terminen etapas anteriores/,
      ),
    ).toBeInTheDocument();
  });

  it("con conTitulos en falso no pinta el título del primer grupo", () => {
    pintar([orden({})], { conTitulos: false });

    expect(
      screen.queryByRole("heading", { name: /Para marcar ahora/ }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /marcar/i })).toBeEnabled();
  });

  it("con leyendaDesde dice cuánto lleva esperando la orden", () => {
    const haceTresDias = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();

    pintar([orden({ fechaMarcado: haceTresDias })], {
      leyendaDesde: "Cotización enviada",
    });

    expect(
      screen.getByText("Cotización enviada hace 3 días"),
    ).toBeInTheDocument();
  });

  it("al marcar con éxito avisa arriba de la lista, porque la tarjeta cambia de grupo", async () => {
    vi.mocked(marcarCheckpoint).mockResolvedValueOnce({
      ok: true,
      mensaje: "Listo: Corte completado.",
    });

    pintar([orden({ numeroOrdenCompra: "OC-AVISO" })]);
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`marcar ${etiqueta}`, "i"),
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Listo: Corte completado.",
    );
  });

  it("si marcar falla, el error se queda en la tarjeta de esa orden", async () => {
    vi.mocked(marcarCheckpoint).mockResolvedValueOnce({
      ok: false,
      mensaje: "Esta orden ya cambió. Recarga la pantalla.",
    });

    pintar([orden({})]);
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`marcar ${etiqueta}`, "i"),
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta orden ya cambió",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
