// Reglas de XZ Fit, sin DOM: pesos sugeridos, calibración, progresión, modo dolor, volumen y calendario.
// Funciones puras para poder probarlas con node (tests/unit.mjs).

const REPS_MIN = 8, REPS_MAX = 12, TARGET_RIR = 2;
const START_FACTOR = 0.7;   // la primera vez se sugiere el 70 % del peso estimado: mejor quedarse corto
const PAIN_CAP = 0.6;       // con la zona en fase 1–2, los ejercicios que la exigen van al 60 %
const PAIN_MAX = 4;         // regla del video: dolor tolerable hasta 3–4 sobre 10
const VOLUME_STEP = 1.3;    // nunca más de +30 % de series de una semana a otra
const ISO_SETS = 3, ISO_SECS = 45, LENTO_SETS = 3, LENTO_REPS = 15;
const PHASE_DAYS = 10;      // días mínimos en una fase antes de avanzar

// ——— Fechas (día local) ———
const dayKey = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const weekKey = (k) => { const d = parseDay(k); return addDays(k, -((d.getDay() + 6) % 7)); };   // lunes de esa semana

// ——— Equipo ———
// Pesos disponibles para un implemento. db: { min, max, step } (por mancuerna); kb: lista de pesas rusas.
// Mancuernas de discos: db.plates = { bar, items: [{ kg, n }] } (n = discos de ese peso en total, para el par).
// Cada mancuerna lleva lo mismo de cada lado, así que de cada disco se usan múltiplos de 4. Devuelve peso → discos por lado.
function plateCombos(pl) {
  const types = (pl.items || []).filter((x) => x.kg > 0 && x.n >= 4).map((x) => ({ kg: x.kg, max: Math.floor(x.n / 4) })).sort((a, b) => b.kg - a.kg);
  const out = new Map();
  const walk = (i, side) => {
    if (i === types.length) {
      const w = Math.round((pl.bar + 2 * side.reduce((a, b) => a + b, 0)) * 100) / 100;
      if (!out.has(w) || out.get(w).length > side.length) out.set(w, side);
      return;
    }
    for (let k = 0; k <= types[i].max; k++) walk(i + 1, [...side, ...Array(k).fill(types[i].kg)]);
  };
  walk(0, []);
  return out;
}
const platesFor = (equip, w) => (equip.db?.plates?.on ? plateCombos(equip.db.plates).get(w) || null : null);

// Máquinas propias: impl 'm:<id>' con su propio { min, max, step }.
function weightSteps(equip, impl) {
  if (impl === 'kb') return [...(equip.kb || [])].sort((a, b) => a - b);
  if (impl === 'db' && equip.db?.plates?.on) return [...plateCombos(equip.db.plates).keys()].sort((a, b) => a - b);
  const range = impl === 'db' ? equip.db : impl?.startsWith?.('m:') ? (equip.machines || []).find((m) => 'm:' + m.id === impl) : null;
  if (!range || !(range.step > 0)) return [];
  const { min, max, step } = range, out = [];
  for (let w = min; w <= max + 1e-9; w = Math.round((w + step) * 100) / 100) out.push(w);
  return out;
}
// Con qué implemento se hace el ejercicio según el equipo, o null si no se puede.
function implFor(ex, equip) {
  if ((ex.needs || []).some((n) => !equip[n])) return null;   // p. ej. banco
  if (ex.impl === 'bw') return 'bw';
  if (ex.impl === 'rings') return equip.rings ? 'rings' : null;
  if (ex.impl === 'bar') return equip.bar ? 'bar' : ex.alsoRings && equip.rings ? 'rings' : null;
  if (ex.impl === 'band') return equip.band ? 'band' : null;
  if (ex.impl?.startsWith('m:')) return (equip.machines || []).some((m) => 'm:' + m.id === ex.impl) ? ex.impl : null;
  if (ex.impl === 'kb') return equip.kb?.length ? 'kb' : ex.alsoDb && equip.db ? 'db' : null;
  if (ex.impl === 'db') return equip.db ? 'db' : null;
  return null;
}
const roundDown = (steps, w) => { if (!steps.length) return 0; let best = steps[0]; for (const s of steps) if (s <= w + 1e-9) best = s; return best; };
const stepUp = (steps, w) => steps.find((s) => s > w + 1e-9) ?? w;
const stepDown = (steps, w) => { const lower = steps.filter((s) => s < w - 1e-9); return lower.length ? lower[lower.length - 1] : (steps[0] ?? w); };

// ——— Planes ———
// Un plan es una lista de días; cada día, una lista de huecos (patrones de movimiento de SLOTS) con sus series.
// La rutina guarda ítems ya resueltos { slot, ex, pinned }. Los ejercicios propios ('c_…') no están en EXERCISES:
// por eso toda función recibe getEx para buscarlos y nunca se re-resuelve un ítem sin hueco.
const DEFAULT_SETS = 3;   // series de un ítem que no tiene hueco en el día del plan (propio o agregado a mano)
const libraryEx = (id) => EXERCISES[id];
// Primer hueco (en orden de declaración) que lista el ejercicio; null si ninguno (siempre null para los propios).
const slotOf = (id) => Object.keys(SLOTS).find((slot) => SLOTS[slot].ex.includes(id)) ?? null;
// ¿Se puede hacer con este equipo? Es la única regla de posibilidad: la de implFor.
const possible = (id, equip, getEx = libraryEx) => { const ex = getEx(id); return !!(ex && implFor(ex, equip)); };
// Primer ejercicio posible del hueco: prueba primero la preferencia del plan, saltea los excluidos y,
// con bw, acepta solo los que se hacen con peso corporal. null = el hueco no tiene ejercicio posible.
// Un hueco que no existe en SLOTS es un error de datos: falla fuerte (igual que resolvePlan), no devuelve null.
function resolveSlot(slot, equip, { bw = false, exclude = [], pref = null, getEx = libraryEx } = {}) {
  if (!SLOTS[slot]) throw new Error(`Hueco desconocido: ${slot}`);
  const candidates = [pref, ...SLOTS[slot].ex].filter((id) => id && !exclude.includes(id));
  // implFor solo se vuelve a evaluar con bw; sin bw alcanza con possible.
  const fits = (id) => possible(id, equip, getEx) && (!bw || implFor(getEx(id), equip) === 'bw');
  return candidates.find(fits) ?? null;
}
// Rutina recién armada desde los huecos del plan, sin fijados. La exclusión es por día (sin aros, A y B llevan remo en silla).
// Un hueco sin ejercicio posible guarda igual un ejercicio (la preferencia o el primero del hueco) para mostrarlo como "Falta equipo".
const resolvePlan = (plan, equip, opts = {}) => plan.days.map((day) => day.slots.reduce((items, { slot, ex: pref }) => {
  const chosen = resolveSlot(slot, equip, { ...opts, pref: pref ?? null, exclude: items.map((it) => it.ex) });
  return [...items, { slot, ex: chosen ?? pref ?? SLOTS[slot].ex[0], pinned: false }];
}, []));
// Re-resolución mínima de un día: solo cambia lo que dejó de ser posible y tiene hueco. Lo reemplazado queda sin fijar,
// así el aviso de un fijado imposible sale una sola vez. No usa la preferencia del plan: el usuario puede haber reordenado.
function resolveDay(items, equip, opts = {}) {
  const day = [...items], notices = [];
  day.forEach((item, i) => {
    // Un ítem sin hueco, o con un hueco que ya no existe en SLOTS (dato persistido viejo), no se re-resuelve: queda por referencia.
    if (!SLOTS[item.slot] || possible(item.ex, equip, opts.getEx)) return;
    const others = day.filter((_, j) => j !== i).map((it) => it.ex);
    const to = resolveSlot(item.slot, equip, { ...opts, exclude: others });
    if (item.pinned) notices.push({ from: item.ex, to });
    // Sin reemplazo se conserva el ejercicio ("Falta equipo"); un no fijado ya está en ese estado y no se toca.
    if (to) day[i] = { slot: item.slot, ex: to, pinned: false };
    else if (item.pinned) day[i] = { ...item, pinned: false };
  });
  return { items: day, notices, changed: day.some((it, i) => it !== items[i]) };
}
// Equipo que usa el ejercicio con este equipo (claves de equip; una máquina es 'm:<id>'). Peso corporal no usa nada.
function equipUsed(ex, equip) {
  const impl = implFor(ex, equip);
  if (!impl) return [];
  return [...new Set([...(ex.needs || []), ...(impl === 'bw' ? [] : [impl])])];
}
// Copia del equipo sin lo que hoy no está disponible ("hoy no puedo": llueve y no hay aros, la máquina está ocupada…).
function withoutEquip(equip, keys) {
  const out = { ...equip };
  for (const k of keys) {
    if (k.startsWith('m:')) out.machines = (out.machines || []).filter((m) => 'm:' + m.id !== k);
    else if (k === 'kb') out.kb = [];
    else if (k === 'db') out.db = null;
    else out[k] = false;
  }
  return out;
}
// Sin aros, el ejercicio de aros se reemplaza por su alternativa (NO_RINGS); el resto queda igual.
const ringsSwap = (id, equip) => (!equip.rings && NO_RINGS[id] ? NO_RINGS[id] : id);
// "Solo peso corporal": no hay ningún equipo marcado (ni mancuernas, ni pesas rusas, ni accesorios, ni máquinas).
const noEquip = (equip) => !equip.db && !equip.kb?.length && !equip.rings && !equip.bench && !equip.bar && !equip.band && !equip.machines?.length;
const bareEquip = (equip) => ({ ...equip, db: null, kb: [], rings: false, bench: false, bar: false, band: false, machines: [] });
// Rutina rearmada con otro equipo sin tocar lo que eligió el usuario: cada ítem sin fijar toma el ejercicio que hoy pondría
// el plan en ese hueco (con su preferencia); los fijados, los propios y los que repetirían un ejercicio del día quedan igual.
function refreshUnpinned(plan, routine, equip, opts = {}) {
  const fresh = resolvePlan(plan, equip, opts);
  return routine.map((items, d) => {
    const pool = [...(fresh[d] || [])];
    return items.map((it) => {
      if (it.pinned || !SLOTS[it.slot]) return it;
      const k = pool.findIndex((f) => f.slot === it.slot);
      if (k < 0) return it;
      const [f] = pool.splice(k, 1);
      return f.ex === it.ex || items.some((o) => o !== it && o.ex === f.ex) ? it : { ...it, ex: f.ex };
    });
  });
}
// Migración: las plantillas A/B del usuario pasan tal cual y fijadas; sin aros se guarda el reemplazo que ya veía.
const routineFromTemplates = (tpls, equip) => [tpls.A, tpls.B].map((ids) => ids.map((id) => {
  const ex = ringsSwap(id, equip);
  return { slot: slotOf(ex), ex, pinned: true };
}));
// Fecha del primer entreno guardado ('' si no hay): el inicio del plan para quien ya entrenaba.
const firstWorkout = (sessions = []) => sessions.filter((s) => s.type === 'entreno').map((s) => s.date).sort()[0] ?? '';
const activePlan = (state) => PLANS[state.plan?.id] || PLANS.fb2;
const isDayOf = (plan, pos) => Number.isInteger(pos) && pos >= 0 && pos < plan.days.length;
const dayIndex = (plan, pos) => (isDayOf(plan, pos) ? pos : 0);
// Rotación: el próximo día es el siguiente al hecho, sin importar el calendario; una posición inválida vuelve al primero.
const nextDay = (plan, pos) => (isDayOf(plan, pos) ? (pos + 1) % plan.days.length : 0);
const weeksSince = (since, today) => (since ? Math.floor(daysBetween(since, today) / 7) : 0);
// Rampa de entrada (−1 serie las 2 primeras semanas del plan) y descarga (−1); se suman y nunca queda menos de 1.
const setsFor = (sets, weeks, deload) => Math.max(1, sets - (weeks < 2 ? 1 : 0) - (deload ? 1 : 0));
const daySlot = (day, slot) => day.slots.find((s) => s.slot === slot) ?? null;

// ——— Fuerza estimada ———
// El 1RM se estima como peso corporal × coeficiente del ejercicio (novato hombre), ajustado por sexo, experiencia y edad.
// Coeficientes propios y aproximados (no copiados de tablas comerciales). La altura casi no cambia el resultado; no se usa.
function strengthFactor(profile, ex) {
  const fem = ex.lower ? 0.7 : 0.55;
  const sex = profile.sex === 'm' ? fem : profile.sex === 'x' ? (1 + fem) / 2 : 1;
  const exp = { novato: 1, medio: 1.5, avanzado: 2 }[profile.exp] ?? 1;
  const a = Number(profile.age) || 30;
  const age = a < 40 ? 1 : a < 50 ? 0.92 : a < 60 ? 0.82 : 0.7;
  return sex * exp * age;
}
const epley1RM = (w, reps) => w * (1 + reps / 30);
const weightForReps = (oneRM, reps) => oneRM / (1 + reps / 30);
const estimate1RM = (profile, ex) => (Number(profile.weight) || 70) * (ex.ratio || 0) * strengthFactor(profile, ex);
// Rango de repeticiones de un ejercicio: el del hueco del plan, si no el del ejercicio, si no el de siempre (8–12).
const repRange = (ex, spec) => spec?.reps ?? ex?.reps ?? [REPS_MIN, REPS_MAX];
const repCenter = ([lo, hi]) => Math.round((lo + hi) / 2);
// Para quien recién empieza, el rango se achica a 4 repeticiones alrededor del mismo centro (6–12 → 7–11): mismo peso, meta más clara.
const noviceRange = (range) => { const c = repCenter(range); return [Math.max(range[0], c - 2), Math.min(range[1], c + 2)]; };
// Peso sugerido la primera vez (serie de calibración al centro del rango: 10 repeticiones con 8–12).
const startWeight = (profile, ex, steps, range = [REPS_MIN, REPS_MAX]) => roundDown(steps, START_FACTOR * weightForReps(estimate1RM(profile, ex), repCenter(range)));
// Después de la serie de calibración: reps hechas + reps en reserva → 1RM estimado → peso de trabajo (centro del rango dejando 2).
function calibrate(w, reps, rir, steps, range = [REPS_MIN, REPS_MAX]) {
  const e1rm = epley1RM(w, reps + (Number(rir) || 0));
  return { e1rm: Math.round(e1rm * 10) / 10, w: roundDown(steps, weightForReps(e1rm, repCenter(range) + TARGET_RIR)) };
}
// Cuánto más fuerte (o más débil) es la persona que lo que estima su perfil: la mediana de 1RM anotado / estimado
// en los ejercicios con datos. 0 si todavía no levantó nada; acotado para que un dato raro no dispare los pesos.
function strengthScale(profile, lifts, getEx) {
  const r = Object.entries(lifts).map(([id, l]) => {
    const ex = getEx(id), est = ex?.ratio && l.e1rm ? estimate1RM(profile, ex) : 0;
    return est ? l.e1rm / est : 0;
  }).filter((x) => x > 0).sort((a, b) => a - b);
  if (!r.length) return 0;
  const m = r.length >> 1, med = r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2;
  return Math.min(3, Math.max(0.3, med));
}
// Peso sugerido sin datos propios del ejercicio: con escala, como una calibración (centro del rango dejando 2); sin escala, el 70 %.
const guessWeight = (profile, ex, steps, range, scale) => (scale
  ? roundDown(steps, weightForReps(estimate1RM(profile, ex) * scale, repCenter(range ?? [REPS_MIN, REPS_MAX]) + TARGET_RIR))
  : startWeight(profile, ex, steps, range));
// ¿El ejercicio se mide en repeticiones dentro de un rango (con peso o con el propio cuerpo)? Los de tiempo no tienen rango.
const hasRepRange = (ex) => ex.kind === 'peso' || ex.kind === 'reps';
// Ejercicios con peso de la sesión cuyo peso no cambió (y que tienen rango): a esos se les dice en qué repeticiones suben.
// Los topados por dolor o en descarga (capped) no progresan, así que no se les promete subida. Se cruza por id de ejercicio.
// Los cambiados solo por hoy (from) tampoco: la próxima vez vuelve el ejercicio de la rutina.
const unchangedWeightItems = (session, isWeighted) => session.items.filter((x) => x.reps && !x.capped && !x.from && isWeighted(x.ex) && !session.ups?.some((u) => u.ex === x.ex));
// Doble progresión: el máximo del rango en todas las series → sube un salto; alguna por debajo del mínimo → baja un salto.
function progress(w, sets, steps, [lo, hi] = [REPS_MIN, REPS_MAX]) {
  const done = sets.filter((s) => s.reps > 0);
  if (!done.length) return w;
  if (done.every((s) => s.reps >= hi)) return stepUp(steps, w);
  if (done.some((s) => s.reps < lo)) return stepDown(steps, w);
  return w;
}
const painCap = (w, steps) => roundDown(steps, PAIN_CAP * w);

// ——— Modo dolor ———
// Últimos registros de dolor de una zona (de las sesiones), del más nuevo al más viejo.
function painLog(state, zone) {
  const out = [];
  for (const s of state.sessions) if (s.pain && s.pain[zone] != null) out.push({ date: s.date, val: s.pain[zone] });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
// ¿La zona está mal estos días? Dolor > 4 en los últimos 3 días o amaneció peor.
function zoneFlare(state, zone, today) {
  if (painLog(state, zone).some((p) => daysBetween(p.date, today) <= 2 && p.val > PAIN_MAX)) return true;
  return state.checks.some((c) => c.zone === zone && c.val === 'peor' && daysBetween(c.date, today) <= 2);
}
// Zonas activas en fase 1–2 que el ejercicio exige. null = sin restricción.
function restriction(state, ex, today) {
  if (!state.painMode) return null;
  const zones = (ex.tag || []).filter((z) => state.zones[z] && state.zones[z].phase < 3);
  if (!zones.length) return null;
  const flare = zones.some((z) => zoneFlare(state, z, today));
  return { zones, mode: flare && ex.alt ? 'alt' : 'cap', flare };
}
// Ajuste de la carga del isométrico según el dolor de la sesión y cómo amaneció al día siguiente.
// Sin peso (o sin mancuernas) se juega con el tiempo: 20 a 60 s. Con peso, de a un salto.
function isoAdjust(z, ex, steps, pain, worse) {
  const up = pain <= 2 && !worse, down = pain > PAIN_MAX || worse;
  const secs = z.secs || ISO_SECS, load = z.load || 0, minLoad = ex.load0 === 0 ? 0 : (steps[0] ?? 0);
  const bySecs = { ...z, secs: up ? Math.min(60, secs + 5) : down ? Math.max(20, secs - 10) : secs };
  if (ex.impl === 'bw' || !steps.length) return bySecs;
  if (load === 0) return up && secs >= 60 ? { ...z, load: steps[0], secs: ISO_SECS } : bySecs;   // 60 s sin peso → agrega mancuernas
  if (up) return { ...z, load: stepUp(steps, load) };
  if (down) return load <= minLoad ? bySecs : { ...z, load: load === steps[0] ? minLoad : stepDown(steps, load) };
  return z;
}
// Cuánto le falta a una zona para avanzar: días en la fase, registros de dolor de la semana, si alguno pasó de 3 y si amaneció peor.
function phaseProgress(state, zone, today) {
  const z = state.zones[zone];
  const week = painLog(state, zone).filter((p) => daysBetween(p.date, today) <= 6);
  return { days: daysBetween(z.since, today), logs: week.length, need: z.phase === 1 ? 5 : 3, high: week.some((p) => p.val > 3),
    worse: state.checks.some((c) => c.zone === zone && c.val === 'peor' && daysBetween(c.date, today) <= 6) };
}
// Lista para pasar de fase: ≥ 10 días en la fase, registros suficientes la última semana, todos ≤ 3 y sin "peor".
function phaseReady(state, zone, today) {
  const z = state.zones[zone];
  if (!z || z.phase >= 3) return false;
  const p = phaseProgress(state, zone, today);
  return p.days >= PHASE_DAYS && p.logs >= p.need && !p.high && !p.worse;
}
// ¿Toca preguntar cómo amaneció? Hubo sesión con dolor ayer y hoy todavía no se respondió.
function pendingChecks(state, today) {
  if (!state.painMode) return [];
  const y = addDays(today, -1);
  return Object.keys(state.zones).filter((zone) =>
    state.sessions.some((s) => s.date === y && s.pain && s.pain[zone] != null) &&
    !state.checks.some((c) => c.zone === zone && c.date === today));
}

// ——— Volumen ———
const targetSets = (days, perDay) => days * perDay * 3;
// Presupuesto semanal de series: sube como mucho 30 % por semana hasta el objetivo.
function weekBudget(plan, days, perDay, today) {
  const target = targetSets(days, perDay), wk = weekKey(today);
  if (!plan.budget) return { budget: target, week: wk };
  if (plan.week === wk) return { budget: Math.min(plan.budget, target), week: wk };
  return { budget: Math.min(target, Math.max(plan.budget, Math.floor(plan.budget * VOLUME_STEP))), week: wk };
}
// Series por ejercicio en una sesión (2 a 4), los primeros (compuestos) se llevan las sobrantes.
function setsPerExercise(budget, days, n) {
  const per = budget / days, base = Math.max(2, Math.min(4, Math.floor(per / n)));
  const extra = Math.max(0, Math.min(n, Math.round(per - base * n)));
  return Array.from({ length: n }, (_, i) => Math.min(4, base + (i < extra ? 1 : 0)));
}
// Sugerir pasar de 2 a 3 días: ≥ 4 entrenos en 14 días y, con modo dolor, nada > 3 en ese lapso.
function suggestThreeDays(state, today) {
  if (state.profile.days !== 2) return false;
  const recent = state.sessions.filter((s) => s.type === 'entreno' && daysBetween(s.date, today) <= 13);
  if (recent.length < 4) return false;
  if (!state.painMode) return true;
  return Object.keys(state.zones).every((zone) => painLog(state, zone).filter((p) => daysBetween(p.date, today) <= 13).every((p) => p.val <= 3));
}

// ——— Nivel de experiencia ———
// Sugerir subir de nivel (Santos Junior 2021, Loenneke 2017): tiempo entrenando sin cortes de más de 8 semanas
// (6 meses para pasar a medio, 2 años a avanzado), constancia (1,5 entrenos por semana y el último hace 2 semanas
// como mucho) y una señal de que el nivel quedó chico: levanta 30 % más de lo que estima su perfil, o tiene
// 2 ejercicios estancados aunque ya hizo una descarga. "Ahora no" la calla 30 días; en fase 1 de dolor no se ofrece.
const LEVEL_UP = { novato: ['medio', 182], medio: ['avanzado', 730] };
function suggestLevelUp(state, today, getEx) {
  const up = LEVEL_UP[state.profile.exp || 'novato'];
  if (!up || (state.plan?.levelOffer && daysBetween(state.plan.levelOffer, today) < 30)) return null;
  if (state.painMode && Object.values(state.zones).some((z) => z.phase === 1)) return null;
  const dates = state.sessions.filter((s) => s.type === 'entreno').map((s) => s.date).sort();
  if (!dates.length || daysBetween(dates[dates.length - 1], today) > 14) return null;
  let i = dates.length - 1;
  while (i > 0 && daysBetween(dates[i - 1], dates[i]) <= 56) i--;
  const span = daysBetween(dates[i], today), perWeek = ((dates.length - i) * 7) / span;
  if (span < up[1] || perWeek < 1.5) return null;
  const strong = strengthScale(state.profile, state.lifts, getEx) >= 1.3;
  const stuck = !!state.plan?.deload && Object.keys(state.lifts).filter((id) => stalled(state, id)).length >= 2;
  return strong || stuck ? { next: up[0], months: Math.round(span / 30.4), perWeek, why: strong ? 'strong' : 'stuck' } : null;
}

// ——— Entrada en calor ———
// Series de aproximación antes del primer ejercicio con peso: 8 reps al 50 % y 4 al 75 % (sin repetir pesos).
// Corta (una serie de 6 al 60 %) para el primer ejercicio de la otra mitad del cuerpo, que ya llega con el cuerpo caliente.
function warmupSets(w, steps, short) {
  const out = [];
  for (const [f, reps] of short ? [[0.6, 6]] : [[0.5, 8], [0.75, 4]]) {
    const x = roundDown(steps, w * f);
    if (x > 0 && x < w && !out.some((o) => o.w === x)) out.push({ w: x, reps });
  }
  return out;
}

// Mitad del cuerpo que trabaja un ejercicio, por su músculo principal (abdomen no cuenta para ninguna).
const UPPER_MUS = ['chest', 'delt', 'back', 'triceps', 'biceps', 'forearm'], LOWER_MUS = ['quads', 'glutes', 'hams', 'calves', 'lumbar'];
function bodyHalf(ex) {
  const m = ex.mus?.[0];
  return UPPER_MUS.includes(m) ? 'upper' : LOWER_MUS.includes(m) ? 'lower' : null;
}

// Activación y movilidad según lo que se entrena hoy: un ítem general y uno por mitad del cuerpo (las dos si no se sabe).
function warmupMoves(exs) {
  const mus = new Set(exs.flatMap((ex) => ex.mus || []));
  let up = UPPER_MUS.some((m) => mus.has(m)), low = LOWER_MUS.some((m) => mus.has(m));
  if (!up && !low) up = low = true;
  const out = [{ t: 'Activar', d: '2 min de trote en el lugar o saltos suaves, hasta que suba un poco el pulso.', min: 2 }];
  if (up) out.push({ t: 'Hombros y brazos', d: `10 círculos de brazos para cada lado, 10 aperturas abrazándote${mus.has('forearm') || mus.has('biceps') ? ' y 10 giros de muñeca para cada lado' : ''}.`, min: 1 });
  if (low) out.push({ t: 'Cadera y piernas', d: `10 sentadillas sin peso, 10 bisagras de cadera y 10 balanceos de pierna por lado${mus.has('calves') ? ', y 15 rebotes en puntas de pie' : ''}.`, min: 1 });
  return out;
}

// ——— Estancamiento ———
// Un ejercicio con peso está estancado si en las últimas 3 sesiones (sin tope por dolor ni descarga) usó el mismo peso
// y las repeticiones totales no subieron.
function stalled(state, exId) {
  const hist = [];
  for (const s of state.sessions) {
    if (s.type !== 'entreno') continue;
    const it = s.items.find((i) => i.ex === exId && !i.capped);
    if (it?.sets.length) hist.push(it);
    if (hist.length === 3) break;
  }
  if (hist.length < 3) return false;
  const top = (it) => Math.max(...it.sets.map((x) => x.w || 0)), reps = (it) => it.sets.reduce((a, x) => a + (x.reps || 0), 0);
  return hist.every((it) => top(it) === top(hist[0])) && reps(hist[0]) <= reps(hist[2]);
}
const DAY_KEYS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sa'];
const weekdayKey = (k) => DAY_KEYS[parseDay(k).getDay()];

// ——— Semana y racha ———
// Entrenos y rehabilitaciones de la semana actual, con su objetivo (los entrenos, contra los días del plan activo).
function weekStats(state, today) {
  const wk = weekKey(today), mine = state.sessions.filter((s) => weekKey(s.date) === wk);
  const phases = state.painMode ? Object.values(state.zones).map((z) => z.phase) : [];
  const rehabTarget = phases.includes(1) ? 14 : phases.includes(2) ? 4 : 0;   // fase 1: mañana y noche; fase 2: día por medio
  return { train: mine.filter((s) => s.type === 'entreno').length, target: activePlan(state).days.length, rehab: mine.filter((s) => s.type === 'rehab').length, rehabTarget };
}
// Semanas seguidas cumpliendo los días de entreno (la actual cuenta si ya se cumplió).
function streak(state, today) {
  const per = {};
  for (const s of state.sessions) if (s.type === 'entreno') per[weekKey(s.date)] = (per[weekKey(s.date)] || 0) + 1;
  let wk = weekKey(today), n = 0;
  if ((per[wk] || 0) >= state.profile.days) n++;
  for (wk = addDays(wk, -7); (per[wk] || 0) >= state.profile.days; wk = addDays(wk, -7)) n++;
  return n;
}
// Las sesiones (de la más nueva a la más vieja) agrupadas por semana, con cuántos entrenos tuvo cada una.
function sessionWeeks(sessions) {
  const out = [];
  for (const s of sessions) {
    const wk = weekKey(s.date);
    if (out.at(-1)?.wk !== wk) out.push({ wk, list: [], train: 0 });
    out.at(-1).list.push(s);
    if (s.type === 'entreno') out.at(-1).train++;
  }
  return out;
}
// La vez anterior que se hizo el mismo día del plan (o la misma plantilla en sesiones viejas), para comparar.
function prevSameDay(sessions, s) {
  const i = sessions.indexOf(s);
  return sessions.slice(i + 1).find((p) => p.type === 'entreno' && (s.plan ? p.plan === s.plan && p.day === s.day : !p.plan && p.tpl === s.tpl)) || null;
}
// Récord de cada ejercicio: con pesas, el peso más alto (a igual peso, más reps); con reps, la mayor cantidad en una serie.
// date es el primer día que se logró. Las series con peso bajado por dolor o descarga no cuentan.
function exRecords(sessions, getEx = libraryEx) {
  const rec = {};
  for (const s of [...sessions].reverse()) if (s.type === 'entreno') for (const it of s.items) {
    const kind = getEx(it.ex)?.kind;
    if (it.capped || !it.sets.length || (kind !== 'peso' && kind !== 'reps')) continue;
    for (const x of it.sets) {
      const w = kind === 'peso' ? x.w || 0 : 0, reps = x.reps || 0, r = rec[it.ex];
      if (kind === 'peso' ? !w : !reps) continue;
      if (!r || w > r.w || (w === r.w && reps > r.reps)) rec[it.ex] = { ex: it.ex, kind, w, reps, date: s.date };
    }
  }
  return Object.values(rec).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
// La semana actual de lunes a domingo, para la tira del inicio. Los días con entreno guardado muestran lo que se hizo;
// los que faltan (hoy incluido si todavía no entrenó) siguen la rotación desde el día que toca. day: índice del día del plan o null.
const WEEK_KEYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sa', 'do'];
function weekPlan(state, today) {
  const plan = activePlan(state), mon = weekKey(today), train = state.rem?.train || [];
  let pos = dayIndex(plan, state.plan?.pos);
  return WEEK_KEYS.map((k, i) => {
    const date = addDays(mon, i), done = state.sessions.filter((s) => s.type === 'entreno' && s.date === date);
    let day = null;
    if (done.length) {
      const s = done[0];
      day = isDayOf(plan, s.day) && (!s.plan || s.plan === plan.id) ? s.day : null;
    } else if (date >= today && train.includes(k)) { day = pos; pos = nextDay(plan, pos); }
    return { k, date, day, train: train.includes(k), done: done.length > 0, today: date === today, past: date < today };
  });
}
// Descanso tras una serie según el ejercicio: los compuestos (y los ejercicios nuevos con peso) usan el elegido en Ajustes;
// aislamiento, deltoides, piernas sin peso e isométricos, 1 min; la plancha y el core, 45 s. Nunca más que el elegido.
function restSecs(ex, base) {
  const own = ex.kind === 'tiempo' || ex.cat === 'core' ? 45 : ex.rtype === 'compuesto' || (ex.kind === 'peso' && !ex.rtype) ? base : 60;
  return Math.min(base, own);
}
// Duración estimada de un entreno: unos 40 s por serie, el descanso entre series y 5 min de entrada en calor, redondeada a 5 min.
function workoutMinutes(sets, rest) {
  if (!sets) return 0;
  return Math.max(10, Math.round((sets * 40 + (sets - 1) * rest + 300) / 300) * 5);
}
// Resumen de un entreno: series, volumen (kg × reps) y duración en minutos.
function sessionSummary(session, ms) {
  const sets = session.items.reduce((n, i) => n + i.sets.length, 0);
  const vol = session.items.reduce((v, i) => v + i.sets.reduce((a, x) => a + (x.w || 0) * (x.reps || 0), 0), 0);
  return { sets, vol: Math.round(vol), min: Math.max(1, Math.round(ms / 60000)) };
}

// Lo que falta de un entreno en curso: por ejercicio, cuántas series quedan sin tildar (n) de cuántas (of).
function workoutLeft(items) {
  const left = items.map((it) => ({ name: it.ex.name, n: it.rows.filter((r) => !r.done).length, of: it.rows.length })).filter((x) => x.n);
  return { sets: left.reduce((a, x) => a + x.n, 0), items: left };
}

// ——— Calendario (.ics) ———
const DAYS_ICS = { lu: 'MO', ma: 'TU', mi: 'WE', ju: 'TH', vi: 'FR', sa: 'SA', do: 'SU' };
function icsText(rem, painMode, today) {
  const start = today.replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const t = (hhmm) => hhmm.replace(':', '') + '00';
  const ev = (uid, time, rule, title, desc) => ['BEGIN:VEVENT', `UID:${uid}@tendon-fuerte`, `DTSTAMP:${stamp}`, `DTSTART:${start}T${t(time)}`, `DURATION:PT15M`, `RRULE:${rule}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XZ Fit//ES', 'CALSCALE:GREGORIAN'];
  if (painMode) {
    lines.push(...ev('rehab-am', rem.am, 'FREQ=DAILY', 'XZ Fit: isométricos (mañana)', 'Abrí la app y hacé tu sesión de rehabilitación.'));
    lines.push(...ev('rehab-pm', rem.pm, 'FREQ=DAILY', 'XZ Fit: isométricos (noche)', 'Abrí la app y hacé tu sesión de rehabilitación.'));
  }
  if (rem.train?.length) lines.push(...ev('entreno', rem.trainAt, `FREQ=WEEKLY;BYDAY=${rem.train.map((d) => DAYS_ICS[d]).join(',')}`, 'XZ Fit: entreno', 'Toca entreno de cuerpo completo.'));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ——— Validación de campos (alta y Ajustes) ———
// { v } es el valor a guardar; { err } no se guarda y queda el último válido; { v, note } se guarda con un aviso.
const FIELD_RANGES = { 'profile.weight': [30, 250, 'kg'], 'profile.height': [100, 230, 'cm'], 'profile.age': [12, 100, 'años'] };
function checkField(path, raw, equip) {
  const s = String(raw ?? '').trim(), n = Number(s.replace(',', '.'));
  const r = FIELD_RANGES[path];
  if (r) {
    if (!s) return path === 'profile.weight' ? { err: 'Poné tu peso' } : { v: '' };   // altura y edad son opcionales
    return n >= r[0] && n <= r[1] ? { v: s.replace(',', '.') } : { err: `Entre ${r[0]} y ${r[1]} ${r[2]}` };
  }
  if (path.startsWith('equip.db.')) {
    const k = path.slice(9), db = equip?.db || {};
    if (!(n > 0)) return { err: 'Tiene que ser mayor a 0' };
    if (k === 'min' && n > db.max) return { err: `Pasa la más pesada (${db.max} kg)` };
    if (k === 'max' && n < db.min) return { err: `Menos que la más liviana (${db.min} kg)` };
    return { v: n };
  }
  if (path === 'equip.kb') {
    const v = [], bad = [];
    for (const x of s.split(/[,;\s]+/).filter(Boolean)) { const k = Number(x.replace(',', '.')); k > 0 ? v.push(k) : bad.push(x); }
    v.sort((a, b) => a - b);
    if (!bad.length) return { v };
    return { v, note: `No entendimos ${bad.map((b) => `«${b}»`).join(', ')}: ${bad.length > 1 ? 'quedaron' : 'quedó'} afuera.` };
  }
  return { v: raw };
}

// ——— Cambiar plan y días ———
// El día marcado más cercano a k (la semana vuelve a empezar): es el que se mueve cuando el plan ya tiene todos sus días.
// Ante un empate, el de antes (el entreno se corre para adelante). keys es la semana en orden (lu…do).
function nearestDay(days, k, keys) {
  const n = keys.length, at = keys.indexOf(k);
  const dist = (d) => { const x = Math.abs(keys.indexOf(d) - at); return Math.min(x, n - x); };
  const before = (d) => (at - keys.indexOf(d) + n) % n;
  return [...days].sort((a, b) => dist(a) - dist(b) || before(a) - before(b))[0] ?? null;
}
// Qué cambió la persona en la rutina guardada de un plan frente a la que se armaría hoy (fresh, con el mismo equipo).
// [{ day, kind: 'swap'|'add'|'del'|'order', from?, to? }]. Lo que rearmó la app sola (sin fijar, por el equipo) no cuenta.
function routineChanges(saved, fresh) {
  const out = [];
  saved.forEach((items, day) => {
    const base = fresh[day] || [], ids = base.map((b) => b.ex), mine = items.map((it) => it.ex);
    const missing = base.filter((b) => !mine.includes(b.ex)), n = out.length;
    for (const it of items) {
      if (ids.includes(it.ex)) continue;
      // Un ejercicio distinto en un hueco del plan reemplaza al que faltaba en ese hueco.
      const k = it.slot ? missing.findIndex((b) => b.slot === it.slot) : -1, was = k >= 0 ? missing.splice(k, 1)[0] : null;
      if (!it.pinned && it.slot) continue;
      out.push(was ? { day, kind: 'swap', from: was.ex, to: it.ex } : { day, kind: 'add', to: it.ex });
    }
    for (const b of missing) out.push({ day, kind: 'del', from: b.ex });
    if (out.length === n && mine.filter((x) => ids.includes(x)).join() !== ids.filter((x) => mine.includes(x)).join()) out.push({ day, kind: 'order' });
  });
  return out;
}
