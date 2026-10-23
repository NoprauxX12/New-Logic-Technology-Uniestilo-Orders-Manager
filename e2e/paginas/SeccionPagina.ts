import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/**
 * Las pantallas de «una etapa, un botón»: cotización, corte, recogido y bordado,
 * marcación y lista para despachar. Todas usan la misma lista de órdenes: una
 * tarjeta por orden con su número y, si le toca a esta persona, el botón
 * «Marcar <etapa>».
 */
export class SeccionPagina {
  constructor(
    private readonly page: Page,
    private readonly ruta: string,
  ) {}

  async abrir() {
    await this.page.goto(this.ruta);
  }

  /** La tarjeta de una orden, buscada por su número de orden de compra. */
  tarjeta(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("article").filter({
      has: this.page.getByRole("heading", {
        name: numeroOrdenCompra,
        exact: true,
      }),
    });
  }

  /** Pulsa «Marcar …» en la tarjeta de la orden y espera a que se registre. */
  async marcar(numeroOrdenCompra: string, accion: string) {
    const boton = this.tarjeta(numeroOrdenCompra).getByRole("button", {
      name: accion,
      exact: true,
    });
    await pulsarYEsperarGuardado(this.page, boton);
    // Registrada la etapa, la orden deja de ofrecer esa acción.
    await expect(boton).toBeHidden();
  }
}
