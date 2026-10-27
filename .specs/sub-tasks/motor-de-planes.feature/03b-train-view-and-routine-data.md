# Step 03b: Train view and routine data path on S.routine

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 2
**Model:** sonnet
**Agent:** sdd:developer
**Depends on:** `03a-state-migration-and-home`
**Parallel with:** None
**Note:** This step runs strictly after `03a` and before `03c`, because all three edit `app.js` and `tests/e2e.mjs`.

**Goal:** Port the Train tab and the routine editor's data path from `S.templates` to `S.routine`. Days are stacked from `plan.days`, use `data-day`, and mark "· toca hoy". Swaps and additions are stored pinned, reorder and delete work per day, deleting a custom exercise removes it from the routine, and "Volver al plan original" re-resolves the plan. The editor keeps today's look (stacked days, CATS-ordered picker); its new UX (one tab per day, a "mismo hueco" picker section) arrives in Phase 3 (step `04`).

Read `.claude/skills/training-plan-engine/SKILL.md`, then these task file sections: AD-4 (the `renderTrain` header row), AD-10, *Integration Map* rows `:219-240`, `:242-273`, `:315`, `:317-323` and `:1027-1030`, and *Runtime Scenario 2*.

What step 03a left in place:
- `S.routine[planId][day]` holds `{ slot, ex, pinned }` items.
- `S.plan = { id, pos, since, bw, deload, deloadOffer }`.
- `planFor(day)` returns enriched items (`ex`, `sets`, `range`, `missing`, `r`, `w`, `calib`, …).
- `syncRoutine()` runs at the start of every `render()`.
- `activePlan`, `dayIndex`, `resolvePlan`, `slotOf` and `getEx` are available. `resolveEx` no longer exists.

**This step OWNS these sites (line numbers from v1.14.1):**
- `app.js:219-240` `renderTrain`, both branches:
  - Header (AD-4): "`<plan.name>` · `<profile.days>` días por semana · cada ejercicio sube dentro de su rango."
  - Loop: `activePlan(S).days.forEach((dd, d) => …)` with `planFor(d)`, h2 = `dd.name` plus " · toca hoy" when `d === dayIndex(plan, S.plan.pos)`.
  - Every `data-tpl` becomes `data-day="${d}"`: start button, `routine-move`, `routine-del`, `routine-pick`. The start button reads "Empezar `<dd.name>`".
- `app.js:242-243`: `tplIds`/`routineSet` become `dayItems(day)`, meaning the routine items of that day whose `getEx(ex)` exists, and `routineSet(day, items)` (`S.routine[plan.id][day] = items; persist(); render();`, no `syncBudget`).
- `app.js:246-273` picker plus `pickExercise`:
  - `PK = { day, i }`.
  - The current item is `dayItems(PK.day)[PK.i]`.
  - A swap stores `{ ...item, ex: id, pinned: true }`, keeping the item's `slot`.
  - "+ Agregar" stores `{ slot: slotOf(id), ex: id, pinned: true }` (`slot: null` for `c_…`).
  - Keep today's section order (CATS, "· mismo grupo"); step `04` changes it.
- `app.js:315` `saveExForm`: `openPicker(PK.day, …)`.
- `app.js:317-323` `deleteExForm`: remove items with `ex === XF.id` from every day of every plan in `S.routine`; no `syncBudget`.
- `app.js:1027-1030` actions:
  - `routine-move`, `routine-del` and `routine-pick` use `d.day` and `dayItems`/`routineSet`.
  - `routine-reset` sets `S.routine[activePlan(S).id] = resolvePlan(activePlan(S), S.equip, { getEx, bw: S.plan.bw })`, then persists and renders. Its confirm text becomes "¿Volver al plan original? Se arma de nuevo según tu equipo. Tus ejercicios propios siguen en Mis ejercicios." and the button label becomes "Volver al plan original".
- `tests/e2e.mjs:188-203` (section 8b), legacy editor assertions. Keep what each one verified:
  - `[data-tpl="A"][data-i="1"]` becomes `[data-day="0"][data-i="1"]`.
  - `templates.A[1] === 'press_banco'` becomes `routine.fb2[0][1].ex === 'press_banco' && routine.fb2[0][1].pinned`.
  - `[data-tpl="B"]:not([data-i])` becomes `[data-day="1"]:not([data-i])`.
  - `templates.B.at(-1) === exlib[0].id` becomes `routine.fb2[1].at(-1).ex === exlib[0].id`, with `slot === null` and `pinned`.
  - The reorder check becomes `[data-day="1"][data-i="6"]` → `routine.fb2[1][5].ex`.
- `tests/e2e.mjs:312` onwards (section 11, the v1.0 fixture): keep or extend the assertion that the Train tab lists the 12 exercises (CK-5, second test case).

**NOT owned here (do not edit):**
- Step `03a`: `DEFAULT`, `withDefaults`, `syncRoutine`, `planFor`, the Home card.
- Step `03c`: `startWorkout`, the `start-workout` action, workout render/header, `setLabel`, calibrate/progress wiring, finish/session/rotation, `showSummary`.
- Step `04`: the editor tabs/`editDay`, the picker's "mismo hueco" section, `APP_VERSION`.

**e2e placement.** The main flow still aborts at the first workout start (`:83`) until `03c` lands. Put this step's new tests in a self-contained block `// 0b. Motor de planes: vista Entreno y rutina`, placed right after block `0a` and before `// 1. Primer uso`. It uses fixtures injected into IndexedDB (an onboarded v1.14-shaped user, or one already migrated with `routine`). Your legacy edits at `:188-203` and `:312` will first run in `03c`'s full-suite gate; write them carefully against the selectors above.

#### Expected Output

- `app.js`: `renderTrain` on `plan.days` with `data-day`, `dayItems`/`routineSet(day, items)`, pinned swap/add in `pickExercise`, `saveExForm`, `deleteExForm` across `S.routine`, and the `routine-*` actions including reset with `resolvePlan`
- `tests/e2e.mjs`: block `0b` (before section 1), and the updated legacy assertions in sections 8b and 11

#### Success Criteria

- [X] `grep -nE "S\.templates|data-tpl|d\.tpl|tplIds" app.js` returns nothing outside the workout functions owned by `03c` (`startWorkout`, the `start-workout` action).
- [X] e2e (block 0b): with default equipment and `pos 0`, the Train tab shows h2 "Día A · toca hoy" and "Día B", 12 `.ex` rows, and start buttons with `data-day="0"` and `data-day="1"`. Neither "Día A/B" letter logic nor "Cuerpo completo A/B" appears in the header.
- [X] e2e: in edit mode, ⇄ on Día A item 1 followed by choosing `press_banco` stores `routine.fb2[0][1]` as `{ slot: 'empuje_h', ex: 'press_banco', pinned: true }` (the slot is kept), and it survives a reload.
- [X] e2e: "+ Agregar" with a library exercise on Día B stores `{ slot: slotOf(id), ex: id, pinned: true }`. With a custom exercise it stores `{ slot: null, ex: 'c_…', pinned: true }`.
- [X] e2e: deleting that custom exercise from "Mis ejercicios" removes it from every day of `S.routine`.
- [X] CK-23 (e2e): after swapping and pinning exercises and adding a custom one, "Volver al plan original" (accept the confirm) makes `routine.fb2` equal to `resolvePlan(PLANS.fb2, S.equip, …)`, evaluated in the page, with no pinned items. The custom exercise is still listed in "Mis ejercicios" (`S.exlib` unchanged).
- [X] e2e: "Subir" and "Quitar" reorder and remove within the right day only. Removing is refused when only one item is left ("Dejá al menos un ejercicio.").
- [X] Every assertion in block 0b passes. Block 0a and section 1 still pass. `node tests/unit.mjs` exits 0.

#### Subtasks

- [X] Rewrite the `renderTrain` loop, header and buttons in `app.js` on `activePlan(S).days` with `data-day`
- [X] Replace `tplIds`/`routineSet` with `dayItems(day)` and `routineSet(day, items)` in `app.js`
- [X] Port the picker's current item and `pickExercise` (pinned swap that keeps the slot; pinned add with `slotOf`) in `app.js`
- [X] Update `saveExForm`, `deleteExForm` and the `routine-move`/`del`/`pick`/`reset` actions in `app.js`
- [X] Update the legacy editor assertions at `tests/e2e.mjs:188-203` and the Train check in section 11 (`:312`)
- [X] Write e2e block `0b` in `tests/e2e.mjs`: stacked days with toca hoy, pinned swap that persists, pinned add (library and custom), custom delete across the routine, CK-23 reset, per-day reorder/remove
- [X] Run `node tests/unit.mjs` and `node tests/e2e.mjs` (with `python -m http.server 8124`); blocks 0a, 0b and section 1 must pass

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | `03a` did not expose `planFor(day)` / `dayIndex` / `S.routine` as described | High | Low | Check them first; report a gap rather than re-implementing `03a` sites |
| Risk | A swap drops `slot`, so the item can no longer be re-resolved | High | Med | Spread the old item (`{ ...item, ex: id, pinned: true }`); assert `slot` in the e2e |
| Risk | Reset wipes custom exercises from the library | High | Low | Reset rewrites only `S.routine[plan.id]` and never touches `S.exlib`; the e2e asserts it |
| Risk | Legacy section-8b assertions are wrong, but nobody sees it until `03c` runs the whole suite | Med | Med | Follow the exact selector mapping above; `03c` owns fixing residual Phase 2 failures |
| Risk | Lost writes to `app.js` / `tests/e2e.mjs` (large shared files edited by four sequential steps) | High | Low | Use the Edit tool only, never a whole-file Write; re-read the target region before each edit |
