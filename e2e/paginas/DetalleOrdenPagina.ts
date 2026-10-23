import type { Locator, Page } from "@playwright/test";

/** Pantalla `/tablero/[ordenId]`: la trazabilidad de una orden. */
export class DetalleOrdenPagina {
  readonly lineaDeTiempo: Locator;

  constructor(private readonly page: Page) {
    this.lineaDeTiempo = page.getByRole("heading", { name: "Línea de tiempo" });
  }

  /**
   * El título de la pantalla es el número de orden de compra, en un `<h1>`. La
   * lista del tablero también lo muestra, pero en un `<h2>`: por eso el nivel,
   * para no confundir «ya llegué al detalle» con «lo veo en la lista».
   */
  titulo(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("heading", {
      level: 1,
      name: numeroOrdenCompra,
      exact: true,
    });
  }
}
