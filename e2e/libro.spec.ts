// Capítulo 1 (DR11) y el diario dentro del capítulo (DR34). El contenido vive fuera del código publicado: sin él, no hay nada que probar.
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { desenvolver } from "../src/cifrado";
import { simularServidor } from "./servidor";

test.skip(!existsSync("contenido/capitulo-1.json"), "sin la carpeta de contenido");

test("Capítulo 1: fichas con su fuente, elegir un experimento lo completa, y la primera entrada del diario trae el código de recuperación", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByRole("heading", { name: "Capítulo 1 · Tu Tipo" })).toBeVisible();
  // La carta de prueba es de un solo Tipo: tres fichas, cada una con su fuente y marcada como borrador hasta que Isma la revise.
  const fichas = page.locator(".capitulo > .ficha");
  await expect(fichas).toHaveCount(3);
  await expect(fichas.first().getByText(/^Fuente: /)).toBeVisible();
  await expect(fichas.first().getByText("Borrador sin revisar")).toBeVisible();
  await expect(page.getByText("Un experimento no reemplaza el asesoramiento profesional")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await expect(page.getByRole("heading", { name: "Elige cómo probarlo" })).toBeVisible();
  await page.getByRole("button", { name: "Elegir este" }).first().click();
  await expect(page.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
  await expect(page.getByText(/^Lo elegiste el /)).toBeVisible();
  await expect.poll(() => servidor.documentos.map((d) => `${d.tipo}/${d.id}`).sort()).toEqual(["carta/principal", "libro/capitulo-1"]);
  expect(JSON.parse(servidor.documentos.find((d) => d.tipo === "libro")!.contenido)).toMatchObject({ esquema: 1, atributo: expect.stringMatching(/^Estrategia: /) });

  // La entrada se guarda primero; después aparece el código. "Ahora no" no la pierde y deja el aviso pendiente.
  await page.getByLabel("Anota algo en tu diario").fill("Hoy respondí a algo que me llegó.");
  await page.getByRole("button", { name: "Guardar en mi diario" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Tu código de recuperación" })).toBeVisible();
  const codigo = (await hoja.locator("p.codigo-recuperacion").textContent())!;
  const entrada = servidor.documentos.find((d) => d.tipo === "diario")!;
  expect([entrada.cifrado, entrada.contenido.includes("respondí")]).toEqual([true, false]);
  expect(await desenvolver(servidor.clave!.envuelta, codigo)).not.toBeNull();
  await hoja.getByRole("button", { name: "Ahora no" }).click();
  await expect(page.locator(".diario-entradas li")).toContainText("Hoy respondí a algo que me llegó.");
  await expect(page.getByText("Todavía no guardaste tu código de recuperación.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  // La segunda entrada no vuelve a mostrar el código, y todo sigue ahí al recargar.
  await page.getByLabel("Anota algo en tu diario").fill("Segunda nota.");
  await page.getByRole("button", { name: "Guardar en mi diario" }).click();
  await expect(page.locator(".diario-entradas li")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.locator(".diario-entradas li")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
});

test("chequeo de los días 3 y 7: la app pregunta cómo te fue, la respuesta del día 7 cierra el experimento con su sello (DR11)", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
  const capitulo = { esquema: 1, experimento: "observacion.firma_no_yo", elegido: hace(4), atributo: "Estrategia: Esperar la invitación", fichas: [] };
  servidor.documentos.push({ tipo: "libro", id: "capitulo-1", contenido: JSON.stringify(capitulo), cifrado: false, version: 1 });
  await page.goto("/");
  // En el mapa, la tarjeta del experimento muestra lo elegido y pregunta.
  await page.getByRole("button", { name: "¿Cómo te fue?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Experimentos" })).toBeFocused();
  await expect(page.getByText("Día 3 de lo que elegiste probar.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.getByLabel("Nota para tu diario (opcional)").fill("Todavía no lo tengo claro.");
  await page.getByRole("button", { name: "No probé" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Tu código de recuperación" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByRole("heading", { name: "¿Cómo te fue?" })).toHaveCount(0);
  await expect.poll(() => (JSON.parse(servidor.documentos.find((d) => d.tipo === "libro")!.contenido) as { chequeos?: unknown[] }).chequeos).toMatchObject([{ dia: 3, respuesta: "no_probe" }]);
  expect(servidor.documentos.filter((d) => d.tipo === "diario")).toHaveLength(1);

  // Pasado el día 7, la respuesta cierra el experimento y deja su sello en Experimentos y en el Libro.
  const libro = servidor.documentos.find((d) => d.tipo === "libro")!;
  libro.contenido = JSON.stringify({ ...JSON.parse(libro.contenido), elegido: hace(8) });
  libro.version += 1;
  await page.reload();
  await page.getByRole("button", { name: "Experimentos" }).click();
  await expect(page.getByText("Día 7 de lo que elegiste probar.")).toBeVisible();
  await page.getByRole("button", { name: "Me representa", exact: true }).click();
  await expect(page.getByText("Cerrado: Me representa")).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Cómo te fue?" })).toHaveCount(0);
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByText("Cerrado: Me representa")).toBeVisible();
});
