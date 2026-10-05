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
  // Las fichas quedan plegadas debajo, a un toque, y la sección queda guardada en el Libro.
  const plegadas = page.locator(".capitulo").first().locator(".capitulo-fichas");
  await expect(plegadas.locator(".ficha")).toHaveCount(3);
  await expect(plegadas.locator(".ficha").first()).toBeHidden();
  await plegadas.getByText("Ver las fichas y sus fuentes").click();
  await expect(plegadas.locator(".ficha").first()).toBeVisible();
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

  // "Ver la fuente" abre las fichas que respaldan la respuesta, con su fuente.
  await charla.nth(1).getByText("Ver la fuente").click();
  await expect(charla.nth(1).locator("details")).toContainText("Tu Estrategia es esperar la invitación (\"Wait for the invitation\")");
  await expect(charla.nth(1).locator("details")).toContainText("Fuente: Jovian Archive, Type and Strategy in Human Design");
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

test("con la clave propia la IA va directo a OpenRouter, sin pasar por nuestro servidor, y corren las mismas guardas", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  // OpenRouter simulado: valida la clave y contesta lo que le toca, en orden.
  const respuestas: object[] = [];
  const pedidos: { url: string; clave: string | null; cuerpo: { provider?: object; messages?: { content: string }[] } | null }[] = [];
  await page.route("https://openrouter.ai/**", async (ruta) => {
    const pedido = ruta.request();
    const clave = pedido.headers().authorization ?? null;
    pedidos.push({ url: pedido.url(), clave, cuerpo: pedido.postDataJSON() as never });
    if (clave !== "Bearer sk-or-buena") return ruta.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (pedido.url().endsWith("/key")) return ruta.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(respuestas.shift()) } }], usage: { cost: 0.001 } }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Usar tu clave de OpenRouter" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByText("va directo de este navegador a OpenRouter, sin pasar por nuestro servidor")).toBeVisible();
  await expect(hoja.getByText("Se guarda solo en este navegador; los cargos son de tu cuenta de OpenRouter.")).toBeVisible();
  await sinFallas(page);
  await hoja.getByLabel("Clave de OpenRouter").fill("sk-or-mala");
  await hoja.getByRole("button", { name: "Pegar mi clave" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Esa clave no funciona. Revísala o crea otra en OpenRouter.");
  await hoja.getByLabel("Clave de OpenRouter").fill("sk-or-buena");
  await hoja.getByRole("button", { name: "Pegar mi clave" }).click();
  await expect(page.getByText("Conectada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desconectar" })).toBeVisible();

  // Un capítulo: redacta y verifica, las dos llamadas directo a OpenRouter con proveedores sin retención.
  respuestas.push({ parrafos: seccion.parrafos }, { sin_respaldo: [] });
  await page.getByRole("button", { name: "Libro" }).click();
  await page.getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Escribir este capítulo con IA" }).click();
  await expect(page.locator(".seccion-ia")).toContainText("Tu Estrategia es esperar la invitación.");
  const llamadas = pedidos.filter((p) => p.url.endsWith("/chat/completions"));
  expect(llamadas).toHaveLength(2);
  expect(llamadas[0]!.cuerpo).toMatchObject({ provider: { zdr: true, data_collection: "deny" } });
  expect(llamadas[0]!.cuerpo!.messages![1]!.content).toContain("tipo.proyector");

  // El coach: una afirmación con una ficha que no se entregó se descarta en el navegador; lo sensible ni sale.
  respuestas.push({ parrafos: [{ tipo: "interpretativo", texto: "Algo sin respaldo.", fuentes: ["ficha.inventada"] }] });
  await page.getByRole("button", { name: "Coach" }).click();
  await page.getByLabel("Escribe tu pregunta").fill("¿Qué hago con una invitación?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".coach-charla li").nth(1)).toContainText("Eso todavía no lo tengo en mi biblioteca.");
  await page.getByLabel("Escribe tu pregunta").fill("¿Debería dejar la medicación?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".coach-charla li").nth(3)).toContainText("busca a una persona profesional");
  expect(pedidos.filter((p) => p.url.endsWith("/chat/completions"))).toHaveLength(3);
  // Nada de esto pasó por nuestro servidor.
  expect(servidor.pedidosIA).toHaveLength(0);

  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Desconectar" }).click();
  await expect(page.getByRole("button", { name: "Usar tu clave de OpenRouter" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("dhlab.clave_openrouter"))).toBeNull();
});

test("Llévame al capítulo: desde una respuesta del coach se vuelve al Libro", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia.configurada = true;
  await page.addInitScript(() => localStorage.setItem("dhlab.ia_consentida", "2026-10-04"));
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();
  servidor.respuestasIA.push({ cuerpo: { parrafos: seccion.parrafos } });
  await page.getByLabel("Escribe tu pregunta").fill("¿Qué hago cuando me invitan a algo?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.getByRole("button", { name: "Llévame al capítulo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Libro" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Capítulo 1 · Tu Tipo" })).toBeVisible();
});

test("el coach tiene su osciloscopio, que cambia con el estado, y lleva al mapa con el Centro resaltado", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia.configurada = true;
  await page.addInitScript(() => localStorage.setItem("dhlab.ia_consentida", "2026-10-04"));
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();
  const pantalla = page.locator(".osciloscopio");
  await expect(pantalla).toHaveAttribute("data-estado", "esperando");
  await expect(pantalla).toHaveAttribute("aria-hidden", "true");
  await sinFallas(page);
  servidor.respuestasIA.push({ cuerpo: { parrafos: [{ tipo: "interpretativo", texto: "Tu Garganta está definida.", fuentes: ["centro.garganta.definido"] }] } }, { cuerpo: { fija: "sin_biblioteca" } });
  await page.getByLabel("Escribe tu pregunta").fill("¿Cómo me comunico?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(pantalla).toHaveAttribute("data-estado", "responde");
  // La acción va en píldora, de 44 px de alto, y lleva al mapa con ese Centro resaltado y su detalle a la vista.
  const accion = page.getByRole("button", { name: "Muéstrame en mi mapa" });
  expect((await accion.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await accion.click();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeFocused();
  await expect(page.locator(".mapa-boton.mapa-resaltado")).toHaveAttribute("aria-label", /^Garganta,/);
  // El cable del coach queda tendido hasta el Centro (DR12).
  await expect(page.locator(".mapa-coach")).toHaveCount(1);
  await expect(page.locator(".detalle-titulo")).toHaveText("Garganta");
  await page.getByRole("button", { name: "Coach" }).click();
  await page.getByLabel("Escribe tu pregunta").fill("¿Y mi Cruz?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".osciloscopio")).toHaveAttribute("data-estado", "no_sabe");
});

test("con movimiento reducido la onda del coach no se anima", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.ia.configurada = true;
  await page.addInitScript(() => localStorage.setItem("dhlab.ia_consentida", "2026-10-04"));
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();
  expect(await page.locator(".osciloscopio .onda").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});
