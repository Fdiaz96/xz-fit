---
title: Implementar progreso y motivación con resumen, récords, racha e historial
status: implementado (retro-documentado)
versions: 1.0.0, 1.4.0, 1.7.1
depends_on: [entreno-ab-progresion-volumen.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.4.0, 1.7.1).

Ver el progreso y tener motivación: resumen al terminar el entreno, récords, qué sube la próxima vez, tarjeta semanal con racha e historial con gráficos de dolor y de peso.

# Description

- **Resumen al terminar** (`#sumsheet`): minutos, series y volumen (kg × reps, "1,2k" desde 1000) en números grandes; racha; **Récords** 🏆 (1RM estimado superado en ejercicios con peso, máximo de repeticiones en los de solo reps); **La próxima vez**: qué sube o baja de peso (verde/naranja) o "Mismo peso la próxima"; próximo entreno.
- **Tarjeta semanal** en Inicio: puntos con entrenos de la semana contra el objetivo de días, rehabs hechas contra 14 (fase 1) o 4 (fase 2), y racha 🔥 (semanas seguidas cumpliendo; la actual cuenta si ya se cumplió).
- **Historial**: gráfico de dolor por zona (máximo del día, línea punteada en 4/10) y de peso por ejercicio (peso máximo por sesión, sin series con tope); tocar un punto muestra el valor. Lista de las últimas 60 sesiones con duración, series y detalle desplegable.
- **Eliminar sesión** sin confirmar, con "Deshacer" durante 6 s.
- **Detalle de ejercicio**: tocando la ilustración, vista grande con indicaciones, músculos, peso de trabajo, 1RM y gráfico de progreso.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Resumen: series, volumen y minutos (mínimo 1) correctos.
- [x] `CK-2` — Semana: 1 de 2 entrenos y 2 de 14 rehabs en fase 1.
- [x] `CK-3` — Racha: cuenta las semanas anteriores cumplidas; al cumplir la actual, suma.
- [x] `CK-4` — El resumen del primer entreno muestra 2 series e Inicio "1 entreno hecho esta semana".
- [x] `CK-5` — El gráfico de dolor se muestra y tocar un punto muestra el valor.
- [x] `CK-6` — Eliminar una sesión no pregunta y "Deshacer" la recupera.

**Regular Checks:**
- Gráficos SVG propios (`lineChart`), sin librerías.
- Los récords no se cuentan en la sesión de calibración (no hay 1RM previo).

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Exactitud | 0,4 | Números, récords y racha coinciden con lo registrado |
| Motivación | 0,3 | Logros visibles al terminar y en Inicio |
| Legibilidad | 0,3 | Gráficos claros en teléfono, en ambos temas |

**Rubric Score Definitions:**
- 5: todo exacto y legible · 3: algún número dudoso o gráfico confuso · 1: datos incorrectos.

**Test Strategy:**
- Unit: `weekStats`, `streak`, `sessionSummary`.
- e2e `// 4.` (resumen), `// 8. Historial`, `// 8e. Eliminar sesión y deshacer`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `weekStats`, `streak`, `sessionSummary`, `epley1RM`.
- `app.js`: `finishWorkout` (prs/ups), `showSummary`, `renderHome` (tarjeta semanal), `renderHistory`, `weightHistory`, `painHistory`, `lineChart`, `showTip`, `openExercise`, `toast(msg, undo)`; acciones `del-session`, `hist-zone`, `hist-ex`, `ex-detail`.

## Implementation Process

Implementado antes de adoptar SDD (1.0.0 historial; 1.4.0 resumen, récords, racha; 1.7.1 deshacer y detalle). Sin sub-tareas.
