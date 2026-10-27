# Reglas de negocio (logic.js)

Referencia rápida de las reglas que implementa `logic.js`. Todas son funciones puras y tienen pruebas en `tests/unit.mjs`.

## Constantes

| Constante | Valor | Significado |
|---|---|---|
| `REPS_MIN`, `REPS_MAX` | 8, 12 | Rango por defecto de la doble progresión (ejercicio sin rango propio) |
| `TARGET_RIR` | 2 | Calibración: centro del rango dejando 2 repeticiones en reserva |
| `DEFAULT_SETS` | 3 | Series de un ítem sin hueco en el día del plan |
| `START_FACTOR` | 0,7 | Primer peso sugerido = 70 % del estimado |
| `PAIN_CAP` | 0,6 | Tope del 60 % para ejercicios que exigen una zona en fase 1–2 |
| `PAIN_MAX` | 4 | Dolor tolerable hasta 4/10 |
| `VOLUME_STEP` | 1,3 | Solo lo usa el presupuesto semanal, que el entreno ya no usa |
| `ISO_SETS`, `ISO_SECS` | 3, 45 | Isométricos: 3 × 45 s |
| `LENTO_SETS`, `LENTO_REPS` | 3, 15 | Isotónicos lentos: 3 × 15 a 3 s / 3 s |

## Equipo

- `weightSteps(equip, impl)`: pesos posibles. Mancuernas por rango (`min..max` de a `step`) o por discos (`plateCombos`); pesas rusas, la lista; máquinas `m:<id>`, su rango.
- `plateCombos({ bar, items })`: de cada disco se usan múltiplos de 4 (igual de cada lado y en las dos mancuernas). Devuelve peso → discos por lado, con la combinación de menos discos.
- `implFor(ex, equip)`: con qué se hace el ejercicio o `null`. `needs` (banco, …), `alsoRings` (dominadas en aros), `alsoDb` (pesa rusa → mancuerna).
- Redondeo siempre **hacia abajo** (`roundDown`); `stepUp`/`stepDown` mueven un salto.

## Fuerza y calibración

- 1RM estimado = peso corporal × `ex.ratio` × factor (sexo: mujer 0,55 tren superior / 0,7 inferior, "prefiero no decir" el promedio; experiencia 1 / 1,5 / 2; edad <40 1, <50 0,92, <60 0,82, resto 0,7).
- Primer peso = `roundDown(0,7 × 1RM / (1 + c/30))`, con `c` = centro del rango del ejercicio (`repCenter`): 10 con 8–12 (igual que antes), 13 con 10–15, 16 con 12–20. Sin RIR: el 70 % ya deja margen.
- Calibración: Epley con reps + RIR → 1RM → peso para el centro del rango redondeado más 2 RIR (8–12 → 12, 6–12 → 11, 10–15 → 15, 12–20 → 18).

## Planes y rotación

- Un plan (`PLANS`) es una lista de días; cada día, una lista de huecos `{ slot, sets }` (patrones de movimiento de `SLOTS`). Hoy existe `fb2`, *Full body 2 días*: Día A y Día B, 3 series por hueco. Un hueco puede declarar un ejercicio preferido (`ex`) para no repetir el mismo en los dos días.
- `resolveSlot(slot, equip, { bw, exclude, pref })`: primer ejercicio del hueco que el equipo permite (`implFor`); `null` si ninguno. Con `bw`, solo peso corporal; `exclude` saltea ids.
- `resolveDay(items, equip, opts)`: re-resolución mínima. Un ítem que sigue siendo posible no cambia, aunque un ejercicio más preferido se haya vuelto posible. Uno imposible con hueco pasa al primer posible de su hueco que no esté ya en el día. Uno sin hueco (ejercicio propio) no se re-resuelve. Si el hueco no tiene ejercicio posible, el ítem se muestra como "Falta equipo" y el entreno arranca con el resto.
- Fijados: un ítem fijado que dejó de ser posible se reemplaza y se avisa. Como lo reemplazado queda sin fijar, el aviso sale una sola vez. Elegir un ejercicio en el selector o agregarlo lo fija. "Volver al plan original" re-resuelve todo el plan sin fijados.
- `nextDay(plan, pos)`: rotación por secuencia. El próximo día es el siguiente al último hecho, sin importar el día de la semana ni los días sin entrenar; después del último vuelve al primero y una posición fuera de rango da 0. Al terminar un entreno se usa el día hecho, no el propuesto.
- `setsFor(sets, semanas, deload)`: series del hueco − 1 mientras pasaron menos de 2 semanas completas desde `plan.since` (días 0 a 13), − 1 en semana de descarga, mínimo 1. Las dos reglas se suman.
- Objetivo semanal: la tarjeta de la semana compara los entrenos con la cantidad de días del plan activo (2 en `fb2`). La racha y "¿Pasamos a 3 días?" siguen usando los días del perfil.
- Migración de datos anteriores: ver [modelo de datos](modelo-de-datos.md#migración).

## Rangos y progresión

- Cada ejercicio con peso o repeticiones declara su rango `[mín, máx]` según su tipo: compuesto 6–12, aislamiento 10–15, elevación lateral y deltoides posterior 12–20, abdominal con peso 10–15. Sin dato (por ejemplo, un ejercicio propio) vale 8–12. Los de tiempo no tienen rango.
- Doble progresión: el máximo del rango en **todas** las series → sube un salto; **alguna** por debajo del mínimo → baja un salto; si no, igual. Sin progresión con tope de dolor, recién calibrado o en descarga.
- El entreno y el resumen muestran el rango real ("3 × 12–20", "cuando hagas 20 en todas, sube").
- `weekBudget`, `setsPerExercise` y `targetSets` (presupuesto semanal con +30 %) siguen en `logic.js` con sus pruebas, pero el entreno ya no los usa.
- Sugerir 3 días: con 2 días, ≥ 4 entrenos en 14 días y (con modo dolor) todo el dolor ≤ 3.

## Modo dolor

- `restriction`: solo con modo dolor; zonas activas en fase < 3 que el ejercicio exige (`tag`). Si alguna está "en brote" (dolor > 4 en los últimos 3 días o amaneció peor) y hay `alt`, cambia por la variante amable; si no, tope del 60 %.
- `isoAdjust`: dolor ≤ 2 y no peor → sube; dolor > 4 o peor → baja. Sin peso juega con el tiempo (+5 s hasta 60, −10 s hasta 20); a los 60 s sin peso agrega la mancuerna más liviana.
- `phaseReady`: ≥ 10 días en la fase, ≥ 5 registros (fase 1) o ≥ 3 (fase 2) en 7 días, todos ≤ 3 y ningún "peor".
- `pendingChecks`: zonas con dolor registrado ayer y sin respuesta hoy.

## Otras

- `warmupSets`: 8 reps al 50 % y 4 al 75 % del primer ejercicio con peso, sin repetir ni igualar el peso de trabajo.
- `stalled`: últimas 3 sesiones sin tope con el mismo peso máximo y sin más repeticiones totales.
- `weekStats`: entrenos vs. días del plan; rehab objetivo 14 (fase 1) o 4 (fase 2). `streak`: semanas seguidas cumpliendo los días.
- `sessionSummary`: series, volumen (kg × reps) y minutos (mínimo 1).
- `icsText`: VCALENDAR con CRLF; isométricos diarios mañana/noche (con modo dolor) y entreno semanal por `BYDAY`.
