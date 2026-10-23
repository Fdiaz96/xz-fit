# Reglas de negocio (logic.js)

Referencia rápida de las reglas que implementa `logic.js`. Todas son funciones puras y tienen pruebas en `tests/unit.mjs`.

## Constantes

| Constante | Valor | Significado |
|---|---|---|
| `REPS_MIN`, `REPS_MAX` | 8, 12 | Rango de la doble progresión |
| `TARGET_REPS`, `TARGET_RIR` | 10, 2 | Objetivo de calibración: 10 reps dejando 2 en reserva |
| `START_FACTOR` | 0,7 | Primer peso sugerido = 70 % del estimado |
| `PAIN_CAP` | 0,6 | Tope del 60 % para ejercicios que exigen una zona en fase 1–2 |
| `PAIN_MAX` | 4 | Dolor tolerable hasta 4/10 |
| `VOLUME_STEP` | 1,3 | Las series semanales suben como mucho 30 % |
| `ISO_SETS`, `ISO_SECS` | 3, 45 | Isométricos: 3 × 45 s |
| `LENTO_SETS`, `LENTO_REPS` | 3, 15 | Isotónicos lentos: 3 × 15 a 3 s / 3 s |

## Equipo

- `weightSteps(equip, impl)`: pesos posibles. Mancuernas por rango (`min..max` de a `step`) o por discos (`plateCombos`); pesas rusas, la lista; máquinas `m:<id>`, su rango.
- `plateCombos({ bar, items })`: de cada disco se usan múltiplos de 4 (igual de cada lado y en las dos mancuernas). Devuelve peso → discos por lado, con la combinación de menos discos.
- `implFor(ex, equip)`: con qué se hace el ejercicio o `null`. `needs` (banco, …), `alsoRings` (dominadas en aros), `alsoDb` (pesa rusa → mancuerna).
- Redondeo siempre **hacia abajo** (`roundDown`); `stepUp`/`stepDown` mueven un salto.

## Fuerza y calibración

- 1RM estimado = peso corporal × `ex.ratio` × factor (sexo: mujer 0,55 tren superior / 0,7 inferior, "prefiero no decir" el promedio; experiencia 1 / 1,5 / 2; edad <40 1, <50 0,92, <60 0,82, resto 0,7).
- Primer peso = `roundDown(0,7 × 1RM / (1 + 10/30))`.
- Calibración: Epley con reps + RIR → 1RM → peso para 12 reps (10 + 2 RIR).

## Progresión y volumen

- Doble progresión: 12 reps en **todas** las series → sube un salto; **alguna** < 8 → baja un salto; si no, igual. Sin progresión con tope de dolor, recién calibrado o en descarga.
- Objetivo semanal = días × ejercicios por día × 3. Presupuesto: sube como mucho ×1,3 por semana; dentro de la misma semana nunca sube.
- Series por ejercicio: entre 2 y 4; las sobrantes van a los primeros (compuestos).
- Sugerir 3 días: con 2 días, ≥ 4 entrenos en 14 días y (con modo dolor) todo el dolor ≤ 3.

## Modo dolor

- `restriction`: solo con modo dolor; zonas activas en fase < 3 que el ejercicio exige (`tag`). Si alguna está "en brote" (dolor > 4 en los últimos 3 días o amaneció peor) y hay `alt`, cambia por la variante amable; si no, tope del 60 %.
- `isoAdjust`: dolor ≤ 2 y no peor → sube; dolor > 4 o peor → baja. Sin peso juega con el tiempo (+5 s hasta 60, −10 s hasta 20); a los 60 s sin peso agrega la mancuerna más liviana.
- `phaseReady`: ≥ 10 días en la fase, ≥ 5 registros (fase 1) o ≥ 3 (fase 2) en 7 días, todos ≤ 3 y ningún "peor".
- `pendingChecks`: zonas con dolor registrado ayer y sin respuesta hoy.

## Otras

- `warmupSets`: 8 reps al 50 % y 4 al 75 % del primer ejercicio con peso, sin repetir ni igualar el peso de trabajo.
- `stalled`: últimas 3 sesiones sin tope con el mismo peso máximo y sin más repeticiones totales.
- `weekStats`: entrenos vs. días; rehab objetivo 14 (fase 1) o 4 (fase 2). `streak`: semanas seguidas cumpliendo los días.
- `sessionSummary`: series, volumen (kg × reps) y minutos (mínimo 1).
- `icsText`: VCALENDAR con CRLF; isométricos diarios mañana/noche (con modo dolor) y entreno semanal por `BYDAY`.
