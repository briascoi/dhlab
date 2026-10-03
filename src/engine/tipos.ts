// Estrategia, Firma y No-Yo de cada Tipo.
// Fuente: páginas de cada Tipo en Jovian Archive (jovianarchive.com/pages/type-and-strategy-in-human-design y las de
// Generator, Projector, Manifestor y Reflector), leídas el 2026-10-03. Esa fuente cuenta al Generador Manifestante
// dentro de los Generadores, así que comparte su Estrategia, Firma y No-Yo.
import type { Tipo } from "./carta";

export const DEL_TIPO: Record<Tipo, { estrategia: string; firma: string; noYo: string }> = {
  generador: { estrategia: "responder", firma: "satisfaccion", noYo: "frustracion" },
  generador_manifestante: { estrategia: "responder", firma: "satisfaccion", noYo: "frustracion" },
  proyector: { estrategia: "invitacion", firma: "exito", noYo: "amargura" },
  manifestador: { estrategia: "informar", firma: "paz", noYo: "ira" },
  reflector: { estrategia: "ciclo_lunar", firma: "sorpresa", noYo: "decepcion" },
};
