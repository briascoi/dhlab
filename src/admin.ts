// Panel de Isma: invitar emails y ver quién ya tiene cuenta. Herramienta interna, detrás de Cloudflare Access.
import "@fontsource-variable/archivo/wdth.css";
import "./estilos.css";
import "./ui/tintas";
import "./ui/cuenta.css";
import "./admin.css";

interface Datos {
  invitaciones: { email: string; creada: number }[];
  cuentas: { email: string; modo: string; creada: number }[];
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fecha = (ms: number) => new Date(ms).toLocaleDateString("es");
const estado = $("estado");

async function pedir(metodo: string, email?: string): Promise<Datos | null> {
  const init: RequestInit = { method: metodo };
  if (email) Object.assign(init, { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const r = await fetch("/admin/api/invitaciones", init).catch(() => null);
  if (!r?.ok) {
    estado.textContent = "No se pudo completar el pedido.";
    return null;
  }
  estado.textContent = "";
  return (await r.json()) as Datos;
}

async function pintar() {
  const datos = await pedir("GET");
  if (!datos) return;
  const conCuenta = new Set(datos.cuentas.map((c) => c.email));
  $("invitaciones").replaceChildren(
    ...datos.invitaciones.filter((i) => !conCuenta.has(i.email)).map(({ email, creada }) => {
      const li = document.createElement("li");
      const quitar = document.createElement("button");
      quitar.className = "boton-secundario";
      quitar.textContent = "Quitar";
      quitar.setAttribute("aria-label", `Quitar la invitación de ${email}`);
      quitar.addEventListener("click", async () => {
        if (await pedir("DELETE", email)) void pintar();
      });
      li.append(`${email} (invitado el ${fecha(creada)})`, quitar);
      return li;
    }),
  );
  $("cuentas").replaceChildren(
    ...datos.cuentas.map(({ email, modo, creada }) => {
      const li = document.createElement("li");
      li.textContent = `${email}: ${modo === "local" ? "solo en su dispositivo" : "en la nube"}, desde el ${fecha(creada)}`;
      return li;
    }),
  );
}

$<HTMLFormElement>("invitar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const campo = $<HTMLInputElement>("email");
  if (await pedir("POST", campo.value)) {
    campo.value = "";
    void pintar();
  }
});
void pintar();
