// Diario (T72): cerrado en un navegador sin su clave (DR32), abrirlo con el código de recuperación y generar un código nuevo (DR34).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { desenvolver, envolver, generarCodigo } from "../src/cifrado";
import { simularServidor } from "./servidor";

// Una cuenta que ya tiene diario: el servidor guarda su clave envuelta con el código.
async function conDiario(page: Page) {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  const codigo = generarCodigo();
  const clave = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])) as CryptoKey;
  servidor.clave = { idClave: "clave-1", envuelta: await envolver(clave, codigo), revision: 1 };
  await page.goto("/");
  return { servidor, codigo };
}
const sinFallas = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

test("sin la clave en este navegador el Libro abre y el diario pide el código; uno equivocado no bloquea y el correcto abre", async ({ page }) => {
  const { codigo } = await conDiario(page);
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByText("Tu libro se arma capítulo a capítulo.")).toBeVisible();
  await expect(page.getByText("Diario cerrado en este navegador")).toBeVisible();
  await sinFallas(page);
  await page.getByRole("button", { name: "Escribir mi código" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Abre tu diario" })).toBeFocused();
  await sinFallas(page);

  const campo = hoja.getByLabel("Código de recuperación");
  await campo.fill(generarCodigo());
  await expect(hoja.getByRole("alert")).toHaveText("Ese código no abre tu diario");
  await expect(campo).toBeEnabled();
  await hoja.getByRole("button", { name: "No tengo el código" }).click();
  await expect(hoja.getByText(/genera un código nuevo/)).toBeVisible();
  // Se acepta en minúsculas y sin guiones.
  await campo.fill(codigo.replaceAll("-", "").toLowerCase());
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText("Diario cerrado en este navegador")).toHaveCount(0);
});

test("Generar código nuevo: el anterior deja de servir, un último grupo equivocado no cierra y Ahora no deja la fila pendiente", async ({ page }) => {
  const { servidor, codigo } = await conDiario(page);
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByText("Diario cerrado en este navegador")).toBeVisible();
  await page.getByRole("button", { name: "Escribir mi código" }).click();
  await page.getByRole("dialog").getByLabel("Código de recuperación").fill(codigo);
  await expect(page.getByText("Diario abierto en este navegador")).toBeVisible();
  await expect(page.getByText("El código anterior dejará de servir.")).toBeVisible();
  await sinFallas(page);

  await page.getByRole("button", { name: "Generar código nuevo" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Tu código de recuperación" })).toBeFocused();
  await sinFallas(page);
  const nuevo = (await hoja.locator(".codigo-recuperacion").textContent())!;
  expect(nuevo).toMatch(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  expect(servidor.clave!.revision).toBe(2);
  expect(await desenvolver(servidor.clave!.envuelta, codigo)).toBeNull();
  expect(await desenvolver(servidor.clave!.envuelta, nuevo)).not.toBeNull();

  await hoja.getByLabel("Escribe los últimos 4 caracteres del código").fill("ZZZZ");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("No coinciden. Revisa el último grupo del código.");
  await hoja.getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByText("Falta guardar tu código de recuperación")).toBeVisible();

  // Completarlo es generar otro y, esta vez, comprobarlo.
  await page.getByRole("button", { name: "Generar código nuevo" }).click();
  const otro = (await hoja.locator(".codigo-recuperacion").textContent())!;
  await hoja.getByLabel("Escribe los últimos 4 caracteres del código").fill(otro.slice(-4).toLowerCase());
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText("Diario abierto en este navegador")).toBeVisible();
});

test("si otro dispositivo cambió el código mientras tanto, no se pisa y se ofrece generar otro", async ({ page }) => {
  const { servidor, codigo } = await conDiario(page);
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Escribir mi código" }).click();
  await page.getByRole("dialog").getByLabel("Código de recuperación").fill(codigo);
  await expect(page.getByText("Diario abierto en este navegador")).toBeVisible();
  servidor.clave = { ...servidor.clave!, revision: 5 };
  await page.getByRole("button", { name: "Generar código nuevo" }).click();
  await expect(page.getByText("Este código fue reemplazado desde otro dispositivo")).toBeVisible();
  await page.getByRole("button", { name: "Generar otro" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Tu código de recuperación" })).toBeVisible();
  expect(servidor.clave!.revision).toBe(6);
});
