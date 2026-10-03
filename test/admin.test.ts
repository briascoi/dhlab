import { readFileSync } from "node:fs";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, expect, test } from "vitest";
import { getPlatformProxy } from "wrangler";
import { admin } from "../worker/admin";

const ORIGEN = "https://dhlab.app";
const EQUIPO = "equipo.cloudflareaccess.com";
let db: D1Database;
let cerrar: () => Promise<void>;
let claves: ReturnType<typeof createLocalJWKSet>;
let token: string;
let tokenAjeno: string;

beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "test/wrangler.test.jsonc", persist: false });
  db = proxy.env.DB;
  cerrar = proxy.dispose;
  const sql = readFileSync("migrations/0001_cuentas.sql", "utf8").replace(/--.*$/gm, "");
  for (const s of sql.split(";").map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  claves = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "RS256" }] });
  const firmar = (aud: string) => new SignJWT({}).setProtectedHeader({ alg: "RS256" }).setIssuer(`https://${EQUIPO}`).setAudience(aud).setExpirationTime("5m").sign(privateKey);
  token = await firmar("aud-panel");
  tokenAjeno = await firmar("otra-app");
});
afterAll(() => cerrar());

const env = () => ({ DB: db, ASSETS: { fetch: async () => new Response("pagina") }, ACCESS_EQUIPO: EQUIPO, ACCESS_AUD: "aud-panel" });
function pedir(metodo: string, ruta: string, opciones: { token?: string | null; cuerpo?: object; origen?: string; env?: object } = {}) {
  const headers: Record<string, string> = { Origin: opciones.origen ?? ORIGEN };
  const t = opciones.token === undefined ? token : opciones.token;
  if (t) headers["Cf-Access-Jwt-Assertion"] = t;
  const init: RequestInit = { method: metodo, headers };
  if (opciones.cuerpo) init.body = JSON.stringify(opciones.cuerpo);
  return admin(new Request(`${ORIGEN}${ruta}`, init) as never, (opciones.env ?? env()) as never, claves, 1000);
}

test("sin token de Access, con token de otra aplicación o sin configuración, el panel no responde", async () => {
  expect((await pedir("GET", "/admin", { token: null })).status).toBe(403);
  expect((await pedir("GET", "/admin/api/invitaciones", { token: tokenAjeno })).status).toBe(403);
  expect((await pedir("GET", "/admin/api/invitaciones", { token: "basura" })).status).toBe(403);
  expect((await pedir("GET", "/admin", { env: { ...env(), ACCESS_AUD: undefined } })).status).toBe(403);
});

test("con Access válido: la página, invitar, listar y quitar", async () => {
  expect(await (await pedir("GET", "/admin")).text()).toBe("pagina");
  expect((await pedir("POST", "/admin/api/invitaciones", { cuerpo: { email: " Ana@Ejemplo.com " } })).status).toBe(200);
  expect((await pedir("POST", "/admin/api/invitaciones", { cuerpo: { email: "mal" } })).status).toBe(400);
  expect(await (await pedir("GET", "/admin/api/invitaciones")).json()).toEqual({ invitaciones: [{ email: "ana@ejemplo.com", creada: 1000 }], cuentas: [] });
  expect((await pedir("POST", "/admin/api/invitaciones", { cuerpo: { email: "x@y.com" }, origen: "https://otro.sitio" })).status).toBe(403);
  expect((await pedir("DELETE", "/admin/api/invitaciones", { cuerpo: { email: "ana@ejemplo.com" } })).status).toBe(200);
  expect(((await (await pedir("GET", "/admin/api/invitaciones")).json()) as { invitaciones: unknown[] }).invitaciones).toEqual([]);
});
