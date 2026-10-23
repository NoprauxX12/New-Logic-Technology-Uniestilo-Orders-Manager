import type { Locator, Page } from "@playwright/test";

import type { Cuenta } from "@e2e/fixtures/cuentas";

/** Pantalla `/login`. */
export class LoginPagina {
  readonly correo: Locator;
  readonly contrasena: Locator;
  readonly entrar_: Locator;

  constructor(private readonly page: Page) {
    this.correo = page.getByLabel("Correo");
    this.contrasena = page.getByLabel("Contraseña", { exact: true });
    this.entrar_ = page.getByRole("button", { name: "Ingresar al sistema" });
  }

  async abrir() {
    await this.page.goto("/login");
  }

  /** Llena el formulario y pulsa «Ingresar al sistema». */
  async entrar(cuenta: Pick<Cuenta, "correo" | "contrasena">) {
    await this.correo.fill(cuenta.correo);
    await this.contrasena.fill(cuenta.contrasena);
    await this.entrar_.click();
  }
}
