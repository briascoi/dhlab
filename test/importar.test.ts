import { expect, test } from "vitest";
import { clasificar, leerArchivo, otraVersion } from "../src/importar";

const archivo = (documentos: unknown[], esquema = 1) => JSON.stringify({ esquema, documentos });
const carta = { tipo: "carta", id: "principal", contenido: { esquema: 1, nacimiento: { fecha: "1990-05-15" } } };
const entrada = { tipo: "diario", id: "e1", contenido: JSON.stringify({ texto: "hola", fecha: "2026-10-01T10:00:00.000Z" }) };

test("un archivo que no es una exportación, o de un esquema más nuevo, no se importa", () => {
  for (const malo of ["no es json", "[]", archivo([{ tipo: "otro", id: "x", contenido: {} }]), archivo([{ ...entrada, contenido: {} }]), archivo([{ ...carta, contenido: "texto" }]), JSON.stringify({ documentos: [] })]) {
    expect(leerArchivo(malo)).toEqual({ error: "invalido" });
  }
  expect(leerArchivo(archivo([carta], 2))).toEqual({ error: "esquema_nuevo" });
});

test("clasifica en nuevo, ya existe y en conflicto; importar dos veces lo mismo no duplica", () => {
  const { piezas } = leerArchivo(archivo([carta, entrada])) as { piezas: Parameters<typeof clasificar>[0] };
  expect(clasificar(piezas, new Map())).toMatchObject({ nuevo: [{ id: "principal" }, { id: "e1" }], existe: [], conflicto: [] });
  // Importado una vez: todo existe, aunque el JSON local tenga otro espaciado.
  const locales = new Map([["carta/principal", JSON.stringify(carta.contenido, null, 2)], ["diario/e1", piezas[1]!.contenido]]);
  expect(clasificar(piezas, locales)).toMatchObject({ nuevo: [], existe: [{}, {}], conflicto: [] });
  // La entrada local dice otra cosa: choca. Una vez guardada la otra versión, volver a importar ya no choca.
  locales.set("diario/e1", JSON.stringify({ texto: "otra cosa" }));
  expect(clasificar(piezas, locales)).toMatchObject({ existe: [{ tipo: "carta" }], conflicto: [{ id: "e1" }] });
  const otra = otraVersion(piezas[1]!);
  expect([otra.id, JSON.parse(otra.contenido)]).toEqual(["e1~otra", { texto: "hola", fecha: "2026-10-01T10:00:00.000Z", versionDe: "e1" }]);
  locales.set(`diario/${otra.id}`, otra.contenido);
  expect(clasificar(piezas, locales).conflicto).toEqual([]);
});
