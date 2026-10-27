# Step 03a: State model, migration, routine sync and Home screen

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 2
**Model:** opus
**Agent:** sdd:developer
**Depends on:** `02-plan-engine`
**Parallel with:** None
**Note:** This is the first of three sequential Phase 2 steps (`03a` → `03b` → `03c`). All three edit `app.js` and `tests/e2e.mjs`, so they never run at the same time. The full `node tests/e2e.mjs` suite is expected to go green only at the end of `03c` (see "e2e placement").

**Goal:** Move the app's state from `S.templates` and the weekly budget to `S.plan` / `S.routine`. The migration in `withDefaults` must be lossless and idempotent. `syncRoutine()` runs on every render, `planFor(day)` takes sets from `setsFor` and ranges from `repRange`, and the Home screen (the boot screen) runs on the new model. The weekly target becomes the plan's day count. The opus tier is earned by the critical-domain trigger: this is an irreversible migration of data that lives only on the user's device.

Read `.claude/skills/training-plan-engine/SKILL.md`, then these task file sections: *Contracts → State*, *Runtime Scenarios 1 and 2*, *Integration Map*, *`syncRoutine()`*, and AD-1, AD-4, AD-6, AD-8, AD-9 and AD-11. The engine already exists in `logic.js` under `// ——— Planes ———`:
- `slotOf`, `possible`, `resolveSlot`, `resolvePlan`, `resolveDay`, `routineFromTemplates`
- `firstWorkout`, `activePlan`, `dayIndex`, `nextDay`, `weeksSince`, `setsFor`, `daySlot`, `DEFAULT_SETS`
- `repRange`, `repCenter`, and the range-aware `startWeight`/`calibrate`/`progress`

Always pass the app's `getEx` (`app.js:96`) as `opts.getEx` (AD-8).

**This step OWNS these sites (line numbers from v1.14.1):**
- `app.js:19-27` `DEFAULT()`: remove `templates`, add `routine: {}`, and set `plan: { id: 'fb2', pos: 0, since: '', bw: false, deload: '', deloadOffer: '' }` (AD-6).
- `app.js:43` `withDefaults(d)` (Scenario 1). Migrate only when `!('routine' in d)`:
  - `routine = { fb2: routineFromTemplates(d.templates || TEMPLATES, equip) }`
  - `pos = d.plan?.next === 'B' ? 1 : 0`
  - `since = firstWorkout(d.sessions)`

  Always strip `templates` and `plan.budget`/`week`/`next`. An unknown `plan.id` becomes `'fb2'`. Never modify `lifts` or `sessions`. The function must be idempotent, because the backup import (`app.js:~936`) also calls it.
- `app.js:104-106`: remove `resolveEx`, `perDay` and `syncBudget`. Add `altEx(orig) = getEx(!S.equip.rings && NO_RINGS[orig.alt] ? NO_RINGS[orig.alt] : orig.alt)`, which is used only for the pain-mode alternative. Add `syncRoutine()` exactly as the task file specifies:
  - Set `since` to `today()` when it is empty.
  - Rebuild with `resolvePlan` when the routine is missing or its day count differs from the plan's.
  - Run `resolveDay` on each day.
  - Call `persist()` only if something changed and `S.onboarded`.
  - Show one joined `toast` for all notices: "`<from.name>` ya no se puede con tu equipo: lo cambiamos por `<to.name en minúscula>`." or "…: queda como falta equipo."
- `app.js:82-85` `render()`: call `syncRoutine()` first.
- `app.js:108-132`: `planFor(tpl)` becomes `planFor(day)`.
  - Items come from `S.routine[plan.id][day]`, skipping items whose `getEx(ex)` is null.
  - `sets = setsFor(daySlot(spec, it.slot)?.sets ?? DEFAULT_SETS, weeksSince(S.plan.since, today()), deload)`
  - `range = repRange(ex, daySlot(spec, it.slot))`, and call `startWeight(…, range)`.
  - Keep `missing: !impl` and the rest of the enrichment body (pain mode, calibration, deload `w * 0.9`, stalls).
  - Remove the old deload set decrement at `:119` (`deload ? Math.max(1, counts[i] - 1) : …`), because `setsFor` now handles deload.
- `app.js:203-210` Home card (AD-11):
  - `day = dayIndex(plan, S.plan.pos)`
  - tag = `plan.name`
  - h3 = "`<plan.days[day].name>` · N ejercicios", with N = items where `!missing`
  - button `data-action="start-workout" data-day="${day}"`

  "Entreno X" and "Cuerpo completo" disappear.
- `app.js:212` stuck list: unique ids from `S.routine[plan.id].flat().map((it) => it.ex)`, without `TEMPLATES` or `S.templates`.
- `app.js:214` "¿Pasamos a 3 días?" card text and the `app.js:1000` `three-days` action, per AD-4: no `syncBudget`, and the new texts "Venís constante. Con un día más, el plan rota más rápido." and toast "3 días por semana: el plan sigue rotando."
- `logic.js:200` `weekStats`: `target = activePlan(state).days.length` (CK-24). Do not touch `streak` or `suggestThreeDays`.
- `app.js:877-879` `setPath`: drop `syncBudget()`.
- `app.js:916` `onbNext`: replace `syncBudget()` with `S.routine[plan.id] = resolvePlan(plan, S.equip, { getEx, bw: S.plan.bw }); S.plan.pos = 0; S.plan.since = today();`
- `app.js:1063` bench toast: `S.routine[activePlan(S).id].flat().some((it) => it.ex === 'press_suelo')`.
- `tests/e2e.mjs:310` (legacy v1.0 fixture): replace `s.templates.A.length === 6` with `s.routine.fb2.length === 2 && s.routine.fb2.every((d) => d.length === 6) && s.plan.pos === 1 && !('next' in s.plan)`. The fixture has `next: 'B'` at `:304`. Keep the rest of the assertion.

**NOT owned here (do not edit):**
- Step `03b`: `renderTrain`, `tplIds`/`routineSet`, the picker, `pickExercise`, `saveExForm`, `deleteExForm`, the `routine-*` actions.
- Step `03c`: `startWorkout`, the `start-workout` action, workout render/header, `setDone`/calibrate, `finishWorkout`/session/rotation, `showSummary`, `setLabel`.
- Step `04`: `APP_VERSION`.

Until `03b` and `03c` land, the Train tab and workout start still read the old shapes and will throw. That is expected inside the phase.

**e2e placement (important).** `tests/e2e.mjs` is one sequential script. The main flow opens Train at `:63` and starts a workout at `:83`, and both fail until `03b`/`03c` land. So:
- Put this step's new tests in a self-contained block `// 0a. Motor de planes: migración, sincronización e inicio`, placed immediately BEFORE `// 1. Primer uso` (`tests/e2e.mjs:23`). Each case wipes IndexedDB (same call as `:25`), injects its fixture in the shape of the v1.0 fixture at `:299-313`, reloads, and asserts. Section 1 wipes the DB again, so the main flow is unaffected.
- Add the new-user CK-7 assertion inside section 1, right after onboarding finishes (around `:55`, before the Train tab is opened at `:63`): `await page.evaluate(() => planFor(dayIndex(activePlan(S), S.plan.pos)).every((p) => p.missing || p.sets === 2))`.
- Build v1.14 fixtures with `templates: { A, B }`, `plan: { budget, week, next }`, `lifts`, and `sessions` dated with `addDays(today(), -n)` (computed in the page, as at `:137`/`:250`). Record `page.on('pageerror')` messages for the block and assert there are none.

**Implementation notes (03a done):**
- `altEx` uses the pure `ringsSwap` from `logic.js` (Phase 1 carry-over) instead of restating the `NO_RINGS` ternary. The toast text lives in a small `noticeText({ from, to })` helper next to `syncRoutine`.
- `withDefaults` merges `{ ...TEMPLATES, ...d.templates }` before `routineFromTemplates`, so a backup missing one of A/B still migrates. `routine: { ...d.routine }` keeps an already-migrated routine (a null `routine` becomes `{}` and is rebuilt by `syncRoutine`).
- `planFor(day)` also puts `range` on every item (03c reads `it.range` for the label, calibration and progress).
- CK-28 stall: `press_banco` + `curl_concentrado` (both outside `TEMPLATES`; `rdl` is in `TEMPLATES.A`, so it would not prove the stuck list reads `S.routine`).
- Extra coverage: e2e for CK-12 shell part (pinned `press_banco` without a bench → one exact toast, saved unpinned as `press_suelo`, no toast after reload); unit `weekStats` with unknown plan id and a `streak` check that still uses `profile.days`. Block 0a uses its own `ps` variable because `s` is declared later with `let` in section 1.
- Verified: `node tests/unit.mjs` exits 0; in `node tests/e2e.mjs` all 29 block 0a assertions and section 1 pass. The run then fails at the Train tab (`renderTrain` still reads `S.templates`), as expected until `03b`/`03c`.

#### Expected Output

- `app.js`: new `DEFAULT`, `withDefaults` migration, `syncRoutine`, `altEx`, `planFor(day)`, the Home card, stuck list and three-days card/action, and the `setPath`/`onbNext`/bench-toast call sites
- `logic.js`: `weekStats` target by plan
- `tests/unit.mjs`: `weekStats` assertions in the `// ——— Motor de planes ———` block
- `tests/e2e.mjs`: block `0a` (before section 1), the new-user assertion in section 1, and the updated legacy assertion at `:310`

#### Success Criteria

- [X] The functions this step owns (`DEFAULT`, `withDefaults`, `syncRoutine`, `altEx`, `planFor`, `render`, `renderHome`, `setPath`, `onbNext`, the `three-days` action and the bench toast in the `eq-flag` handler) contain no `syncBudget`, `perDay`, `resolveEx`, `plan.budget`, `plan.next` or `S.templates`. The definitions of `resolveEx`/`perDay`/`syncBudget` are removed. Remaining references inside `renderTrain`, `tplIds`/`routineSet` (owned by `03b`) and `finishWorkout`/`showSummary` (owned by `03c`) are expected and are cleared by those steps. The whole-file grep is part of `03c`'s Phase 2 gate.
- [X] Unit: `weekStats` target is 2 for `{ plan: { id: 'fb2' }, profile: { days: 3 }, … }`, and also 2 when `state.plan` is missing. `node tests/unit.mjs` exits 0 (CK-33).
- [X] CK-5 (e2e, block 0a): a v1.14 fixture with rings, A edited (`press_banco` instead of `press_suelo`), B reordered and a custom `c_…` exercise at the end of B. After reload, `routine.fb2[d].map((it) => it.ex)` equals the stored `templates` per day, item by item, and every item has `pinned: true`.
- [X] CK-6 (e2e): with `next: 'B'`, the result is `pos === 1` and the Home card shows "Día B". With `next: 'A'`, `pos === 0`. `budget`, `week` and `next` are absent from `S.plan`, and `lifts`/`sessions` deep-equal the fixture. Reloading twice, then importing the same v1.14 backup through `withDefaults`, leaves `routine` and `plan` deep-equal.
- [X] CK-7 (e2e): for a migrated user whose first `entreno` was 20 or 14 days ago, `planFor(day)` gives 3 sets per non-missing item. For 13 days ago it gives 2 sets. A brand-new onboarded user (section 1 assertion) gets 2 sets.
- [X] CK-20 (e2e): with default equipment the Home card shows "Día A · 6 ejercicios", and neither "Entreno A" nor "Cuerpo completo". With equipment where one Día A slot has no possible exercise, N drops to 5. For example, `{ db: null, kb: [12, 20], rings: true, … }` leaves the `lateral` slot (lateral, elev_frontal, both dumbbell) impossible; confirm `implFor` treats `db: null` as "no dumbbells".
- [X] CK-24 (e2e): with `profile.days = 3` and plan fb2, the weekly card shows 2 dots (`#view-home .week .dots i` count is 2).
- [X] CK-27 (e2e): with a stored `plan.id: 'zzz'`, the app opens, the Home card shows "Día A · …", `S.plan.id === 'fb2'`, and no `pageerror` occurs.
- [X] CK-32 (e2e): with v1.14 data without rings and `remo_aros` in B, `routine.fb2[1]` contains `remo_silla` (pinned), and no toast containing "ya no se puede" appears after boot or after a second reload.
- [X] CK-28 stall (e2e, owner of the stuck list): with 2 routine exercises that are NOT in `TEMPLATES` (for example a pinned `press_banco` plus `rdl`) stalled for 3 sessions, the Home screen shows "¿Semana de descarga?". This proves the stuck list reads `S.routine`.
- [X] Every assertion in block 0a passes and section 1 still passes, even though the rest of the main flow may stop at the Train tab until `03b`/`03c`.

#### Subtasks

- [X] Rewrite `DEFAULT()` and `withDefaults()` in `app.js` per Scenario 1 (idempotent, lossless, unknown plan becomes fb2)
- [X] Replace `resolveEx`/`perDay`/`syncBudget` in `app.js` with `altEx` and `syncRoutine()`, and call `syncRoutine()` at the start of `render()`
- [X] Rewrite `planFor(day)` in `app.js` with `setsFor`, `repRange` and `startWeight(…, range)`, and remove the deload decrement at `:119`
- [X] Update the Home card, stuck list and three-days card/action in `app.js`, plus the `setPath`, `onbNext` and bench-toast call sites
- [X] Change the `weekStats` target in `logic.js:200`, and add unit assertions in `tests/unit.mjs`
- [X] Write e2e block `0a` in `tests/e2e.mjs` for CK-5 (state level), CK-6, CK-7 (migrated, 3 BVA dates), CK-20, CK-24, CK-27, CK-32 and the CK-28 stall case; add the new-user CK-7 assertion in section 1
- [X] Update the legacy assertion at `tests/e2e.mjs:310` to `routine.fb2` / `plan.pos`
- [X] Run `node tests/unit.mjs`, then `node tests/e2e.mjs` with `python -m http.server 8124` running from the repo root. Block 0a and section 1 must pass.

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | The e2e run needs `python -m http.server 8124` running from the repo root | Med | Low | Start it in the background before `node tests/e2e.mjs` |
| Risk | The migration loses or reorders a user's routine (data lives only on the device) | High | Med | Use `routineFromTemplates` literally; the e2e compares the input templates with the output routine item by item; never rebuild from slots when templates exist |
| Risk | The migration is not idempotent (importing an old backup after migrating) | High | Med | Gate on `!('routine' in d)`; test a double reload plus an import |
| Risk | Deload subtracts twice (the old decrement at `:119` plus `setsFor`) | Med | High | Remove the `:119` decrement explicitly |
| Risk | Migrated users lose sets because of the ramp | Med | Med | `since = firstWorkout(sessions)`; BVA tests at 13, 14 and 20 days |
| Risk | `syncRoutine` persists before onboarding, or loops renders | Med | Low | Persist only when `changed && S.onboarded`; never call `render()` inside `syncRoutine` |
| Risk | The main e2e flow aborts at the Train tab until `03b`/`03c` land, hiding this step's tests | Med | High | New tests live in block 0a before section 1 and run first; the full-suite gate belongs to `03c` |
| Risk | Lost writes to `app.js` / `tests/e2e.mjs` (large shared files edited by four sequential steps) | High | Low | Use the Edit tool only, never a whole-file Write; re-read the target region before each edit |

**Review iteration 2 fixes:** reset leaves a valid routine (resetRoutine) and the bench toast is null-safe; syncRoutine is now a query; hasRepRange single-sourced in logic.js; capped items excluded from the summary hint; e2e added for reset->Banco, progress() with range and the pain-mode variant.
