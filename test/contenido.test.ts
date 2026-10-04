// Linter del contenido (plan, "Base de conocimiento"): ninguna ficha sin fuente, ids únicos y las piezas que el Capítulo 1 necesita por Tipo.
// El contenido vive fuera del código publicado: sin la carpeta, no hay nada que revisar.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { chequeoPendiente, type EstadoCapitulo } from "../src/contenido";
import { DEL_TIPO } from "../src/engine/tipos";

const archivos = existsSync("contenido") ? readdirSync("contenido").filter((a) => a.endsWith(".json")) : [];
const entradas = archivos.flatMap((a) => {
  const c = JSON.parse(readFileSync(`contenido/${a}`, "utf8")) as { fichas: Record<string, unknown>[]; experimentos: Record<string, unknown>[] };
  return [...c.fichas, ...c.experimentos];
});

test.skipIf(!archivos.length)("cada entrada tiene fuente completa, campos de revisión y texto sin rayas", () => {
  expect(new Set(entradas.map((e) => e.id)).size).toBe(entradas.length);
  for (const e of entradas) {
    const fuentes = e.fuentes as Record<string, string>[];
    expect(fuentes.length, String(e.id)).toBeGreaterThan(0);
    for (const f of fuentes) expect([f.obra, f.autor, f.donde].every(Boolean), String(e.id)).toBe(true);
    for (const campo of ["tema", "texto", "aprobado_por", "fecha_aprobacion", "version", "originalidad_chequeada", "borrador_asistido"]) expect(e, String(e.id)).toHaveProperty(campo);
    expect(String(e.texto), String(e.id)).not.toMatch(/—/);
    // Una sección del libro tiene hasta unas 250 palabras.
    expect(String(e.texto).split(/\s+/).length, String(e.id)).toBeLessThanOrEqual(250);
  }
});

test.skipIf(!archivos.length)("el Capítulo 1 tiene sus tres fichas y su experimento para cada Tipo", () => {
  const ids = new Set(entradas.map((e) => e.id));
  for (const [tipo, { estrategia }] of Object.entries(DEL_TIPO)) {
    for (const id of [`tipo.${tipo}`, `estrategia.${estrategia}`, `firma_no_yo.${estrategia}`, `experimento.${estrategia}`]) expect(ids.has(id), id).toBe(true);
  }
});

test("el chequeo toca el día 3 y el día 7, una vez cada uno, y el del 7 no espera al del 3", () => {
  const DIA = 86_400_000;
  const base: EstadoCapitulo = { esquema: 1, experimento: "x", elegido: new Date(0).toISOString(), atributo: "", fichas: [] };
  const con = (...dias: (3 | 7)[]): EstadoCapitulo => ({ ...base, chequeos: dias.map((dia) => ({ dia, respuesta: "no_probe", fecha: "" })) });
  expect([0, 2, 3, 6, 7, 30].map((d) => chequeoPendiente(base, d * DIA))).toEqual([null, null, 3, 3, 7, 7]);
  expect([chequeoPendiente(con(3), 5 * DIA), chequeoPendiente(con(3), 7 * DIA), chequeoPendiente(con(7), 9 * DIA)]).toEqual([null, 7, null]);
});

test.skipIf(!archivos.some((a) => a.includes("capitulo-2")))("el Capítulo 2 tiene sus dos fichas y su experimento para cada Autoridad", () => {
  const ids = new Set(entradas.map((e) => e.id));
  for (const a of ["emocional", "sacral", "esplenica", "ego_manifestado", "ego_proyectado", "autoproyectada", "mental", "lunar"]) {
    for (const id of [`autoridad.${a}`, `autoridad_como.${a}`, `experimento.autoridad.${a}`]) expect(ids.has(id), id).toBe(true);
  }
});

test.skipIf(!archivos.some((a) => a.includes("capitulo-3")))("el Capítulo 3 tiene la ficha y el experimento de las seis Líneas y los tres ángulos", () => {
  const ids = new Set(entradas.map((e) => e.id));
  for (const id of ["perfil.calculo", "observacion.perfil", ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`linea.${n}`, `experimento.linea.${n}`]), ...["derecho", "yuxtaposicion", "izquierdo"].map((g) => `perfil.grupo.${g}`)]) expect(ids.has(id), id).toBe(true);
});

test.skipIf(!archivos.some((a) => a.includes("capitulo-4")))("el Capítulo 4 tiene los nueve Centros en sus dos estados y los cinco tipos de Definición", () => {
  const ids = new Set(entradas.map((e) => e.id));
  const centros = ["cabeza", "ajna", "garganta", "g", "corazon", "sacral", "plexo", "bazo", "raiz"];
  for (const id of ["centros.intro", ...centros.flatMap((c) => [`centro.${c}.definido`, `centro.${c}.indefinido`]), ...["ninguna", "simple", "partida", "triple", "cuadruple"].map((d) => `definicion.${d}`)]) expect(ids.has(id), id).toBe(true);
});

test.skipIf(!archivos.some((a) => a.includes("capitulo-5")))("el Capítulo 5 tiene una ficha por cada uno de los 36 Canales del motor", async () => {
  const { CANALES } = await import("../src/engine/system-data");
  const ids = new Set(entradas.map((e) => e.id));
  expect(CANALES).toHaveLength(36);
  for (const { puertas } of CANALES) expect(ids.has(`canal.${[...puertas].sort((a, b) => a - b).join("-")}`), puertas.join("-")).toBe(true);
  for (const id of ["canales.intro", "canales.ninguno", "experimento.canal"]) expect(ids.has(id), id).toBe(true);
});

// La traba contra citas y cifras inventadas (2026-10-04): leer una página a través de un resumen automático puede inventarlas.
// Por eso cada cita entre comillas y cada cifra de una ficha tiene que aparecer literal en el texto crudo de una de sus fuentes,
// bajado sin pasar por ningún modelo (`node scripts/bajar-fuentes.mjs`, que lo deja en contenido/fuentes/).
const normal = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");
const archivoDe = (donde: string) => `contenido/fuentes/${donde.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}.txt`;
const esPagina = (donde: string) => /^[a-z0-9.-]+\.[a-z]+\/\S+$/i.test(donde) && !donde.startsWith("github.com/");
const crudo = (e: Record<string, unknown>) =>
  (e.fuentes as { donde: string }[]).filter((f) => existsSync(archivoDe(f.donde))).map((f) => normal(readFileSync(archivoDe(f.donde), "utf8")));

test.skipIf(!archivos.length)("cada página citada tiene su texto crudo guardado", () => {
  for (const e of entradas) for (const f of e.fuentes as { donde: string }[]) if (esPagina(f.donde)) expect(existsSync(archivoDe(f.donde)), `${String(e.id)}: falta ${archivoDe(f.donde)}`).toBe(true);
});

test.skipIf(!archivos.length)("cada cita entre comillas aparece literal en el texto crudo de una fuente de su ficha", () => {
  const faltan: string[] = [];
  for (const e of entradas) {
    const textos = crudo(e);
    // Una cita va entre comillas rectas o, si ella misma trae comillas, entre comillas angulares.
    for (const [, recta, angular] of String(e.texto).matchAll(/"([^"]+)"|«([^»]+)»/g)) {
      const cita = recta ?? angular!;
      if (!textos.some((t) => t.includes(normal(cita)))) faltan.push(`${String(e.id)}: "${cita}"`);
    }
  }
  expect(faltan).toEqual([]);
});

test.skipIf(!archivos.length)("cada porcentaje y cada cantidad de días de una ficha aparece en el texto crudo de una de sus fuentes", () => {
  const faltan: string[] = [];
  // Los experimentos son diseño propio: sus plazos no salen de la fuente.
  for (const e of entradas.filter((x) => !x.clase)) {
    const textos = crudo(e);
    // La cifra tiene que estar en la fuente como lo que es: un porcentaje (con su signo cerca) o una cantidad de días.
    for (const [, n, unidad] of String(e.texto).replace(/"[^"]+"/g, " ").matchAll(/(\d+(?:,\d+)?)\s?(%| días)/g)) {
      const cifra = n!.replace(",", "\\.");
      const forma = unidad === "%" ? `(^|[^\\d.])${cifra}(%| percent|[^\\d.].{0,12}%)` : `(^|[^\\d.])${cifra}[ -]days?`;
      if (!textos.some((t) => new RegExp(forma).test(t))) faltan.push(`${String(e.id)}: ${n}${unidad}`);
    }
  }
  expect(faltan).toEqual([]);
});
