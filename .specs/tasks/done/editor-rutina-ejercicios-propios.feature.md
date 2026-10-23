---
title: Implementar el editor de rutina, la biblioteca de ejercicios y los ejercicios propios
status: implementado (retro-documentado)
versions: 1.2.0, 1.7.0
depends_on: [entreno-ab-progresion-volumen.feature.md, equipo-a-medida.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.2.0, 1.7.0).

Poder cambiar, ordenar, quitar y agregar ejercicios de los días A y B, elegir de una biblioteca ilustrada y crear mis propios ejercicios con cualquier equipo, incluidas mis máquinas.

# Description

- **Editar rutina** (Entreno → *Editar rutina*): por día A/B, subir/bajar, cambiar (⇄), quitar o agregar. Botón para volver a la rutina original (`TEMPLATES`). Cada cambio recalcula el presupuesto de volumen.
- **Selector** (`#pickersheet`): primero "Mis ejercicios", luego la biblioteca agrupada por `CATS` (Piernas, Empuje, Tirón, Cadera, Hombro, Brazos, Core) con el grupo del ejercicio actual primero ("· mismo grupo"). Cada fila muestra miniatura, qué tendones exige y, si falta equipo, "Falta: …" deshabilitado.
- **Biblioteca**: 49 ejercicios en total (rehabilitación + entreno), cada uno con `cat`, `tag` (tendones que exige), `alt` (variante amable) cuando corresponde, músculos y figura.
- **Ejercicio propio** (`#exformsheet`, `S.exlib`): nombre, con qué se hace (mancuernas, pesa rusa, banda, máquinas propias o peso corporal), cómo se registra (kilos × reps, solo reps, segundos), peso inicial opcional, grupo, tendones que exige y nota. Tiene ilustración genérica según el implemento (`customFig`). Eliminarlo lo quita de la rutina.
- El historial guarda el nombre de cada ejercicio por si después se borra uno propio.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Cada ejercicio de la biblioteca tiene categoría válida.
- [x] `CK-2` — Con banco, el press en banco se puede elegir; cambiar el press en el suelo por press en banco funciona.
- [x] `CK-3` — Con aros, las dominadas se pueden hacer en aros.
- [x] `CK-4` — Crear un ejercicio propio con una máquina y sumarlo al día B.
- [x] `CK-5` — Reordenar la rutina persiste el nuevo orden.
- [x] `CK-6` — Un ejercicio propio con tendones marcados recibe tope o aviso del modo dolor igual que uno de la biblioteca.
- [x] `CK-7` — Sin nombre no se guarda ("Poné un nombre.").

**Regular Checks:**
- Ids propios con prefijo `c_`; nunca chocan con ids de `EXERCISES`.
- `getEx()` resuelve tanto biblioteca como `exlib`.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Flexibilidad | 0,4 | Cualquier rutina razonable se puede armar |
| Seguridad | 0,3 | Los ejercicios propios también los cuida el modo dolor |
| Descubrimiento | 0,3 | El selector guía hacia reemplazos del mismo grupo y muestra lo que falta |

**Rubric Score Definitions:**
- 5: todas las operaciones funcionan y persisten · 3: alguna operación con fricción · 1: se pierden cambios.

**Test Strategy:**
- Unit: categorías válidas.
- e2e `// 8b. Equipo propio y rutina editable`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `app.js`: `renderTrain`, `tplIds`, `routineSet`, `openPicker`, `missingLabel`, `pickExercise`, `openExForm`, `implOptions`, `renderExForm`, `readExForm`, `saveExForm`, `deleteExForm`, `getEx`, `customFig`.
- `data.js`: `EXERCISES`, `CATS`, mapa de categorías y músculos.
- Estado: `S.templates`, `S.exlib`.

## Implementation Process

Implementado antes de adoptar SDD (1.2.0 editor y ejercicios propios; 1.7.0 13 ejercicios nuevos). Sin sub-tareas.
