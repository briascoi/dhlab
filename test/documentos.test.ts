import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { cuenta } from "../worker/cuenta";
import { documentos } from "../worker/documentos";
import { documentosApi, type DocumentosApi } from "../src/cuenta-api";
import { crearSync, type Almacen } from "../src/sync";
import { crearDiario, desenvolver } from "../src/cifrado";
import type { ClaveApi } from "../src/cuenta-api";

let db: D1Database;
let cerrar: () => Promise<void>;
let codigo = "";
const ORIGEN = "https://dhlab.app";
const T0 = 1_800_000_000_000;

beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "test/wrangler.test.jsonc", persist: false });
  db = proxy.env.DB;
  cerrar = proxy.dispose;
  for (const archivo of readdirSync("migrations").sort()) {
    const sql = readFileSync(`migrations/${archivo}`, "utf8").replace(/--.*$/gm, "");
    for (const s of sql.split(";").map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();
  }
});
afterAll(() => cerrar());
beforeEach(async () => {
  for (const tabla of ["documentos", "claves", "sesiones", "cuentas", "codigos", "envios", "invitaciones"]) await db.prepare(`DELETE FROM ${tabla}`).run();
});

const env = () => ({ DB: db, enviarEmail: async (m: { texto: string }) => void (codigo = /\d{6}/.exec(m.texto)![0]) });
const pedido = (metodo: string, ruta: string, cuerpo?: object, cookie?: string, origen = ORIGEN) => {
  const headers: Record<string, string> = { Origin: origen };
  if (cookie) headers.Cookie = cookie;
  const init: RequestInit = { method: metodo, headers };
  if (cuerpo) init.body = JSON.stringify(cuerpo);
  return new Request(`${ORIGEN}${ruta}`, init) as never;
};
async function entrar(email: string, modo = "nube") {
  await db.prepare("INSERT OR IGNORE INTO invitaciones (email, creada) VALUES (?, 0)").bind(email).run();
  await cuenta(pedido("POST", "/v1/cuenta/acceso", { email, modo }), env() as never, T0);
  const r = await cuenta(pedido("POST", "/v1/cuenta/verificar", { email, codigo }), env() as never, T0);
  return r.headers.get("Set-Cookie")!.split(";")[0]!;
}
const doc = (metodo: string, ruta: string, cuerpo: object | undefined, cookie?: string, origen?: string) => documentos(pedido(metodo, ruta, cuerpo, cookie, origen), env() as never, T0);
const guardar = (cookie: string, contenido: string, versionBase: number, idOperacion: string, ruta = "/v1/documentos/carta/principal", cifrado = false) =>
  doc("PUT", ruta, { contenido, versionBase, idOperacion, cifrado }, cookie);

test("guardar la carta, leerla y editarla con su versión", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  expect(await (await guardar(cookie, "v1", 0, "op1")).json()).toEqual({ documento: { tipo: "carta", id: "principal", contenido: "v1", cifrado: false, version: 1 } });
  expect(((await (await guardar(cookie, "v2", 1, "op2")).json()) as { documento: { version: number } }).documento.version).toBe(2);
  const lista = (await (await doc("GET", "/v1/documentos?tipo=carta", undefined, cookie)).json()) as { documentos: { contenido: string }[] };
  expect(lista.documentos.map((d) => d.contenido)).toEqual(["v2"]);
});

test("una edición con versión vieja se rechaza y devuelve la actual", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  await guardar(cookie, "v1", 0, "op1");
  await guardar(cookie, "v2", 1, "op2");
  const r = await guardar(cookie, "otra", 1, "op3");
  expect(r.status).toBe(409);
  expect(await r.json()).toMatchObject({ error: "conflicto", actual: { contenido: "v2", version: 2 } });
  // Crear de nuevo algo que ya existe también es un conflicto.
  expect((await guardar(cookie, "otra", 0, "op4")).status).toBe(409);
});

test("la misma operación repetida no escribe dos veces (respuesta perdida)", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  await guardar(cookie, "v1", 0, "op1");
  const a = await guardar(cookie, "v2", 1, "op2");
  const b = await guardar(cookie, "v2", 1, "op2");
  expect([a.status, b.status]).toEqual([200, 200]);
  expect(((await b.json()) as { documento: { version: number } }).documento.version).toBe(2);
});

test("una cuenta solo local no puede guardar contenido en el servidor", async () => {
  const cookie = await entrar("local@ejemplo.com", "local");
  expect((await guardar(cookie, "v1", 0, "op1")).status).toBe(403);
  expect((await db.prepare("SELECT COUNT(*) AS n FROM documentos").first<{ n: number }>())!.n).toBe(0);
});

test("cada cuenta ve solo lo suyo, y hace falta sesión y Origin propio", async () => {
  const ana = await entrar("ana@ejemplo.com");
  const beto = await entrar("beto@ejemplo.com");
  await guardar(ana, "de ana", 0, "op1");
  expect(((await (await doc("GET", "/v1/documentos", undefined, beto)).json()) as { documentos: unknown[] }).documentos).toEqual([]);
  expect((await doc("GET", "/v1/documentos", undefined)).status).toBe(401);
  expect((await doc("PUT", "/v1/documentos/carta/principal", { contenido: "x", versionBase: 1, idOperacion: "op" }, ana, "https://otro.sitio")).status).toBe(403);
});

test("el diario solo entra cifrado, y hay tope de tamaño", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  expect((await guardar(cookie, "texto legible", 0, "op1", "/v1/documentos/diario/e1")).status).toBe(400);
  await doc("PUT", "/v1/clave", { idClave: "k1", envuelta: "x", revisionBase: 0 }, cookie);
  expect((await guardar(cookie, "v1.k1.iv.datos", 0, "op2", "/v1/documentos/diario/e1", true)).status).toBe(200);
  expect((await guardar(cookie, "x".repeat(64 * 1024 + 1), 0, "op3", "/v1/documentos/libro/c1")).status).toBe(413);
});

test("borrar la cuenta se lleva sus documentos", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  await guardar(cookie, "v1", 0, "op1");
  await cuenta(pedido("DELETE", "/v1/cuenta", undefined, cookie), env() as never, T0);
  expect((await db.prepare("SELECT COUNT(*) AS n FROM documentos").first<{ n: number }>())!.n).toBe(0);
});

// Cliente (src/sync.ts) contra este mismo Worker: almacén en memoria en vez de IndexedDB.
function memoria(): Almacen {
  const stores = { documentos: new Map<unknown, object>(), cola: new Map<unknown, object>(), claves: new Map<unknown, object>() };
  let n = 0;
  return {
    todos: async <T>(store: keyof typeof stores) => [...stores[store].values()] as T[],
    aplicar: async (poner, quitar = []) => {
      for (const [store, valor] of poner) {
        if (store === "cola") stores.cola.set(++n, { ...valor, n });
        else stores[store].set((valor as { clave?: string; id?: string }).clave ?? (valor as { id: string }).id, valor);
      }
      for (const [store, clave] of quitar) stores[store].delete(clave);
    },
  };
}
const apiDe = (cookie: string): DocumentosApi => ({
  listar: async () => (await doc("GET", "/v1/documentos", undefined, cookie)).json(),
  guardar: async (tipo, id, cambio) => (await doc("PUT", `/v1/documentos/${tipo}/${id}`, cambio, cookie)).json(),
});
const enServidor = async () => (await db.prepare("SELECT contenido, version FROM documentos").all()).results;

test("sync: sube la carta, y una respuesta perdida se reintenta sin escribir dos veces", async () => {
  const api = apiDe(await entrar("ana@ejemplo.com"));
  const almacen = memoria();
  let perder = true;
  const sync = crearSync(almacen, { ...api, guardar: async (...a) => {
    const r = await api.guardar(...a);
    return perder ? ((perder = false), { error: "sin_red" }) : r;
  } }, "nube");
  await sync.guardar("carta", "principal", "v1");
  expect(await sync.sincronizar()).toBe("sin_red");
  expect(await almacen.todos("cola")).toHaveLength(1);
  // Una edición hecha antes del reintento sube después, sobre la versión que dejó la primera.
  await sync.guardar("carta", "principal", "v2");
  expect(await sync.sincronizar()).toBe("al_dia");
  expect(await enServidor()).toEqual([{ contenido: "v2", version: 2 }]);
  expect([await almacen.todos("cola"), (await sync.leer("carta", "principal"))!.version]).toEqual([[], 2]);
});

test("sync: otro dispositivo baja la carta, y su edición con versión vieja queda rechazada con la del servidor a la vista", async () => {
  const api = apiDe(await entrar("ana@ejemplo.com"));
  const celu = crearSync(memoria(), api, "nube");
  const compu = crearSync(memoria(), api, "nube");
  await celu.guardar("carta", "principal", "v1");
  await celu.sincronizar();
  await compu.sincronizar();
  expect((await compu.leer("carta", "principal"))!.contenido).toBe("v1");
  await celu.guardar("carta", "principal", "del celu");
  await compu.guardar("carta", "principal", "de la compu");
  await celu.sincronizar();
  expect(await compu.sincronizar()).toBe("al_dia");
  expect(await compu.leer("carta", "principal")).toMatchObject({ contenido: "del celu", version: 2, rechazado: "de la compu" });
  // Confirmar la corrección otra vez la sube sobre la versión actual.
  await compu.guardar("carta", "principal", "de la compu");
  await compu.sincronizar();
  expect(await enServidor()).toEqual([{ contenido: "de la compu", version: 3 }]);
  expect((await compu.leer("carta", "principal"))!.rechazado).toBeUndefined();
  // Quedarse con lo del servidor quita la marca sin subir nada.
  await celu.guardar("carta", "principal", "otra del celu");
  await celu.sincronizar();
  expect((await celu.leer("carta", "principal"))!.rechazado).toBe("otra del celu");
  await celu.guardar("carta", "principal", "de la compu");
  expect([(await celu.leer("carta", "principal"))!.rechazado, await celu.pendientes()]).toEqual([undefined, 0]);
});

test("sync: sin sesión la cola queda intacta, y una cuenta solo local no encola ni sube", async () => {
  const sinSesion = memoria();
  const a = crearSync(sinSesion, apiDe("sesion=" + "0".repeat(64)), "nube");
  await a.guardar("carta", "principal", "v1");
  expect(await a.sincronizar()).toBe("sesion_vencida");
  expect(await sinSesion.todos("cola")).toHaveLength(1);

  const local = memoria();
  const b = crearSync(local, apiDe(await entrar("local@ejemplo.com", "local")), "local");
  await b.guardar("carta", "principal", "v1");
  expect([await b.sincronizar(), await local.todos("cola"), await enServidor()]).toEqual(["al_dia", [], []]);
  expect((await b.leer("carta", "principal"))!.contenido).toBe("v1");
});

test("sync: el cliente HTTP real (documentosApi) habla con el Worker", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  vi.stubGlobal("fetch", (ruta: string, init: RequestInit = {}) =>
    documentos(new Request(`${ORIGEN}${ruta}`, { ...init, headers: { ...(init.headers as object), Origin: ORIGEN, Cookie: cookie } }) as never, env() as never, T0));
  try {
    const sync = crearSync(memoria(), documentosApi, "nube");
    await sync.guardar("carta", "principal", "v1");
    expect(await sync.sincronizar()).toBe("al_dia");
    expect(await enServidor()).toEqual([{ contenido: "v1", version: 1 }]);
    // Otro dispositivo la baja con listar().
    const otro = crearSync(memoria(), documentosApi, "nube");
    await otro.sincronizar();
    expect(await otro.leer("carta", "principal")).toMatchObject({ contenido: "v1", version: 1 });
  } finally {
    vi.unstubAllGlobals();
  }
});

// Diario cifrado (src/cifrado.ts) contra este mismo Worker.
const claveApiDe = (cookie: string): ClaveApi => ({
  leer: async () => (await doc("GET", "/v1/clave", undefined, cookie)).json(),
  guardar: async (cambio) => (await doc("PUT", "/v1/clave", cambio, cookie)).json(),
});
function dispositivo(cookie: string, modo: "nube" | "local" = "nube") {
  const almacen = memoria();
  const sync = crearSync(almacen, apiDe(cookie), modo);
  return { almacen, sync, diario: crearDiario(almacen, sync, claveApiDe(cookie), modo) };
}

test("diario: un dispositivo nuevo lo lee con el código; un código equivocado no abre; el servidor no ve ni el texto ni el código", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  const celu = dispositivo(cookie);
  const codigo = await celu.diario.crear();
  expect(codigo).toMatch(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  await celu.diario.escribir("e1", "hoy esperé antes de responder");
  expect(await celu.diario.sincronizar()).toBe("al_dia");

  const compu = dispositivo(cookie);
  expect([await compu.diario.estado(), await compu.diario.sincronizar(), await compu.diario.estado()]).toEqual(["sin_clave", "al_dia", "cerrado"]);
  expect(await compu.diario.leer("e1")).toBeNull();
  expect(await compu.diario.abrir("0000-0000-0000-0000-0000-0000-0000-0000")).toBe(false);
  expect(await compu.diario.abrir(codigo.toLowerCase().replaceAll("-", " "))).toBe(true);
  expect([await compu.diario.estado(), await compu.diario.leer("e1")]).toEqual(["abierto", "hoy esperé antes de responder"]);

  // El código no queda en el dispositivo ni en el servidor (E4-codigo), y el texto no llega legible al servidor.
  const guardado = JSON.stringify([await celu.almacen.todos("documentos"), await celu.almacen.todos("cola"), await celu.almacen.todos("claves")]);
  const servidor = JSON.stringify([(await db.prepare("SELECT * FROM documentos").all()).results, (await db.prepare("SELECT * FROM claves").all()).results]);
  for (const texto of [guardado, servidor]) expect(texto).not.toContain(codigo.replaceAll("-", "").slice(0, 8));
  expect(guardado + servidor).not.toContain("esperé");
  expect(servidor).toContain('"id_clave"');
});

test("diario: dos dispositivos sin red terminan con una sola clave, y todo abre con un solo código", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  const celu = dispositivo(cookie);
  const compu = dispositivo(cookie);
  const codigoCelu = await celu.diario.crear();
  await compu.diario.crear();
  await celu.diario.escribir("a", "desde el celu");
  await compu.diario.escribir("b", "desde la compu");
  await compu.sync.guardar("carta", "principal", "v1");

  expect(await celu.diario.sincronizar()).toBe("al_dia");
  // La compu perdió: su entrada queda en el dispositivo, y la carta sube igual.
  expect(await compu.diario.sincronizar()).toBe("clave_reemplazada");
  expect([await compu.diario.estado(), await compu.diario.leer("b"), await compu.almacen.todos("cola")]).toEqual(["cerrado", "desde la compu", []]);
  expect((await db.prepare("SELECT tipo, id FROM documentos ORDER BY tipo").all()).results).toEqual([{ tipo: "carta", id: "principal" }, { tipo: "diario", id: "a" }]);

  // Con el código del celu, la compu vuelve a cifrar lo suyo con la clave que ganó y lo sube.
  expect(await compu.diario.abrir(codigoCelu)).toBe(true);
  expect(await compu.diario.sincronizar()).toBe("al_dia");
  await celu.diario.sincronizar();
  expect([await celu.diario.leer("a"), await celu.diario.leer("b"), await compu.diario.leer("a"), await compu.diario.leer("b")]).toEqual(["desde el celu", "desde la compu", "desde el celu", "desde la compu"]);
  expect((await db.prepare("SELECT COUNT(DISTINCT id_clave) AS claves, COUNT(*) AS entradas FROM documentos WHERE tipo = 'diario'").first())).toEqual({ claves: 1, entradas: 2 });
});

test("diario: un código nuevo deja sin efecto el anterior, y dos generados a la vez no se pisan", async () => {
  const cookie = await entrar("ana@ejemplo.com");
  const celu = dispositivo(cookie);
  const viejo = await celu.diario.crear();
  await celu.diario.sincronizar();
  const compu = dispositivo(cookie);
  await compu.diario.sincronizar();
  await compu.diario.abrir(viejo);

  const nuevo = (await celu.diario.nuevoCodigo()) as { codigo: string };
  const { envuelta } = (await db.prepare("SELECT envuelta FROM claves").first<{ envuelta: string }>())!;
  expect([await desenvolver(envuelta, viejo), (await desenvolver(envuelta, nuevo.codigo)) !== null]).toEqual([null, true]);
  // La compu todavía tiene la revisión anterior de la envoltura: su código nuevo no pisa al del celu.
  expect(await compu.diario.nuevoCodigo()).toEqual({ error: "reemplazado" });
  await compu.diario.sincronizar();
  expect(await compu.diario.nuevoCodigo()).toHaveProperty("codigo");
});

test("diario: una cuenta solo local cifra y lee sin registrar nada, y el servidor rechaza su clave y una entrada con clave ajena", async () => {
  const local = dispositivo(await entrar("local@ejemplo.com", "local"), "local");
  await local.diario.crear();
  await local.diario.escribir("e1", "solo acá");
  expect([await local.diario.sincronizar(), await local.diario.leer("e1")]).toEqual(["al_dia", "solo acá"]);
  expect((await doc("PUT", "/v1/clave", { idClave: "k", envuelta: "x", revisionBase: 0 }, await entrar("local@ejemplo.com", "local"))).status).toBe(403);

  const ana = await entrar("ana@ejemplo.com");
  expect(await (await guardar(ana, "v1.otra.iv.datos", 0, "op1", "/v1/documentos/diario/e1", true)).json()).toEqual({ error: "clave_reemplazada" });
  expect((await db.prepare("SELECT COUNT(*) AS n FROM documentos").first<{ n: number }>())!.n + (await db.prepare("SELECT COUNT(*) AS n FROM claves").first<{ n: number }>())!.n).toBe(0);
});

test("diario: una entrada que se intentó subir antes de registrar la clave sube cuando la clave queda registrada", async () => {
  const celu = dispositivo(await entrar("ana@ejemplo.com"));
  await celu.diario.crear();
  await celu.diario.escribir("e1", "antes de la clave");
  expect(await celu.sync.sincronizar()).toBe("clave_reemplazada");
  expect((await celu.sync.leer("diario", "e1"))!.sinSubir).toBe(true);
  expect(await celu.diario.sincronizar()).toBe("al_dia");
  expect([(await db.prepare("SELECT id FROM documentos").all()).results, (await celu.sync.leer("diario", "e1"))!.sinSubir]).toEqual([[{ id: "e1" }], undefined]);
});

test("diario: dos sincronizaciones a la vez registran la misma clave y el diario queda abierto", async () => {
  const d = dispositivo(await entrar("ana@ejemplo.com"));
  await d.diario.crear();
  expect(await Promise.all([d.diario.sincronizar(), d.diario.sincronizar()])).toEqual(["al_dia", "al_dia"]);
  expect(await d.diario.estado()).toBe("abierto");
  expect((await d.diario.nuevoCodigo()) as { codigo?: string }).toHaveProperty("codigo");
});
