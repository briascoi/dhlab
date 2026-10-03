// El mapa (DR4): los Centros se tocan, y desde un Centro abierto se toca cada uno de sus Canales.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("un Centro abierto lista sus Canales, cada uno con 44 px, y un Canal bloqueado muestra su candado", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dev/mapa.html?cap=4");
  await page.getByRole("button", { name: "Sacral, definido" }).click();
  const canales = page.locator(".detalle-canales button");
  await expect(canales).toHaveCount(11);
  for (const caja of await canales.evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height))) expect(caja).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Canal 34-57: definido" }).click();
  await expect(page.getByText("Canal 34-57 se abre en el Capítulo 5: Tus Canales.")).toBeVisible();
  // Tocar otro Canal reemplaza el candado, no lo acumula.
  await page.getByRole("button", { name: /^Canal 3-60/ }).click();
  await expect(page.locator(".detalle .detalle-candado")).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).disableRules(["page-has-heading-one"]).analyze();
  expect(violations.map((v) => `${v.id} en ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("con el Capítulo 4 cerrado, un Centro muestra solo su candado", async ({ page }) => {
  await page.goto("/dev/mapa.html");
  await page.getByRole("button", { name: "Sacral, definido" }).click();
  await expect(page.getByText("Sacral se abre en el Capítulo 4: Tus Centros.")).toBeVisible();
  await expect(page.locator(".detalle-canales")).toHaveCount(0);
});
