import { test as preparar } from "@playwright/test";

import { CUENTAS } from "@e2e/fixtures/cuentas";
import { LoginPagina } from "@e2e/paginas/LoginPagina";

/**
 * Entra una sola vez como administración y guarda la sesión. Los flujos que no
 * son el del login empiezan ya adentro, sin repetir el formulario cada vez.
 */
preparar("entrar como administración y guardar la sesión", async ({ page }) => {
  const login = new LoginPagina(page);

  await login.abrir();
  await login.entrar(CUENTAS.admin);
  await page.waitForURL("**/");

  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
