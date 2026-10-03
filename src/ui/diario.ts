// Pantallas del diario (T72): el código de recuperación (DR34) y abrir el diario en un navegador que no tiene su clave (DR32).
import { t } from "../textos";
import { anuncio, boton, completa, el } from "./pantalla";

// "Ahora no" deja pendiente guardar el código; el código no se guarda en ningún lado, así que completarlo es generar uno nuevo (E4-codigo).
const PENDIENTE = "dhlab.codigo_pendiente";
export const codigoPendiente = () => localStorage.getItem(PENDIENTE) !== null;
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

// Abrir el diario: un solo campo que prueba el código en cuanto está completo. Un código que no abre no bloquea.
export function abrirDesbloqueo(abrir: (codigo: string) => Promise<boolean>, alAbrir: () => void) {
  // El código entero no entra en un renglón de celular: va en dos, igual que se muestra al guardarlo.
  const campo = el("textarea", "campo codigo-recuperacion");
  Object.assign(campo, { id: "diario-codigo", rows: 2, autocomplete: "off", spellcheck: false });
  campo.setAttribute("autocapitalize", "characters");
  campo.setAttribute("aria-describedby", "diario-estado");
  const rotulo = el("label", "rotulo-campo", t("diario.desbloqueo.rotulo"));
  rotulo.htmlFor = campo.id;
  const estado = anuncio("error", "alert");
  estado.id = "diario-estado";
  const salida = el("p", "");
  const hoja = completa("diario.desbloqueo.titulo", () => [rotulo, campo, estado, boton("boton-link", t("diario.no_tengo_codigo"), () => (salida.textContent = t("diario.no_tengo.otro_dispositivo"))), salida]);
  campo.addEventListener("input", async () => {
    estado.textContent = "";
    if (soloHex(campo.value).length !== 32) return;
    campo.disabled = true;
    estado.className = "estado";
    estado.textContent = t("diario.desbloqueo.abriendo");
    if (await abrir(campo.value)) return hoja.close(), alAbrir();
    campo.disabled = false;
    estado.className = "error";
    estado.textContent = t("diario.desbloqueo.error");
    campo.focus();
  });
}
