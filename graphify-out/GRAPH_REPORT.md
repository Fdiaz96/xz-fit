# Graph Report - TendonApp  (2026-10-27)

## Corpus Check
- 62 files · ~94,945 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 11, .woff2 1, .webmanifest 1)

## Summary
- 729 nodes · 1402 edges · 56 communities (53 shown, 3 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1af3b1d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- Specs de features (datos, editor, calor)
- logic.js
- resolveDay
- Figuras 3D (figures.js)
- Pruebas e2e
- Pruebas unitarias
- Catálogos data.js
- Skill motor de planes
- Migración y resolución de rutina
- package.json
- Arquitectura y modelo de datos
- Shell HTML, PWA y fuente
- Reglas de negocio y calibración
- Huecos y posibilidad por equipo
- Progresión y versiones del plan
- Bucle de entreno y release 1.15
- Modo dolor y README
- Historial de versiones
- Página de animaciones
- Sincronización de rutina
- Animación por ángulos
- Reglas graphify (CLAUDE.md)
- Ícono 192
- Ícono 512
- Service worker
- Rotación nextDay
- Fuente: canal Mono Culturista
- recommendPlan() pure recommendation
- REP_RANGE per exercise type
- Plan Full body 3 días + selector (task 2/7)
- Plan engine (slots, rotation, per-exercise range)
- routineFromTemplates
- Encuesta de elección de plan (task 7/7)
- finishLaterales
- UX 12: los avisos no tapan el encabezado
- UX 1: la calibración se explica una sola vez en la sesión
- UX 2: el campo de reps no parece cargado
- UX 3: "Hoy no puedo" como acción secundaria
- UX 10: pesos con unidad y coherentes entre inicio y Entreno
- UX 7: Historial ordenado por entreno y con vacíos útiles
- UX 11: editar rutina con controles claros
- Barrido de UX (2026-10-27): índice y reglas comunes
- UX 5: explicar "al 60 %" y "a calibrar"
- UX 6: la pestaña Tendones solo cuando importa
- guessWeight
- UX 13: textos sin jerga ni cadenas con puntos medios
- saveV114
- addDays
- UX 8: zonas con dolor con el mismo componente que el alta
- daysBetween
- UX 4: el primer día no recibe al usuario con "día de descanso"
- resolveSlot
- UX 9: el botón de fase invita a avanzar solo cuando corresponde
- isoAdjust
- suggestLevelUp

## God Nodes (most connected - your core abstractions)
1. `Training Plan Engine skill (SKILL.md)` - 30 edges
2. `figureSVG()` - 28 edges
3. `esc()` - 23 edges
4. `render()` - 23 edges
5. `renderHome()` - 20 edges
6. `renderWorkout()` - 18 edges
7. `CHANGELOG.md (XZ Fit)` - 18 edges
8. `today()` - 17 edges
9. `toast()` - 17 edges
10. `patch()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Dónde` --references--> `toast()`  [INFERRED]
  .specs/tasks/done/ux-12-avisos-abajo.md → app.js
- `Dónde` --references--> `renderHome()`  [INFERRED]
  .specs/tasks/done/ux-04-primer-dia-sin-descanso.md → app.js
- `Dónde` --references--> `renderTrain()`  [INFERRED]
  .specs/tasks/done/ux-11-editar-rutina-botones.md → app.js
- `Orden` --references--> `renderWorkout()`  [INFERRED]
  .specs/tasks/done/ux-00-indice.md → app.js
- `Dónde` --references--> `renderWorkout()`  [INFERRED]
  .specs/tasks/done/ux-01-calibracion-una-vez.md → app.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **App script modules loaded by index.html** — data, logic, figures, app [EXTRACTED 1.00]
- **Adaptacion del plan diario (planFor)** — _specs_tasks_done_entreno_ab_progresion_volumen_feature_planfor, _specs_tasks_done_entreno_ab_progresion_volumen_feature_weekly_volume_budget, _specs_tasks_done_entreno_ab_progresion_volumen_feature_double_progression, _specs_tasks_done_estancamiento_descarga_feature_deload_week, _specs_tasks_done_modo_dolor_rehabilitacion_feature_pain_restriction_cap, _specs_tasks_done_equipo_a_medida_feature_implfor_filtering [EXTRACTED 1.00]
- **Motor de planes implementation steps 01-05** — _specs_sub_tasks_motor_de_planes_feature_01_catalogs_and_range_progression, _specs_sub_tasks_motor_de_planes_feature_02_plan_engine, _specs_sub_tasks_motor_de_planes_feature_03a_state_migration_and_home, _specs_sub_tasks_motor_de_planes_feature_03b_train_view_and_routine_data, _specs_sub_tasks_motor_de_planes_feature_03c_workout_loop_and_range_ui, _specs_sub_tasks_motor_de_planes_feature_04_routine_editor_and_version, _specs_sub_tasks_motor_de_planes_feature_05_docs [EXTRACTED 1.00]
- **Plan engine v1.15 mechanisms** — changelog_v1_15_0_motor_de_planes, changelog_day_rotation, changelog_per_exercise_rep_range, changelog_first_weeks_set_ramp, changelog_pinned_exercise_swap [EXTRACTED 1.00]
- **Routine resolution flow (sync, resolve, possible)** — _specs_tasks_done_motor_de_planes_feature_syncroutine, _specs_tasks_done_motor_de_planes_feature_resolveplan, _specs_tasks_done_motor_de_planes_feature_resolveday, _specs_tasks_done_motor_de_planes_feature_resolveslot, _specs_tasks_done_motor_de_planes_feature_possible, _specs_tasks_done_motor_de_planes_feature_implfor [EXTRACTED 1.00]
- **Workout volume and progression rules (sets, range, progress)** — _specs_tasks_done_motor_de_planes_feature_planfor, _specs_tasks_done_motor_de_planes_feature_setsfor, _specs_tasks_done_motor_de_planes_feature_reprange_fn, _specs_tasks_done_motor_de_planes_feature_progress_calibrate, _specs_tasks_done_motor_de_planes_feature_nextday [EXTRACTED 1.00]
- **Reglas de seguridad de carga** — _specs_tasks_done_equipo_a_medida_feature_weight_steps_rounding, _specs_tasks_done_peso_sugerido_calibracion_feature_start_weight_estimate, _specs_tasks_done_modo_dolor_rehabilitacion_feature_iso_adjust, _specs_tasks_done_modo_dolor_rehabilitacion_feature_pain_restriction_cap, _specs_tasks_done_entreno_ab_progresion_volumen_feature_weekly_volume_budget [INFERRED 0.75]
- **Exercise animation rendering pipeline** — changelog_v1_12_0_isometric_3d, changelog_v1_13_0_angle_animation, changelog_muscle_zones, changelog_per_exercise_camera, animaciones_figuresvg [INFERRED 0.85]
- **Plan engine resolution pipeline** — _claude_skills_training_plan_engine_skill_resolveslot, _claude_skills_training_plan_engine_skill_resolveday, _specs_sub_tasks_motor_de_planes_feature_02_plan_engine_resolveplan, _specs_sub_tasks_motor_de_planes_feature_02_plan_engine_possible, _specs_sub_tasks_motor_de_planes_feature_03a_state_migration_and_home_syncroutine, _claude_skills_training_plan_engine_skill_setsfor, _claude_skills_training_plan_engine_skill_nextday [INFERRED 0.85]
- **Per-exercise range double progression** — _claude_skills_training_plan_engine_skill_rep_range, _claude_skills_training_plan_engine_skill_progress, _claude_skills_training_plan_engine_skill_calibrate, _specs_sub_tasks_motor_de_planes_feature_01_catalogs_and_range_progression_repcenter, _specs_sub_tasks_motor_de_planes_feature_01_catalogs_and_range_progression_rep_range_table [INFERRED 0.85]
- **Plans of the 'planes de entrenamiento' roadmap built on the plan engine** — _specs_tasks_done_motor_de_planes_feature_plans_fb2, _specs_tasks_draft_plan_full_body_3_dias_feature_fb3, _specs_tasks_draft_plan_torso_pierna_4_dias_feature_tp4, _specs_tasks_draft_plan_empuje_traccion_4_dias_feature_et4, _specs_tasks_draft_plan_grupos_5_dias_feature_gr5, _specs_tasks_draft_plan_isometricos_feature_iso [INFERRED 0.95]
- **Exportaciones via shareFile (Web Share o descarga)** — _specs_tasks_done_datos_locales_copia_feature_backup_restore, _specs_tasks_done_informe_fisio_feature_physio_report, _specs_tasks_done_recordatorios_calendario_feature_ics_calendar [INFERRED 0.95]

## Communities (56 total, 3 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.05
Nodes (125): activeZones(), altEx(), answerCheck(), applyTheme(), askPain(), bodyPart(), calmMotion(), cue() (+117 more)

### Community 1 - "Specs de features (datos, editor, calor)"
Cohesion: 0.05
Nodes (67): Copia de seguridad (exportData/importData), IndexedDB tendon-fuerte kv store, Almacenamiento persistente, Guardado local, copia de seguridad y migracion (feature spec), Ejercicio propio (S.exlib, ids c_), Biblioteca EXERCISES / CATS (49 ejercicios), Selector de ejercicios (#pickersheet), Editor de rutina (dias A/B) (+59 more)

### Community 2 - "logic.js"
Cohesion: 0.11
Nodes (12): DAY_KEYS, dayIndex(), DAYS_ICS, isDayOf(), LEVEL_UP, nextDay(), plateCombos(), platesFor() (+4 more)

### Community 3 - "resolveDay"
Cohesion: 0.18
Nodes (9): activePlan()/dayIndex()/weeksSince()/firstWorkout(), 'Falta equipo' missing-slot item, implFor (logic.js), possible() via implFor, resolveDay(), resolvePlan(), resolveSlot(), syncRoutine() (app.js, called from render) (+1 more)

### Community 4 - "Figuras 3D (figures.js)"
Cohesion: 0.16
Nodes (45): add3(), box(), CAM, CAM_YAWS, CAM_YAWS_FRONT, camCache, camera(), capsule() (+37 more)

### Community 5 - "Pruebas e2e"
Cohesion: 0.06
Nodes (23): altRow, backup, backupPath, codoDetail, editedTpl, errors, first, guessIds (+15 more)

### Community 6 - "Pruebas unitarias"
Cohesion: 0.09
Nodes (23): B_NO_RINGS, calTarget(), ctx, defEq, disl, eq(), equip, est() (+15 more)

### Community 7 - "Catálogos data.js"
Cohesion: 0.10
Nodes (20): CATS, CHAIR_SEAT, EXERCISES, EXPERIENCE, HINGE, LYING, MUSCLE_NAMES, NO_RINGS (+12 more)

### Community 8 - "Skill motor de planes"
Cohesion: 0.16
Nodes (19): Training Plan Engine skill (SKILL.md), Alpha Progression double progression glossary, Boostcamp (auto-progression, swap exercises), Common pitfalls (custom items, duplicate slot, ramp), FitBudd home/gym versions, Integration map (v1.14.1 code), nextDay(), Pinned exercise (+11 more)

### Community 9 - "Migración y resolución de rutina"
Cohesion: 0.13
Nodes (18): A/B templates migration recipe (withDefaults), NO_RINGS substitution, Migration of v1.0-v1.14 data in withDefaults, Step 02: Plan engine (pure rules), defEq test fixture (copy of DEFAULT().equip), resolvePlan(), routineFromTemplates(), slotOf() (+10 more)

### Community 10 - "package.json"
Cohesion: 0.12
Nodes (15): author, description, devDependencies, playwright@^1.64.1, directories, test, keywords, license (+7 more)

### Community 11 - "Arquitectura y modelo de datos"
Cohesion: 0.17
Nodes (15): Arquitectura de XZ Fit, Delegated events via data-action map, Layers: data.js -> logic.js -> figures.js -> app.js (globals, no build), IndexedDB tendon-fuerte single record, Tests: unit.mjs (node vm) and e2e.mjs (Playwright), Modelo de datos, S.plan {id, pos, since, bw, deload, deloadOffer}, Routine Item {slot, ex, pinned} (+7 more)

### Community 12 - "Shell HTML, PWA y fuente"
Cohesion: 0.17
Nodes (13): v1.10.0 Light theme (Oscuro/Claro/Sistema), v1.3.0 Wake lock, sounds, voice, hands-free isometrics, SIL Open Font License 1.1 (Oswald), Oswald font (The Oswald Project Authors), OFL permission and conditions (no standalone sale, same license), Reserved Font Name, index.html (XZ Fit app shell), Dialog sheets (onb, wsheet, rsheet, painsheet, swapsheet, sumsheet...) (+5 more)

### Community 13 - "Reglas de negocio y calibración"
Cohesion: 0.20
Nodes (11): calibrate() range centre + RIR 2, Reglas de negocio (logic.js), Constants (REPS_MIN/MAX, TARGET_RIR, DEFAULT_SETS, PAIN_CAP...), Modo dolor (restriction, isoAdjust, phaseReady), Other rules (warmupSets, stalled, weekStats, streak, icsText), Strength estimate and calibration (Epley, repCenter), Step 01: Data catalogs and range-aware progression, PLANS.fb2 Full body 2 días (+3 more)

### Community 14 - "Huecos y posibilidad por equipo"
Cohesion: 0.22
Nodes (9): resolveSlot(), Codebase Impact Analysis: Motor de planes, Current A/B flow to replace (planFor(tpl), syncBudget, plan.next), implFor (possibility test), New flow PLANS -> routine -> resolveDay -> setsFor -> nextDay, Slot candidate exercises table, Motor de planes section of logic.js, Equipment rules (weightSteps, plateCombos, implFor) (+1 more)

### Community 15 - "Progresión y versiones del plan"
Cohesion: 0.18
Nodes (6): Pinned exercise swap in routine editor, v1.0.0 First version (PWA, IndexedDB, A/B full body, pain mode), v1.15.0 Plan engine: Full body 2 days with rotation, v1.16.0 Hoy no puedo (session-only exercise swap), Full body 2-day plan (Day A / Day B), Suggested weight (bodyweight x coefficient, 70% start, calibration)

### Community 16 - "Bucle de entreno y release 1.15"
Cohesion: 0.22
Nodes (10): sw.js network-first versioned cache, Step 03c: Workout loop, rotation and visible rep range, setLabel range-aware, showSummary texts ('cuando hagas <hi> en todas, sube'), Step 04: Routine editor per day and v1.15.0 bump, Edit-mode day tabs (editDay, edit-day action), Picker 'mismo hueco' section, Release v1.15.0 (APP_VERSION, sw.js cache) (+2 more)

### Community 17 - "Modo dolor y README"
Cohesion: 0.22
Nodes (8): Pain mode (6 zones, 3 phases, 60% cap, gentle variants), v1.14.1 New URL fdiaz96.github.io/xz-fit, v1.8.0 Rehab exercise options per zone and phase, README.md XZ Fit, Jeremy Ethier / Keith Baar / Coach Q tendon video, Pain mode (isometrics -> slow isotonics -> integration), sw.js (offline cache), Tests: unit.mjs, e2e.mjs, icon.mjs (Playwright)

### Community 18 - "Historial de versiones"
Cohesion: 0.22
Nodes (9): CHANGELOG.md (XZ Fit), v1.12.0 Isometric 3D illustrations with depth sorting, v1.14.0 Rename to XZ Fit, new logo, animated thumbnails, v1.1.0 AI-generated vector illustrations, v1.2.0 Custom machines, editable routine, custom exercises, v1.4.0 Summary, records (1RM), weekly card and streak, v1.5.0 Warm-up and physio report, v1.6.0 Dumbbell plate calculator and install card (+1 more)

### Community 19 - "Página de animaciones"
Cohesion: 0.29
Nodes (7): animaciones.html (temporary animation review page), CAM, EXERCISES, figureSVG, Render all EXERCISES via figureSVG into grid, MUSCLE_NAMES, v1.13.1 Temporary animation test page

### Community 20 - "Sincronización de rutina"
Cohesion: 0.40
Nodes (5): resolveDay(), setsFor() entry ramp + deload, syncRoutine() at start of render(), Planes y rotación rules, syncRoutine()

### Community 21 - "Animación por ángulos"
Cohesion: 0.50
Nodes (4): Animation frame tests (49 exercises, no reversed joints, muscle visible), Muscles as real body zones highlighted in red, Per-exercise camera angle, v1.13.0 Angle-based animation with 7 interpolated poses

### Community 23 - "Ícono 192"
Cohesion: 0.67
Nodes (3): PWA Home Screen Icon, XZ Fit App Icon (192px), XZ Fit Logo (lime-green bold XZ wordmark with white FIT on dark background)

### Community 24 - "Ícono 512"
Cohesion: 0.67
Nodes (3): PWA Launcher Icon, XZ Fit App Icon (512px), XZ Fit Brand Identity (lime XZ monogram on dark background)

### Community 27 - "Fuente: canal Mono Culturista"
Cohesion: 0.33
Nodes (5): Fuente: canal Mono Culturista, Fuera de alcance, Objetivos (sus tres planes pagos), Principios que se repiten, Rutinas que propone

### Community 28 - "recommendPlan() pure recommendation"
Cohesion: 0.24
Nodes (9): PLANS.fb2 Full body 2 días, SLOTS catalog (16 movement patterns), TEMPLATES A/B (legacy routine), recommendPlan() pure recommendation, Survey questions (goal, days 2-5, equipment), Plan fb3 Full body 3 días A/B/C, Plan de isométricos sin equipo (task 6/7), Plan iso Isométricos 3-4 días (+1 more)

### Community 29 - "REP_RANGE per exercise type"
Cohesion: 0.32
Nodes (7): planFor(day) workout enrichment, progress()/calibrate()/startWeight() with range, REP_RANGE per exercise type, repRange()/repCenter()/daySlot(), setsFor() entry ramp and deload, Plan Torso/Pierna 4 días (task 3/7), Plan tp4 Torso/Pierna 4 días

### Community 30 - "Plan Full body 3 días + selector (task 2/7)"
Cohesion: 0.33
Nodes (7): Motor de planes (feature spec, task 1/7), Acceptance checklist CK-1..CK-40 and rubric, Fuente Mono Culturista (analysis), Implementation phases (steps 01-05, opus review), Roadmap 'planes de entrenamiento' (7 tasks), training-plan-engine skill, Plan Full body 3 días + selector (task 2/7)

### Community 31 - "Plan engine (slots, rotation, per-exercise range)"
Cohesion: 0.29
Nodes (3): Plan por grupos 5 días (task 5/7), Editable 'Libre' day, Plan gr5 Por grupos 5 días

### Community 32 - "routineFromTemplates"
Cohesion: 0.29
Nodes (6): Lossless migration in withDefaults (templates A/B -> routine.fb2 pinned), NO_RINGS substitution map, routineFromTemplates(), State S.plan / S.routine model, Plan picker sheet #plansheet ('Elegí tu plan'), '¿Probás Full body 3 días?' suggestion card

### Community 33 - "Encuesta de elección de plan (task 7/7)"
Cohesion: 0.40
Nodes (4): Encuesta de elección de plan (task 7/7), Onboarding step 5 survey placement, Plan Empuje/Tracción 4 días (task 4/7), Plan et4 (recomposición 'gordiflaco')

### Community 34 - "finishLaterales"
Cohesion: 0.33
Nodes (9): card(), cards(), click(), closeSummary(), finishLaterales(), finishQuick(), openDay(), state() (+1 more)

### Community 35 - "UX 12: los avisos no tapan el encabezado"
Cohesion: 0.25
Nodes (7): Criterios de aceptación, Dónde, Problema, Propuesta, UX 12: los avisos no tapan el encabezado, pinnedNotice(), toastText()

### Community 36 - "UX 1: la calibración se explica una sola vez en la sesión"
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 1: la calibración se explica una sola vez en la sesión

### Community 37 - "UX 2: el campo de reps no parece cargado"
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 2: el campo de reps no parece cargado

### Community 38 - "UX 3: "Hoy no puedo" como acción secundaria"
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 3: "Hoy no puedo" como acción secundaria

### Community 39 - "UX 10: pesos con unidad y coherentes entre inicio y Entreno"
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Problema, Propuesta, UX 10: pesos con unidad y coherentes entre inicio y Entreno

### Community 40 - "UX 7: Historial ordenado por entreno y con vacíos útiles"
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 7: Historial ordenado por entreno y con vacíos útiles

### Community 41 - "UX 11: editar rutina con controles claros"
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 11: editar rutina con controles claros

### Community 42 - "Barrido de UX (2026-10-27): índice y reglas comunes"
Cohesion: 0.40
Nodes (4): Barrido de UX (2026-10-27): índice y reglas comunes, Orden, Reglas para cada tarea, shot()

### Community 43 - "UX 5: explicar "al 60 %" y "a calibrar""
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Problema, Propuesta, UX 5: explicar "al 60 %" y "a calibrar"

### Community 44 - "UX 6: la pestaña Tendones solo cuando importa"
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Problema, Propuesta, UX 6: la pestaña Tendones solo cuando importa

### Community 45 - "guessWeight"
Cohesion: 0.26
Nodes (12): calibrate(), epley1RM(), estimate1RM(), guessWeight(), noviceRange(), painCap(), repCenter(), roundDown() (+4 more)

### Community 46 - "UX 13: textos sin jerga ni cadenas con puntos medios"
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Problema, Propuesta, UX 13: textos sin jerga ni cadenas con puntos medios

### Community 47 - "saveV114"
Cohesion: 0.40
Nodes (5): bootSaved(), buildV114(), putData(), saveV114(), wipeDb()

### Community 48 - "addDays"
Cohesion: 0.22
Nodes (11): activePlan(), addDays(), dayKey(), parseDay(), pendingChecks(), streak(), targetSets(), weekBudget() (+3 more)

### Community 49 - "UX 8: zonas con dolor con el mismo componente que el alta"
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Problema, Propuesta, UX 8: zonas con dolor con el mismo componente que el alta

### Community 50 - "daysBetween"
Cohesion: 0.28
Nodes (9): daysBetween(), painLog(), phaseProgress(), phaseReady(), restriction(), suggestThreeDays(), weeksSince(), zoneFlare() (+1 more)

### Community 51 - "UX 4: el primer día no recibe al usuario con "día de descanso""
Cohesion: 0.33
Nodes (5): Criterios de aceptación, Dónde, Problema, Propuesta, UX 4: el primer día no recibe al usuario con "día de descanso"

### Community 52 - "resolveSlot"
Cohesion: 0.47
Nodes (6): equipUsed(), implFor(), possible(), resolveDay(), resolvePlan(), resolveSlot()

### Community 53 - "UX 9: el botón de fase invita a avanzar solo cuando corresponde"
Cohesion: 0.40
Nodes (4): Criterios de aceptación, Dónde, Problema, UX 9: el botón de fase invita a avanzar solo cuando corresponde

### Community 54 - "isoAdjust"
Cohesion: 0.67
Nodes (4): isoAdjust(), progress(), stepDown(), stepUp()

### Community 55 - "suggestLevelUp"
Cohesion: 0.67
Nodes (3): stalled(), strengthScale(), suggestLevelUp()

## Knowledge Gaps
- **61 isolated node(s):** `Sugerencia de pasar a 3 dias (suggestThreeDays)`, `Eliminar sesion con Deshacer`, `Tarjeta de instalacion (beforeinstallprompt / iOS)`, `Service worker sw.js (red primero, cache tendon-v<version>)`, `Tema claro/oscuro (applyTheme, tf-theme)` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 238 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `README.md XZ Fit` connect `Modo dolor y README` to `app.js`, `logic.js`, `Figuras 3D (figures.js)`, `Catálogos data.js`, `Shell HTML, PWA y fuente`, `Progresión y versiones del plan`, `Historial de versiones`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `render()` (e.g. with `noticeText()` and `renderHistory()`) actually correct?**
  _`render()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Sugerencia de pasar a 3 dias (suggestThreeDays)`, `Eliminar sesion con Deshacer`, `Tarjeta de instalacion (beforeinstallprompt / iOS)` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.051555555555555556 - nodes in this community are weakly interconnected._
- **Why does `getEx()` connect `app.js` to `Pruebas e2e`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `renderHome()` (e.g. with `render()` and `Dónde`) actually correct?**
  _`renderHome()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Specs de features (datos, editor, calor)` be split into smaller, more focused modules?**
  _Cohesion score 0.053313587560162905 - nodes in this community are weakly interconnected._