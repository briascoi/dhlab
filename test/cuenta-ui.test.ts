import { expect, test } from "vitest";
import { emailValido, reloj, textoDeFallo } from "../src/ui/cuenta";

test("validación del email y formato del tiempo de espera", () => {
  expect([emailValido("ana@ejemplo.com"), emailValido("ana@ejemplo"), emailValido("sin arroba")]).toEqual([true, false, false]);
  expect([reloj(60), reloj(9), reloj(0)]).toEqual(["1:00", "0:09", "0:00"]);
});

test("cada falla del servidor tiene su texto del registro", () => {
  expect(textoDeFallo({ error: "codigo_incorrecto", quedan: 3 })).toBe("Ese código no es correcto. Te quedan 3 intentos.");
  expect(textoDeFallo({ error: "codigo_vencido" })).toBe("Este código de acceso venció.");
  expect(textoDeFallo({ error: "intentos_agotados" })).toBe("Usaste todos los intentos de este código.");
  expect(textoDeFallo({ error: "demasiados_pedidos" })).toBe("Espera unos minutos");
  expect(textoDeFallo({ error: "envio_fallido" })).toBe("No pudimos mandarte el email");
  expect(textoDeFallo({ error: "sin_red" })).toBe("Sin conexión. Revisa tu red e inténtalo otra vez.");
});
