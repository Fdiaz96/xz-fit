# Step 01: Data catalogs and range-aware progression

**Task File:** `.specs/tasks/todo/motor-de-planes.feature.md`

> The task file moves between `.specs/tasks/{draft,todo,in-progress,done}/` as work progresses; if it is not at this path, resolve it by its filename under `.specs/tasks/`.

**Phase:** Phase 1
**Model:** sonnet
**Agent:** sdd:developer
**Depends on:** None
**Parallel with:** None
**Note:** This step merges the former `01a-data-catalogs` and `01b-range-progression`. Both edit `tests/unit.mjs`, and the project rule is that steps editing the same file never run at the same time.

**Goal:** Add the static catalogs the plan engine reads to `data.js`: `SLOTS` (16 movement patterns), per-exercise rep ranges (`REP_RANGE` plus `EXERCISES[id].reps`) and `PLANS.fb2`. Also make the double progression in `logic.js` (`startWeight`, `calibrate`, `progress`) accept an optional `[lo, hi]` range. Without a range, results must be identical to today's. Unit tests prove both parts, and the v1.14 app keeps behaving exactly as before.

Read `.claude/skills/training-plan-engine/SKILL.md` first (the task requires it). The exact lists are in the task file under *Architecture Overview → Contracts → Data (`data.js`)* and *Contracts → Engine*.

**Part A: catalogs (`data.js`)**

- `SLOTS` goes after `TEMPLATES` (`data.js:370`). It holds 16 slots in this declaration order, each `{ name, ex: [ids by preference] }`:
  - `empuje_h` 'Empuje horizontal': press_banco, press_suelo, flexiones
  - `empuje_inc` 'Empuje inclinado': press_banco, flexiones
  - `empuje_v` 'Empuje vertical': press_hombros
  - `traccion_v` 'Tracción vertical': dominadas, pullover
  - `traccion_h` 'Tracción horizontal': remo_aros, remo_silla, remo_inclinado
  - `rodilla` 'Rodilla dominante': goblet, sumo_kb
  - `unilateral` 'Unilateral': zancada, bulgara
  - `bisagra` 'Bisagra': rdl, swing, pm_una_pierna
  - `gluteo` 'Glúteo': hip_thrust, puente
  - `gemelos` 'Gemelos': gemelos_1pierna
  - `lateral` 'Lateral': lateral, elev_frontal
  - `deltoides_post` 'Deltoides posterior': face_pull, rot_ext_banda
  - `biceps` 'Bíceps': curl_martillo, curl_concentrado
  - `triceps` 'Tríceps': triceps, patada_triceps, press_frances
  - `abdominal` 'Abdominal': plancha, dead_bug
  - `isometrico` 'Isométrico': remo_aros_iso, curl_iso, sentadilla_pared, iso_pared

  Declaration order matters. The engine's `slotOf(id)` (step `02-plan-engine`) returns the FIRST slot that lists an id, so `press_banco` and `flexiones` must belong to `empuje_h`.
- `REP_RANGE = { compuesto: [6, 12], aislamiento: [10, 15], deltoides: [12, 20], abdominal: [10, 15] }`. Write `EXERCISES[id].reps` with an `Object.entries({...}).forEach` block placed after the `mus` block, following the pattern at `data.js:322-326` / `:337-346`:
  - compuesto: goblet, sumo_kb, press_suelo, press_banco, flexiones, press_hombros, remo_silla, remo_aros, remo_inclinado, dominadas, rdl, swing, pm_una_pierna, zancada, bulgara, hip_thrust, puente
  - aislamiento: curl_martillo, curl_concentrado, triceps, patada_triceps, press_frances, pullover, elev_frontal, gemelos_1pierna
  - deltoides: lateral, face_pull, rot_ext_banda
  - abdominal: no exercise today
- **Exact list of slot exercises that get NO `reps` (CK-2, no other exceptions allowed):**
  - Timed or isometric kinds: `plancha` (`kind: 'tiempo'`), plus `remo_aros_iso`, `curl_iso`, `sentadilla_pared` and `iso_pared` (`kind: 'iso'`). Ranges do not apply to them (AD-7).
  - `dead_bug` (`kind: 'reps'`, no weight). The contract puts it in no `REP_RANGE` type ("abdominal: none in the library today"), so it carries no `reps` and resolves to the default `[8, 12]` through `repRange`.

  Every other exercise listed in any `SLOTS[*].ex` has kind `peso` or `reps` and MUST carry `reps` equal to its type's range.
- `PLANS = { fb2: { id: 'fb2', name: 'Full body 2 días', source, days: [...] } }`. Every slot has `sets: 3`. Slot order per day mirrors `TEMPLATES.A` and `TEMPLATES.B`. The repeated slots carry an `ex` preference (AD-2):
  - Día A: `rodilla`, `empuje_h`, `traccion_h` (ex `remo_silla`), `bisagra` (ex `rdl`), `lateral`, `abdominal`
  - Día B: `unilateral`, `empuje_v`, `traccion_h` (ex `remo_aros`), `bisagra` (ex `swing`), `biceps`, `triceps`
- Fill `PLANS.fb2.source` from `.specs/analysis/fuente-mono-culturista.md`, never with a placeholder. Use the channel URL `https://www.youtube.com/@MonoCulturista`, a short Spanish description (rangos por ejercicio, 3 series por ejercicio, cada músculo ≥ 2 veces por semana) and the cited video ids (`ioDqs84m9-Y`, `bJ2N1LdXkeo`, `xAAB_3xZ-Ho`). A string or a `{ title, url, videos }` object are both fine.
- Do not modify `TEMPLATES` (`data.js:370`) or `NO_RINGS` (`data.js:388`). The migration and the pain-mode alternatives still use them. If a listed id does not exist in `EXERCISES`, stop and report it. Never invent ids.

**Part B: range-aware progression (`logic.js`)**

Today's code: `logic.js:4` declares `REPS_MIN = 8, REPS_MAX = 12, TARGET_REPS = 10, TARGET_RIR = 2`. `startWeight` (`:79`) targets `TARGET_REPS`, `calibrate` (`:81-84`) targets `TARGET_REPS + TARGET_RIR`, and `progress` (`:86-92`) uses `REPS_MIN`/`REPS_MAX`. Callers in `app.js` (`:123`, `:415`, `:440`) pass no range. They must keep working unchanged, because they are rewired in Phase 2.
```
repRange(ex, spec) → spec?.reps ?? ex?.reps ?? [REPS_MIN, REPS_MAX]
repCenter([lo, hi]) → Math.round((lo + hi) / 2)
startWeight(profile, ex, steps, range = [REPS_MIN, REPS_MAX])   // target repCenter(range)  (10 by default)
calibrate(w, reps, rir, steps, range = [REPS_MIN, REPS_MAX])    // target repCenter(range) + TARGET_RIR
progress(w, sets, steps, [lo, hi] = [REPS_MIN, REPS_MAX])       // all done ≥ hi → stepUp; any < lo → stepDown; else w
```
- Put `repRange` and `repCenter` immediately above `startWeight`. Step 02 will not redefine them.
- Remove `TARGET_REPS` and keep `REPS_MIN`, `REPS_MAX` and `TARGET_RIR`. `app.js` does not reference `TARGET_REPS` (checked with grep).
- Reuse `roundDown`/`stepUp`/`stepDown` (`:60-62`) and `epley1RM`/`weightForReps` (`:75-76`). Keep every function pure.
- Calibration targets (CK-17): 8–12 → 12, 12–20 → 18, 10–15 → 15 (`Math.round(12.5) = 13`, plus 2), 6–12 → 11.

**Phase 1 milestone:** nothing in `app.js` reads `SLOTS`, `PLANS` or `EXERCISES[id].reps` yet, and every new parameter defaults to today's behaviour. The running app must stay identical to v1.14.

#### Expected Output

- `data.js`: `SLOTS`, `REP_RANGE` plus the assignment block, and `PLANS` with only `fb2`
- `logic.js`: `repRange`, `repCenter`, range-aware `startWeight`/`calibrate`/`progress`, `TARGET_REPS` removed
- `tests/unit.mjs`: range assertions inserted right after the existing progress tests (`tests/unit.mjs:57-65`), plus a new block `// ——— Catálogos de planes ———` inserted immediately before the final `console.log(failures ? …)` summary line

#### Success Criteria

- [X] `Object.keys(SLOTS)` equals the 16 ids in contract order. Each slot has a Spanish `name` and a non-empty `ex` array, and every id exists in `EXERCISES` (CK-1).
- [X] CK-2: `EXERCISES.lateral.reps` and `EXERCISES.face_pull.reps` are `[12, 20]`, `EXERCISES.goblet.reps` is `[6, 12]` and `EXERCISES.curl_martillo.reps` is `[10, 15]`.
- [X] CK-2: the set of exercises appearing in any `SLOTS[*].ex` that have no `reps` is exactly `{plancha, remo_aros_iso, curl_iso, sentadilla_pared, iso_pared, dead_bug}` (set equality). Every other slot exercise's `reps` equals `REP_RANGE[type]` for its contract type.
- [X] CK-2: `repRange(EXERCISES.dead_bug)` and `repRange({})` (a custom exercise with no data) both return `[8, 12]`.
- [X] CK-3: `Object.keys(PLANS)` is `['fb2']`, the name is `'Full body 2 días'`, there are 2 days named `Día A` and `Día B`, every slot has `sets: 3`, and `source` is non-empty. Slot order and `ex` preferences match the lists above.
- [X] `TEMPLATES` and `NO_RINGS` are byte-identical to before.
- [X] `grep -n TARGET_REPS logic.js app.js` returns nothing.
- [X] CK-16: `progress(w, sets, steps, [12, 20])` steps up on 20/20/20, keeps the weight on 20/20/19 and on 12/12/12, steps down on 15/11, and keeps it when no set has reps.
- [X] CK-17: `calibrate(…, [12, 20]).w === roundDown(steps, weightForReps(e1rm, 18))`. `[10, 15]` targets 15 reps, and `[8, 12]` equals the no-range result.
- [X] `repCenter([10, 15]) === 13`, `repRange({ reps: [12, 20] })` returns `[12, 20]` and `repRange({}, { reps: [6, 8] })` returns `[6, 8]`.
- [X] `startWeight` with `[12, 20]` is ≤ `startWeight` with `[8, 12]`. With `[8, 12]` it equals the no-range result.
- [X] CK-18 / CK-33: every pre-existing assertion in `tests/unit.mjs` passes unmodified, and `node tests/unit.mjs` exits 0.
- [X] CK-34 regression: with `python -m http.server 8124` running, `node tests/e2e.mjs` still exits 0, so the app is unchanged.

#### Subtasks

- [X] Add `SLOTS` to `data.js` after `TEMPLATES`, in contract order, with Spanish names
- [X] Add `REP_RANGE` and the `Object.entries(...).forEach` block that writes `EXERCISES[id].reps` to `data.js`, after the `mus` block, skipping the six listed exceptions
- [X] Add `PLANS = { fb2 }` to `data.js` with the AD-2 `ex` preferences and a `source` taken from `.specs/analysis/fuente-mono-culturista.md`
- [X] Add `repRange` and `repCenter` above `startWeight` in `logic.js`; add the optional range to `startWeight`, `calibrate` and `progress`; remove `TARGET_REPS` from `logic.js:4`
- [X] Write unit tests in `tests/unit.mjs` after line ~65: CK-16 boundary cases (max, max−1, min, min−1, empty), CK-17 per range, CK-18 equality without a range, `repRange` fallbacks, `repCenter`, and the `startWeight` comparison
- [X] Write unit tests in the `tests/unit.mjs` block `// ——— Catálogos de planes ———` (helpers `L`/`eq`/`ok` from `tests/unit.mjs:6-9`): CK-1, CK-2 (including the exact no-`reps` set), CK-3
- [X] Run `node tests/unit.mjs` until it exits 0, then run `node tests/e2e.mjs` against `python -m http.server 8124` to confirm the app did not change

#### Blockers & Risks

| Type | Item | Impact | Likelihood | Mitigation / Resolution |
|------|------|--------|------------|-------------------------|
| Blocker | An id from the contract lists does not exist in `EXERCISES` | Med | Low | Grep `data.js` for each id first; report a mismatch rather than inventing ids |
| Risk | Slot order differs from `TEMPLATES`, so CK-4 fails in step 02 | High | Low | Read `TEMPLATES.A/B` and assert the mirrored order in the CK-3 test |
| Risk | `reps` added to a timed/iso exercise, or missing on a `peso`/`reps` one | Med | Low | The set-equality assertion on the exact six-id exception list catches both |
| Risk | The default path drifts (for example `Math.round` vs floor) and breaks existing tests | High | Low | `[8, 12]` must give center 10 and calibrate target 12; run the untouched existing assertions |
| Risk | Empty `sets` edge case in `progress` | Low | Low | Keep today's `done = sets.filter(s => s.reps > 0)` guard; test the empty case |
