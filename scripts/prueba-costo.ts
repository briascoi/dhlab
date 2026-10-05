// Prueba de costo de la IA incluida (T54): llama a OpenRouter con el mismo código que usa el Worker (src/redactor.ts) y mide
// cuánto cuesta de verdad un capítulo y un mensaje del coach, para calibrar las reservas y los topes de worker/ia.ts.
// Gasta saldo real. Uso: OPENROUTER_API_KEY=... npx vite-node scripts/prueba-costo.ts
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { piezas, type Atributos } from "../src/piezas";
import { cuerpoOpenRouter, escribirCapitulo, leerOpenRouter, MODELO, responder, type Llamar } from "../src/redactor";

const clave = process.env.OPENROUTER_API_KEY;
if (!clave) throw new Error("Falta OPENROUTER_API_KEY en el entorno.");
const modelo = process.env.IA_MODELO || MODELO;
// Los valores de worker/ia.ts que esta prueba calibra, en millonésimas de dólar.
const RESERVA = { capitulo: 90_000, mensaje: 15_000 };
const TOPE_CUENTA = 500_000;

const catalogo = JSON.parse(readFileSync("public/contenido.json", "utf8")) as { fichas: Record<string, { texto: string }> };
const fichasDe = (ids: string[]) => ids.flatMap((id) => (catalogo.fichas[id] ? [{ id, texto: catalogo.fichas[id]!.texto }] : []));

let llamadas = 0;
const llamar: Llamar = async (sistema, usuario, tope) => {
  llamadas++;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json", "X-Title": "DH Lab (prueba de costo)" },
    body: JSON.stringify(cuerpoOpenRouter(modelo, sistema, usuario, tope)),
  }).catch(() => null);
  if (!r?.ok) console.error(`  OpenRouter respondió ${r?.status ?? "sin red"}`);
  return r?.ok ? leerOpenRouter(await r.json().catch(() => null)) : null;
};

// Tres combinaciones de atributos, para que no todas pidan las mismas fichas. La primera es la carta pública de referencia de
// test/motor.test.ts (1 de enero de 2024, 00:00 UTC); las otras dos son combinaciones coherentes armadas a mano, no cartas de nadie.
// (El motor corre en el navegador; acá no hace falta: la IA solo recibe los atributos.)
const CARTAS: Record<string, Atributos> = {
  "referencia 2024-01-01": { tipo: "generador", autoridad: "emocional", perfil: "1/3", centros: ["raiz", "plexo", "g", "sacral"], definicion: "partida", canales: ["29-46", "39-55"] },
  "proyector esplénico": { tipo: "proyector", autoridad: "esplenica", perfil: "2/4", centros: ["garganta", "bazo"], definicion: "simple", canales: ["16-48"] },
  "manifestador emocional": { tipo: "manifestador", autoridad: "emocional", perfil: "5/1", centros: ["garganta", "plexo"], definicion: "simple", canales: ["12-22"] },
};
const PREGUNTAS = ["¿Qué significa mi Tipo?", "¿Cómo tomo decisiones según mi carta?", "¿Qué dice mi Perfil de mí?"];

const filas: { carta: string; accion: string; micros: number; resultado: string; salida?: unknown }[] = [];
for (const [fecha, a] of Object.entries(CARTAS)) {
  for (const n of [1, 2, 3, 4, 5]) {
    const fichas = fichasDe(piezas(n, a)[0]);
    if (!fichas.length) { filas.push({ carta: fecha, accion: `capítulo ${n}`, micros: 0, resultado: "sin_fichas" }); continue; }
    const r = await escribirCapitulo(llamar, n, fichas);
    filas.push({ carta: fecha, accion: `capítulo ${n}`, micros: r.micros, resultado: r.error ?? `${r.parrafos!.length} párrafos`, salida: r.parrafos });
    console.log(`${fecha} capítulo ${n}: ${r.micros} µ$ (${r.error ?? "ok"}, ${fichas.length} fichas)`);
  }
  const todas = fichasDe([...new Set([1, 2, 3, 4, 5].flatMap((n) => piezas(n, a)[0]))]);
  for (const texto of PREGUNTAS) {
    const r = await responder(llamar, texto, [], todas);
    filas.push({ carta: fecha, accion: "mensaje", micros: r.micros, resultado: r.error ?? (r.parrafos ? `${r.parrafos.length} párrafos` : "sin_biblioteca"), salida: r.parrafos });
    console.log(`${fecha} mensaje: ${r.micros} µ$ (${r.error ?? "ok"})`);
  }
}

const resumen = (accion: "capitulo" | "mensaje") => {
  const m = filas.filter((f) => f.accion.startsWith(accion === "capitulo" ? "capítulo" : "mensaje") && f.resultado !== "sin_fichas").map((f) => f.micros).sort((x, y) => x - y);
  const media = Math.round(m.reduce((x, y) => x + y, 0) / m.length);
  return { pedidos: m.length, media, mediana: m[Math.floor(m.length / 2)], max: m.at(-1), reserva: RESERVA[accion], entran_en_el_tope_por_cuenta: Math.floor(TOPE_CUENTA / media) };
};
const total = filas.reduce((x, f) => x + f.micros, 0);
const errores = filas.filter((f) => !/párrafos|sin_biblioteca/.test(f.resultado)).map((f) => `${f.carta} ${f.accion}: ${f.resultado}`);
const ruta = join(tmpdir(), "dhlab-prueba-costo.json");
writeFileSync(ruta, JSON.stringify(filas, null, 1));
console.log(JSON.stringify({ modelo, llamadas, total_usd: total / 1_000_000, capitulo: resumen("capitulo"), mensaje: resumen("mensaje"), errores, salidas_en: ruta }, null, 1));
