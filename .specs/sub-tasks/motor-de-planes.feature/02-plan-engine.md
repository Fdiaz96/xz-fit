# Step 02: Plan engine (pure rules in logic.js)

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 1
**Model:** opus
**Agent:** sdd:developer
**Depends on:** `01-catalogs-and-range-progression`
**Parallel with:** None
**Note:** Model justification: opus is earned by two triggers. The open-design trigger fires because this is a new resolution subsystem (per-day exclusion, `pref`, and invariants for pinned re-resolution). The data-integrity trigger fires because `routineFromTemplates` and the pinned rules decide how every user's stored routine is migrated.

**Goal:** Implement the pure plan engine as DOM-free functions in `logic.js`, covered by unit tests. It covers slot resolution, day re-resolution that respects pinned items, mapping the A/B lists to a routine for the migration, rotation, and set counts with the entry ramp and deload. Nothing in `app.js` changes, so the running app stays identical to v1.14.

Read `.claude/skills/training-plan-engine/SKILL.md`, then these task file sections: *Contracts → Engine*, the *`resolveDay` rule*, and decisions AD-1, AD-2, AD-3, AD-8 and AD-9. This step uses `SLOTS`, `PLANS` and `EXERCISES[id].reps` from step `01-catalogs-and-range-progression` (in `data.js`). `repRange` and `repCenter` already exist in `logic.js` above `startWeight`; do not redefine them.

Add a new section `// ——— Planes ———` to `logic.js`, after `// ——— Equipo ———`:
```
DEFAULT_SETS = 3
slotOf(id) → first slotId (declaration order) whose ex list contains id, else null (always null for 'c_…')
possible(id, equip, getEx = (id) => EXERCISES[id]) → !!(ex && implFor(ex, equip))       // reuse implFor logic.js:49, the ONLY possibility check (CK-36)
resolveSlot(slot, equip, { bw=false, exclude=[], pref=null, getEx }) → exId | null    // pref first, then SLOTS[slot].ex; skip exclude; bw → impl === 'bw'
resolvePlan(plan, equip, opts) → Item[][]   // pinned:false; pref = plan slot ex; exclude = ids already chosen in the SAME day;
                                            // no candidate → ex = pref ?? SLOTS[slot].ex[0] (renders "Falta equipo")
resolveDay(items, equip, opts) → { items, notices: [{ from, to }], changed }
routineFromTemplates(tpls, equip) → Item[][]  // [A, B] → { slot: slotOf(id), ex, pinned: true }; when !equip.rings apply NO_RINGS (remo_aros→remo_silla, remo_aros_iso→curl_iso) and stay pinned (AD-1)
firstWorkout(sessions) → oldest date of type 'entreno', or ''
activePlan(state) → PLANS[state.plan?.id] || PLANS.fb2
dayIndex(plan, pos) → pos if integer 0 ≤ pos < days.length else 0
nextDay(plan, pos) → (pos + 1) % days.length if pos valid, else 0
weeksSince(since, today) → since ? Math.floor(daysBetween(since, today) / 7) : 0     // reuse daysBetween logic.js:15
setsFor(sets, weeks, deload) → Math.max(1, sets − (weeks < 2 ? 1 : 0) − (deload ? 1 : 0))
daySlot(day, slot) → the day's first plan slot object with that slot, or null
```
The `resolveDay` rule walks the items in order and keeps track of the day's current ids:
- If `ex` is possible, return the SAME item object (same reference).
- If it is not possible and `slot === null`, return the same item. These are custom or added items, and the app shows them as missing.
- If it is not possible and has a slot, compute `r = resolveSlot(slot, equip, { ...opts, exclude: ids of the OTHER items of the day })`:
  - If `r` is found, return `{ slot, ex: r, pinned: false }`. If the item was pinned, add the notice `{ from, to: r }`.
  - If `r` is null, return `{ ...item, pinned: false }` (same `ex`). If the item was pinned, add the notice `{ from, to: null }`.
- `changed` is true if and only if some item object was replaced. Never mutate the input array or its items. `resolveDay` does NOT use the plan's `pref`, because items can be reordered. Unpinning on replacement is what guarantees each notice appears only once.

**Implementation note:** when `resolveSlot` finds no replacement for an UNPINNED impossible item, `resolveDay` returns the same item reference (not `{ ...item, pinned: false }`): the content is identical, so `changed` stays false and the app does not persist on every render. Pinned items still become `{ ...item, pinned: false }` with one notice. A small helper `isDayOf(plan, pos)` is shared by `dayIndex` and `nextDay`, and `libraryEx` is the default `getEx`.

**Out of scope for this step:** do NOT change `weekStats` (`logic.js:200`). Its target moves to the plan's day count in step `03a-state-migration-and-home`, together with the app cutover, so Phase 1 leaves the v1.14 weekly card intact. Do not touch `streak` or `suggestThreeDays`. Do not delete `weekBudget`, `setsPerExercise` or `targetSets`, because existing tests use them.

**Equipment fixtures.** Do NOT use the existing `equip` fixture from `tests/unit.mjs:12` as "default equipment": it has `rings: true` and `kb: [20, 12]`. Define a new fixture `defEq` that is an exact copy of the app's `DEFAULT().equip` (`app.js:22`): `{ db: { min: 2, max: 24, step: 2 }, kb: [], rings: false, bench: false, bar: false, band: false, machines: [] }`. Build variants with spread, for example `{ ...defEq, bench: true }` or `{ ...defEq, rings: true }`. Assign `ctx.defEq = defEq` the same way `ctx.equip` is set on line 13.

#### Expected Output

- `logic.js`: a `// ——— Planes ———` section with the 14 functions plus `DEFAULT_SETS`
- `tests/unit.mjs`: a block `// ——— Motor de planes ———` after the `// ——— Catálogos de planes ———` block written by step 01, before the final summary line

#### Success Criteria

- [X] CK-4: in `resolvePlan(PLANS.fb2, defEq)`, day 0 ids equal `TEMPLATES.A` and day 1 ids equal `TEMPLATES.B` with `remo_aros` replaced by `remo_silla`. With `{ ...defEq, rings: true }`, day 1 equals `TEMPLATES.B` as is.
- [X] CK-8: `resolveSlot` returns the slot's first possible exercise with full equipment, skips a first candidate that needs a bench when there is no bench, and returns `null` when nothing is possible.
- [X] CK-9: with `bw: true` it skips dumbbell exercises and returns a bodyweight one. With `bw: true` on a slot with no bodyweight candidate it returns `null`. `exclude: [first]` gives the next possible exercise, and `pref` is tried first.
- [X] CK-10: a pinned possible item is unchanged (same reference). An unpinned possible item is also unchanged when adding a bench makes a more preferred candidate possible. After the call, the input array deep-equals a clone taken before it.
- [X] CK-11: an unpinned impossible item becomes the first possible exercise of its slot that is not already used in the day. The replacement never duplicates another item's `ex`, and an impossible item with `slot: null` is kept as is.
- [X] CK-12 (unit part): a pinned `press_banco` without a bench becomes `{ ex: 'press_suelo', pinned: false }` with exactly one notice `{ from: 'press_banco', to: 'press_suelo' }`. Resolving that result again gives zero notices and `changed: false`.
- [X] CK-13: on a 2-day plan, pos 0 → 1 and pos 1 → 0. On a 3-day plan object, pos 2 → 0. On a 2-day plan, pos 5 → 0.
- [X] CK-15: `setsFor(3,0,false)=2`, `(3,1,false)=2`, `(3,2,false)=3`, `(3,3,false)=3`, `(3,5,true)=2`, `(3,0,true)=1` and `(1,0,true)=1`.
- [X] CK-26 (unit part): a slot with no possible candidate keeps the item (same `ex`), and `possible(ex)` is false.
- [X] Decision tests:
  - `routineFromTemplates` without rings: B contains `remo_silla` pinned and no `remo_aros`. With rings, B keeps `remo_aros`.
  - A custom `c_x` item becomes `slot: null, pinned: true`.
  - `slotOf('press_banco') === 'empuje_h'` and `slotOf('c_x') === null`.
  - `firstWorkout` ignores sessions that are not `entreno` and returns the oldest date.
  - `activePlan({ plan: { id: 'zzz' } }) === PLANS.fb2`.
  - `dayIndex` and `nextDay` handle an invalid pos (`-1`, `1.5`, `undefined`).
  - `weeksSince('', today) === 0`.
- [X] CK-36: `possible` calls `implFor` (no second implementation of the equipment rules).
- [X] `weekStats` is unchanged (`git diff logic.js` shows no change in it).
- [X] CK-33: every existing unit assertion is unchanged and passing, and `node tests/unit.mjs` exits 0.
- [X] CK-34 regression: `app.js` is untouched, and `node tests/e2e.mjs` still exits 0 with `python -m http.server 8124` running.

#### Subtasks

- [X] Add the `// ——— Planes ———` section to `logic.js` after `// ——— Equipo ———`, with `DEFAULT_SETS`, `slotOf`, `possible` and `resolveSlot`
- [X] Add `resolvePlan`, `resolveDay` and `routineFromTemplates` to `logic.js`, reusing `implFor` and `NO_RINGS`
- [X] Add `firstWorkout`, `activePlan`, `dayIndex`, `nextDay`, `weeksSince`, `setsFor` and `daySlot` to `logic.js`, reusing `daysBetween`
- [X] Add the `defEq` fixture to `tests/unit.mjs`, a copy of `DEFAULT().equip`
- [X] Write unit tests in the `tests/unit.mjs` block `// ——— Motor de planes ———` for CK-4, CK-8 to CK-11, the unit part of CK-12, CK-13, CK-15, the unit part of CK-26, and the decision tests above
- [X] Run `node tests/unit.mjs` until it exits 0, then run `node tests/e2e.mjs` as the regression gate

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | `SLOTS`/`PLANS` missing or misordered after step 01 | High | Low | Confirm step 01's assertions pass first; the CK-4 test pinpoints order issues |
| Risk | Wrong "default equipment" fixture (rings or kettlebells present) makes CK-4 pass for the wrong reason | High | Med | Use `defEq`, copied from `app.js:22`, never `equip` |
| Risk | CK-4 fails because exclusion is plan-wide instead of per day (without rings, both days need `remo_silla`) | High | Med | Exclude strictly per day; take `pref` from the plan slot's `ex` (AD-2) |
| Risk | `resolveDay` re-resolves possible items (the `score_2` anchor of Re-resolución mínima) | High | Low | Return the same reference for possible items; test reference identity and that adding a bench does not upgrade |
| Risk | Notices repeat on every render | Med | Low | Replaced items are always `pinned: false`; test that a second pass gives no notice |
| Risk | Custom exercises crash lookups (`EXERCISES['c_…']` is undefined) | High | Med | Pass `opts.getEx` through every function; never re-resolve items with `slot: null` |
| Risk | Inputs get mutated | Med | Low | Use map/spread only; test with a `structuredClone` comparison |
