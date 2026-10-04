// Documentos de la cuenta (T64): carta, libro y diario, con versión por documento (E3-conflicto, E3-tipos).
// Cada condición va dentro de la misma sentencia que escribe, no en un chequeo previo (Codex #1 de la eng ronda 4).
import { sesionDe, type EnvCuenta } from "./cuenta";

const TIPOS = ["carta", "libro", "diario"];
const MAXIMO = 64 * 1024;
const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });
const fallo = (error: string, status: number, extra: object = {}) => json({ error, ...extra }, status);
const NUBE = "(SELECT modo FROM cuentas WHERE id = ?1) = 'nube'";

interface Fila { tipo: string; id: string; contenido: string; cifrado: number; version: number; id_operacion: string }
const publico = ({ tipo, id, contenido, cifrado, version }: Fila) => ({ tipo, id, contenido, cifrado: cifrado === 1, version });

// Clave del diario (T65): se guarda envuelta con el código de recuperación, que el servidor nunca ve.
interface Clave { idClave: string; envuelta: string; revision: number }
// Borra las entradas cifradas con claves reemplazadas (E4-limpieza): un paso aparte del reemplazo, que se puede repetir sin daño.
const limpiar = (env: EnvCuenta, cuenta: string) =>
  env.DB.batch([
    env.DB.prepare("DELETE FROM documentos WHERE cuenta_id = ?1 AND tipo = 'diario' AND id_clave IN (SELECT id_clave FROM borrados_pendientes WHERE cuenta_id = ?1)").bind(cuenta),
    env.DB.prepare("DELETE FROM borrados_pendientes WHERE cuenta_id = ?1").bind(cuenta),
  ]);

async function clave(request: Request, env: EnvCuenta, sesion: { id: string; modo: string }, ahora: number, diferir?: Diferir): Promise<Response> {
  const vigente = () => env.DB.prepare("SELECT id_clave AS idClave, envuelta, revision FROM claves WHERE cuenta_id = ?").bind(sesion.id).first<Clave>();
  if (request.method === "GET") return json({ clave: await vigente() });
  if (request.method !== "PUT") return fallo("no_encontrado", 404);
  if (sesion.modo !== "nube") return fallo("escritura_no_permitida", 403);
  const { idClave, envuelta, revisionBase, reemplaza } = (await request.json().catch(() => ({}))) as { idClave?: unknown; envuelta?: unknown; revisionBase?: unknown; reemplaza?: unknown };
  if (typeof idClave !== "string" || !idClave || idClave.length > 64 || idClave.includes(".")) return fallo("pedido_invalido", 400);
  if (typeof envuelta !== "string" || !envuelta || envuelta.length > 256) return fallo("pedido_invalido", 400);
  if (!Number.isInteger(revisionBase) || (revisionBase as number) < 0) return fallo("pedido_invalido", 400);
  // "Empezar un diario nuevo" (DR32): cambia la clave vigente por otra, solo si la vigente sigue siendo la que el dispositivo vio,
  // y en la misma transacción anota la vieja para borrar sus entradas (E4-limpieza). Desde ahí, lo cifrado con la vieja se rechaza.
  if (reemplaza !== undefined) {
    if (typeof reemplaza !== "string" || !reemplaza || reemplaza === idClave) return fallo("pedido_invalido", 400);
    const SIGUE = `EXISTS (SELECT 1 FROM claves WHERE cuenta_id = ?1 AND id_clave = ?2) AND ${NUBE}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO borrados_pendientes (cuenta_id, id_clave) SELECT ?1, ?2 WHERE ${SIGUE}`).bind(sesion.id, reemplaza),
      env.DB.prepare(`UPDATE claves SET id_clave = ?3, envuelta = ?4, revision = revision + 1 WHERE cuenta_id = ?1 AND id_clave = ?2 AND ${NUBE}`).bind(sesion.id, reemplaza, idClave, envuelta),
    ]);
    const actual = await vigente();
    if (actual?.idClave !== idClave || actual.envuelta !== envuelta) return fallo("conflicto", 409, { actual: actual ?? null });
    // El borrado no demora la respuesta; si no termina, lo completa el próximo pedido de la cuenta.
    const tarea = limpiar(env, sesion.id).catch(() => undefined);
    if (diferir) diferir(tarea);
    else await tarea;
    return json({ clave: actual });
  }
  // Base 0: registrar la clave, y gana la primera (E3-dosclaves). Base mayor: envolverla con un código nuevo,
  // solo si la clave y la revisión siguen siendo las que el dispositivo leyó (Codex #2 de la eng ronda 4).
  await (revisionBase === 0
    ? env.DB.prepare(`INSERT INTO claves (cuenta_id, id_clave, envuelta, revision, creada) SELECT ?1, ?2, ?3, 1, ?4 WHERE ${NUBE} ON CONFLICT DO NOTHING`).bind(sesion.id, idClave, envuelta, ahora)
    : env.DB.prepare(`UPDATE claves SET envuelta = ?3, revision = revision + 1 WHERE cuenta_id = ?1 AND id_clave = ?2 AND revision = ?4 AND ${NUBE}`).bind(sesion.id, idClave, envuelta, revisionBase)
  ).run();
  const actual = await vigente();
  // Quedó lo pedido, ahora o en un intento anterior cuya respuesta se perdió.
  if (actual?.idClave === idClave && actual.envuelta === envuelta) return json({ clave: actual });
  if (actual) return fallo("conflicto", 409, { actual });
  const modo = await env.DB.prepare("SELECT modo FROM cuentas WHERE id = ?").bind(sesion.id).first<{ modo: string }>();
  return modo?.modo === "nube" ? fallo("conflicto", 409, { actual: null }) : fallo("escritura_no_permitida", 403);
}

type Diferir = (tarea: Promise<unknown>) => void;
// `diferir` es el `waitUntil` del Worker: deja terminar una tarea después de responder.
export async function documentos(request: Request, env: EnvCuenta, ahora = Date.now(), diferir?: Diferir): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return fallo("origen_no_permitido", 403);
  const sesion = await sesionDe(request, env, ahora);
  if (!sesion) return fallo("sesion_vencida", 401);
  // Un borrado que quedó pendiente se completa antes de responder: el servidor nunca devuelve entradas de una clave reemplazada.
  await limpiar(env, sesion.id);
  if (url.pathname === "/v1/clave") return clave(request, env, sesion, ahora, diferir);

  const [, , , tipo, id] = url.pathname.split("/");
  if (request.method === "GET" && !tipo) {
    const filtro = url.searchParams.get("tipo");
    const filas = await env.DB.prepare("SELECT tipo, id, contenido, cifrado, version, id_operacion FROM documentos WHERE cuenta_id = ?1 AND (?2 IS NULL OR tipo = ?2) AND (id_clave IS NULL OR id_clave NOT IN (SELECT id_clave FROM borrados_pendientes WHERE cuenta_id = ?1)) ORDER BY tipo, id")
      .bind(sesion.id, filtro).all<Fila>();
    return json({ documentos: filas.results.map(publico) });
  }
  if (!tipo || !id || !TIPOS.includes(tipo) || id.length > 64) return fallo("no_encontrado", 404);
  const actual = () => env.DB.prepare("SELECT tipo, id, contenido, cifrado, version, id_operacion FROM documentos WHERE cuenta_id = ? AND tipo = ? AND id = ?").bind(sesion.id, tipo, id).first<Fila>();
  // Una cuenta "solo en este dispositivo" no tiene contenido en el servidor (invariante 2).
  if (sesion.modo !== "nube") return fallo("escritura_no_permitida", 403);

  const cuerpo = (await request.json().catch(() => ({}))) as { contenido?: unknown; cifrado?: unknown; versionBase?: unknown; idOperacion?: unknown };
  const versionBase = Number.isInteger(cuerpo.versionBase) ? (cuerpo.versionBase as number) : -1;
  const idOperacion = typeof cuerpo.idOperacion === "string" && cuerpo.idOperacion.length <= 64 ? cuerpo.idOperacion : "";
  if (versionBase < 0 || !idOperacion) return fallo("pedido_invalido", 400);

  if (request.method === "DELETE") {
    const r = await env.DB.prepare(`DELETE FROM documentos WHERE cuenta_id = ?1 AND tipo = ?2 AND id = ?3 AND version = ?4 AND ${NUBE}`).bind(sesion.id, tipo, id, versionBase).run();
    if (r.meta.changes === 1) return json({ ok: true });
    const fila = await actual();
    return fila ? fallo("conflicto", 409, { actual: publico(fila) }) : json({ ok: true });
  }
  if (request.method !== "PUT") return fallo("no_encontrado", 404);

  const { contenido } = cuerpo;
  const cifrado = cuerpo.cifrado === true ? 1 : 0;
  if (typeof contenido !== "string") return fallo("pedido_invalido", 400);
  if (contenido.length > MAXIMO) return fallo("carga_demasiado_grande", 413);
  if (tipo === "diario" && !cifrado) return fallo("pedido_invalido", 400);
  // Una entrada del diario dice con qué clave se cifró ("v1.<id de clave>.<iv>.<datos>") y solo entra si es la vigente;
  // la condición va en la misma sentencia que escribe (Codex #1 de la eng ronda 4).
  const idClave = tipo === "diario" ? (contenido.split(".")[1] ?? "") : null;
  const VIGENTE = "(?8 IS NULL OR ?8 = (SELECT id_clave FROM claves WHERE cuenta_id = ?1))";

  const r =
    versionBase === 0
      ? await env.DB.prepare(
          `INSERT INTO documentos (cuenta_id, tipo, id, contenido, cifrado, version, id_operacion, actualizado, id_clave)
           SELECT ?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8 WHERE ${NUBE} AND ${VIGENTE} ON CONFLICT DO NOTHING`,
        ).bind(sesion.id, tipo, id, contenido, cifrado, idOperacion, ahora, idClave).run()
      : await env.DB.prepare(
          `UPDATE documentos SET contenido = ?4, cifrado = ?5, version = version + 1, id_operacion = ?6, actualizado = ?7, id_clave = ?8
           WHERE cuenta_id = ?1 AND tipo = ?2 AND id = ?3 AND version = ?9 AND ${NUBE} AND ${VIGENTE}`,
        ).bind(sesion.id, tipo, id, contenido, cifrado, idOperacion, ahora, idClave, versionBase).run();
  const fila = await actual();
  if (r.meta.changes === 1 && fila) return json({ documento: publico(fila) });
  // La misma operación repetida (respuesta perdida) devuelve lo mismo, sin escribir dos veces.
  if (fila?.id_operacion === idOperacion) return json({ documento: publico(fila) });
  if (idClave !== null) {
    const vigente = await env.DB.prepare("SELECT id_clave FROM claves WHERE cuenta_id = ?").bind(sesion.id).first<{ id_clave: string }>();
    if (vigente?.id_clave !== idClave) return fallo("clave_reemplazada", 409);
  }
  if (fila) return fallo("conflicto", 409, { actual: publico(fila) });
  // No hay fila y no se escribió: la cuenta dejó de estar en la nube entre el chequeo y la escritura, o la versión base no existe.
  const modo = await env.DB.prepare("SELECT modo FROM cuentas WHERE id = ?").bind(sesion.id).first<{ modo: string }>();
  return modo?.modo === "nube" ? fallo("conflicto", 409, { actual: null }) : fallo("escritura_no_permitida", 403);
}
