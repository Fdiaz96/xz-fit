---
name: Training Plan Engine (XZ Fit)
description: Slot/pattern-based training plans for XZ Fit - SLOTS/PLANS data, hybrid stored routine with pinned items, day rotation, set ramp/deload and per-exercise rep-range double progression, plus migration from the A/B templates.
topics: training plans, movement-pattern slots, exercise substitution, double progression, rep ranges, rotation, state migration, vanilla JS PWA, IndexedDB
created: 2026-10-26
updated: 2026-10-26
scratchpad: .specs/scratchpad/ef7e7064.md
---

# Training Plan Engine (XZ Fit)

## Overview

XZ Fit is a vanilla-JS PWA (`data.js` -> `logic.js` -> `figures.js` -> `app.js`, all globals, no bundler). The plan engine replaces the fixed A/B `TEMPLATES` and the weekly set budget with **plans made of slots** (movement patterns). Each slot has ranked candidate exercises, filtered by the user's equipment. The routine is **stored resolved** (hybrid approach). Only items that became impossible get re-resolved. Items the user picked stay **pinned**. Every plan task (fb2, fb3, tp4, et4, gr5, isometric plan, survey) builds on this engine.

---

## Key Concepts

- **Slot (hueco)**: a movement pattern id (e.g. `empuje_h`, `traccion_v`, `bisagra`) with an ordered list of candidate exercise ids (`SLOTS[slot].ex`).
- **Plan**: `{ id, name, days: [{ name, slots: [{ slot, sets, reps? }] }], source }`. An optional `reps` on a slot overrides the exercise range (needed later by `et4`).
- **Routine**: `S.routine[planId][dayIdx] = [{ slot, ex, pinned }]`, the resolved exercises the user actually does.
- **Pinned**: the user chose this exercise. It is never auto-replaced while it stays possible.
- **Rotation**: `S.plan.pos` is the index of the next day. After any workout, next = day after the one done, whatever the weekday.
- **Rep range**: `EXERCISES[id].reps = [min, max]`. Default `[8, 12]` keeps today's behaviour exactly.

---

## Documentation & References

| Resource | What it covers | Link |
|---|---|---|
| Channel source (project) | Ranges per type, 3 sets, RIR 1-2, +1 rep/week then weight | `.specs/analysis/fuente-mono-culturista.md` |
| Business rules (project) | Current constants, progression, deload | `.specs/analysis/reglas-de-negocio.md` |
| Data model (project) | `S` shape, sessions, lifts | `.specs/analysis/modelo-de-datos.md` |
| Alpha Progression glossary | Double progression definition | https://alphaprogression.com/en/glossary/double-progression |
| Boostcamp auto-progression | Top-of-range on all sets, then weight up | https://www.boostcamp.app/features/auto-progression |
| Boostcamp swap exercises | Swap keeps sets/reps, same pattern, keep it for the block | https://www.boostcamp.app/features/swap-exercises |
| FitBudd home/gym versions | Same pattern swaps (bench -> push-ups, cable row -> inverted row) | https://www.fitbudd.com/insights/how-to-deliver-at-home-and-gym-versions-of-the-same-workout |
| Schoenfeld et al. 2017 meta-analysis | Low vs high load give similar hypertrophy near failure, so higher isolation ranges are fine | https://pubmed.ncbi.nlm.nih.gov/28834797/ |

---

## Recommended Libraries & Tools

| Name | Purpose | Notes |
|---|---|---|
| None (plain JS) | Engine is pure functions in `logic.js` | Do not add dependencies. The project has no bundler. |
| playwright `^1.64.1` (already installed) | e2e `tests/e2e.mjs` | Needs `python -m http.server 8124` running |
| node `vm` (built in) | unit `tests/unit.mjs` loads data.js + logic.js + figures.js into one context | New globals in data.js (`SLOTS`, `PLANS`) are visible to logic.js |

**Approach comparison** (task chose hybrid):

| Approach | Verdict |
|---|---|
| Fully dynamic (resolve on every render) | Avoid. Exercises flip when equipment changes, user edits need an overlay, and history breaks. |
| Fully stored copies (today's A/B) | Avoid. Impossible items linger and the picker cannot know the slot. |
| **Hybrid: stored + slot + pinned** | Recommended. Edits are kept and only broken items re-resolve. Matches the source's advice "no cambiar ejercicios seguido". |

---

## Patterns & Best Practices

### Pure rules, DOM-free, never mutate inputs
`logic.js` holds only pure functions tested via `L('expr')`. Return new arrays and objects. Let `app.js` do toasts and `persist()`.

### Resolution with an injectable "possible" check
Custom exercises (`c_…` in `S.exlib`) are NOT in `EXERCISES`. Keep the rules pure and pass the lookup in. Use `opts.getEx` (default `(id) => EXERCISES[id]`) and possibility = `!!implFor(ex, equip)`. When `opts.bw` is set, the exercise must also resolve to `'bw'`.

```js
function resolveSlot(slot, equip, { bw = false, exclude = [], getEx = (id) => EXERCISES[id] } = {}) {
  for (const id of SLOTS[slot]?.ex || []) {
    if (exclude.includes(id)) continue;
    const ex = getEx(id), impl = ex && implFor(ex, equip);
    if (impl && (!bw || impl === 'bw')) return id;
  }
  return null;   // -> the item renders as "Falta equipo"
}
// Returns { items, notices }. A pinned item that became impossible shows one notice, is re-resolved and becomes unpinned (so it only warns once).
function resolveDay(items, equip, opts = {}) { /* exclude ids already used in the day; keep slot:null custom items as-is */ }
```

### Rotation
```js
const nextDay = (plan, pos) => (pos + 1) % plan.days.length;
// finishWorkout: S.plan.pos = nextDay(plan, doneDayIdx)  (use the day DONE, not the stored pos)
```

### Sets: entry ramp + deload
```js
// weeks = Math.floor(daysBetween(S.plan.since, today()) / 7)
const setsFor = (sets, weeks, deload) => Math.max(1, sets - (weeks < 2 ? 1 : 0) - (deload ? 1 : 0));
```
Taken literally, the spec stacks ramp and deload (-2). Deload still also applies `w * 0.9` in `app.js`, which stays unchanged.

### Range-aware double progression (backward compatible)
```js
function progress(w, sets, steps, [lo, hi] = [REPS_MIN, REPS_MAX]) {
  const done = sets.filter((s) => s.reps > 0);
  if (!done.length) return w;
  if (done.every((s) => s.reps >= hi)) return stepUp(steps, w);
  if (done.some((s) => s.reps < lo)) return stepDown(steps, w);
  return w;
}
// calibrate: work weight for (centre + RIR 2) reps; centre = Math.round((lo + hi) / 2)
// [8,12] -> 12 (identical to today) · [12,20] -> 18 · [10,15] -> 15 · [6,12] -> 11
```
Rep range of an item: `slotItem.reps ?? ex.reps ?? [8, 12]`.

---

## Similar Implementations

- **Boostcamp**: when you swap an exercise it keeps the program's sets, reps and intensity. Substitutes should share the pattern and loading, and you should keep the swap for the whole block. This maps to "the slot keeps `sets`, the pinned exercise brings its own `reps`".
- **FitBudd**: each slot has gym and home variants of the same pattern. This maps to ranked `SLOTS[slot].ex` (equipment-heavy first, bodyweight last).
- **Trainerize users** asked to filter substitutes by pattern and equipment. This maps to the picker showing "same slot first" (replacing today's "mismo grupo" by `cat`).

---

## Integration Map (current code, v1.14.1)

| Where | Today | Change |
|---|---|---|
| `data.js:370` `TEMPLATES` | A/B id lists | Keep (migration/legacy) + add `SLOTS`, `PLANS.fb2`, `reps` on exercises |
| `data.js:388` `NO_RINGS` | remo_aros -> remo_silla | Slots supersede it; still apply it when migrating (see pitfalls) |
| `app.js:19-27` `DEFAULT()` | `templates`, `plan {budget, week, next}` | `routine: {}`, `plan { id:'fb2', pos:0, since, bw:false, deload:'', deloadOffer:'' }` |
| `app.js:43` `withDefaults` | Shallow merge, only migration point, also used by import (`:936`) | Idempotent migration (below) |
| `app.js:104-130` `resolveEx/perDay/syncBudget/planFor(tpl)` | Budget-based sets | `planFor(dayIdx)` from routine + `setsFor` + range |
| `app.js:203-212` home card, stuck list | `S.plan.next`, `TEMPLATES` | "<día> · N ejercicios"; stuck over routine ids |
| `app.js:222-235` train view | Loop `['A','B']` | One tab per `plan.days` |
| `app.js:242-273` picker | Groups by `CATS`, `data-tpl` | Same-slot candidates first, set `pinned:true` |
| `app.js:321`, `:1030`, `:1063` | Edit `S.templates` | Use routine; reset = re-resolve slots (unpin) |
| `app.js:348` `setLabel` | Hard-coded `'8–12 reps'` | `${lo}–${hi} reps` |
| `app.js:369-471` workout/finish/summary | `W.tpl`, `S.plan.next` toggle, "12 reps" text | `W.plan/W.day`; session `{plan, day, tpl}`; rotation; "cuando hagas {hi} en todas, sube" |
| `app.js:728` history label | `Entreno ${s.tpl}` | Day name when `s.plan` exists, else legacy `tpl` |
| `logic.js` `weekStats/streak` | `profile.days` | Weekly card target = `plan.days.length` (spec) |
| `sw.js` `CACHE`, `APP_VERSION` | `tendon-v1-14-1` / `1.14.1` | Bump both together |

### Migration recipe (in `withDefaults`)
1. Only when `d.templates && !d.routine?.fb2` (idempotent; old backups can be imported at any time).
2. For each `tpl` A/B, map each id to `{ slot: SLOT_OF[id] ?? null, ex: id, pinned: true }`, using a lookup from the `fb2` slot of the same position or from `SLOTS` membership. Custom `c_…` ids get `slot: null`.
3. `plan.pos = d.plan?.next === 'B' ? 1 : 0`, `plan.id = 'fb2'`, `plan.since` = today (or the first session date), then drop `budget/week/next/templates`.
4. An unknown `plan.id` falls back to `'fb2'`.

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|---|---|---|
| Migrated pinned `remo_aros` without rings -> "impossible pinned" warning on first open | Med | Apply `NO_RINGS` while migrating, or don't warn for items marked migrated |
| Custom (`c_…`) items have no slot -> resolveSlot crashes | High | `slot:null` items are never re-resolved. If impossible, mark them `missing`. |
| Same exercise resolved twice in one day (e.g. two pull slots without rings) | Med | Pass `exclude` with ids already used that day |
| Unpinned fallback never "upgrades" when the user buys equipment | Low | Intended by hybrid. "Volver al plan original" re-resolves. |
| `profile.days` (2/3) ≠ `plan.days.length` (2) in weekly card/streak/`suggestThreeDays` | Med | Decide one source per function. Spec: weekly card uses plan days. |
| Deleting `weekBudget/setsPerExercise/targetSets` breaks `tests/unit.mjs:101-107` | Med | Keep the functions (unused) so current tests pass |
| e2e asserts old shape (`plan.next` `:118`, `templates.A/B` `:194-203`, v1.0 migration `:303-310`) | Med | Update to `plan.pos`/`routine.fb2`. Add a v1.14 fixture with an edited A/B. |
| Calibration centre rounding | Low | `Math.round` keeps `[8,12]` -> 12 identical. Assert with unit tests. |
| Old data.js served by SW cache | Med | Bump `CACHE` and `APP_VERSION`, and add a CHANGELOG entry |

---

## Recommendations

1. **Keep defaults equal to today**: `range = [8, 12]` and the `calibrate` target of 12 make every existing unit test pass unchanged.
2. **Put rules in `logic.js`, wiring in `app.js`**: `resolveDay` returns `{items, notices}` and the app shows the notices.
3. **Use `fb2` slots that reproduce `TEMPLATES` exactly** with default equipment, so a fresh user sees the same A/B workout. Add a unit test for this.
4. **Make the migration idempotent and lossless**: every edited A/B id stays as a pinned item. Cover it with an e2e test from a v1.14 snapshot.
5. **Order slot candidates heavy -> light -> bodyweight** so `bw: true` (future survey) still resolves.

---

## Implementation Guidance

```bash
npm ci                                   # playwright ^1.64.1 already in package.json
node tests/unit.mjs                      # pure rules
python -m http.server 8124 &  node tests/e2e.mjs   # Chromium e2e
```

Unit tests to add: `resolveSlot` (equipment, `bw`, `exclude`, null), `resolveDay` (pinned kept, pinned-impossible -> notice once, unpinned re-resolved, input not mutated), `nextDay` (wraps), `setsFor` (ramp weeks 0-1, deload, min 1), `progress`/`calibrate` with and without range.

---

## Sources & Verification

| Source | Type | Last Verified |
|---|---|---|
| `logic.js`, `data.js`, `app.js`, `tests/*.mjs` @ 6ce9382 | Primary (code) | 2026-10-26 |
| `.specs/analysis/fuente-mono-culturista.md` | Project source (77 videos) | 2026-10-26 |
| alphaprogression.com, boostcamp.app (2 pages), fitbudd.com | Community/product docs | 2026-10-26 |
| PubMed 28834797 (Schoenfeld 2017) | Primary research | 2026-10-26 |

---

## Changelog

| Date | Changes |
|---|---|
| 2026-10-26 | Initial creation for task: Implementar el motor de planes con huecos por patrón, rotación y rangos por ejercicio |
