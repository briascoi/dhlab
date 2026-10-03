import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { definicion } from "../src/engine/definicion";
import { CANALES, CENTRO_DE_PUERTA, CENTROS } from "../src/engine/system-data";
import { FORMAS, PUNTO_DE_PUERTA, VISTA, centro, dentro } from "../src/ui/mapa-geometria";

const puertas = Object.keys(CENTRO_DE_PUERTA).map(Number);

test("la tabla tiene 9 Centros, 64 Puertas y 36 Canales sin repetir", () => {
  expect(Object.keys(CENTROS)).toHaveLength(9);
  expect(puertas.sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  expect(new Set(CANALES.map(({ puertas: [a, b] }) => [a, b].sort().join("-"))).size).toBe(36);
});

test("cada Canal une los dos Centros que da la fuente y toda Puerta tiene Canal", () => {
  for (const { puertas: [a, b], centros } of CANALES) {
    expect([CENTRO_DE_PUERTA[a], CENTRO_DE_PUERTA[b]].sort(), `canal ${a}-${b}`).toEqual([...centros].sort());
  }
  expect(new Set(CANALES.flatMap((c) => c.puertas)).size).toBe(64);
});

test("el dibujo respeta la tabla: cada Canal sale de adentro de su Centro, sin encimarse con otro, y todo dentro de la vista", () => {
  for (const p of puertas) {
    const punto = PUNTO_DE_PUERTA[p]!;
    expect(dentro(punto, FORMAS[CENTRO_DE_PUERTA[p]!]), `puerta ${p}`).toBe(true);
    for (const q of puertas) {
      if (q <= p) continue;
      const o = PUNTO_DE_PUERTA[q]!;
      expect(Math.hypot(punto.x - o.x, punto.y - o.y), `puertas ${p} y ${q}`).toBeGreaterThanOrEqual(4);
    }
  }
  for (const [id, forma] of Object.entries(FORMAS)) {
    const xs = forma.map((p) => p.x);
    const ys = forma.map((p) => p.y);
    expect(Math.min(...xs) >= 0 && Math.max(...xs) <= VISTA.ancho && Math.min(...ys) >= 0 && Math.max(...ys) <= VISTA.alto, id).toBe(true);
    // Toque mínimo de 44 px con la vista a 360 px de ancho (DR4).
    expect(Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), id).toBeGreaterThanOrEqual(44);
    // Ninguna pieza contiene el centro de otra.
    for (const [otro, f] of Object.entries(FORMAS)) if (otro !== id) expect(dentro(centro(f), forma), `${id} y ${otro}`).toBe(false);
  }
});

test("definición: un Canal con sus dos Puertas define sus dos Centros", () => {
  const { canales, centros } = definicion([64, 47, 20]);
  expect(canales.map((c) => c.puertas)).toEqual([[64, 47]]);
  expect([...centros].sort()).toEqual(["ajna", "cabeza"]);
});

test("el motor no importa nada de la interfaz", () => {
  for (const archivo of readdirSync("src/engine")) {
    expect(readFileSync(`src/engine/${archivo}`, "utf8"), archivo).not.toMatch(/from "\.\.\/(ui|ai|storage)/);
  }
});

// Segunda fuente de la tabla del sistema (T11): SharpAstrology.HumanDesign, licencia MIT.
test("la tabla de Puertas, Centros y Canales coincide con una segunda fuente independiente", () => {
  const otra = JSON.parse(readFileSync("test/fixtures/sharpastrology-tabla.json", "utf8")) as { canales: [number, number][]; centroDePuerta: Record<string, string> };
  const par = ([a, b]: readonly [number, number] | number[]) => [a, b].sort((x, y) => x! - y!).join("-");
  expect(CANALES.map((c) => par(c.puertas)).sort()).toEqual(otra.canales.map(par).sort());
  expect(Object.fromEntries(Object.entries(CENTRO_DE_PUERTA).map(([p, c]) => [p, c]))).toEqual(otra.centroDePuerta);
});
