---
title: Implementar el motor de planes con huecos por patrón, rotación y rangos por ejercicio
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 1 de 7 de la ruta "planes de entrenamiento" (definida con `/sdd:brainstorm` el 2026-10-26). Base sin planes nuevos visibles: el único plan es *Full body 2 días*, que equivale al A/B actual. Fuente de los principios: [fuente-mono-culturista.md](../../analysis/fuente-mono-culturista.md).

**Enfoque elegido: híbrido.** Los ejercicios se guardan resueltos y cada uno recuerda su hueco; solo se re-resuelve lo que dejó de ser posible y se respeta lo que fijó el usuario.

**Datos (`data.js`):**
- `SLOTS`: patrones de movimiento (empuje horizontal, empuje inclinado, empuje vertical, tracción vertical, tracción horizontal, rodilla dominante, unilateral, bisagra, glúteo, gemelos, lateral, deltoides posterior, bíceps, tríceps, abdominal, isométrico), cada uno con la lista de ejercicios de la biblioteca en orden de preferencia.
- Cada ejercicio declara `reps: [mín, máx]` por tipo: compuesto 6–12, aislamiento 10–15, hombro lateral/posterior 12–20, abdominal con peso 10–15. Sin dato → `[8, 12]`.
- `PLANS`: `{ id, name, days: [{ name, slots: [{ slot, sets }] }], source }`. En esta tarea solo `fb2` (*Full body 2 días*, los huecos de `TEMPLATES.A/B`).

**Estado (`S`):**
- `S.plan = { id: 'fb2', pos, since, bw, deload, deloadOffer }`; se eliminan `budget`/`week`/`next`.
- `S.routine = { [planId]: [[{ slot, ex, pinned }…] /* por día */] }`.
- Migración en `withDefaults`: `templates.A/B` → `routine.fb2` con `pinned: true` (no se pierde ninguna edición); `plan.next` 'A'/'B' → `pos` 0/1.

**Reglas puras (`logic.js`):**
- `resolveSlot(slot, equip, { bw, exclude })`: primer ejercicio posible del hueco (`bw` = solo peso corporal).
- `resolveDay(items, equip, opts)`: re-resuelve solo los ítems no fijados que ya no son posibles; los fijados imposibles se avisan una vez y se re-resuelven.
- `nextDay(plan, pos)`: rotación; el próximo es el siguiente al último hecho, sin importar el día de la semana.
- `setsFor(sets, semanas, deload)`: −1 serie las primeras 2 semanas de un plan (rampa de entrada) y −1 en descarga, mínimo 1.
- `progress(w, sets, steps, [mín, máx])` y `calibrate(...)` con rango: sube cuando todas las series llegan al máximo; baja cuando alguna queda debajo del mínimo; calibra al centro del rango con RIR 2. Sin rango, el comportamiento es idéntico al actual.
- Se dejan de usar `weekBudget`, `setsPerExercise` y `targetSets` para armar el entreno.

**Interfaz mínima:**
- Inicio: tarjeta "<nombre del día> · N ejercicios" (en lugar de "Entreno A").
- Entreno y resumen muestran el rango real ("3 × 12–20", "cuando hagas 20 en todas, sube").
- Editar rutina: una pestaña por día del plan; ⇄ abre el selector con primero los ejercicios del mismo hueco y deja el elegido fijado; "Volver al plan original" re-resuelve los huecos.
- La tarjeta semanal compara contra la cantidad de días del plan.
- Sesiones guardan `plan` y `day` (además de `tpl` por compatibilidad).

**Sin cambios:** modo dolor (tope/variante sobre el ejercicio resuelto), calibración, estancamiento, descarga, historial e informe (todo sigue por id de ejercicio).

**Errores:** hueco sin ejercicio posible → ítem "Falta equipo"; plan inexistente → `fb2`.

**Pruebas:** unit de `resolveSlot`, `resolveDay` (respeta fijados), `nextDay`, `setsFor`, `progress`/`calibrate` con y sin rango (las pruebas actuales siguen pasando); e2e de migración desde v1.14 con la rutina A/B editada intacta y del flujo completo de entreno con rotación.

**Fuera de alcance:** planes nuevos, selector de planes, encuesta, descanso por ejercicio, pasos y cardio.

# Description

> **Required Skill**: You MUST use and analyse `training-plan-engine` skill before doing any modification to task file or starting implementation of it!
>
> Skill location: `.claude/skills/training-plan-engine/SKILL.md`

Hoy el núcleo de entreno de XZ Fit está atado a una única rutina de dos plantillas (A y B): el próximo día alterna entre A y B, las series salen de un presupuesto semanal ligado a los días del perfil y todos los ejercicios con peso progresan con el mismo rango de 8–12 repeticiones. Con ese diseño no se puede agregar ningún plan nuevo (Full body 3 días, torso/pierna, empuje/tracción, por grupos, isométricos) ni la encuesta de elección sin reescribir el núcleo cada vez. Esta tarea, la primera de la ruta "planes de entrenamiento", reemplaza esas plantillas por un **motor de planes**: un plan es una lista de días y cada día una lista de **huecos** (patrones de movimiento: empuje horizontal, tracción vertical, bisagra, lateral…) con su cantidad de series; cada hueco se llena con el primer ejercicio de la biblioteca que el equipo del usuario permite. Los días se recorren en **rotación** (el próximo es el siguiente al último hecho, sin importar el día de la semana) y cada ejercicio progresa dentro de **su propio rango** de repeticiones, siguiendo la doble progresión del canal Mono Culturista (compuestos 6–12, aislamiento 10–15, hombro lateral/posterior 12–20, abdominal con peso 10–15).

El valor para el usuario es doble: una progresión más adecuada a cada tipo de ejercicio (por ejemplo, las elevaciones laterales suben de peso al llegar a 20 repeticiones, no a 12) y una rampa de entrada (una serie menos las dos primeras semanas de un plan) que hace más llevadero el comienzo. El valor para el producto es habilitar las seis tareas siguientes de la ruta. El único plan disponible al terminar es **Full body 2 días**, equivalente al A/B actual: un usuario con el equipo por defecto ve los mismos ejercicios que hoy.

Se benefician los usuarios actuales y los nuevos. Los datos viven solo en el dispositivo, sin copia en un servidor, así que la migración **no puede perder nada**: la rutina A/B que cada usuario editó (cambios, ejercicios propios, orden) pasa intacta al plan y queda "fijada"; los pesos, récords, historial e informe siguen por ejercicio; y se conserva el día que tocaba. El enfoque es híbrido: los ejercicios se guardan ya resueltos y solo se vuelven a resolver los que dejaron de ser posibles (por ejemplo, porque el usuario quitó un equipo). Lo que el usuario eligió a mano se respeta y, si deja de ser posible, se le avisa una sola vez antes de reemplazarlo.

Supuestos aplicados (valores por defecto razonables):
- Cada hueco de Full body 2 días lleva 3 series. Los días se llaman "Día A" y "Día B", y las sesiones siguen guardando la letra (A/B) para que el historial existente se lea igual.
- La rampa de entrada aplica mientras pasaron menos de 2 semanas completas (días 0 a 13) desde el inicio del plan. Para un usuario que actualiza y ya tenía entrenos guardados, el inicio del plan es la fecha de su primer entreno (quien ya entrenaba hace más de 2 semanas no pierde series). Para quien no tenía entrenos, es la fecha de la actualización o del alta.
- El rango que se apunta al calibrar es el centro del rango redondeado más 2 repeticiones en reserva: con 8–12 da 12 (igual que hoy), con 12–20 da 18, con 10–15 da 15.
- La tarjeta semanal compara los entrenos de la semana contra la cantidad de días del plan activo (2 en Full body 2 días). La racha y la sugerencia "¿Pasamos a 3 días?" no cambian en esta tarea.
- Los ejercicios migrados que no figuran en ningún hueco (ejercicios propios o agregados a mano) se conservan fijados y nunca se re-resuelven solos.
- Al migrar sin aros, el remo en aros se guarda como remo en silla (lo que la v1.14 ya mostraba), fijado y sin aviso. *(agregado en la arquitectura, decisión AD-1)*

**Scope**:
- Included:
  - Catálogo de 16 huecos por patrón de movimiento, cada uno con sus ejercicios en orden de preferencia.
  - Rango de repeticiones por ejercicio según su tipo, con 8–12 por defecto.
  - Catálogo de planes con un único plan: Full body 2 días (equivalente al A/B actual).
  - Nuevo modelo de plan activo y rutina por plan, con migración sin pérdidas desde cualquier versión anterior (v1.0 a v1.14) y desde copias de seguridad importadas.
  - Reglas: resolver un hueco, resolver un día respetando lo fijado, rotación de días, series con rampa y descarga, progresión y calibración por rango.
  - Interfaz mínima: tarjeta de inicio con el nombre del día, rango real en entreno y resumen, editor de rutina con una pestaña por día y selector que prioriza el mismo hueco, "Volver al plan original", tarjeta semanal contra los días del plan.
  - Sesiones que registran plan y día.
  - Errores: hueco sin ejercicio posible ("Falta equipo") y plan inexistente (vuelve a Full body 2 días).
  - Pruebas unitarias y de punta a punta descritas abajo, versión nueva en el registro de cambios.
- Excluded:
  - Planes nuevos (Full body 3 días, torso/pierna, empuje/tracción, grupos 5 días, isométricos).
  - Selector u hoja de elección de plan, encuesta.
  - Descanso por ejercicio, pasos, cardio.
  - Cambios en las reglas de modo dolor, calibración (salvo el rango), estancamiento, descarga, historial, informe, racha, recordatorios y la sugerencia "¿Pasamos a 3 días?".

**User Scenarios**:
1. **Primary Flow**: El usuario abre la app y el inicio muestra "Día A · 6 ejercicios". Empieza el entreno y cada ejercicio muestra su rango real (por ejemplo "3 × 12–20" en elevaciones laterales). Al terminar, el resumen indica cuándo sube cada ejercicio ("cuando hagas 20 en todas, sube") y que el próximo es el Día B. La próxima vez que abre la app, aunque hayan pasado varios días o sea otro día de la semana, le toca el Día B.
2. **Alternative Flow (usuario que actualiza)**: Alguien que en la v1.14 había cambiado el press en el suelo por press en banco, sumado un ejercicio propio al día B y tenía pendiente el B, actualiza la app. Ve exactamente su misma rutina (mismos ejercicios, mismo orden), le toca el Día B, conserva pesos e historial y no recibe series de menos.
3. **Alternative Flow (editar rutina)**: En Entreno → Editar rutina elige la pestaña del Día B y toca ⇄ sobre el remo. El selector muestra primero los ejercicios de tracción horizontal. El elegido queda fijado y sigue ahí al reabrir la app. "Volver al plan original" vuelve a llenar los huecos según su equipo, sin borrar sus ejercicios propios.
4. **Error Handling**: Si el usuario quita un equipo y un hueco ya no tiene ningún ejercicio posible, ese ítem aparece como "Falta equipo" y el entreno se puede empezar con el resto. Si un ejercicio que él había fijado deja de ser posible, se le avisa una sola vez y se reemplaza por el primero posible de su hueco. Si los datos guardados apuntan a un plan que no existe, la app usa Full body 2 días sin errores.

---

## Acceptance Criteria

**Checklist:**

| ID | Question | Category | Importance |
|----|----------|----------|------------|
| CK-1 | ¿El catálogo de huecos define exactamente los 16 patrones pedidos (empuje horizontal, empuje inclinado, empuje vertical, tracción vertical, tracción horizontal, rodilla dominante, unilateral, bisagra, glúteo, gemelos, lateral, deltoides posterior, bíceps, tríceps, abdominal, isométrico), cada uno con una lista ordenada no vacía cuyos ids existen todos en la biblioteca de ejercicios? | hard_rule | essential |
| CK-2 | ¿Cada ejercicio de la biblioteca de tipo `peso` o `reps` usado en algún hueco expone un rango `[mín, máx]` que coincide con su tipo (compuesto 6–12, aislamiento 10–15, hombro lateral/posterior 12–20, abdominal con peso 10–15), y un ejercicio sin dato se trata como `[8, 12]`? | hard_rule | important |
| CK-3 | ¿El catálogo de planes contiene solo `fb2` "Full body 2 días", con 2 días ("Día A", "Día B") cuyos huecos siguen el orden de `TEMPLATES.A` y `TEMPLATES.B`, 3 series por hueco y una fuente? | hard_rule | essential |
| CK-4 | Con el equipo por defecto (mancuernas 2–24, sin aros, banco, barra ni banda), ¿resolver `fb2` da exactamente las listas de ejercicios que hoy arma la app para A y B (con remo en silla en lugar de remo en aros, como hace hoy sin aros), en el mismo orden? | hard_rule | essential |
| CK-5 | Al cargar datos guardados por la v1.14 con `templates.A/B` editados (ejercicio cambiado, ejercicio propio agregado, orden alterado), ¿`routine.fb2` queda con los mismos ejercicios en el mismo orden por día (salvo el reemplazo sin aros que la v1.14 ya mostraba: remo en aros → remo en silla) y todos con `pinned: true`? | hard_rule | essential |
| CK-6 | ¿La migración convierte `plan.next` 'A' → `pos` 0 y 'B' → `pos` 1, deja `plan.id = 'fb2'`, quita `budget`/`week`/`next`, no modifica `lifts` ni `sessions`, y es idempotente (cargar o importar dos veces da el mismo resultado)? | hard_rule | essential |
| CK-7 | ¿El inicio del plan de un usuario migrado con entrenos guardados es la fecha de su primer entreno (sin rampa si fue hace 14 días o más), y el de un usuario sin entrenos o nuevo es la fecha de la migración o del alta (con rampa)? | hard_rule | important |
| CK-8 | ¿`resolveSlot` devuelve el primer ejercicio de la lista del hueco que el equipo permite, y `null` cuando ninguno es posible? | hard_rule | essential |
| CK-9 | ¿`resolveSlot` con `bw: true` devuelve solo ejercicios que se hacen con peso corporal y con `exclude` saltea los ids indicados? | hard_rule | essential |
| CK-10 | ¿`resolveDay` deja sin cambios todo ítem que sigue siendo posible (fijado o no), aunque un ejercicio más preferido de su hueco se haya vuelto posible, y sin modificar el arreglo recibido? | hard_rule | essential |
| CK-11 | ¿`resolveDay` reemplaza cada ítem no fijado que dejó de ser posible por el primer ejercicio posible de su hueco que no esté ya en ese día? | hard_rule | essential |
| CK-12 | ¿Un ítem fijado que dejó de ser posible se re-resuelve y el usuario ve el aviso exactamente una vez (no en cada render ni en cada apertura)? | hard_rule | important |
| CK-13 | ¿`nextDay` devuelve el índice del día siguiente, vuelve a 0 después del último día y devuelve 0 si la posición está fuera de rango? | hard_rule | essential |
| CK-14 | Al terminar un entreno, ¿el próximo día propuesto es el siguiente al día recién hecho, sin importar el día de la semana, los días sin entrenar ni qué día se empezó a mano? | hard_rule | essential |
| CK-15 | ¿`setsFor` resta 1 serie mientras pasaron menos de 2 semanas completas desde el inicio del plan, resta 1 en semana de descarga, y nunca devuelve menos de 1? | hard_rule | essential |
| CK-16 | Con rango, ¿`progress` sube un salto solo cuando todas las series hechas llegan al máximo, baja un salto cuando alguna queda por debajo del mínimo, y mantiene el peso en otro caso? | hard_rule | essential |
| CK-17 | Con rango, ¿`calibrate` calcula el peso de trabajo para el centro del rango redondeado más 2 repeticiones en reserva (8–12 → 12, 12–20 → 18, 10–15 → 15, 6–12 → 11)? | hard_rule | essential |
| CK-18 | Sin rango, ¿`progress` y `calibrate` dan los mismos resultados que hoy, con todas las verificaciones previas de las pruebas unitarias pasando sin modificarse? | hard_rule | essential |
| CK-19 | ¿Las series de cada ejercicio del entreno salen de las series del hueco pasadas por `setsFor`, sin usar `weekBudget`, `setsPerExercise` ni `targetSets` para armar el entreno? | hard_rule | important |
| CK-20 | ¿La tarjeta de inicio dice "<nombre del día> · N ejercicios", con N igual a la cantidad de ítems resolubles del día (y ya no "Entreno A" ni "Cuerpo completo")? | hard_rule | important |
| CK-21 | ¿El entreno muestra "<series> × <mín>–<máx>" con el rango real de cada ejercicio y el resumen muestra "cuando hagas <máx> en todas, sube"? | hard_rule | important |
| CK-22 | ¿Editar rutina muestra una pestaña por día del plan, ⇄ lista primero los ejercicios del mismo hueco, y el ejercicio elegido queda fijado y persiste al recargar? | hard_rule | essential |
| CK-23 | ¿"Volver al plan original" re-resuelve todos los huecos del plan (sin fijados) y no borra los ejercicios propios de la biblioteca del usuario? | hard_rule | important |
| CK-24 | ¿La tarjeta semanal usa como objetivo la cantidad de días del plan activo (2 en `fb2`)? | hard_rule | important |
| CK-25 | ¿Cada sesión de entreno guardada incluye `plan`, `day` y `tpl`, y el historial sigue mostrando las sesiones viejas (solo con `tpl`) sin errores? | hard_rule | essential |
| CK-26 | ¿Un hueco sin ejercicio posible aparece como ítem "Falta equipo" y el entreno se puede empezar igual con los demás ítems, sin incluir el faltante? | hard_rule | essential |
| CK-27 | ¿Un `S.plan.id` inexistente hace que la app use `fb2` sin errores de JavaScript? | hard_rule | essential |
| CK-28 | ¿Modo dolor (tope al 60 % y variante), calibración, estancamiento con oferta de descarga, descarga (−1 serie y 90 % del peso), historial e informe siguen funcionando sobre los ejercicios resueltos? | hard_rule | essential |
| CK-29 | ¿Hay entrada nueva en `CHANGELOG.md`, sube `APP_VERSION` en `app.js` y cambia el nombre del caché en `sw.js`? | hard_rule | important |
| CK-30 | ¿Queda algún camino del código que, tras la migración, lea `S.templates`, `TEMPLATES` como rutina del usuario, `plan.next` o `plan.budget` (por ejemplo, la búsqueda de ejercicios estancados del inicio o el aviso de banco en Ajustes)? | principle | pitfall |
| CK-31 | ¿La entrega expone algo fuera de alcance: un plan nuevo, un selector de planes, la encuesta, descanso por ejercicio, pasos o cardio? | hard_rule | pitfall |
| CK-32 | ¿Un usuario migrado sin aros que tenía el remo en aros en su rutina recibe un aviso de "ejercicio fijado imposible" al abrir la app por primera vez tras actualizar (cuando hoy ya se le reemplazaba en silencio por el remo en silla)? | principle | pitfall |
| CK-33 | ¿`node tests/unit.mjs` termina con código 0? | hard_rule | essential |
| CK-34 | ¿`node tests/e2e.mjs` (con `python -m http.server 8124` corriendo) termina con código 0? | hard_rule | essential |
| CK-35 | ¿El código nuevo evita duplicar lógica existente (por ejemplo, mantener el reemplazo `NO_RINGS` en paralelo a la resolución por hueco al armar el entreno, o copiar la lógica de `implFor`)? | principle | important |
| CK-36 | ¿La decisión de si un ejercicio "es posible" reutiliza `implFor` (y las directivas de reutilización que defina la arquitectura) en lugar de reimplementarla? | principle | important |
| CK-37 | ¿Se hicieron mejoras pequeñas y acotadas al código tocado (nombres, código que dejó de usarse en la interfaz) sin ampliar el alcance? | principle | optional |
| CK-38 | ¿Cada tipo de prueba de la **Test Matrix** (unit, e2e) tiene al menos una prueba en la implementación? | hard_rule | essential |
| CK-39 | ¿Cada caso de **Test Cases to Cover** tiene una prueba implementada que pasa? | hard_rule | essential |
| CK-40 | ¿Cada ítem verificable del checklist (CK-1 a CK-28 y CK-32) se resuelve en al menos una prueba real que pasa, sin huérfanos? | hard_rule | essential |

**Regular Checks:**

- [ ] Pruebas unitarias pasan: `node tests/unit.mjs`
- [ ] Pruebas de punta a punta pasan: `python -m http.server 8124` y `node tests/e2e.mjs`
- [ ] Sin duplicación: el código nuevo no repite funciones, lógica o conceptos que ya existen (`implFor`, `NO_RINGS`, `weightSteps`)
- [ ] Boy Scout Rule: mejoras pequeñas y acotadas al código tocado, sin ampliar el alcance
- [ ] Reutilización respetada: la implementación importa o llama el código existente indicado en las directivas "Reuses From" / "Reuse:" de la arquitectura
- [ ] Cada tipo de prueba elegido en la **Test Matrix** (unit, e2e) tiene al menos una prueba
- [ ] Cada fila de la **Test Matrix** y cada caso de **Test Cases to Cover** tiene una prueba
- [ ] Cada ítem verificable del checklist se resuelve en al menos una prueba real que pasa, sin huérfanos
- [ ] `CHANGELOG.md`, `APP_VERSION` y el nombre del caché de `sw.js` actualizados

**Rubric:**

| Criterion | Weight |
|-----------|--------|
| Preservación de la rutina en la migración | 0.20 |
| Re-resolución mínima | 0.17 |
| Progresión por rango | 0.15 |
| Rotación por secuencia | 0.10 |
| Rango visible en la interfaz | 0.08 |
| Cobertura de casos límite y fijados | 0.15 |
| Project Guidelines Alignment | 0.15 |

**Rubric Score Definitions:**

Scale: 1-5 integers, anchor-relative — each criterion pins `score_2`/`score_4`, and 1/3/5 are placed relative to them.

### Preservación de la rutina en la migración

¿La migración desde datos anteriores conserva literalmente la rutina que el usuario tenía (ejercicios, orden, ejercicios propios) como ítems fijados, en lugar de reconstruirla desde los huecos? ¿Se conservan pesos, sesiones y el día que tocaba?

Cargá datos de la v1.14 con A/B editados y un ejercicio propio, y compará `templates.A/B` de entrada con `routine.fb2` de salida ítem por ítem (id y `pinned`); verificá también `pos`, `lifts` y `sessions`. Cada ejercicio cambiado, perdido, reordenado o no fijado acerca la entrega a `score_2`. Una migración que además es idempotente (cargar o importar dos veces no cambia nada) y cubre los datos de la v1.0 va más allá de `score_4` en este mismo eje. Ubicá la evidencia frente a los anchors.

#### Anchors

**contrast**: Los ejercicios guardados por el usuario pasan tal cual y fijados, en lugar de recalcularse desde los huecos.

**score_2**:

```text
routine: d.routine || { fb2: PLANS.fb2.days.map((day) => day.slots.map((s) => ({ slot: s.slot, ex: resolveSlot(s.slot, equip), pinned: false }))) }
```

**score_4**:

```text
routine: d.routine || { fb2: ['A', 'B'].map((k) => d.templates[k].map((ex) => ({ slot: slotOf(ex), ex, pinned: true }))) }
```

### Re-resolución mínima

¿El motor solo cambia los ejercicios que dejaron de ser posibles, dejando estable todo lo demás (fijado o no), como pide el enfoque híbrido?

Revisá la regla que resuelve un día y probá: un ítem no fijado todavía posible cuando un ejercicio más preferido de su hueco se vuelve posible; un ítem no fijado imposible; un ítem fijado imposible. Ubicá la entrega frente a los anchors según cuántos ítems posibles cambia sin necesidad.

#### Anchors

**contrast**: Un ítem que sigue siendo posible se conserva, en lugar de re-resolverse siempre.

**score_2**:

```text
const resolveDay = (items, equip, o) => items.map((it) => ({ ...it, ex: resolveSlot(it.slot, equip, o) }));
```

**score_4**:

```text
const resolveDay = (items, equip, o) => items.map((it) => possible(it.ex, equip) ? it : { ...it, ex: resolveSlot(it.slot, equip, o) });
```

### Progresión por rango

¿La subida, la bajada y la calibración del peso usan el rango propio del ejercicio, y caen al comportamiento actual (8–12) solo cuando no hay rango?

Seguí el rango desde el dato del ejercicio hasta `progress` (al terminar el entreno) y `calibrate` (en la serie de calibración). Ubicá la entrega frente a los anchors según si los límites usados son los del ejercicio o constantes fijas.

#### Anchors

**contrast**: Los límites de la doble progresión salen del rango recibido, no de las constantes 8/12.

**score_2**:

```text
function progress(w, sets, steps, range) { ... if (done.every((s) => s.reps >= REPS_MAX)) return stepUp(steps, w); ... }
```

**score_4**:

```text
function progress(w, sets, steps, [lo, hi] = [REPS_MIN, REPS_MAX]) { ... if (done.every((s) => s.reps >= hi)) return stepUp(steps, w); ... }
```

### Rotación por secuencia

¿El próximo día se decide por la posición en el plan (el siguiente al último hecho) y no por el día de la semana ni por una alternancia fija A/B?

Revisá cómo se actualiza la posición al terminar un entreno y cómo se elige el día del inicio. Ubicá la entrega frente a los anchors.

#### Anchors

**contrast**: La posición avanza desde el día recién hecho, en lugar de derivarse del día de la semana.

**score_2**:

```text
S.plan.pos = plan.days.findIndex((d) => d.weekday === weekdayKey(today()));
```

**score_4**:

```text
S.plan.pos = nextDay(plan, doneDayIdx);
```

### Rango visible en la interfaz

¿El entreno y el resumen muestran el rango real del ejercicio, tomado del mismo dato que usa la progresión, en lugar de un texto fijo?

Abrí un entreno con elevaciones laterales y un compuesto, y leé la línea de series y la indicación de subida del resumen. Ubicá la entrega frente a los anchors.

#### Anchors

**contrast**: El texto usa el rango del ejercicio, no un "8–12" fijo.

**score_2**:

```text
`${it.sets} × 8–12 reps`
```

**score_4**:

```text
`${it.sets} × ${lo}–${hi} reps`
```

### Cobertura de casos límite y fijados

¿Las pruebas ejercitan los casos donde el motor puede equivocarse (fijados, imposibles, bordes de semana y de repeticiones, vuelta de la rotación), y no solo el camino feliz?

Listá las pruebas nuevas y marcá cuáles cubren: ítem fijado posible/imposible, no fijado imposible, hueco sin ejercicio, semanas 1/2/3 de la rampa, repeticiones en mín−1/mín y máx−1/máx, último día → primero. Ubicá la entrega frente a los anchors.

#### Anchors

**contrast**: Hay prueba del caso fijado imposible además del caso feliz.

**score_2**:

```text
eq(L('resolveSlot("bisagra", equip)'), 'rdl', 'primer ejercicio de bisagra');
```

**score_4**:

```text
eq(L('resolveSlot("bisagra", equip)'), 'rdl', 'primer ejercicio de bisagra');
eq(L('resolveDay([{ slot: "empuje_h", ex: "press_banco", pinned: true }], sinBanco).items[0].ex'), 'press_suelo', 'fijado imposible → se re-resuelve');
```

### Project Guidelines Alignment

¿La entrega respeta las convenciones de `.specs/README.md` y `.specs/analysis/arquitectura.md`: toda regla nueva como función pura en `logic.js` con su prueba en `tests/unit.mjs`, todo flujo visible en `tests/e2e.mjs`, campos nuevos con valor por defecto en `DEFAULT()`/`withDefaults()` verificados por la prueba de migración, textos en español rioplatense, y entrada en `CHANGELOG.md` + `APP_VERSION` + caché de `sw.js`? Como referencia de patrón, ver `.claude/skills/training-plan-engine/SKILL.md`.

Para cada convención, citá la regla y el código que la cumple o la viola. Las convenciones de reglas puras con prueba y de migración pesan más que las de texto y versión. Ubicá la evidencia frente a los anchors.

#### Anchors

**contrast**: La regla de rampa vive como función pura en `logic.js` con su prueba, en lugar de estar escrita dentro del armado del entreno en `app.js`.

**score_2**:

```text
// app.js, al armar el entreno
let sets = slot.sets; if (daysBetween(S.plan.since, today()) < 14) sets--;
```

**score_4**:

```text
// logic.js
const setsFor = (sets, weeks, deload) => Math.max(1, sets - (weeks < 2 ? 1 : 0) - (deload ? 1 : 0));
// tests/unit.mjs
eq(L('setsFor(3, 1, false)'), 2, 'rampa: semana 1 → una serie menos');
```

**Test Strategy:**

**Criticality:** HIGH

**Test Matrix:**

| Type | Size | Framework | Dependencies | Gate |
|------|------|-----------|--------------|------|
| unit | small | `node tests/unit.mjs` (contexto `vm` con `data.js`, `logic.js`, `figures.js`) | — | Gate 1 |
| e2e | large | Playwright + Chromium (`tests/e2e.mjs`, viewport 390×844) | `python -m http.server 8124`, IndexedDB del navegador | Gate 3 |

**Test Cases to Cover**

#### CK-1: ¿El catálogo de huecos define exactamente los 16 patrones, cada uno con ids existentes?
- [unit] SLOTS tiene exactamente los 16 patrones pedidos y ninguno más
- [unit] cada lista de SLOTS es no vacía y todos sus ids existen en EXERCISES

#### CK-2: ¿Cada ejercicio usado en huecos expone el rango de su tipo, con [8, 12] por defecto?
- [unit] elevaciones laterales y face pull tienen rango [12, 20] [EP: hombro lateral/posterior]
- [unit] sentadilla goblet tiene [6, 12] [EP: compuesto]
- [unit] curl martillo tiene [10, 15] [EP: aislamiento]
- [unit] un ejercicio sin rango declarado (por ejemplo, uno propio) se trata como [8, 12] [EP: sin dato]

#### CK-3: ¿El catálogo de planes contiene solo fb2 con 2 días, huecos en orden de A/B, 3 series y fuente?
- [unit] PLANS tiene solo fb2, nombre "Full body 2 días", 2 días "Día A"/"Día B", 3 series por hueco y fuente no vacía

#### CK-4: Con el equipo por defecto, ¿fb2 se resuelve a las listas que hoy arma la app para A y B?
- [unit] resolver el Día A de fb2 con el equipo por defecto da TEMPLATES.A en el mismo orden
- [unit] resolver el Día B sin aros da TEMPLATES.B con remo en silla en lugar de remo en aros [EP: sin aros]
- [unit] resolver el Día B con aros da TEMPLATES.B tal cual [EP: con aros]

#### CK-5: ¿La migración desde la v1.14 deja la rutina editada intacta y fijada?
- [e2e] datos v1.14 (con aros) con A editado (press en banco), un ejercicio propio al final de B y B reordenado: al recargar, routine.fb2 tiene los mismos ids en el mismo orden y todos con pinned: true
- [e2e] datos de la v1.0 (sin templates) migran a una rutina fb2 completa y la pantalla Entreno muestra los 12 ejercicios

#### CK-6: ¿La migración convierte next a pos, fija plan.id, conserva lifts y sesiones y es idempotente?
- [e2e] next 'B' → pos 1 y el inicio muestra "Día B"; budget/week/next ya no están en S.plan; lifts y sesiones iguales a los guardados
- [e2e] next 'A' → pos 0
- [e2e] recargar dos veces los datos migrados, o importar la misma copia de seguridad de la v1.14, deja routine y plan iguales

#### CK-7: ¿El inicio del plan de un usuario migrado sale de su primer entreno y el de uno nuevo de la fecha de alta?
- [e2e] usuario migrado cuyo primer entreno fue hace 20 días: el entreno muestra 3 series por ejercicio [BVA: lejos del borde]
- [e2e] usuario migrado cuyo primer entreno fue hace 13 días: el entreno muestra 2 series por ejercicio [BVA: B-1 en 14 días]
- [e2e] usuario migrado cuyo primer entreno fue hace 14 días: el entreno muestra 3 series por ejercicio [BVA: B en 14 días]
- [e2e] usuario nuevo recién registrado: el primer entreno muestra 2 series por ejercicio

#### CK-8: ¿resolveSlot devuelve el primer ejercicio posible o null?
- [unit] con todo el equipo devuelve el primero de la lista del hueco [EP: primero posible]
- [unit] si el primero necesita banco y no hay banco, devuelve el siguiente posible [EP: primero imposible]
- [unit] sin ningún equipo que permita el hueco devuelve null [EP: ninguno posible]

#### CK-9: ¿resolveSlot respeta bw y exclude?
- [unit] con bw: true salta los ejercicios con mancuernas y devuelve uno de peso corporal
- [unit] con bw: true en un hueco sin ejercicios de peso corporal devuelve null
- [unit] con exclude: [primero] devuelve el siguiente posible

#### CK-10: ¿resolveDay deja intactos los ítems que siguen siendo posibles y no muta la entrada?
- [unit] ítem fijado posible queda igual
- [unit] ítem no fijado posible queda igual aunque, al agregar banco, el preferido de su hueco pase a ser posible
- [unit] el arreglo recibido no cambia después de llamar a resolveDay

#### CK-11: ¿resolveDay re-resuelve los no fijados imposibles sin repetir ejercicios en el día?
- [unit] ítem no fijado con un ejercicio que ya no es posible pasa al primer posible de su hueco
- [unit] el reemplazo no repite un ejercicio que ya está en otro ítem del mismo día
- [unit] un ítem sin hueco (ejercicio propio) que deja de ser posible no se re-resuelve y queda como faltante

#### CK-12: ¿Un fijado imposible se re-resuelve y se avisa una sola vez?
- [unit] ítem fijado con press en banco sin banco se re-resuelve y genera un aviso
- [unit] volver a resolver el resultado no genera un segundo aviso
- [e2e] fijar press en banco y quitar el banco en Ajustes: el aviso aparece una vez y no vuelve a aparecer al recargar ni al volver al inicio

#### CK-13: ¿nextDay avanza, da la vuelta y corrige posiciones fuera de rango?
- [unit] plan de 2 días: pos 0 → 1 [EP: día intermedio]
- [unit] plan de 2 días: pos 1 → 0 [BVA: último día → primero]
- [unit] plan de 3 días: pos 2 → 0 [BVA: último día → primero]
- [unit] pos 5 en un plan de 2 días → 0 [EP: fuera de rango]

#### CK-14: ¿El próximo día sigue al recién hecho, sin importar el calendario?
- [e2e] hacer el Día A → el inicio propone el Día B; hacer el Día B → propone el Día A (flujo completo con rotación)
- [e2e] empezar a mano el Día B cuando tocaba el A y terminarlo → el próximo es el Día A
- [e2e] adelantar la fecha varios días sin entrenar → sigue proponiendo el día que tocaba

#### CK-15: ¿setsFor aplica rampa y descarga con mínimo 1?
- [unit] setsFor(3, 0, false) = 2 [EP: dentro de la rampa]
- [unit] setsFor(3, 1, false) = 2 [BVA: B-1 en el límite de 2 semanas]
- [unit] setsFor(3, 2, false) = 3 [BVA: B]
- [unit] setsFor(3, 3, false) = 3 [BVA: B+1]
- [unit] setsFor(3, 5, true) = 2 [EP: solo descarga]
- [unit] setsFor(3, 0, true) = 1 [EP: rampa + descarga]
- [unit] setsFor(1, 0, true) = 1 [BVA: mínimo 1]

#### CK-16: ¿progress con rango sube, baja o mantiene según mín y máx?
- [unit] rango [12, 20], series 20/20/20 → sube un salto [BVA: B en máx]
- [unit] rango [12, 20], series 20/20/19 → mismo peso [BVA: B-1 en máx]
- [unit] rango [12, 20], series 12/12/12 → mismo peso [BVA: B en mín]
- [unit] rango [12, 20], series 15/11 → baja un salto [BVA: B-1 en mín]
- [unit] rango [6, 12], ninguna serie con reps → mismo peso [EP: vacío]

#### CK-17: ¿calibrate con rango apunta al centro redondeado más RIR 2?
- [unit] rango [12, 20]: el peso de trabajo es el redondeo hacia abajo del peso para 18 repeticiones según el 1RM estimado
- [unit] rango [10, 15]: el peso apunta a 15 repeticiones [BVA: centro no entero]
- [unit] rango [8, 12] da el mismo resultado que calibrate sin rango

#### CK-18: ¿Sin rango, progress y calibrate se comportan igual que hoy?
- [unit] las verificaciones existentes de progress y calibrate pasan sin modificarse
- [unit] las verificaciones existentes de weekBudget/setsPerExercise siguen pasando

#### CK-19: ¿Las series del entreno salen de setsFor y no del presupuesto semanal?
- [e2e] con 3 días en el perfil y fb2 fuera de la rampa, cada ejercicio del entreno tiene 3 series

#### CK-20: ¿La tarjeta de inicio muestra "<día> · N ejercicios"?
- [e2e] inicio con equipo por defecto muestra "Día A · 6 ejercicios" y no muestra "Entreno A" ni "Cuerpo completo"
- [e2e] con un hueco sin ejercicio posible, N baja a 5

#### CK-21: ¿Entreno y resumen muestran el rango real?
- [e2e] en el entreno, elevaciones laterales muestran "× 12–20" y la sentadilla goblet "× 6–12"
- [e2e] el resumen muestra "cuando hagas 20 en todas, sube" para elevaciones laterales y "Próximo: Día B"

#### CK-22: ¿Editar rutina tiene pestaña por día, prioriza el mismo hueco y fija el elegido?
- [e2e] Editar rutina muestra las pestañas "Día A" y "Día B"
- [e2e] ⇄ sobre el press del Día A lista primero los ejercicios de empuje horizontal
- [e2e] elegir press en banco deja el ítem con pinned: true y sigue así después de recargar

#### CK-23: ¿"Volver al plan original" re-resuelve sin borrar ejercicios propios?
- [e2e] tras cambiar y fijar ejercicios, "Volver al plan original" deja la rutina igual a la resolución de los huecos, sin fijados, y el ejercicio propio sigue en "Mis ejercicios"

#### CK-24: ¿La tarjeta semanal compara contra los días del plan?
- [e2e] con 3 días en el perfil y plan fb2, la tarjeta semanal muestra un objetivo de 2 entrenos

#### CK-25: ¿Las sesiones guardan plan, day y tpl, y el historial viejo se sigue leyendo?
- [e2e] al terminar el Día A la sesión guardada tiene plan 'fb2', day 0 y tpl 'A'
- [e2e] una sesión vieja con solo tpl 'A' se muestra en el historial sin errores

#### CK-26: ¿Un hueco sin ejercicio posible se muestra como "Falta equipo" sin bloquear el entreno?
- [unit] resolveDay con un hueco sin ejercicios posibles conserva el ítem (mismo ejercicio, `possible` da false), que la app muestra como faltante
- [e2e] sin el equipo de un hueco, el ítem aparece como "Falta equipo", el entreno empieza y no lo incluye

#### CK-27: ¿Un plan inexistente vuelve a fb2?
- [e2e] datos guardados con plan.id 'zzz': la app abre, el inicio muestra "Día A · …" y no hay errores de JavaScript

#### CK-28: ¿Modo dolor, calibración, estancamiento, descarga, historial e informe siguen funcionando?
- [e2e] las verificaciones existentes de modo dolor (tope y variante), calibración, descarga, historial e informe siguen pasando con la rutina nueva
- [e2e] con 2 ejercicios de la rutina estancados 3 sesiones, el inicio ofrece la semana de descarga

#### CK-32: ¿Un usuario migrado sin aros recibe un aviso innecesario por el remo en aros?
- [e2e] datos v1.14 sin aros con remo en aros en B: tras actualizar, el Día B muestra remo en silla y no aparece ningún aviso de ejercicio fijado imposible

**Definition of Done:**

- [ ] Todos los ítems `essential` del checklist responden SÍ y ningún ítem `pitfall` responde SÍ
- [ ] Todas las Regular Checks pasan
- [ ] Cada caso de **Test Cases to Cover** está implementado y pasa
- [ ] Las verificaciones existentes de `tests/e2e.mjs` que leían `templates` o `plan.next` se actualizaron a sus equivalentes sobre `routine` / `plan.pos`, sin borrar lo que verificaban
- [ ] Un usuario con el equipo por defecto ve los mismos 12 ejercicios que en la v1.14, repartidos en Día A y Día B
- [ ] Un usuario que actualiza desde la v1.14 conserva su rutina editada, sus pesos, su historial y el día que tocaba, sin recibir series de menos si entrena hace 2 semanas o más
- [ ] El próximo día siempre es el siguiente al último hecho, y cada ejercicio progresa dentro de su propio rango
- [ ] Ningún plan nuevo, selector de planes, encuesta, descanso por ejercicio, pasos ni cardio queda visible

---

## Architecture Overview

### References

- **Skill**: `.claude/skills/training-plan-engine/SKILL.md`
- **Codebase Analysis**: `.specs/analysis/analysis-motor-de-planes.md`
- **Scratchpad**: `.specs/scratchpad/7e170d05.md`
- Line numbers are from commit 6ce9382 (v1.14.1).

### Solution Strategy

**Architecture Pattern**: Layered, as a functional core with an imperative shell. This is the pattern the code already follows. `data.js` holds the domain catalogs (EXERCISES, SLOTS, PLANS). `logic.js` holds pure rules with no DOM, tested through `vm` in `tests/unit.mjs:4-5`. `app.js` is the shell: state `S`, `persist()`, `toast()`, render and events. The engine is a set of pure functions over static data. Plans are data, not plugins.

**Approach**: Hybrid routine. `S.routine[planId][day]` stores already-resolved items `{ slot, ex, pinned }`. An app function `syncRoutine()` runs at the start of `render()`. It builds the routine if it does not exist yet. It passes each day through `resolveDay`, persists only when something changed, and shows the notices. A pinned item that becomes impossible is replaced and unpinned. That alone guarantees the notice appears only once, with no extra flags. `planFor(day)` keeps today's enrichment body (pain mode, calibration, deload, stalls). Only the source of the sets (`setsFor` over the plan slot) and of the range (`repRange`) change. The migration lives in `withDefaults`, the single entry point for both boot and import. It is idempotent and copies the v1.14 routine literally as pinned items.

**Key Decisions** (detail in *Architecture Decisions*):
1. **AD-1 remo en aros**: the migration applies `NO_RINGS` when the user has no rings, and the item stays pinned. CK-32 = NO, and CK-12 does not change.
2. **AD-2 repeated slots in fb2**: each plan slot can carry a preferred exercise (`ex`), and exclusion is per **day**, not per plan.
3. **AD-3 ramp + deload stack**: −2, minimum 1, as CK-15 already says.
4. **AD-4 profile.days vs plan days**: one source per site (table in AD-4).
5. **AD-5 range in startWeight and the placeholder**: both use the center of the range (10 for 8–12, so identical to today).
6. **AD-6 defaults and maintenance**: `DEFAULT.plan` includes `deload`/`deloadOffer`. Maintenance does not use `setsFor` or ranges.
7. **AD-7 timed exercises**: they fit the contract today. The optional `secs` per slot is deferred to the isometrics plan.
8. **AD-8 custom exercises**: `opts.getEx` is injected into every engine function.
9. **AD-9 `since` for migrated users**: the date of the first workout.

**Trade-offs Accepted**:
- `render()` has one controlled side effect (`syncRoutine` persists when something changed). We accept that instead of 8 or more sync call sites (boot, import, eq-db, eq-rings, eq-flag, equip.*, mach-del), which are easy to forget.
- An unpinned fallback does not "upgrade" itself when equipment is added (for example, buying a bench keeps the floor press). This is intended by the hybrid model. "Volver al plan original" upgrades it.
- `weekBudget`/`setsPerExercise`/`targetSets` stay in `logic.js` without being used by the app, so the existing tests pass unchanged (CK-18).
- The "Empuje inclinado" slot uses the closest exercises that exist (`press_banco`, `flexiones`). A dedicated inclined exercise arrives with the first plan that uses this slot.

---

### Architecture Decomposition

| Layer | Component | File | Responsibility | Reuses From |
|---|---|---|---|---|
| L1 Domain | `SLOTS` | `data.js` (after `TEMPLATES`) | 16 slots → `{ name, ex: [ids by preference] }` | Lists from the analysis ("Types") |
| L1 Domain | `REP_RANGE` + assignment block | `data.js` (after the `mus` block) | Range by type, written to `EXERCISES[id].reps` | Assignment-block pattern `data.js:322-346` |
| L1 Domain | `PLANS.fb2` | `data.js` | Plan `{ id, name, source, days: [{ name, slots: [{ slot, sets, ex? }] }] }` | `TEMPLATES` `data.js:370` (equivalence) |
| L2 Rules | Plan engine | `logic.js`, new section `// ——— Planes ———` after `// ——— Equipo ———` | Resolution, rotation, sets, ranges, migration of the A/B lists | `implFor` `logic.js:49`, `daysBetween` `:15`, `NO_RINGS`, `TEMPLATES` |
| L2 Rules | Progression by range | `logic.js:79-92` | `startWeight`/`calibrate`/`progress` with optional range | `roundDown/stepUp/stepDown` `:60-62`, `epley1RM/weightForReps` `:75-76` |
| L2 Rules | `weekStats` | `logic.js:200` | Target = days of the active plan | — |
| L3 Shell | State and migration | `app.js:19-43` | `DEFAULT()` and `withDefaults()` with the new model | `withDefaults` `app.js:43` (extended) |
| L3 Shell | `syncRoutine()` | `app.js`, "Plan de entreno" section (replaces `resolveEx/perDay/syncBudget` `:104-106`) | Builds or re-resolves the routine, persists, shows notices | `getEx` `:96`, `persist`, `toast` |
| L3 Shell | `planFor(day)`, `altEx(orig)` | `app.js:108-132` | Enriches the day's items | Enrichment body `app.js:112-131` |
| L3 Shell | UI | `app.js` (home, train, picker, workout, summary, actions) | See Integration Map | `row()` from the picker, `.chips/.chip.on` `styles.css:68-70` |
| L4 Infra | Cache | `sw.js:2` | `tendon-v1-15-0` | — |

**Interactions**:
```
data.js (EXERCISES+reps, SLOTS, PLANS, TEMPLATES, NO_RINGS)
   │ globals
   ▼
logic.js  slotOf · possible(implFor) · resolveSlot · resolvePlan · resolveDay
          routineFromTemplates · firstWorkout · activePlan · dayIndex · nextDay
          weeksSince · setsFor · daySlot · repRange · repCenter · progress/calibrate/startWeight
   ▲ pure calls (opts.getEx = app getEx)
   │
app.js  withDefaults ──► S.plan / S.routine ◄── syncRoutine (from render)
          │                                        │
          ▼                                        ▼
        planFor(day) ──► renderHome / renderTrain / startWorkout ──► finishWorkout
                                                                    │  progress(range), pos = nextDay
                                                                    ▼
                                                        IndexedDB (persist)
```

### Building Block View (plan engine in `logic.js`)

```
┌──────────────────────── logic.js · Planes ────────────────────────┐
│  Catalog lookups        Resolution               Calendar/volume   │
│  ┌──────────────┐   ┌───────────────────┐   ┌──────────────────┐   │
│  │ slotOf       │   │ possible (implFor)│   │ activePlan       │   │
│  │ daySlot      │──►│ resolveSlot       │   │ dayIndex/nextDay │   │
│  │ repRange     │   │ resolvePlan       │   │ weeksSince       │   │
│  │ repCenter    │   │ resolveDay        │   │ setsFor          │   │
│  └──────────────┘   │ routineFromTpls   │   │ firstWorkout     │   │
│                     └───────────────────┘   └──────────────────┘   │
│         Progression: startWeight / calibrate / progress (range)    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Contracts

**Data (`data.js`)**:
```
SLOTS[slotId] = { name: string, ex: string[] }   // ids from EXERCISES, by preference (heavy → light → bodyweight)
  empuje_h       'Empuje horizontal'   press_banco, press_suelo, flexiones
  empuje_inc     'Empuje inclinado'    press_banco, flexiones
  empuje_v       'Empuje vertical'     press_hombros
  traccion_v     'Tracción vertical'   dominadas, pullover
  traccion_h     'Tracción horizontal' remo_aros, remo_silla, remo_inclinado
  rodilla        'Rodilla dominante'   goblet, sumo_kb
  unilateral     'Unilateral'          zancada, bulgara
  bisagra        'Bisagra'             rdl, swing, pm_una_pierna
  gluteo         'Glúteo'              hip_thrust, puente
  gemelos        'Gemelos'             gemelos_1pierna
  lateral        'Lateral'             lateral, elev_frontal
  deltoides_post 'Deltoides posterior' face_pull, rot_ext_banda
  biceps         'Bíceps'              curl_martillo, curl_concentrado
  triceps        'Tríceps'             triceps, patada_triceps, press_frances
  abdominal      'Abdominal'           plancha, dead_bug
  isometrico     'Isométrico'          remo_aros_iso, curl_iso, sentadilla_pared, iso_pared
  (declaration order = order above; slotOf takes the first match → press_banco/flexiones belong to empuje_h)

REP_RANGE = { compuesto: [6,12], aislamiento: [10,15], deltoides: [12,20], abdominal: [10,15] }
  compuesto:   goblet, sumo_kb, press_suelo, press_banco, flexiones, press_hombros, remo_silla, remo_aros,
               remo_inclinado, dominadas, rdl, swing, pm_una_pierna, zancada, bulgara, hip_thrust, puente
  aislamiento: curl_martillo, curl_concentrado, triceps, patada_triceps, press_frances, pullover, elev_frontal, gemelos_1pierna
  deltoides:   lateral, face_pull, rot_ext_banda
  abdominal:   (none in the library today: dead_bug has no weight → [8,12])
  kind 'tiempo'/'iso' (plancha, isometrico slot): no reps (the range does not apply)

PLANS.fb2 = { id: 'fb2', name: 'Full body 2 días', source: <Mono Culturista URL/title>, days: [
  { name: 'Día A', slots: [rodilla·3, empuje_h·3, traccion_h·3 ex:'remo_silla', bisagra·3 ex:'rdl', lateral·3, abdominal·3] },
  { name: 'Día B', slots: [unilateral·3, empuje_v·3, traccion_h·3 ex:'remo_aros', bisagra·3 ex:'swing', biceps·3, triceps·3] } ] }
```

**State (`S`)**:
```
plan:    { id: 'fb2', pos: 0, since: '' | 'YYYY-MM-DD', bw: false, deload: '' | weekKey, deloadOffer: '' | weekKey }
routine: { [planId]: Item[][] }       Item = { slot: slotId | null, ex: exId, pinned: boolean }
session (entreno): { …, plan: 'fb2', day: 0|1, tpl: 'A'|'B', items: [{ ex, name, sets, capped, maint?, reps?: [lo,hi] }] }
removed: S.templates, plan.budget, plan.week, plan.next
```

**Engine (`logic.js`, pure, never mutates its inputs)**:
```
DEFAULT_SETS = 3                                   // item with no slot in the day's plan
slotOf(id) → slotId | null
possible(id, equip, getEx = (id) => EXERCISES[id]) → boolean           // !!(ex && implFor(ex, equip))
resolveSlot(slot, equip, { bw=false, exclude=[], pref=null, getEx }) → exId | null
    // tries pref first, then SLOTS[slot].ex; skips exclude; with bw only impl === 'bw'
resolvePlan(plan, equip, opts) → Item[][]          // pinned:false; per-day exclusion; pref = plan slot ex;
                                                    // with no candidate it stores pref ?? SLOTS[slot].ex[0] (shows "Falta equipo")
resolveDay(items, equip, opts) → { items, notices: [{ from: exId, to: exId | null }], changed: boolean }
routineFromTemplates(tpls, equip) → Item[][]       // A/B → pinned:true, slot = slotOf, NO_RINGS if !equip.rings
firstWorkout(sessions) → 'YYYY-MM-DD' | ''         // oldest date of type 'entreno'
activePlan(state) → PLANS[state.plan?.id] || PLANS.fb2
dayIndex(plan, pos) → pos if 0 ≤ pos < days, else 0
nextDay(plan, pos) → (pos+1) % days if pos is valid, else 0
weeksSince(since, today) → since ? Math.floor(daysBetween(since, today) / 7) : 0
setsFor(sets, weeks, deload) → Math.max(1, sets − (weeks < 2 ? 1 : 0) − (deload ? 1 : 0))
daySlot(day, slot) → the day's first plan slot with that slot, or null
repRange(ex, spec) → spec?.reps ?? ex?.reps ?? [REPS_MIN, REPS_MAX]
repCenter([lo, hi]) → Math.round((lo + hi) / 2)
startWeight(profile, ex, steps, range = [REPS_MIN, REPS_MAX])   // target repCenter(range) (10 by default)
calibrate(w, reps, rir, steps, range = [REPS_MIN, REPS_MAX])    // target repCenter(range) + TARGET_RIR
progress(w, sets, steps, [lo, hi] = [REPS_MIN, REPS_MAX])       // all ≥ hi → up; any < lo → down
weekStats(state, today).target = activePlan(state).days.length
```
`TARGET_REPS` is removed (replaced by `repCenter`). `REPS_MIN/REPS_MAX` stay as the default range.

**`resolveDay` rule** (traverses the items in order, keeping the current ids of the day):
```
ex possible                        → same item (same reference)
not possible and slot === null     → same item (custom/added: shown as missing)
not possible, with slot            → r = resolveSlot(slot, equip, { ...opts, exclude: ids of the OTHER items of the day })
     r found                       → { slot, ex: r, pinned: false }; if it was pinned → notice { from, to: r }
     r null                        → { ...item, pinned: false } (same ex); if it was pinned → notice { from, to: null }
```
`bw` only filters candidates. "Possible" is always `implFor` (AD-8 / D-D).

---

### Architecture Decisions

#### AD-1 · Migrated rows on rings without rings
**Status**: Accepted
**Context**: CK-5 (pinned migration), CK-12 (pinned impossible → notice) and CK-32 (no notice for the migrated remo en aros) clashed.
**Options**: 1) Apply `NO_RINGS` during migration. 2) Mark migrated items and suppress the first notice. 3) Migrate the substitute unpinned.
**Decision**: Option 1. `routineFromTemplates` replaces `remo_aros → remo_silla` (and `remo_aros_iso → curl_iso`) when the user has no rings, and keeps `pinned: true`. The migrated routine is literally what the v1.14 showed.
**Consequences**: CK-32 answers NO with no exception in `resolveDay`. CK-12 stays as written (it applies to real equipment changes). CK-5 was edited minimally ("salvo el reemplazo sin aros…"), and so was its e2e test ("con aros"). An assumption was added to the Description. A user who buys rings later keeps the chair row (pinned). "Volver al plan original" changes it.

#### AD-2 · Repeated slot in fb2 (tracción horizontal, bisagra)
**Status**: Accepted
**Context**: "first possible" would give the same exercise on A and B. Plan-wide exclusion breaks CK-4, because today without rings **both** days have the chair row.
**Options**: 1) Optional `ex` preference on the plan slot, with exclusion per day. 2) Exclusion of exercises already used across the whole plan. 3) Every fb2 slot with an explicit `ex`.
**Decision**: Option 1. `resolveSlot` tries `pref` first. `resolvePlan` passes the plan slot's `ex` and excludes only the ids of the same day. Only the repeated slots declare `ex`.
**Consequences**: with default equipment, A = `TEMPLATES.A` and B = `TEMPLATES.B` with the chair row. With rings, B = `TEMPLATES.B` as is. With a bench, A gets `press_banco` (an intended improvement; CK-4 only covers default equipment). `resolveDay` does not use `pref`, because items can be reordered (D-C).

#### AD-3 · Ramp + deload
**Status**: Accepted. They stack (−2, minimum 1). CK-15 already asserts `setsFor(3, 0, true) = 1`. In practice the case is very hard to reach: the deload offer needs 3 sessions with 2 stalled exercises (≥ 3 weeks on fb2), and migrated users get `since` = their first workout.

#### AD-4 · `profile.days` vs plan days (one source per site)
**Status**: Accepted

| Site | Source | Change |
|---|---|---|
| `weekStats.target` (`logic.js:200`) | `activePlan(state).days.length` | CK-24 |
| `streak` (`logic.js:207`) | `profile.days` | none (spec) |
| `suggestThreeDays` (`logic.js:161`) | `profile.days` | none (spec) |
| "¿Pasamos a 3 días?" card (`app.js:214`) | — | text: "Venís constante. Con un día más, el plan rota más rápido." |
| `three-days` action (`app.js:1000`) | `profile.days = 3` | without `syncBudget`. Toast: "3 días por semana: el plan sigue rotando." |
| Day selectors (`app.js:796`, `:902`) and `setPath` (`:875-880`) | `profile.days` | they stay (reminders, streak, suggestion). `setPath` drops `syncBudget()` |
| `renderTrain` header (`app.js:222`) | plan + profile | "`<plan.name>` · `<profile.days>` días por semana · cada ejercicio sube dentro de su rango." |
| Onboarding e2e (`tests/e2e.mjs:37-40`) | `profile.days` | unchanged |

#### AD-5 · Range in `startWeight` and the placeholder
**Status**: Accepted. `startWeight` (`logic.js:79`) receives the range and targets `repCenter(range)`. For 8–12 that is 10, the same as today, so the existing tests pass. The reps placeholder (`app.js:393`) becomes `repCenter(it.range)` for kinds `peso`/`reps`. `planFor` passes `range` to `startWeight`.

#### AD-6 · Defaults and maintenance
**Status**: Accepted. `DEFAULT().plan = { id: 'fb2', pos: 0, since: '', bw: false, deload: '', deloadOffer: '' }`, `DEFAULT().routine = {}`, and `templates` is no longer in `DEFAULT`. `maintenanceItems()` (`app.js:134`) is not touched: 3 fixed sets, kind `iso`, no `range`. `setLabel` and the placeholder use `secs` for `iso`/`tiempo`. `setsFor` is only called inside `planFor`.

#### AD-7 · Timed exercises (`kind: 'tiempo'`/`'iso'`)
**Status**: Accepted (fits now, the extension is deferred). Slots can contain them: sets come from `setsFor`, the range is ignored, and seconds follow today's rules (`tiempo`: `lifts.secs || 30`; `iso`: 30). A `secs` field per plan slot (`{ slot, sets, secs? }`, read through `daySlot` like `reps?`) is deferred to the isometrics-plan task. It is an additive optional field, so the contract does not change.

#### AD-8 · Custom exercises (`c_…`)
**Status**: Accepted. Every engine function accepts `opts.getEx` (default `(id) => EXERCISES[id]`). The app passes `getEx` (`app.js:96`). `slotOf` returns `null` for `c_…`. Items with `slot: null` are never re-resolved.

#### AD-9 · `since` for migrated users
**Status**: Accepted. `since = firstWorkout(d.sessions)`. With no workouts, it is `''`, and `syncRoutine` sets `today()` (the update date). New users: finishing the onboarding sets `since = today()`. Ramp while `weeksSince < 2` (days 0–13), which matches CK-7.

#### AD-10 · Edit view and picker
**Status**: Accepted. **Edit mode only** shows one tab per day (`.chips` with `data-action="edit-day"`, module variable `editDay`, initialized to `dayIndex(plan, S.plan.pos)` when "Editar rutina" is pressed). The normal view keeps every day stacked, so the existing e2e tests keep checking what they check (remo en aros visible, ≥ 3 "al 60 %", ≥ 12 `.ex`). In the picker, for a swap, the first section is "`<SLOTS[slot].name>` · mismo hueco" with the slot's exercises. Those exercises are **excluded** from the CATS sections so `[data-ex=…]` stays unique. The "· mismo grupo" ordering by `cat` is removed. A swap keeps the item's `slot`. "+ Agregar" uses `slotOf(id)`. Both set `pinned: true`.

#### AD-11 · Labels
**Status**: Accepted. Home: tag = `plan.name`, title = "`<día>` · N ejercicios" (N = items with `!missing`). Workout header: the day's name. Summary: "¡`<día>` hecho! 💪", per-exercise hint "cuando hagas `<hi>` en todas, sube" (weighted items that did not change weight, using `reps` saved on the session item), and "Próximo: `<nombre del día>`.". The history label stays `Entreno ${s.tpl}` (new sessions also save `tpl`).

---

### Runtime Scenarios

**Scenario 1: boot with v1.14 data (migration)**
```
db.get('data') ─► withDefaults(d)
   ├─ 'routine' not in d? ─yes─► routine = { fb2: routineFromTemplates(d.templates || TEMPLATES, equip) }   (pinned, NO_RINGS if no rings)
   │                            plan.pos = d.plan.next === 'B' ? 1 : 0 ; plan.since = firstWorkout(d.sessions)
   ├─ plan = { ...base.plan, ...d.plan } minus budget/week/next ; PLANS[plan.id] ? id : 'fb2'
   └─ templates is not copied into S
render() ─► syncRoutine() ─► since ||= today() ; resolveDay per day (no notices: everything possible) ─► persist if changed
```

**Scenario 2: the user removes the bench with press_banco pinned**
```
change eq-flag ─► S.equip.bench=false ─► persist ─► render() ─► syncRoutine()
   resolveDay: press_banco impossible, slot empuje_h, pinned
      ─► { slot:'empuje_h', ex:'press_suelo', pinned:false } + notice { from:'press_banco', to:'press_suelo' }
   ─► persist ─► toast "Press en banco con mancuernas ya no se puede con tu equipo: lo cambiamos por press en el suelo con mancuernas."
next render / reload ─► press_suelo is possible and not pinned ─► no notice (CK-12)
```

**Scenario 3: workout and rotation**
```
Home: day = dayIndex(plan, S.plan.pos) ─► planFor(day) ─► "Día A · 6 ejercicios"
start-workout data-day=0 ─► W = { plan:'fb2', day:0, dayName:'Día A', items }
   item.sets = setsFor(daySlot(spec, slot)?.sets ?? DEFAULT_SETS, weeksSince(since, today), deload)
   item.range = repRange(ex, daySlot(spec, slot))
set-done (calib) ─► calibrate(w, reps, rir, steps, item.range)
finish ─► progress(lift.w, sets, steps, item.range) ; session { plan, day, tpl:'A', items[{…, reps}] }
       ─► S.plan.pos = nextDay(plan, W.day)  (the day DONE, not the stored pos)
summary ─► "Próximo: Día B"
```

**Routine item states**:
```
[pinned, possible] ──equipment removed──► [unpinned, replaced] (1 notice)
        │                                   └─ no candidate ─► [unpinned, missing] (1 notice)
[unpinned, possible] ──equipment removed──► [unpinned, replaced] (silent)  └─ no candidate ─► [unpinned, missing]
[missing] ──equipment returns──► [possible] (same exercise, no changes)
picker / add ──► [pinned]      "Volver al plan original" ──► everything [unpinned] via resolvePlan
```

---

### Integration Map (`app.js`, exact changes)

| Line(s) | Today | New |
|---|---|---|
| `:5` | `APP_VERSION = '1.14.1'` | `'1.15.0'` |
| `:19-27` `DEFAULT()` | `templates`, `plan {budget, week, next}` | no `templates`; `routine: {}`; `plan` per AD-6 |
| `:43` `withDefaults` | shallow merge + `templates` | Scenario 1: strips `templates` and `budget/week/next`, validates `plan.id`, migrates only when `!('routine' in d)` (idempotent) |
| `:104-106` `resolveEx/perDay/syncBudget` | NO_RINGS + budget | removed. New `altEx(orig) = getEx(!S.equip.rings && NO_RINGS[orig.alt] ? NO_RINGS[orig.alt] : orig.alt)` (pain-mode alt only) and new `syncRoutine()` |
| `:108-132` `planFor(tpl)` | budget, `S.templates[tpl]` | `planFor(day)`: `S.routine[plan.id][day]`, skips items with `getEx(ex) == null`, `sets = setsFor(...)`, `range = repRange(ex, spec)`, `startWeight(…, range)`. The rest of the body is unchanged (`missing: !impl`) |
| `:82-85` `render()` | — | calls `syncRoutine()` first |
| `:203-210` home | `S.plan.next`, "Entreno X", "Cuerpo completo" | `day = dayIndex(plan, S.plan.pos)`, tag `plan.name`, h3 "`<día>` · N ejercicios", `data-day` |
| `:212` stuck | `TEMPLATES` + `S.templates` | unique ids from `S.routine[plan.id].flat()` |
| `:214` and `:1000` | "volumen +30 %" | AD-4 |
| `:219-240` `renderTrain` | `['A','B']` loop, `data-tpl` | stacked days `plan.days.map` (h2 = day name + "· toca hoy" if it equals `dayIndex`); in edit mode only the `editDay` tab with `data-day`; "Volver al plan original" |
| `:242-243` `tplIds/routineSet` | lists of ids | `dayItems(day)` / `routineSet(day, items)` (no `syncBudget`) |
| `:246-273` picker/`pickExercise` | CATS order, ids | AD-10; `PK = { day, i }`; swap `{ ...item, ex: id, pinned: true }`; add `{ slot: slotOf(id), ex: id, pinned: true }` |
| `:315` `saveExForm` | `openPicker(PK.tpl, …)` | `openPicker(PK.day, …)` |
| `:317-323` `deleteExForm` | filters `S.templates` | filters `ex !== id` on every day of every plan in `S.routine`; no `syncBudget` |
| `:346-350` `setLabel` | `'8–12 reps'` | `peso`/`reps` → `` `${lo}–${hi} reps` `` from `p.range`; `iso`/`tiempo` → secs |
| `:369-378` `startWorkout(tpl)` | `W.tpl` | `startWorkout(day)`: `W = { plan, day, dayName, items, started, warm }` |
| `:393` placeholder | `'10'` | `repCenter(it.range)` (AD-5) |
| `:403` header | `Entreno ${W.tpl}` | `W.dayName` |
| `:415` calibrate | no range | `calibrate(…, it.steps, it.range)` |
| `:440` progress | no range | `progress(lift.w, …, it.steps, it.range)` |
| `:441-451` session | `tpl` | `{ plan: W.plan, day: W.day, tpl: String.fromCharCode(65 + W.day) }`; `peso` items save `reps: it.range` |
| `:453` rotation | `next` toggle | `S.plan.pos = nextDay(activePlan(S), W.day)` |
| `:464-471` `showSummary` | "12 reps", "entreno X" | AD-11 |
| `:877-879` `setPath` | `syncBudget()` | removed |
| `:916` `onbNext` | `syncBudget()` | `S.routine[plan.id] = resolvePlan(plan, S.equip, { getEx, bw: S.plan.bw }); S.plan.pos = 0; S.plan.since = today();` |
| `:951` `start-workout` | `d.tpl` | `Number(d.day)` |
| `:1027-1030` routine-* | `d.tpl`, `TEMPLATES` | `d.day`. Reset: confirm "¿Volver al plan original? Se arma de nuevo según tu equipo. Tus ejercicios propios siguen en Mis ejercicios." → `resolvePlan(...)`. New action `edit-day` (`editDay = +d.day; render()`). `edit-routine` initializes `editDay` |
| `:1063` bench toast | `S.templates.A.includes('press_suelo')` | `S.routine[activePlan(S).id].flat().some((it) => it.ex === 'press_suelo')` |

**`syncRoutine()`** (app.js): `plan = activePlan(S)`, `opts = { getEx, bw: S.plan.bw }`. If `!S.plan.since`, set `today()`. If the routine is missing or its number of days ≠ `plan.days.length`, use `resolvePlan`. Then `resolveDay` on each day, collecting `changed` and `notices`. If anything changed and `S.onboarded`, call `persist()`. If there are notices, show one `toast` joining them: "`<from.name>` ya no se puede con tu equipo: lo cambiamos por `<to.name en minúscula>`." / "…: queda como falta equipo."

**Other files**: `logic.js` (Contracts), `data.js` (Contracts), `sw.js:2` → `'tendon-v1-15-0'`, `CHANGELOG.md` (entry 1.15.0 — "Motor de planes: Full body 2 días con rotación y rango por ejercicio"), `README.md:21` (replace "A/B … 8–12, volumen +30 %" with plan, rotation and range per exercise), `.specs/analysis/{modelo-de-datos,reglas-de-negocio,arquitectura}.md` (new `plan`/`routine` model, `setsFor`/ranges, engine section).

---

### Expected Changes

```
TendonApp/
├── data.js            # UPDATE: SLOTS (16), REP_RANGE + reps assignment block, PLANS.fb2; TEMPLATES and NO_RINGS stay (migration / alt)
├── logic.js           # UPDATE: "Planes" section (14 pure functions + DEFAULT_SETS); startWeight/calibrate/progress with range; weekStats by plan; TARGET_REPS removed
├── app.js             # UPDATE: DEFAULT/withDefaults, syncRoutine, altEx, planFor(day), home/train/picker/workout/summary/actions; APP_VERSION 1.15.0
├── sw.js              # UPDATE: CACHE 'tendon-v1-15-0'
├── tests/unit.mjs     # UPDATE: new tests (catalogs, engine, ranges); existing ones unchanged
├── tests/e2e.mjs      # UPDATE: data-tpl → data-day, templates → routine.fb2, next → pos; v1.14 fixtures, rotation, notice, missing, unknown plan
├── CHANGELOG.md       # UPDATE: 1.15.0 entry
├── README.md          # UPDATE: Entreno line (L21)
└── .specs/analysis/{modelo-de-datos,reglas-de-negocio,arquitectura}.md   # UPDATE: model and rules
```

### Build Sequence

**Phase 1 · Data (`data.js`)**: no dependencies
- [ ] `SLOTS` with the 16 slots in the order of the contract.
  - Reuse: ids and lists from the analysis "Types" table. Pattern of an ordered list like `REHAB_OPTIONS` `data.js:312`.
- [ ] `REP_RANGE` and an assignment block `EXERCISES[id].reps = REP_RANGE[type]`.
  - Reuse: the `Object.entries({...}).forEach` block pattern from `data.js:322-326` / `:337-346`.
- [ ] `PLANS.fb2` with `ex` on the repeated slots (AD-2).
  - Reuse: `TEMPLATES` `data.js:370` as the reference (it is not deleted).

**Phase 2 · Rules (`logic.js` + `tests/unit.mjs`)**: depends on Phase 1
- [ ] "Planes" section: `DEFAULT_SETS`, `slotOf`, `possible`, `resolveSlot`, `resolvePlan`, `resolveDay`, `routineFromTemplates`, `firstWorkout`, `activePlan`, `dayIndex`, `nextDay`, `weeksSince`, `setsFor`, `daySlot`, `repRange`, `repCenter`.
  - Reuse: `implFor` `logic.js:49` (the only "possible" check, CK-36), `daysBetween` `:15`, `NO_RINGS` `data.js:388`, `TEMPLATES`.
- [ ] `startWeight`/`calibrate`/`progress` with an optional range. Remove `TARGET_REPS`. `weekStats.target` by plan.
  - Reuse: `roundDown/stepUp/stepDown` `:60-62`, `epley1RM/weightForReps` `:75-76`.
- [ ] Unit tests for CK-1…4, 8…13, 15…18, 26 (Test Cases), plus the tests implied by the decisions: `routineFromTemplates` without rings → `remo_silla` pinned; `slotOf('c_x') === null`; `slotOf('press_banco') === 'empuje_h'`; `resolveSlot` with `pref`; `dayIndex`/`weeksSince('')`; `repCenter([10,15]) === 13`; `startWeight` with [12,20] ≤ the one with [8,12]; `weekStats` target 2 with no `plan`.
  - Reuse: helpers `L`/`eq`/`ok` from `tests/unit.mjs:6-9`; the `equip`/`eq2` fixtures.

**Phase 3 · Shell, state and workout (`app.js`)**: depends on Phase 2
- [ ] `DEFAULT`, `withDefaults` (Scenario 1), `syncRoutine` called from `render()`, `altEx`, `planFor(day)`.
  - Reuse: `withDefaults` `app.js:43` (extended), `getEx` `:96` injected, enrichment body `:112-131`.
- [ ] Home, workout (`startWorkout/renderWorkout/setDone/finishWorkout/showSummary`), `setPath`, `onbNext`, `start-workout`/`three-days` actions, bench toast.
  - Reuse: `sessionSummary`, `stalled`, `restriction`, `painCap`, unchanged.

**Phase 4 · Routine editor (`app.js`)**: depends on Phase 3
- [ ] Day tabs in edit mode, `routineSet(day, items)`, picker with "mismo hueco", `pickExercise` (pinned), `deleteExForm`, `routine-*` and `edit-day` actions, "Volver al plan original".
  - Reuse: `row()` from the picker `app.js:250-253`, `missingLabel`, `.chips/.chip.on` CSS `styles.css:68-70`.

**Phase 5 · e2e, version and docs**: depends on Phases 3-4
- [ ] Update `tests/e2e.mjs`: `:118` → `plan.pos === 1`; `:188/195/202/215` → open the tab and use `data-day`; `:194/201/203` → `routine.fb2[d][i].ex` plus `pinned`; `:310` → `routine.fb2` with 6+6 and `pos === 1`.
  - Reuse: v1.0 fixture `tests/e2e.mjs:299-313` as the template for the v1.14 fixtures (CK-5/6/7/32, unknown plan CK-27).
- [ ] New e2e tests for CK-5…7, 12, 14, 19…28 and 32, following the Test Cases.
  - Reuse: `state()`, `click()`, `page.evaluate` with `addDays(today(), -n)` to date sessions (`tests/e2e.mjs:137`, `:250`).
- [ ] `APP_VERSION` 1.15.0, `sw.js` CACHE, `CHANGELOG.md`, `README.md:21`, `.specs/analysis/*.md`.
  - Reuse: format of the existing CHANGELOG entries.

---

## Implementation Process

> Note: the Phase Overview below supersedes the phase numbering of the Architecture Overview's `### Build Sequence`. That section groups the work by layer; execution follows the steps and phases defined here.

You MUST launch for each step a separate agent, instead of performing all steps yourself. And for each step marked as parallel, you MUST launch separate agents in parallel.

**CRITICAL:** For each agent you MUST:
1. Use the **Model** and **Agent** type specified in the step's sub-task file (e.g., `haiku`, `sonnet`, `tech-writer`)
2. Provide the path to THIS task file AND the path to that step's sub-task file
3. Require agent to implement exactly that step, not more, not less, not other steps

**CRITICAL:** Verification is done at PHASE level, not per step. When every step of a phase is complete, you MUST launch the code reviewer ONCE for that phase, at the **Reviewer model** named for that phase in the Phase Overview.

**CRITICAL — shared-file rule:** steps that edit the same file MUST NOT run concurrently. `data.js`, `logic.js` and `tests/unit.mjs` are edited only in steps 01 → 02 → 03a. `app.js` and `tests/e2e.mjs` are edited only in steps 03a → 03b → 03c → 04. Those steps are therefore strictly sequential. The only parallel pair is `04-routine-editor-and-version` ‖ `05-docs`, whose file sets are disjoint (`05-docs` edits only Markdown docs).

**Phase 2 e2e note:** `tests/e2e.mjs` is one sequential script, and the data-model cutover is spread over 03a → 03b → 03c. Steps 03a and 03b therefore put their new tests in self-contained fixture blocks before `// 1. Primer uso`, and step 03c owns the full-suite gate that makes Phase 2 green.

### Parallelization Overview

```
Step 01-catalogs-and-range-progression [sonnet, sdd:developer]
        │  (data.js + logic.js range + unit.mjs)
        ▼
Step 02-plan-engine [opus, sdd:developer]
        │  (Needs SLOTS/PLANS from 01; logic.js + unit.mjs)
        │
═══ end of Phase 1 (review: opus) ═══  app still behaves as v1.14; unit + e2e green
        ▼
Step 03a-state-migration-and-home [opus, sdd:developer]
        │  (state, migration, syncRoutine, planFor(day), Home, weekStats)
        ▼
Step 03b-train-view-and-routine-data [sonnet, sdd:developer]
        │  (Train view + editor data path on S.routine; sequential: app.js/e2e.mjs)
        ▼
Step 03c-workout-loop-and-range-ui [sonnet, sdd:developer]
        │  (workout, rotation, visible range; owns full e2e gate)
        │
═══ end of Phase 2 (review: opus) ═══  whole app on the new model; unit + e2e green
        │
        ├──────────────────────────────┐
        ▼                              ▼
Step 04-routine-editor-and-version   Step 05-docs
[sonnet, sdd:developer]              [sonnet, sdd:tech-writer]
(app.js, sw.js, e2e.mjs)             (CHANGELOG, README, .specs/analysis)
        │   (MUST run in parallel, width 2; disjoint files)
        └──────────────┬───────────────┘
═══ end of Phase 3 (review: opus) ═══  release 1.15.0 complete
```

| Step | Phase | Model | Agent | Depends on | Parallel with | Sub-Task File |
|------|-------|-------|-------|------------|---------------|---------------|
| `01-catalogs-and-range-progression` [DONE] | Phase 1 | sonnet | sdd:developer | None | None | `.specs/sub-tasks/motor-de-planes.feature/01-catalogs-and-range-progression.md` |
| `02-plan-engine` [DONE] | Phase 1 | opus | sdd:developer | `01-catalogs-and-range-progression` | None | `.specs/sub-tasks/motor-de-planes.feature/02-plan-engine.md` |
| `03a-state-migration-and-home` [DONE] | Phase 2 | opus | sdd:developer | `02-plan-engine` | None | `.specs/sub-tasks/motor-de-planes.feature/03a-state-migration-and-home.md` |
| `03b-train-view-and-routine-data` [DONE] | Phase 2 | sonnet | sdd:developer | `03a-state-migration-and-home` | None | `.specs/sub-tasks/motor-de-planes.feature/03b-train-view-and-routine-data.md` |
| `03c-workout-loop-and-range-ui` [DONE] | Phase 2 | sonnet | sdd:developer | `03b-train-view-and-routine-data` | None | `.specs/sub-tasks/motor-de-planes.feature/03c-workout-loop-and-range-ui.md` |
| `04-routine-editor-and-version` [DONE] | Phase 3 | sonnet | sdd:developer | `03c-workout-loop-and-range-ui` | `05-docs` | `.specs/sub-tasks/motor-de-planes.feature/04-routine-editor-and-version.md` |
| `05-docs` [DONE] | Phase 3 | sonnet | sdd:tech-writer | `03c-workout-loop-and-range-ui` | `04-routine-editor-and-version` | `.specs/sub-tasks/motor-de-planes.feature/05-docs.md` |

### Phase Overview

#### Phase 1: Pure engine core [REVIEWED]

Steps: `01-catalogs-and-range-progression`, `02-plan-engine`
Reviewer model: `opus`
Milestone: `app.js` is untouched and `weekStats` is unchanged, so the running app behaves exactly as v1.14. The engine and catalogs exist with unit tests, and the existing e2e suite is the regression gate.
Acceptance Criteria that should be fulfiled:
Checklist items:
- `CK-1` — ¿El catálogo de huecos define exactamente los 16 patrones pedidos, cada uno con una lista ordenada no vacía cuyos ids existen todos en la biblioteca?
- `CK-2` — ¿Cada ejercicio de tipo `peso` o `reps` usado en algún hueco expone un rango `[mín, máx]` que coincide con su tipo, y uno sin dato se trata como `[8, 12]`?
- `CK-3` — ¿El catálogo de planes contiene solo `fb2` "Full body 2 días", con 2 días cuyos huecos siguen el orden de `TEMPLATES.A` y `TEMPLATES.B`, 3 series por hueco y una fuente?
- `CK-4` — Con el equipo por defecto, ¿resolver `fb2` da exactamente las listas que hoy arma la app para A y B, en el mismo orden?
- `CK-8` — ¿`resolveSlot` devuelve el primer ejercicio de la lista del hueco que el equipo permite, y `null` cuando ninguno es posible?
- `CK-9` — ¿`resolveSlot` con `bw: true` devuelve solo ejercicios con peso corporal y con `exclude` saltea los ids indicados?
- `CK-10` — ¿`resolveDay` deja sin cambios todo ítem que sigue siendo posible (fijado o no) y no modifica el arreglo recibido?
- `CK-11` — ¿`resolveDay` reemplaza cada ítem no fijado que dejó de ser posible por el primer ejercicio posible de su hueco que no esté ya en ese día?
- `CK-12` — ¿Un ítem fijado que dejó de ser posible se re-resuelve y el usuario ve el aviso exactamente una vez? (unit part, step 02: one notice, then none on a second pass)
- `CK-13` — ¿`nextDay` devuelve el índice del día siguiente, vuelve a 0 después del último día y devuelve 0 si la posición está fuera de rango?
- `CK-15` — ¿`setsFor` resta 1 serie en la rampa de 2 semanas, resta 1 en descarga, y nunca devuelve menos de 1?
- `CK-16` — Con rango, ¿`progress` sube solo cuando todas las series llegan al máximo, baja cuando alguna queda por debajo del mínimo, y mantiene en otro caso?
- `CK-17` — Con rango, ¿`calibrate` apunta al centro del rango redondeado más 2 repeticiones en reserva?
- `CK-18` — Sin rango, ¿`progress` y `calibrate` dan los mismos resultados que hoy, con las pruebas previas pasando sin modificarse?
- `CK-33` — ¿`node tests/unit.mjs` termina con código 0?
- `CK-34` — ¿`node tests/e2e.mjs` (con `python -m http.server 8124` corriendo) termina con código 0? (regression gate: the app must still behave as v1.14)
- `CK-36` — ¿La decisión de si un ejercicio "es posible" reutiliza `implFor` en lugar de reimplementarla?

Rubrics:
- `Re-resolución mínima`
- `Progresión por rango`
- `Cobertura de casos límite y fijados`
- `Project Guidelines Alignment`

#### Phase 2: Shell cutover to plan and routine [REVIEWED]

Steps: `03a-state-migration-and-home`, `03b-train-view-and-routine-data`, `03c-workout-loop-and-range-ui`
Reviewer model: `opus`
Milestone: the whole app runs on `S.plan` / `S.routine`. That covers migration, sync, Home, the Train view, the workout loop with rotation and visible ranges, and the editor data path with pinned items (the editor still has today's look). `node tests/unit.mjs` and the full `node tests/e2e.mjs` both exit 0 (gate owned by `03c`).
Acceptance Criteria that should be fulfiled:
Checklist items:
- `CK-5` — Al cargar datos de la v1.14 con `templates.A/B` editados, ¿`routine.fb2` queda con los mismos ejercicios en el mismo orden por día y todos con `pinned: true`?
- `CK-6` — ¿La migración convierte `plan.next` a `pos`, deja `plan.id = 'fb2'`, quita `budget`/`week`/`next`, no modifica `lifts` ni `sessions`, y es idempotente?
- `CK-7` — ¿El inicio del plan de un usuario migrado con entrenos es la fecha de su primer entreno, y el de uno sin entrenos o nuevo es la fecha de la migración o del alta?
- `CK-12` — ¿Un ítem fijado que dejó de ser posible se re-resuelve y el usuario ve el aviso exactamente una vez? (shell part, step 03a: `syncRoutine` shows one joined toast and persists the unpinned item; the e2e through the editor is in Phase 3, step 04)
- `CK-14` — Al terminar un entreno, ¿el próximo día propuesto es el siguiente al día recién hecho, sin importar el calendario?
- `CK-19` — ¿Las series de cada ejercicio salen de las series del hueco pasadas por `setsFor`, sin usar `weekBudget`, `setsPerExercise` ni `targetSets`?
- `CK-20` — ¿La tarjeta de inicio dice "<nombre del día> · N ejercicios", con N igual a los ítems resolubles?
- `CK-21` — ¿El entreno muestra "<series> × <mín>–<máx>" con el rango real y el resumen muestra "cuando hagas <máx> en todas, sube"?
- `CK-23` — ¿"Volver al plan original" re-resuelve todos los huecos (sin fijados) y no borra los ejercicios propios?
- `CK-24` — ¿La tarjeta semanal usa como objetivo la cantidad de días del plan activo?
- `CK-25` — ¿Cada sesión guardada incluye `plan`, `day` y `tpl`, y el historial sigue mostrando las sesiones viejas sin errores?
- `CK-26` — ¿Un hueco sin ejercicio posible aparece como "Falta equipo" y el entreno se puede empezar igual sin incluirlo?
- `CK-27` — ¿Un `S.plan.id` inexistente hace que la app use `fb2` sin errores de JavaScript?
- `CK-28` — ¿Modo dolor, calibración, estancamiento con oferta de descarga, descarga, historial e informe siguen funcionando sobre los ejercicios resueltos?
- `CK-30` — ¿Queda algún camino del código que, tras la migración, lea `S.templates`, `TEMPLATES` como rutina del usuario, `plan.next` o `plan.budget`?
- `CK-32` — ¿Un usuario migrado sin aros con remo en aros recibe un aviso de "ejercicio fijado imposible" al abrir la app tras actualizar?
- `CK-33` — ¿`node tests/unit.mjs` termina con código 0?
- `CK-34` — ¿`node tests/e2e.mjs` (con `python -m http.server 8124` corriendo) termina con código 0?
- `CK-35` — ¿El código nuevo evita duplicar lógica existente (por ejemplo, mantener `NO_RINGS` en paralelo a la resolución por hueco, o copiar `implFor`)?
- `CK-36` — ¿La decisión de si un ejercicio "es posible" reutiliza `implFor` en lugar de reimplementarla?
- `CK-37` — ¿Se hicieron mejoras pequeñas y acotadas al código tocado sin ampliar el alcance?
- `CK-38` — ¿Cada tipo de prueba de la Test Matrix (unit, e2e) tiene al menos una prueba en la implementación?

Rubrics:
- `Preservación de la rutina en la migración`
- `Re-resolución mínima`
- `Progresión por rango`
- `Rotación por secuencia`
- `Rango visible en la interfaz`
- `Cobertura de casos límite y fijados`
- `Project Guidelines Alignment`

#### Phase 3: Routine editor per day and release 1.15.0

Steps: `04-routine-editor-and-version`, `05-docs`
Reviewer model: `opus`
Milestone: the editor has one tab per day, a "mismo hueco" picker section and the end-to-end pinned-notice flow. The app is v1.15.0 (`APP_VERSION`, `sw.js` cache, CHANGELOG), and the README and analysis docs describe the plan engine. The full Definition of Done holds.
Acceptance Criteria that should be fulfiled:
Checklist items:
- `CK-12` — ¿Un ítem fijado que dejó de ser posible se re-resuelve y el usuario ve el aviso exactamente una vez? (end-to-end e2e, step 04: pin via the editor, remove the bench, one toast, none after reload)
- `CK-22` — ¿Editar rutina muestra una pestaña por día, ⇄ lista primero los ejercicios del mismo hueco, y el elegido queda fijado y persiste al recargar?
- `CK-29` — ¿Hay entrada nueva en `CHANGELOG.md`, sube `APP_VERSION` y cambia el nombre del caché en `sw.js`?
- `CK-30` — ¿Queda algún camino del código que, tras la migración, lea `S.templates`, `TEMPLATES` como rutina del usuario, `plan.next` o `plan.budget`?
- `CK-31` — ¿La entrega expone algo fuera de alcance: un plan nuevo, un selector de planes, la encuesta, descanso por ejercicio, pasos o cardio?
- `CK-33` — ¿`node tests/unit.mjs` termina con código 0?
- `CK-34` — ¿`node tests/e2e.mjs` (con `python -m http.server 8124` corriendo) termina con código 0?
- `CK-35` — ¿El código nuevo evita duplicar lógica existente (por ejemplo, mantener `NO_RINGS` en paralelo a la resolución por hueco, o copiar `implFor`)?
- `CK-37` — ¿Se hicieron mejoras pequeñas y acotadas al código tocado sin ampliar el alcance?
- `CK-39` — ¿Cada caso de Test Cases to Cover tiene una prueba implementada que pasa?
- `CK-40` — ¿Cada ítem verificable del checklist (CK-1 a CK-28 y CK-32) se resuelve en al menos una prueba real que pasa, sin huérfanos?

Rubrics:
- `Re-resolución mínima`
- `Cobertura de casos límite y fijados`
- `Project Guidelines Alignment`
