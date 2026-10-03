import { beforeAll, expect, test } from "vitest";
import { calcularCarta } from "../src/engine/carta";
import { iniciar } from "../src/engine/efemerides";
import { analizarRango, barrer, firmaDeCarta } from "../src/engine/interval";
import { posibilidades } from "../src/ui/hora";

// Corre en Chromium (R6): el WASM es el mismo archivo que sirve el sitio.
beforeAll(() => iniciar());

const MIN = 60_000;

test("un cambio intermedio que vuelve al valor inicial queda como tres tramos", () => {
  // Vale "A", pasa a "B" entre el minuto 23 y el 61, y vuelve a "A".
  const f = (t: number) => (t >= 23 * MIN && t < 61 * MIN ? "B" : "A");
  const tramos = barrer(0, 120 * MIN, f, (v) => v);
  expect(tramos.map((t) => t.valor)).toEqual(["A", "B", "A"]);
  // Los cortes quedan a menos de un segundo de los reales.
  expect(Math.abs(tramos[1]!.desde - 23 * MIN)).toBeLessThanOrEqual(1000);
  expect(Math.abs(tramos[2]!.desde - 61 * MIN)).toBeLessThanOrEqual(1000);
  expect(tramos[0]!.hasta).toBe(tramos[1]!.desde);
});

test("un rango corto lejos de cualquier límite da una sola carta", () => {
  const a = analizarRango(new Date("2024-01-01T00:00:00Z"), new Date("2024-01-01T00:10:00Z"));
  expect(a.estado).toBe("estable");
  expect(a.tramos).toHaveLength(1);
  expect(a.puertasInciertas).toEqual([]);
});

test("un día entero da varias cartas y cada corte separa dos cartas distintas", () => {
  const a = analizarRango(new Date("2024-01-01T00:00:00Z"), new Date("2024-01-02T00:00:00Z"));
  expect(a.tramos.length).toBeGreaterThan(1);
  expect(a.estado).not.toBe("estable");
  for (let i = 1; i < a.tramos.length; i++) {
    const corte = a.tramos[i]!.desde;
    expect(a.tramos[i - 1]!.hasta).toBe(corte);
    // Un segundo antes y en el corte, las cartas difieren; el tramo coincide con la carta calculada en su inicio.
    expect(firmaDeCarta(calcularCarta(new Date(corte - 1000)))).not.toBe(firmaDeCarta(calcularCarta(new Date(corte))));
    expect(firmaDeCarta(a.tramos[i]!.valor)).toBe(firmaDeCarta(calcularCarta(new Date(corte))));
  }
  // Lo incierto es exactamente lo que no comparten todas las cartas posibles.
  expect(a.puertasInciertas.length).toBeGreaterThan(0);
  expect(a.tipos.length > 1 || a.autoridades.length > 1).toBe(a.estado === "pendiente_de_hora");
});

// Caso encontrado recorriendo enero de 1990 con este mismo motor: es una prueba de regresión del estado
// "pendiente de hora", no una validación externa. Falta contrastarlo con una referencia independiente (T11).
test("un día en el que cambia el Tipo queda pendiente de hora", () => {
  const a = analizarRango(new Date("1990-01-03T00:00:00Z"), new Date("1990-01-04T00:00:00Z"));
  expect(a.estado).toBe("pendiente_de_hora");
  expect([...a.tipos].sort()).toEqual(["generador", "proyector", "reflector"]);
  // Los tramos cubren el día entero, sin huecos.
  expect(a.tramos[0]!.desde).toBe(Date.parse("1990-01-03T00:00:00Z"));
  expect(a.tramos.at(-1)!.hasta).toBe(Date.parse("1990-01-04T00:00:00Z"));
  // En pantalla, los tramos seguidos con el mismo Tipo, Autoridad y Perfil se unen en una sola línea.
  // Con el Tipo cambia la Autoridad, así que cada línea la nombra.
  expect([...a.autoridades].sort()).toEqual(["esplenica", "lunar", "sacral"]);
  expect(posibilidades(a, "UTC")).toEqual([
    "De 00:00 a 10:51: Generador, Autoridad Sacral, perfil 4/6",
    "De 10:51 a 18:24: Reflector, Autoridad Lunar, perfil 4/6",
    "De 18:24 a 21:20: Proyector, Autoridad Esplénica, perfil 4/1",
    "De 21:20 a 00:00: Proyector, Autoridad Esplénica, perfil 5/1",
  ]);
});
