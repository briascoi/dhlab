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
