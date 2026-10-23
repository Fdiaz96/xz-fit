# Modelo de datos

Todo el estado vive en un objeto `S` (`app.js`), guardado completo en IndexedDB (`tendon-fuerte` → store `kv` → clave `data`). La copia de seguridad es `{ app: 'tendon-fuerte', version, data: S }`.

## `S` (valores por defecto de `DEFAULT()`)

```js
{
  v: 1, onboarded: false, painMode: false, hidePainTip: false, hideInstall?: true, seenVersion: '',
  profile: { name, sex: 'h'|'m'|'x', weight, height, age, exp: 'novato'|'medio'|'avanzado', days: 2|3 },
  equip: {
    db: { min, max, step, plates?: { on, bar, items: [{ kg, n }] } } | null,   // mancuernas (null = no tiene)
    kb: [kg…],                                                                // pesas rusas
    rings, bench, bar, band: boolean,
    machines: [{ id, name, min, max, step }],                                 // impl 'm:<id>'
  },
  templates: { A: [exId…], B: [exId…] },     // rutina editable (copia de TEMPLATES)
  exlib: [{ id: 'c_…', name, kind, impl, cat, tag: [zona…], start, note }],  // ejercicios propios de entreno
  zones: { [zona]: Zone },                   // zonas con dolor
  lifts: { [exId]: { w, e1rm } | { bestReps } | { secs } },
  sessions: [Session],                       // más nueva primero
  checks: [{ date, zone, val: 'mejor'|'igual'|'peor' }],
  custom: [{ id, name, zone, sets, mode: 'reps'|'segundos', value, note }],  // ejercicios del fisio
  plan: { budget, week, next: 'A'|'B', deload?: weekKey, deloadOffer?: weekKey },
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
| `entreno` | `tpl`, `sets`, `vol`, `min`, `prs[]`, `ups[]` | `{ ex, name, maint?, capped, sets: [{ w, reps, rir, secs }] }` |
| `rehab` | `slot: 'mañana'|'noche'` | `{ ex, zone, sets: [{ w, secs, reps, done }] }` y del fisio `{ ex: 'custom:<id>', name, zone, sets }` |
| `dolor` | — | `[]` (solo registra dolor) |

Todas tienen `id`, `date` (`YYYY-MM-DD`, día local) y opcionalmente `pain: { [zona]: 0–10 }`.

`capped: true` marca series con tope por dolor o semana de descarga: no cuentan para estancamiento ni para el gráfico de peso.

## Claves de fecha

- `dayKey()` → `YYYY-MM-DD` local; `weekKey()` → lunes de esa semana. Semanas de lunes a domingo.
- `weekdayKey()` → `'lu'…'do'`, mismas claves que `rem.train`.

## Migración

No hay versiones de esquema explícitas: `withDefaults(d)` mezcla lo guardado sobre `DEFAULT()` (también un nivel adentro para `profile`, `equip`, `plan`, `rem`, `prefs`). La prueba e2e *"migra datos de la v1.0"* carga un estado sin rutina, preferencias ni equipo extra y verifica que la app funciona con los valores nuevos.
