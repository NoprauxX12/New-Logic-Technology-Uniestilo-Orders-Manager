import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/** Pantalla `/ordenes/programacion` (HU-03): la hoja de programación a diseño. */
export class ProgramacionPagina {
  readonly programar: Locator;

  constructor(private readonly page: Page) {
    this.programar = page.getByRole("button", { name: "Programar a diseño" });
  }

  async abrir() {
    await this.page.goto("/ordenes/programacion");
  }

  /** El botón de una orden sin programar: dice su número y el cliente. */
  orden(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("button", {
      name: new RegExp(`${numeroOrdenCompra} ·`),
    });
  }

  /** Agrega la orden a la hoja y la programa. */
  async programarOrden(numeroOrdenCompra: string) {
    const orden = this.orden(numeroOrdenCompra);
    await orden.click();
    await expect(orden).toHaveAttribute("aria-pressed", "true");

    await pulsarYEsperarGuardado(this.page, this.programar);
    await expect(
      this.page.getByRole("status").filter({ hasText: /programación #\d+/ }),
    ).toBeVisible();
  }
}
