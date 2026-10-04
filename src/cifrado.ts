// Cifrado del diario en el dispositivo (T65): clave AES-GCM por cuenta, código de recuperación de 128 bits y ciclo de vida de la clave.
// El servidor guarda la clave envuelta con el código y no puede abrirla; el código no se guarda en ningún lado (E4-codigo).
// Sin DOM ni IndexedDB: el almacén llega de afuera.
import type { ClaveApi, ClaveGuardada, Modo } from "./cuenta-api";
import type { Almacen, crearSync } from "./sync";

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const USOS: ("encrypt" | "decrypt")[] = ["encrypt", "decrypt"];

// 128 bits al azar, en 8 grupos de 4 caracteres hexadecimales.
export function generarCodigo(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex.match(/.{4}/g)!.join("-");
}

// El código es la clave que envuelve (AES-KW): es azar completo, no hace falta derivarla. Se acepta con o sin guiones y en minúsculas.
async function claveDeCodigo(codigo: string): Promise<CryptoKey | null> {
  const hex = codigo.replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 32) return null;
  return crypto.subtle.importKey("raw", Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)), "AES-KW", false, ["wrapKey", "unwrapKey"]);
}

export async function envolver(clave: CryptoKey, codigo: string): Promise<string> {
  return b64(await crypto.subtle.wrapKey("raw", clave, (await claveDeCodigo(codigo))!, "AES-KW"));
}

// Con un código equivocado devuelve null: AES-KW comprueba la integridad.
export async function desenvolver(envuelta: string, codigo: string): Promise<CryptoKey | null> {
  const kek = await claveDeCodigo(codigo);
  if (!kek) return null;
  // Extraíble, para poder envolverla otra vez con un código nuevo.
  return crypto.subtle.unwrapKey("raw", deB64(envuelta), kek, "AES-KW", "AES-GCM", true, USOS).catch(() => null);
}

export interface Clave { idClave: string; clave: CryptoKey }
// Dato autenticado: una entrada cifrada no se puede mover a otra entrada ni presentar con otra clave.
const atado = (idClave: string, idEntrada: string) => new TextEncoder().encode(`${idClave}/diario/${idEntrada}`);

// Formato: "v1.<id de clave>.<iv>.<datos>". El iv es nuevo en cada cifrado.
export async function cifrar({ idClave, clave }: Clave, idEntrada: string, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: atado(idClave, idEntrada) }, clave, new TextEncoder().encode(texto));
  return `v1.${idClave}.${b64(iv)}.${b64(datos)}`;
}

export const idClaveDe = (contenido: string) => contenido.split(".")[1] ?? "";

export async function descifrar(claves: Clave[], idEntrada: string, contenido: string): Promise<string | null> {
  const [version, idClave, iv, datos] = contenido.split(".");
  const clave = claves.find((c) => c.idClave === idClave)?.clave;
  if (version !== "v1" || !clave || !iv || !datos) return null;
  return crypto.subtle
    .decrypt({ name: "AES-GCM", iv: deB64(iv), additionalData: atado(idClave!, idEntrada) }, clave, deB64(datos))
    .then((b) => new TextDecoder().decode(b), () => null);
}

// Lo que este dispositivo sabe de la clave del diario.
// propia: la clave que tiene (revision 0: todavía no registrada en el servidor).
// vigente: la que rige en el servidor cuando no es la propia; el diario está cerrado hasta escribir su código (DR32).
// anteriores: claves que tuvo, para volver a cifrar con la vigente lo que escribió con ellas.
interface Registro { id: "diario"; propia?: Clave & { envuelta: string; revision: number }; vigente?: ClaveGuardada; anteriores: Clave[] }

export function crearDiario(almacen: Almacen, sync: ReturnType<typeof crearSync>, api: ClaveApi, modo: Modo) {
  const registro = async (): Promise<Registro> => (await almacen.todos<Registro>("claves"))[0] ?? { id: "diario", anteriores: [] };
  const guardar = (r: Registro) => almacen.aplicar([["claves", r]]);

  // Copias ya sincronizadas del diario anterior que este dispositivo todavía puede abrir, cuando la cuenta ya tiene otra clave (E4-diarioviejo).
  async function delAnterior(r: Registro) {
    if (!r.vigente) return [];
    const mias = new Set([...(r.propia ? [r.propia] : []), ...r.anteriores].map((c) => c.idClave));
    return (await sync.listar("diario")).filter((d) => d.version > 0 && !d.sinSubir && idClaveDe(d.contenido) !== r.vigente!.idClave && mias.has(idClaveDe(d.contenido)));
  }

  // anterior: cerrado, y además este dispositivo guarda el diario que se reemplazó; no se vuelve a subir sin que la persona lo pida.
  const estado = async (): Promise<"sin_clave" | "abierto" | "cerrado" | "anterior"> => {
    const r = await registro();
    return r.vigente ? ((await delAnterior(r)).length ? "anterior" : "cerrado") : r.propia ? "abierto" : "sin_clave";
  };

  // "Descartarlo": borra solo las copias de este dispositivo. Lo que tenía sin subir se conserva (E4-reemplazo).
  const descartarAnterior = async () => sync.olvidar("diario", (await delAnterior(await registro())).map((d) => d.id));

  // "Empezar un diario nuevo" (DR32), para quien perdió el código: una clave nueva reemplaza a la vigente y el servidor borra las entradas anteriores.
  // Lo que este dispositivo puede abrir se vuelve a cifrar con la clave nueva; lo que no, se quita de acá también.
  async function empezarNuevo(): Promise<{ codigo: string } | { error: string }> {
    const r = await registro();
    if (!r.vigente) return { error: "diario_abierto" };
    const codigo = generarCodigo();
    const clave = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, USOS)) as CryptoKey;
    const idClave = crypto.randomUUID();
    const pedido = await api.guardar({ idClave, envuelta: await envolver(clave, codigo), revisionBase: r.vigente.revision, reemplaza: r.vigente.idClave });
    if (!("clave" in pedido)) return { error: pedido.error };
    const propia = { idClave, clave, envuelta: pedido.clave.envuelta, revision: pedido.clave.revision };
    const anteriores = [...r.anteriores, ...(r.propia ? [{ idClave: r.propia.idClave, clave: r.propia.clave }] : [])];
    await guardar({ id: "diario", propia, anteriores });
    // Lo que ya estaba en la cuenta se borra, como dice la confirmación; solo sigue lo que este dispositivo nunca había subido (E4-reemplazo).
    await sync.olvidar("diario", (await sync.listar("diario")).filter((d) => d.version > 0 && !d.sinSubir).map((d) => d.id));
    await resubir(propia, anteriores);
    await sync.olvidar("diario", (await sync.listar("diario")).filter((d) => idClaveDe(d.contenido) !== idClave).map((d) => d.id));
    return { codigo };
  }

  // Con la primera entrada: crea la clave y devuelve el código para mostrarlo. La clave queda en el dispositivo antes de cualquier pedido de red.
  // Con red, la pantalla del código (DR34) se muestra recién cuando `sincronizar()` deja el estado en "abierto":
  // si otro dispositivo registró su clave primero, este código no sirve y rige el del otro.
  async function crear(): Promise<string> {
    // Solo sin clave: crear otra dejaría sin abrir lo ya escrito.
    if ((await estado()) !== "sin_clave") throw new Error("el diario ya tiene clave en este dispositivo");
    const codigo = generarCodigo();
    const clave = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, USOS)) as CryptoKey;
    await guardar({ ...(await registro()), propia: { idClave: crypto.randomUUID(), clave, envuelta: await envolver(clave, codigo), revision: 0 } });
    return codigo;
  }

  async function escribir(idEntrada: string, texto: string): Promise<void> {
    const { propia } = await registro();
    if (!propia) throw new Error("el diario no tiene clave en este dispositivo");
    await sync.guardar("diario", idEntrada, await cifrar(propia, idEntrada, texto), true);
  }

  async function leer(idEntrada: string): Promise<string | null> {
    const [r, doc] = await Promise.all([registro(), sync.leer("diario", idEntrada)]);
    return doc ? descifrar([...(r.propia ? [r.propia] : []), ...r.anteriores], idEntrada, doc.contenido) : null;
  }

  // Vuelve a encolar lo que el servidor no aceptó: lo escrito con otra clave se cifra otra vez con la propia,
  // y lo que se intentó subir antes de registrar la clave sube tal cual.
  async function resubir(propia: Clave, anteriores: Clave[]): Promise<void> {
    for (const doc of await sync.listar("diario")) {
      if (idClaveDe(doc.contenido) === propia.idClave) {
        if (doc.sinSubir) await sync.guardar("diario", doc.id, doc.contenido, true);
        continue;
      }
      const texto = await descifrar(anteriores, doc.id, doc.contenido);
      // Lo cifrado con una clave que ya no rige no está en el servidor: entra como entrada nueva.
      if (texto !== null) await sync.guardar("diario", doc.id, await cifrar(propia, doc.id, texto), true, true);
    }
  }

  // Antes de subir entradas, la clave tiene que estar registrada: el servidor solo acepta entradas cifradas con la vigente.
  async function sincronizar(): Promise<string> {
    if (modo === "nube") {
      const r = await registro();
      const pedido = r.propia?.revision === 0 ? await api.guardar({ idClave: r.propia.idClave, envuelta: r.propia.envuelta, revisionBase: 0 }) : await api.leer();
      // Otro dispositivo registró su clave primero: el servidor devuelve la vigente con el conflicto (E3-dosclaves).
      const servidor = "clave" in pedido ? pedido.clave : pedido.error === "conflicto" ? (pedido as { actual?: ClaveGuardada | null }).actual || undefined : undefined;
      if (servidor === undefined) return (pedido as { error: string }).error;
      // La vigente es la propia, también si el registro llegó por otro pedido a la vez (dos pestañas, dos sincronizaciones juntas).
      if (servidor && servidor.idClave === r.propia?.idClave) {
        await guardar({ ...r, propia: { ...r.propia, envuelta: servidor.envuelta, revision: servidor.revision }, vigente: undefined });
        await resubir(r.propia, r.anteriores);
      }
      // Hay un diario en la cuenta y este dispositivo no tiene su clave (dispositivo nuevo, o un diario nuevo empezado en otro).
      else if (servidor) await guardar({ ...r, vigente: servidor });
    }
    return sync.sincronizar();
  }

  // Abre el diario con el código de recuperación de la clave vigente. Lo escrito con otra clave se vuelve a cifrar y queda en la cola para subir.
  async function abrir(codigo: string): Promise<boolean> {
    const r = await registro();
    if (!r.vigente) return false;
    const clave = await desenvolver(r.vigente.envuelta, codigo);
    if (!clave) return false;
    const propia = { idClave: r.vigente.idClave, clave, envuelta: r.vigente.envuelta, revision: r.vigente.revision };
    const anteriores = [...r.anteriores, ...(r.propia ? [{ idClave: r.propia.idClave, clave: r.propia.clave }] : [])];
    await guardar({ id: "diario", propia, anteriores });
    await resubir(propia, anteriores);
    return true;
  }

  // "Generar código nuevo": envuelve la misma clave con otro código; el anterior deja de servir.
  // Si la envoltura cambió desde otro dispositivo, no la pisa (Codex #2 de la eng ronda 4).
  async function nuevoCodigo(): Promise<{ codigo: string } | { error: string }> {
    const r = await registro();
    if (!r.propia || r.propia.revision === 0 || r.vigente) return { error: "diario_cerrado" };
    const codigo = generarCodigo();
    const envuelta = await envolver(r.propia.clave, codigo);
    const pedido = await api.guardar({ idClave: r.propia.idClave, envuelta, revisionBase: r.propia.revision });
    if (!("clave" in pedido)) return { error: pedido.error === "conflicto" ? "reemplazado" : pedido.error };
    await guardar({ ...r, propia: { ...r.propia, envuelta, revision: pedido.clave.revision } });
    return { codigo };
  }

  // Al pasar de solo local a la nube: la clave de un diario local nunca se registró y su código no se mostró.
  // Antes de registrarla se envuelve con un código nuevo, que es el que la persona va a guardar (DR39, DR34). Sin diario, no hay código.
  async function prepararNube(): Promise<string | null> {
    const r = await registro();
    if (!r.propia || r.propia.revision !== 0 || r.vigente) return null;
    const codigo = generarCodigo();
    await guardar({ ...r, propia: { ...r.propia, envuelta: await envolver(r.propia.clave, codigo) } });
    return codigo;
  }

  return { estado, crear, escribir, leer, sincronizar, abrir, nuevoCodigo, empezarNuevo, descartarAnterior, prepararNube };
}
