import { expect, test } from "vitest";
import type { Analisis } from "../src/engine/interval";
import { DEL_TIPO } from "../src/engine/tipos";
import { t, type TextoId } from "../src/textos";
import { filasDeConfiguracion } from "../src/ui/configuracion";

test("cada Tipo tiene su Estrategia, Firma y No-Yo, y todos tienen texto", () => {
  for (const [tipo, d] of Object.entries(DEL_TIPO)) {
    for (const id of [`tipo.${tipo}`, `estrategia.${d.estrategia}`, `firma.${d.firma}`, `no_yo.${d.noYo}`]) {
      expect(t(id as TextoId, {}, true), id).not.toContain("⟦");
    }
  }
  expect(DEL_TIPO.generador_manifestante).toEqual(DEL_TIPO.generador);
});

test("con hora incierta, la fila muestra todos sus valores posibles", () => {
  const carta = { centros: ["g", "sacral"], canales: [{}, {}] };
  const a = { tipos: ["generador"], autoridades: ["sacral"], perfiles: ["1/3", "1/4"], definiciones: ["partida"], tramos: [{ valor: carta }, { valor: carta }] } as unknown as Analisis;
  const filas = Object.fromEntries(filasDeConfiguracion(a).map((f) => [f.rotulo, f.valores]));
  expect(filas.Tipo).toEqual(["Generador"]);
  expect(filas.Estrategia).toEqual(["Esperar para responder"]);
  expect(filas.Perfil).toEqual(["1/3", "1/4"]);
  expect(filas["Centros definidos"]).toEqual(["2 de 9"]);
  expect(filas.Canales).toEqual(["2 de 36"]);
  expect(filas["No-Yo"]).toEqual(["Frustración"]);
});

test("la revelación dura entre 6 y 8 segundos, con cualquier cantidad de pasos", async () => {
  const { retrasos } = await import("../src/ui/revelacion");
  for (const n of [1, 8, 30]) expect(retrasos(n).at(-1)! + 320).toBeLessThanOrEqual(8000);
  expect(retrasos(8).at(-1)! + 320).toBeGreaterThanOrEqual(6000);
  expect(retrasos(8)[0]).toBe(0);
});

test("las flechas a mano nunca son rectas, salen iguales con la misma semilla y llegan a su destino", async () => {
  const { flecha } = await import("../src/ui/trazos");
  const pulso = { grosor: 2, temblor: 1 };
  for (const forma of ["arco", "gancho", "rulo", "ese"] as const) {
    const f = flecha(forma, { x: 0, y: 0 }, { x: 200, y: 0 }, pulso, 5);
    expect(flecha(forma, { x: 0, y: 0 }, { x: 200, y: 0 }, pulso, 5)).toEqual(f);
    // Con origen y destino sobre el eje, una recta no se apartaría de y = 0.
    const ys = [...f.cuerpo.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((m) => Math.abs(Number(m[1])));
    expect(Math.max(...ys), forma).toBeGreaterThan(20);
    expect(f.cuerpo.endsWith("200.0,0.0"), forma).toBe(true);
    expect(f.punta).toContain("L200.0,0.0");
  }
});
