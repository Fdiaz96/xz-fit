---
title: Implementar la detección de estancamiento y la semana de descarga
status: implementado (retro-documentado)
versions: 1.9.0
depends_on: [entreno-ab-progresion-volumen.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.9.0).

Detectar cuando un ejercicio no progresa y sugerir una semana de descarga para destrabar.

# Description

- **Estancado**: un ejercicio con peso que en sus últimas 3 sesiones sin tope (ni dolor ni descarga) repitió el mismo peso máximo y no sumó repeticiones totales. En Entreno aparece "Estancado · bajar 10 % y volver a subir"; el botón baja el peso de trabajo al 90 % redondeado al equipo.
- **Semana de descarga**: con 2 o más ejercicios estancados, Inicio la ofrece nombrando hasta 3. Aceptarla marca `S.plan.deload = weekKey(hoy)`: esa semana cada ejercicio va con una serie menos (mínimo 1) y el 90 % del peso, sin progresar y sin contar para estancamiento. La semana siguiente todo vuelve a la normalidad. Se puede cancelar; "Ahora no" la oculta esa semana.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — 3 sesiones con 10 kg sin sumar repeticiones → estancado.
- [x] `CK-2` — Si las repeticiones suben o el peso sube, no está estancado.
- [x] `CK-3` — Con 2 ejercicios estancados, Inicio sugiere la descarga.
- [x] `CK-4` — El entreno de esa semana avisa "semana de descarga".
- [x] `CK-5` — Bajar 10 %: de 10 a 9 kg redondeado a lo que se puede armar.

**Regular Checks:**
- Las series de descarga se guardan con `capped: true`.
- No se sugiere estancamiento en ejercicios con tope por dolor.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Detección correcta | 0,6 | Sin falsos positivos por dolor o descarga |
| Recuperación | 0,4 | La descarga dura una semana y se vuelve sola a la normalidad |

**Rubric Score Definitions:**
- 5: sin falsos positivos y transición limpia · 3: algún falso positivo · 1: descarga que no termina.

**Test Strategy:**
- Unit: `stalled`.
- e2e `// 8d2. Estancamiento y descarga`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `stalled(state, exId)`.
- `app.js`: `planFor` (`deload`, `stalled`), `renderHome` (oferta), acciones `deload`, `deload-no`, `deload-off`, `unstall`.
- Estado: `S.plan.deload`, `S.plan.deloadOffer`.

## Implementation Process

Implementado antes de adoptar SDD (1.9.0). Sin sub-tareas.
