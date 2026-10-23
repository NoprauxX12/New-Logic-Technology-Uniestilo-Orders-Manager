import type { Browser, Page } from "@playwright/test";

import type { Cuenta } from "@e2e/fixtures/cuentas";
import { LoginPagina } from "@e2e/paginas/LoginPagina";

/**
 * Una persona entra al sistema por el login, con su correo y su contraseña, en
 * un navegador aparte (sin cookies de nadie más). Así un flujo puede pasar de
 * Carolina a Ana María como pasa en el taller: cada una con su propia sesión.
 */
export async function entrarComo(
  browser: Browser,
  cuenta: Cuenta,
): Promise<Page> {
  const contexto = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await contexto.newPage();

  const login = new LoginPagina(page);
  await login.abrir();
  await login.entrar(cuenta);
  await page.waitForURL("**/");

  return page;
}
