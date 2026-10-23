import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/**
 * `/ordenes/talleres` y el detalle de la orden (HU-10 y HU-11): logística manda un
 * lote a un taller satélite y después confirma que volvió.
 */
export class TalleresPagina {
  readonly taller: Locator;
  readonly prendasEnviadas: Locator;

  constructor(private readonly page: Page) {
    this.taller = page.getByLabel("¿A qué taller se envió?");
    this.prendasEnviadas = page.getByLabel("¿Qué prendas se enviaron?");
  }

  async abrir() {
    await this.page.goto("/ordenes/talleres");
  }

  /** Desde la lista, entra al detalle de la orden. */
  async abrirOrden(numeroOrdenCompra: string) {
    await this.page
      .getByRole("link", { name: `Abrir ${numeroOrdenCompra}` })
      .click();
    await expect(this.page).toHaveURL(/\/ordenes\/[0-9a-f-]{36}$/);
  }

  /** El enlace a la ficha técnica en el detalle de la orden. */
  ficha(): Locator {
    return this.page.getByRole("link", { name: /ficha-tecnica\.pdf/ });
  }

  async despachar(taller: string, prendas: string) {
    await this.taller.fill(taller);
    await this.prendasEnviadas.fill(prendas);
    await pulsarYEsperarGuardado(
      this.page,
      this.page.getByRole("button", { name: "Marcar como despachado" }),
    );
    await expect(this.page.getByRole("status").first()).toBeVisible();
  }

  /** El lote volvió completo. */
  async confirmarRecepcionCompleta() {
    await this.page.getByLabel("Sí, completo").check();
    await pulsarYEsperarGuardado(
      this.page,
      this.page.getByRole("button", { name: "Confirmar recepción" }),
    );
    await expect(
      this.page.getByRole("button", { name: "Confirmar recepción" }),
    ).toBeHidden();
  }
}
