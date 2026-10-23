import { expect, type Locator, type Page } from "@playwright/test";

/** Pantalla `/tablero` (HU-14): una fila por orden, con búsqueda y filtros. */
export class TableroPagina {
  readonly buscador: Locator;
  readonly limpiar: Locator;
  readonly quitarFiltros: Locator;
  readonly sinResultados: Locator;
  readonly contador: Locator;

  constructor(private readonly page: Page) {
    this.buscador = page.getByRole("searchbox", {
      name: "Buscar por código o cliente",
    });
    this.limpiar = page.getByRole("button", { name: "Limpiar" });
    this.quitarFiltros = page.getByRole("link", { name: "Quitar filtros" });
    this.sinResultados = page.getByText("Ninguna orden coincide");
    // «3 de 12 órdenes»; hay otro aviso con role=status (atrasadas), por eso el filtro.
    this.contador = page
      .getByRole("status")
      .filter({ hasText: /\d+ de \d+ (orden|órdenes)/ });
  }

  async abrir() {
    await this.page.goto("/tablero");
    await expect(
      this.page.getByRole("heading", { name: "Tablero de producción" }),
    ).toBeVisible();
  }

  /** Escribe en la búsqueda; el tablero espera un instante antes de filtrar. */
  async buscar(texto: string) {
    await this.buscador.fill(texto);
  }

  /** Un botón rápido por su nombre: «Atrasadas», «En riesgo», «Corte»… */
  filtro(nombre: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(`^${nombre}`) });
  }

  /** La fila (tarjeta) de una orden, buscada por su código. */
  fila(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("article").filter({
      has: this.page.getByRole("heading", {
        name: numeroOrdenCompra,
        exact: true,
      }),
    });
  }

  /** Abre el detalle de una orden desde su fila. */
  async abrirTrazabilidad(numeroOrdenCompra: string) {
    await this.fila(numeroOrdenCompra)
      .getByRole("link", { name: /Ver trazabilidad completa/ })
      .click();
  }
}
