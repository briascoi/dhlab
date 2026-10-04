import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { getPlatformProxy } from "wrangler";
import { LIMITES, cuenta } from "../worker/cuenta";

let db: D1Database;
let cerrar: () => Promise<void>;
let enviados: { para: string; texto: string }[] = [];
const ORIGEN = "https://dhlab.app";
const T0 = 1_800_000_000_000;

beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "test/wrangler.test.jsonc", persist: false });
  db = proxy.env.DB;
  cerrar = proxy.dispose;
  for (const archivo of readdirSync("migrations").sort()) {
    const sql = readFileSync(`migrations/${archivo}`, "utf8").replace(/--.*$/gm, "");
    for (const sentencia of sql.split(";").map((s) => s.trim()).filter(Boolean)) await db.prepare(sentencia).run();
  }
});
afterAll(() => cerrar());
beforeEach(async () => {
  enviados = [];
  for (const tabla of ["sesiones", "cuentas", "codigos", "envios", "invitaciones"]) await db.prepare(`DELETE FROM ${tabla}`).run();
  await db.prepare("INSERT INTO invitaciones (email, creada) VALUES ('ana@ejemplo.com', 0)").run();
});

const env = (registro?: string) => ({ DB: db, REGISTRO: registro, enviarEmail: async (m: { para: string; texto: string }) => void enviados.push(m) });
function pedir(metodo: string, ruta: string, cuerpo?: object, extra: { cookie?: string; origen?: string | null; ahora?: number; ip?: string; registro?: string } = {}) {
  const headers: Record<string, string> = { "CF-Connecting-IP": extra.ip ?? "1.1.1.1" };
  if (extra.origen !== null) headers.Origin = extra.origen ?? ORIGEN;
  if (extra.cookie) headers.Cookie = extra.cookie;
  const init: RequestInit = { method: metodo, headers };
  if (cuerpo) init.body = JSON.stringify(cuerpo);
  return cuenta(new Request(`${ORIGEN}${ruta}`, init) as never, env(extra.registro) as never, extra.ahora ?? T0);
}
const codigoEnviado = () => /\d{6}/.exec(enviados.at(-1)!.texto)![0];
async function entrar(email = "ana@ejemplo.com", modo?: string) {
  await pedir("POST", "/v1/cuenta/acceso", { email, modo, idPedido: "p1" });
  const r = await pedir("POST", "/v1/cuenta/verificar", { email, codigo: codigoEnviado() });
  return { r, cookie: r.headers.get("Set-Cookie")!.split(";")[0]! };
}

test("código en la misma pestaña: pedir, verificar y quedar con sesión", async () => {
  const { r, cookie } = await entrar();
  expect(r.status).toBe(200);
  expect(r.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax; Path=\//);
  expect(await (await pedir("GET", "/v1/cuenta", undefined, { cookie })).json()).toEqual({ cuenta: { email: "ana@ejemplo.com", modo: "nube" } });
  // En la base solo queda el hash de la sesión y del código, nunca el valor.
  const { hash } = (await db.prepare("SELECT hash FROM sesiones").first<{ hash: string }>())!;
  expect(cookie).not.toContain(hash);
});

test("el email lleva el código en texto plano y en la versión con diseño", async () => {
  await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com" });
  const { texto, html } = enviados.at(-1) as unknown as { texto: string; html: string };
  expect(texto).toMatch(/^Tu código de acceso es \d{6}\. Vence en 10 minutos\.$/);
  expect(html).toContain(codigoEnviado());
  expect(html).toContain("Vence en 10 minutos.");
});

test("email no invitado y email mal escrito", async () => {
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "otro@ejemplo.com" })).status).toBe(403);
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "sin-arroba" })).status).toBe(400);
  expect(enviados).toHaveLength(0);
});

test("el mismo pedido repetido no manda otro email; uno nuevo espera", async () => {
  await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: "p1" });
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: "p1" })).status).toBe(200);
  expect(enviados).toHaveLength(1);
  const r = await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: "p2" });
  expect(r.status).toBe(429);
  expect(((await r.json()) as { espera: number }).espera).toBe(60);
});

test("tope de envíos por email", async () => {
  for (let i = 0; i < LIMITES.porEmail; i++) {
    expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: `p${i}` }, { ahora: T0 + i * LIMITES.esperaReenvio })).status).toBe(200);
  }
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: "px" }, { ahora: T0 + LIMITES.porEmail * LIMITES.esperaReenvio })).status).toBe(429);
});

test("código incorrecto cuenta intentos y se agota al quinto", async () => {
  await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com" });
  const bueno = codigoEnviado();
  const malo = bueno === "000000" ? "111111" : "000000";
  const r = await pedir("POST", "/v1/cuenta/verificar", { email: "ana@ejemplo.com", codigo: malo });
  expect([r.status, await r.json()]).toEqual([401, { error: "codigo_incorrecto", quedan: 4 }]);
  for (let i = 0; i < 4; i++) await pedir("POST", "/v1/cuenta/verificar", { email: "ana@ejemplo.com", codigo: malo });
  expect((await pedir("POST", "/v1/cuenta/verificar", { email: "ana@ejemplo.com", codigo: bueno })).status).toBe(429);
});

test("código vencido a los 10 minutos", async () => {
  await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com" });
  const r = await pedir("POST", "/v1/cuenta/verificar", { email: "ana@ejemplo.com", codigo: codigoEnviado() }, { ahora: T0 + LIMITES.codigoVence });
  expect(r.status).toBe(410);
});

test("Origin ajeno o ausente da 403 en pedidos que cambian datos", async () => {
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com" }, { origen: "https://otro.sitio" })).status).toBe(403);
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com" }, { origen: null })).status).toBe(403);
});

test("la sesión se renueva con el uso y vence a los 30 días sin uso", async () => {
  const { cookie } = await entrar();
  const casi = T0 + LIMITES.sesion - 1000;
  expect((await pedir("GET", "/v1/cuenta", undefined, { cookie, ahora: casi })).status).toBe(200);
  expect((await pedir("GET", "/v1/cuenta", undefined, { cookie, ahora: casi + LIMITES.sesion - 1000 })).status).toBe(200);
  expect((await pedir("GET", "/v1/cuenta", undefined, { cookie, ahora: casi + 3 * LIMITES.sesion })).status).toBe(401);
});

test("salir invalida la sesión en el servidor", async () => {
  const { cookie } = await entrar();
  expect((await pedir("POST", "/v1/cuenta/salir", undefined, { cookie })).status).toBe(200);
  expect((await pedir("GET", "/v1/cuenta", undefined, { cookie })).status).toBe(401);
});

test("solo en este dispositivo: el modo se elige al crear la cuenta y no cambia al volver a entrar", async () => {
  await entrar("ana@ejemplo.com", "local");
  const { r } = await entrar("ana@ejemplo.com", "nube");
  expect(await r.json()).toEqual({ cuenta: { email: "ana@ejemplo.com", modo: "local" } });
});

test("borrar cuenta no deja ninguna fila de esa cuenta", async () => {
  const { cookie } = await entrar();
  expect((await pedir("DELETE", "/v1/cuenta", undefined, { cookie })).status).toBe(200);
  for (const tabla of ["sesiones", "cuentas", "codigos", "invitaciones"]) {
    expect((await db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first<{ n: number }>())!.n, tabla).toBe(0);
  }
  // De los topes de envío solo puede quedar la fila por IP, que no lleva el email y caduca sola en una hora.
  expect((await db.prepare("SELECT clave FROM envios").all<{ clave: string }>()).results.map((f) => f.clave)).toEqual(["i:1.1.1.1"]);
  expect((await pedir("GET", "/v1/cuenta", undefined, { cookie })).status).toBe(401);
});

test("con el registro cerrado no se crean cuentas nuevas, y las que existen siguen entrando", async () => {
  const cerrado = { registro: "cerrado", ahora: T0 + LIMITES.ventana * 2 };
  await entrar();
  await db.prepare("INSERT INTO invitaciones (email, creada) VALUES ('nueva@ejemplo.com', 0)").run();
  const nueva = await pedir("POST", "/v1/cuenta/acceso", { email: "nueva@ejemplo.com", idPedido: "p2" }, cerrado);
  expect([nueva.status, await nueva.json()]).toEqual([403, { error: "no_invitado" }]);
  expect((await pedir("POST", "/v1/cuenta/acceso", { email: "ana@ejemplo.com", idPedido: "p3" }, cerrado)).status).toBe(200);
});
