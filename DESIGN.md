---
# gstack: design-md-format=spec
name: DH Lab
description: Una consola de sintetizador impresa en risografía, cálida y nerd, donde tu carta es un instrumento que se toca.
colors:
  paper: "#F4EDE0"
  panel: "#FBF7EF"
  ink: "#1E1B24"
  ink-muted: "#5C5866"
  primary: "#2742C7"
  on-primary: "#FBF7EF"
  fluor: "#FF3EA5"
  on-fluor: "#1E1B24"
  pink-text: "#B0125F"
  rule-soft: "#A89D88"
  success: "#1E6E45"
  warning: "#8A5300"
  error: "#B3261E"
  night-bg: "#0E1431"
  night-panel: "#172048"
  night-text: "#F4EDE0"
  night-muted: "#B8B3C9"
  night-gold: "#E9B85C"
  night-on-gold: "#0E1431"
  night-salmon: "#F48C7F"
  night-link: "#9AABFF"
  night-rule-soft: "#4A5487"
  night-success: "#7FD6A2"
  night-warning: "#FFB86B"
  night-error: "#FF8F86"
  print-shadow: "#1E1B24"
  night-print-shadow: "#05081A"
  theme-day:
    surface-page: "{colors.paper}"
    surface-panel: "{colors.panel}"
    text: "{colors.ink}"
    text-muted: "{colors.ink-muted}"
    border: "{colors.ink}"
    border-decor: "{colors.rule-soft}"
    action: "{colors.primary}"
    on-action: "{colors.on-primary}"
    link: "{colors.primary}"
    accent-text: "{colors.pink-text}"
    light: "{colors.fluor}"
    on-light: "{colors.on-fluor}"
    cable: "{colors.ink}"
    focus: "{colors.primary}"
    success: "{colors.success}"
    warning: "{colors.warning}"
    error: "{colors.error}"
    on-error: "{colors.panel}"
    shadow: "{colors.print-shadow}"
  theme-night:
    surface-page: "{colors.night-bg}"
    surface-panel: "{colors.night-panel}"
    text: "{colors.night-text}"
    text-muted: "{colors.night-muted}"
    border: "{colors.night-muted}"
    border-decor: "{colors.night-rule-soft}"
    action: "{colors.night-gold}"
    on-action: "{colors.night-on-gold}"
    link: "{colors.night-link}"
    accent-text: "{colors.night-salmon}"
    light: "{colors.night-gold}"
    on-light: "{colors.night-on-gold}"
    cable: "{colors.night-text}"
    focus: "{colors.night-gold}"
    success: "{colors.night-success}"
    warning: "{colors.night-warning}"
    error: "{colors.night-error}"
    on-error: "{colors.night-bg}"
    shadow: "{colors.night-print-shadow}"
typography:
  display:
    fontFamily: Archivo
    fontWeight: 800
    fontVariation: "wdth 112"
    fontSize: clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem)
    lineHeight: 1.05
    letterSpacing: -0.01em
  title:
    fontFamily: Archivo
    fontWeight: 700
    fontVariation: "wdth 100"
    fontSize: 1.375rem
    lineHeight: 1.2
  body:
    fontFamily: Archivo
    fontWeight: 400
    fontVariation: "wdth 100"
    fontSize: 1rem
    lineHeight: 1.5
  reading:
    fontFamily: Archivo
    fontWeight: 400
    fontVariation: "wdth 100"
    fontSize: 1.0625rem
    lineHeight: 1.6
    maxWidth: 68ch
  label:
    fontFamily: Archivo
    fontWeight: 600
    fontVariation: "wdth 75"
    fontSize: 0.875rem
    letterSpacing: 0.06em
    textTransform: uppercase
  annotation:
    fontFamily: Caveat
    fontWeight: 600
    fontSize: 1.5rem
    lineHeight: 1.1
  annotation-caps:
    fontFamily: Architects Daughter
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.25
    textTransform: uppercase
  mono:
    fontFamily: Martian Mono
    fontWeight: 400
    fontVariation: "wdth 87.5"
    fontSize: 0.875rem
    fontFeature: tnum
rounded:
  panel: 2px
  control: 4px
  chip: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  touch: 44px
components:
  panel:
    backgroundColor: surface-panel
    borderColor: border
    borderWidth: 2px
    rounded: "{rounded.panel}"
    shadow: 3px 3px 0 shadow
  button-primary:
    backgroundColor: action
    textColor: on-action
    rounded: "{rounded.control}"
    minHeight: "{spacing.touch}"
  button-secondary:
    backgroundColor: transparent
    borderColor: border
    borderWidth: 2px
    textColor: text
    rounded: "{rounded.control}"
    minHeight: "{spacing.touch}"
  button-destructive:
    backgroundColor: error
    textColor: on-error
    rounded: "{rounded.control}"
    minHeight: "{spacing.touch}"
  coach-action:
    backgroundColor: surface-panel
    borderColor: border
    textColor: text
    rounded: "{rounded.chip}"
    minHeight: "{spacing.touch}"
  input:
    backgroundColor: surface-page
    borderColor: border
    borderWidth: 2px
    textColor: text
    placeholderColor: text-muted
    errorColor: error
    rounded: "{rounded.control}"
    minHeight: "{spacing.touch}"
  checkbox:
    size: 24px
    touchTarget: "{spacing.touch}"
    borderColor: border
    borderWidth: 2px
    checkedColor: action
    checkColor: on-action
    rounded: "{rounded.panel}"
  banner:
    backgroundColor: surface-panel
    borderWidth: 2px
    borderColor: success | warning | error | border
    textColor: text
    rounded: "{rounded.panel}"
  code-block:
    borderColor: action
    borderWidth: 2px
    textColor: action
    rounded: "{rounded.control}"
  sync-marker:
    textColor: text-muted
    touchTarget: "{spacing.touch}"
  conflict-tag:
    textColor: text-muted
  focus-ring:
    outlineColor: focus
    outlineWidth: 2px
    outlineOffset: 2px
---

# DH Lab

## Overview

**Creative North Star:** tu carta es un instrumento que entendés y podés tocar. Una consola de sintetizador (paneles, tornillos, perillas, cables) impresa en dos tintas de risografía sobre papel; de noche, un póster serigrafiado.
**Product context:** DH Lab, laboratorio de Diseño Humano (`dhlab.app`): coach de Diseño Humano jugable para Isma y su círculo (unas 50 personas, por invitación), que se abre sobre todo desde links de WhatsApp en el celular. App web con cuenta por email: carta, libro y diario en la nube por defecto (el diario, cifrado en el dispositivo), con la opción "solo en este dispositivo". Se puede agregar a la pantalla de inicio (manifest, sin service worker). Plan y decisiones: `docs/designs/coach-diseno-humano.md` (design review DR1 a DR26 y ronda 2, DR27 a DR50).
**Mode per surface:** Operate en mapa, capítulos, coach, cuenta y ajustes; Read en el libro; un solo momento Experience en la revelación (DR10).
**Reference sites:** sin investigación de rubro (decisión D1 de la consulta); referencias propias: mockups aprobados en `~/.gstack/projects/briascoi-Dise-o-Humano/designs/` (mockup-20260930, coach-20261001, design-system-20261001, guarda-tu-carta-20261002, codigo-recuperacion-20261002; conexion-20261001 vuelve con el QR e instalar-iphone-20261001 con los avisos).
**Key characteristics:**
- Todo parece impreso en dos tintas sobre papel, con piezas que se tocan.
- Rótulos de hardware: etiquetas de control condensadas y en mayúsculas, como la serigrafía de un sintetizador.
- Profundidad como sombra de impresión: un bloque de tinta corrido, nunca un halo.
- La noche no es la inversión del día: es un póster con luces en oro y cables en salmón.

## Colors

**Strategy:** Committed, con dos tintas. De día, papel crema con tinta casi negra y azul riso para acciones; el rosa fluorescente es la tinta de las luces, las ondas, la pestaña activa y las pegatinas; los cables del mapa van en tinta negra con enchufes grises, y los subrayados y guías a mano, en el azul. De noche, azul noche con oro para luces y botón principal y salmón para cables.
**Light or dark:** lo decide la escena de uso: la app sigue al modo del celular (`prefers-color-scheme`) y en Ajustes hay un selector Automático, Día o Noche, guardado localmente (DR16). La noche es la cara favorita de Isma; el día existe completo desde el primer commit.

Reglas:
- **Regla de tinta (DR15):** `fluor` nunca es color de texto (2,8:1 sobre papel). Puede ser fondo de un botón o de una luz con texto en `on-fluor` (5,2:1). El texto va en `ink`, `primary` o `pink-text`.
- Contrastes medidos (WCAG 2.x) sobre `paper`: `ink` 14,6:1; `primary` 6,7:1; `pink-text` 5,8:1; `ink-muted` 5,9:1; `success` 5,4:1; `warning` 5,4:1; `error` 5,6:1. Sobre `night-bg`: `night-text` 15,5:1; `night-gold` 9,9:1; `night-salmon` 7,7:1; `night-link` 8,3:1; `night-muted` 8,9:1; `night-success` 10,4:1; `night-warning` 10,6:1; `night-error` 8,2:1.
- `rule-soft` y `night-rule-soft` son solo decorativos (2,3:1 y 2,5:1): nunca transmiten información sola.
- Los estados nunca dependen solo del color: siempre llevan ícono o texto (cuerpo del plan, accesibilidad).

**Colores por función (CEO2-S11 y DR47, 2026-10-02):** los componentes nunca usan un color primitivo; usan un token semántico (`surface-page`, `surface-panel`, `text`, `text-muted`, `border`, `border-decor`, `action`, `on-action`, `link`, `accent-text`, `light`, `on-light`, `cable`, `focus`, `success`, `warning`, `error`, `on-error`, `shadow`) que cada tema resuelve en `colors.theme-day` o `colors.theme-night`. En CSS, cada semántico es una variable que el tema reasigna; agregar un componente nunca suma colores propios.

Matriz de contraste por par efectivo (WCAG 2.x, día / noche, medida el 2026-10-02):
- `text` sobre `surface-panel` 15,88 / 13,49; sobre `surface-page` 14,58 / 15,51.
- `text-muted` sobre `surface-panel` 6,46 / 7,73.
- `link` sobre `surface-panel` 7,31 / 7,21; `accent-text` sobre `surface-panel` 6,34 / 6,66.
- `on-action` sobre `action` 7,31 / 9,87; `on-error` sobre `error` 6,12 / 8,19.
- `code-block` (`action` sobre `surface-panel`) 7,31 / 8,59.
- Bordes con información, mínimo 3:1: `border` sobre `surface-page` 14,58 / 8,88; `focus` sobre `surface-panel` 7,31 / 8,59; borde de banner sobre `surface-panel`: `success` 5,83 / 9,01, `warning` 5,92 / 9,22, `error` 6,12 / 7,13.
- Por debajo, solo decorativos: `border-decor` 2,51 / 2,18 y `light` de día sobre `surface-page` 2,78 (nunca texto ni dato solo por color).
- Test en CI: recorre esta matriz por componente y estado en los dos temas y falla por debajo de 4,5:1 en texto (3:1 en texto de 24 px o más) y de 3:1 en bordes y gráficos con información.

## Typography

Cuatro familias, cada una con un rol cerrado (DR14). Las cuatro son OFL-1.1, traen ñ, tildes y ¿ ¡ (subconjuntos latin y latin-ext) y se alojan en el propio sitio con Fontsource (`@fontsource-variable/archivo`, `@fontsource/architects-daughter`, `@fontsource-variable/caveat`, `@fontsource-variable/martian-mono`), sin pedidos a terceros, servidas desde el propio sitio junto con la app (R23 queda como división de código, E3-sw). Verificadas en la API de Fontsource el 2026-10-01.

- **Archivo** (variable: ancho 62 a 125, peso 100 a 900): la familia de texto. Una grotesca de fines del siglo XIX pensada para titulares, que con su eje de ancho cubre títulos expandidos, cuerpo y rótulos condensados sin sumar otra familia.
- **Architects Daughter y Caveat** (pareja manuscrita elegida por Isma el 2026-10-03, en reemplazo de Shantell Sans): solo para anotaciones a mano (DR13). Architects Daughter, letra de plano técnico, para las notas en mayúsculas; Caveat, cursiva suelta en peso 600, para las notas en minúscula. Nunca en controles ni en cuerpo. Las flechas, subrayados, sellos y manchas que las acompañan son trazos propios generados por código (`src/ui/trazos.ts`), nunca rectos, con grosor de 2 px y un temblor leve, a tono con la letra.
- **Martian Mono** (variable: ancho 75 a 112,5, peso 100 a 800): solo en el modo técnico (Gate.Línea.Color y grados) y en los códigos que la persona copia o escribe (el código de acceso de 6 dígitos y el código de recuperación del diario, DR48), con cifras tabulares. Ningún otro uso: nunca como adorno ni en las etapas de espera.

Escala: los niveles difieren por tamaño, no solo por peso. El cuerpo nunca baja de 16 px. Los rótulos condensados llevan como máximo 3 palabras.

## Layout

- Grilla de 8 px para las pantallas de instrumento, con paneles alineados.
- Celular (hasta 767 px): una columna y barra inferior de 4 pestañas (DR3, DR17).
- Tablet (768 a 1023 px): el mismo diseño con márgenes más amplios.
- La barra de 4 pestañas va abajo en todos los anchos, como en los mockups (cambia DR17, que pedía una columna a la izquierda en escritorio). El mapa y el panel "Tu configuración" van lado a lado y con la misma altura desde 640 px; el libro, en una columna de 68ch.
- Toque mínimo de 44 px en todo control, incluidas las áreas invisibles de los 9 Centros (DR4).

## Elevation & Depth

Una sola forma de profundidad: la sombra de impresión, un bloque de tinta sólida desplazado 3 px abajo y a la derecha, sin desenfoque (`print-shadow` de día, `night-print-shadow` de noche). Nada de halos ni brillos alrededor de elementos. Las texturas (grano de papel, pulso de la tinta, motas de riso, trama de semitono y desfasaje leve de tinta) son filtros SVG o CSS estáticos, sin animación, para no trabar celulares de gama baja, el PDF ni la tarjeta (DR14).

## Shapes

Paneles con esquinas de 9 px y doble línea en el borde, como el canto de un módulo de consola; 4 px en botones y controles; 2 px en etiquetas. La píldora se usa solo en las acciones del coach (DR12). No hay tarjetas dentro de tarjetas: un panel contiene filas, rótulos y controles, nunca otro panel con sombra.

## Components

- **Panel:** fondo `surface-panel`, borde de 2 px en `border` entintado a pulso con una segunda línea interior, tornillos con ranura en cruz en las esquinas (decorativos), sombra de impresión. El título del panel va en una etiqueta de tinta llena.
- **Perilla:** aro, cuerpo en tinta llena, marca clara y marcas cortas alrededor. Todo decorativo: nunca números ni datos.
- **Tarjeta de una línea:** borde a pulso en la tinta de luz (experimento) o en la segunda tinta (coach), con su ícono en un círculo.
- **Barra de pestañas:** panel a todo el ancho, íconos a dos tintas con trazo a pulso; la pestaña activa es un bloque de tinta de luz con trama de puntos y texto en `on-light`, además de `aria-current`.
- **Mapa:** piezas con contorno a pulso; las definidas, en tinta de luz con motas, trama de semitono y un punto de luz, apenas fuera de registro; Canales en líneas finas; un cable en `cable` con enchufes por cada Canal definido; rótulos en Architects Daughter y guías punteadas en la segunda tinta. Las Puertas no se dibujan en esta vista.
- **Botón principal:** fondo `action` con texto `on-action` (de día, azul riso; de noche, oro con texto azul noche). Hover y activo: la sombra de impresión se reduce a 1 px (el botón "se hunde"). Deshabilitado: borde punteado y texto `text-muted`, sin sombra.
- **Botón secundario:** contorno de 2 px en `border` y texto `text`, como en los mockups aprobados de instalación y del código de recuperación.
- **Botón destructivo:** fondo `error` con texto `on-error`; solo para borrar cuenta, empezar un diario nuevo y borrar una versión del diario, siempre al final de su grupo.
- **Campo de texto:** fondo `surface-page`, borde de 2 px en `border`, rótulo visible fuera del campo (nunca el placeholder como rótulo), error con borde y mensaje en `error` más ícono, asociado al campo.
- **Casilla:** caja de 24 px dentro de un toque de 44 px, borde de 2 px en `border`, marcada en `action` con tilde `on-action`; los links de su texto van en una línea propia (DR28).
- **Banner en línea:** fondo `surface-panel`, borde de 2 px en el color del estado (`success`, `warning`, `error`) o `border`, ícono y texto en `text`.
- **Bloque de código:** borde y texto en `action`, para el código de recuperación (DR34).
- **Marca de sincronización y etiqueta de conflicto:** ícono y texto en `text-muted`, sin depender del color (DR36, DR37).
- **Foco visible:** contorno de 2 px en `focus` con separación de 2 px (DR18).
- **Interrupciones (DR21, actualizada en DR49):** nunca más de un pedido por pantalla (DR9).
  - Pantalla completa (una acción principal y una salida clara): consentimiento de IA y de OpenRouter, "solo en este dispositivo" (DR29), cambiar dónde se guarda (DR39), código de recuperación (DR34), desbloquear el diario y empezar un diario nuevo (DR32), carta cambiada en otro dispositivo (DR38), no invitado (DR45), borrar cuenta (DR44), archivo inválido (DR26) y base local más nueva (CX4).
  - Hoja que sube sobre la carta (variante de pantalla completa, con la carta visible detrás): "Guarda tu carta" y el código de acceso (DR28, DR35, DR46).
  - Banner o insignia en línea, dentro del flujo: desactualizado, pendiente de hora, espera tu hora, versión nueva, aviso de corrección del motor, sesión vencida, IA en pausa, cerca del tope, key propia perdida, cuenta pasada a solo local desde otro dispositivo, código de recuperación pendiente y capítulo en curso.
  - Fuera de la v1 (vuelven con su función, TODOS.md): consentimiento del QR, instalar y avisos, algunos avisos no llegaron. La advertencia del respaldo pasó a la pantalla previa de exportar (DR43).
- **Anotación a mano (DR13):** Caveat (notas en minúscula) o Architects Daughter (notas en mayúsculas), en tinta o azul, con flecha curva dibujada a mano cuando señala algo, sin tope fijo desde el 2026-10-03 (antes, dos por pantalla): las que pida la composición, sin tapar controles ni competir con el contenido; orientan, hacen humor sin afirmar nada sobre la persona o citan una ficha aprobada. También pueden ir en una pegatina (mancha de tinta de luz con nota en mayúsculas).
- **Coach (DR12):** pantallita de osciloscopio con rejilla de parlante dentro de un panel; la onda es `fluor` de día y `night-salmon` de noche; acciones en píldoras.
- **Símbolos (DR22):** candado solo para progreso; reloj para lo que espera la hora; "Conectar" es un botón, no un candado.

## Do's and Don'ts

- Do: verificar el contraste de cada par de texto y fondo nuevo contra 4,5:1 (3:1 en texto de 24 px o más).
- Do: diseñar cada pantalla en los dos temas desde el principio (DR16).
- Do: usar el rosa fluorescente como tinta de luz, onda, pestaña activa y pegatina; el azul, para subrayados, guías y anotaciones a mano.
- Do: dar a tintas y trazos el aspecto de impresión con los filtros estáticos de `src/ui/tintas.ts` (pulso, motas de riso, semitono, fuera de registro); nunca animados.
- Do: tomar todo texto de interfaz del registro de textos aprobados (DR20); sin aprobación se ve un marcador.
- Don't: texto en rosa fluorescente, ni siquiera en títulos grandes.
- Don't: caras, siluetas o manos (el coach no tiene cara), mascotas, emojis, 3D o degradados.
- Don't: pseudométricas, porcentajes, números o rótulos inventados en diales y perillas: las marcas alrededor de una perilla son decorativas y no llevan datos.
- Don't: sombras suaves con desenfoque, halos de color o tarjetas apiladas como layout.
- Don't: anotaciones que interpreten la carta.

## Motion

- **Approach:** intentional.
- **Easing:** entrada ease-out, salida ease-in, desplazamiento ease-in-out.
- **Duration:** micro 80 ms, corto 200 ms, medio 320 ms, largo 6 a 8 s solo en la revelación.
- **The one authored moment:** la revelación de la carta (DR10). Segundo momento, acotado: el cable del coach hacia el elemento del mapa (DR12).
- Con `prefers-reduced-motion`, cortes directos: sin onda animada, sin cable, la carta aparece completa con una línea de cierre.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-01 | Sistema de diseño inicial | Creado por /design-consultation desde la dirección aprobada (riso-consola y póster de noche) y las decisiones DR14, DR15, DR16 y DR21 del design review; idea a recordar: "mi carta es un instrumento que entiendo y puedo tocar" |
| 2026-10-01 | Archivo, Shantell Sans y Martian Mono | Una familia de texto con eje de ancho, una manuscrita solo para anotaciones y una monoespaciada solo para el modo técnico (DR14); verificadas OFL-1.1 con soporte de español |
| 2026-10-01 | Ambos temas aprobados, noche favorita | Vista previa del 2026-10-01: noche 5/5, día sin objeciones; DR16 se mantiene |
| 2026-10-02 | Colores por función y componentes nuevos | CEO2-S11 (D20 CEO2) y DR47 (D23 DIS2): el botón secundario de noche medía 1,08:1 (hallazgo 10 de Codex); los componentes pasan a tokens semánticos que cada tema reasigna, con matriz de contraste y test en CI; se suman campo, casilla, banner, botón destructivo, bloque de código, marca de sincronización y etiqueta de conflicto; salen `panel-night` y `button-primary-night` |
| 2026-10-02 | Martian Mono también en los códigos | DR48 (D24 DIS2): el código de acceso y el de recuperación necesitan caracteres que se distingan y grupos alineados; coincide con el mockup aprobado del código de recuperación; el rol queda cerrado a esos dos usos |
| 2026-10-02 | Interrupciones de la premisa nube | DR49 (D25 DIS2): las pantallas nuevas de cuentas, diario cifrado e IA incluida se clasifican con la regla de DR21; sale lo postergado (QR, avisos) |
| 2026-10-02 | Contexto de la premisa nube | DR50 (D26 DIS2): el producto pasa a cuenta por email, nube por defecto con diario cifrado y opción solo en este dispositivo, manifest sin service worker; sale "conexión" de las superficies (QR postergado); referencias al día |
| 2026-10-03 | Nombre: DH Lab | Elegido por Isma; el nombre lleva "Diseño Humano" o "DH" y va siempre junto al rótulo "laboratorio de Diseño Humano"; dominio `dhlab.app` |
| 2026-10-03 | Pareja manuscrita: Architects Daughter y Caveat | Elegida por Isma entre cinco propuestas (pareja A): emula el aire de plano técnico del mockup riso-consola sin copiarlo; reemplaza a Shantell Sans; los trazos a mano (flechas curvas, subrayado, sello, mancha) son dibujo propio |
| 2026-10-03 | El mockup riso-consola manda | Pedido de Isma: acercar la app al mockup aprobado lo más posible. Cambian: barra de pestañas abajo en todos los anchos (DR17), paneles de 9 px con doble línea a pulso, marcas decorativas en las perillas, subrayado y guías en azul, cables en tinta, rótulos del mapa en Architects Daughter, Puertas fuera del mapa, filtros de impresión estáticos y anotaciones sin tope fijo. Se mantienen: contraste AA (el rosa fluorescente no es texto), sin caras y sin anotaciones que interpreten la carta |
