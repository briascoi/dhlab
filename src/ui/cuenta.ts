import "./cuenta.css";
import type { Cuenta, CuentaApi, Fallo, Modo } from "../cuenta-api";
import { t, type TextoId } from "../textos";

// Pantallas de cuenta (T71): hoja "Guarda tu carta", código de acceso, no invitado y "solo en este dispositivo".
// "entrar" es la puerta "Ya tengo cuenta": mismas pantallas, sin casilla ni opción de solo local (DR27).

const CLAVE = "dhlab.precuenta";
interface PreCuenta { email: string; modo: Modo; idPedido: string; enviado: boolean }

// Espacio pre-cuenta (DR35): si el navegador descarta la pestaña, al volver aparece la pantalla del código.
const leer = (): PreCuenta | null => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "null") as PreCuenta | null;
  } catch {
    return null;
  }
};
const guardar = (p: PreCuenta | null) => {
  try {
    if (p) localStorage.setItem(CLAVE, JSON.stringify(p));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento, la pantalla funciona igual; solo se pierde la reanudación.
  }
};

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
export const reloj = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

// Qué texto ve la persona ante cada falla del servidor (registro de rescates de CEO2-S2).
export function textoDeFallo({ error, quedan }: Fallo): string {
  if (error === "codigo_incorrecto") return quedan === 1 ? t("acceso.incorrecto_uno") : t("acceso.incorrecto", { n: quedan ?? 0 });
  const ids: Record<string, TextoId> = {
    codigo_vencido: "acceso.vencido",
    intentos_agotados: "acceso.agotado",
    demasiados_pedidos: "rescate.demasiados",
    envio_fallido: "rescate.envio_email",
    email_invalido: "hoja.email.error",
  };
  return t(ids[error] ?? "acceso.sin_red");
}

type Hijo = Node | string | false | null | undefined;
function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, attrs: Record<string, string> = {}, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...hijos.filter((x): x is Node | string => Boolean(x)));
  return e;
}
const ICONO_ERROR = () => {
  const s = h("span", { class: "icono-error", "aria-hidden": "true" }, "!");
  return s;
};
const mostrarError = (caja: HTMLElement, texto: string) => caja.replaceChildren(ICONO_ERROR(), texto);

export interface OpcionesCuenta {
  api: CuentaApi;
  variante: "guardar" | "entrar";
  alTerminar: (cuenta: Cuenta) => void;
}

export function abrirCuenta({ api, variante, alTerminar }: OpcionesCuenta): HTMLDialogElement {
  const hoja = h("dialog", { class: "hoja" });
  let estado: PreCuenta = leer() ?? { email: "", modo: "nube", idPedido: crypto.randomUUID(), enviado: false };
  let aceptado = false;
  let reloj_: ReturnType<typeof setInterval> | undefined;

  function pintar(clase: string, titulo: string, ...hijos: Hijo[]) {
    clearInterval(reloj_);
    hoja.className = `hoja ${clase}`;
    const t1 = h("h2", { class: "hoja-titulo", tabindex: "-1" }, titulo);
    hoja.replaceChildren(t1, ...hijos.filter((x): x is Node | string => Boolean(x)));
    t1.focus();
  }

  async function pedir(estadoCaja: HTMLElement, boton?: HTMLButtonElement) {
    if (boton) boton.disabled = true;
    estadoCaja.replaceChildren(t("hoja.enviando"));
    guardar(estado);
    const r = await api.pedirAcceso(estado.email, estado.modo, estado.idPedido);
    if (boton) boton.disabled = false;
    if ("ok" in r) {
      estado.enviado = true;
      guardar(estado);
      return pantallaCodigo(r.reenviarEn);
    }
    if (r.error === "no_invitado") return pantallaNoInvitado();
    mostrarError(estadoCaja, textoDeFallo(r));
  }

  function pantallaEmail() {
    const campo = h("input", { id: "cuenta-email", type: "email", autocomplete: "email", inputmode: "email", value: estado.email, "aria-describedby": "cuenta-estado" });
    const casilla = h("input", { id: "cuenta-casilla", type: "checkbox", "aria-describedby": "cuenta-casilla-error" });
    casilla.checked = aceptado;
    const errorCasilla = h("p", { id: "cuenta-casilla-error", class: "error", role: "alert" });
    const estadoCaja = h("p", { id: "cuenta-estado", class: "error", role: "alert" });
    const boton = h("button", { type: "submit", class: "boton-principal" }, t("hoja.boton"));
    const guardarVariante = variante === "guardar";
    const formulario = h(
      "form",
      { novalidate: "" },
      h("label", { for: "cuenta-email", class: "rotulo-campo" }, t("hoja.email.rotulo")),
      campo,
      guardarVariante && h("label", { class: "casilla" }, casilla, h("span", {}, t("hoja.casilla"))),
      guardarVariante && errorCasilla,
      // Los links van en línea propia: tocarlos no alterna la casilla (DR28).
      guardarVariante &&
        h("p", { class: "links" }, h("a", { href: "/legal#condiciones", target: "_blank", rel: "noopener" }, t("hoja.link_terminos")), h("a", { href: "/legal#privacidad", target: "_blank", rel: "noopener" }, t("hoja.link_politica"))),
      boton,
      estadoCaja,
    );
    formulario.addEventListener("submit", (e) => {
      e.preventDefault();
      estado.email = campo.value.trim();
      aceptado = casilla.checked;
      errorCasilla.replaceChildren();
      if (!emailValido(estado.email)) {
        mostrarError(estadoCaja, t("hoja.email.error"));
        return campo.focus();
      }
      // El botón no se deshabilita: sin la casilla, error junto a la casilla y foco en ella (DR28).
      if (guardarVariante && !aceptado) {
        estadoCaja.replaceChildren();
        mostrarError(errorCasilla, t("hoja.casilla.error"));
        return casilla.focus();
      }
      estado = { ...estado, idPedido: crypto.randomUUID(), enviado: false };
      void pedir(estadoCaja, boton);
    });
    const soloLocal = h("button", { type: "button", class: "boton-link" }, t("hoja.solo_local"));
    soloLocal.addEventListener("click", () => {
      estado.email = campo.value.trim();
      aceptado = casilla.checked;
      pantallaSoloLocal();
    });
    pintar("", t(guardarVariante ? "hoja.titulo" : "acceso.entrar.titulo"), formulario, guardarVariante && soloLocal);
  }

  function pantallaSoloLocal() {
    const elegir = h("button", { type: "button", class: "boton-principal" }, t("solo_local.accion"));
    const volver = h("button", { type: "button", class: "boton-secundario" }, t("solo_local.volver"));
    elegir.addEventListener("click", () => {
      estado.modo = "local";
      pantallaEmail();
    });
    volver.addEventListener("click", () => {
      estado.modo = "nube";
      pantallaEmail();
    });
    const lineas: TextoId[] = ["solo_local.promesa", "solo_local.linea_cuenta", "solo_local.linea_ia", "solo_local.linea_safari", "solo_local.linea_otra_compu"];
    pintar("completa", t("solo_local.titulo"), h("ul", { class: "lineas" }, ...lineas.map((id) => h("li", {}, t(id)))), elegir, volver);
  }

  function pantallaNoInvitado() {
    guardar(null);
    const otro = h("button", { type: "button", class: "boton-principal" }, t("invitacion.otro_email"));
    otro.addEventListener("click", () => {
      estado.email = "";
      pantallaEmail();
    });
    pintar("completa", t("invitacion.titulo"), h("p", {}, t("invitacion.que_paso")), h("p", {}, t("invitacion.como_pedir")), h("p", {}, t("invitacion.carta_guardada")), otro);
  }

  function pantallaCodigo(reenviarEn: number) {
    const campo = h("input", { id: "cuenta-codigo", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", class: "codigo", "aria-describedby": "cuenta-estado" });
    const estadoCaja = h("p", { id: "cuenta-estado", class: "error", role: "alert" });
    const cambiar = h("button", { type: "button", class: "boton-link" }, t("acceso.cambiar_email"));
    const reenviar = h("button", { type: "button", class: "boton-secundario" }, t("acceso.reenviar"));
    const espera = h("p", { class: "espera" });
    cambiar.addEventListener("click", () => {
      estado.enviado = false;
      guardar(null);
      pantallaEmail();
    });
    const otroCodigo = () => {
      estado = { ...estado, idPedido: crypto.randomUUID(), enviado: false };
      void pedir(estadoCaja, reenviar);
    };
    reenviar.addEventListener("click", otroCodigo);

    // El tiempo de espera se ve, pero no se anuncia cada segundo (DR35).
    let quedan = reenviarEn;
    const tic = () => {
      reenviar.hidden = quedan > 0;
      espera.hidden = quedan <= 0;
      espera.textContent = t("acceso.reenviar_espera", { tiempo: reloj(Math.max(quedan, 0)) });
      quedan -= 1;
    };

    async function comprobar() {
      campo.disabled = true;
      estadoCaja.className = "estado";
      estadoCaja.replaceChildren(t("acceso.verificando"));
      const r = await api.verificar(estado.email, campo.value);
      if ("cuenta" in r) {
        guardar(null);
        estadoCaja.replaceChildren(t("acceso.guardando"));
        return alTerminar(r.cuenta);
      }
      campo.disabled = false;
      estadoCaja.className = "error";
      mostrarError(estadoCaja, textoDeFallo(r));
      if (r.error === "codigo_vencido" || r.error === "intentos_agotados") {
        const pedirOtro = h("button", { type: "button", class: "boton-principal" }, t("acceso.pedir_otro"));
        pedirOtro.addEventListener("click", otroCodigo);
        estadoCaja.append(pedirOtro);
        return pedirOtro.focus();
      }
      campo.value = "";
      campo.focus();
    }
    campo.addEventListener("input", () => {
      campo.value = campo.value.replace(/\D/g, "").slice(0, 6);
      if (campo.value.length === 6) void comprobar();
    });

    pintar(
      "",
      t("acceso.titulo"),
      h("p", { class: "enviado" }, t("acceso.enviado_a", { email: estado.email }), " ", cambiar),
      h("label", { for: "cuenta-codigo", class: "rotulo-campo" }, t("acceso.rotulo")),
      campo,
      estadoCaja,
      espera,
      reenviar,
    );
    tic();
    reloj_ = setInterval(tic, 1000);
    campo.focus();
  }

  hoja.addEventListener("close", () => clearInterval(reloj_));
  document.body.append(hoja);
  hoja.showModal();
  if (estado.enviado) pantallaCodigo(0);
  else pantallaEmail();
  return hoja;
}
