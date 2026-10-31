# Modelo de datos

Todo el estado vive en un objeto `S` (`app.js`), guardado completo en IndexedDB (`tendon-fuerte` → store `kv` → clave `data`). La copia de seguridad es `{ app: 'tendon-fuerte', version, data: S }`.

## `S` (valores por defecto de `DEFAULT()`)

```js
{
  v: 1, onboarded: false, painMode: false, hidePainTip: false, hideInstall?: true, seenVersion: '',
  profile: { name, sex: 'h'|'m'|'x', weight, height, age, exp: 'novato'|'medio'|'avanzado', days: 2|3, conds: [conditionId…] },   // conds: CONDITIONS de data.js (v1.32)
  equip: {
    db: { min, max, step, plates?: { on, bar, items: [{ kg, n }] } } | null,   // mancuernas (null = no tiene)
    kb: [kg…],                                                                // pesas rusas
    rings, bench, bar, band: boolean,
    machines: [{ id, name, min, max, step }],                                 // impl 'm:<id>'
  },
  routine: { [planId]: Item[][] },           // rutina editable por plan y por día; Item = { slot: slotId|null, ex: exId, pinned: boolean }
  exlib: [{ id: 'c_…', name, kind, impl, cat, tag: [zona…], start, note }],  // ejercicios propios de entreno
  zones: { [zona]: Zone },                   // zonas con dolor
  lifts: { [exId]: { w, e1rm } | { bestReps } | { secs } },
  sessions: [Session],                       // más nueva primero
  checks: [{ date, zone, val: 'mejor'|'igual'|'peor' }],
  custom: [{ id, name, zone, sets, mode: 'reps'|'segundos', value, note }],  // ejercicios del fisio
  plan: { id: 'fb2', pos: 0, since: '' | 'YYYY-MM-DD', bw: false, deload: '' | weekKey, deloadOffer: '' | weekKey },
  rem: { am: 'HH:MM', pm: 'HH:MM', train: ['lu', …], trainAt: 'HH:MM' },
  prefs: { sound, voice, rest: 60|90|120|180, auto, theme: 'dark'|'light'|'system' },
}
```

## `Zone`

```js
{ side: 'der'|'izq'|'ambos', pain0: 0–10, phase: 1|2|3, since: 'YYYY-MM-DD',
  load: kg, secs: 20–60, choice?: { 1: exId, 2: exId }, adjustedOn?: 'YYYY-MM-DD' }
```

`adjustedOn` marca que la carga ya bajó el mismo día por dolor > 4, para no bajarla dos veces al responder "¿cómo amaneció?".

## `Session`

| `type` | Campos propios | `items[]` |
|---|---|---|
| `entreno` | `plan`, `day`, `tpl`, `sets`, `vol`, `min`, `prs[]`, `ups[]` | `{ ex, name, maint?, capped, reps?: [mín, máx], sets: [{ w, reps, rir, secs }] }` |
| `rehab` | `slot: 'mañana'|'noche'` | `{ ex, zone, sets: [{ w, secs, reps, done }] }` y del fisio `{ ex: 'custom:<id>', name, zone, sets }` |
| `dolor` | — | `[]` (solo registra dolor) |

Todas tienen `id`, `date` (`YYYY-MM-DD`, día local) y opcionalmente `pain: { [zona]: 0–10 }`.

`capped: true` marca series con tope por dolor o semana de descarga: no cuentan para estancamiento ni para el gráfico de peso.

`plan` es el id del plan (`'fb2'`) y `day` el índice del día hecho (0 = Día A). `tpl` ('A', 'B') se sigue guardando para que el historial lea igual las sesiones viejas, que solo tienen `tpl`. `reps` es el rango del ejercicio con peso o repeticiones cuando se entrenó: el resumen lo usa para decir "cuando hagas N en todas, sube".

## Plan y rutina

- `plan.id`: plan activo (hoy solo `fb2`, *Full body 2 días*); un id inexistente se trata como `fb2`.
- `plan.pos`: índice del día que toca. Al terminar un entreno pasa a ser el siguiente al día recién hecho (rotación por secuencia).
- `plan.since`: fecha de inicio del plan. Define la rampa de entrada; vacío se completa con la fecha del día.
- `plan.bw`: resolver los huecos solo con ejercicios de peso corporal.
- `routine[planId][día]`: lista de ítems ya resueltos. `slot` es el patrón de movimiento (`null` en ejercicios propios o agregados sin hueco). `pinned: true` marca lo que el usuario eligió a mano. Un ejercicio que deja de ser posible por el equipo se re-resuelve y queda sin fijar.
- Campos que ya no existen: `templates`, `plan.budget`, `plan.week` y `plan.next`. Solo aparecen en datos viejos, que la migración convierte.

## Claves de fecha

- `dayKey()` → `YYYY-MM-DD` local; `weekKey()` → lunes de esa semana. Semanas de lunes a domingo.
- `weekdayKey()` → `'lu'…'do'`, mismas claves que `rem.train`.

## Migración

Los datos anteriores a los planes (v1.0 a v1.14) se migran en `withDefaults(d)` solo si no tienen `routine`, así que cargar o importar dos veces da el mismo resultado:

- `templates.A/B` pasan tal cual a `routine.fb2` (mismos ejercicios, mismo orden) con `pinned: true`. Sin aros, el remo en aros se guarda como remo en silla, que es lo que la v1.14 ya mostraba.
- `plan.next` 'A' / 'B' pasa a `plan.pos` 0 / 1. `budget`, `week` y `next` se quitan.
- `plan.since` es la fecha del primer entreno guardado; sin entrenos queda vacío y se completa con la fecha del día.
- `lifts` y `sessions` no se tocan.

Fuera de ese caso, no hay versiones de esquema explícitas: `withDefaults(d)` mezcla lo guardado sobre `DEFAULT()` (también un nivel adentro para `profile`, `equip`, `plan`, `rem`, `prefs`). La prueba e2e *"migra datos de la v1.0"* carga un estado sin rutina, preferencias ni equipo extra y verifica que la app funciona con los valores nuevos.
