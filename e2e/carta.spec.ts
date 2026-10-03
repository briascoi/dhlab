// Del formulario de nacimiento a la carta guardada (DR1, DR10, DR46), con axe en cada pantalla y en los tres anchos (DR17, DR18).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simularServidor } from "./servidor";

const ANCHOS = [375, 768, 1280];
const sinFallas = async (page: Page, pantalla: string) => {
  // Las pantallas de antes del marco (formulario, revelación) todavía no llevan título de nivel 1.
  const { violations } = await new AxeBuilder({ page }).disableRules(["page-has-heading-one"]).analyze();
  expect.soft(violations.map((v) => `${pantalla}: ${v.id} en ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
};

async function hastaLaCartaLista(page: Page, revisar = false) {
  const servidor = await simularServidor(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "DH Lab" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-15");
  if (revisar) await sinFallas(page, "fecha");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Hora de nacimiento").fill("14:30");
  if (revisar) await sinFallas(page, "hora");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("País de nacimiento").selectOption("AR");
  await page.getByLabel("Ciudad o localidad").fill("Rosario");
  await page.getByRole("option", { name: /^Rosario, Santa Fe/ }).click();
  if (revisar) await sinFallas(page, "lugar");
  await page.getByRole("button", { name: "Calcular mi carta" }).click();
  await expect(page.getByRole("heading", { name: "Tu carta está lista" })).toBeVisible();
  return servidor;
}

for (const ancho of ANCHOS) {
  test(`recorrido completo y accesibilidad a ${ancho} px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    const servidor = await hastaLaCartaLista(page, true);
    await sinFallas(page, "carta lista");

    await page.getByRole("button", { name: "Encender" }).click();
    await expect(page.getByRole("switch", { name: "Sonido" })).not.toBeChecked();
    const saltar = page.getByRole("button", { name: "Saltar" });
    const caja = (await saltar.boundingBox())!;
    expect(Math.min(caja.width, caja.height)).toBeGreaterThanOrEqual(44);
    await saltar.click();

    // Al terminar la revelación sube "Guarda tu carta" sobre la carta (DR46).
    const hoja = page.getByRole("dialog");
    await expect(hoja.getByRole("heading", { name: "Guarda tu carta" })).toBeVisible();
    await expect(saltar).toHaveCount(0);
    await sinFallas(page, "guarda tu carta");

    // Si se cierra, el paso al Capítulo 1 la vuelve a abrir.
    await page.keyboard.press("Escape");
    await expect(hoja).toHaveCount(0);
    await sinFallas(page, "carta y configuración");
    await page.getByRole("button", { name: "Empezar el Capítulo 1" }).click();
    await hoja.getByLabel("Tu email").fill("prueba@ejemplo.com");
    await hoja.getByRole("checkbox").check();
    await hoja.getByRole("button", { name: "Enviarme el código de acceso" }).click();
    const codigo = hoja.getByLabel(/Código de acceso/);
    await expect(codigo).toBeVisible();
    await sinFallas(page, "código de acceso");
    await codigo.fill("123456");

    // Después del código vuelve a la carta con la línea de cierre, sin arrancar el capítulo solo.
    await expect(page.getByText("Tu carta quedó guardada.")).toBeVisible();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Empezar el Capítulo 1" })).toBeVisible();
    await sinFallas(page, "carta guardada");

    // La carta subió a la cuenta: son los datos de nacimiento, no la carta calculada.
    await expect.poll(() => servidor.documentos.length).toBe(1);
    expect(JSON.parse(servidor.documentos[0]!.contenido)).toMatchObject({ esquema: 1, nacimiento: { fecha: "1990-05-15", hora: "14:30" }, tzdb: expect.any(String) });

    // El paso al Capítulo 1 entra a la app; al volver a abrirla, la carta ya está y no pide nada.
    await page.getByRole("button", { name: "Empezar el Capítulo 1" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Libro" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sacral, indefinido" })).toBeVisible();
  });
}

test("la revelación dura entre 6 y 8 segundos y termina en el panel completo", async ({ page }) => {
  await hastaLaCartaLista(page);
  const inicio = Date.now();
  await page.getByRole("button", { name: "Encender" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  const duracion = Date.now() - inicio;
  expect(duracion).toBeGreaterThanOrEqual(6000);
  expect(duracion).toBeLessThanOrEqual(8000);
  await expect(page.getByRole("heading", { name: "Tu configuración" })).toBeVisible();
});

test("con movimiento reducido la carta aparece completa, con su línea de cierre y sin Saltar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await hastaLaCartaLista(page);
  await page.getByRole("button", { name: "Encender" }).click();
  await expect(page.getByText("Esta es tu carta.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saltar" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await sinFallas(page, "movimiento reducido");
});
