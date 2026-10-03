// Cartas de referencia reales (B1): viven fuera del repo porque son datos personales. Si la carpeta privada no está
// (por ejemplo en la CI), este test se saltea. Acá se comprueba la derivación: de las 26 activaciones de cada carta
// tienen que salir el mismo Tipo, Autoridad, Perfil y Definición que dio la fuente de referencia.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { expect, test } from "vitest";
import { autoridadDe, grupos, tipoDe } from "../src/engine/carta";
import { definicion } from "../src/engine/definicion";

const ruta = process.env.DHLAB_FIXTURES ?? `${homedir()}/Dev/dhlab-fixtures/cartas.json`;
interface Referencia { alias: string; tipo: string; autoridad: string; perfil: string; definicion: string; diseno: string[]; personalidad: string[] }

test.skipIf(!existsSync(ruta))("las cartas de referencia dan el mismo Tipo, Autoridad, Perfil y Definición", () => {
  const { cartas } = JSON.parse(readFileSync(ruta, "utf8")) as { cartas: Referencia[] };
  expect(cartas.length).toBeGreaterThanOrEqual(4);
  const DEFINICIONES = ["ninguna", "simple", "partida", "triple", "cuadruple"];
  for (const c of cartas) {
    const puertas = [...c.personalidad, ...c.diseno].map((a) => Number(a.split(".")[0]));
    const { canales } = definicion(puertas);
    // El Perfil sale de la Línea del Sol de la Personalidad y la del Sol del Diseño.
    const perfil = `${c.personalidad[0]!.split(".")[1]}/${c.diseno[0]!.split(".")[1]}`;
    expect([tipoDe(canales), autoridadDe(canales), perfil, DEFINICIONES[grupos(canales).length]], c.alias).toEqual([c.tipo, c.autoridad, c.perfil, c.definicion]);
  }
});
