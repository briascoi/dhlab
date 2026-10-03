// La app: bienvenida, datos de nacimiento, revelación, "Guarda tu carta" y, con la carta guardada, el marco con sus pestañas.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/caveat/index.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "@fontsource/architects-daughter/400.css";
import "./estilos.css";
import "./ui/tintas";
import { abrirAlmacen, borrarAlmacen, contenidoCarta, ID_CARTA, type CartaGuardada } from "./almacen";
import { api, documentosApi, type Cuenta } from "./cuenta-api";
import { motor } from "./motor";
import { crearSync } from "./sync";
import { estallido, flecha, mancha } from "./ui/trazos";
import { t } from "./textos";
import { aplicarTema, dibujarAjustes } from "./ui/ajustes";
import { dibujarConfiguracion } from "./ui/configuracion";
import { abrirCuenta } from "./ui/cuenta";
import { dibujarDetalle } from "./ui/detalle-centro";
import { avisarHoraInexistente, bannerHoraIncierta, dibujarPendienteDeHora, preguntarHoraRepetida } from "./ui/hora";
import { dibujarMapa, rotuloMapa } from "./ui/mapa";
import { dibujarMarco, icono, type Pestana } from "./ui/marco";
import { abrirNacimiento, type Nacimiento } from "./ui/nacimiento";
import { revelar } from "./ui/revelacion";

aplicarTema();
const raiz = document.getElementById("app")!;
const el = <K extends keyof HTMLElementTagNameMap>(nombre: K, clase: string, texto = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(nombre);
  e.className = clase;
  e.textContent = texto;
  return e;
};
const boton = (clase: string, texto: string, alTocar: () => void) => {
  const b = el("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", alTocar);
  return b;
};

let cuenta: Cuenta | undefined;
// Una sola sincronización por cuenta abierta en esta pestaña.
let sync: ReturnType<typeof crearSync> | undefined;
let deQuien = "";
const syncDe = (c: Cuenta) => {
  if (deQuien !== c.email) [sync, deQuien] = [crearSync(abrirAlmacen(c.email), documentosApi, c.modo), c.email];
  return sync!;
};

// Marca de sincronización (DR36): sin marca, todo está confirmado. Las cuentas solo locales no llevan marca.
let pintarMarca: (texto: string | null) => void = () => undefined;
async function sincronizar(): Promise<void> {
  if (!cuenta) return;
  const s = syncDe(cuenta);
  const estado = await s.sincronizar();
  const faltan = await s.pendientes();
  pintarMarca(cuenta.modo !== "nube" || (estado === "al_dia" && !faltan) ? null : t(estado === "sin_red" ? "sync.sin_conexion" : estado === "al_dia" || estado === "sesion_vencida" ? "sync.falta_subir" : "sync.servidor"));
}
// Reintenta sola al volver la red y al volver a la pestaña.
addEventListener("online", () => void sincronizar());
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void sincronizar());

function detalleDeMarca() {
  const hoja = el("dialog", "hoja");
  const titulo = el("h2", "hoja-titulo", t("sync.detalle.titulo"));
  titulo.tabIndex = -1;
  const linea = el("p", "");
  void syncDe(cuenta!).pendientes().then((n) => (linea.textContent = t("sync.detalle.linea", { n })));
  hoja.append(titulo, linea, boton("boton-principal", t("comun.reintentar"), () => (hoja.close(), void sincronizar())), boton("boton-link", t("comun.cerrar"), () => hoja.close()));
  hoja.addEventListener("close", () => hoja.remove());
  document.body.append(hoja);
  hoja.showModal();
  titulo.focus();
}

// Antes del marco: una pantalla por vez dentro de un panel, con lo demás al lado o debajo.
function escena(clase = "panel"): HTMLElement {
  document.querySelectorAll(".saltear, .sonido, .hoja").forEach((e) => e.remove());
  const principal = el("main", "lado-a-lado");
  const panel = el("div", clase);
  principal.append(panel);
  raiz.replaceChildren(principal);
  return panel;
}

function bienvenida() {
  const panel = escena();
  const nombre = el("h1", "nombre");
  nombre.append(el("span", "", "DH Lab"));
  const zona = el("div", "zona-cuenta");
  zona.append(
    boton("boton-principal", t("bienvenida.empezar"), () => formulario()),
    boton("boton-secundario", t("bienvenida.ya_tengo_cuenta"), () => {
      const hoja = abrirCuenta({ api, variante: "entrar", alTerminar: (c) => (hoja.close(), void abrir(c)) });
      hoja.addEventListener("close", () => hoja.remove());
    }),
  );
  panel.append(el("p", "rotulo", "Laboratorio de Diseño Humano"), nombre, el("p", "frase", t("bienvenida.frase")), zona, el("p", "aviso", t("bienvenida.solo_invitacion")));
}

// Con sesión: baja lo de la cuenta y, si ya tiene carta, abre la app; si no, pide los datos de nacimiento.
async function abrir(c: Cuenta) {
  cuenta = c;
  await sincronizar();
  const guardada = await syncDe(c).leer("carta", ID_CARTA);
  if (guardada) return app(JSON.parse(guardada.contenido) as CartaGuardada);
  formulario();
}

function formulario(paso = 1) {
  abrirNacimiento(escena(), (datos) => void alTerminar(datos), paso);
}

async function alTerminar(datos: Nacimiento) {
  const m = await motor();
  const huso = datos.ciudad![4];
  const rango = m.rangoDeNacimiento({ ...datos, huso });
  if (rango.estado === "inexistente") return avisarHoraInexistente(escena(), datos.hora, () => formulario(2));
  if (rango.estado === "repetida") {
    const margen = (datos.confiabilidad === "aproximada" ? datos.margen : m.MARGEN_EXACTA) * 60_000;
    return preguntarHoraRepetida(escena(), datos.hora, rango.opciones, (centro) => void mostrar(datos, centro, new Date(centro.getTime() - margen), new Date(centro.getTime() + margen)));
  }
  if (rango.estado === "listo") await mostrar(datos, rango.centro, rango.inicio, rango.fin);
}

// La carta recién calculada: revelación y último cuadro, con "Guarda tu carta" si todavía no hay cuenta (DR10, DR46).
async function mostrar(datos: Nacimiento, centro: Date, inicio: Date, fin: Date) {
  const m = await motor();
  const analisis = m.analizarRango(inicio, fin);
  if (analisis.estado === "pendiente_de_hora") return dibujarPendienteDeHora(escena(), analisis, datos.ciudad![4], () => formulario(2));
  const panel = escena("panel panel-mapa");
  const carta = contenidoCarta(datos, { centro, inicio, fin }, m.VERSION_TZDB);
  const guardar = async (c: Cuenta) => {
    await syncDe(c).guardar("carta", ID_CARTA, JSON.stringify(carta));
    void sincronizar();
  };
  const configuracion = dibujarConfiguracion(analisis);
  revelar(panel, dibujarMapa(m.calcularCarta(centro).puertas), configuracion, () => {
    if (analisis.estado === "incierta") panel.after(bannerHoraIncierta(() => formulario(2)));
    const cierre = el("p", "tras-carta revelacion-cierre");
    const pedirCuenta = () => {
      const hoja = abrirCuenta({
        api,
        variante: "guardar",
        alTerminar: (nueva) => {
          cuenta = nueva;
          hoja.close();
          cierre.textContent = t("hoja.cierre");
          void guardar(nueva);
        },
      });
      hoja.addEventListener("close", () => hoja.remove());
    };
    // El paso al Capítulo 1: sin cuenta vuelve a abrir "Guarda tu carta"; con cuenta entra a la app por el Libro.
    const paso = boton("tras-carta boton-principal", t("hoja.empezar_capitulo"), () => (cuenta ? void app(carta, "libro") : pedirCuenta()));
    configuracion.after(cierre, paso);
    if (cuenta) void guardar(cuenta);
    else pedirCuenta();
  });
}

const CAPITULOS = 5;
// La pegatina del encabezado: una mancha de tinta de luz con una nota en mayúsculas.
function pegatina(): HTMLElement {
  const p = el("p", "pegatina");
  p.innerHTML = `<svg viewBox="0 0 136 80" preserveAspectRatio="none" aria-hidden="true"><path d="${mancha({ x: 68, y: 40 }, 37, 9)}"/></svg>`;
  // Una oración por renglón.
  const nota = el("span", "anotacion nota");
  nota.append(...t("anotacion.pegatina").split(/(?<=\.) /).flatMap((linea, i) => (i ? [document.createElement("br"), linea] : [linea])));
  p.append(nota);
  return p;
}

const PULSO = { grosor: 2, temblor: 1.2 };
const MEGAFONO = '<svg viewBox="0 0 24 24" aria-hidden="true" class="icono megafono"><path class="tinta2" d="M4 10v4h3l7 4V6l-7 4Z"/><path d="M4 10v4h3l7 4V6l-7 4ZM7 14l1 5h2.500l-1-4.200M17 9.500c1 .7 1 4.300 0 5M19.500 7c2 2 2 8 0 10"/></svg>';
// Qué le toca a cada Tipo, según su Estrategia: responder o iniciar. Tabla confirmada por Isma el 2026-10-03.
// Lo que respalda Jovian Archive es el "sí" de responder en Generadores y el de iniciar en Manifestadores; para Proyectores
// y Reflectores la fuente no usa esas palabras (docs/diseno-humano/base-de-conocimiento.md, "Responder e iniciar").
const ACCION: Record<string, { responder: boolean; iniciar: boolean }> = {
  generador: { responder: true, iniciar: false },
  generador_manifestante: { responder: true, iniciar: false },
  manifestador: { responder: false, iniciar: true },
  proyector: { responder: false, iniciar: false },
  reflector: { responder: false, iniciar: false },
};
// Los dos interruptores bajo los paneles, como en el mockup. Muestran un estado, no se tocan: el valor va escrito, no solo dibujado.
function interruptores(tipo: string): HTMLElement {
  const fila = el("div", "interruptores");
  for (const clave of ["responder", "iniciar"] as const) {
    const prendido = ACCION[tipo]?.[clave] ?? false;
    const caja = el("p", `interruptor ${clave}${prendido ? " prendido" : ""}`);
    caja.append(el("span", "rotulo", `${t(`interruptor.${clave}`)}:`), el("strong", "", t(prendido ? "comun.si" : "comun.no")), el("i", "palanca"));
    fila.append(caja);
  }
  return fila;
}
const trazoDe = (ancho: number, alto: number, f: { cuerpo: string; punta: string }) =>
  `<svg viewBox="0 0 ${ancho} ${alto}" aria-hidden="true"><path class="trazo" d="${f.cuerpo}"/><path class="trazo" d="${f.punta}"/></svg>`;
// Nota en mayúsculas a la derecha del título, con una flecha en arco hacia él.
function notaDelTitulo(): HTMLElement {
  const p = el("p", "anotacion nota", t("anotacion.titulo"));
  p.insertAdjacentHTML("beforeend", trazoDe(46, 30, flecha("arco", { x: 40, y: 6 }, { x: 4, y: 22 }, PULSO, 21)));
  return p;
}
// Notas bajo el panel "Tu configuración": qué es, con una flecha en arco que sube hasta él.
function notasDelPanel(): HTMLElement {
  const notas = el("div", "notas");
  const texto = el("p", "anotacion", t("anotacion.manual"));
  texto.append(el("span", "anotacion nota", t("anotacion.manual.cierre")));
  notas.append(texto);
  notas.insertAdjacentHTML("beforeend", trazoDe(64, 56, flecha("arco", { x: 10, y: 52 }, { x: 44, y: 4 }, PULSO, 17, -1)));
  return notas;
}

// La app con la carta guardada: el marco y sus cuatro pestañas. La carta se recalcula con los datos guardados (R2).
async function app(carta: CartaGuardada, inicial: Pestana = "mapa") {
  const m = await motor();
  const analisis = m.analizarRango(new Date(carta.inicio), new Date(carta.fin));
  const { puertas, tipo } = m.calcularCarta(new Date(carta.instante));
  document.querySelectorAll(".saltear, .sonido, .hoja").forEach((e) => e.remove());
  const marco = dibujarMarco(
    (pestana, contenido) => {
      if (pestana !== "mapa") return contenido.append(el("p", "marco-vacio", t(`${pestana}.vacio`)));
      // Bajo el título, el capítulo en curso y cuántos hay (plan, "Mapa de capítulos"): todavía ninguno completado.
      const capitulo = el("div", "marco-capitulo");
      const barra = el("div", "barra");
      barra.append(Object.assign(el("i", ""), { style: `width: ${100 / CAPITULOS}%` }));
      capitulo.append(el("p", "", t("capitulo.en_curso", { numero: 1, titulo: t("capitulo.1.titulo") })), barra, el("span", "cuenta anotacion", `1/${CAPITULOS}`));
      // Las tarjetas del experimento y del coach, como en el mockup; mientras no existan, dicen su estado vacío.
      const tarjeta = (clase: "experimentos" | "coach", titulo: string) => {
        const caja = el("div", `tarjeta ${clase === "coach" ? "coach" : "experimento"}`);
        caja.innerHTML = icono(clase);
        const texto = el("p", "");
        texto.append(el("strong", "", titulo), t(`${clase}.vacio`));
        caja.append(texto);
        return caja;
      };
      // El sello del experimento (un estallido con nota en mayúsculas) y el megáfono del coach, a la derecha de cada tarjeta.
      const experimento = tarjeta("experimentos", t("experimentos.tarjeta"));
      const sello = el("p", "sello");
      sello.innerHTML = `<svg viewBox="0 0 110 70" preserveAspectRatio="none" aria-hidden="true"><path class="trazo" d="${estallido({ x: 55, y: 35 }, 31, 12, 3)}"/></svg>`;
      sello.append(el("span", "anotacion nota", t("experimentos.sello")));
      experimento.append(sello);
      const coach = tarjeta("coach", t("nav.coach"));
      coach.insertAdjacentHTML("beforeend", MEGAFONO);
      contenido.append(capitulo, experimento, coach);
      const panel = el("div", "panel panel-mapa");
      let detalle: HTMLElement | undefined;
      panel.append(
        rotuloMapa(),
        dibujarMapa(
          puertas,
          (id) => {
            detalle?.remove();
            detalle = dibujarDetalle(id, 1, puertas);
            panel.append(detalle);
          },
          t("anotacion.mapa.empieza"),
        ),
      );
      contenido.append(panel, dibujarConfiguracion(analisis), notasDelPanel(), interruptores(tipo));
      // Con la hora incierta, el aviso queda a la vista; corregirla vuelve al paso de la hora con los datos guardados.
      if (analisis.estado === "incierta") {
        contenido.append(
          bannerHoraIncierta(() => {
            localStorage.setItem("dhlab.nacimiento", JSON.stringify(carta.nacimiento));
            formulario(2);
          }),
        );
      }
    },
    () => {
      const c = cuenta!;
      // Exportar: por ahora, un archivo con lo que hay de la cuenta en este dispositivo (la pantalla previa de DR43 está pendiente).
      const exportar = async () => {
        const documentos = [...(await syncDe(c).listar("carta")), ...(await syncDe(c).listar("libro"))].map(({ tipo, id, contenido }) => ({ tipo, id, contenido: JSON.parse(contenido) as unknown }));
        const enlace = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify({ esquema: 1, documentos }, null, 2)], { type: "application/json" })), download: "dhlab-mis-datos.json" });
        enlace.click();
        URL.revokeObjectURL(enlace.href);
      };
      const alSalir = () => ((cuenta = undefined), (pintarMarca = () => undefined), bienvenida());
      const alBorrar = async () => {
        await borrarAlmacen(c.email);
        for (const clave of ["dhlab.nacimiento", "dhlab.precuenta"]) localStorage.removeItem(clave);
        alSalir();
      };
      marco.mostrar(t("ajustes.titulo"), dibujarAjustes({ cuenta: c, carta, api, alSalir, exportar: () => void exportar(), alBorrar }));
    },
    detalleDeMarca,
    { izquierda: pegatina(), derecha: notaDelTitulo() },
  );
  pintarMarca = marco.marca;
  void sincronizar();
  raiz.replaceChildren(marco.raiz);
  marco.activar(inicial);
}

// Si ya hay sesión, no se pide el código otra vez.
fetch("/v1/cuenta")
  .then((r) => (r.ok ? (r.json() as Promise<{ cuenta?: Cuenta }>) : null))
  .catch(() => null)
  .then((datos) => (datos?.cuenta ? abrir(datos.cuenta) : bienvenida()));
