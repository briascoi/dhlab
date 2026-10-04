// Guardas de la IA (plan, "IA: conexión, libro y coach"; E3-guardas): qué texto generado se puede mostrar.
// Sin DOM, sin red y sin textos de interfaz: el mismo módulo corre en el Worker (IA incluida) y en el navegador (clave propia).

// Dos tipos de párrafo. `narrativo`: voz y transiciones, sin cita, sin enunciados sobre el Diseño de la persona, dos oraciones como máximo.
// `interpretativo`: todo lo demás, con las fichas que lo respaldan en `fuentes`.
export interface Parrafo { tipo: "narrativo" | "interpretativo"; texto: string; fuentes?: string[] }
// Lo único que el modelo recibe de la base: el id de cada ficha y su texto.
export interface FichaIA { id: string; texto: string }

// La salida del modelo tiene que ser exactamente { "parrafos": [...] }; cualquier otra forma no se usa.
export function leerSalida(salida: string): Parrafo[] | null {
  let dato: unknown;
  try {
    dato = JSON.parse(salida.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    return null;
  }
  const parrafos = (dato as { parrafos?: unknown })?.parrafos;
  if (!Array.isArray(parrafos) || !parrafos.length || parrafos.length > 12) return null;
  const limpios: Parrafo[] = [];
  for (const p of parrafos as Record<string, unknown>[]) {
    if (typeof p?.texto !== "string" || !p.texto.trim() || p.texto.length > 1200) return null;
    if (p.tipo === "narrativo") limpios.push({ tipo: "narrativo", texto: p.texto.trim() });
    else if (p.tipo === "interpretativo" && Array.isArray(p.fuentes) && p.fuentes.every((f) => typeof f === "string")) limpios.push({ tipo: "interpretativo", texto: p.texto.trim(), fuentes: p.fuentes as string[] });
    else return null;
  }
  return limpios;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
// Filtro de prohibidos: predicciones, salud, pareja, llamar "ciencia" al sistema. Se aceptan falsos positivos.
const PROHIBIDOS = [
  /\b(te va a (pasar|ir|llegar|tocar|suceder)|vas a (conocer|encontrar|ganar|perder|tener|sufrir)|en el futuro|el ano que viene|prediccion|predice|destinad[oa] a)\b/,
  /\b(enfermedad|diagnostic|sintoma|medicaci|medicamento|tratamiento|terapia|cura[rs]?|curacion|sanar|salud|depresion|ansiedad|cancer)\w*/,
  /\b(tu pareja|matrimonio|divorci|infidelidad|tu ex)\w*/,
  /\b(cientific|ciencia|comprobado|demostrado|estudios (muestran|demuestran))\w*/,
];
// Enunciados sobre el Diseño de la persona: no pueden ir en un párrafo narrativo.
const SOBRE_EL_DISENO = /\b(eres|tienes|tu (tipo|autoridad|perfil|estrategia|firma|no-yo|definicion|diseno|carta|sacral|bazo|plexo|garganta|corazon|raiz|ajna|cabeza)|tus (centros|canales|lineas|puertas)|generador|proyector|manifestador|reflector)\b/;

export const esProhibido = (texto: string) => PROHIBIDOS.some((p) => p.test(sinTildes(texto)));
// Las frases de un texto, cortando después de cada punto, pregunta o exclamación. El verificador las revisa de a una.
export const frases = (texto: string) => texto.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const oraciones = (texto: string) => texto.split(/[.!?]+(?:\s|$)/).filter((o) => o.trim()).length;
const numeros = (texto: string) => texto.match(/\d+(?:[.,]\d+)?/g) ?? [];

// Por qué un párrafo no pasa, o null si pasa. `fichas`: las que se le dieron al modelo para esta respuesta.
export function motivo(p: Parrafo, fichas: FichaIA[]): string | null {
  if (esProhibido(p.texto)) return "prohibido";
  if (p.tipo === "narrativo") {
    if (oraciones(p.texto) > 2) return "narrativo_largo";
    if (SOBRE_EL_DISENO.test(sinTildes(p.texto)) || numeros(p.texto).length) return "narrativo_afirma";
    return null;
  }
  const citadas = (p.fuentes ?? []).map((id) => fichas.find((f) => f.id === id));
  // Sin cita válida se descarta: cada id citado tiene que estar entre las fichas entregadas.
  if (!citadas.length || citadas.some((f) => !f)) return "sin_cita";
  // Ningún número que no esté en las fichas citadas (números inventados).
  const permitidos = new Set(citadas.flatMap((f) => numeros(f!.texto)).map((n) => n.replace(",", ".")));
  if (numeros(p.texto).some((n) => !permitidos.has(n.replace(",", ".")))) return "numero_inventado";
  return null;
}

// Aplica las guardas a una salida ya leída. Un capítulo no se publica si se descartó más del 40% de lo interpretativo;
// una respuesta del coach sin ningún párrafo interpretativo válido se reemplaza por la frase fija.
export function filtrar(parrafos: Parrafo[], fichas: FichaIA[]) {
  const validos = parrafos.filter((p) => motivo(p, fichas) === null);
  const interpretativos = parrafos.filter((p) => p.tipo === "interpretativo").length;
  const quedan = validos.filter((p) => p.tipo === "interpretativo").length;
  const descartado = interpretativos ? (interpretativos - quedan) / interpretativos : 1;
  return { validos, publicable: quedan > 0 && descartado <= 0.4, conInterpretacion: quedan > 0 };
}

// Temas sensibles (salud física o mental, crisis, autolesión, decisiones legales o financieras de alto impacto):
// si lo que escribe la persona coincide, el coach no llama al modelo y responde un texto fijo de derivación.
const SENSIBLES = /\b(suicid|matarme|quitarme la vida|no quiero vivir|autolesi|lastimarme|hacerme dano|depresi|ataque de panico|enfermedad|diagnostic|medicaci|tratamiento|cancer|embaraz|abort|abogad|juicio|demanda|denuncia|divorci|custodia|hipoteca|inversion|invertir|deuda|prestamo|quiebra|herencia)\w*/;
export const esSensible = (texto: string) => SENSIBLES.test(sinTildes(texto));
// "¿Es ciencia?" tiene una respuesta fija.
export const preguntaSiEsCiencia = (texto: string) => /\b(ciencia|cientific|comprobad|demostrad|evidencia|pseudociencia)\w*/.test(sinTildes(texto));
