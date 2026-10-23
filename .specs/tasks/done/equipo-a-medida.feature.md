---
title: Implementar equipo a medida con mancuernas de discos y máquinas propias
status: implementado (retro-documentado)
versions: 1.0.0, 1.2.0, 1.6.0
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.0.0, 1.2.0, 1.6.0).

Que la app sepa exactamente qué equipo tengo, muestre solo los ejercicios que puedo hacer y redondee todos los pesos a lo que realmente puedo armar, incluidas mancuernas de discos y máquinas propias.

# Description

El usuario describe su equipo en el primer uso y en Ajustes → Equipo:

- **Mancuernas**: por rango (mínimo, máximo, salto) o **de discos** (barra de cada mancuerna + lista de discos con peso y cantidad total). Con discos, la app calcula todos los pesos armables (de cada disco se usan múltiplos de 4: igual de cada lado y en las dos mancuernas) y muestra cuáles son.
- **Pesas rusas**: lista de pesos separada por comas.
- **Aros/TRX, banco, barra de dominadas, bandas elásticas**: interruptores.
- **Máquinas y otros equipos**: nombre, mínimo, máximo y salto. Generan el implemento `m:<id>`.

Efectos en el resto de la app:
- Un ejercicio solo aparece si `implFor()` encuentra con qué hacerlo; si no, el selector lo muestra deshabilitado con "Falta: …".
- Sustituciones: sin aros, remo en aros → remo en silla (`NO_RINGS`); sin pesa rusa, ejercicios `alsoDb` usan mancuerna; dominadas en barra o en aros.
- Todo peso sugerido, calibrado o progresado se redondea hacia abajo a `weightSteps()`.
- Con discos, cada ejercicio con mancuernas muestra "Por lado: 2,5 + 1,25 kg".
- Al activar banco o barra, la app sugiere dónde aprovecharlos.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Mancuernas 2–24 de a 2 → 12 pesos; pesas rusas ordenadas.
- [x] `CK-2` — Barra 2 kg + discos de 5, 2,5 y 1,25 (4 de cada uno) → 2; 4,5; 7; 9,5; 12; 14,5; 17; 19,5 kg; 9,5 kg = 2,5 + 1,25 por lado.
- [x] `CK-3` — 8 discos de 2,5 permiten hasta 2 por lado; discos con menos de 4 unidades se ignoran.
- [x] `CK-4` — Press en banco sin banco → no disponible; con banco → mancuernas.
- [x] `CK-5` — Dominadas: sin barra ni aros → no; con aros → `rings`.
- [x] `CK-6` — Máquina 5–20 de a 2,5 → 7 pesos; máquina borrada → el ejercicio queda "falta equipo".
- [x] `CK-7` — Un ejercicio propio con máquina arranca en el mínimo de la máquina para calibrar.
- [x] `CK-8` — En la sesión, con discos, se muestran los discos por lado.
- [x] `CK-9` — Rango de máquina inválido (mín > máx, salto ≤ 0) muestra aviso y no guarda.

**Regular Checks:**
- La lógica de pesos vive en `logic.js` (pura); la UI solo la consume.
- Redondeo siempre hacia abajo: nunca se sugiere más de lo pedido.
- Comparaciones de pesos con tolerancia `1e-9` y redondeo a centésimos.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Exactitud de pesos | 0,5 | Los pesos sugeridos siempre se pueden armar con el equipo real |
| Filtrado de ejercicios | 0,3 | Nunca se propone un ejercicio imposible con el equipo |
| Claridad | 0,2 | El usuario entiende qué le falta y qué discos poner |

**Rubric Score Definitions:**
- 5: ningún caso de peso inarmable ni ejercicio imposible · 3: casos borde menores · 1: sugerencias inválidas frecuentes.

**Test Strategy:**
- Unit: "Equipo", "Equipo extra y máquinas", "Mancuernas de discos".
- e2e `// 8b. Equipo propio y rutina editable` y `// 8b2. Mancuernas de discos`.

**Definition of Done:**
- Unit y e2e en verde; CHANGELOG actualizado.

## Architecture Overview

- `logic.js`: `plateCombos`, `platesFor`, `weightSteps`, `implFor`, `roundDown`, `stepUp`, `stepDown`.
- `app.js`: `equipFields()`, `platesFields()`, `platesLabel()`, `openMachine()`, `saveMachine()`, `missingLabel()`, `resolveEx()`; acciones `eq-db`, `eq-plates`, `eq-rings`, `eq-flag`, `plate-add`, `plate-del`, `mach-edit`, `mach-save`, `mach-del`.
- `data.js`: `needs`, `alsoDb`, `alsoRings`, `NO_RINGS` en los ejercicios.
- Estado: `S.equip` (ver [modelo de datos](../../analysis/modelo-de-datos.md)).

## Implementation Process

Implementado antes de adoptar SDD (1.0.0 rango de mancuernas y pesas rusas; 1.2.0 banco, barra, bandas y máquinas; 1.6.0 discos). Sin sub-tareas.
