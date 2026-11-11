import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/** Pantalla `/ordenes/insumos` (HU-23): los insumos que lleva cada orden. */
export class InsumosPagina {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/ordenes/insumos");
  }

  /** La tarjeta de una orden, por su número de orden de compra. */
  tarjeta(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("article").filter({
      has: this.page.getByRole("heading", {
        name: numeroOrdenCompra,
        exact: true,
      }),
    });
  }

  /** Las órdenes a las que les toca validar los insumos. */
  paraValidar(): Locator {
    return this.page.locator("section").filter({
      has: this.page.getByRole("heading", { name: /Para validar ahora/ }),
    });
  }

  /** Marca cada insumo (por su nombre en pantalla), escribe su detalle y valida. */
  async validar(numeroOrdenCompra: string, insumos: Record<string, string>) {
    const tarjeta = this.tarjeta(numeroOrdenCompra);

    for (const [nombre, detalle] of Object.entries(insumos)) {
      await tarjeta
        .getByRole("checkbox", { name: nombre, exact: true })
        .check();
      await tarjeta
        .getByLabel(`Cuánto y cómo: ${nombre.toLowerCase()}`)
        .fill(detalle);
    }

    await pulsarYEsperarGuardado(
      this.page,
      tarjeta.getByRole("button", { name: "Marcar insumos validados" }),
    );
    await expect(this.page.getByRole("status")).toContainText(
      "Insumos validados",
    );
  }
}
