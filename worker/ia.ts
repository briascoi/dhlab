// IA incluida (T54, T66): solo dos acciones, capítulo y mensaje. El pedido a OpenRouter se arma acá, con las fichas del catálogo
// y los atributos de la carta validados contra sus valores posibles: la app nunca manda un prompt (E3-guardas).
// Nada de lo que pasa por acá se guarda: ni lo que escribe la persona ni lo que responde el modelo (CEO2-S3b).
import { sesionDe, type EnvCuenta } from "./cuenta";
import { esSensible, filtrar, leerSalida, preguntaSiEsCiencia, type FichaIA, type Parrafo } from "../src/guardas";
import { atributosValidos, piezas, type Atributos } from "../src/piezas";

export interface Catalogo { fichas: Record<string, { texto: string; version: number }> }
export interface EnvIA extends EnvCuenta {
  OPENROUTER_API_KEY?: string;
  // Valores a calibrar con la prueba de costo (T54): modelo, y topes y reservas en millonésimas de dólar.
  IA_MODELO?: string;
  IA_TOPE_CUENTA?: string;
  IA_TOPE_GLOBAL?: string;
  catalogo: () => Promise<Catalogo>;
}
const MODELO = "anthropic/claude-haiku-4.5";
const TOPE_CUENTA = 500_000;
const TOPE_GLOBAL = 10_000_000;
// Lo que se aparta antes de llamar: un capítulo son dos llamadas (redactar y verificar).
const RESERVA = { capitulo: 60_000, mensaje: 15_000 };
const CAPITULOS = 5;

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });
const fallo = (error: string, status: number, extra: object = {}) => json({ error, ...extra }, status);
const mesDe = (ahora: number) => new Date(ahora).toISOString().slice(0, 7);
// El tope se renueva cada mes calendario (nota delegada de T54).
const renovacion = (ahora: number) => new Date(Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

const REGLAS = `Eres el redactor de DH Lab, un laboratorio de Diseño Humano. Escribes en español neutro, de tú, con frases cortas.
Respondes SOLO con un JSON de esta forma: {"parrafos":[{"tipo":"narrativo","texto":"..."},{"tipo":"interpretativo","texto":"...","fuentes":["id.de.ficha"]}]}
Reglas, sin excepción:
- "interpretativo": todo lo que diga algo sobre el Diseño de la persona. Lleva en "fuentes" los ids de las fichas que lo respaldan. Solo puedes afirmar lo que esas fichas dicen; no agregas nada de tu conocimiento.
- "narrativo": transiciones y preguntas, dos oraciones como máximo, sin afirmar nada sobre el Diseño de la persona y sin números.
- Ningún número que no esté en la ficha citada.
- Prohibido: predicciones, salud, medicina, terapia, consejos de pareja, y llamar ciencia al sistema o decir que está comprobado.
- Si las fichas no alcanzan para responder, devuelve un solo párrafo narrativo que lo diga.`;

async function llamar(env: EnvIA, sistema: string, usuario: string): Promise<{ texto: string; micros: number } | null> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "DH Lab" },
    body: JSON.stringify({
      model: env.IA_MODELO || MODELO,
      messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      usage: { include: true },
      // Solo proveedores sin retención ni entrenamiento (nota delegada de T51).
      provider: { zdr: true, data_collection: "deny" },
    }),
  }).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } } | null;
  const texto = d?.choices?.[0]?.message?.content;
  return typeof texto === "string" ? { texto, micros: Math.ceil((d?.usage?.cost ?? 0) * 1_000_000) } : null;
}

// Segunda llamada (solo en capítulos): qué párrafos interpretativos están respaldados por las fichas que citan.
async function verificar(env: EnvIA, parrafos: Parrafo[], fichas: FichaIA[]): Promise<{ respaldados: Set<number>; micros: number } | null> {
  const r = await llamar(
    env,
    'Eres un verificador. Recibes fichas y párrafos numerados. Para cada párrafo decides si TODO lo que afirma está dicho en las fichas que cita. Respondes SOLO con JSON: {"respaldados":[números de los párrafos respaldados]}',
    JSON.stringify({ fichas, parrafos: parrafos.map((p, i) => ({ numero: i, texto: p.texto, fuentes: p.fuentes })) }),
  );
  if (!r) return null;
  try {
    const { respaldados } = JSON.parse(r.texto.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as { respaldados?: unknown };
    if (!Array.isArray(respaldados)) return null;
    return { respaldados: new Set(respaldados.filter((n): n is number => Number.isInteger(n))), micros: r.micros };
  } catch {
    return null;
  }
}

export async function ia(request: Request, env: EnvIA, ahora = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return fallo("origen_no_permitido", 403);
  const sesion = await sesionDe(request, env, ahora);
  if (!sesion) return fallo("sesion_vencida", 401);
  const mes = mesDe(ahora);
  const topeCuenta = Number(env.IA_TOPE_CUENTA) || TOPE_CUENTA;
  const topeGlobal = Number(env.IA_TOPE_GLOBAL) || TOPE_GLOBAL;
  const gastado = async (clave: string) => (await env.DB.prepare("SELECT micros FROM gasto_ia WHERE clave = ? AND mes = ?").bind(clave, mes).first<{ micros: number }>())?.micros ?? 0;
  const catalogo = await env.catalogo();
  const configurada = Boolean(env.OPENROUTER_API_KEY) && Object.keys(catalogo.fichas).length > 0;

  if (request.method === "GET") {
    const [usado, global] = await Promise.all([gastado(sesion.id), gastado("global")]);
    return json({ configurada, usado, tope: topeCuenta, pausa: global >= topeGlobal, renovacion: renovacion(ahora), reserva: RESERVA });
  }
  if (request.method !== "POST") return fallo("no_encontrado", 404);
  if (!configurada) return fallo("no_configurada", 503);

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

  const contexto = JSON.stringify({ fichas });
  const pedido = esCapitulo
    ? `${contexto}\nEscribe la sección del capítulo ${cuerpo.n} del libro de esta persona, de hasta 250 palabras, usando solo estas fichas.`
    : `${contexto}\nConversación hasta ahora: ${JSON.stringify(historial)}\nLa persona pregunta: ${JSON.stringify(cuerpo.texto)}\nResponde en hasta 120 palabras, usando solo estas fichas.`;
  let micros = 0;
  // La salida se valida contra el esquema, con hasta 2 reintentos.
  let parrafos: Parrafo[] | null = null;
  for (let intento = 0; intento < 3 && !parrafos; intento++) {
    const salida = await llamar(env, REGLAS, pedido);
    if (!salida) break;
    micros += salida.micros;
    parrafos = leerSalida(salida.texto);
  }
  if (!parrafos) return void (await asentar(micros)), fallo("salida_invalida", 502);
  let { validos, publicable, conInterpretacion } = filtrar(parrafos, fichas);

  if (esMensaje) {
    await asentar(micros);
    return json(conInterpretacion ? { parrafos: validos } : { fija: "sin_biblioteca" });
  }
  // Capítulo: el verificador quita lo interpretativo que no está respaldado, y eso también cuenta para el umbral del 40%.
  if (publicable) {
    const v = await verificar(env, validos, fichas);
    if (!v) return void (await asentar(micros)), fallo("salida_invalida", 502);
    micros += v.micros;
    const total = parrafos.filter((p) => p.tipo === "interpretativo").length;
    validos = validos.filter((p, i) => p.tipo === "narrativo" || v.respaldados.has(i));
    const quedan = validos.filter((p) => p.tipo === "interpretativo").length;
    publicable = quedan > 0 && (total - quedan) / total <= 0.4;
  }
  await asentar(micros);
  if (!publicable) return fallo("no_publicable", 422);
  const modelo = env.IA_MODELO || MODELO;
  return json({ parrafos: validos, modelo, verificador: modelo, fichas: fichas.map(({ id }) => ({ id, version: catalogo.fichas[id]!.version })) });
}

// Para el coach: todas las fichas que le tocan a esta carta en los cinco capítulos.
const fichasDeLaCarta = (a: Atributos) => [...new Set([1, 2, 3, 4, 5].flatMap((n) => piezas(n, a)[0]))];
