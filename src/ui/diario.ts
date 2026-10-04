// Pantallas del diario (T72): el código de recuperación (DR34) y abrir el diario en un navegador que no tiene su clave (DR32).
import { t } from "../textos";
import { anuncio, boton, completa, el } from "./pantalla";

// "Ahora no" deja pendiente guardar el código; el código no se guarda en ningún lado, así que completarlo es generar uno nuevo (E4-codigo).
const PENDIENTE = "dhlab.codigo_pendiente";
export const codigoPendiente = () => localStorage.getItem(PENDIENTE) !== null;
// El diario nació pero su código no se pudo mostrar (sin red, por ejemplo): queda el recordatorio, que lleva a generar uno.
export const marcarCodigoPendiente = () => localStorage.setItem(PENDIENTE, "1");
const soloHex = (s: string) => s.replace(/[^0-9a-f]/gi, "").toUpperCase();

// El código como texto real, con Copiar y Compartir; para terminar hay que escribir el último grupo.
export function abrirCodigo(codigo: string): HTMLDialogElement {
  localStorage.setItem(PENDIENTE, "1");
  const aviso = anuncio("estado", "status");
  const copiar = boton("boton-secundario", t("recuperacion.copiar"), () =>
    void navigator.clipboard.writeText(codigo).then(
      () => (aviso.textContent = t("recuperacion.copiado")),
      () => (aviso.textContent = t("recuperacion.copiar_fallo")),
    ),
  );
  const acciones = el("div", "zona-cuenta", copiar);
  if ("share" in navigator) acciones.append(boton("boton-secundario", t("recuperacion.compartir"), () => void navigator.share({ text: codigo }).catch(() => undefined)));

  const campo = el("input", "campo codigo");
  Object.assign(campo, { id: "recuperacion-grupo", type: "text", maxLength: 4, autocomplete: "off", spellcheck: false });
  campo.setAttribute("autocapitalize", "characters");
  campo.setAttribute("aria-describedby", "recuperacion-error");
  const rotulo = el("label", "rotulo-campo", t("recuperacion.comprobar.rotulo"));
  rotulo.htmlFor = campo.id;
  const error = anuncio("error", "alert");
  error.id = "recuperacion-error";
  return completa("recuperacion.titulo", (cerrar) => [
    el("p", "", t("recuperacion.explicacion")),
    el("p", "codigo-recuperacion", codigo),
    acciones,
    aviso,
    rotulo,
    campo,
    error,
    boton("boton-principal", t("recuperacion.listo"), () => {
      // Un último grupo equivocado no cierra la pantalla.
      if (soloHex(campo.value) !== codigo.slice(-4)) return void (error.textContent = t("recuperacion.comprobar.error"));
      localStorage.removeItem(PENDIENTE);
      cerrar();
    }),
    boton("boton-link", t("recuperacion.ahora_no"), cerrar),
  ]);
}

export interface DiarioCerrado {
  estado: () => Promise<string>;
  abrir: (codigo: string) => Promise<boolean>;
  empezarNuevo: () => Promise<{ codigo: string } | { error: string }>;
  descartarAnterior: () => Promise<unknown>;
  // Este dispositivo tiene entradas que el servidor rechazó porque la clave se reemplazó (E4-reemplazo).
  conSinSubir: () => Promise<boolean>;
}

// La puerta del diario cerrado: si este dispositivo guarda el diario anterior, primero se elige qué hacer con él (E4-diarioviejo).
export async function abrirDiarioCerrado(d: DiarioCerrado, alCambiar: () => void) {
  if ((await d.estado()) !== "anterior") return abrirDesbloqueo(d, alCambiar);
  completa("diario.anterior.titulo", (cerrar) => [
    el("p", "", t("diario.anterior.explicacion")),
    boton("boton-principal", t("diario.anterior.recuperar"), () => (cerrar(), void abrirDesbloqueo(d, alCambiar))),
    boton("boton-secundario", t("diario.anterior.descartar"), async () => {
      await d.descartarAnterior();
      cerrar();
      alCambiar();
    }),
  ]);
}

// Abrir el diario: un solo campo que prueba el código en cuanto está completo. Un código que no abre no bloquea.
// "No tengo el código" da dos salidas: generar uno desde otro dispositivo, o empezar un diario nuevo, que es destructivo y pide confirmación (DR32).
async function abrirDesbloqueo(d: DiarioCerrado, alAbrir: () => void) {
  // El código entero no entra en un renglón de celular: va en dos, igual que se muestra al guardarlo.
  const campo = el("textarea", "campo codigo-recuperacion");
  Object.assign(campo, { id: "diario-codigo", rows: 2, autocomplete: "off", spellcheck: false });
  campo.setAttribute("autocapitalize", "characters");
  campo.setAttribute("aria-describedby", "diario-estado");
  const rotulo = el("label", "rotulo-campo", t("diario.desbloqueo.rotulo"));
  rotulo.htmlFor = campo.id;
  const estado = anuncio("error", "alert");
  estado.id = "diario-estado";
  const salidas = el("div", "salidas");
  const confirmar = () => {
    const error = anuncio("error", "alert");
    const confirmacion = completa("diario.nuevo", (cerrar) => [
      el("p", "", t("diario.nuevo.confirmacion")),
      error,
      boton("boton-destructivo", t("diario.nuevo.boton"), async (b) => {
        b.disabled = true;
        const r = await d.empezarNuevo();
        b.disabled = false;
        // Otro dispositivo cambió la clave mientras tanto: se vuelve a la pantalla del código, ya con el estado nuevo.
        if ("error" in r && r.error === "conflicto") return confirmacion.close();
        if ("error" in r) return void (error.textContent = t(r.error === "sin_red" ? "sync.sin_conexion" : "sync.servidor"));
        confirmacion.close();
        hoja.close();
        abrirCodigo(r.codigo).addEventListener("close", alAbrir);
      }),
      boton("boton-link", t("comun.cancelar"), cerrar),
    ]);
  };
  const noTengo = boton("boton-link", t("diario.no_tengo_codigo"), () => salidas.replaceChildren(el("p", "", t("diario.no_tengo.otro_dispositivo")), boton("boton-destructivo", t("diario.nuevo"), confirmar)));
  const nota = (await d.conSinSubir()) ? [el("p", "", t("diario.clave_reemplazada"))] : [];
  const hoja = completa("diario.desbloqueo.titulo", () => [...nota, rotulo, campo, estado, noTengo, salidas]);
  campo.addEventListener("input", async () => {
    estado.textContent = "";
    if (soloHex(campo.value).length !== 32) return;
    campo.disabled = true;
    estado.className = "estado";
    estado.textContent = t("diario.desbloqueo.abriendo");
    if (await d.abrir(campo.value)) return hoja.close(), alAbrir();
    campo.disabled = false;
    estado.className = "error";
    estado.textContent = t("diario.desbloqueo.error");
    campo.focus();
  });
}

// Cuánto dura el "Deshacer" de una entrada borrada.
const PLAZO_DESHACER = 6000;
// Una entrada del diario, ya descifrada. `atributo` dice a qué se refiere, para cuando una corrección de la carta lo cambie (R12).
// `versionDe`: la entrada chocó con otra del mismo id y quedó a su lado como versión de otro dispositivo (DR37).
export interface Entrada { id: string; texto: string; fecha: string; capitulo: number; atributo: string; versionDe?: string }
export interface DiarioAbierto {
  // Para el campo: hay un diario por capítulo en la misma pantalla.
  id: string;
  // El atributo vigente de la sección: una entrada escrita con otro valor lo lleva a la vista (R12).
  atributo: string;
  estado: () => Promise<string>;
  entradas: () => Promise<Entrada[]>;
  // Guarda la entrada; devuelve el código de recuperación si con ella nació el diario y ya quedó registrado en la cuenta (DR34).
  escribir: (texto: string) => Promise<string | null>;
  // "Quedarme con las dos": la otra versión pasa a ser una entrada más.
  quedarse: (entrada: Entrada) => Promise<void>;
  // "Borrar esta": se va de este dispositivo y, al sincronizar, de la cuenta.
  borrar: (entrada: Entrada) => Promise<void>;
}

// El diario dentro del capítulo: las entradas junto a la sección y el campo para sumar una (DR11, tercer tiempo).
// Cerrado en este navegador, en su lugar va la fila para escribir el código (DR32).
export function dibujarDiario(d: DiarioAbierto, filaCerrado: () => HTMLElement): HTMLElement {
  const caja = el("section", "diario", el("h2", "capitulo-titulo", t("diario.titulo")));
  const pintar = async () => {
    const estado = await d.estado();
    caja.replaceChildren(caja.firstChild!);
    if (estado === "cerrado" || estado === "anterior") return caja.append(filaCerrado());
    if (codigoPendiente()) caja.append(el("p", "ajustes-nota", t("recuperacion.pendiente.banner")));
    const campo = el("textarea", "campo");
    campo.id = d.id;
    const rotulo = el("label", "rotulo-campo", t("diario.rotulo"));
    rotulo.htmlFor = campo.id;
    const lista = el("ol", "diario-entradas");
    // La más nueva arriba; una versión de otro dispositivo va justo debajo de su original, cada una con su fecha y hora.
    const todas = await d.entradas();
    const orden = (e: Entrada) => `${todas.find((x) => x.id === e.versionDe)?.fecha ?? e.fecha}${e.versionDe ? "0" : "1"}`;
    for (const e of todas.sort((a, b) => orden(b).localeCompare(orden(a)))) {
      const cuando = el("time", "", new Date(e.fecha).toLocaleString("es", { dateStyle: "long", timeStyle: "short" }));
      cuando.dateTime = e.fecha;
      const item = el("li", "", cuando, e.texto);
      if (e.atributo !== d.atributo) item.append(el("p", "ajustes-nota", e.atributo));
      if (e.versionDe) {
        item.classList.add("otra-version");
        item.prepend(el("strong", "", t("conflicto.etiqueta")));
        item.append(
          el("p", "ajustes-nota", t("conflicto.explicacion")),
          boton("boton-link", t("conflicto.quedarme_dos"), async () => (await d.quedarse(e), void pintar())),
          // Borrar con deshacer: la entrada se oculta y recién se borra si pasan unos segundos sin que la persona se arrepienta (DR37).
          boton("boton-link", t("conflicto.borrar_esta"), () => {
            const aviso = el("li", "aviso-borrado");
            aviso.setAttribute("role", "status");
            const plazo = setTimeout(async () => (await d.borrar(e), aviso.remove()), PLAZO_DESHACER);
            aviso.append(t("conflicto.borrada"), " ", boton("boton-link", t("comun.deshacer"), () => (clearTimeout(plazo), aviso.replaceWith(item))));
            item.replaceWith(aviso);
          }),
        );
      }
      lista.append(item);
    }
    const guardar = boton("boton-principal", t("diario.guardar"), async (b) => {
      if (!campo.value.trim()) return campo.focus();
      b.disabled = true;
      // La entrada se guarda primero; el código de recuperación se muestra después (DR34).
      const codigo = await d.escribir(campo.value.trim());
      if (codigo) abrirCodigo(codigo).addEventListener("close", () => void pintar());
      await pintar();
    });
    caja.append(rotulo, campo, guardar, lista);
  };
  void pintar();
  return caja;
}
