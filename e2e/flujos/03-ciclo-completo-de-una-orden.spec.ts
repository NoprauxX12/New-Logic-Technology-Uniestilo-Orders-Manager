import path from "node:path";

import { expect, test } from "@playwright/test";

import { CUENTAS } from "@e2e/fixtures/cuentas";
import { ordenValida } from "@e2e/fixtures/datos";
import { entrarComo } from "@e2e/fixtures/sesion";
import { CierrePagina } from "@e2e/paginas/CierrePagina";
import { DetalleOrdenPagina } from "@e2e/paginas/DetalleOrdenPagina";
import { DisenoPagina } from "@e2e/paginas/DisenoPagina";
import { InicioPagina } from "@e2e/paginas/InicioPagina";
import { NuevaOrdenPagina } from "@e2e/paginas/NuevaOrdenPagina";
import { ProgramacionPagina } from "@e2e/paginas/ProgramacionPagina";
import { SeccionPagina } from "@e2e/paginas/SeccionPagina";
import { TableroPagina } from "@e2e/paginas/TableroPagina";
import { TalleresPagina } from "@e2e/paginas/TalleresPagina";
import { TelaPagina } from "@e2e/paginas/TelaPagina";

/**
 * Flujo 3 · El ciclo completo de una orden, de la creación al cierre.
 *
 * Una sola historia, como pasa en el taller: administración registra la orden y
 * después cada persona entra con su propia cuenta y marca lo suyo, en el orden
 * del flujo, hasta que secretaría la da por completada. Al final se comprueba en
 * el tablero que las 13 etapas quedaron firmadas por su rol.
 *
 * Es una prueba larga a propósito: lo que se verifica es la secuencia entre
 * pantallas y roles, que ninguna prueba más pequeña alcanza.
 */

const FICHA = path.join(__dirname, "../fixtures/ficha-tecnica.pdf");

test("una orden recorre todas las etapas, cada una marcada por su rol, hasta cerrarse", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  const orden = ordenValida();
  const numero = orden.numeroOrdenCompra;

  await test.step("Diana (administración) registra la orden con dos prendas", async () => {
    const page = await entrarComo(browser, CUENTAS.admin);
    await new InicioPagina(page).esperarCargada(CUENTAS.admin.nombre);

    const nueva = new NuevaOrdenPagina(page);
    await nueva.abrir();
    await nueva.registrar(orden);
    await expect(nueva.mensajeDeExito(numero)).toBeVisible();
    await page.context().close();
  });

  await test.step("Paula (secretaría) envía la cotización y registra que el cliente la aprobó", async () => {
    const page = await entrarComo(browser, CUENTAS.secretaria);
    const cotizacion = new SeccionPagina(page, "/ordenes/cotizacion");

    await cotizacion.abrir();
    await cotizacion.marcar(numero, "Marcar cotización enviada");

    await cotizacion.abrir();
    await cotizacion.marcar(numero, "Marcar cotización aprobada");

    await page.context().close();
  });

  await test.step("Paula programa la orden a diseño", async () => {
    const page = await entrarComo(browser, CUENTAS.secretaria);
    const programacion = new ProgramacionPagina(page);

    await programacion.abrir();
    await programacion.programarOrden(numero);
    await page.context().close();
  });

  await test.step("Andrés (diseño) sube la ficha técnica", async () => {
    const page = await entrarComo(browser, CUENTAS.diseno);
    const diseno = new DisenoPagina(page);

    await diseno.abrir();
    await diseno.adjuntarFicha(numero, FICHA);
    await page.context().close();
  });

  await test.step("Paula programa la tela de cada prenda", async () => {
    const page = await entrarComo(browser, CUENTAS.secretaria);
    const tela = new TelaPagina(page);

    await tela.abrir();
    await tela.programarTela(numero, {
      [orden.prendas[0].descripcion]: {
        tipo: "Popelina azul",
        cantidad: "120",
        unidad: "Metros",
      },
      [orden.prendas[1].descripcion]: {
        tipo: "Gabardina gris",
        cantidad: "15",
        unidad: "Metros",
      },
    });
    await page.context().close();
  });

  await test.step("Jorge (corte) marca el corte completado", async () => {
    const page = await entrarComo(browser, CUENTAS.corte);
    const corte = new SeccionPagina(page, "/ordenes/corte");

    await corte.abrir();
    await corte.marcar(numero, "Marcar corte completado");
    await page.context().close();
  });

  await test.step("Luis (logística) marca el recogido y bordado", async () => {
    const page = await entrarComo(browser, CUENTAS.logistica);
    const recogido = new SeccionPagina(page, "/ordenes/recogido-bordado");

    await recogido.abrir();
    await recogido.marcar(numero, "Marcar recogido y bordado");
    await page.context().close();
  });

  await test.step("Luis despacha un lote a un taller satélite y confirma que volvió completo", async () => {
    const page = await entrarComo(browser, CUENTAS.logistica);
    const talleres = new TalleresPagina(page);

    await talleres.abrir();
    await talleres.abrirOrden(numero);
    await talleres.despachar("Taller Marinilla Centro", "Todas las prendas");
    await talleres.confirmarRecepcionCompleta();
    await page.context().close();
  });

  await test.step("Sandra (marcación) marca la llegada a marcación", async () => {
    const page = await entrarComo(browser, CUENTAS.marcacion);
    const marcacion = new SeccionPagina(page, "/ordenes/marcacion");

    await marcacion.abrir();
    await marcacion.marcar(numero, "Marcar llegada a marcación");
    await page.context().close();
  });

  await test.step("Marcela (terminación) deja la orden lista para despachar", async () => {
    const page = await entrarComo(browser, CUENTAS.terminacion);
    const despacho = new SeccionPagina(page, "/ordenes/despacho");

    await despacho.abrir();
    await despacho.marcar(numero, "Marcar lista para despachar");
    await page.context().close();
  });

  await test.step("Paula reporta etiquetas, documentos y factura, y da la orden por completada", async () => {
    const page = await entrarComo(browser, CUENTAS.secretaria);
    const cierre = new CierrePagina(page);

    await cierre.abrir();
    await cierre.cerrar(numero, `FE-${numero.slice(-6)}`);
    await page.context().close();
  });

  await test.step("Diana comprueba en el tablero que la orden terminó con las 13 etapas firmadas por su rol", async () => {
    const page = await entrarComo(browser, CUENTAS.admin);
    const tablero = new TableroPagina(page);
    const detalle = new DetalleOrdenPagina(page);

    await tablero.abrir();
    await tablero.buscar(numero);
    await expect(tablero.fila(numero)).toContainText("Orden terminada");

    await tablero.abrirTrazabilidad(numero);
    await expect(page).toHaveURL(/\/tablero\/[0-9a-f-]{36}$/);
    await expect(detalle.titulo(numero)).toBeVisible();
    await expect(page.getByText(/13\/13 etapas/)).toBeVisible();

    // Cada etapa la firma el rol dueño: el historial lo dice entre paréntesis.
    await expect(
      page.getByText(`Reportado por ${CUENTAS.corte.nombre} (Corte)`),
    ).toBeVisible();
    await expect(
      page.getByText(`Reportado por ${CUENTAS.diseno.nombre} (Diseño)`),
    ).toBeVisible();
    await expect(
      page.getByText(`Reportado por ${CUENTAS.marcacion.nombre} (Marcación)`),
    ).toBeVisible();
    await expect(
      page.getByText(
        `Reportado por ${CUENTAS.terminacion.nombre} (Terminación)`,
      ),
    ).toBeVisible();
    await page.context().close();
  });
});
