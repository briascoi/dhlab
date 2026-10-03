import { expect, test } from "vitest";
import { t } from "../src/textos";
import { detalleCentro } from "../src/ui/detalle-centro";

test("un Centro bloqueado no muestra contenido hasta el Capítulo 4", () => {
  expect(detalleCentro("sacral", 3, [34, 57])).toEqual({ bloqueado: true, canales: [] });
});

test("un Centro abierto lista sus Canales con su estado", () => {
  const { bloqueado, canales } = detalleCentro("sacral", 4, [34, 57, 3]);
  expect(bloqueado).toBe(false);
  expect(canales).toHaveLength(11);
  const estado = (a: number, b: number) => canales.find(({ canal }) => canal.puertas.includes(a) && canal.puertas.includes(b));
  expect(estado(34, 57)?.estado).toBe("definido");
  expect(estado(3, 60)).toMatchObject({ estado: "media", puerta: 3 });
  expect(estado(2, 14)?.estado).toBe("indefinido");
});

test("los textos aprobados salen sin marca", () => {
  expect(t("mapa.canal", { a: 3, b: 60 }, false)).toBe("Canal 3-60");
});

test("los Canales se abren con el Capítulo 5, después de los Centros", async () => {
  const { CAPITULO_DE_CANALES, CAPITULO_DE_CENTROS } = await import("../src/ui/detalle-centro");
  expect(CAPITULO_DE_CANALES).toBeGreaterThan(CAPITULO_DE_CENTROS);
  expect(t("mapa.candado", { elemento: t("mapa.canal", { a: 34, b: 57 }), numero: CAPITULO_DE_CANALES, titulo: t("capitulo.5.titulo", {}, true) })).toBe("Canal 34-57 se abre en el Capítulo 5: Tus Canales.");
});
