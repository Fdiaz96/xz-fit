---
title: Implementar el peso sugerido con serie de calibración
status: implementado (retro-documentado)
versions: 1.0.0
depends_on: [equipo-a-medida.feature.md, primer-uso-perfil.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.0.0) y del README.

Sugerir cuánto levantar la primera vez sin conocer al usuario, quedándose corto a propósito, y ajustar con una serie de calibración (reps + reps en reserva) para obtener el peso de trabajo real.

# Description

**Estimación inicial** (ejercicios `kind: 'peso'` sin `S.lifts[id]`):
- 1RM estimado = peso corporal × `ex.ratio` (1RM de un novato hombre por implemento / peso corporal, coeficientes propios) × factor de sexo × experiencia × edad. La altura no se usa.
- Peso sugerido = 70 % del peso para 10 reps según Epley, redondeado hacia abajo al equipo.
- Ejercicios propios: `start` del usuario o el mínimo del implemento.

**Calibración** (primera serie del ejercicio):
- Nota en el entreno: "Serie de calibración: hacé todas las reps que puedas y frená cuando te queden 2 (RIR 2)".
- Al marcar la serie exige reps y RIR. Con Epley (`w × (1 + (reps + RIR)/30)`) calcula el 1RM y el peso para 12 reps (10 + 2 RIR), redondeado.
- Guarda `S.lifts[id] = { w, e1rm }`, actualiza las series siguientes del día y avisa "Calibrado: tu peso de trabajo es …". Con modo dolor aplica el tope del 60 % ese día.
- En el detalle del ejercicio: peso de trabajo, 1RM estimado y "Volver a calibrar" (borra `S.lifts[id]`).

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Hombre 80 kg novato: press en el suelo arranca con 8 kg por mano.
- [x] `CK-2` — Goblet arranca con la pesa rusa de 12; elevaciones laterales con 2 kg.
- [x] `CK-3` — Mujer de 60 kg arranca más liviano; más experiencia → más peso; más edad → menos peso.
- [x] `CK-4` — Calibración con Epley: muchas reps suben el peso de trabajo; apenas 6 lo bajan.
- [x] `CK-5` — El primer entreno pide calibrar y no deja marcar la serie sin RIR.
- [x] `CK-6` — Tras calibrar, el ejercicio queda con peso de trabajo y no progresa esa misma sesión.

**Regular Checks:**
- La estimación nunca supera el equipo disponible ni redondea hacia arriba.
- Fórmulas en `logic.js`, sin DOM.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Seguridad | 0,5 | El primer peso es conservador (70 %) y nunca excesivo |
| Precisión tras calibrar | 0,3 | El peso de trabajo permite ~10 reps con RIR 2 |
| Transparencia | 0,2 | El usuario entiende qué hacer en la serie de calibración |

**Rubric Score Definitions:**
- 5: estimaciones seguras y calibración correcta en todos los perfiles probados · 3: desvíos en perfiles extremos · 1: sugerencias peligrosas.

**Test Strategy:**
- Unit: bloque de fuerza estimada y calibración (`startWeight`, `calibrate`, `strengthFactor`).
- e2e `// 4. Entreno A con calibración`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `strengthFactor`, `epley1RM`, `weightForReps`, `estimate1RM`, `startWeight`, `calibrate`, constantes `START_FACTOR`, `TARGET_REPS`, `TARGET_RIR`.
- `app.js`: `planFor()` (marca `item.calib`), `setDone()` (calibra en la serie 1), `openExercise()` y acción `recalibrate`.
- `data.js`: `ratio` y `lower` en cada ejercicio con peso.

## Implementation Process

Implementado antes de adoptar SDD (1.0.0). Sin sub-tareas.
