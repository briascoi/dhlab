// La app: bienvenida, datos de nacimiento, revelación, "Guarda tu carta" y, con la carta guardada, el marco con sus pestañas.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/caveat/index.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "@fontsource/architects-daughter/400.css";
import "./estilos.css";
import "./ui/tintas";
import { abrirAlmacen, borrarAlmacen, contenidoCarta, ID_CARTA, type CartaGuardada } from "./almacen";
import { crearDiario } from "./cifrado";
import { api, claveApi, documentosApi, type Cuenta } from "./cuenta-api";
import { iaApi, type EstadoIA, type Seccion } from "./ia";
import { clavePropia, conectarClave, iaPropia, quitarClave } from "./ia-propia";
import { clasificar, clave, leerArchivo, otraVersion } from "./importar";
import { motor } from "./motor";
import { crearSync } from "./sync";
import { estallido, flecha, mancha } from "./ui/trazos";
import { t, type TextoId } from "./textos";
import { abrirCartaCambio, abrirExportar, aplicarTema, dibujarAjustes } from "./ui/ajustes";
import { dibujarConfiguracion } from "./ui/configuracion";
import { abrirCuenta } from "./ui/cuenta";
import { dibujarDetalle } from "./ui/detalle-centro";
import { capitulo, chequeoPendiente, ESCRITOS, type Atributos, type EstadoCapitulo } from "./contenido";
import { CENTROS } from "./engine/system-data";
import { DEL_TIPO } from "./engine/tipos";
import { dibujarCapitulo, dibujarExperimento } from "./ui/capitulo";
import { abrirCodigo, abrirDiarioCerrado, dibujarDiario, marcarCodigoPendiente, type DiarioCerrado, type Entrada } from "./ui/diario";
import { avisarHoraInexistente, bannerHoraIncierta, dibujarPendienteDeHora, preguntarHoraRepetida } from "./ui/hora";
import { abrirClave, abrirEscritura, conConsentimiento, dibujarCoach, dibujarSeccion } from "./ui/ia";
import { dibujarMapa, rotuloMapa } from "./ui/mapa";
import { dibujarMarco, icono, type Marco, type Pestana } from "./ui/marco";
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
// Una sola sincronización y un solo diario por cuenta abierta en esta pestaña.
let sync: ReturnType<typeof crearSync> | undefined;
let diario: ReturnType<typeof crearDiario> | undefined;
let deQuien = "";
const syncDe = (c: Cuenta) => {
  // Otra cuenta, o la misma con otro modo: la sincronización se arma de nuevo.
  if (deQuien !== `${c.email}:${c.modo}`) {
    const almacen = abrirAlmacen(c.email);
    sync = crearSync(almacen, documentosApi, c.modo);
    diario = crearDiario(almacen, sync, claveApi, c.modo);
    deQuien = `${c.email}:${c.modo}`;
  }
  return sync!;
};

// El marco en pantalla, si la app ya está abierta: ahí van la marca de sincronización y los avisos.
let marco: Marco | undefined;
// Marca de sincronización (DR36): sin marca, todo está confirmado. Las cuentas solo locales no llevan marca.
async function sincronizar(): Promise<void> {
  if (!cuenta) return;
  const s = syncDe(cuenta);
  // El diario registra o lee su clave antes de subir: el servidor solo acepta entradas cifradas con la vigente.
  const estado = await diario!.sincronizar();
  const faltan = await s.pendientes();
  // Otro dispositivo pasó la cuenta a solo local: el servidor ya no acepta contenido. Se vuelve a abrir con el modo nuevo.
  if (estado === "escritura_no_permitida" && cuenta?.modo === "nube") return abrir({ ...cuenta, modo: "local" });
  if (!marco || !cuenta) return;
  marco.marca(cuenta.modo !== "nube" || (estado === "al_dia" && !faltan) ? null : t(estado === "sin_red" ? "sync.sin_conexion" : estado === "al_dia" || estado === "sesion_vencida" ? "sync.falta_subir" : "sync.servidor"));
  avisarSesion(estado === "sesion_vencida");
  await revisarCarta(s);
}
// Sesión vencida: lo que pide acción no va en la marca, va en un banner en línea que lleva a entrar otra vez (DR36).
function avisarSesion(vencida: boolean) {
  const previo = document.querySelector(".banner.sesion");
  if (!vencida) return previo?.remove();
  if (previo) return;
  const banner = el("div", "banner sesion");
  banner.setAttribute("role", "status");
  banner.append(
    boton("boton-link", t("rescate.sesion_vencida"), () => {
      const hoja = abrirCuenta({ api, variante: "entrar", alTerminar: (c) => (hoja.close(), void abrir(c)) });
      hoja.addEventListener("close", () => hoja.remove());
    }),
  );
  marco!.contenido.before(banner);
}
// La corrección de la carta llegó tarde: otro dispositivo la cambió antes. Se elige entre la de la cuenta y la propia, sin reescribir (DR38).
async function revisarCarta(s: ReturnType<typeof crearSync>) {
  const doc = await s.leer("carta", ID_CARTA);
  if (doc?.rechazado === undefined || document.querySelector(".carta-cambio")) return;
  const elegir = async (contenido: string) => {
    await s.guardar("carta", ID_CARTA, contenido);
    void app(JSON.parse(contenido) as CartaGuardada);
  };
  // Los dos dispositivos hicieron la misma corrección: no hay nada que elegir.
  if (doc.rechazado === doc.contenido) return s.guardar("carta", ID_CARTA, doc.contenido);
  const nacimiento = (contenido: string) => (JSON.parse(contenido) as CartaGuardada).nacimiento;
  abrirCartaCambio(nacimiento(doc.contenido), nacimiento(doc.rechazado), () => void elegir(doc.rechazado!), () => void elegir(doc.contenido));
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

const MODO = "dhlab.modo";
let avisoModo: "a_local.otros.banner" | "a_nube.otros.banner" | null = null;
// Lo de la cuenta en este dispositivo, legible: el diario entra descifrado, y solo si está abierto.
async function documentosLegibles(c: Cuenta) {
  const s = syncDe(c);
  const d = diario!;
  const legibles = [...(await s.listar("carta")), ...(await s.listar("libro"))].map(({ tipo, id, contenido }) => ({ tipo, id, contenido: JSON.parse(contenido) as unknown }));
  const entradas = (await d.estado()) === "abierto" ? await Promise.all((await s.listar("diario")).map(async ({ tipo, id }) => ({ tipo, id, contenido: await d.leer(id) }))) : [];
  return [...legibles, ...entradas.filter((e) => e.contenido !== null)];
}
// Importar (DR43): la carta del archivo nunca reemplaza a la de la cuenta (si difiere, se elige en la pantalla de DR38);
// un capítulo que ya existe se conserva; una entrada del diario que choca queda como otra versión, al lado de la original (DR37).
async function importar(c: Cuenta, texto: string) {
  const s = syncDe(c);
  const d = diario!;
  const leido = leerArchivo(texto);
  if ("error" in leido) return leido;
  // Con el diario cerrado, sus entradas esperan a que se abra.
  const diarioCerrado = ["cerrado", "anterior"].includes(await d.estado()) && leido.piezas.some((p) => p.tipo === "diario");
  const piezas = diarioCerrado ? leido.piezas.filter((p) => p.tipo !== "diario") : leido.piezas;
  const locales = new Map<string, string>();
  for (const doc of [...(await s.listar("carta")), ...(await s.listar("libro"))]) locales.set(clave(doc), doc.contenido);
  for (const doc of await s.listar("diario")) locales.set(clave(doc), (await d.leer(doc.id)) ?? "null");
  const { nuevo, existe, conflicto } = clasificar(piezas, locales);
  const aplicar = async () => {
    const entradas = [...nuevo, ...conflicto.map(otraVersion)].filter((p) => p.tipo === "diario");
    // Lo importado se cifra con la clave del diario; si no había, se crea y al final se muestra su código (DR34).
    const codigo = entradas.length && (await d.estado()) === "sin_clave" ? await d.crear() : null;
    for (const p of nuevo.filter((x) => x.tipo !== "diario")) await s.guardar(p.tipo, p.id, p.contenido);
    for (const p of entradas) await d.escribir(p.id, p.contenido);
    for (const p of conflicto.filter((x) => x.tipo === "carta")) await s.proponer(p.tipo, p.id, p.contenido);
    await sincronizar();
    if (codigo && c.modo === "nube" && (await d.estado()) === "abierto") abrirCodigo(codigo);
  };
  return { nuevo: nuevo.length, existe: existe.length, conflicto: conflicto.length, diarioCerrado, aplicar };
}

// En otro dispositivo de una cuenta que pasó a solo local: lo que hay acá se queda acá y, si había cambios sin subir, se ofrece exportarlos (CEO2-O4).
async function avisarModo(c: Cuenta) {
  if (!avisoModo || !marco) return;
  const aviso = avisoModo;
  avisoModo = null;
  const banner = el("div", "banner");
  banner.setAttribute("role", "status");
  banner.append(el("p", "", t(aviso)));
  if (aviso === "a_local.otros.banner" && (await syncDe(c).pendientes())) banner.append(el("p", "", t("a_local.otros.exportar")), boton("boton-link", t("ajustes.datos.exportar"), () => abrirExportar(() => documentosLegibles(c), diario!.estado)));
  marco.contenido.before(banner);
}
// Nube a solo local (DR39): sube lo pendiente, baja y verifica pieza por pieza, y recién ahí el servidor borra su copia (CEO2-O4).
// Se puede repetir: si el cambio ya se hizo y la respuesta se perdió, la consulta del principio lo encuentra hecho (Codex #5).
async function pasarALocal(etapa: (texto: string) => void): Promise<"listo" | "sin_red" | "fallo" | "sin_confirmar"> {
  const c = cuenta!;
  const terminar = () => {
    cuenta = { ...c, modo: "local" };
    localStorage.setItem(MODO, `${c.email}:local`);
    syncDe(cuenta);
    marco?.marca(null);
    return "listo" as const;
  };
  // El modo de la cuenta en el servidor; "otro" si respondió sin la cuenta (sesión vencida) y null si no respondió.
  const enServidor = () => fetch("/v1/cuenta").then((r) => r.json() as Promise<{ cuenta?: Cuenta }>).then((r) => r.cuenta?.modo ?? "otro", () => null);
  const modo = await enServidor();
  if (modo === null) return "sin_red";
  if (modo === "otro") return "fallo";
  if (modo === "local") return terminar();
  etapa(t("a_local.etapa.subiendo"));
  const estado = await diario!.sincronizar();
  if (estado === "sin_red") return "sin_red";
  if ((estado !== "al_dia" && estado !== "clave_reemplazada") || (await syncDe(c).pendientes())) return "fallo";
  const r = await documentosApi.listar();
  if (!("documentos" in r)) return r.error === "sin_red" ? "sin_red" : "fallo";
  let hechas = 0;
  etapa(t("a_local.etapa.bajando", { hechas, total: r.documentos.length }));
  for (const d of r.documentos) {
    const local = await syncDe(c).leer(d.tipo, d.id);
    if (local?.contenido !== d.contenido || local.rechazado !== undefined) return "fallo";
    etapa(t("a_local.etapa.bajando", { hechas: ++hechas, total: r.documentos.length }));
  }
  etapa(t("a_local.etapa.borrando"));
  const cambio = await api.cambiarModo("local");
  if ("cuenta" in cambio) return terminar();
  if (cambio.error !== "sin_red") return "fallo";
  // La respuesta no llegó: antes de decir nada, se consulta cómo quedó la cuenta.
  etapa(t("almacenamiento.comprobando"));
  const quedo = await enServidor();
  return quedo === "local" ? terminar() : quedo === "nube" ? "fallo" : "sin_confirmar";
}

// Solo local a la nube (DR39): el servidor cambia el modo antes de la primera subida y este dispositivo sube todo lo suyo como nuevo.
// Si la subida se corta, la cuenta ya está en la nube y lo que falta sigue en la cola, que se reintenta sola.
async function pasarALaNube(etapa: (texto: string) => void): Promise<"listo" | "parcial" | "sin_red" | "fallo"> {
  const c = cuenta!;
  const r = await api.cambiarModo("nube");
  if (!("cuenta" in r)) return r.error === "sin_red" ? "sin_red" : "fallo";
  cuenta = { ...c, modo: "nube" };
  const s = syncDe(cuenta);
  await s.subirTodo();
  localStorage.setItem(MODO, `${c.email}:nube`);
  const total = await s.pendientes();
  etapa(t("a_nube.subiendo", { hechas: 0, total }));
  await sincronizar();
  const faltan = await s.pendientes();
  etapa(t("a_nube.subiendo", { hechas: total - faltan, total }));
  return faltan ? "parcial" : "listo";
}

// Con sesión: baja lo de la cuenta y, si ya tiene carta, abre la app; si no, pide los datos de nacimiento.
async function abrir(c: Cuenta) {
  cuenta = c;
  // El modo con el que este dispositivo conocía la cuenta: si era nube y ahora es local, el cambio se hizo en otro lado (DR39).
  const antes = localStorage.getItem(MODO);
  if (antes === `${c.email}:nube` && c.modo === "local") avisoModo = "a_local.otros.banner";
  // Al revés, la cuenta pasó a la nube desde otro dispositivo: este sube lo suyo, y los choques siguen las reglas de siempre (E4-otrosdisp).
  if (antes === `${c.email}:local` && c.modo === "nube") {
    await syncDe(c).subirTodo();
    avisoModo = "a_nube.otros.banner";
  }
  localStorage.setItem(MODO, `${c.email}:${c.modo}`);
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

// Lo que necesitan las pantallas del diario cerrado; cada cambio termina con una sincronización.
const diarioCerrado = (): DiarioCerrado => {
  const d = diario!;
  const yLuego = <T>(p: Promise<T>) => p.finally(() => void sincronizar());
  return {
    estado: d.estado,
    abrir: (codigo) => yLuego(d.abrir(codigo)),
    empezarNuevo: () => yLuego(d.empezarNuevo()),
    descartarAnterior: d.descartarAnterior,
    conSinSubir: async () => (await sync!.listar("diario")).some((e) => e.sinSubir),
  };
};
function filaDiarioCerrado(alAbrir: () => void): HTMLElement {
  const fila = el("div", "banner");
  fila.append(el("p", "", t("diario.cerrado.fila")), boton("boton-link", t("diario.cerrado.accion"), () => void abrirDiarioCerrado(diarioCerrado(), alAbrir)));
  return fila;
}

// Un capítulo de la cuenta abierta: su contenido para esta carta, lo guardado en el Libro y cómo escribir en el diario.
async function capituloDe(n: number, a: Atributos) {
  const s = syncDe(cuenta!);
  const d = diario!;
  const id = `capitulo-${n}`;
  const guardado = await s.leer("libro", id);
  const previo = guardado ? (JSON.parse(guardado.contenido) as EstadoCapitulo) : null;
  // El atributo al que se refiere lo que se guarde, para cuando una corrección de la carta lo cambie (R12).
  const atributo =
    n === 1 ? `${t("configuracion.estrategia")}: ${t(`estrategia.${DEL_TIPO[a.tipo].estrategia}` as TextoId)}` : n === 2 ? `${t("configuracion.autoridad")}: ${t(`autoridad.${a.autoridad}` as TextoId)}` : n === 3 ? `${t("configuracion.perfil")}: ${a.perfil}` : n === 4 ? `${t("configuracion.centros")}: ${a.centros.map((c) => CENTROS[c]).join(", ") || "0"}` : `${t("configuracion.canales")}: ${a.canales.join(", ") || "0"}`;
  return {
    ...capitulo(n, a)!,
    n,
    s,
    d,
    atributo,
    // Si una corrección de la carta cambió el atributo, el capítulo se abre otra vez: lo elegido antes ya no cuenta, y se avisa con el antes y el después (R12).
    estado: previo?.atributo === atributo ? previo : null,
    cambio: previo && previo.atributo !== atributo ? { antes: previo.atributo, ahora: atributo } : null,
    guardar: async (estado: EstadoCapitulo) => {
      await s.guardar("libro", id, JSON.stringify(estado));
      void sincronizar();
    },
    // Guarda la entrada; devuelve el código de recuperación si con ella nació el diario y su clave ya quedó registrada en la cuenta (DR34).
    escribir: async (texto: string) => {
      const codigo = (await d.estado()) === "sin_clave" ? await d.crear() : null;
      await d.escribir(crypto.randomUUID(), JSON.stringify({ texto, fecha: new Date().toISOString(), capitulo: n, atributo } satisfies Omit<Entrada, "id">));
      await sincronizar();
      // Una sincronización que ya venía en curso pudo terminar antes de ver esta entrada: se repite una vez.
      if (await s.pendientes()) await sincronizar();
      if (!codigo || cuenta?.modo !== "nube") return null;
      // Si otro dispositivo registró su clave antes, rige la de ese y este código no sirve (E3-dosclaves).
      if ((await d.estado()) !== "abierto") return null;
      if (!(await s.pendientes())) return codigo;
      // La clave todavía no llegó a la cuenta (sin red): el código no se muestra ahora, y queda el recordatorio para generar uno.
      marcarCodigoPendiente();
      return null;
    },
  };
}
// La IA incluida: su estado se lee al abrir la app y después de cada uso. Sin configurar en el servidor, la app sigue igual que sin IA.
let estadoIA: EstadoIA | null = null;
const leerEstadoIA = async () => {
  const r = await iaApi.estado();
  estadoIA = "error" in r ? null : r;
};
// Con una clave propia conectada, la IA va directo de este navegador a OpenRouter; si no, por la incluida.
const iaActiva = () => {
  const clave = clavePropia();
  return clave ? iaPropia(clave) : iaApi;
};
const hayIA = () => Boolean(clavePropia()) || Boolean(estadoIA?.configurada);
// Con clave propia no rige el tope de la IA incluida.
const SIN_TOPE: EstadoIA = { configurada: true, usado: 0, tope: Infinity, pausa: false, renovacion: "", reserva: { capitulo: 0, mensaje: 0 } };
// El tema de cada ficha de esta carta, para decir de dónde sale cada afirmación generada.
const temas = (a: Atributos) => {
  const mapa = new Map([1, 2, 3, 4, 5].flatMap((n) => capitulo(n, a)?.fichas ?? []).map((f) => [f.id, f.tema]));
  return (id: string) => mapa.get(id) ?? id;
};

// Los capítulos abiertos, en orden: el primero, y cada siguiente cuando el anterior está completado (elegido su experimento).
async function abiertos(a: Atributos) {
  const lista: Awaited<ReturnType<typeof capituloDe>>[] = [];
  for (let n = 1; n <= ESCRITOS; n++) {
    lista.push(await capituloDe(n, a));
    // Un capítulo reabierto por una corrección no cierra los que ya estaban abiertos: el resto del progreso queda intacto.
    if (!lista.at(-1)!.estado && !lista.at(-1)!.cambio) break;
  }
  return lista;
}

// El Libro: los capítulos abiertos, cada uno con sus fichas, lo elegido para probar y sus entradas del diario junto a la sección.
async function libro(a: Atributos, contenido: HTMLElement, repintar: () => void) {
  const lista = await abiertos(a);
  for (const c of lista) {
    const zonaDiario = dibujarDiario(
      {
        id: `diario-${c.n}`,
        atributo: c.atributo,
        estado: c.d.estado,
        entradas: async () =>
          (await Promise.all((await c.s.listar("diario")).map(async ({ id }) => ({ id, texto: await c.d.leer(id) }))))
            .flatMap(({ id, texto }) => (texto === null ? [] : [{ ...(JSON.parse(texto) as Omit<Entrada, "id">), id }]))
            .filter((e) => e.capitulo === c.n),
        escribir: c.escribir,
        quedarse: async ({ id, versionDe: _v, ...resto }) => {
          await c.d.escribir(id, JSON.stringify(resto));
          void sincronizar();
        },
      },
      () => filaDiarioCerrado(repintar),
    );
    // La sección escrita por la IA, si la hay, y el botón para escribirla; desactualizada si cambió la versión de alguna de sus fichas.
    const ia: Node[] = [];
    const guardada = await c.s.leer("libro", `seccion-${c.n}`);
    if (guardada) {
      const seccion = JSON.parse(guardada.contenido) as Seccion;
      const vigente = new Map(c.fichas.map((f) => [f.id, f.version]));
      ia.push(dibujarSeccion(seccion, temas(a), seccion.fichas.some((f) => vigente.get(f.id) !== f.version)));
    }
    if (hayIA()) {
      const estado = clavePropia() ? SIN_TOPE : estadoIA!;
      ia.push(
        boton("boton-secundario", t(guardada ? "ia.capitulo.reescribir" : "ia.capitulo.escribir"), () =>
          conConsentimiento(() =>
            abrirEscritura(
              estado,
              (senal) => iaActiva().capitulo(c.n, a, senal),
              async (r) => {
                // Solo se guarda un capítulo que pasó las verificaciones: uno incompleto nunca queda como estable.
                await c.s.guardar("libro", `seccion-${c.n}`, JSON.stringify({ ...(r as Omit<Seccion, "esquema" | "escrita">), esquema: 1, escrita: new Date().toISOString() } satisfies Seccion));
                void sincronizar();
                await leerEstadoIA();
                repintar();
              },
            ),
          ),
        ),
      );
    }
    contenido.append(
      dibujarCapitulo({
        ia,
        titulo: t("capitulo.en_curso", { numero: c.n, titulo: t(`capitulo.${c.n}.titulo` as TextoId) }),
        fichas: c.fichas,
        experimentos: c.experimentos,
        estado: c.estado,
        cambio: c.cambio,
        alElegir: async (e) => {
          await c.guardar({ esquema: 1, experimento: e.id, elegido: new Date().toISOString(), atributo: c.atributo, fichas: [...c.fichas, e].map(({ id, version }) => ({ id, version })) });
          repintar();
        },
        diario: zonaDiario,
      }),
    );
  }
  // El que sigue, todavía cerrado: su nombre y qué lo abre, sin contenido.
  const sigue = lista.length + 1;
  if ((lista.at(-1)!.estado || lista.at(-1)!.cambio) && sigue <= CAPITULOS) contenido.append(el("p", "marco-vacio", t("capitulo.bloqueado", { numero: sigue, titulo: t(`capitulo.${sigue}.titulo` as TextoId) })));
}

// El coach: responde con las fichas de esta carta. Antes del primer uso pide el consentimiento; lo conversado no se guarda.
async function pantallaCoach(a: Atributos, contenido: HTMLElement, repintar: () => void) {
  if (!localStorage.getItem("dhlab.ia_consentida")) {
    return void contenido.append(el("p", "marco-vacio", t("ia.consentimiento.que_recibe")), boton("boton-principal", t("ia.consentimiento.titulo"), () => conConsentimiento(repintar)));
  }
  const estado = clavePropia() ? SIN_TOPE : estadoIA!;
  if (estado.pausa) contenido.append(el("p", "banner", `${t("ia.pausa")}.`));
  else if (estado.usado > estado.tope * 0.8) contenido.append(el("p", "banner", t("ia.banner.cerca")));
  const puedeAnotar = ["abierto", "sin_clave"].includes(await diario!.estado());
  contenido.append(
    dibujarCoach({
      temaDe: temas(a),
      preguntar: async (texto, historial) => {
        const r = await iaActiva().mensaje(texto, historial, a);
        void leerEstadoIA();
        return r;
      },
      // "Anotar en mi diario": la respuesta queda en el diario de este dispositivo, cifrada; el diario nunca se le manda a la IA (R19).
      ...(puedeAnotar
        ? {
            anotar: async (texto: string) => {
              const codigo = await (await abiertos(a)).at(-1)!.escribir(texto);
              if (codigo) abrirCodigo(codigo);
            },
          }
        : {}),
    }),
  );
}

// Experimentos: lo que la persona eligió probar en cada capítulo y, los días 3 y 7, el chequeo "¿cómo te fue?" (DR11). Devuelve false si todavía no eligió nada.
async function experimentos(a: Atributos, contenido: HTMLElement, repintar: () => void): Promise<boolean> {
  const abierto = ["abierto", "sin_clave"].includes(await diario!.estado());
  let hay = false;
  // El más reciente arriba.
  for (const c of (await abiertos(a)).reverse()) {
    const experimento = c.experimentos.find((e) => e.id === c.estado?.experimento);
    if (!c.estado || !experimento) continue;
    const estado = c.estado;
    hay = true;
    contenido.append(
      dibujarExperimento({
        id: `chequeo-${c.n}`,
        experimento,
        estado,
        conNota: abierto,
        alResponder: async (dia, respuesta, nota) => {
          await c.guardar({ ...estado, chequeos: [...(estado.chequeos ?? []), { dia, respuesta, fecha: new Date().toISOString() }] });
          const codigo = nota ? await c.escribir(nota) : null;
          if (codigo) abrirCodigo(codigo);
          repintar();
        },
      }),
    );
  }
  return hay;
}

// La app con la carta guardada: el marco y sus cuatro pestañas. La carta se recalcula con los datos guardados (R2).
async function app(carta: CartaGuardada, inicial: Pestana = "mapa") {
  // La carta se guardó con una versión más nueva de la app (otro dispositivo ya actualizado): no se interpreta, se pide actualizar (R4).
  if ((carta.esquema as number) > 1) return void escena().append(el("h1", "frase", t("rescate.esquema_nuevo")), boton("boton-principal", t("comun.reintentar"), () => location.reload()));
  const m = await motor();
  const analisis = m.analizarRango(new Date(carta.inicio), new Date(carta.fin));
  const { puertas, tipo, autoridad, perfil, centros, definicion, canales } = m.calcularCarta(new Date(carta.instante));
  // Los Canales, con la Puerta menor primero y en orden: así se llaman sus fichas.
  const idsDeCanales = canales.map((c) => [...c.puertas].sort((x, y) => x - y)).sort((x, y) => x[0]! - y[0]! || x[1]! - y[1]!).map((p) => p.join("-"));
  const atributos: Atributos = { tipo, autoridad, perfil: perfil.join("/"), centros, definicion, canales: idsDeCanales };
  // Cuántos capítulos tiene abiertos la persona: de eso depende qué muestra el mapa al tocar un Centro (candado o detalle).
  let capitulosAbiertos = 1;
  document.querySelectorAll(".saltear, .sonido, .hoja").forEach((e) => e.remove());
  // Corregir la carta: el formulario arranca con los datos guardados; al terminar, la carta nueva reemplaza a la anterior.
  const corregir = (paso: number) => {
    localStorage.setItem("dhlab.nacimiento", JSON.stringify(carta.nacimiento));
    formulario(paso);
  };
  const nuevo = dibujarMarco(
    (pestana, contenido) => {
      if (pestana === "libro" && ESCRITOS) return void libro(atributos, contenido, () => nuevo.activar("libro"));
      if (pestana === "coach" && hayIA()) return void pantallaCoach(atributos, contenido, () => nuevo.activar("coach"));
      if (pestana !== "mapa") {
        const vacio = el("p", "marco-vacio", t(`${pestana}.vacio`));
        // Con algo elegido, Experimentos lo muestra con su chequeo; sin nada, queda el estado vacío.
        if (pestana === "experimentos" && ESCRITOS) return void experimentos(atributos, contenido, () => nuevo.activar("experimentos")).then((hay) => hay || contenido.append(vacio));
        contenido.append(vacio);
        // Sin la clave en este navegador, el Libro se lee normal y donde van las entradas hay una fila para escribir el código (DR32).
        if (pestana === "libro") void diario!.estado().then((estado) => (estado === "cerrado" || estado === "anterior") && vacio.isConnected && contenido.append(filaDiarioCerrado(() => nuevo.activar("libro"))));
        return;
      }
      // Bajo el título, el capítulo en curso y cuántos hay (plan, "Mapa de capítulos"): todavía ninguno completado.
      const franja = el("div", "marco-capitulo");
      const barra = el("div", "barra");
      barra.append(Object.assign(el("i", ""), { style: `width: ${100 / CAPITULOS}%` }));
      const enCurso = el("p", "", t("capitulo.en_curso", { numero: 1, titulo: t("capitulo.1.titulo") }));
      const cuenta = el("span", "cuenta anotacion", `1/${CAPITULOS}`);
      franja.append(enCurso, barra, cuenta);
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
      // Al volver a la app, si toca un chequeo, la tarjeta lo pregunta y lleva a Experimentos (plan, "Volver sin servidor").
      if (ESCRITOS) {
        void abiertos(atributos).then((lista) => {
          // El capítulo en curso es el último abierto, y la barra avanza con él.
          capitulosAbiertos = lista.length;
          const pendiente = lista.find((x) => !x.estado);
          const actual = pendiente ? pendiente.n : Math.min(lista.length + 1, CAPITULOS);
          enCurso.textContent = t("capitulo.en_curso", { numero: actual, titulo: t(`capitulo.${actual}.titulo` as TextoId) });
          cuenta.textContent = `${actual}/${CAPITULOS}`;
          (barra.firstElementChild as HTMLElement).style.width = `${(100 * actual) / CAPITULOS}%`;
          // La tarjeta muestra lo último que se eligió probar.
          const c = [...lista].reverse().find((x) => x.estado);
          const elegido = c?.experimentos.find((e) => e.id === c.estado?.experimento);
          if (!elegido || !c?.estado) return;
          experimento.querySelector("p")!.replaceChildren(el("strong", "", t("experimentos.tarjeta")), elegido.texto);
          if (chequeoPendiente(c.estado)) experimento.querySelector("p")!.append(" ", boton("boton-link", t("chequeo.pregunta"), () => nuevo.activar("experimentos", true)));
        });
      }
      const sello = el("p", "sello");
      sello.innerHTML = `<svg viewBox="0 0 110 70" preserveAspectRatio="none" aria-hidden="true"><path class="trazo" d="${estallido({ x: 55, y: 35 }, 31, 12, 3)}"/></svg>`;
      sello.append(el("span", "anotacion nota", t("experimentos.sello")));
      experimento.append(sello);
      const coach = tarjeta("coach", t("nav.coach"));
      coach.insertAdjacentHTML("beforeend", MEGAFONO);
      contenido.append(franja, experimento, coach);
      const panel = el("div", "panel panel-mapa");
      let detalle: HTMLElement | undefined;
      panel.append(
        rotuloMapa(),
        dibujarMapa(
          puertas,
          (id) => {
            detalle?.remove();
            detalle = dibujarDetalle(id, capitulosAbiertos, puertas);
            panel.append(detalle);
          },
          t("anotacion.mapa.empieza"),
        ),
      );
      contenido.append(panel, dibujarConfiguracion(analisis), notasDelPanel(), interruptores(tipo));
      // Con la hora incierta, el aviso queda a la vista; corregirla vuelve al paso de la hora con los datos guardados.
      if (analisis.estado === "incierta") {
        contenido.append(
          bannerHoraIncierta(() => corregir(2)),
        );
      }
    },
    () => {
      // La cuenta se lee al abrir Ajustes: puede haber cambiado de modo.
      const c = cuenta!;
      syncDe(c);
      const d = diario!;
      const documentos = () => documentosLegibles(c);
      // Si otro dispositivo cambió el código, se baja la revisión nueva para poder generar otro.
      const nuevoCodigo = async () => {
        const r = await d.nuevoCodigo();
        if ("error" in r && r.error === "reemplazado") await d.sincronizar();
        return r;
      };
      const alSalir = () => ((cuenta = undefined), (marco = undefined), bienvenida());
      const alBorrar = async () => {
        await borrarAlmacen(c.email);
        for (const clave of ["dhlab.nacimiento", "dhlab.precuenta", "dhlab.codigo_pendiente", "dhlab.clave_openrouter", MODO]) localStorage.removeItem(clave);
        alSalir();
      };
      nuevo.mostrar(t("ajustes.titulo"), dibujarAjustes({ cuenta: c, carta, api, alSalir, ia: estadoIA, clave: ESCRITOS ? { conectada: Boolean(clavePropia()), conectar: (alConectar) => abrirClave(conectarClave, alConectar), desconectar: quitarClave } : null, alCorregir: () => corregir(1), importar: (texto) => importar(c, texto), diario: { estado: d.estado, escribirCodigo: (alCambiar) => void abrirDiarioCerrado(diarioCerrado(), alCambiar), nuevoCodigo }, documentos, alBorrar, pasarALocal, pasarALaNube }));
    },
    detalleDeMarca,
    { izquierda: pegatina(), derecha: notaDelTitulo() },
  );
  marco = nuevo;
  raiz.replaceChildren(nuevo.raiz);
  // El estado de la IA se necesita antes de pintar: de eso depende que el Libro y el coach la ofrezcan.
  await leerEstadoIA();
  nuevo.activar(inicial);
  void sincronizar();
  void avisarModo(cuenta!);
}

// Si ya hay sesión, no se pide el código otra vez.
fetch("/v1/cuenta")
  .then((r) => (r.ok ? (r.json() as Promise<{ cuenta?: Cuenta }>) : null))
  .catch(() => null)
  .then((datos) => (datos?.cuenta ? abrir(datos.cuenta) : bienvenida()));
