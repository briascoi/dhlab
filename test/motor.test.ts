import { beforeAll, expect, test } from "vitest";
import { autoridadDe, calcularCarta, diaDeDiseno, grupos, tipoDe } from "../src/engine/carta";
import { diaJuliano, iniciar, longitudSol, posiciones } from "../src/engine/efemerides";
import { RUEDA, activacion, normalizar } from "../src/engine/rueda";
import { CANALES } from "../src/engine/system-data";

// Corre en Chromium (R6): el WASM es el mismo archivo que sirve el sitio.
beforeAll(() => iniciar());

const canal = (a: number, b: number) => CANALES.find((c) => c.puertas.includes(a) && c.puertas.includes(b))!;

test("la rueda tiene las 64 Puertas y la 41 empieza en 302°", () => {
  expect([...RUEDA].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  expect(activacion(302)).toMatchObject({ puerta: 41, linea: 1, color: 1, tono: 1, base: 1 });
  expect(activacion(301.9999).puerta).toBe(60);
  expect(activacion(3.875).puerta).toBe(17);
  expect(activacion(3.8).puerta).toBe(25);
  // Cada Línea ocupa 0,9375°: la sexta de la 41 termina justo antes de 307,625°.
  expect(activacion(307.62)).toMatchObject({ puerta: 41, linea: 6 });
  expect(activacion(307.625)).toMatchObject({ puerta: 19, linea: 1 });
});

test("las efemérides dan los valores conocidos de J2000", () => {
  const dj = diaJuliano(new Date("2000-01-01T12:00:00Z"));
  expect(dj).toBe(2451545);
  const verdadero = posiciones(dj, "verdadero");
  // Sol aparente 280,37°; Luna 223,32°; nodo medio 125,04° (valores de referencia de la época J2000).
  expect(verdadero.sol).toBeCloseTo(280.37, 1);
  expect(verdadero.luna).toBeCloseTo(223.32, 1);
  expect(posiciones(dj, "medio").nodo_norte).toBeCloseTo(125.04, 1);
  expect(verdadero.tierra).toBeCloseTo(100.37, 1);
  expect(normalizar(verdadero.nodo_sur - verdadero.nodo_norte)).toBeCloseTo(180, 9);
});

test("el Diseño cae donde el Sol estaba exactamente 88° antes, unos 88 días antes", () => {
  for (const fecha of ["1948-04-09T05:00:00Z", "1985-03-14T10:30:00Z", "2000-01-01T12:00:00Z", "2024-07-01T00:00:00Z"]) {
    const dj = diaJuliano(new Date(fecha));
    const diseno = diaDeDiseno(dj);
    expect(normalizar(longitudSol(dj) - longitudSol(diseno)), fecha).toBeCloseTo(88, 6);
    expect(dj - diseno, fecha).toBeGreaterThan(84);
    expect(dj - diseno, fecha).toBeLessThan(96);
  }
});

test("reglas de Tipo y de Definición", () => {
  expect(tipoDe([])).toBe("reflector");
  expect(tipoDe([canal(3, 60)])).toBe("generador");
  expect(tipoDe([canal(34, 20)])).toBe("generador_manifestante");
  // El Sacral definido y otro motor que llega a la Garganta por dos Canales.
  expect(tipoDe([canal(3, 60), canal(25, 51), canal(8, 1)])).toBe("generador_manifestante");
  expect(tipoDe([canal(21, 45)])).toBe("manifestador");
  expect(tipoDe([canal(64, 47)])).toBe("proyector");
  expect(tipoDe([canal(8, 1)])).toBe("proyector");
  expect(grupos([canal(64, 47), canal(3, 60)])).toHaveLength(2);
  expect(grupos([canal(64, 47), canal(17, 62), canal(3, 60)])).toHaveLength(2);
});

test("una carta completa es coherente por dentro", () => {
  const carta = calcularCarta(new Date("1985-03-14T10:30:00Z"));
  expect(Object.keys(carta.personalidad)).toHaveLength(13);
  expect(Object.keys(carta.disenoActivaciones)).toHaveLength(13);
  // La Tierra y el nodo sur están siempre en la Puerta opuesta.
  expect(normalizar(carta.personalidad.tierra.longitud - carta.personalidad.sol.longitud)).toBeCloseTo(180, 9);
  expect(carta.perfil).toEqual([carta.personalidad.sol.linea, carta.disenoActivaciones.sol.linea]);
  expect(carta.puertas.length).toBeLessThanOrEqual(26);
  expect(carta.centros.length === 0).toBe(carta.tipo === "reflector");
  // El nodo medio puede cambiar la Puerta del nodo, pero no el Sol.
  expect(calcularCarta(new Date("1985-03-14T10:30:00Z"), "medio").personalidad.sol).toEqual(carta.personalidad.sol);
});

// Caso público de referencia: el ejemplo resuelto del README de SharpAstrology.HumanDesign (modo Moshier),
// github.com/CReizner/SharpAstrology.HumanDesign, leído el 2026-10-03.
test("coincide con el ejemplo público de SharpAstrology para el 1 de enero de 2024 a las 00:00 UTC", () => {
  const carta = calcularCarta(new Date("2024-01-01T00:00:00Z"));
  expect(carta.tipo).toBe("generador");
  expect(carta.perfil).toEqual([1, 3]);
  expect(carta.definicion).toBe("partida");
  expect(carta.canales.map((c) => [...c.puertas].sort((a, b) => a - b).join("-")).sort()).toEqual(["29-46", "39-55"]);
  // Color y Tono del Sol y del nodo, de las Variables del ejemplo (5-2, 4-3, 4-1 y 3-1), con el nodo verdadero.
  // El README rotula 4-3 como Perspective y 3-1 como Awareness; por el código de la misma librería
  // (Awareness sale del Sol de Personalidad y Perspective del nodo) los rótulos del README están cruzados.
  const ct = (a: { color: number; tono: number }) => `${a.color}-${a.tono}`;
  expect(ct(carta.disenoActivaciones.sol)).toBe("5-2");
  expect(ct(carta.disenoActivaciones.nodo_norte)).toBe("4-1");
  expect(ct(carta.personalidad.sol)).toBe("4-3");
  expect(ct(carta.personalidad.nodo_norte)).toBe("3-1");
});

// La regla de Autoridad, caso por caso (Jovian Archive y SharpAstrology dan la misma; ver docs/diseno-humano/base-de-conocimiento.md).
test("la Autoridad sale del primer Centro definido en el orden Plexo Solar, Sacral, Bazo, Corazón, G", () => {
  const de = (...pares: [number, number][]) => {
    const canales = pares.map(([a, b]) => canal(a, b));
    return [tipoDe(canales), autoridadDe(canales)];
  };
  expect(de([59, 6])).toEqual(["generador", "emocional"]); // Sacral y Plexo Solar: manda el Plexo
  expect(de([3, 60])).toEqual(["generador", "sacral"]);
  expect(de([57, 20])).toEqual(["proyector", "esplenica"]);
  expect(de([21, 45])).toEqual(["manifestador", "ego_manifestado"]); // Corazón directo a la Garganta
  expect(de([25, 51], [1, 8])).toEqual(["manifestador", "ego_manifestado"]); // Corazón a la Garganta pasando por el G
  expect(de([25, 51])).toEqual(["proyector", "ego_proyectado"]);
  expect(de([1, 8])).toEqual(["proyector", "autoproyectada"]);
  expect(de([64, 47])).toEqual(["proyector", "mental"]);
  expect(de([43, 23])).toEqual(["proyector", "mental"]);
  expect(de()).toEqual(["reflector", "lunar"]);
  // El Bazo le gana al Corazón, y el Plexo Solar a todos.
  expect(de([26, 44])).toEqual(["proyector", "esplenica"]);
  expect(de([37, 40], [26, 44])).toEqual(["proyector", "emocional"]);
});
