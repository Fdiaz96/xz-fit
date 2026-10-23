---
title: Implementar la entrada en calor con isométricos y series de aproximación
status: implementado (retro-documentado)
versions: 1.5.0
depends_on: [entreno-ab-progresion-volumen.feature.md, modo-dolor-rehabilitacion.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.5.0).

Al empezar cada entreno, una entrada en calor con casillas: movilidad, un isométrico por zona sensible (baja el dolor antes de cargar) y series de aproximación del primer ejercicio con peso.

# Description

Bloque desplegable "Entrada en calor" arriba del entreno (abierto hasta que se tildan todos los ítems, con contador `n/total`):

1. **Movilidad 3–5 min**: círculos de hombros, muñecas y cadera, sentadillas sin peso.
2. **Con modo dolor**: por cada zona en fase 1–2, "Isométrico de <zona>: 1 × 30–45 s (<ejercicio de fase 1>)".
3. **Series de aproximación** del primer ejercicio con peso > 0: 8 reps al 50 % y 4 al 75 %, redondeadas al equipo, sin repetir pesos y siempre por debajo del peso de trabajo. "(aproximación, no cuenta)": no suman al volumen ni a la progresión.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Aproximación para 10 kg: 4 kg × 8 y 6 kg × 4 (con mancuernas de a 2).
- [x] `CK-2` — Con el peso mínimo no hay series de aproximación.
- [x] `CK-3` — Con modo dolor, incluye el isométrico de la zona sensible.
- [x] `CK-4` — Tocar un ítem lo tilda y actualiza el contador.

**Regular Checks:**
- La entrada en calor vive en `W.warm`, no se guarda en la sesión.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Utilidad | 0,6 | Prepara las zonas sensibles y el primer ejercicio |
| No interfiere | 0,4 | No altera volumen, progresión ni historial |

**Rubric Score Definitions:**
- 5: ambos criterios sin excepciones · 3: ruido menor · 1: altera el registro.

**Test Strategy:**
- Unit: `warmupSets`.
- e2e `// 4.`: "la entrada en calor incluye el isométrico de la zona sensible", "marca un ítem".

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `warmupSets(w, steps)`.
- `app.js`: armado de `warm` en `startWorkout`, render en `renderWorkout`, acción `warm`.

## Implementation Process

Implementado antes de adoptar SDD (1.5.0). Sin sub-tareas.
