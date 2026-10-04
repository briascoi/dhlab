// Cómo se le pide un texto al modelo y qué se hace con lo que devuelve. Sin red propia ni DOM: recibe la función que llama al modelo,
// así el mismo código corre en el Worker (IA incluida) y en el navegador (clave propia), con las mismas guardas (E3-guardas).
import { filtrar, frases, frasesAjenas, leerSalida, type FichaIA, type Parrafo } from "./guardas";

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

const REGLAS = `Eres el redactor de DH Lab, un laboratorio de Diseño Humano. Escribes en español neutro, de tú (nunca de vos), con frases cortas.
Respondes SOLO con un JSON de esta forma: {"parrafos":[{"tipo":"narrativo","texto":"..."},{"tipo":"interpretativo","texto":"...","fuentes":["id.de.ficha"]}]}
Reglas, sin excepción:
- "interpretativo": todo lo que diga algo sobre el Diseño de la persona. Lleva en "fuentes" los ids de las fichas que lo respaldan. Cada frase tiene que poder señalarse en una de esas fichas: reformulas o resumes lo que la ficha dice, y nada más.
- No agregas nada de tu conocimiento: ni causas, ni consecuencias, ni consejos, ni ejemplos, ni metáforas, ni cómo se siente o qué pasa "cuando" la persona hace algo, salvo que la ficha lo diga.
- No explicas qué significa un término (Firma, No-Yo, Estrategia, Autoridad, Definición...) si la ficha no lo explica: lo nombras y sigues.
- En "fuentes" van todas las fichas de las que sale el párrafo, y solo esas: no dices en un párrafo lo que está en una ficha que ese párrafo no cita.
- Si las fichas dicen poco, escribes poco. Un texto corto y fiel vale más que uno largo.
- No escribes transiciones ni frases de enlace ("esto define tu camino", "tu manera de decidir es única"): no se muestran. El tipo "narrativo" queda solo para decir que las fichas no alcanzan.
- No sacas cuentas ni conclusiones propias (cuántos Centros, cuál Línea es la consciente, qué combinación forman): solo lo que la ficha dice.
- Ningún número que no esté en la ficha citada.
- Prohibido: predicciones, salud, medicina, terapia, consejos de pareja, y llamar ciencia al sistema o decir que está comprobado.
- Si las fichas no alcanzan para responder, devuelve un solo párrafo narrativo que lo diga.`;
const VERIFICADOR = 'Eres un verificador estricto. Recibes párrafos; cada uno trae el texto de las fichas que cita y sus frases numeradas. Para cada frase decides si lo que afirma está dicho en las fichas de ESE párrafo. Reformular o resumir lo que la ficha dice vale. No vale agregar causas, consecuencias, consejos, ejemplos, metáforas o datos que la ficha no dice, aunque suenen razonables. Ante la duda, la frase va sin respaldo. Respondes SOLO con JSON: {"sin_respaldo":[{"parrafo":número,"frase":número}]}';

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

// El verificador: una segunda llamada que revisa frase por frase los párrafos interpretativos contra las fichas que cada uno cita.
// Devuelve las frases sin respaldo (párrafo y frase por posición), o null si no respondió con el formato pedido.
// Lo usan el capítulo y los evals (scripts/evals.ts).
export interface SinRespaldo { parrafo: number; frase: number }
export async function verificar(llamar: Llamar, fichas: FichaIA[], parrafos: Parrafo[]): Promise<{ sinRespaldo: SinRespaldo[] | null; micros: number }> {
  const pedido = parrafos.map((p, i) => ({ numero: i, fichas: fichas.filter((f) => p.fuentes?.includes(f.id)).map((f) => f.texto), frases: frases(p.texto).map((texto, j) => ({ numero: j, texto })) }));
  const v = await llamar(VERIFICADOR, JSON.stringify({ parrafos: pedido }));
  let lista: unknown;
  try {
    lista = (JSON.parse(v!.texto.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as { sin_respaldo?: unknown }).sin_respaldo;
  } catch {
    lista = null;
  }
  const valida = Array.isArray(lista) && lista.every((x) => Number.isInteger((x as SinRespaldo)?.parrafo) && Number.isInteger((x as SinRespaldo)?.frase));
  return { sinRespaldo: valida ? (lista as SinRespaldo[]) : null, micros: v?.micros ?? 0 };
}

// Un capítulo: redactar, guardas y verificador. El verificador quita las frases interpretativas sin respaldo (y el párrafo, si se
// queda sin frases). No se publica si las guardas descartan más del 40% de los párrafos interpretativos o el verificador más del
// 40% de sus frases.
// `llamarVerificador`: la llamada del verificador, por si usa otro modelo que el redactor.
export async function escribirCapitulo(llamar: Llamar, n: number, fichas: FichaIA[], llamarVerificador: Llamar = llamar): Promise<{ parrafos?: Parrafo[]; error?: "salida_invalida" | "no_publicable"; micros: number }> {
  const r = await redactar(llamar, `${JSON.stringify({ fichas })}\nEscribe la sección del capítulo ${n} del libro de esta persona usando solo estas fichas. No tiene que ser más larga que las fichas juntas, y nunca más de 250 palabras.`);
  if (!r.parrafos) return { error: "salida_invalida", micros: r.micros };
  const { validos, publicable } = filtrar(r.parrafos, fichas);
  if (!publicable) return { error: "no_publicable", micros: r.micros };
  const interpretativos = validos.filter((p) => p.tipo === "interpretativo");
  const v = await verificar(llamarVerificador, fichas, interpretativos);
  const micros = r.micros + v.micros;
  if (!v.sinRespaldo) return { error: "salida_invalida", micros };
  let total = 0, quedan = 0;
  const parrafos = validos.flatMap((p) => {
    // Las transiciones no se muestran: es donde el modelo opina sin ficha que lo respalde (evals del 2026-10-05).
    if (p.tipo === "narrativo") return [];
    const i = interpretativos.indexOf(p), todas = frases(p.texto);
    // Se caen las frases que marca el verificador y las que nombran un término que sus fichas no traen.
    const ajenas = frasesAjenas(p, fichas);
    const firmes = todas.filter((_, j) => !ajenas.includes(j) && !v.sinRespaldo!.some((s) => s.parrafo === i && s.frase === j));
    total += todas.length;
    quedan += firmes.length;
    return firmes.length ? [{ ...p, texto: firmes.join(" ") }] : [];
  });
  return quedan > 0 && (total - quedan) / total <= 0.4 ? { parrafos, micros } : { error: "no_publicable", micros };
}

// Un mensaje del coach: una llamada, sin verificador (con la guarda de términos). Sin ningún párrafo interpretativo válido, no hay respuesta del modelo que mostrar.
export async function responder(llamar: Llamar, texto: string, historial: unknown[], fichas: FichaIA[]): Promise<{ parrafos?: Parrafo[]; error?: "salida_invalida"; micros: number }> {
  const r = await redactar(llamar, `${JSON.stringify({ fichas })}\nConversación hasta ahora: ${JSON.stringify(historial)}\nLa persona pregunta: ${JSON.stringify(texto)}\nResponde usando solo estas fichas, en 120 palabras como máximo; si las fichas dicen poco, responde corto.`);
  if (!r.parrafos) return { error: "salida_invalida", micros: r.micros };
  // Sin verificador, pero con la guarda de términos: se caen las frases que nombran algo que sus fichas no traen.
  const validos = filtrar(r.parrafos, fichas).validos.flatMap((p) => {
    if (p.tipo === "narrativo") return [];
    const ajenas = frasesAjenas(p, fichas), firmes = frases(p.texto).filter((_, j) => !ajenas.includes(j));
    return firmes.length ? [{ ...p, texto: firmes.join(" ") }] : [];
  });
  return validos.length ? { parrafos: validos, micros: r.micros } : { micros: r.micros };
}
