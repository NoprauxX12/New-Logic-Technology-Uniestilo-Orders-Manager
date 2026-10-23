import type { Locator, Page } from "@playwright/test";

/**
 * Pulsa un botón que dispara una Server Action y espera a que el servidor
 * responda, es decir, a que lo que se pidió ya quedó guardado.
 *
 * Esperar «a que el botón desaparezca» no sirve: mientras se guarda, el botón
 * cambia su texto a «Guardando…», así que deja de coincidir con su nombre y la
 * espera termina antes de tiempo. La prueba seguiría a la siguiente pantalla con
 * la acción todavía en camino.
 */
export async function pulsarYEsperarGuardado(page: Page, boton: Locator) {
  const respuesta = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.request().headers()["next-action"] !== undefined,
  );
  await boton.click();
  await respuesta;
}
