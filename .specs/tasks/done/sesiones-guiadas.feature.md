---
title: Implementar sesiones guiadas con temporizador, sonidos, voz y pantalla prendida
status: implementado (retro-documentado)
versions: 1.0.0, 1.3.0
depends_on: [modo-dolor-rehabilitacion.feature.md, entreno-ab-progresion-volumen.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.3.0).

Hacer los isométricos y el entreno sin tocar el teléfono: temporizador manos libres, pitidos, voz opcional, vibración, descanso configurable y pantalla siempre prendida.

# Description

- **Rehabilitación** (`#rsheet`): un ejercicio por vez con ilustración grande, carga y dosis.
  - Isométricos: anillo de cuenta regresiva; estados *listo → sostené → descanso (60 s)*; "Mitad" a la mitad (series ≥ 20 s); cuenta de los últimos 3 s; al terminar la serie, descanso; al terminar el ejercicio, el siguiente.
  - **Manos libres** (`prefs.auto`): después del descanso la serie siguiente arranca sola.
  - Isotónicos lentos: chips por serie y "Siguiente" cuando están todas.
  - Al final, ejercicios del fisio con "Marcar" y "Terminar y anotar dolor".
- **Descanso entre series de entreno**: barra flotante con cuenta regresiva y "Saltar"; 60 s, 90 s (predeterminado), 2 min o 3 min (`prefs.rest`); 60 s para isométricos.
- **Señales** (`cue`): pitido al empezar, tic en los últimos 3 s, doble pitido al terminar (Web Audio), vibración, y voz en español (`es-AR`) opcional: "Sostené", "Mitad", "Descansá", "Siguiente serie".
- **Pantalla prendida** con Wake Lock mientras hay entreno o rehab abiertos; se libera al cerrar.
- Todo se configura en Ajustes → *Durante la sesión*; al tocar sonido o voz, suena una muestra.
- Salir de una sesión pide confirmación y no guarda.
- `calmMotion()` respeta `prefers-reduced-motion`.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Una sesión de rehab guarda 2 isométricos de 3 series cada uno.
- [x] `CK-2` — Marcar una serie del entreno arranca el descanso.
- [x] `CK-3` — Cambiar el descanso a 2 min se guarda en `prefs.rest`.
- [x] `CK-4` — Con `auto` activado, la serie siguiente arranca sola tras el descanso.
- [x] `CK-5` — La rehab de la franja ya hecha queda deshabilitada ("Hecha (mañana)").
- [x] `CK-6` — Sin ningún ejercicio hecho, terminar avisa y no guarda.

**Regular Checks:**
- El temporizador usa `Date.now()` contra un fin absoluto (no se atrasa si el teléfono duerme el intervalo).
- `rehabTick` actualiza solo número y anillo, sin redibujar (no reinicia la animación).
- Fallos de audio, voz o Wake Lock se ignoran sin romper la sesión.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Manos libres | 0,4 | Se puede completar una sesión de isométricos sin tocar la pantalla |
| Precisión del tiempo | 0,3 | Tiempos exactos aun con la pantalla en segundo plano |
| Configurabilidad | 0,3 | Sonido, voz, descanso y auto se ajustan y persisten |

**Rubric Score Definitions:**
- 5: sesión completa sin intervención y tiempos exactos · 3: requiere algún toque · 1: tiempos erráticos.

**Test Strategy:**
- e2e `// 5. Rehabilitación` y `// 8c. Preferencias de sesión y novedades`.
- Manual: escuchar pitidos/voz en un teléfono real y verificar Wake Lock.

**Definition of Done:**
- e2e en verde; prueba manual en Android y iPhone.

## Architecture Overview

- `app.js`: `startRehab`, `renderRehab`, `rehabTick`, `rehabGo`, `rehabSkip`, `finishRehab`, `startRest`, `stopRest`, `cue`, `keepAwake`, `calmMotion`; acciones `rehab-go`, `rehab-skip`, `lento-set`, `rehab-next`, `custom-done`, `finish-rehab`, `cancel-rehab`, `skip-rest`, `pref`, `pref-toggle`.
- `index.html`: `#rest` (barra de descanso).
- Estado: `S.prefs` (`sound`, `voice`, `rest`, `auto`); efímero `R`.

## Implementation Process

Implementado antes de adoptar SDD (1.0.0 temporizador; 1.3.0 sonidos, voz, manos libres, descanso, pantalla prendida). Sin sub-tareas.
