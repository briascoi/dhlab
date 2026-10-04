// Cómo se le pide un texto al modelo y qué se hace con lo que devuelve. Sin red propia ni DOM: recibe la función que llama al modelo,
// así el mismo código corre en el Worker (IA incluida) y en el navegador (clave propia), con las mismas guardas (E3-guardas).
import { filtrar, leerSalida, type FichaIA, type Parrafo } from "./guardas";

export const MODELO = "anthropic/claude-haiku-4.5";
// Una llamada al modelo: devuelve el texto y lo que costó en millonésimas de dólar, o null si no respondió.
export type Llamar = (sistema: string, usuario: string) => Promise<{ texto: string; micros: number } | null>;

// El cuerpo de un pedido a OpenRouter: salida en JSON y solo proveedores sin retención ni entrenamiento (nota delegada de T51).
export const cuerpoOpenRouter = (modelo: string, sistema: string, usuario: string) => ({
  model: modelo,
  messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
  response_format: { type: "json_object" },
  max_tokens: 1500,
  usage: { include: true },
  provider: { zdr: true, data_collection: "deny" },
});
export function leerOpenRouter(d: unknown): { texto: string; micros: number } | null {
  const r = d as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } } | null;
  const texto = r?.choices?.[0]?.message?.content;
  return typeof texto === "string" ? { texto, micros: Math.ceil((r?.usage?.cost ?? 0) * 1_000_000) } : null;
}

const REGLAS = `Eres el redactor de DH Lab, un laboratorio de Diseño Humano. Escribes en español neutro, de tú, con frases cortas.
Respondes SOLO con un JSON de esta forma: {"parrafos":[{"tipo":"narrativo","texto":"..."},{"tipo":"interpretativo","texto":"...","fuentes":["id.de.ficha"]}]}
Reglas, sin excepción:
- "interpretativo": todo lo que diga algo sobre el Diseño de la persona. Lleva en "fuentes" los ids de las fichas que lo respaldan. Solo puedes afirmar lo que esas fichas dicen; no agregas nada de tu conocimiento.
- "narrativo": transiciones y preguntas, dos oraciones como máximo, sin afirmar nada sobre el Diseño de la persona y sin números.
- Ningún número que no esté en la ficha citada.
- Prohibido: predicciones, salud, medicina, terapia, consejos de pareja, y llamar ciencia al sistema o decir que está comprobado.
- Si las fichas no alcanzan para responder, devuelve un solo párrafo narrativo que lo diga.`;
const VERIFICADOR = 'Eres un verificador. Recibes fichas y párrafos numerados. Para cada párrafo decides si TODO lo que afirma está dicho en las fichas que cita. Respondes SOLO con JSON: {"respaldados":[números de los párrafos respaldados]}';

// La salida se valida contra el esquema, con hasta 2 reintentos.
async function redactar(llamar: Llamar, pedido: string) {
  let micros = 0;
  for (let intento = 0; intento < 3; intento++) {
    const salida = await llamar(REGLAS, pedido);
    if (!salida) break;
    micros += salida.micros;
    const parrafos = leerSalida(salida.texto);
    if (parrafos) return { parrafos, micros };
  }
  return { parrafos: null, micros };
}

// Un capítulo: redactar, guardas y verificador. El verificador quita lo interpretativo que no está respaldado;
// si entre las guardas y el verificador se cae más del 40% de lo interpretativo, no se publica.
export async function escribirCapitulo(llamar: Llamar, n: number, fichas: FichaIA[]): Promise<{ parrafos?: Parrafo[]; error?: "salida_invalida" | "no_publicable"; micros: number }> {
  const r = await redactar(llamar, `${JSON.stringify({ fichas })}\nEscribe la sección del capítulo ${n} del libro de esta persona, de hasta 250 palabras, usando solo estas fichas.`);
  if (!r.parrafos) return { error: "salida_invalida", micros: r.micros };
  let { validos, publicable } = filtrar(r.parrafos, fichas);
  if (!publicable) return { error: "no_publicable", micros: r.micros };
  const v = await llamar(VERIFICADOR, JSON.stringify({ fichas, parrafos: validos.map((p, i) => ({ numero: i, texto: p.texto, fuentes: p.fuentes })) }));
  let respaldados: unknown;
  try {
    respaldados = (JSON.parse(v!.texto.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as { respaldados?: unknown }).respaldados;
  } catch {
    respaldados = null;
  }
  const micros = r.micros + (v?.micros ?? 0);
  if (!Array.isArray(respaldados)) return { error: "salida_invalida", micros };
  const total = r.parrafos.filter((p) => p.tipo === "interpretativo").length;
  validos = validos.filter((p, i) => p.tipo === "narrativo" || (respaldados as unknown[]).includes(i));
  const quedan = validos.filter((p) => p.tipo === "interpretativo").length;
  return quedan > 0 && (total - quedan) / total <= 0.4 ? { parrafos: validos, micros } : { error: "no_publicable", micros };
}

// Un mensaje del coach: una llamada, sin verificador. Sin ningún párrafo interpretativo válido, no hay respuesta del modelo que mostrar.
export async function responder(llamar: Llamar, texto: string, historial: unknown[], fichas: FichaIA[]): Promise<{ parrafos?: Parrafo[]; error?: "salida_invalida"; micros: number }> {
  const r = await redactar(llamar, `${JSON.stringify({ fichas })}\nConversación hasta ahora: ${JSON.stringify(historial)}\nLa persona pregunta: ${JSON.stringify(texto)}\nResponde en hasta 120 palabras, usando solo estas fichas.`);
  if (!r.parrafos) return { error: "salida_invalida", micros: r.micros };
  const { validos, conInterpretacion } = filtrar(r.parrafos, fichas);
  return conInterpretacion ? { parrafos: validos, micros: r.micros } : { micros: r.micros };
}
