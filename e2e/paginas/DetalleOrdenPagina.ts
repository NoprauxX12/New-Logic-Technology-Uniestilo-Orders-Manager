import type { Locator, Page } from "@playwright/test";

/** Pantalla `/tablero/[ordenId]`: la trazabilidad de una orden. */
export class DetalleOrdenPagina {
  readonly lineaDeTiempo: Locator;

  constructor(private readonly page: Page) {
    this.lineaDeTiempo = page.getByRole("heading", { name: "Línea de tiempo" });
  }

  /** El título de la pantalla es el número de orden de compra. */
  titulo(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("heading", {
      name: numeroOrdenCompra,
      exact: true,
    });
  }
}
