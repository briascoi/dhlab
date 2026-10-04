// Pantalla de capítulo (DR11), en tres tiempos: la sección con sus fichas, elegir un experimento o una observación, y registrar en el diario.
// Un capítulo se da por completado al elegir (plan, "Mapa de capítulos").
import "./capitulo.css";
import { chequeoPendiente, cierre, revisada, type EstadoCapitulo, type Ficha, type Respuesta } from "../contenido";
import { t } from "../textos";
import { boton, el } from "./pantalla";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
const fuentes = (f: Ficha) => t("capitulo.fuente", { fuentes: f.fuentes.map((x) => `${x.autor}, ${x.obra}`).join("; ") });

function ficha(f: Ficha, encabezado: string, nivel: "h2" | "h3" = "h3"): HTMLElement {
  const caja = el("article", "ficha", el(nivel, "rotulo", encabezado), el("p", "", f.texto), el("p", "ficha-fuente", fuentes(f)));
  // Lo que Isma todavía no revisó se muestra, pero dicho.
  if (!revisada(f)) caja.append(el("p", "ficha-borrador", t("capitulo.borrador")));
  return caja;
}

export function dibujarCapitulo(o: { titulo: string; fichas: Ficha[]; experimentos: Ficha[]; estado: EstadoCapitulo | null; ia?: Node[]; cambio?: { antes: string; ahora: string } | null; alElegir: (experimento: Ficha) => void; diario: Node }): HTMLElement {
  const panel = el("section", "panel capitulo", el("h2", "capitulo-titulo", o.titulo));
  if (o.cambio) panel.append(el("p", "banner capitulo-cambio", t("capitulo.cambio", o.cambio)));
  // Lo escrito por la IA va arriba; las fichas siguen debajo, tal cual, como respaldo a la vista.
  panel.append(...(o.ia ?? []), ...o.fichas.map((f) => ficha(f, f.tema)));
  const elegido = o.experimentos.find((e) => e.id === o.estado?.experimento);
  const tarjetas = el("div", "capitulo-opciones");
  for (const e of elegido ? [elegido] : o.experimentos) {
    const caja = ficha(e, t(e.clase === "observacion" ? "experimento.clase.observacion" : "experimento.clase.experimento"));
    const sello = o.estado && cierre(o.estado);
    // Al cerrar el experimento, su sello queda en la sección, con cualquiera de las tres respuestas.
    if (sello) caja.append(el("p", "capitulo-sello", t("chequeo.sello", { respuesta: t(`chequeo.${sello.respuesta}`) })));
    caja.append(elegido ? el("p", "capitulo-elegido", t("capitulo.elegido", { fecha: fecha(o.estado!.elegido) })) : boton("boton-principal", t("capitulo.elegir.boton"), () => o.alElegir(e)));
    tarjetas.append(caja);
  }
  panel.append(el("h2", "capitulo-titulo", t(elegido ? "capitulo.completado" : "capitulo.elegir.titulo")), tarjetas, el("p", "ajustes-nota", t("experimento.aviso")), o.diario);
  return panel;
}

// El experimento en curso, con su chequeo de los días 3 y 7 (DR11): tres respuestas y una nota opcional al diario. Sin rachas.
export function dibujarExperimento(o: { id: string; experimento: Ficha; estado: EstadoCapitulo; conNota: boolean; alResponder: (dia: 3 | 7, respuesta: Respuesta, nota: string) => void }): HTMLElement {
  const panel = el("section", "panel capitulo", ficha(o.experimento, t(o.experimento.clase === "observacion" ? "experimento.clase.observacion" : "experimento.clase.experimento"), "h2"));
  const sello = cierre(o.estado);
  panel.append(el("p", "capitulo-elegido", sello ? t("chequeo.sello", { respuesta: t(`chequeo.${sello.respuesta}`) }) : t("capitulo.elegido", { fecha: fecha(o.estado.elegido) })));
  const dia = chequeoPendiente(o.estado);
  if (!dia) return panel;
  const nota = el("textarea", "campo");
  nota.id = o.id;
  const rotulo = el("label", "rotulo-campo", t("chequeo.nota"));
  rotulo.htmlFor = nota.id;
  const respuestas = el("div", "zona-cuenta", ...(["me_representa", "no_me_representa", "no_probe"] as const).map((r) => boton("boton-secundario", t(`chequeo.${r}`), () => o.alResponder(dia, r, nota.value.trim()))));
  panel.append(el("section", "diario", el("h2", "capitulo-titulo", t("chequeo.pregunta")), el("p", "", t("chequeo.dia", { dia })), ...(o.conNota ? [rotulo, nota] : []), respuestas));
  return panel;
}
