// Ajustes (DR30), tema (DR16), salir y borrar cuenta (DR44).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simularServidor } from "./servidor";

async function abrirAjustes(page: Page) {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeFocused();
  return servidor;
}
const bases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name));

test("Ajustes muestra la cuenta y la carta, y el tema elegido se guarda", async ({ page }) => {
  await abrirAjustes(page);
  await expect(page.getByText("prueba@ejemplo.com")).toBeVisible();
  await expect(page.getByText("En la nube")).toBeVisible();
  await expect(page.getByText("15 de mayo de 1990, 14:30, Rosario")).toBeVisible();
  await expect(page.getByText("España")).toBeVisible();
  await expect(page.getByRole("navigation").locator("[aria-current]")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  const fondo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dia = await fondo();
  await page.getByRole("radio", { name: "Noche" }).check();
  expect(await fondo()).not.toBe(dia);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  expect(await fondo()).not.toBe(dia);
});

test("Salir vuelve a la bienvenida y se puede volver a entrar", async ({ page }) => {
  await abrirAjustes(page);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("button", { name: "Ya tengo cuenta" })).toBeVisible();
  await page.getByRole("button", { name: "Ya tengo cuenta" }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByLabel("Tu email").fill("prueba@ejemplo.com");
  await hoja.getByRole("button", { name: /código de acceso/ }).click();
  await hoja.getByLabel(/Código de acceso/).fill("123456");
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
});

test("Borrar cuenta: si el servidor falla no se limpia nada de este dispositivo; al confirmar, se borra todo", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  servidor.fallosAlBorrar = 1;
  await page.getByRole("button", { name: "Borrar cuenta" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Borrar tu cuenta" })).toBeVisible();
  await expect(hoja.getByText("Tu diario no se podrá recuperar.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Exportar primero" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await hoja.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await expect(hoja.getByText("Todavía no se pudo borrar")).toBeVisible();
  expect(await bases(page)).toContain("dhlab:prueba@ejemplo.com");
  expect(servidor.documentos).toHaveLength(1);

  await hoja.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();
  expect(await bases(page)).not.toContain("dhlab:prueba@ejemplo.com");
  expect([servidor.cuenta, servidor.documentos]).toEqual([null, []]);
});

test("sin red, la carta queda en el dispositivo con la marca en el encabezado; al reintentar sube y la marca se va (DR36)", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true });
  servidor.sinRed = true;
  await page.goto("/");
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-15");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Hora de nacimiento").fill("14:30");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("País de nacimiento").selectOption("AR");
  await page.getByLabel("Ciudad o localidad").fill("Rosario");
  await page.getByRole("option", { name: /^Rosario, Santa Fe/ }).click();
  await page.getByRole("button", { name: "Calcular mi carta" }).click();
  await page.getByRole("button", { name: "Encender" }).click();
  await page.getByRole("button", { name: "Saltar" }).click();
  // Con cuenta no se pide "Guarda tu carta": se guarda sola.
  await page.getByRole("button", { name: "Empezar el Capítulo 1" }).click();
  const marca = page.getByRole("button", { name: "Sin conexión" });
  await expect(marca).toBeVisible();
  expect((await marca.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(servidor.documentos).toHaveLength(0);

  await marca.click();
  const detalle = page.getByRole("dialog");
  await expect(detalle.getByText("1 cambios guardados en este dispositivo esperan para subir.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  servidor.sinRed = false;
  await detalle.getByRole("button", { name: "Reintentar" }).click();
  await expect(marca).toHaveCount(0);
  expect(servidor.documentos).toHaveLength(1);
});
