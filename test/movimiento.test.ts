import { expect, test } from "vitest";
import { nivelInicial } from "../src/ui/movimiento";

test("el nivel de movimiento sale de lo guardado y, si no hay nada, de \"reducir movimiento\"", () => {
  expect(nivelInicial(null, false)).toBe("completo");
  expect(nivelInicial(null, true)).toBe("minimo");
  // Lo que la persona eligió manda sobre el sistema, en los dos sentidos.
  expect(nivelInicial("completo", true)).toBe("completo");
  expect(nivelInicial("suave", false)).toBe("suave");
  expect(nivelInicial("minimo", false)).toBe("minimo");
  // Un valor desconocido no rompe: se ignora.
  expect(nivelInicial("turbo", false)).toBe("completo");
});
