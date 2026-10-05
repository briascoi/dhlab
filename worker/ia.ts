// IA incluida (T54, T66): solo dos acciones, capítulo y mensaje. El pedido a OpenRouter se arma acá, con las fichas del catálogo
// y los atributos de la carta validados contra sus valores posibles: la app nunca manda un prompt (E3-guardas).
// Nada de lo que pasa por acá se guarda: ni lo que escribe la persona ni lo que responde el modelo (CEO2-S3b).
import { sesionDe, type EnvCuenta } from "./cuenta";
import { esSensible, preguntaSiEsCiencia, type FichaIA } from "../src/guardas";
import { cuerpoOpenRouter, escribirCapitulo, leerOpenRouter, MODELO, responder, type Llamar } from "../src/redactor";
import { atributosValidos, piezas, type Atributos } from "../src/piezas";

export interface Catalogo { fichas: Record<string, { texto: string; version: number }> }
export interface EnvIA extends EnvCuenta {
  OPENROUTER_API_KEY?: string;
  // Valores a calibrar con la prueba de costo (T54): modelo, y topes y reservas en millonésimas de dólar.
  IA_MODELO?: string;
  // El verificador puede usar otro modelo que el redactor; sin este valor, usa el mismo.
  IA_VERIFICADOR?: string;
  IA_TOPE_CUENTA?: string;
  IA_TOPE_GLOBAL?: string;
  // "1" pone la IA incluida en pausa para todos, sin tocar la clave: se usa mientras los evals no aprueban (test/evals.test.ts).
  IA_PAUSA?: string;
  catalogo: () => Promise<Catalogo>;
}
const TOPE_CUENTA = 500_000;
const TOPE_GLOBAL = 10_000_000;
// Lo que se aparta antes de llamar: un capítulo son dos llamadas (redactar y verificar).
// La del capítulo cubre el peor caso: tres intentos del redactor y tres del verificador con su tope de respuesta más alto.
const RESERVA = { capitulo: 90_000, mensaje: 15_000 };
const CAPITULOS = 5;

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });
const fallo = (error: string, status: number, extra: object = {}) => json({ error, ...extra }, status);
const mesDe = (ahora: number) => new Date(ahora).toISOString().slice(0, 7);
// El tope se renueva cada mes calendario (nota delegada de T54).
const renovacion = (ahora: number) => new Date(Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

// La llamada del camino incluido: con la clave de Isma, que es un secreto del Worker.
const llamarCon = (env: EnvIA, modelo = env.IA_MODELO || MODELO): Llamar => async (sistema, usuario, tope) => {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "DH Lab" },
    body: JSON.stringify(cuerpoOpenRouter(modelo, sistema, usuario, tope)),
  }).catch(() => null);
  return r?.ok ? leerOpenRouter(await r.json().catch(() => null)) : null;
};

export async function ia(request: Request, env: EnvIA, ahora = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return fallo("origen_no_permitido", 403);
  const sesion = await sesionDe(request, env, ahora);
  if (!sesion) return fallo("sesion_vencida", 401);
  const mes = mesDe(ahora);
  const topeCuenta = Number(env.IA_TOPE_CUENTA) || TOPE_CUENTA;
  const topeGlobal = Number(env.IA_TOPE_GLOBAL) || TOPE_GLOBAL;
  const gastado = async (clave: string) => (await env.DB.prepare("SELECT micros FROM gasto_ia WHERE clave = ? AND mes = ?").bind(clave, mes).first<{ micros: number }>())?.micros ?? 0;
  const enPausa = env.IA_PAUSA === "1";
  const catalogo = await env.catalogo();
  const configurada = Boolean(env.OPENROUTER_API_KEY) && Object.keys(catalogo.fichas).length > 0;

  if (request.method === "GET") {
    const [usado, global] = await Promise.all([gastado(sesion.id), gastado("global")]);
    return json({ configurada, usado, tope: topeCuenta, pausa: enPausa || global >= topeGlobal, renovacion: renovacion(ahora), reserva: RESERVA });
  }
  if (request.method !== "POST") return fallo("no_encontrado", 404);
  if (!configurada) return fallo("no_configurada", 503);
  // En pausa a mano: la app lo muestra igual que cuando se alcanza el tope global.
  if (enPausa) return fallo("tope_global", 429, { renovacion: renovacion(ahora) });

  // Solo dos acciones, cada una con sus campos; cualquier otra cosa se rechaza.
  const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const atributos = atributosValidos(cuerpo.atributos);
  const esCapitulo = cuerpo.accion === "capitulo" && Number.isInteger(cuerpo.n) && (cuerpo.n as number) >= 1 && (cuerpo.n as number) <= CAPITULOS;
  const esMensaje = cuerpo.accion === "mensaje" && typeof cuerpo.texto === "string" && cuerpo.texto.trim().length > 0 && cuerpo.texto.length <= 1000;
  const permitidos = esCapitulo ? ["accion", "n", "atributos"] : ["accion", "texto", "historial", "atributos"];
  if (!atributos || (!esCapitulo && !esMensaje) || Object.keys(cuerpo).some((k) => !permitidos.includes(k))) return fallo("pedido_invalido", 400);
  const historial = Array.isArray(cuerpo.historial) ? cuerpo.historial : [];
  if (historial.length > 6 || historial.some((h) => !h || !["persona", "coach"].includes((h as { rol?: unknown }).rol as string) || typeof (h as { texto?: unknown }).texto !== "string" || (h as { texto: string }).texto.length > 1000)) return fallo("pedido_invalido", 400);

  // Temas sensibles y "¿es ciencia?": respuesta fija, sin llamar al modelo ni gastar tope.
  if (esMensaje) {
    const dicho = [cuerpo.texto as string, ...historial.filter((h) => (h as { rol: string }).rol === "persona").map((h) => (h as { texto: string }).texto)].join(" ");
    if (esSensible(dicho)) return json({ fija: "sensible" });
    if (preguntaSiEsCiencia(cuerpo.texto as string)) return json({ fija: "ciencia" });
  }

  const ids = esCapitulo ? piezas(cuerpo.n as number, atributos)[0] : fichasDeLaCarta(atributos);
  const fichas: FichaIA[] = ids.flatMap((id) => (catalogo.fichas[id] ? [{ id, texto: catalogo.fichas[id]!.texto }] : []));
  if (!fichas.length) return esCapitulo ? fallo("sin_fichas", 409) : json({ fija: "sin_biblioteca" });

  // Reserva atómica: los dos topes (cuenta y global) se comprueban y se apartan en una sola sentencia (CEO2-O6).
  const reserva = RESERVA[esCapitulo ? "capitulo" : "mensaje"];
  const r = await env.DB.prepare(
    `INSERT INTO gasto_ia (clave, mes, micros)
     SELECT clave, ?2, ?3 FROM (SELECT ?1 AS clave UNION ALL SELECT 'global')
     WHERE COALESCE((SELECT micros FROM gasto_ia WHERE clave = ?1 AND mes = ?2), 0) + ?3 <= ?4
       AND COALESCE((SELECT micros FROM gasto_ia WHERE clave = 'global' AND mes = ?2), 0) + ?3 <= ?5
     ON CONFLICT (clave, mes) DO UPDATE SET micros = micros + excluded.micros`,
  ).bind(sesion.id, mes, reserva, topeCuenta, topeGlobal).run();
  if (r.meta.changes !== 2) return fallo((await gastado("global")) + reserva > topeGlobal ? "tope_global" : "tope_cuenta", 429, { renovacion: renovacion(ahora) });
  // Al terminar, lo apartado se cambia por lo que costó de verdad. Si el pedido se corta antes, la reserva queda como gastada.
  // gstack-shortcut(dec-46ef0036): un capítulo pagado se pierde por corte, upgrade when capitulo_cortado supere el umbral acordado con datos del círculo (pasar a Cloudflare Workflows)
  const asentar = (micros: number) => env.DB.prepare("UPDATE gasto_ia SET micros = MAX(0, micros - ?1 + ?2) WHERE mes = ?3 AND clave IN (?4, 'global')").bind(reserva, micros, mes, sesion.id).run();

  const llamar = llamarCon(env);
  if (esMensaje) {
    const respuesta = await responder(llamar, cuerpo.texto as string, historial, fichas);
    await asentar(respuesta.micros);
    return respuesta.error ? fallo(respuesta.error, 502) : json(respuesta.parrafos ? { parrafos: respuesta.parrafos } : { fija: "sin_biblioteca" });
  }
  const verificador = env.IA_VERIFICADOR || env.IA_MODELO || MODELO;
  const escrito = await escribirCapitulo(llamar, cuerpo.n as number, fichas, llamarCon(env, verificador));
  await asentar(escrito.micros);
  if (escrito.error) return fallo(escrito.error, escrito.error === "no_publicable" ? 422 : 502);
  const modelo = env.IA_MODELO || MODELO;
  return json({ parrafos: escrito.parrafos, modelo, verificador, fichas: fichas.map(({ id }) => ({ id, version: catalogo.fichas[id]!.version })) });
}

// Para el coach: todas las fichas que le tocan a esta carta en los cinco capítulos.
const fichasDeLaCarta = (a: Atributos) => [...new Set([1, 2, 3, 4, 5].flatMap((n) => piezas(n, a)[0]))];
