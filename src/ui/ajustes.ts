// Ajustes (DR30): una sola pantalla de filas con título de grupo, dentro de un panel.
// Por ahora: Cuenta (con Salir), Tu carta, Apariencia y Datos (exportar y borrar cuenta, DR44). Diario e IA entran con sus funciones.
import "./ajustes.css";
import type { CartaGuardada } from "../almacen";
import type { Cuenta, CuentaApi, Fallo } from "../cuenta-api";
import { t, type TextoId } from "../textos";

const TEMA = "dhlab.tema";
export type Tema = "automatico" | "dia" | "noche";
// El tema elegido se guarda en el dispositivo; "automático" sigue al sistema (DR16).
export function aplicarTema(tema: Tema = (localStorage.getItem(TEMA) as Tema | null) ?? "automatico") {
  if (tema === "automatico") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

function el<K extends keyof HTMLElementTagNameMap>(nombre: K, clase = "", ...hijos: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(nombre);
  if (clase) e.className = clase;
  e.append(...hijos);
  return e;
}
const boton = (clase: string, texto: string, alTocar: (b: HTMLButtonElement) => void) => {
  const b = el("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", () => alTocar(b));
  return b;
};
const fila = (rotulo: TextoId, valor: string) => el("div", "fila", el("dt", "", t(rotulo)), el("dd", "", valor));
const grupo = (titulo: TextoId, ...hijos: Node[]) => el("section", "ajustes-grupo", el("h2", "rotulo", t(titulo)), ...hijos);

export interface OpcionesAjustes {
  cuenta: Cuenta;
  carta: CartaGuardada;
  api: CuentaApi;
  // Sesión cerrada o cuenta borrada: vuelta a la bienvenida (DR27).
  alSalir: () => void;
  exportar: () => void;
  // El servidor confirmó el borrado: recién ahí se limpia lo de este dispositivo.
  alBorrar: () => Promise<void>;
}

export function dibujarAjustes({ cuenta, carta, api, alSalir, exportar, alBorrar }: OpcionesAjustes): HTMLElement {
  const panel = el("div", "panel ajustes");
  const paises = new Intl.DisplayNames(["es"], { type: "region" });
  const { nacimiento } = carta;
  const fecha = new Date(`${nacimiento.fecha}T12:00:00Z`).toLocaleDateString("es", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const hora = nacimiento.confiabilidad === "desconocida" ? "" : `, ${nacimiento.hora}`;

  const errorSalir = el("p", "error");
  errorSalir.setAttribute("role", "alert");
  const salir = boton("boton-secundario", t("cuenta.salir"), async (b) => {
    b.disabled = true;
    b.textContent = t("cuenta.saliendo");
    const r = await api.salir();
    if ("ok" in r) return alSalir();
    b.disabled = false;
    b.textContent = t("comun.reintentar");
    errorSalir.textContent = t("cuenta.salir.error");
  });

  const temaActual = (localStorage.getItem(TEMA) as Tema | null) ?? "automatico";
  const temas = el("fieldset", "ajustes-opciones", el("legend", "", t("ajustes.apariencia.tema")));
  for (const tema of ["automatico", "dia", "noche"] as const) {
    const radio = el("input");
    radio.type = "radio";
    radio.name = "tema";
    radio.value = tema;
    radio.checked = tema === temaActual;
    radio.addEventListener("change", () => {
      localStorage.setItem(TEMA, tema);
      aplicarTema(tema);
    });
    temas.append(el("label", "opcion", radio, el("span", "", t(`ajustes.apariencia.${tema}`))));
  }

  panel.append(
    grupo(
      "ajustes.grupo.cuenta",
      el("dl", "", fila("ajustes.cuenta.email", cuenta.email), fila("ajustes.cuenta.donde", t(cuenta.modo === "nube" ? "ajustes.cuenta.donde.nube" : "ajustes.cuenta.donde.local"))),
      salir,
      el("p", "ajustes-nota", t(cuenta.modo === "nube" ? "cuenta.salir.consecuencia" : "cuenta.salir.consecuencia_local")),
      errorSalir,
    ),
    grupo(
      "ajustes.grupo.carta",
      el("dl", "", fila("ajustes.carta.nacimiento", `${fecha}${hora}, ${nacimiento.ciudad?.[0] ?? ""}`), fila("ajustes.carta.pais", paises.of(nacimiento.residencia) ?? nacimiento.residencia)),
    ),
    grupo("ajustes.grupo.apariencia", temas),
    grupo("ajustes.grupo.datos", boton("boton-secundario", t("ajustes.datos.exportar"), exportar), boton("boton-destructivo", t("ajustes.datos.borrar"), () => confirmarBorrado(api, exportar, alBorrar))),
  );
  return panel;
}

// Borrar cuenta: pantalla completa con qué se borra, exportar primero y el aviso del diario (DR44).
function confirmarBorrado(api: CuentaApi, exportar: () => void, alBorrar: () => Promise<void>) {
  const hoja = el("dialog", "hoja completa");
  const titulo = el("h2", "hoja-titulo", t("cuenta.borrar.titulo"));
  titulo.tabIndex = -1;
  const error = el("div", "error");
  error.setAttribute("role", "alert");
  const borrar = boton("boton-destructivo", t("cuenta.borrar.boton"), async (b) => {
    b.disabled = true;
    b.textContent = t("cuenta.borrando");
    error.replaceChildren();
    const r = await api.borrar();
    if ("ok" in r) {
      await alBorrar();
      return hoja.close();
    }
    // Nada de este dispositivo se limpia hasta que el servidor confirme; sin red no se muestra éxito.
    b.disabled = false;
    b.textContent = t("comun.reintentar");
    error.append(
      ...((r as Fallo).error === "sin_red"
        ? [el("p", "", t("cuenta.borrar.sin_red"))]
        : [el("p", "", t("cuenta.borrar.error")), el("p", "", t("cuenta.borrar.error_detalle"))]),
    );
  });
  hoja.append(
    titulo,
    el("p", "", t("cuenta.borrar.que_se_borra")),
    el("p", "", t("cuenta.borrar.diario")),
    boton("boton-secundario", t("cuenta.borrar.exportar"), exportar),
    error,
    borrar,
    boton("boton-link", t("comun.cancelar"), () => hoja.close()),
  );
  hoja.addEventListener("close", () => hoja.remove());
  document.body.append(hoja);
  hoja.showModal();
  titulo.focus();
}
