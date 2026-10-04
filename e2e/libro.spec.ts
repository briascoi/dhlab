// Capítulo 1 (DR11) y el diario dentro del capítulo (DR34). El contenido vive fuera del código publicado: sin él, no hay nada que probar.
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { desenvolver } from "../src/cifrado";
import { CARTA, simularServidor } from "./servidor";

test.skip(!existsSync("contenido/capitulo-1.json"), "sin la carpeta de contenido");

test("Capítulo 1: fichas con su fuente, elegir un experimento lo completa, y la primera entrada del diario trae el código de recuperación", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByRole("heading", { name: "Capítulo 1 · Tu Tipo" })).toBeVisible();
  // La carta de prueba es de un solo Tipo: tres fichas, cada una con su fuente y marcada como borrador hasta que Isma la revise.
  const primero = page.locator(".capitulo").first();
  const fichas = primero.locator(":scope > .ficha");
  await expect(fichas).toHaveCount(3);
  await expect(fichas.first().getByText(/^Fuente: /)).toBeVisible();
  await expect(fichas.first().getByText("Borrador sin revisar")).toBeVisible();
  await expect(page.getByText("Un experimento no reemplaza el asesoramiento profesional")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  // El libro se puede imprimir, y trae un glosario de una línea por objeto (DR22).
  await page.evaluate(() => (window.print = () => document.body.setAttribute("data-impreso", "si")));
  await page.getByRole("button", { name: "Imprimir o guardar en PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-impreso", "si");
  await page.getByText("Glosario").click();
  await expect(page.getByText("Ficha: una entrada de la base, con su fuente.")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(page.getByRole("button", { name: "Elegir este" }).first()).toBeHidden();
  await expect(fichas.first()).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  await expect(page.getByRole("heading", { name: "Elige cómo probarlo" })).toBeVisible();
  await page.getByRole("button", { name: "Elegir este" }).first().click();
  await expect(primero.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
  await expect(primero.getByText(/^Lo elegiste el /)).toBeVisible();
  await expect.poll(() => servidor.documentos.map((d) => `${d.tipo}/${d.id}`).sort()).toEqual(["carta/principal", "libro/capitulo-1"]);
  expect(JSON.parse(servidor.documentos.find((d) => d.tipo === "libro")!.contenido)).toMatchObject({ esquema: 1, atributo: expect.stringMatching(/^Estrategia: /) });

  // La entrada se guarda primero; después aparece el código. "Ahora no" no la pierde y deja el aviso pendiente.
  await primero.getByLabel("Anota algo en tu diario").fill("Hoy respondí a algo que me llegó.");
  await primero.getByRole("button", { name: "Guardar en mi diario" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Tu código de recuperación" })).toBeVisible();
  const codigo = (await hoja.locator("p.codigo-recuperacion").textContent())!;
  const entrada = servidor.documentos.find((d) => d.tipo === "diario")!;
  expect([entrada.cifrado, entrada.contenido.includes("respondí")]).toEqual([true, false]);
  expect(await desenvolver(servidor.clave!.envuelta, codigo)).not.toBeNull();
  await hoja.getByRole("button", { name: "Ahora no" }).click();
  await expect(primero.locator(".diario-entradas li")).toContainText("Hoy respondí a algo que me llegó.");
  await expect(primero.getByText("Todavía no guardaste tu código de recuperación.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  // Los contadores de uso llevan solo el nombre de lo que pasó.
  expect(servidor.eventos).toEqual(expect.arrayContaining(["capitulo_elegido", "entrada_escrita"]));

  // La segunda entrada no vuelve a mostrar el código, y todo sigue ahí al recargar.
  await primero.getByLabel("Anota algo en tu diario").fill("Segunda nota.");
  await primero.getByRole("button", { name: "Guardar en mi diario" }).click();
  await expect(primero.locator(".diario-entradas li")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(primero.locator(".diario-entradas li")).toHaveCount(2);
  await expect(primero.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
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

test("completar el Capítulo 1 abre el Capítulo 2 con las fichas de la Autoridad; el siguiente queda nombrado y cerrado", async ({ page }) => {
  await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await expect(page.getByText("Capítulo 1 · Tu Tipo")).toBeVisible();
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.getByRole("heading", { name: "Capítulo 2 · Tu Autoridad" })).toHaveCount(0);
  await page.getByRole("button", { name: "Elegir este" }).first().click();
  const segundo = page.locator(".capitulo").nth(1);
  await expect(segundo.getByRole("heading", { name: "Capítulo 2 · Tu Autoridad" })).toBeVisible();
  await expect(segundo.locator(":scope > .ficha")).toHaveCount(2);
  await expect(segundo.getByText(/^Tu Autoridad es /)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  // Una entrada escrita en el Capítulo 2 queda junto a esa sección, no en la del 1.
  await segundo.getByLabel("Anota algo en tu diario").fill("Nota del capítulo dos.");
  await segundo.getByRole("button", { name: "Guardar en mi diario" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ahora no" }).click();
  await expect(segundo.locator(".diario-entradas li")).toHaveCount(1);
  await expect(page.locator(".capitulo").first().locator(".diario-entradas li")).toHaveCount(0);

  await segundo.getByRole("button", { name: "Elegir este" }).first().click();
  // El Capítulo 3: la carta de prueba es 1/3, así que trae sus dos Líneas, el cálculo y el ángulo, y un experimento por Línea.
  const tercero = page.locator(".capitulo").nth(2);
  await expect(tercero.getByRole("heading", { name: "Capítulo 3 · Tu Perfil" })).toBeVisible();
  await expect(tercero.locator(":scope > .ficha")).toHaveCount(4);
  await expect(tercero.getByText(/^La Línea 1 es El Investigador/)).toBeVisible();
  await expect(tercero.getByText(/^La Línea 3 es El Mártir/)).toBeVisible();
  await expect(tercero.getByText(/^Tu Perfil es de Ángulo Derecho/)).toBeVisible();
  await expect(tercero.getByRole("button", { name: "Elegir este" })).toHaveCount(3);
  await tercero.getByRole("button", { name: "Elegir este" }).first().click();
  // El Capítulo 4: una ficha de entrada, los nueve Centros (cada uno en el estado que tiene en esta carta) y la Definición.
  const cuarto = page.locator(".capitulo").nth(3);
  await expect(cuarto.getByRole("heading", { name: "Capítulo 4 · Tus Centros" })).toBeVisible();
  await expect(cuarto.locator(":scope > .ficha")).toHaveCount(11);
  await expect(cuarto.getByText(/^Tu Definición es Triple partida/)).toBeVisible();
  await expect(cuarto.getByText(/^El Plexo Solar .* Lo tienes definido/)).toBeVisible();
  await expect(cuarto.getByText(/^El Sacral .* Lo tienes sin definir/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await cuarto.getByRole("button", { name: "Elegir este" }).first().click();
  // El Capítulo 5: una ficha de entrada y una por cada Canal definido de esta carta, con el nombre que le da la fuente.
  const quinto = page.locator(".capitulo").nth(4);
  await expect(quinto.getByRole("heading", { name: "Capítulo 5 · Tus Canales" })).toBeVisible();
  await expect(quinto.getByText(/^Los Canales son las vías de energía/)).toBeVisible();
  const canales = quinto.locator(":scope > .ficha").filter({ hasText: /^Canal \d+-\d+/ });
  expect(await canales.count()).toBeGreaterThan(0);
  await expect(canales.first()).toContainText(/Tienes definido el Canal \d+-\d+, que une .* "The Channel of /);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await quinto.getByRole("button", { name: "Elegir este" }).first().click();
  await expect(quinto.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
  await expect(page.locator(".marco-vacio")).toHaveCount(0);
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByText("Capítulo 5 · Tus Canales")).toBeVisible();
  await expect(page.getByText("5/5")).toBeVisible();
  await page.getByRole("button", { name: "Experimentos" }).click();
  await expect(page.locator(".capitulo")).toHaveCount(5);
});

test("si una corrección cambia la Autoridad, su capítulo se abre otra vez con el antes y el después, las entradas quedan con el valor anterior y el resto del progreso sigue (R12)", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Libro" }).click();
  await page.getByRole("button", { name: "Elegir este" }).first().click();
  const segundo = page.locator(".capitulo").nth(1);
  await segundo.getByRole("button", { name: "Elegir este" }).first().click();
  await expect(segundo.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
  await segundo.getByLabel("Anota algo en tu diario").fill("Escrita con la Autoridad anterior.");
  await segundo.getByRole("button", { name: "Guardar en mi diario" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ahora no" }).click();
  await expect.poll(() => servidor.documentos.length).toBe(4);

  // La carta se corrige: mismo Tipo (Proyector), otra Autoridad (de Emocional a Esplénica).
  const carta = servidor.documentos.find((d) => d.tipo === "carta")!;
  carta.contenido = JSON.stringify({ ...CARTA, instante: "1985-01-20T04:00:00.000Z", inicio: "1985-01-20T03:55:00.000Z", fin: "1985-01-20T04:05:00.000Z" });
  carta.version += 1;
  await page.reload();
  await page.getByRole("button", { name: "Libro" }).click();
  await expect(page.locator(".capitulo").first().getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
  await expect(page.locator(".capitulo").first().locator(".capitulo-cambio")).toHaveCount(0);
  await expect(segundo.locator(".capitulo-cambio")).toHaveText("Tu carta cambió por una corrección. Antes: Autoridad: Emocional. Ahora: Autoridad: Esplénica. Este capítulo se abre otra vez.");
  await expect(segundo.getByRole("heading", { name: "Elige cómo probarlo" })).toBeVisible();
  await expect(segundo.getByText(/^Tu Autoridad es Esplénica/)).toBeVisible();
  await expect(segundo.locator(".diario-entradas li")).toContainText("Autoridad: Emocional");
  await expect(page.locator(".capitulo").nth(2).getByRole("heading", { name: "Capítulo 3 · Tu Perfil" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  // Elegir otra vez cierra el aviso.
  await segundo.getByRole("button", { name: "Elegir este" }).first().click();
  await expect(segundo.locator(".capitulo-cambio")).toHaveCount(0);
  await expect(segundo.getByRole("heading", { name: "Capítulo completado" })).toBeVisible();
});
