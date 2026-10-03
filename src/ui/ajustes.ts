// Ajustes (DR30): una sola pantalla de filas con título de grupo, dentro de un panel.
// Por ahora: Cuenta (con Salir), Tu carta, Diario (si la cuenta tiene uno), Apariencia y Datos (exportar con su pantalla previa, DR43, y borrar cuenta, DR44). IA entra con su función.
// También la pantalla "Tu carta cambió desde otro dispositivo" (DR38).
import "./ajustes.css";
import type { CartaGuardada } from "../almacen";
import type { Cuenta, CuentaApi, Fallo } from "../cuenta-api";
import { t, type TextoId } from "../textos";
import { abrirCodigo, abrirDesbloqueo, codigoPendiente } from "./diario";
import type { Nacimiento } from "./nacimiento";
import { anuncio, boton, completa, el } from "./pantalla";

const TEMA = "dhlab.tema";
export type Tema = "automatico" | "dia" | "noche";
// El tema elegido se guarda en el dispositivo; "automático" sigue al sistema (DR16).
export function aplicarTema(tema: Tema = (localStorage.getItem(TEMA) as Tema | null) ?? "automatico") {
  if (tema === "automatico") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

const fila = (rotulo: TextoId, valor: string) => el("div", "fila", el("dt", "", t(rotulo)), el("dd", "", valor));
const grupo = (titulo: TextoId, ...hijos: Node[]) => el("section", "ajustes-grupo", el("h2", "rotulo", t(titulo)), ...hijos);

const fechaDe = (n: Nacimiento) => new Date(`${n.fecha}T12:00:00Z`).toLocaleDateString("es", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
// La hora con su confiabilidad: exacta, con su margen o desconocida.
const horaDe = (n: Nacimiento) => (n.confiabilidad === "desconocida" ? t("nacimiento.hora.desconocida") : n.confiabilidad === "aproximada" ? `${n.hora} ± ${n.margen} min` : n.hora);

export interface OpcionesAjustes {
  cuenta: Cuenta;
  carta: CartaGuardada;
  api: CuentaApi;
  // Sesión cerrada o cuenta borrada: vuelta a la bienvenida (DR27).
  alSalir: () => void;
  // El diario en este dispositivo: sin clave (todavía no hay diario), abierto o cerrado (DR32).
  diario: { estado: () => Promise<"sin_clave" | "abierto" | "cerrado">; abrir: (codigo: string) => Promise<boolean>; nuevoCodigo: () => Promise<{ codigo: string } | { error: string }> };
  // Lo que hay de la cuenta en este dispositivo, legible, para el archivo de exportación.
  documentos: () => Promise<object[]>;
  // El servidor confirmó el borrado: recién ahí se limpia lo de este dispositivo.
  alBorrar: () => Promise<void>;
}

export function dibujarAjustes({ cuenta, carta, api, alSalir, diario, documentos, alBorrar }: OpcionesAjustes): HTMLElement {
  const exportar = () => abrirExportar(documentos, diario.estado);
  const panel = el("div", "panel ajustes");
  const paises = new Intl.DisplayNames(["es"], { type: "region" });
  const { nacimiento } = carta;
  const fecha = fechaDe(nacimiento);
  const hora = nacimiento.confiabilidad === "desconocida" ? "" : `, ${nacimiento.hora}`;

  const errorSalir = anuncio("error", "alert");
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

  // El grupo Diario aparece cuando la cuenta tiene diario.
  const grupoDiario = grupo("ajustes.grupo.diario");
  grupoDiario.hidden = true;
  const pintarDiario = async () => {
    const estado = await diario.estado();
    grupoDiario.hidden = estado === "sin_clave";
    grupoDiario.replaceChildren(grupoDiario.firstChild!);
    if (estado === "cerrado") return grupoDiario.append(el("p", "", t("diario.cerrado.fila")), boton("boton-secundario", t("diario.cerrado.accion"), () => abrirDesbloqueo(diario.abrir, () => void pintarDiario())));
    if (estado !== "abierto") return;
    // "Generar código nuevo" envuelve la misma clave con otro código: el anterior deja de servir (DR34).
    const error = anuncio("error", "alert");
    const generar = boton("boton-secundario", t("recuperacion.generar_nuevo"), async (b) => {
      b.disabled = true;
      error.textContent = "";
      const r = await diario.nuevoCodigo();
      b.disabled = false;
      // Al cerrar la pantalla del código, la fila dice si quedó guardado o pendiente.
      if ("codigo" in r) return abrirCodigo(r.codigo).addEventListener("close", () => void pintarDiario());
      // Otro dispositivo cambió el código mientras tanto: no se pisa, se ofrece generar otro (Codex #2).
      error.textContent = t(r.error === "reemplazado" ? "recuperacion.reemplazado" : r.error === "sin_red" ? "sync.sin_conexion" : "sync.servidor");
      if (r.error === "reemplazado") b.textContent = t("recuperacion.generar_otro");
    });
    grupoDiario.append(el("p", "", t(codigoPendiente() ? "recuperacion.pendiente.fila" : "ajustes.diario.abierto")), generar, el("p", "ajustes-nota", t("recuperacion.generar_nuevo.aviso")), error);
  };
  void pintarDiario();

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
    grupoDiario,
    grupo("ajustes.grupo.apariencia", temas),
    grupo("ajustes.grupo.datos", boton("boton-secundario", t("ajustes.datos.exportar"), exportar), boton("boton-destructivo", t("ajustes.datos.borrar"), () => confirmarBorrado(api, exportar, alBorrar))),
  );
  return panel;
}

// Borrar cuenta: pantalla completa con qué se borra, exportar primero y el aviso del diario (DR44).
function confirmarBorrado(api: CuentaApi, exportar: () => void, alBorrar: () => Promise<void>) {
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
  const hoja = completa("cuenta.borrar.titulo", (cerrar) => [el("p", "", t("cuenta.borrar.que_se_borra")), el("p", "", t("cuenta.borrar.diario")), boton("boton-secundario", t("cuenta.borrar.exportar"), exportar), error, borrar, boton("boton-link", t("comun.cancelar"), cerrar)]);
}

// Exportar (DR43): pantalla previa con qué incluye; el archivo se arma recién al confirmar.
function abrirExportar(documentos: () => Promise<object[]>, estadoDiario: OpcionesAjustes["diario"]["estado"]) {
  const estado = anuncio("", "status");
  // El diario sale legible; cerrado, no se puede incluir hasta abrirlo.
  const avisoDiario = el("p", "");
  void estadoDiario().then((e) => e !== "sin_clave" && (avisoDiario.textContent = t(e === "abierto" ? "datos.exportar.advertencia" : "datos.exportar.diario_cerrado")));
  const exportar = boton("boton-principal", t("datos.exportar.boton"), async (b) => {
    b.disabled = true;
    estado.textContent = t("datos.exportar.preparando");
    const lista = await documentos();
    b.disabled = false;
    if (!lista.length) return void (estado.textContent = t("datos.exportar.vacio"));
    const enlace = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify({ esquema: 1, documentos: lista }, null, 2)], { type: "application/json" })), download: "dhlab-mis-datos.json" });
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    estado.textContent = t("datos.exportar.listo");
  });
  completa("datos.exportar.titulo", (cerrar) => [el("p", "", t("datos.exportar.incluye")), avisoDiario, exportar, estado, boton("boton-link", t("comun.cerrar"), cerrar)]);
}

// "Tu carta cambió desde otro dispositivo" (DR38): la carta de la cuenta frente a la corrección hecha acá. Lo escrito se conserva hasta elegir.
export function abrirCartaCambio(ahora: Nacimiento, correccion: Nacimiento, alAplicar: () => void, alDejar: () => void) {
  const columna = (titulo: TextoId, n: Nacimiento) => el("section", "", el("h3", "rotulo", t(titulo)), el("p", "", fechaDe(n)), el("p", "", horaDe(n)), el("p", "", n.ciudad?.[0] ?? ""));
  completa("carta_cambio.titulo", (cerrar) => [
    el("div", "carta-cambio", columna("carta_cambio.ahora", ahora), columna("carta_cambio.tu_correccion", correccion)),
    boton("boton-principal", t("carta_cambio.aplicar"), () => (cerrar(), alAplicar())),
    boton("boton-link", t("carta_cambio.dejar"), () => (cerrar(), alDejar())),
  ]);
}
