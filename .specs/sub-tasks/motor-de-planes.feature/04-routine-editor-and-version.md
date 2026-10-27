# Step 04: Routine editor per plan day, plus the v1.15.0 version bump

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 3
**Model:** sonnet
**Agent:** sdd:developer
**Depends on:** `03c-workout-loop-and-range-ui`
**Parallel with:** `05-docs`
**Note:** This step MUST run in parallel with `05-docs`. Their file sets are disjoint: this step edits only `app.js`, `sw.js` and `tests/e2e.mjs`, while `05-docs` edits only Markdown docs. This step is the only one in Phase 3 that edits `app.js`.

**Goal:** Finish "Editar rutina" on top of the routine data path that Phase 2 ported:
- In edit mode, show one tab per plan day.
- ⇄ lists the exercises of the same slot first, with every exercise still listed exactly once.
- Prove end to end that a pinned exercise that becomes impossible is replaced, and that its notice appears exactly once.
- Release the app as v1.15.0: `APP_VERSION` and the service-worker cache name.

Read `.claude/skills/training-plan-engine/SKILL.md`, then these task file sections: AD-10, *Integration Map* rows `:219-240` (edit branch) and `:246-273`, and *Runtime Scenario 2*.

What Phase 2 left in place:
- `renderTrain` stacks `activePlan(S).days` with `data-day` in both normal and edit mode.
- `dayItems(day)` / `routineSet(day, items)` exist, and the picker uses `PK = { day, i }`.
- `pickExercise` stores pinned swaps that keep `slot`, and pinned adds with `slotOf`.
- `routine-reset` uses `resolvePlan`, with the final confirm text.
- `syncRoutine()` shows the "ya no se puede con tu equipo" toast whenever `resolveDay` returns notices.

**This step OWNS these sites:**
- `renderTrain` **edit-mode branch** (AD-10):
  - Render a `.chips` row of tabs, one `button.chip` per plan day (`data-action="edit-day" data-day="<n>"`), with `.on` on the active one. Reuse the CSS at `styles.css:68-70`.
  - Add a module variable `editDay`. Only the `editDay` day is shown in edit mode.
  - The normal (non-edit) view stays stacked, unchanged.
- The `edit-routine` action initializes `editDay = dayIndex(activePlan(S), S.plan.pos)` when entering edit mode. Add a new action `edit-day`: `editDay = +d.day; render();`.
- Picker (`app.js:246-273`), for a swap only (`PK.i != null`):
  - The first section is titled "`<SLOTS[item.slot].name>` · mismo hueco" and lists that slot's exercises, built with the existing `row()` (`app.js:250-253`) and `missingLabel`.
  - Those ids are EXCLUDED from the CATS sections, so each `[data-ex=…]` appears exactly once.
  - Remove the old "· mismo grupo" ordering by `cat`.
  - Items with `slot: null` (custom exercises) get no "mismo hueco" section.
  - "+ Agregar" keeps the plain CATS listing.
- `app.js:5` `APP_VERSION = '1.15.0'`, and `sw.js:2` `CACHE = 'tendon-v1-15-0'` (CK-29, code part). The CHANGELOG entry is written by `05-docs`.
- `tests/e2e.mjs` section 8b (`:186-205`): before each `routine-pick`/`routine-move` on Día B, click `[data-action="edit-day"][data-day="1"]`, because edit mode now shows only one day. Keep every assertion's intent.

#### Expected Output

- `app.js`: the edit-mode tabs, `editDay`, the `edit-day` action, the `edit-routine` initialization, the picker's "mismo hueco" section with unique ids, and `APP_VERSION` 1.15.0
- `sw.js`: cache name `tendon-v1-15-0`
- `tests/e2e.mjs`: section 8b adapted to the tabs, and a new section `// 8b1. Editor por día y aviso de fijado`

#### Success Criteria

- [X] CK-22 (e2e): "Editar rutina" shows the tabs "Día A" and "Día B". ⇄ on the Día A press opens the picker, whose first section is "Empuje horizontal · mismo hueco" listing `press_banco`, `press_suelo` and `flexiones`. Choosing press en banco leaves `routine.fb2[0][1]` with `ex: 'press_banco', pinned: true`, which survives a reload.
- [X] e2e: in the swap picker, every `[data-ex]` value is unique. Assert in the page that the count of `[data-ex]` elements equals the size of the set of their values.
- [X] e2e: clicking the "Día B" tab shows only Día B's items in edit mode. Leaving edit mode shows both days stacked again.
- [X] CK-12 (e2e): with the bench enabled in Ajustes, pin press en banco via the editor, then turn the bench off in Ajustes → Equipo (`[data-action="eq-flag"][data-k="bench"]`).
  - The toast "Press en banco con mancuernas ya no se puede con tu equipo: lo cambiamos por press en el suelo con mancuernas." appears once.
  - `routine.fb2[0][1]` becomes `{ ex: 'press_suelo', pinned: false }`.
  - No such toast appears again after a reload, nor after returning to Home.
- [X] `grep -n "APP_VERSION = '1.15.0'" app.js` and `grep -n "tendon-v1-15-0" sw.js` both match.
- [X] `grep -nE "S\.templates|data-tpl|mismo grupo" app.js` returns nothing (CK-30).
- [X] No plan selector, survey, per-exercise rest, steps or cardio UI was added (CK-31).
- [X] `node tests/unit.mjs` exits 0 (CK-33), and `node tests/e2e.mjs` exits 0 with `python -m http.server 8124` running (CK-34).

#### Subtasks

- [X] Implement the edit-mode `.chips` tabs, `editDay`, the `edit-day` action and the `edit-routine` initialization in `app.js`
- [X] Rewrite the picker sections in `app.js`: "mismo hueco" first for swaps, those ids excluded from CATS, "mismo grupo" ordering removed
- [X] Bump `APP_VERSION` in `app.js:5` and `CACHE` in `sw.js:2`
- [X] Adapt section 8b in `tests/e2e.mjs` to the tabs
- [X] Write e2e section 8b1 in `tests/e2e.mjs` for CK-22, unique `data-ex`, tab switching and CK-12
- [X] Run `node tests/unit.mjs` and `node tests/e2e.mjs` (with `python -m http.server 8124`)

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | Phase 2 did not leave `PK = { day, i }` / `dayItems` as described | Med | Low | Check them first; report rather than re-port |
| Risk | Duplicate `data-ex` between "mismo hueco" and the CATS sections breaks selectors | Med | Med | Exclude same-slot ids from CATS; assert uniqueness in the e2e |
| Risk | Legacy section 8b clicks a Día B control that is hidden behind the tab | Med | High | Click `edit-day` `data-day="1"` before Día B actions |
| Risk | The notice repeats after a reload | Med | Low | Relies on `resolveDay` unpinning the item; the e2e reload check catches it |
| Risk | Concurrent edits with `05-docs` | Low | Low | File sets are disjoint; do not touch any `.md` file |
| Risk | Lost writes to `app.js` / `tests/e2e.mjs` (large shared files) | High | Low | Use the Edit tool only, never a whole-file Write; re-read the target region before each edit |
