// IA con la clave propia de OpenRouter (CEO2-A2): los pedidos van directo de este navegador a OpenRouter, sin pasar por nuestro servidor
// ni por el tope de la IA incluida. La clave se guarda solo en este navegador. Corren las mismas guardas que en el servidor (E3-guardas).
import { capitulo } from "./contenido";
import type { Fallo } from "./cuenta-api";
import { esSensible, preguntaSiEsCiencia } from "./guardas";
import type { Respuesta, Seccion, Turno } from "./ia";
import type { Atributos } from "./piezas";
import { cuerpoOpenRouter, escribirCapitulo, leerOpenRouter, MODELO, responder, type Llamar } from "./redactor";

const CLAVE = "dhlab.clave_openrouter";
export const clavePropia = () => localStorage.getItem(CLAVE);
export const quitarClave = () => localStorage.removeItem(CLAVE);

// Prueba la clave contra OpenRouter antes de guardarla.
export async function conectarClave(clave: string): Promise<"conectada" | "invalida" | "sin_red"> {
  const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${clave}` } }).catch(() => null);
  if (!r) return "sin_red";
  if (!r.ok) return "invalida";
  localStorage.setItem(CLAVE, clave);
  return "conectada";
}

export function iaPropia(clave: string) {
  // Por qué falló la última llamada, para decirlo con su texto: clave inválida, sin saldo o corte.
  let motivo = "corte_propia";
  const llamarCon = (senal?: AbortSignal): Llamar => async (sistema, usuario) => {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json", "X-Title": "DH Lab" },
      body: JSON.stringify(cuerpoOpenRouter(MODELO, sistema, usuario)),
      signal: senal ?? null,
    }).catch(() => null);
    motivo = senal?.aborted ? "cancelado" : !r ? "corte_propia" : r.status === 401 || r.status === 403 ? "clave_invalida" : r.status === 402 ? "sin_saldo" : "corte_propia";
    return r?.ok ? leerOpenRouter(await r.json().catch(() => null)) : null;
  };
  // Si no se llegó a leer ninguna salida válida, el motivo es el de la llamada; si se leyó y no sirvió, es de las guardas.
  const fallo = (error: string, micros: number): Fallo => ({ error: error === "salida_invalida" && (micros === 0 || motivo !== "corte_propia") ? motivo : error });
  const fichasDe = (a: Atributos, capitulos: number[]) => capitulos.flatMap((n) => capitulo(n, a)?.fichas ?? []);

  return {
    capitulo: async (n: number, a: Atributos, senal: AbortSignal): Promise<Omit<Seccion, "esquema" | "escrita"> | Fallo> => {
      const fichas = fichasDe(a, [n]);
      const r = await escribirCapitulo(llamarCon(senal), n, fichas.map(({ id, texto }) => ({ id, texto })));
      if (r.error || !r.parrafos) return fallo(r.error ?? "salida_invalida", r.micros);
      return { parrafos: r.parrafos, modelo: MODELO, verificador: MODELO, fichas: fichas.map(({ id, version }) => ({ id, version })) };
    },
    mensaje: async (texto: string, historial: Turno[], a: Atributos): Promise<Respuesta | Fallo> => {
      // Las mismas respuestas fijas que en el servidor, sin llamar al modelo.
      if (esSensible([texto, ...historial.filter((h) => h.rol === "persona").map((h) => h.texto)].join(" "))) return { fija: "sensible" };
      if (preguntaSiEsCiencia(texto)) return { fija: "ciencia" };
      const fichas = [...new Map(fichasDe(a, [1, 2, 3, 4, 5]).map((f) => [f.id, { id: f.id, texto: f.texto }])).values()];
      const r = await responder(llamarCon(), texto, historial.slice(-6), fichas);
      if (r.error) return fallo(r.error, r.micros);
      return r.parrafos ? { parrafos: r.parrafos } : { fija: "sin_biblioteca" };
    },
  };
}
