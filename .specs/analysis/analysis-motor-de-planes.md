---
title: Codebase Impact Analysis - Implementar el motor de planes con huecos por patrón, rotación y rangos por ejercicio
task_file: .specs/tasks/draft/motor-de-planes.feature.md
scratchpad: .specs/scratchpad/42018072.md
created: 2026-10-26
status: complete
---

# Codebase Impact Analysis: Motor de planes

## Summary
- Files to modify: 6 code/config plus 5 docs. Files to create: 0. Files to delete: 0. Test files affected: 2.
- Risk level: High. Saved user data has to be migrated, and the core workout loop is rewritten.

## Files to be Modified
```
TendonApp/
├── data.js      # UPDATE: SLOTS, PLANS (fb2), reps:[min,max] per exercise; keep TEMPLATES (migration source) and NO_RINGS (or fold it into SLOTS order)
├── logic.js     # UPDATE: resolveSlot, resolveDay, nextDay, setsFor; optional range on progress/calibrate; weekStats target from plan
├── app.js       # UPDATE: DEFAULT/withDefaults (routine + migration), planFor per day, home/train/workout/summary/history/picker, actions
├── sw.js        # UPDATE: CACHE bump (L2 'tendon-v1-14-1')
└── tests/unit.mjs, tests/e2e.mjs  # UPDATE
Docs: CHANGELOG.md (new version entry), README.md L21 ("A/B … 8–12, volumen +30 %"), .specs/analysis/{modelo-de-datos,reglas-de-negocio,arquitectura}.md
Also bump APP_VERSION (app.js:5), per the .specs/README.md convention.
```

## Current flow (to replace)
1. Boot app.js:1090 → withDefaults (app.js:43). It merges `plan` one level deep and sets `templates: d.templates || base.templates`.
2. renderHome app.js:203: `next = S.plan.next`, then `planFor(next)`.
3. planFor(tpl), app.js:108-132:
   - syncBudget (app.js:106) → weekBudget.
   - ids come from S.templates[tpl], filtered by resolveEx (app.js:104, applies NO_RINGS when there are no rings).
   - setsPerExercise sets the count per exercise.
   - Per item: restriction → alt, implFor, weightSteps, deload (−1 set, minimum 1, 90 % weight), calib/base/w/capped/stalled.
4. startWorkout app.js:369 sets `W = {tpl, items}`.
5. setDone calls calibrate at app.js:415.
6. finishWorkout calls progress at app.js:440, saves `session {tpl}` at app.js:450, and toggles `S.plan.next` at app.js:453.
7. showSummary app.js:464-473 shows "Entreno X hecho", "cuando hagas 12 reps…" and "Próximo: entreno X".

New flow: `PLANS[S.plan.id || 'fb2']` → `S.routine[id][pos]` items `{slot, ex, pinned}` → resolveDay → the same per-item enrichment, with `sets = setsFor(slot.sets, weeksSince(plan.since), deload)` and `ex.reps` → on finish, `pos = nextDay(plan, pos)`.

## Functions to modify
| Location | Name | Change |
|---|---|---|
| logic.js:81 | calibrate(w,reps,rir,steps) | Optional [min,max]. Target = range center + RIR 2. The default [8,12] gives center 10, so the result is identical (unit L57-59). |
| logic.js:86 | progress(w,sets,steps) | Optional 4th arg [min,max], defaulting to [REPS_MIN, REPS_MAX] from logic.js:4 (unit L63-65 must still pass). |
| logic.js:200 | weekStats | target = number of days in the current plan. Fall back to profile.days, because unit L127 passes a state with no plan. |
| logic.js:207 | streak | Uses profile.days. Decide whether to switch it to plan days; the spec only names the weekly card. |
| logic.js:146-159 | targetSets/weekBudget/setsPerExercise | Stop calling them. They can stay so unit L100-107 still pass. |
| app.js:19 | DEFAULT | Add `routine:{fb2:…}` and `plan:{id:'fb2',pos:0,since:'',bw:false}`. Remove budget/week/next and templates. |
| app.js:43 | withDefaults | Migration: templates.A/B → routine.fb2 with pinned:true; next 'A'/'B' → pos 0/1; drop budget/week/next; unknown plan.id → fb2. importData (app.js:936) goes through the same path. |
| app.js:104 | resolveEx | Slot order replaces the NO_RINGS swap (remo_aros → remo_silla). |
| app.js:105-106 | perDay, syncBudget | Remove. Call sites: app.js:109, 243, 322, 878 (setPath profile.days), 916 (onboarding finish → set plan.since = today()), 1000 (three-days), 1030 (routine-reset). |
| app.js:108 | planFor(tpl) | Becomes planFor(dayIndex) over the routine. Run resolveDay first. Sets come from setsFor. Each item carries its reps range. A slot with no possible exercise gives a "Falta equipo" item. |
| app.js:348 | setLabel | Replace the hardcoded '8–12 reps' with ex.reps. |
| app.js:369/403 | startWorkout/renderWorkout | `W.tpl` → day plus plan; header shows the day name. |
| app.js:415, 440, 450, 453 | setDone/finishWorkout | Pass the range to calibrate and progress. Session saves {plan, day, tpl}. `S.plan.pos = nextDay(...)`. |
| app.js:464-471 | showSummary | Real top of the range; next day name. |
| app.js:206-212 | renderHome | Card shows "<día> · N ejercicios". The `stuck` list iterates the routine instead of TEMPLATES + templates. |
| app.js:219-240 | renderTrain | One tab per plan day instead of the ['A','B'] loop and the "A/B 8–12" header. |
| app.js:242-274 | tplIds/routineSet/openPicker/pickExercise | Work on day items. In the picker, exercises from the same slot come first (replaces the CATS sort at app.js:255). The chosen item is saved with pinned:true. Items added with "+ Agregar" get slot:null. |
| app.js:317-323 | deleteExForm | Filter every routine[*][*] instead of templates A/B. |
| app.js:728 | renderHistory | "Entreno ${s.tpl}" → day name from s.plan/s.day, falling back to tpl. |
| app.js:951, 1027-1030 | actions | `d.tpl` → day index. routine-reset re-resolves the slots (pinned:false). |
| app.js:1063 | bench toast | Checks `S.templates.A.includes('press_suelo')`; switch to the routine. |

## New functions (logic.js, pure)
- resolveSlot(slot, equip, {bw, exclude}): returns the first id in SLOTS[slot] that implFor (logic.js:49) accepts. With bw, only impl 'bw' counts. Returns null if none.
- resolveDay(items, equip, opts): re-resolves only unpinned items that are no longer possible. A pinned item that became impossible is flagged once and then re-resolved.
- nextDay(plan, pos): (pos+1) % days.length.
- setsFor(sets, weeks, deload): −1 set in weeks 0–1, −1 on deload, minimum 1.

## Types
- EXERCISES (data.js:37+): add `reps`. Compound 6–12, isolation 10–15, lateral/rear delt 12–20, weighted abs 10–15, default [8,12].
- SLOTS and PLANS are new. PLANS.fb2 = the slots of TEMPLATES.A/B (data.js:370-373).
  - A: goblet → rodilla dominante; press_suelo → empuje horizontal; remo_silla → tracción horizontal; rdl → bisagra; lateral → lateral; plancha → abdominal.
  - B: zancada → unilateral; press_hombros → empuje vertical; remo_aros → tracción horizontal; swing → bisagra; curl_martillo → bíceps; triceps → tríceps.
- Candidate exercises per slot from the current library (cat/mus):

  | Slot | Exercises |
  |---|---|
  | Empuje horizontal | press_banco (needs bench), press_suelo, flexiones |
  | Empuje inclinado | none in the library (gap) |
  | Empuje vertical | press_hombros |
  | Tracción vertical | dominadas, pullover (bench) |
  | Tracción horizontal | remo_aros, remo_silla, remo_inclinado |
  | Rodilla dominante | goblet, sumo_kb |
  | Unilateral | zancada, bulgara |
  | Bisagra | rdl, swing, pm_una_pierna |
  | Glúteo | hip_thrust, puente |
  | Gemelos | gemelos_1pierna |
  | Lateral | lateral, elev_frontal |
  | Deltoides posterior | face_pull, rot_ext_banda |
  | Bíceps | curl_martillo, curl_concentrado |
  | Tríceps | triceps, patada_triceps, press_frances |
  | Abdominal | plancha, dead_bug |
  | Isométrico | remo_aros_iso, curl_iso, sentadilla_pared, iso_pared |

- Session (app.js:450): add plan and day; keep tpl.

## Integration points
| File | Impact | Action |
|---|---|---|
| logic.js:49 implFor | High | Use it as the "possible" test. |
| logic.js:108 restriction | Medium | No change; apply it to the resolved exercise (pain mode is out of scope). |
| logic.js:183 stalled | Low | No change. |
| app.js:96 getEx (custom c_… ids) | High | logic.js cannot see S.exlib, and unit.mjs:5 loads only data/logic/figures. resolveDay needs ex objects or a lookup passed in. |
| app.js:936 importData and app.js:1090 boot (both call withDefaults) | High | Migration path. |
| app.js:734 reportHTML | Low | Does not use tpl; no change. |

## Similar implementations
- REHAB_OPTIONS (data.js:312-319) with rehabOptions filtered by implFor (app.js:145-149) and Zone.choice: an ordered option list, filtered by equipment, with the user's choice saved. Same shape as a slot plus pinned.
- NO_RINGS (data.js:388, app.js:104): the only equipment-driven substitution today. The SLOTS order has to reproduce it.
- The CATS picker sort (app.js:255-258, "· mismo grupo"): reuse it for "mismo hueco".

## Reusable code
implFor (logic.js:49); roundDown/stepUp/stepDown (logic.js:60-62); epley1RM/weightForReps (logic.js:75-76); weekKey/daysBetween (logic.js:15-16); the planFor enrichment body (app.js:112-131); withDefaults (app.js:43); TEMPLATES (data.js:370) as the migration source and as the fb2 equivalence check.

## Tests
Existing tests to update:
- unit.mjs:57-65 (calibrate/progress): must pass unchanged.
- unit.mjs:100-107 (weekBudget/setsPerExercise): keep the functions or remove these tests on purpose.
- unit.mjs:127 (weekStats): the state has no plan, so the fallback must give 2.
- unit.mjs:181 (TEMPLATES ids exist): keep, and add the same check for SLOTS/PLANS.
- e2e.mjs:118 `plan.next==='B'` → `plan.pos===1`.
- e2e.mjs:188, 195, 202, 215 use `data-tpl="A"/"B"` selectors.
- e2e.mjs:194, 201, 203 read `templates.A/B` → `routine.fb2[d][i].ex`, which should also be pinned.
- e2e.mjs:299-313 (v1.0 migration): L310 `templates.A.length===6` and L313 `.ex>=12` → check routine.fb2 lengths and pos===1.

New tests:
- Unit: resolveSlot (equip, bw, exclude, none → null); resolveDay (pinned kept, pinned-impossible flagged and re-resolved, unpinned re-resolved); nextDay wrap; setsFor (ramp, deload, minimum 1); progress/calibrate with [12,20].
- E2E: migration from a v1.14 state with an edited templates (press_banco) → routine.fb2 intact and pinned; full workout with rotation 0→1→0; summary text shows the range.

## Risks
1. **The same slot appears twice in fb2.** tracción horizontal is remo_silla on A and remo_aros on B; bisagra is rdl on A and swing on B. "First possible" would put the same exercise on both days, so a fresh fb2 would not match TEMPLATES. It needs a per-plan-slot preference ({slot, sets, ex}) or an `exclude` of ids already used in the plan. Add a unit test that fresh fb2 with rings equals TEMPLATES.
2. **Migrated pinned remo_aros without rings.** Today NO_RINGS swaps it silently. The new "pinned impossible → warn once" rule needs a saved flag. The current e2e v1.0 state has rings:false.
3. **Entry ramp for existing users.** An empty `since` would give veterans −1 set for 2 weeks. Migrate since to the oldest entreno date, or a date in the past.
4. **Custom exercises.** c_ ids are not in SLOTS, and logic.js cannot read exlib. Use slot:null and pinned, and resolve them on the app side.
5. **Empuje inclinado.** No inclined exercise exists in the library.
6. **Sets.** fb2 at 3 sets matches today's budget (36 / 2 days / 6 exercises = 3) once the ramp ends. e2e L113 (2 done sets) is unaffected.
7. **Data loss.** All data is one IndexedDB record. The migration must be idempotent and run through both boot and import.

## Recommended reading
1. app.js:19-43 (DEFAULT, withDefaults)
2. app.js:104-132 (planFor)
3. app.js:369-473 (session, calibrate/progress, rotation, summary)
4. app.js:219-274 (editor and picker)
5. logic.js:49-92, 146-159, 200-214
6. data.js:321-388
7. tests/e2e.mjs:83-118, 177-218, 299-313

## Verification Summary
- All affected files identified: ✅
- Integration points mapped: ✅ (8 syncBudget sites, 4 TEMPLATES uses, both withDefaults callers)
- Similar patterns found: ✅ (3)
- Reusable code identified: ✅ (7 elements)
- Test coverage analyzed: ✅
- Risks assessed: ✅ (7)

Caveats: line numbers are as of commit 6ce9382 (v1.14.1). The slot candidate lists are inferred from cat/mus and need product review.
