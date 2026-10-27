# Step 03c: Workout loop, rotation and visible rep range (Phase 2 green gate)

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 2
**Model:** sonnet
**Agent:** sdd:developer
**Depends on:** `03b-train-view-and-routine-data`
**Parallel with:** None
**Note:** Its real data dependency is `03a` (`planFor(day)`). It runs after `03b` because both edit `app.js` and `tests/e2e.mjs`, and because this step owns the full-suite gate that closes Phase 2.

**Goal:** Run the workout on plan days:
- Start a day by index.
- Show "`<sets>` × `<lo>`–`<hi>` reps" with each exercise's real range.
- Calibrate and progress inside that range.
- Store sessions with `plan`/`day`/`tpl` and each weighted item's range.
- Advance `S.plan.pos` to the day after the one just done.
- Show the new summary texts.

Then make the whole `node tests/e2e.mjs` suite green, which is the Phase 2 milestone.

Read `.claude/skills/training-plan-engine/SKILL.md`, then these task file sections: *Runtime Scenario 3*, *Integration Map*, AD-5, AD-6 and AD-11.

After steps `03a`/`03b`:
- `planFor(day)` returns items with `it.sets` (from `setsFor`), `it.range = [lo, hi]` (from `repRange`), `it.missing`, `it.steps`, etc.
- The Home card and the Train view render start buttons with `data-action="start-workout" data-day="<n>"`.
- `S.plan.pos` and `activePlan`, `dayIndex`, `nextDay` are available. `plan.next` and `W.tpl` no longer exist anywhere else.

**This step OWNS these sites (line numbers from v1.14.1):**
- `app.js:951` action `'start-workout': () => startWorkout(Number(d.day))`.
- `app.js:369-378` `startWorkout(day)`: `W = { plan: activePlan(S).id, day, dayName: activePlan(S).days[day].name, items, started, warm }`, with items = `planFor(day)` without the missing ones (CK-26).
- `app.js:346-350` `setLabel`: for `peso`/`reps`, `` `${lo}–${hi} reps` `` from `p.range`; for `iso`/`tiempo`, seconds as today. Maintenance items (`maintenanceItems()`, `app.js:134`) have no `range`, so guard on `kind`.
- `app.js:393` reps placeholder: `repCenter(it.range)` for `peso`/`reps` (AD-5); timed placeholders are unchanged.
- `app.js:403` workout header: `W.dayName` instead of `Entreno ${W.tpl}`.
- `app.js:415`: `calibrate(…, it.steps, it.range)`.
- `app.js:440`: `progress(lift.w, …, it.steps, it.range)`.
- `app.js:427`, `:441-451` session:
  - Fields `{ plan: W.plan, day: W.day, tpl: String.fromCharCode(65 + W.day) }`.
  - Items with kind `peso`/`reps` also save `reps: it.range`.
- `app.js:453` rotation: `S.plan.pos = nextDay(activePlan(S), W.day)`. Advance from the day DONE, never from the stored pos.
- `app.js:464-471` `showSummary` (AD-11):
  - Title "¡`<W.dayName>` hecho! 💪".
  - For each weighted item whose weight did not change: "cuando hagas `<hi>` en todas, sube", using the saved `reps`.
  - "Próximo: `<activePlan(S).days[S.plan.pos].name>`."
- The history label (`app.js:728`) stays `Entreno ${s.tpl}`. Verify that old sessions with only `tpl` still render.
- `tests/e2e.mjs:118`: `s.plan.next === 'B'` becomes `s.plan.pos === 1` (same intent: after Día A, Día B is next).
- `tests/e2e.mjs:215`: `[data-action="start-workout"][data-tpl="A"]` becomes `[data-day="0"]`.
- **Full-suite gate:** run the whole `node tests/e2e.mjs`. Fix residual failures that come from Phase 2 changes. Selector or field renames go in the legacy assertions; behaviour bugs go in the owning code.
  - Never delete an assertion.
  - Where the new behaviour legitimately changes an expected value, update the value and keep the intent. For example, the brand-new user in the main flow now gets 2 sets per exercise during the ramp. Another example is a weight that shifts with a range; it was computed that goblet stays at 12 kg with kettlebells [12, 20].

**NOT owned here:** the Home card, `planFor`, the migration (`03a`); `renderTrain` and the editor data path (`03b`); the editor tabs/picker UX and `APP_VERSION` (`04`). If the gate reveals a bug in one of those, fix it minimally and say so in your report.

**e2e placement.** Add this step's new tests as section `// 4b. Rotación, rango visible y sesiones`, right after section 4 (`:118`), so they reuse the onboarded main-flow user where convenient. Use injected fixtures (as in block 0a) wherever a clean state is needed.

#### Expected Output

- `app.js`: `startWorkout(day)`, the `start-workout` action, range-aware `setLabel`/placeholder/header, calibrate/progress range wiring, session `plan`/`day`/`tpl`/`reps`, rotation with `nextDay`, and the new summary texts
- `tests/e2e.mjs`: section 4b, legacy updates at `:118` and `:215`, and value updates found by the full-suite gate

#### Success Criteria

- [X] `grep -nE "8–12 reps|12 reps|W\.tpl|data-tpl|S\.templates|plan\.next" app.js` returns nothing (CK-30 for the workout path).
- [X] Phase 2 gate, whole file (CK-30): `grep -nE "syncBudget|perDay|resolveEx|plan\.budget|plan\.next|S\.templates" app.js` returns nothing. No residual reads remain anywhere in `app.js`, including the sites that `03a` and `03b` left to later steps.
- [X] CK-21 (e2e): in the Día A workout, Elevaciones laterales shows "× 12–20" and Sentadilla goblet shows "× 6–12". The summary shows "cuando hagas 20 en todas, sube" for laterales and "Próximo: Día B".
- [X] Calibration wiring with a pinned value (e2e): with dumbbells 2–24 in steps of 2 (set `S.equip.db = { min: 2, max: 24, step: 2 }` in the fixture), no pain zones, no deload and no `lifts.lateral`, a calibration set on Elevaciones laterales of **6 kg × 15 reps with RIR 2** stores **`lifts.lateral.w === 4`** after finishing. The range `[12, 20]` targets 18 reps. Without the range the value would be 6.
- [X] CK-14 (e2e):
  - Do Día A and the Home proposes Día B; do Día B and it proposes Día A.
  - Starting Día B by hand from the Train tab when A was due, then finishing it, makes the next day Día A.
  - Shifting every session date back several days without training (`page.evaluate`) still proposes the day that was due.
- [X] CK-19 (e2e): with `profile.days = 3` and `plan.since` 20 days ago, every exercise in the workout sheet has 3 set rows, independent of `weekBudget`.
- [X] CK-25 (e2e): finishing Día A stores a session with `plan: 'fb2'`, `day: 0`, `tpl: 'A'`, and `reps: [12, 20]` on the laterales item. An injected old session with only `tpl: 'A'` renders in History with no `pageerror`.
- [X] CK-26 (e2e): without the equipment for one slot (for example `{ db: null, kb: [12, 20], rings: true, … }`, which leaves the `lateral` slot impossible), the Train tab shows "Falta equipo" on that item. The workout starts and contains 5 items, without that one.
- [X] CK-28 (e2e): the existing pain-mode (60 % cap and variant), calibration, deload (−1 set, 90 % weight), history and report assertions all pass unchanged in intent.
- [X] Phase 2 gate: `node tests/unit.mjs` exits 0 (CK-33), and `node tests/e2e.mjs` exits 0 with `python -m http.server 8124` running (CK-34), including blocks 0a/0b and the legacy sections.

#### Subtasks

- [X] Implement `startWorkout(day)` and the `start-workout` action with `Number(d.day)` in `app.js`
- [X] Update `setLabel`, the reps placeholder and the workout header in `app.js`
- [X] Pass `it.range` to `calibrate` and `progress`, and save `plan`/`day`/`tpl` on the session and `reps: it.range` on weighted items in `app.js`
- [X] Set rotation to `S.plan.pos = nextDay(activePlan(S), W.day)` and rewrite the `showSummary` texts (AD-11) in `app.js`
- [X] Update the legacy assertions at `tests/e2e.mjs:118` and `:215`
- [X] Write e2e section 4b in `tests/e2e.mjs` for CK-14, CK-19, CK-21, CK-25, CK-26, and the pinned calibration value
- [X] Run the full `node tests/e2e.mjs` and fix the residual Phase 2 failures as described (never delete assertions); run `node tests/unit.mjs`

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | `03a` did not expose `it.range`/`it.sets` on `planFor(day)` items | High | Low | Check `planFor(day)` first; report a gap rather than re-implementing it |
| Risk | Rotation advances from the stored pos instead of the day done | High | Low | Use `W.day`; the e2e starts Día B by hand when A was due |
| Risk | The summary hint shows on items that progressed, or on timed items | Low | Med | Only weighted items whose weight did not change; test a lateral and a timed item |
| Risk | Maintenance/iso items without `range` crash `setLabel` or the placeholder | Med | Low | Guard on `kind`; the pain-mode/maintenance regression stays green |
| Risk | The ramp lowers set counts in legacy assertions (a new user gets 2 sets) | Med | Med | Update the expected value and keep the intent; never delete the assertion |
| Risk | Residual failures from `03a`/`03b` surface only here | Med | Med | This step owns the Phase 2 gate; fix minimally and list each fix in the report |
| Risk | Lost writes to `app.js` / `tests/e2e.mjs` (large shared files edited by four sequential steps) | High | Low | Use the Edit tool only, never a whole-file Write; re-read the target region before each edit |

**Review iteration 2 fixes:** reset leaves a valid routine (resetRoutine) and the bench toast is null-safe; syncRoutine is now a query; hasRepRange single-sourced in logic.js; capped items excluded from the summary hint; e2e added for reset->Banco, progress() with range and the pain-mode variant.
