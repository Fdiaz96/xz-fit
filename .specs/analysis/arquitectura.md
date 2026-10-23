# Arquitectura de XZ Fit

App web progresiva (PWA) **sin build, sin framework y sin servidor**: HTML, CSS y cuatro scripts clásicos que comparten el ámbito global. Se publica tal cual en GitHub Pages (`https://fdiaz96.github.io/xz-fit/`; `.nojekyll` evita el procesamiento de Jekyll).

## Archivos y capas

| Capa | Archivo | Responsabilidad | Depende de |
|---|---|---|---|
| Datos fijos | `data.js` | Zonas (`ZONES`), fases (`PHASES`), protocolo (`REHAB`, `REHAB_OPTIONS`), biblioteca `EXERCISES` con posturas, músculos y cámaras, plantillas `TEMPLATES`, `CATS`, `EXPERIENCE`, `SOURCES`, `NO_RINGS` | — |
| Reglas puras | `logic.js` | Fechas, equipo y discos, fuerza estimada, calibración, progresión, modo dolor, volumen, entrada en calor, estancamiento, semana/racha, `.ics`. Sin DOM | `data.js` (constantes) |
| Dibujo | `figures.js` | `figureSVG(ex, opts)`: proyección 3D isométrica, interpolación de posturas, músculos en rojo, utilería (mancuernas, pesa rusa, aros, bandas, silla, banco…) | `data.js` |
| Interfaz | `app.js` | Estado `S`, IndexedDB, pestañas, diálogos, sesiones de entreno y rehab, editor de rutina, historial, informe, ajustes, eventos | todo lo anterior |
| Estilos | `styles.css` | Tokens de color oscuro/claro (`[data-theme]`), componentes (card, chips, switch, sheet) | — |
| Shell | `index.html` | Cinco `section.view`, barra de pestañas, `<dialog>` para cada hoja, aplica el tema antes del primer pintado | — |
| Offline | `sw.js`, `manifest.webmanifest` | Caché versionado (`tendon-v<versión>`), red primero con respaldo de caché | — |
| Docs | `CHANGELOG.md`, `README.md` | El changelog además se muestra dentro de la app (Novedades) | — |
| Temporal | `animaciones.html` | Página de revisión de todas las animaciones (se borra al terminar) | `data.js`, `figures.js` |

El orden de carga en `index.html` (`data.js → logic.js → figures.js → app.js`) es la única "inyección de dependencias".

## Flujo de la interfaz

- **Estado único**: `let S` (ver [modelo de datos](modelo-de-datos.md)). Toda mutación termina en `persist()` + `render()`.
- **Render por plantillas de texto**: `render()` llama a `renderHome/Train/Tendons/History/Settings` de la pestaña visible; cada una arma un string HTML y lo asigna a `innerHTML`. Todo texto del usuario pasa por `esc()`.
- **Hojas (`<dialog>`)**: `wsheet` (entreno), `rsheet` (rehab), `painsheet`, `exsheet`, `pickersheet`, `exformsheet`, `machsheet`, `customsheet`, `newssheet`, `sumsheet`, `onb`. `dlg(id).html = …` redibuja sin perder el aviso, el descanso ni el tooltip que estén adentro.
- **Eventos delegados**: un solo `click` en `document` que despacha por `data-action` a un mapa `actions`; los inputs usan `data-set="ruta.del.estado"` (`setPath`) o `data-w` (filas del entreno) / `data-plate`.
- **Estado efímero de sesión**: `W` (entreno en curso), `R` (rehab en curso), `P` (pregunta de dolor), `PK` (selector), `XF` (formulario de ejercicio propio). No se guardan hasta terminar.

## Datos y privacidad

- IndexedDB `tendon-fuerte`, object store `kv`, clave `data` con todo `S`. Un solo registro, escrito en serie (`saving` encadena promesas).
- `navigator.storage.persist()` al terminar el primer uso.
- Nada sale del teléfono salvo lo que el usuario comparte: copia JSON, informe HTML y `.ics` (Web Share API o descarga).
- Los identificadores internos siguen siendo `tendon-fuerte` (nombre anterior) para no perder datos.

## PWA

- `sw.js`: precachea los archivos de la app; `fetch` con **red primero** (`cache: 'no-cache'`) y caché como respaldo; borra cachés viejos al activar. Cada versión cambia `CACHE`.
- Instalación: tarjeta con `beforeinstallprompt` en Android/Chrome e instrucciones para iPhone.
- Wake Lock durante sesiones, Web Audio para pitidos, `speechSynthesis` (`es-AR`) para la voz, `navigator.vibrate`.

## Pruebas

| Archivo | Tipo | Cómo correr |
|---|---|---|
| `tests/unit.mjs` | Reglas de `logic.js` (+ `figureSVG`) en un contexto `vm` de Node, sin navegador | `node tests/unit.mjs` |
| `tests/e2e.mjs` | Recorrido completo con Playwright + Chromium, viewport 390×844 | `python -m http.server 8124 &` y `node tests/e2e.mjs` (`SHOTS=carpeta` guarda capturas) |
| `tests/icon.mjs` | Regenera `icon-192.png` / `icon-512.png` | `node tests/icon.mjs` |

No hay `npm test` configurado; ambos scripts terminan con código ≠ 0 si alguna verificación falla.

## Puntos de extensión habituales

- **Ejercicio nuevo**: entrada en `EXERCISES` (data.js) con `kind`, `impl`, `ratio`, `tag`, `cues`, `fig`; categoría en el mapa de `CATS`, músculos en el mapa `mus`. Las pruebas de `figures.js` validan coordenadas.
- **Regla nueva**: función pura en `logic.js` + prueba en `unit.mjs`; la UI solo la consume.
- **Campo nuevo en el estado**: valor por defecto en `DEFAULT()` y, si es un objeto anidado, mezcla en `withDefaults()`.
