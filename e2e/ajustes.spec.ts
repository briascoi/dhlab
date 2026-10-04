// Ajustes (DR30), tema (DR16), salir y borrar cuenta (DR44).
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CARTA, simularServidor } from "./servidor";

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

// Movimiento (DESIGN.md, Motion): tres niveles, guardados en el dispositivo; "reducir movimiento" arranca en mínimo.
const corriendo = (page: Page) => page.evaluate(() => document.getAnimations().filter((x) => x.playState === "running").length);
test("el nivel de movimiento se elige en Ajustes y se guarda; en mínimo no queda nada animado", async ({ page }) => {
  await abrirAjustes(page);
  await expect(page.getByRole("radio", { name: "Completo" })).toBeChecked();
  await page.getByRole("radio", { name: "Mínimo" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-mov", "minimo");
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-mov", "minimo");
  expect(await corriendo(page)).toBe(0);
  // En completo, el mapa está encendido: las luces laten y la señal viaja por los cables.
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("radio", { name: "Completo" }).check();
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.locator(".mapa-luz").first()).toBeVisible();
  expect(await corriendo(page)).toBeGreaterThan(0);
  // En suave no hay movimiento en reposo.
  await page.evaluate(() => (document.documentElement.dataset.mov = "suave"));
  await expect.poll(() => corriendo(page)).toBe(0);
});

test("con reducir movimiento en el sistema, la app arranca en mínimo y la persona puede subirlo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrirAjustes(page);
  await expect(page.locator("html")).toHaveAttribute("data-mov", "minimo");
  await expect(page.getByRole("radio", { name: "Mínimo" })).toBeChecked();
  await page.getByRole("radio", { name: "Suave" }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mov", "suave");
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

test("Exportar muestra primero qué incluye y recién después arma el archivo (DR43)", async ({ page }) => {
  await abrirAjustes(page);
  await page.getByRole("button", { name: "Exportar mis datos" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Exportar tus datos" })).toBeFocused();
  await expect(hoja.getByText("Incluye tu carta, tu libro y tu diario.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  const [descarga] = await Promise.all([page.waitForEvent("download"), hoja.getByRole("button", { name: "Exportar", exact: true }).click()]);
  expect(descarga.suggestedFilename()).toBe("dhlab-mis-datos.json");
  await expect(hoja.getByRole("status")).toHaveText("Listo para guardar");
});

test("con la sesión vencida aparece un aviso que lleva a entrar otra vez (DR36)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  servidor.cuenta = null;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  const aviso = page.getByRole("button", { name: "Tu sesión venció. Vuelve a entrar." });
  await expect(aviso).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await aviso.click();
  const hoja = page.getByRole("dialog");
  await hoja.getByLabel("Tu email").fill("prueba@ejemplo.com");
  await hoja.getByRole("button", { name: /código de acceso/ }).click();
  await hoja.getByLabel(/Código de acceso/).fill("123456");
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect(aviso).toHaveCount(0);
});

test("si otro dispositivo cambió la carta antes, la corrección se compara y se aplica sin reescribir (DR38)", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  const incierta = { ...CARTA, nacimiento: { ...CARTA.nacimiento, confiabilidad: "desconocida" }, inicio: "1990-05-15T03:00:00.000Z", fin: "1990-05-16T03:00:00.000Z" };
  servidor.documentos[0]!.contenido = JSON.stringify(incierta);
  await page.goto("/");
  await page.locator(".banner").getByRole("button").click();
  // Mientras tanto, otro dispositivo corrige la hora a las 9.
  servidor.documentos[0] = { ...servidor.documentos[0]!, contenido: JSON.stringify({ ...CARTA, nacimiento: { ...CARTA.nacimiento, hora: "09:00" } }), version: 2 };
  await page.getByRole("radio", { name: /^Exacta/ }).check();
  await page.getByLabel("Hora de nacimiento").fill("14:30");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Calcular mi carta" }).click();
  await page.getByRole("button", { name: "Encender" }).click();
  await page.getByRole("button", { name: "Saltar" }).click();

  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Tu carta cambió desde otro dispositivo" })).toBeVisible();
  await expect(hoja.locator("section").filter({ hasText: "Ahora" })).toContainText("09:00");
  await expect(hoja.locator("section").filter({ hasText: "Tu corrección" })).toContainText("14:30");
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await hoja.getByRole("button", { name: "Aplicar mi corrección" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect.poll(() => servidor.documentos[0]!.version).toBe(3);
  expect(JSON.parse(servidor.documentos[0]!.contenido)).toMatchObject({ nacimiento: { hora: "14:30" } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("pasar a solo en este dispositivo: etapas a la vista, el servidor queda sin copia y la carta sigue en el dispositivo (DR39)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  await page.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Solo en este dispositivo" })).toBeFocused();
  await expect(hoja.getByText("En iPhone, Safari puede borrar los datos")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  expect(servidor.documentos).toHaveLength(1);

  // Este dispositivo está desactualizado: otro subió algo que acá todavía no bajó (CEO2-O4).
  servidor.documentos.push({ tipo: "libro", id: "capitulo-1", contenido: JSON.stringify({ texto: "del otro dispositivo" }), cifrado: false, version: 1 });
  // La primera vez el servidor falla sin haber cambiado nada: la cuenta sigue en la nube.
  servidor.fallosAlCambiar = 1;
  await hoja.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("El cambio no terminó. Tus datos siguen en la nube y no se borró nada.");
  expect([servidor.documentos.length, servidor.cuenta!.modo]).toEqual([2, "nube"]);
  await hoja.getByRole("button", { name: "Reintentar" }).click();
  await expect(hoja.locator(".etapas li")).toHaveText(["Subiendo lo pendiente", "Bajando y verificando: 2 de 2", "Borrando la copia del servidor", "Listo"]);
  expect([servidor.documentos.length, servidor.cuenta!.modo]).toEqual([0, "local"]);
  // Lo que solo estaba en el servidor quedó en este dispositivo antes de borrarse.
  expect(await page.evaluate(() => new Promise<number>((listo) => { const p = indexedDB.open("dhlab:prueba@ejemplo.com"); p.onsuccess = () => { const c = p.result.transaction("documentos").objectStore("documentos").count(); c.onsuccess = () => listo(c.result); }; }))).toBe(2);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await hoja.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.locator("dd").getByText("Solo en este dispositivo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pasar a solo en este dispositivo" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect(page.locator(".banner")).toHaveCount(0);
  expect(servidor.documentos).toHaveLength(0);
});

test("si la respuesta del cambio se pierde, la app consulta cómo quedó antes de decir nada (Codex #5)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  servidor.cortarCambio = true;
  await page.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await expect(hoja.locator(".etapas li")).toHaveText(["Subiendo lo pendiente", "Bajando y verificando: 1 de 1", "Borrando la copia del servidor", "Comprobando el cambio", "Listo"]);
  await expect(hoja.locator(".error")).toBeEmpty();
});

test("otro dispositivo de una cuenta que pasó a solo local lo avisa al abrir", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  servidor.cuenta = { ...servidor.cuenta!, modo: "local" };
  servidor.documentos = [];
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Tu mapa" })).toBeVisible();
  await expect(page.getByText("Tu cuenta dejó de guardarse en la nube. Lo que hay en este dispositivo se queda aquí.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test("un dispositivo abierto con un cambio sin subir pasa a solo local al primer rechazo y ofrece exportar", async ({ page }) => {
  const servidor = await simularServidor(page, { conSesion: true, carta: true });
  servidor.documentos[0]!.contenido = JSON.stringify({ ...CARTA, nacimiento: { ...CARTA.nacimiento, confiabilidad: "desconocida" }, inicio: "1990-05-15T03:00:00.000Z", fin: "1990-05-16T03:00:00.000Z" });
  await page.goto("/");
  // Corrige la hora sin red: el cambio queda en la cola.
  await expect(page.locator(".banner")).toBeVisible();
  servidor.sinRed = true;
  await page.locator(".banner").getByRole("button").click();
  await page.getByRole("radio", { name: /^Exacta/ }).check();
  await page.getByLabel("Hora de nacimiento").fill("14:30");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Calcular mi carta" }).click();
  await page.getByRole("button", { name: "Encender" }).click();
  await page.getByRole("button", { name: "Saltar" }).click();
  await page.getByRole("button", { name: "Empezar el Capítulo 1" }).click();
  await expect(page.getByRole("button", { name: "Sin conexión" })).toBeVisible();
  // Mientras tanto, otro dispositivo pasó la cuenta a solo local.
  servidor.cuenta = { ...servidor.cuenta!, modo: "local" };
  servidor.documentos = [];
  servidor.sinRed = false;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByText("Tu cuenta dejó de guardarse en la nube.")).toBeVisible();
  await expect(page.getByText("Tienes cambios que no llegaron a la nube.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar mis datos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sin conexión" })).toHaveCount(0);
});

test("de solo local a la nube: el servidor cambia el modo y el dispositivo sube lo suyo como nuevo (DR39)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  await page.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  expect([servidor.documentos.length, servidor.cuenta!.modo]).toEqual([0, "local"]);

  await page.getByRole("button", { name: "Guardar en la nube" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: "Guardar en la nube" })).toBeFocused();
  await expect(hoja.getByText("Tu carta y tu libro se guardan en nuestro servidor, donde Isma puede verlos.")).toBeVisible();
  await expect(hoja.getByText(/código de recuperación/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  // La primera vez se corta la subida: la cuenta ya está en la nube y lo que falta queda en la cola.
  servidor.sinRed = true;
  await hoja.getByRole("button", { name: "Pasar a la nube" }).click();
  await expect(hoja.locator(".etapas li")).toHaveText(["Subiendo: 0 de 1", "La subida se cortó. Sigue donde quedó en cuanto haya conexión."]);
  await hoja.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.locator("dd").getByText("En la nube")).toBeVisible();
  expect([servidor.documentos.length, servidor.cuenta!.modo]).toEqual([0, "nube"]);
  servidor.sinRed = false;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect.poll(() => servidor.documentos.map((d) => [d.tipo, d.version])).toEqual([["carta", 1]]);
  await expect(page.getByRole("button", { name: "Sin conexión" })).toHaveCount(0);
});

test("otro dispositivo de una cuenta que pasó a la nube lo avisa y sube lo suyo (E4-otrosdisp)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  await page.getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Pasar a solo en este dispositivo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  // Otro dispositivo vuelve a pasar la cuenta a la nube.
  servidor.cuenta = { ...servidor.cuenta!, modo: "nube" };
  await page.reload();
  await expect(page.getByText("Tu cuenta ahora se guarda en la nube. Estamos subiendo lo que hay en este dispositivo.")).toBeVisible();
  await expect.poll(() => servidor.documentos.length).toBe(1);
});

test("Corregir mis datos vuelve al formulario con lo guardado, y la carta corregida reemplaza a la anterior", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  await page.getByRole("button", { name: "Corregir mis datos" }).click();
  await expect(page.getByLabel("Fecha de nacimiento")).toHaveValue("1990-05-15");
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-16");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByLabel("Hora de nacimiento")).toHaveValue("14:30");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Calcular mi carta" }).click();
  await page.getByRole("button", { name: "Encender" }).click();
  await page.getByRole("button", { name: "Saltar" }).click();
  await expect.poll(() => servidor.documentos.find((d) => d.tipo === "carta")!.version).toBe(2);
  expect(JSON.parse(servidor.documentos.find((d) => d.tipo === "carta")!.contenido)).toMatchObject({ nacimiento: { fecha: "1990-05-16" } });
});

test("Importar: valida, muestra la vista previa y combina sin duplicar; una carta distinta se compara en vez de reemplazar (DR43)", async ({ page }) => {
  const servidor = await abrirAjustes(page);
  const archivo = (documentos: unknown[]) => ({ name: "dhlab-mis-datos.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ esquema: 1, documentos })) });
  const capitulo = { tipo: "libro", id: "capitulo-1", contenido: { esquema: 1, experimento: "observacion.firma_no_yo", elegido: "2026-10-01T10:00:00.000Z", atributo: "Estrategia: Esperar la invitación", fichas: [] } };
  const entrada = { tipo: "diario", id: "entrada-1", contenido: JSON.stringify({ texto: "Escrita en otro navegador.", fecha: "2026-10-02T09:00:00.000Z", capitulo: 1, atributo: "Estrategia: Esperar la invitación" }) };
  const carta = { tipo: "carta", id: "principal", contenido: CARTA };

  await page.getByRole("button", { name: "Importar un archivo" }).click();
  const hoja = page.getByRole("dialog").filter({ hasText: "Importar un archivo" });
  await expect(hoja.getByRole("heading", { name: "Importar un archivo" })).toBeFocused();
  await hoja.getByLabel("Elegir archivo").setInputFiles({ name: "otro.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(hoja.getByRole("alert")).toHaveText("Este archivo no es una exportación de DH Lab.");
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  const filas = hoja.locator(".importar-vista .fila");
  await hoja.getByLabel("Elegir archivo").setInputFiles(archivo([carta, capitulo, entrada]));
  await expect(filas).toHaveText(["Nuevo2", "Ya existe1", "En conflicto0"]);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  expect(servidor.documentos).toHaveLength(1);
  await hoja.getByRole("button", { name: "Combinar" }).click();
  await expect(hoja.getByRole("status")).toHaveText("Listo: se combinó con tus datos.");
  // El diario importado se cifra con una clave nueva, y su código se muestra.
  const codigo = page.getByRole("dialog").filter({ hasText: "Tu código de recuperación" });
  await codigo.getByRole("button", { name: "Ahora no" }).click();
  await expect.poll(() => servidor.documentos.map((d) => `${d.tipo}/${d.id}`).sort()).toEqual(["carta/principal", "diario/entrada-1", "libro/capitulo-1"]);
  expect(servidor.documentos.find((d) => d.tipo === "diario")!.contenido).not.toContain("Escrita en otro navegador");

  // El mismo archivo otra vez: todo existe. Con otra carta y otra versión de la entrada: dos choques, y nada se reemplaza.
  await hoja.getByLabel("Elegir archivo").setInputFiles(archivo([carta, capitulo, entrada]));
  await expect(filas).toHaveText(["Nuevo0", "Ya existe3", "En conflicto0"]);
  const otraCarta = { ...carta, contenido: { ...CARTA, nacimiento: { ...CARTA.nacimiento, hora: "09:00" } } };
  const otraEntrada = { ...entrada, contenido: JSON.stringify({ ...JSON.parse(entrada.contenido), texto: "La misma entrada, con otro texto." }) };
  await hoja.getByLabel("Elegir archivo").setInputFiles(archivo([otraCarta, otraEntrada]));
  await expect(filas).toHaveText(["Nuevo0", "Ya existe0", "En conflicto2"]);
  await expect(hoja.getByText("Si una entrada choca, quedan las dos versiones.")).toBeVisible();
  await hoja.getByRole("button", { name: "Combinar" }).click();
  const comparacion = page.getByRole("dialog").filter({ hasText: "Tu carta cambió desde otro dispositivo" });
  await expect(comparacion.locator("section").filter({ hasText: "Tu corrección" })).toContainText("09:00");
  await comparacion.getByRole("button", { name: "Dejar la actual" }).click();
  await expect.poll(() => servidor.documentos.filter((d) => d.tipo === "diario").map((d) => d.id).sort()).toEqual(["entrada-1", "entrada-1~otra"]);
  expect(JSON.parse(servidor.documentos.find((d) => d.tipo === "carta")!.contenido)).toMatchObject({ nacimiento: { hora: "14:30" } });

  // En el Libro, las dos versiones van juntas; "Quedarme con las dos" quita la etiqueta (DR37).
  test.skip(!existsSync("contenido/capitulo-1.json"), "sin la carpeta de contenido");
  await page.getByRole("button", { name: "Libro" }).click();
  const entradas = page.locator(".diario-entradas li");
  await expect(entradas).toHaveCount(2);
  await expect(entradas.nth(1)).toContainText("Versión de otro dispositivo");
  await expect(entradas.nth(1)).toContainText("La misma entrada, con otro texto.");
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  // "Borrar esta" la oculta y deja deshacer unos segundos; deshecho, vuelve y nada se borró.
  await page.getByRole("button", { name: "Borrar esta" }).click();
  await expect(page.getByText("Entrada borrada")).toBeVisible();
  await expect(entradas.filter({ hasText: "La misma entrada, con otro texto." })).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(entradas.nth(1)).toContainText("La misma entrada, con otro texto.");
  expect(servidor.documentos.filter((d) => d.tipo === "diario")).toHaveLength(2);
  // Sin deshacer, pasado el plazo se borra del dispositivo y de la cuenta.
  await page.getByRole("button", { name: "Borrar esta" }).click();
  await expect.poll(() => servidor.documentos.filter((d) => d.tipo === "diario").map((d) => d.id), { timeout: 15_000 }).toEqual(["entrada-1"]);
  await expect(page.getByText("Entrada borrada")).toHaveCount(0);
  await expect(entradas).toHaveCount(1);
});
