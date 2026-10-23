---
title: Implementar el entreno de cuerpo completo A/B con doble progresión y control de volumen
status: implementado (retro-documentado)
versions: 1.0.0, 1.4.0
depends_on: [peso-sugerido-calibracion.feature.md, equipo-a-medida.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.0.0, 1.4.0, 1.9.0).

Entreno de cuerpo completo alternando días A y B, con doble progresión 8–12 y sin subir el volumen más de un 30 % por semana.

# Description

- **Plantillas** `TEMPLATES.A` y `.B` (6 ejercicios cada una; editables, ver [editor de rutina](editor-rutina-ejercicios-propios.feature.md)). `S.plan.next` alterna A → B → A al terminar cada entreno.
- **Plan del día** (`planFor`): adapta cada ejercicio al equipo, al modo dolor (tope o variante, ver [modo dolor](modo-dolor-rehabilitacion.feature.md)) y a la semana de descarga; calcula series y peso.
- **Volumen**: objetivo semanal = días × ejercicios por día × 3 series. El presupuesto arranca en el objetivo, sube como mucho ×1,3 por semana y nunca sube a mitad de semana (cambiar a 3 días un miércoles no aumenta el volumen hasta el lunes). Se reparte en 2–4 series por ejercicio; las sobrantes van a los primeros (compuestos).
- **Pantalla de entreno** (`#wsheet`): por ejercicio, miniatura animada, series × reps, kg, discos por lado, notas (calibración, modo dolor, mantenimiento), "Cómo se hace" y filas editables kg / reps o segundos / RIR / ✓. Marcar una serie exige reps y arranca el descanso.
- **Doble progresión** al terminar: 12+ reps en todas las series → sube un salto; alguna < 8 → baja un salto. No progresa con tope de dolor, recién calibrado o en descarga.
- **Tipos**: `peso` (kg × reps), `reps` (récord de repeticiones), `tiempo` (sube 5 s hasta 90 s si cumple todas las series), `iso`.
- **Inicio**: tarjeta "Entreno A/B" con "Hoy toca entrenar" / "Hoy es día de descanso (podés entrenar igual)" / "✓ Entreno de hoy hecho" según `S.rem.train`.
- **3 días**: con 2 días, ≥ 4 entrenos en 14 días y dolor ≤ 3, Inicio sugiere pasar a 3.
- Salir sin guardar pide confirmación.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — 2 días × 6 ejercicios × 3 series = 36 series objetivo.
- [x] `CK-2` — Semana nueva: 36 × 1,3 = 46; después llega al objetivo de 54 con 3 días.
- [x] `CK-3` — Cambiar a 3 días a mitad de semana no sube el volumen.
- [x] `CK-4` — 36 series en 2 días = 3 por ejercicio; en 3 días = 2; 46 en 3 días ≈ 45 con compuestos primero.
- [x] `CK-5` — 12 en todas → sube un salto; dentro del rango → mismo peso; alguna < 8 → baja un salto.
- [x] `CK-6` — Con aros el día B incluye el remo invertido; sin aros se reemplaza por remo en silla.
- [x] `CK-7` — Al terminar el A, el próximo es el B.
- [x] `CK-8` — No se puede terminar sin al menos una serie hecha.

**Regular Checks:**
- Reglas de volumen y progresión puras en `logic.js`.
- El estado del entreno en curso (`W`) no se guarda hasta terminar.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Progresión correcta | 0,4 | Sube y baja según la regla, sin progresar con tope/descarga |
| Volumen seguro | 0,3 | Nunca más de +30 % semanal |
| Usabilidad en el gimnasio | 0,3 | Se registra rápido con una mano, sin perder datos |

**Rubric Score Definitions:**
- 5: regla exacta en todos los casos y registro fluido · 3: casos borde sin cubrir · 1: progresiones erróneas.

**Test Strategy:**
- Unit: progresión (`progress`) y volumen (`weekBudget`, `setsPerExercise`, `targetSets`).
- e2e `// 2.` y `// 4. Entreno A con calibración`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `progress`, `targetSets`, `weekBudget`, `setsPerExercise`, `suggestThreeDays`, `weekdayKey`.
- `app.js`: `planFor`, `syncBudget`, `perDay`, `startWorkout`, `renderWorkout`, `setDone`, `finishWorkout`, `saveSession`, `renderHome` (tarjeta de entreno), acción `three-days`.
- `data.js`: `TEMPLATES`, `NO_RINGS`.

## Implementation Process

Implementado antes de adoptar SDD. Sin sub-tareas.
