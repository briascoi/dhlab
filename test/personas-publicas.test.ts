// Subconjunto público de la validación del motor (plan, "Validación del motor"): 26 personas públicas con hora de nacimiento
// de alta confiabilidad. De punta a punta: fecha, hora y huso del lugar, conversión a UTC con nuestra tzdb, efemérides,
// Diseño a 88° y derivación. La referencia es otro motor (NatalEngine); los datos de nacimiento son de Astro-Databank.
import { beforeAll, expect, test } from "vitest";
import { calcularCarta } from "../src/engine/carta";
import { CUERPOS, iniciar } from "../src/engine/efemerides";
import { aUtc } from "../src/engine/time";
import referencia from "./fixtures/personas-publicas.json";

beforeAll(() => iniciar());

const resumen = (c: { tipo: string; autoridad: string; perfil: string; definicion: string }) => [c.tipo, c.autoridad, c.perfil, c.definicion].join(" | ");

test("las cartas de 26 personas públicas dan el mismo Tipo, Autoridad, Perfil y Definición que la referencia", () => {
  expect(referencia.casos).toHaveLength(26);
  for (const caso of referencia.casos) {
    const hora = aUtc(caso.fecha, caso.hora, caso.huso);
    expect(hora.estado, caso.persona).toBe("unica");
    const carta = calcularCarta(hora.instantes[0]!);
    const motor = resumen({ ...carta, perfil: carta.perfil.join("/") });
    expect(motor, caso.persona).toBe(resumen(caso));
    // Donde hay activaciones de la calculadora oficial de Jovian Archive, tienen que coincidir las 26, Puerta y Línea.
    if ("activacionesOficiales" in caso && caso.activacionesOficiales) {
      const gl = (a: { puerta: number; linea: number }) => `${a.puerta}.${a.linea}`;
      expect(CUERPOS.map((k) => gl(carta.personalidad[k])), caso.persona).toEqual(caso.activacionesOficiales.personalidad);
      expect(CUERPOS.map((k) => gl(carta.disenoActivaciones[k])), caso.persona).toEqual(caso.activacionesOficiales.diseno);
    }
  }
  // El caso borde: el nodo del Diseño a 0,06° de un cambio de Puerta. La fuente oficial coincide con nuestro motor.
  expect(referencia.casos.filter((c) => "casoBorde" in c).map((c) => c.persona)).toEqual(["prince"]);
});
