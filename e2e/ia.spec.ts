// IA incluida: consentimiento, escritura de un capítulo, coach y estado en Ajustes. El servidor de la IA se simula.
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simularServidor } from "./servidor";

test.skip(!existsSync("contenido/capitulo-1.json"), "sin la carpeta de contenido");
const sinFallas = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
const seccion = {
  parrafos: [{ tipo: "narrativo", texto: "Vamos de a poco." }, { tipo: "interpretativo", texto: "Tu Estrategia es esperar la invitación.", fuentes: ["estrategia.invitacion"] }],
  modelo: "modelo-de-prueba",
  verificador: "modelo-de-prueba",
  fichas: [{ id: "tipo.proyector", version: 1 }, { id: "estrategia.invitacion", version: 1 }, { id: "firma_no_yo.invitacion", version: 1 }],
};

test("sin IA configurada en el servidor la app sigue igual: ni botón de escribir ni coach", async ({ page }) => {
  await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByRole("heading", { name: "Capítulo 1 · Tu Tipo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escribir este capítulo con IA" })).toHaveCount(0);
  await page.getByRole("button", { name: "Coach" }).click();
  await expect(page.getByText("El coach todavía no está disponible.")).toBeVisible();
});

test("escribir un capítulo: pide consentimiento, manda solo la acción y los atributos, y guarda la sección con su insignia", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia.configurada = true;
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await page.getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  const consentimiento = page.getByRole("dialog").filter({ hasText: "Antes de usar la IA" });
  await expect(consentimiento.getByText("Nunca tu fecha, hora ni lugar")).toBeVisible();
  await sinFallas(page);
  await consentimiento.getByRole("button", { name: "Acepto" }).click();

  const hoja = page.getByRole("dialog").filter({ hasText: "Mantén esta app abierta" });
  await sinFallas(page);
  // Primer intento: no pasa las verificaciones. No se guarda nada y se puede reintentar.
  servidor.respuestasIA.push({ status: 422, cuerpo: { error: "no_publicable" } }, { cuerpo: seccion });
  await hoja.getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("No pudimos escribir un capítulo que pase las verificaciones. Puedes reintentar o leer las fichas, que están abajo.");
  expect(servidor.documentos).toHaveLength(1);
  await hoja.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect(servidor.pedidosIA[0]).toEqual({ accion: "capitulo", n: 1, atributos: expect.objectContaining({ tipo: "proyector", autoridad: "emocional", perfil: "1/3" }) });
  const escrita = page.locator(".seccion-ia");
  await expect(escrita).toContainText("Tu Estrategia es esperar la invitación.");
  await expect(escrita).toContainText("Fuente: Estrategia");
  await expect(escrita).toContainText("Cada afirmación fue contrastada automáticamente con las fichas citadas. No es una revisión humana.");
  // Las fichas siguen debajo, y la sección queda guardada en el Libro.
  await expect(page.locator(".capitulo").first().locator(":scope > .ficha")).toHaveCount(3);
  await expect.poll(() => servidor.documentos.map((d) => `${d.tipo}/${d.id}`).sort()).toEqual(["carta/principal", "libro/seccion-1"]);
  await expect(page.getByRole("button", { name: "Escribirlo otra vez" })).toBeVisible();
  await sinFallas(page);
});

test("con el tope casi usado el capítulo no entra y se dice antes de empezar; con la IA en pausa, también", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia = { ...servidor.ia, configurada: true, usado: 480_000 };
  await page.addInitScript(() => localStorage.setItem("dhlab.ia_consentida", "2026-10-04"));
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await page.getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Este capítulo no entra en lo que te queda de IA incluida. Se renueva el 1 de noviembre.");
  expect(servidor.pedidosIA).toHaveLength(0);
  await hoja.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByText("Cerca del tope")).toBeVisible();
  await expect(page.getByText("Se renueva el 1 de noviembre.")).toBeVisible();
});

test("coach: responde con sus fuentes, tiene respuestas fijas para lo sensible y lo que no sabe, y anota en el diario", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia.configurada = true;
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();
  await page.getByRole("button", { name: "Antes de usar la IA" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Acepto" }).click();
  await expect(page.getByText("El coach cita sus fuentes, pero sus respuestas no pasan por el verificador del libro.")).toBeVisible();
  await sinFallas(page);

  const charla = page.locator(".coach-charla li");
  servidor.respuestasIA.push({ cuerpo: { parrafos: seccion.parrafos } }, { cuerpo: { fija: "sin_biblioteca" } }, { cuerpo: { fija: "sensible" } });
  await page.getByLabel("Escribe tu pregunta").fill("¿Qué hago cuando me invitan a algo?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(charla.nth(1)).toContainText("Tu Estrategia es esperar la invitación.");
  await expect(charla.nth(1)).toContainText("Fuente: Estrategia");
  expect(servidor.pedidosIA[0]).toMatchObject({ accion: "mensaje", texto: "¿Qué hago cuando me invitan a algo?", historial: [] });
  await sinFallas(page);

  // "Anotar en mi diario" guarda la respuesta cifrada; el diario no viaja a la IA.
  await charla.nth(1).getByRole("button", { name: "Anotar en mi diario" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ahora no" }).click();
  await expect(charla.nth(1)).toContainText("Anotado en tu diario");
  await expect.poll(() => servidor.documentos.filter((d) => d.tipo === "diario").length).toBe(1);

  await page.getByLabel("Escribe tu pregunta").fill("¿Y mi Cruz de Encarnación?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(charla.nth(3)).toContainText("Eso todavía no lo tengo en mi biblioteca.");
  // El segundo pedido lleva la charla anterior, y nada del diario.
  expect(JSON.stringify(servidor.pedidosIA[1])).toContain("Tu Estrategia es esperar la invitación.");
  await page.getByLabel("Escribe tu pregunta").fill("¿Debería dejar la medicación?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(charla.nth(5)).toContainText("busca a una persona profesional");
});
