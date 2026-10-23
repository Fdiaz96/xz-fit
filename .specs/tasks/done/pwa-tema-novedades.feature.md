---
title: Implementar la PWA instalable sin conexión, con tema claro/oscuro y novedades
status: implementado (retro-documentado)
versions: 1.0.0, 1.3.0, 1.6.0, 1.10.0, 1.10.1, 1.14.0, 1.14.1
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG.

Que la app se instale como una app nativa, abra sin conexión, se actualice sola, tenga tema claro y oscuro, y cuente qué cambió en cada versión.

# Description

- **Sin conexión**: `sw.js` precachea los archivos con `cache: 'reload'`; responde **red primero** (`no-cache`) guardando la copia, y cae al caché si no hay red. Al activar borra cachés de otras versiones. `CACHE = 'tendon-v<versión>'` cambia en cada versión.
- **Instalación**: `manifest.webmanifest` (standalone, vertical, íconos 192/512 + maskable). Tarjeta en Inicio: botón *Instalar* con `beforeinstallprompt` (Android/Chrome) o instrucciones de *Agregar a inicio* en iPhone (así Safari no borra los datos). "Ahora no" la oculta (`hideInstall`).
- **Tema** (Ajustes → *Tema*): Oscuro (predeterminado), Claro o Según el sistema. Se aplica antes del primer pintado (script en `index.html` leyendo `tf-theme` de `localStorage`) y cambia `theme-color`. En claro, los acentos pasan a tonos legibles.
- **Novedades**: Ajustes → Fuentes → *Novedades* muestra `CHANGELOG.md` con un mini-markdown (`mdLite`). Cuando `seenVersion` ≠ `APP_VERSION`, Inicio muestra "Novedades de la versión X".
- **Accesibilidad**: avisos con `role="status"`/`aria-live`, foco visible, barra de pestañas con nombre, interruptores con `aria-label`.
- **Marca**: XZ Fit (antes Tendón Fuerte), logo "XZ" lima + "FIT"; íconos generados con `tests/icon.mjs`. Dirección `https://fdiaz96.github.io/xz-fit/`.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — La app abre sin conexión después de la primera visita.
- [x] `CK-2` — Cambiar al tema claro cambia el fondo y persiste.
- [x] `CK-3` — Novedades muestra el changelog.
- [x] `CK-4` — Quien actualiza ve la tarjeta de Novedades; quien recién llega, no.
- [x] `CK-5` — La tarjeta de instalación no aparece si ya está instalada.

**Regular Checks:**
- Cada versión: `APP_VERSION` (app.js), `CACHE` (sw.js) y entrada en `CHANGELOG.md` coinciden.
- Solo se cachean pedidos GET del mismo origen.
- Sin dependencias externas en tiempo de ejecución (fuente Oswald local, OFL).

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Disponibilidad | 0,4 | Funciona sin red y se actualiza al volver la conexión |
| Experiencia nativa | 0,3 | Instalación guiada en Android e iPhone |
| Legibilidad | 0,3 | Ambos temas cumplen contraste; sin parpadeo al abrir |

**Rubric Score Definitions:**
- 5: offline, instalable y legible en ambos temas · 3: algún problema de actualización o contraste · 1: no abre sin red.

**Test Strategy:**
- e2e `// 8b3. Tema claro`, `// 8c. Preferencias de sesión y novedades`, `// 10. Datos persistentes y sin conexión`, `// 11.` (tarjeta de novedades).
- Manual: instalar en Android y en iPhone.

**Definition of Done:**
- e2e en verde; versión coherente en los tres archivos.

## Architecture Overview

- `sw.js`, `manifest.webmanifest`, `index.html` (tema temprano, `<dialog>`s, pestañas), `styles.css` (tokens por tema).
- `app.js`: `applyTheme`, `installCard`, `installApp`, `isStandalone`, `isIOS`, `openNews`, `mdLite`, `APP_VERSION`; acciones `theme`, `install`, `install-hide`, `news`, `news-seen`.
- `tests/icon.mjs`.

## Implementation Process

Implementado antes de adoptar SDD. Sin sub-tareas.
