import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { buscarCiudades, errorDePaso, type Ciudad, type Nacimiento } from "../src/ui/nacimiento";

const AR = "public/ciudades/AR.json";
const base: Nacimiento = { fecha: "1985-03-14", hora: "07:30", confiabilidad: "exacta", margen: 15, pais: "AR", ciudad: ["Cachi", "Salta", -25.1, -66.2, "America/Argentina/Salta"], residencia: "ES" };

test("cada paso valida lo suyo", () => {
  expect(errorDePaso(1, { ...base, fecha: "" })).toBe("nacimiento.fecha.error");
  expect(errorDePaso(1, { ...base, fecha: "2999-01-01" })).toBe("nacimiento.fecha.error");
  expect(errorDePaso(2, { ...base, hora: "" })).toBe("nacimiento.hora.error");
  expect(errorDePaso(2, { ...base, hora: "", confiabilidad: "desconocida" })).toBeNull();
  expect(errorDePaso(3, { ...base, ciudad: null })).toBe("nacimiento.lugar.error");
  expect([1, 2, 3].map((p) => errorDePaso(p, base))).toEqual([null, null, null]);
});

// R10: 10 localidades chicas de Argentina con su huso correcto. Los archivos los genera scripts/ciudades.mjs.
test.skipIf(!existsSync(AR))("la búsqueda encuentra localidades chicas de Argentina con su huso", () => {
  const lista = JSON.parse(readFileSync(AR, "utf8")) as Ciudad[];
  const esperado: [string, string, string][] = [
    ["cachi", "Cachi", "America/Argentina/Salta"],
    ["tilcara", "Tilcara", "America/Argentina/Jujuy"],
    ["tafi del valle", "Tafí del Valle", "America/Argentina/Tucuman"],
    ["chilecito", "Chilecito", "America/Argentina/La_Rioja"],
    ["belen", "Belén", "America/Argentina/Catamarca"],
    ["san jose de jachal", "San José de Jáchal", "America/Argentina/San_Juan"],
    ["tolhuin", "Tolhuin", "America/Argentina/Ushuaia"],
    ["el chalten", "El Chaltén", "America/Argentina/Rio_Gallegos"],
    ["capilla del monte", "Capilla del Monte", "America/Argentina/Cordoba"],
    ["la toma", "La Toma", "America/Argentina/San_Luis"],
  ];
  for (const [consulta, nombre, huso] of esperado) {
    const hallada = buscarCiudades(lista, consulta, 20).find((c) => c[0] === nombre);
    expect(hallada?.[4], consulta).toBe(huso);
  }
  expect(buscarCiudades(lista, "x")).toEqual([]);
});
