---
title: Implementar ilustraciones animadas propias en SVG con vista isométrica 3D
status: implementado (retro-documentado)
versions: 1.1.0, 1.11.0, 1.12.0, 1.13.x, 1.14.0
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.1.0 → 1.14.0).

Ilustraciones propias de cada ejercicio, sin imágenes de terceros, con movimiento fluido, vista 3D y el músculo trabajado en rojo.

# Description

`figureSVG(ex, { animate, size, crop, muscles, at })` dibuja cada ejercicio como SVG generado por código:

- **Personaje**: remera amarilla, short gris, zapatillas blancas, pelo, cara con expresión que indica hacia dónde mira, contorno limpio (`OW`).
- **Posturas** en `data.js` (`fig.a` y `fig.b`): articulaciones en un lienzo 200×170, vista de costado (o `front: true`). `pose3D` las lleva a 3D (profundidad por `LIMB_Z`, `x` adelante/atrás de frente) y `poseAt` interpola con `slerp` (los segmentos mantienen su largo).
- **Animación**: `FRAMES = 6` cuadros con easing coseno, a la duración del ejercicio (`dur`, p. ej. 6 s para los lentos 3/3). Isométricos estáticos.
- **Cámara isométrica**: `camera(yaw, pitch)`; automática entre tres cuartos de frente y perfil (`pickCam`), o a mano (`fig.cam`, `fig.pitch`) donde hace falta (dominadas de atrás, sumo desde arriba, RDL de perfil, press acostados).
- **Músculos** (`ex.mus`, `MUSCLE_NAMES`): parches en rojo calculados según hacia dónde se dobla la articulación; el principal puede asomarse por el borde, los secundarios se ocultan; un músculo que apunta a la cámara queda como gota chica. Se pueden apagar (`muscles: false`).
- **Utilería**: mancuernas con orientación (`grip`: end, along, neutral, roll), pesa rusa (delante o detrás del cuerpo), aros con correas, bandas atadas, toalla, silla, banco, pared, flecha de empuje.
- **Miniaturas animadas** en Entreno y Tendones (`crop: true`); estáticas en el selector.
- `animaciones.html`: página temporal que muestra todas para revisión.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Cada ejercicio produce un `<svg>`; hay versión animada y estática.
- [x] `CK-2` — Cada ejercicio dice qué músculos trabaja y el músculo se ilumina en rojo (y se puede apagar).
- [x] `CK-3` — Mancuernas en 3D sobre el piso isométrico; con las dos manos libres hay dos, en el remo a un brazo, una.
- [x] `CK-4` — Ninguna ilustración tiene coordenadas inválidas (NaN/Infinity).
- [x] `CK-5` — Las miniaturas del entreno están animadas.
- [x] `CK-6` — Respeta `prefers-reduced-motion` (`calmMotion`).

**Regular Checks:**
- Sin imágenes ni assets de terceros: todo es código vectorial.
- Coordenadas redondeadas a 0,1 para SVG livianos.
- Cada ajuste de postura o cámara se revisa visualmente en `animaciones.html`.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Fidelidad biomecánica | 0,4 | La postura y el recorrido enseñan bien el ejercicio |
| Claridad del músculo | 0,3 | El rojo cae sobre el músculo correcto en todo el movimiento |
| Rendimiento | 0,3 | Livianos y fluidos en un teléfono de gama media |

**Rubric Score Definitions:**
- 5: todas las ilustraciones fieles y claras · 3: algunas con defectos visibles · 1: ilustraciones engañosas.

**Test Strategy:**
- Unit: bloque de `figureSVG` (SVG válido, músculos, mancuernas, coordenadas).
- e2e: "las miniaturas del entreno están animadas".
- Visual: `animaciones.html` y capturas con `SHOTS=`.

**Definition of Done:**
- Unit en verde y revisión visual en `animaciones.html`.

## Architecture Overview

- `figures.js`: `camera`, `prj`, `pose3D`, `poseAt`, `slerp`, `framesOf`, `capsule`, `ellipse`, `disc`, `lens`, `patch`, `patchesOver`, `pickCam`, `muscleStats`, `figureSVG`, `box`, `sceneBoxes`, `handleDir`, `propSVG`; paleta `PAL`, `MUS`.
- `data.js`: `fig` de cada ejercicio, posturas base (`STAND`, `SEATED`, `HINGE`, `LYING`), mapas de músculos, agarre, cámara.
- `app.js`: `customFig` para ejercicios propios.

## Implementation Process

Implementado antes de adoptar SDD, en muchas iteraciones (1.1.0 primeras ilustraciones; 1.11.0 músculo en rojo; 1.12.0 vista isométrica; 1.13.x revisiones; 1.14.0 miniaturas animadas). Sin sub-tareas.
