// Página de créditos: la atribución que pide la licencia CC BY 4.0 de GeoNames (plan, "Datos de nacimiento").
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("los créditos nombran a GeoNames, enlazan la fuente y la licencia, y dicen qué se cambió", async ({ page }) => {
  await page.goto("/creditos/");
  await expect(page.getByRole("heading", { level: 1, name: "Créditos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GeoNames" })).toHaveAttribute("href", "https://www.geonames.org/");
  await expect(page.getByRole("link", { name: /CC BY 4\.0/ })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/deed.es");
  await expect(page.getByText("Cambios que hicimos")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("](");
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test("la página legal sigue mostrando sus condiciones y enlaza los créditos al pie", async ({ page }) => {
  await page.goto("/legal/");
  await expect(page.locator("#condiciones")).toBeVisible();
  await expect(page.locator("#privacidad")).toBeVisible();
  // Al pie, el link a los créditos.
  await page.getByRole("link", { name: "Créditos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Créditos" })).toBeVisible();
});
