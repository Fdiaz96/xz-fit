# Step 05: Changelog, README and project analysis docs for 1.15.0

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 3
**Model:** sonnet
**Agent:** sdd:tech-writer
**Depends on:** `03c-workout-loop-and-range-ui`
**Parallel with:** `04-routine-editor-and-version`
**Note:** This step MUST run in parallel with `04-routine-editor-and-version`. It edits ONLY the Markdown files listed below. It must not touch `app.js`, `sw.js`, `data.js`, `logic.js` or any test file. The `APP_VERSION` and `sw.js` cache bump belong to step `04`.

**Goal:** Document release 1.15.0. Add the `CHANGELOG.md` entry, and update `README.md` and the three project analysis docs. They must describe the plan engine (the `plan`/`routine` model, rotation by sequence, `setsFor` with ramp and deload, and per-exercise rep ranges) instead of A/B templates and the weekly volume budget.

The task file fully specifies the behaviour: *Contracts*, *Architecture Decisions* AD-1 to AD-11, and *Integration Map → Other files*. After Phase 2 the code in `app.js`/`logic.js`/`data.js` implements it. Read that code to confirm names, but describe behaviour, not line numbers. All user-facing text is in rioplatense Spanish and follows the tone and format of existing entries.

Edits:
- `CHANGELOG.md`: a new top entry `1.15.0` in the existing format, titled "Motor de planes: Full body 2 días con rotación y rango por ejercicio". Use only user-visible bullets:
  - The Home screen shows "Día A · N ejercicios".
  - The next day is always the one after the last day done.
  - Workout and summary show the real range of each exercise ("cuando hagas 20 en todas, sube").
  - One set less during the first 2 weeks of the plan.
  - The editor has one tab per day, with exercises of the same slot first and the choice kept fixed.
  - "Volver al plan original".
  - The edited routine, weights and history are kept on update.
- `README.md:21`: replace the "A/B … 8–12, volumen +30 %" description with the plan, rotation and per-exercise range.
- `.specs/analysis/modelo-de-datos.md`:
  - `S.plan = { id, pos, since, bw, deload, deloadOffer }`.
  - `S.routine[planId][day]` items `{ slot, ex, pinned }`.
  - Removed `templates`, `plan.budget`, `plan.week` and `plan.next`, with the migration rule.
  - Session fields `plan`/`day`/`tpl`, and the item `reps`.
- `.specs/analysis/reglas-de-negocio.md`:
  - `setsFor` (ramp while < 2 weeks, deload −1, minimum 1).
  - Rep ranges by exercise type, and the calibration target (range center + RIR 2).
  - Rotation by sequence.
  - Slot resolution and pinned/re-resolution rules, including the one-time notice.
  - The weekly target equals the plan's day count.
- `.specs/analysis/arquitectura.md`: the new "Planes" engine section in `logic.js`, the `SLOTS`/`PLANS` catalogs in `data.js`, and `syncRoutine()` called from `render()` in the shell.

#### Expected Output

- `CHANGELOG.md`, `README.md`
- `.specs/analysis/modelo-de-datos.md`, `.specs/analysis/reglas-de-negocio.md`, `.specs/analysis/arquitectura.md`

#### Success Criteria

- [ ] `CHANGELOG.md`'s top entry is 1.15.0, in the existing format (CK-29, docs part).
- [ ] `README.md` no longer mentions A/B templates, a fixed 8–12 for every exercise, or "volumen +30 %".
- [ ] The three analysis docs describe `plan`/`routine`, `setsFor`, ranges, rotation and pinned re-resolution, with no stale mention of `templates`/`budget`/`plan.next` as current behaviour (`grep -n "plan.next\|budget\|templates" .specs/analysis/{modelo-de-datos,reglas-de-negocio,arquitectura}.md` matches only historical or migration context).
- [ ] No out-of-scope feature is announced: no new plans, plan selector, survey, per-exercise rest, steps or cardio (CK-31).
- [ ] `git diff --name-only` for this step lists only the five Markdown files above.

#### Subtasks

- [ ] Write the 1.15.0 entry in `CHANGELOG.md`
- [ ] Update the Entreno line in `README.md:21`
- [ ] Update `.specs/analysis/modelo-de-datos.md`
- [ ] Update `.specs/analysis/reglas-de-negocio.md`
- [ ] Update `.specs/analysis/arquitectura.md`
- [ ] Verify with the grep checks above and confirm that only the listed files changed

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Risk | The docs describe editor behaviour that step 04 (running in parallel) implements slightly differently | Low | Low | Describe only what the task file's AD-10 and Contracts fix; avoid line numbers and selector names |
| Risk | The changelog announces out-of-scope features | Med | Low | Limit bullets to the scope list in the task file |
| Risk | An accidental edit to a code file collides with step 04 | Med | Low | Touch only the five Markdown files; check with `git diff --name-only` |
