import { expect, test } from "vitest";
import { esSensible, filtrar, leerSalida, motivo, preguntaSiEsCiencia, type FichaIA, type Parrafo } from "../src/guardas";

const fichas: FichaIA[] = [
  { id: "tipo.proyector", texto: 'Eres Proyector. Jovian Archive estima que son "just over 20%" de las personas.' },
  { id: "estrategia.invitacion", texto: "Tu Estrategia es esperar la invitación." },
];
const interp = (texto: string, fuentes = ["tipo.proyector"]): Parrafo => ({ tipo: "interpretativo", texto, fuentes });

test("la salida tiene que ser el esquema exacto; cualquier otra forma no se usa", () => {
  expect(leerSalida('{"parrafos":[{"tipo":"narrativo","texto":"Vamos de a poco."},{"tipo":"interpretativo","texto":"Eres Proyector.","fuentes":["tipo.proyector"]}]}')).toHaveLength(2);
  expect(leerSalida('```json\n{"parrafos":[{"tipo":"narrativo","texto":"Hola."}]}\n```')).toHaveLength(1);
  for (const mala of ["texto suelto", "{}", '{"parrafos":[]}', '{"parrafos":[{"tipo":"otro","texto":"x"}]}', '{"parrafos":[{"tipo":"interpretativo","texto":"sin fuentes"}]}', '{"parrafos":[{"tipo":"narrativo","texto":""}]}']) expect(leerSalida(mala)).toBeNull();
});

test("un párrafo interpretativo sin cita válida, con un número que no está en su ficha o con algo prohibido se descarta", () => {
  expect(motivo(interp("Eres Proyector, algo más del 20% de las personas."), fichas)).toBeNull();
  expect(motivo(interp("Eres Proyector.", []), fichas)).toBe("sin_cita");
  expect(motivo(interp("Eres Proyector.", ["ficha.inventada"]), fichas)).toBe("sin_cita");
  expect(motivo(interp("Los Proyectores son el 35% de las personas."), fichas)).toBe("numero_inventado");
  expect(motivo(interp("Esto está científicamente comprobado."), fichas)).toBe("prohibido");
  expect(motivo(interp("Vas a conocer a alguien el año que viene."), fichas)).toBe("prohibido");
  expect(motivo(interp("Tu diseño explica tu ansiedad."), fichas)).toBe("prohibido");
});

test("un párrafo narrativo no afirma nada sobre el Diseño ni pasa de dos oraciones", () => {
  expect(motivo({ tipo: "narrativo", texto: "Vamos de a poco. ¿Qué te suena de esto?" }, fichas)).toBeNull();
  expect(motivo({ tipo: "narrativo", texto: "Uno. Dos. Tres." }, fichas)).toBe("narrativo_largo");
  expect(motivo({ tipo: "narrativo", texto: "Como eres Proyector, esto te va a sonar." }, fichas)).toBe("narrativo_afirma");
  expect(motivo({ tipo: "narrativo", texto: "Tu Autoridad lo dice todo." }, fichas)).toBe("narrativo_afirma");
});

test("un capítulo no se publica si se descartó más del 40% de lo interpretativo; el coach sin interpretación válida no responde con el modelo", () => {
  const bueno = interp("Eres Proyector.");
  const malo = interp("Sin respaldo.", ["no.existe"]);
  expect(filtrar([bueno, bueno, bueno, malo], fichas)).toMatchObject({ publicable: true, conInterpretacion: true });
  expect(filtrar([bueno, malo], fichas).publicable).toBe(false);
  expect(filtrar([{ tipo: "narrativo", texto: "Hola." }], fichas)).toMatchObject({ publicable: false, conInterpretacion: false });
  expect(filtrar([bueno, malo], fichas).validos).toEqual([bueno]);
});

test("temas sensibles y la pregunta por la ciencia se detectan en lo que escribe la persona", () => {
  for (const s of ["a veces pienso en quitarme la vida", "¿debería dejar la medicación?", "quiero pedir un préstamo grande", "me estoy por divorciar"]) expect(esSensible(s), s).toBe(true);
  expect(esSensible("¿qué hago cuando me invitan a algo?")).toBe(false);
  expect([preguntaSiEsCiencia("¿esto es ciencia?"), preguntaSiEsCiencia("¿cómo decido?")]).toEqual([true, false]);
});
