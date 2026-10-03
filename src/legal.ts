// Páginas /legal y /creditos: muestran su documento tal cual está en docs/legal.
import "@fontsource-variable/archivo/wdth.css";
import "./estilos.css";
import "./ui/tintas";
import "./legal.css";
import creditos from "../docs/legal/creditos.md?raw";
import texto from "../docs/legal/terminos-y-privacidad.md?raw";

// Los documentos usan solo títulos, párrafos, listas, negritas y links; no hace falta más que esto.
const ANCLAS: Record<string, string> = { "Condiciones de uso": "condiciones", "Política de privacidad": "privacidad" };

function conNegritas(destino: HTMLElement, linea: string) {
  // Partes impares: negrita. Dentro de cada parte, "[texto](https://...)" es un link que abre en otra pestaña.
  linea.split(/\*\*(.+?)\*\*/g).forEach((parte, i) => {
    if (!parte) return;
    const donde = i % 2 === 0 ? destino : destino.appendChild(document.createElement("strong"));
    parte.split(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g).forEach((trozo, j, trozos) => {
      if (j % 3 === 0) return donde.append(trozo);
      if (j % 3 === 2) return;
      const link = document.createElement("a");
      link.href = trozos[j + 1]!;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = trozo;
      donde.append(link);
    });
  });
}

export function dibujarLegal(md: string, destino: HTMLElement) {
  let lista: HTMLUListElement | null = null;
  for (const linea of md.split("\n").map((l) => l.trim())) {
    if (!linea || linea.startsWith("<!--")) {
      lista = null;
      continue;
    }
    const titulo = /^(#{1,3}) (.+)$/.exec(linea);
    if (titulo) {
      lista = null;
      const e = document.createElement(`h${titulo[1]!.length}`);
      e.textContent = titulo[2]!;
      if (ANCLAS[titulo[2]!]) e.id = ANCLAS[titulo[2]!]!;
      destino.append(e);
    } else if (linea.startsWith("- ")) {
      if (!lista) destino.append((lista = document.createElement("ul")));
      const li = document.createElement("li");
      conNegritas(li, linea.slice(2));
      lista.append(li);
    } else {
      lista = null;
      const p = document.createElement("p");
      conNegritas(p, linea);
      destino.append(p);
    }
  }
}

const destino = document.getElementById("legal");
if (destino) {
  const esCreditos = destino.dataset.documento === "creditos";
  dibujarLegal(esCreditos ? creditos : texto, destino);
  // Al pie de las condiciones, el link a los créditos (fuera del documento aprobado, que no se toca).
  if (!esCreditos) {
    const pie = document.createElement("p");
    pie.className = "pie";
    const link = document.createElement("a");
    link.href = "/creditos/";
    link.textContent = "Créditos";
    pie.append(link);
    destino.append(pie);
  }
  // Los links de la hoja llegan con #condiciones o #privacidad.
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
