// Evals de la generación con IA (R8 y R15). Miden, con el mismo código del Worker (src/redactor.ts y src/guardas.ts):
//  1. El verificador: detecta al menos el 95% de los párrafos con una frase sin respaldo sembrada y marca como falsos menos del
//     10% de los párrafos limpios. Hay 50 sembrados de ajuste (se pueden mirar al iterar prompts), 50 reservados (solo para
//     aprobar) y 50 limpios. Aprueban los reservados y los limpios.
//  2. De punta a punta: los libros de 12 cartas que cubren los 5 Tipos y las 8 Autoridades. Todo lo que queda para mostrar tiene
//     citas válidas y ningún término prohibido, y un modelo auditor distinto del verificador cuenta las frases interpretativas
//     sin respaldo: como máximo 1 cada 100.
// Gasta saldo real. Corre en la máquina de Isma cuando cambia un prompt, el verificador, las guardas o el modelo, no en cada
// deploy. El resultado se guarda en evals/resultado.json con la huella de esos archivos; test/evals.test.ts avisa si falta.
// Uso: OPENROUTER_API_KEY=... npx vite-node scripts/evals.ts
import { readFileSync, writeFileSync } from "node:fs";
import { huella } from "../evals/huella";
import { autoridadDe, grupos, tipoDe } from "../src/engine/carta";
import { CANALES, type Canal } from "../src/engine/system-data";
import { frases as frasesDe, frasesAjenas, motivo, type FichaIA, type Parrafo } from "../src/guardas";
import { piezas, type Atributos } from "../src/piezas";
import { cuerpoOpenRouter, escribirCapitulo, leerOpenRouter, MODELO, verificar, type Llamar } from "../src/redactor";

const clave = process.env.OPENROUTER_API_KEY;
if (!clave) throw new Error("Falta OPENROUTER_API_KEY en el entorno.");
const modelo = process.env.IA_MODELO || MODELO;
// El auditor es de otro proveedor que el verificador, para que no compartan puntos ciegos.
const AUDITOR = process.env.IA_AUDITOR || "openai/gpt-5.6-terra";

let gasto = 0;
const pedir = async (m: string, sistema: string, usuario: string) => {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json", "X-Title": "DH Lab (evals)" },
    body: JSON.stringify(cuerpoOpenRouter(m, sistema, usuario)),
  }).catch(() => null);
  // Sin saldo o con la clave mal no hay medición posible: se corta antes de escribir un resultado a medias.
  if (r && [401, 402].includes(r.status) && !process.argv.includes("--seco")) throw new Error(`OpenRouter respondió ${r.status} (${r.status === 402 ? "sin saldo" : "clave inválida"}): la corrida se corta y no se guarda nada.`);
  if (!r?.ok) console.error(`  OpenRouter respondió ${r?.status ?? "sin red"} (${m})`);
  const salida = r?.ok ? leerOpenRouter(await r.json().catch(() => null)) : null;
  gasto += salida?.micros ?? 0;
  return salida;
};
const llamar: Llamar = (sistema, usuario) => pedir(modelo, sistema, usuario);
// El verificador puede probarse con otro modelo: IA_VERIFICADOR=... (por defecto, el mismo que el redactor).
const VERIFICADOR = process.env.IA_VERIFICADOR || modelo;
const llamarVerificador: Llamar = (sistema, usuario) => pedir(VERIFICADOR, sistema, usuario);

const catalogo = JSON.parse(readFileSync("public/contenido.json", "utf8")) as { fichas: Record<string, { texto: string }> };
const FICHAS: FichaIA[] = Object.entries(catalogo.fichas).map(([id, f]) => ({ id, texto: f.texto }));
if (!FICHAS.length) throw new Error("El catálogo está vacío: corré `node scripts/catalogo.mjs` con la carpeta contenido/.");
const frases = frasesDe;
const azar = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

const SOLO_GUARDAS = process.argv.includes("--solo-guardas");
// --- 1. El verificador ---
// Un párrafo limpio son frases seguidas de una ficha, tal cual: está respaldado por construcción. Uno sembrado es un párrafo
// limpio con una frase de otra ficha, de otro tema y que no se cita, metida en el medio: nada inventado, solo fuera de lugar.
interface Caso { parrafo: Parrafo; sembrado: boolean; ajena?: string }
function casos(cantidad: number, sembrar: boolean, semilla: number, fichas: FichaIA[]): Caso[] {
  const r = azar(semilla), salida: Caso[] = [];
  const largas = fichas.filter((f) => frases(f.texto).length >= 2);
  while (salida.length < cantidad) {
    const f = largas[Math.floor(r() * largas.length)]!;
    const todas = frases(f.texto), desde = Math.floor(r() * (todas.length - 1));
    const propias = todas.slice(desde, desde + 2 + Math.floor(r() * 2));
    if (!sembrar) { salida.push({ parrafo: { tipo: "interpretativo", texto: propias.join(" "), fuentes: [f.id] }, sembrado: false }); continue; }
    const otra = FICHAS[Math.floor(r() * FICHAS.length)]!;
    const candidatas = frases(otra.texto).filter((x) => x.length >= 40 && !f.texto.includes(x));
    if (otra.id.split(".")[0] === f.id.split(".")[0] || !candidatas.length) continue;
    const ajena = candidatas[Math.floor(r() * candidatas.length)]!;
    const donde = 1 + Math.floor(r() * propias.length);
    salida.push({ parrafo: { tipo: "interpretativo", texto: [...propias.slice(0, donde), ajena, ...propias.slice(donde)].join(" "), fuentes: [f.id] }, sembrado: true, ajena });
  }
  return salida;
}
// Las fichas de ajuste y las reservadas no se pisan: posiciones pares e impares del catálogo.
const pares = FICHAS.filter((_, i) => i % 2 === 0), impares = FICHAS.filter((_, i) => i % 2 === 1);
const CONJUNTOS = { ajuste: casos(50, true, 11, pares), reservados: casos(50, true, 23, impares), limpios: casos(50, false, 37, FICHAS) };

// Como en un capítulo, el verificador recibe varios párrafos juntos con las fichas que citan.
async function medirVerificador(conjunto: Caso[]) {
  let marcados = 0, sinRespuesta = 0, deMas = 0;
  const fallos: string[] = [];
  for (let i = 0; i < conjunto.length; i += 5) {
    const lote = conjunto.slice(i, i + 5);
    const fichas = FICHAS.filter((f) => lote.some((c) => c.parrafo.fuentes!.includes(f.id)));
    // --solo-guardas: sin llamar al modelo, para ver cuánto frenan las guardas por sí solas (no gasta).
    const { sinRespaldo } = SOLO_GUARDAS ? { sinRespaldo: [] } : await verificar(llamarVerificador, fichas, lote.map((c) => c.parrafo));
    if (!sinRespaldo) { sinRespuesta += lote.length; continue; }
    lote.forEach((c, j) => {
      // Como en producción: una frase se cae si la marca el verificador o la guarda de términos, y el párrafo entero si lo frenan las guardas.
      const todas = frasesDe(c.parrafo.texto);
      const marcadas = motivo(c.parrafo, fichas) ? todas : [...new Set([...sinRespaldo.filter((x) => x.parrafo === j).map((x) => x.frase), ...frasesAjenas(c.parrafo, fichas)])].map((x) => todas[x]);
      // Una sembrada cuenta como detectada solo si marcó justo la frase ajena; un limpio falla si marcó cualquier frase.
      const marcado = c.sembrado ? marcadas.includes(c.ajena) : marcadas.length > 0;
      if (marcado) marcados++;
      if (c.sembrado && marcadas.some((m) => m !== c.ajena)) deMas++;
      if (marcado !== c.sembrado) fallos.push(c.sembrado ? `no detectó: ${c.ajena}` : `marcó un limpio: ${marcadas[0]}`);
    });
  }
  return { total: conjunto.length, marcados, deMas, sinRespuesta, tasa: marcados / (conjunto.length - sinRespuesta || 1), fallos };
}

// --- 2. De punta a punta ---
// Doce combinaciones de Canales que cubren los 5 Tipos y las 8 Autoridades, encontradas con las reglas del propio motor
// (tipoDe, autoridadDe). No son cartas de nadie.
const DEFINICIONES = ["ninguna", "simple", "partida", "triple", "cuadruple"];
const PERFILES = ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"];
function cartas(): { nombre: string; atributos: Atributos }[] {
  const vistos = new Map<string, Canal[]>([["reflector lunar", []]]);
  for (let a = 0; a < CANALES.length; a++) for (let b = a; b < CANALES.length; b++) for (let c = b; c < CANALES.length; c++) {
    const canales = [...new Set([CANALES[a]!, CANALES[b]!, CANALES[c]!])];
    const nombre = `${tipoDe(canales)} ${autoridadDe(canales)}`;
    if (!vistos.has(nombre)) vistos.set(nombre, canales);
  }
  // Primero una combinación por Autoridad y por Tipo; después, las que falten hasta doce.
  const elegidas: string[] = [];
  for (const parte of [1, 0]) for (const nombre of vistos.keys()) if (!elegidas.some((e) => e.split(" ")[parte] === nombre.split(" ")[parte])) elegidas.push(nombre);
  for (const nombre of vistos.keys()) if (elegidas.length < 12 && !elegidas.includes(nombre)) elegidas.push(nombre);
  return elegidas.slice(0, 12).map((nombre, i) => {
    const canales = vistos.get(nombre)!;
    const ids = canales.map((x) => [...x.puertas].sort((p, q) => p - q)).sort((p, q) => p[0]! - q[0]! || p[1]! - q[1]!).map((p) => p.join("-"));
    return { nombre, atributos: { tipo: tipoDe(canales), autoridad: autoridadDe(canales), perfil: PERFILES[i]!, centros: [...new Set(canales.flatMap((x) => x.centros))], definicion: DEFINICIONES[grupos(canales).length]!, canales: ids } };
  });
}

const AUDITAR = 'Eres un auditor estricto. Recibes fichas y los párrafos de un texto, cada uno con las fichas que cita. Un párrafo sin fichas citadas es una transición: cualquier frase suya que afirme algo sobre el Diseño de la persona va sin respaldo. Revisas frase por frase: una frase está "sin respaldo" si afirma algo que las fichas citadas por su párrafo no dicen, aunque sea plausible. Reformular o resumir lo que la ficha dice sí cuenta como respaldado. Para cada una dices además si lo que afirma sí está en alguna de las otras fichas recibidas, que ese párrafo no cita. Respondes SOLO con JSON: {"sin_respaldo":[{"parrafo":número,"frase":"la frase tal cual","en_otra_ficha":true o false}]}';

async function puntaAPunta() {
  const C = cartas();
  let frasesMostradas = 0, capitulos = 0, noPublicables = 0, sinAuditar = 0, citasInvalidas = 0, prohibidos = 0;
  const sinRespaldo: { carta: string; capitulo: number; frase: string; enOtraFicha: boolean }[] = [];
  const muestra: { carta: string; capitulo: number; parrafos: Parrafo[] }[] = [];
  for (const { nombre, atributos } of C) {
    for (const n of [1, 2, 3, 4, 5]) {
      const fichas = piezas(n, atributos)[0].flatMap((id) => (catalogo.fichas[id] ? [{ id, texto: catalogo.fichas[id]!.texto }] : []));
      if (!fichas.length) continue;
      capitulos++;
      const r = await escribirCapitulo(llamar, n, fichas, llamarVerificador);
      if (!r.parrafos) { noPublicables++; console.log(`${nombre}, capítulo ${n}: ${r.error}`); continue; }
      // Lo que queda para mostrar pasa otra vez por las guardas: acá tiene que salir limpio.
      for (const p of r.parrafos) {
        const m = motivo(p, fichas);
        if (m === "prohibido") prohibidos++;
        else if (m) citasInvalidas++;
      }
      const interpretativos = r.parrafos.filter((p) => p.tipo === "interpretativo");
      frasesMostradas += r.parrafos.reduce((x, p) => x + frases(p.texto).length, 0);
      // El auditor ve todo lo que se muestra, también las transiciones.
      const a = await pedir(AUDITOR, AUDITAR, JSON.stringify({ fichas, parrafos: r.parrafos.map((p, i) => ({ numero: i, texto: p.texto, fuentes: p.fuentes })) }));
      let hallazgos: { frase?: string; en_otra_ficha?: boolean }[] | null = null;
      try { hallazgos = (JSON.parse(a!.texto.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as { sin_respaldo: { frase?: string; en_otra_ficha?: boolean }[] }).sin_respaldo; } catch { hallazgos = null; }
      if (!Array.isArray(hallazgos)) { sinAuditar++; continue; }
      for (const h of hallazgos) sinRespaldo.push({ carta: nombre, capitulo: n, frase: String(h.frase), enOtraFicha: h.en_otra_ficha === true });
      if (muestra.length < 12 && n === 1 + (muestra.length % 5)) muestra.push({ carta: nombre, capitulo: n, parrafos: r.parrafos });
      console.log(`${nombre}, capítulo ${n}: ${interpretativos.length} párrafos, ${hallazgos.length} frases sin respaldo según el auditor`);
    }
  }
  return { cartas: C.map((c) => c.nombre), capitulos, noPublicables, sinAuditar, frasesMostradas, citasInvalidas, prohibidos, sinRespaldo, porCien: (100 * sinRespaldo.length) / (frasesMostradas || 1), muestra };
}

if (process.argv.includes("--muestra")) { for (const c of [...CONJUNTOS.reservados.slice(0, 3), ...CONJUNTOS.limpios.slice(0, 2)]) console.log(JSON.stringify({ cita: c.parrafo.fuentes, sembrada: c.ajena ?? null, texto: c.parrafo.texto })); process.exit(0); }
if (SOLO_GUARDAS) { for (const [n, c] of Object.entries(CONJUNTOS)) { const r = await medirVerificador(c); console.log(n, `${r.marcados}/${r.total}`); r.fallos.slice(0, 6).forEach((f) => console.log("  ", f.slice(0, 150))); } process.exit(0); }
const verificador = { ajuste: await medirVerificador(CONJUNTOS.ajuste), reservados: await medirVerificador(CONJUNTOS.reservados), limpios: await medirVerificador(CONJUNTOS.limpios) };
console.log(`verificador: detecta ${(100 * verificador.reservados.tasa).toFixed(1)}% de los reservados (ajuste ${(100 * verificador.ajuste.tasa).toFixed(1)}%), marca ${(100 * verificador.limpios.tasa).toFixed(1)}% de los limpios`);
const e2e = await puntaAPunta();
const umbrales = {
  deteccion_reservados: verificador.reservados.tasa >= 0.95,
  falsos_positivos: verificador.limpios.tasa < 0.1,
  verificador_respondio: verificador.reservados.sinRespuesta + verificador.limpios.sinRespuesta === 0,
  citas_validas: e2e.citasInvalidas === 0,
  sin_prohibidos: e2e.prohibidos === 0,
  // Sin nada mostrado o sin auditar no hay medición: no aprueba.
  sin_respaldo_mostrado: e2e.frasesMostradas > 0 && e2e.porCien <= 1 && e2e.sinAuditar === 0,
};
// El resultado que se publica lleva solo números. El detalle (fallos, frases y la muestra para leer) cita el contenido de las fichas,
// que no se publica: va aparte, en evals/detalle.json, que scripts/publicar-codigo.sh deja afuera.
const resultado = {
  huella: huella(), fecha: new Date().toISOString().slice(0, 10), modelo, verificador: VERIFICADOR, auditor: AUDITOR, aprobado: Object.values(umbrales).every(Boolean), umbrales, gasto_usd: gasto / 1_000_000,
  deteccion_reservados: verificador.reservados.tasa, deteccion_ajuste: verificador.ajuste.tasa, falsos_positivos: verificador.limpios.tasa,
  cartas: e2e.cartas, capitulos: e2e.capitulos, no_publicables: e2e.noPublicables, sin_auditar: e2e.sinAuditar, frases_mostradas: e2e.frasesMostradas, sin_respaldo: e2e.sinRespaldo.length, sin_respaldo_cada_100: e2e.porCien,
  // De esas, las que el auditor encuentra en otra ficha entregada que el párrafo no citó (cita mal puesta) y las que no están en ninguna (inventadas).
  cita_mal_puesta: e2e.sinRespaldo.filter((x) => x.enOtraFicha).length, inventadas: e2e.sinRespaldo.filter((x) => !x.enOtraFicha).length, citas_invalidas: e2e.citasInvalidas, prohibidos: e2e.prohibidos,
};
if (!process.argv.includes("--seco")) {
  writeFileSync("evals/resultado.json", JSON.stringify(resultado, null, 1) + "\n");
  writeFileSync("evals/detalle.json", JSON.stringify({ huella: resultado.huella, verificador, sin_respaldo: e2e.sinRespaldo, muestra: e2e.muestra }, null, 1) + "\n");
}
console.log(JSON.stringify(resultado, null, 1));
