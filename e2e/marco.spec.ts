// Marco de la app (DR3, DR17, DR18): título, Ajustes, cuatro pestañas y landmarks, con axe completo (acá sí hay título de nivel 1).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CARTA, simularServidor } from "./servidor";

for (const ancho of [375, 768, 1280]) {
  test(`marco a ${ancho} px: pestañas de 44 px, la activa marcada y sin fallas de accesibilidad`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await simularServidor(page, { conSesion: true, carta: true });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Secciones" });
    const pestanas = nav.getByRole("button");
    await expect(pestanas).toHaveText(["Mapa", "Libro", "Experimentos", "Coach"]);
    for (const caja of await pestanas.evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()))) expect(Math.min(caja.width, caja.height)).toBeGreaterThanOrEqual(44);
    await expect(nav.getByRole("button", { name: "Mapa" })).toHaveAttribute("aria-current", "page");
    const ajustes = (await page.getByRole("button", { name: "Ajustes" }).boundingBox())!;
    expect(Math.min(ajustes.width, ajustes.height)).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

    // Cambiar de pestaña cambia el título, marca la nueva y lleva el foco al título.
    await nav.getByRole("button", { name: "Libro" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Libro" })).toBeFocused();
    await expect(nav.getByRole("button", { name: "Libro" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("button", { name: "Mapa" })).not.toHaveAttribute("aria-current", "page");
    await expect(page.locator(".mapa")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

    // La barra de pestañas va abajo en todos los anchos, como en los mockups.
    const cajaNav = (await nav.boundingBox())!;
    expect(cajaNav.y + cajaNav.height).toBeGreaterThan(800 - 20);
  });
}

test("con la hora incierta, la app muestra el aviso y lleva a corregir la hora con los datos guardados", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  // La misma carta, pero con la hora desconocida: el rango es el día entero.
  servidor.documentos[0]!.contenido = JSON.stringify({ ...CARTA, nacimiento: { ...CARTA.nacimiento, confiabilidad: "desconocida" }, inicio: "1990-05-15T03:00:00.000Z", fin: "1990-05-16T03:00:00.000Z" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect(page.locator(".banner")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.locator(".banner").getByRole("button").click();
  await expect(page.getByLabel("Hora de nacimiento")).toBeVisible();
});

test("una carta guardada con un esquema más nuevo no se interpreta: la app pide actualizar", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.documentos[0]!.contenido = JSON.stringify({ ...CARTA, esquema: 2 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Actualiza la app" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});
