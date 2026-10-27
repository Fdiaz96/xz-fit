// XZ Fit (antes Tendón Fuerte) — rehabilitación de tendones y entreno con mancuernas. Los datos viven solo en el celular
// (IndexedDB). Los identificadores internos siguen siendo "tendon-fuerte" para no perder los datos ya guardados.
// Protocolo de tendones del video de Jeremy Ethier con Keith Baar y Coach Q; reglas en logic.js, bocetos en figures.js.

const APP_VERSION = '1.21.2';
const DAY_NAMES = { lu: 'Lu', ma: 'Ma', mi: 'Mi', ju: 'Ju', vi: 'Vi', sa: 'Sá', do: 'Do' };
const SIDES = { der: 'derecha', izq: 'izquierda', ambos: 'ambos lados' };
const REST_SECS = 90, ISO_REST = 60;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => dayKey();
const fmtKg = (w) => (w ? `${String(w).replace('.', ',')} kg` : 'Sin peso');
const fmtDate = (k) => parseDay(k).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDateLong = (k) => parseDay(k).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
const zoneName = (id) => ZONE[id]?.name || 'General';
// La parte del cuerpo como la dice el usuario ("por tu codo"), para explicar por qué un ejercicio cambia.
const bodyPart = (id) => id.startsWith('codo') ? 'codo' : id === 'aquiles' ? 'tendón de Aquiles' : zoneName(id).toLowerCase();
const forZones = (r) => 'por tu ' + [...new Set(r.zones.map(bodyPart))].join(' y tu ');
const painTag = (r) => `${r.mode === 'alt' ? 'variante' : 'más liviano'} ${forZones(r)}`;
const CALIB_TAG = '<span class="calib-tag">calibración</span>';
const GUESS_TAG = '<span class="calib-tag">estimado</span>';

// ——— Estado y guardado ———
const DEFAULT = () => ({
  v: 1, onboarded: false, painMode: false, hidePainTip: false,
  profile: { name: '', sex: 'h', weight: '', height: '', age: '', exp: 'novato', days: 2 },
  equip: { db: { min: 2, max: 24, step: 2 }, kb: [], rings: false, bench: false, bar: false, band: false, machines: [] },
  routine: {}, exlib: [],
  zones: {}, lifts: {}, sessions: [], checks: [], custom: [],
  plan: { id: 'fb2', pos: 0, since: '', bw: false, deload: '', deloadOffer: '' },
  rem: { am: '08:00', pm: '20:00', train: ['lu', 'ju'], trainAt: '19:00' },
  prefs: { sound: true, voice: false, rest: 90, auto: true, theme: 'dark', weights: 'auto' }, seenVersion: '',
});
let S = DEFAULT();

const db = {
  open() {   // una sola conexión; se cierra si otra pestaña borra o actualiza la base
    return (this.conn ||= new Promise((res, rej) => {
      const r = indexedDB.open('tendon-fuerte', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); this.conn = null; }; res(r.result); };
      r.onerror = () => { this.conn = null; rej(r.error); };
    }));
  },
  async get(k) { const d = await this.open(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
};
// Único punto de entrada de datos guardados (arranque e importación): completa los campos nuevos y migra.
// Es idempotente: con 'routine' ya presente no migra de nuevo, así importar una copia vieja después de migrar es seguro.
function withDefaults(d) {
  const base = DEFAULT(), { templates, ...rest } = d;
  const { budget, week, next, ...plan } = { ...base.plan, ...d.plan };   // el presupuesto semanal y la alternancia A/B ya no existen
  const out = { ...base, ...rest, profile: { ...base.profile, ...d.profile }, equip: { ...base.equip, ...d.equip },
    plan: { ...plan, id: PLANS[plan.id] ? plan.id : 'fb2' }, routine: { ...d.routine }, rem: { ...base.rem, ...d.rem }, prefs: { ...base.prefs, ...d.prefs }, exlib: d.exlib || [] };
  if (out.rem.train.length) out.profile.days = out.rem.train.length;   // los días por semana son los días elegidos
  if ('routine' in d) return out;
  // Datos anteriores a los planes (v1.0 a v1.14): la rutina A/B pasa tal cual y fijada, se conserva el día que tocaba
  // y el plan empieza con el primer entreno guardado, así quien ya entrenaba no recibe la rampa de entrada.
  out.routine = { fb2: routineFromTemplates({ ...TEMPLATES, ...templates }, out.equip) };
  out.plan = { ...out.plan, pos: next === 'B' ? 1 : 0, since: firstWorkout(d.sessions) };
  return out;
}
let saving = Promise.resolve();
function persist() { const snap = JSON.parse(JSON.stringify(S)); saving = saving.then(() => db.set('data', snap)).catch((e) => toast('No se pudo guardar: ' + e.message)); return saving; }

// ——— Avisos ———
// Redibuja un diálogo sin perder el aviso, el descanso ni el tooltip que estén adentro.
const dlg = (id) => ({
  set html(v) { const d = $(id), kept = ['toast', 'rest', 'tip'].map($).filter((el) => el.parentNode === d); d.innerHTML = v; kept.forEach((el) => d.appendChild(el)); },
});
let toastTimer;
function overlayHost() { return [...document.querySelectorAll('dialog[open]')].pop() || document.body; }
// undo: función opcional que muestra el botón "Deshacer" (el aviso dura más).
let toastUndo = null;
function toast(msg, undo) {
  const t = $('toast'); overlayHost().appendChild(t);
  t.querySelector('span').textContent = msg; t.hidden = false;
  t.querySelector('button')?.remove(); toastUndo = undo || null;
  if (undo) t.insertAdjacentHTML('beforeend', '<button type="button" data-action="undo">Deshacer</button>');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; toastUndo = null; }, undo ? 6000 : 3500);
}

// ——— Tema ———
function applyTheme() {
  const pref = S.prefs.theme || 'dark';
  const t = pref === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F2F3F5' : '#0E0F11');
  try { localStorage.setItem('tf-theme', t); } catch {}
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => S.prefs.theme === 'system' && applyTheme());

// ——— Navegación ———
let tab = 'home';
function showTab(t) {
  tab = t;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${t}`));
  render(); window.scrollTo(0, 0);
}
// La pestaña Dolor aparece con el modo dolor o alguna zona marcada; desde Ajustes se llega igual.
const hasPainTab = () => S.painMode || Object.keys(S.zones).length > 0;
function render() {
  const painTab = document.querySelector('.tabbar [data-tab="tendons"]');
  // Si desaparece mientras estás en ella, volvés a Hoy.
  const gone = !hasPainTab() && !painTab.hidden && tab === 'tendons';
  painTab.hidden = !hasPainTab();
  if (gone) return showTab('home');
  const { routine, since, changed, notices } = syncRoutine();
  S.routine = routine; S.plan.since = since;
  // Antes del primer uso no se guarda nada: el alta arma la rutina con el equipo elegido.
  if (changed && S.onboarded) persist();
  if (notices.length) toast(notices.map(noticeText).join(' '));
  ({ home: renderHome, train: renderTrain, tendons: renderTendons, history: renderHistory, settings: renderSettings })[tab]();
  calmMotion(document);
}
function calmMotion(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.querySelectorAll('svg.fig').forEach((s) => s.pauseAnimations?.());
}

// ——— Plan de entreno ———
// Ejercicio de la biblioteca o uno propio (ids "c_…"), ya listo para dibujar y planificar.
function getEx(id) {
  if (EXERCISES[id]) return EXERCISES[id];
  const c = S.exlib.find((x) => x.id === id);
  return c ? { ...c, custom: true, tag: c.tag || [], cues: c.note ? [c.note] : ['Ejercicio propio: anotá el peso y las repeticiones de cada serie.'], fig: customFig(c.impl) } : null;
}
// Ilustración genérica para ejercicios propios según el equipo que usan.
function customFig(impl) {
  const props = impl === 'db' ? [{ t: 'db', at: 'W1' }] : impl === 'kb' ? [{ t: 'kb', at: 'W1' }] : impl === 'band' ? [{ t: 'band', at: 'W1', x: 176, y: 70 }] : [];
  const scene = impl?.startsWith('m:') ? [{ t: 'stack', x: 150 }] : impl === 'band' ? [{ t: 'post', x: 176 }] : [];
  const a = impl?.startsWith('m:') ? { ...STAND, E1: [112, 62], W1: [134, 60] } : STAND;
  return { a, b: impl?.startsWith('m:') ? { E1: [104, 70], W1: [124, 72] } : { E1: [105, 68], W1: [122, 51] }, props, scene };
}
// Variante amable del modo dolor: es la única que todavía pasa por NO_RINGS (la rutina ya está resuelta por hueco).
const altEx = (orig) => getEx(ringsSwap(orig.alt, S.equip));
// Mensaje de un ejercicio fijado que dejó de ser posible (resolveDay ya lo reemplazó y lo dejó sin fijar).
function noticeText({ from, to }) {
  const name = (id) => getEx(id)?.name || id;
  return `${name(from)} ya no se puede con tu equipo: ${to ? `lo cambiamos por ${name(to).toLowerCase()}` : 'queda como falta equipo'}.`;
}
// Lo que el motor de planes necesita de la app para resolver huecos: la biblioteca de ejercicios y el peso corporal.
const engineOpts = () => ({ getEx, bw: S.plan.bw });
// Rutina recién armada de un plan con el equipo actual (primer uso, plan nuevo o "Volver al plan original").
const freshRoutine = (plan) => resolvePlan(plan, S.equip, engineOpts());
// Ítems del día que existen (un ejercicio propio borrado desaparece de la rutina); planFor y el editor comparten esta lista.
const dayItems = (day) => S.routine[activePlan(S).id][day].filter((it) => getEx(it.ex));
const resetRoutine = () => { const plan = activePlan(S); S.routine[plan.id] = freshRoutine(plan); };
// Rutina del plan activo al día con el equipo: se arma si falta y solo se re-resuelve lo que dejó de ser posible.
// Corre al principio de cada render, así ningún cambio de equipo (Ajustes, primer uso, importación) se olvida de sincronizar.
// Es una consulta: no toca S. Devuelve la rutina y el inicio del plan al día, si cambió algo (para guardar) y los avisos (para mostrar).
function syncRoutine() {
  const plan = activePlan(S), opts = engineOpts();
  const since = S.plan.since || today();
  const stored = S.routine[plan.id], current = stored?.length === plan.days.length ? stored : freshRoutine(plan);
  const days = current.map((items) => resolveDay(items, S.equip, opts));
  const resolved = days.some((day) => day.changed);
  const planRoutine = resolved ? days.map((day) => day.items) : current;
  return {
    routine: { ...S.routine, [plan.id]: planRoutine }, since, notices: days.flatMap((day) => day.notices),
    changed: !S.plan.since || current !== stored || resolved,
  };
}
// Cómo se eligen los pesos: 'auto' (estimados y ajustados con lo que anotás), 'calib' (serie de calibración) o 'manual'.
const WEIGHT_MODES = [
  ['auto', 'Automático', 'Te sugerimos un peso para cada ejercicio. Con lo que anotes en la primera serie ajustamos el resto.'],
  ['calib', 'Con calibración', 'En el primer entreno, la primera serie de cada ejercicio va hasta que te queden 2 reps. Es lo más preciso.'],
  ['manual', 'Manual', 'Elegís vos los pesos. Te mostramos el último que usaste y no te sugerimos subidas.'],
];
const weightMode = () => (WEIGHT_MODES.some(([k]) => k === S.prefs.weights) ? S.prefs.weights : 'auto');
const weightModeFields = () => `<div class="tiles one">${WEIGHT_MODES.map(([k, n, hint]) => tile(`name="wmode" data-action="weights-mode" value="${k}"`, weightMode() === k, n, hint, 'radio')).join('')}</div>`;
// Peso estimado de un ejercicio sin datos propios, ajustado por lo que ya se levantó en los otros.
const guessFor = (ex, steps, range) => guessWeight(S.profile, ex, steps, range, strengthScale(S.profile, S.lifts, getEx));
// Etiqueta debajo del peso cuando todavía no es un peso de trabajo.
const loadTag = (p) => (p.calib ? CALIB_TAG : p.guess ? GUESS_TAG : '');
const loadText = (p) => (p.w ? fmtKg(p.w) : p.pick ? 'a elegir' : 'sin peso');
// Cada ejercicio del día del plan, ya adaptado al equipo y al modo dolor; las series salen del hueco (rampa y descarga).
const planFor = (day) => dayItems(day).map((it) => planItem(day, it));
// Un ítem del día (ejercicio y hueco de la rutina) listo para entrenar; equip permite el equipo de hoy ("hoy no puedo").
function planItem(day, it, equip = S.equip) {
  const spec = activePlan(S).days[day], t = today();
  const deload = S.plan.deload === weekKey(t), weeks = weeksSince(S.plan.since, t);
  const orig = getEx(it.ex);
  const r = restriction(S, orig, t);
  const ex = r?.mode === 'alt' ? altEx(orig) : orig;
  const impl = implFor(ex, equip);
  const steps = weightSteps(equip, impl);
  const slot = daySlot(spec, it.slot), range = repRange(ex, slot);
  const item = { ex, orig, r, impl, steps, slot: it.slot, sets: setsFor(slot?.sets ?? DEFAULT_SETS, weeks, deload), range, missing: !impl, deload };
  if (ex.kind === 'peso') {
    const lift = S.lifts[ex.id], mode = weightMode();
    // Sin peso de trabajo: con calibración se pide la serie especial; en automático se estima y la primera serie
    // anotada lo fija (y ajusta a los demás); en manual lo elige la persona.
    item.calib = !lift && mode === 'calib';
    item.guess = !lift && mode === 'auto';
    item.pick = !lift && mode === 'manual' && !ex.start;
    item.base = lift ? roundDown(steps, lift.w) || lift.w : item.pick ? 0
      : mode !== 'manual' && ex.ratio ? guessFor(ex, steps, range) : roundDown(steps, ex.start || 0);
    item.w = r ? painCap(item.base, steps) : item.base;
    if (deload && !item.calib) item.w = roundDown(steps, item.w * 0.9);
    item.capped = !!r && item.w < item.base;
    item.stalled = !r && !deload && stalled(S, ex.id);
  } else if (ex.kind === 'tiempo') item.secs = S.lifts[ex.id]?.secs || 30;
  else if (ex.kind === 'iso') { item.secs = 30; item.w = ex.load0 ? roundDown(steps, ex.load0) : 0; }
  return item;
}
// Mantenimiento: zonas en fase 3 suman 3 isométricos de 30 s al final del entreno.
function maintenanceItems() {
  if (!S.painMode) return [];
  return Object.entries(S.zones).filter(([, z]) => z.phase === 3).map(([zone, z]) => {
    const ex = rehabEx(zone, 1), impl = implFor(ex, S.equip);
    return { ex, impl, steps: weightSteps(S.equip, impl), sets: 3, secs: 30, w: z.load || 0, maint: zone };
  });
}

// ——— Rehabilitación ———
// Ejercicio de rehabilitación de una zona en una fase: el elegido por el usuario si se puede hacer con su equipo, si no el primero posible.
function rehabEx(zone, phase) {
  const opts = REHAB_OPTIONS[zone][Math.min(2, phase)].map((id) => EXERCISES[id]).filter((e) => implFor(e, S.equip));
  const chosen = S.zones[zone]?.choice?.[Math.min(2, phase)];
  return opts.find((e) => e.id === chosen) || opts[0] || EXERCISES[REHAB[zone][Math.min(2, phase)]];
}
const rehabOptions = (zone, phase) => REHAB_OPTIONS[zone][Math.min(2, phase)].map((id) => EXERCISES[id]).filter((e) => implFor(e, S.equip));
function rehabItems() {
  const out = [];
  for (const [zone, z] of Object.entries(S.zones)) {
    if (z.phase >= 3) continue;
    const ex = rehabEx(zone, z.phase), impl = implFor(ex, S.equip), steps = weightSteps(S.equip, impl);
    if (z.phase === 2 && lentoDoneRecently(ex.id)) continue;   // isotónicos: día por medio
    out.push({ ex, zone, impl, steps, w: impl === 'bw' ? 0 : z.load || 0, secs: z.secs || ISO_SECS, sets: z.phase === 1 ? ISO_SETS : LENTO_SETS, reps: LENTO_REPS });
  }
  return out;
}
const lentoDoneRecently = (exId) => S.sessions.some((s) => s.type === 'rehab' && daysBetween(s.date, today()) <= 1 && s.items.some((i) => i.ex === exId && i.sets.some((x) => x.done)));
const slotNow = () => (new Date().getHours() < 15 ? 'mañana' : 'noche');
const rehabDone = (slot) => S.sessions.some((s) => s.type === 'rehab' && s.date === today() && s.slot === slot);
const activeZones = () => Object.keys(S.zones);
function newZone(zone, pain = 5, side = 'der') {
  const ex = EXERCISES[REHAB_OPTIONS[zone][1][0]], steps = weightSteps(S.equip, implFor(ex, S.equip));
  return { side, pain0: pain, phase: 1, since: today(), load: ex.load0 ? roundDown(steps, ex.load0) : 0, secs: ISO_SECS };
}

// ——— Inicio ———
function renderHome() {
  const t = today(), checks = pendingChecks(S, t);
  const hasZones = activeZones().length > 0;
  const ws = weekStats(S, t), st = streak(S, t);
  const date = parseDay(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }).replace(',', '');
  const dots = (n, of) => Array.from({ length: Math.max(of, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  let h = `<header class="home-head"><div><p class="greet">${S.profile.name ? `Hola, ${esc(S.profile.name)}` : 'Hola'}</p><h1>${date[0].toUpperCase() + date.slice(1)}</h1></div>
    <div class="week"><div class="dots" aria-hidden="true">${dots(ws.train, ws.target)}</div><span>${ws.train} de ${ws.target} entrenos esta semana</span>
      ${ws.rehabTarget ? `<span class="rehab-n">${ws.rehab} de ${ws.rehabTarget} sesiones de rehabilitación</span>` : ''}${st ? `<span>Racha de ${st} ${st === 1 ? 'semana' : 'semanas'}</span>` : ''}</div></header>`;
  for (const zone of checks) {
    h += `<div class="card ask pain"><h3>¿Cómo amaneció tu ${esc(zoneName(zone).toLowerCase())}?</h3><p class="muted small">Comparado con ayer. Si está peor, bajamos la carga.</p>
      <div class="btns">${['mejor', 'igual', 'peor'].map((v) => `<button class="sec" data-action="check" data-zone="${zone}" data-val="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>`;
  }
  // Rehabilitación: va antes del entreno si falta la del momento; si ya está hecha, queda abajo y chica.
  let rehab = '', rehabFirst = false;
  if (S.painMode) {
    const items = rehabItems();
    if (items.length || S.custom.length) {
      const slot = slotNow(), done = { mañana: rehabDone('mañana'), noche: rehabDone('noche') };
      rehabFirst = !done[slot];
      const cell = (s) => `<span class="slot${done[s] ? ' done' : ''}${s === slot ? ' now' : ''}">${s[0].toUpperCase() + s.slice(1)}<b>${done[s] ? 'Hecha' : s === slot ? 'Toca ahora' : 'Pendiente'}</b></span>`;
      rehab = `<div class="card rehab"><div class="slots">${cell('mañana')}${cell('noche')}</div>
        <h3>Rehabilitación de la ${slot}</h3>
        <p class="muted small">${items.map((i) => esc(i.ex.name)).join(', ') || 'Tus ejercicios del fisio'}</p>
        ${done[slot] ? '' : `<button class="cta pain" data-action="start-rehab">Empezar rehabilitación</button>`}</div>`;
    } else if (!hasZones) rehab = `<div class="card ask pain"><h3>Modo dolor activo</h3><p class="muted small">Marcá qué te duele en la pestaña Dolor para armar tu rehabilitación.</p></div>`;
    else rehab = `<div class="card ask pain"><h3>Hoy no hay rehabilitación aparte</h3>${Object.values(S.zones).some((z) => z.phase === 3) ? '<p class="muted small">Los isométricos de mantenimiento van al final del entreno.</p>' : ''}</div>`;
  }
  if (rehabFirst) h += rehab;
  // El entreno del día, como la pizarra del gimnasio: el día en grande y la lista en orden.
  const plan = activePlan(S), day = dayIndex(plan, S.plan.pos), doable = planFor(day).filter((p) => !p.missing);
  const last = S.sessions.find((s) => s.type === 'entreno');
  const doneToday = last?.date === t, trainDay = S.rem.train.includes(weekdayKey(t));
  // Sin entrenos guardados, el día no importa: el primero siempre se presenta en positivo.
  const first = !last, onMsg = first || doneToday || trainDay;
  const firstHint = doable.some((p) => p.calib) ? ' Con la primera serie de cada ejercicio calibramos tus pesos.'
    : doable.some((p) => p.guess) ? ' Los pesos son estimados: con tu primera serie ajustamos el resto.'
    : doable.some((p) => p.pick) ? ' Elegís vos los pesos de cada ejercicio.' : '';
  const dayMsg = first ? `Tu primer entreno.${firstHint}`
    : doneToday ? '✓ Entreno de hoy hecho' : trainDay ? 'Hoy toca entrenar' : 'Hoy es día de descanso, podés entrenar igual';
  // El peso con su unidad, igual que en Entreno; si todavía no es un peso de trabajo, la etiqueta va debajo.
  const load = (p) => p.ex.kind !== 'peso' ? '' : `<span class="load">${loadText(p)}${loadTag(p)}</span>`;
  h += `<section class="card today${onMsg ? ' on' : ''}">
    <p class="plan-line"><span>${esc(plan.name)}</span>${last ? `<span>Último: ${fmtDate(last.date)}</span>` : ''}</p>
    <p class="day-msg">${dayMsg}${S.plan.deload === weekKey(t) ? '. Semana de descarga.' : ''}</p>
    <h3><span class="day-name">${esc(plan.days[day].name)}</span><span class="sep"> · </span><span class="day-count">${doable.length} ejercicios</span></h3>
    <ol class="board">${doable.map((p) => `<li><button data-action="ex-detail" data-ex="${p.ex.id}"><span class="name">${esc(p.ex.name)}${p.r ? `<em>${painTag(p.r)}</em>` : ''}</span><span class="dose">${p.sets} × ${setLabel(p)}</span>${load(p)}</button></li>`).join('')}</ol>
    <button class="cta" data-action="start-workout" data-day="${day}">Empezar ${esc(plan.days[day].name.toLowerCase())}</button></section>`;
  if (S.painMode && hasZones) h += `<button class="sec quick-pain" data-action="quick-pain">Anotar cómo está el dolor ahora</button>`;
  if (!rehabFirst) h += rehab;
  // Avisos y decisiones pendientes, debajo del entreno.
  if (S.painMode) for (const zone of activeZones()) if (phaseReady(S, zone, t)) h += `<div class="card ask pain"><h3>${esc(zoneName(zone))}: lista para avanzar</h3><p class="muted small">Dolor ≤ 3 y sin empeorar toda la semana.</p><button class="link" data-action="phase" data-zone="${zone}" data-dir="1">Pasar a ${esc(PHASES[S.zones[zone].phase + 1].name.toLowerCase())}</button></div>`;
  if (!S.painMode && hasZones && !S.hidePainTip) {
    h += `<div class="card ask pain"><h3>Tenés dolor en ${esc(activeZones().map((z) => zoneName(z).toLowerCase()).join(' y '))}</h3>
      <p class="muted small">El modo dolor agrega isométricos diarios y cuida esas zonas en el entreno. Lo activás vos.</p>
      <div class="btns"><button class="cta pain" data-action="pain-mode-on">Activar modo dolor</button></div>
      <button class="link" data-action="hide-pain-tip">Ahora no</button></div>`;
  }
  const stuck = [...new Set(S.routine[plan.id].flat().map((it) => it.ex))].filter((id) => S.lifts[id] && stalled(S, id));
  if (stuck.length >= 2 && S.plan.deload !== weekKey(t) && S.plan.deloadOffer !== weekKey(t)) h += `<div class="card ask"><h3>¿Semana de descarga?</h3><p class="muted small">${stuck.length} ejercicios no progresan hace 3 sesiones (${stuck.slice(0, 3).map((id) => esc(getEx(id)?.name.toLowerCase() || id)).join(', ')}). Una semana con una serie menos y 90 % del peso suele destrabar.</p><div class="btns"><button class="cta" data-action="deload">Hacer descarga esta semana</button></div><button class="link" data-action="deload-no">Ahora no</button></div>`;
  if (suggestThreeDays(S, t)) h += `<div class="card ask"><h3>¿Pasamos a 3 días por semana?</h3><p class="muted small">Venís constante. Con un día más, el plan rota más rápido.</p><button class="link" data-action="three-days">Sí, 3 días</button></div>`;
  if (S.onboarded && S.seenVersion !== APP_VERSION && S.seenVersion !== '') h += `<div class="card ask"><div class="row"><h3>Novedades de la versión ${APP_VERSION}</h3><button class="link" data-action="news-seen" aria-label="Cerrar">✕</button></div><button class="link" data-action="news">Ver qué cambió</button></div>`;
  h += installCard();
  $('view-home').innerHTML = h;
}

// ——— Entreno ———
let editRoutine = false;
let editDay = 0;   // día visible en el editor de rutina (una pestaña por día)
function renderTrain() {
  const plan = activePlan(S), todayDay = dayIndex(plan, S.plan.pos);
  let h = `<div class="title-row"><h1>Entreno</h1><button class="link" data-action="edit-routine">${editRoutine ? 'Listo' : 'Editar rutina'}</button></div>
    <p class="muted train-sub">${esc(plan.name)}, ${S.profile.days} días por semana: cada ejercicio sube dentro de su rango.</p>`;
  if (!S.profile.weight) h += `<div class="note acc">Completá tu peso en Ajustes para que la app estime cuánto levantar.</div>`;
  if (S.plan.deload === weekKey(today())) h += `<div class="note acc">Semana de descarga: una serie menos y 90 % del peso. <button class="link small" data-action="deload-off">Cancelar</button></div>`;
  if (editRoutine) h += `<div class="note acc">Cambiá, quitá, agregá u ordená ejercicios. Si tenés una máquina que no está, cargala en Ajustes → Equipo y creá tu ejercicio.</div>`;
  if (editRoutine) h += `<div class="chips day-tabs">${plan.days.map((dd, d) => `<button class="chip${d === editDay ? ' on' : ''}" data-action="edit-day" data-day="${d}">${esc(dd.name)}</button>`).join('')}</div>`;
  // Cada día como en la pizarra del inicio: el nombre en grande, el que toca subrayado en lima y con el botón lleno.
  plan.days.forEach((dd, d) => {
    if (editRoutine && d !== editDay) return;
    const items = planFor(d), now = d === todayDay;
    h += `<section class="plan-day${now ? ' now' : ''}"><h2><span class="day-name">${esc(dd.name)}</span>${now ? '<span class="sep"> · </span><span class="day-now">toca hoy</span>' : ''}</h2><ul class="plan-list">`;
    h += items.map((p, i) => `<li class="ex${p.missing ? ' missing' : ''}${editRoutine ? ' editing' : ''}"${editRoutine ? '' : ` data-action="ex-detail" data-ex="${p.ex.id}"`}>
        <div class="thumb">${figureSVG(p.ex, { crop: true })}</div>
        <div class="info"><h3>${esc(p.ex.name)}</h3><p class="dose">${p.missing ? 'Falta equipo' : `${p.sets} × ${setLabel(p)}`}${p.r ? `<em>${painTag(p.r)}</em>` : ''}</p>${p.stalled && !editRoutine ? `<p class="stall">Estancado: <button class="link small" data-action="unstall" data-ex="${p.ex.id}">bajar 10 % y volver a subir</button></p>` : ''}</div>
        ${editRoutine ? `<div class="tools"><button class="move" data-action="routine-move" data-day="${d}" data-i="${i}" data-d="-1" aria-label="Subir" ${i ? '' : 'disabled'}>↑</button><button class="move" data-action="routine-move" data-day="${d}" data-i="${i}" data-d="1" aria-label="Bajar" ${i < items.length - 1 ? '' : 'disabled'}>↓</button>
          <button class="sec" data-action="routine-pick" data-day="${d}" data-i="${i}">Cambiar</button><button class="quiet del" data-action="routine-del" data-day="${d}" data-i="${i}">Quitar</button></div>`
          : `<div class="w">${p.ex.kind === 'peso' ? `${p.w ? `<span class="num">${String(p.w).replace('.', ',')}</span><span class="unit">kg</span>` : `<span class="unit">${loadText(p)}</span>`}${loadTag(p)}` : ''}</div>`}</li>`).join('');
    h += `</ul>`;
    h += editRoutine ? `<button class="sec add-ex" data-action="routine-pick" data-day="${d}">+ Agregar ejercicio</button>`
      : `<button class="cta${now ? '' : ' ghost'}" data-action="start-workout" data-day="${d}" ${items.some((p) => !p.missing) ? '' : 'disabled'}>Empezar ${esc(dd.name)}</button>`;
    h += `</section>`;
  });
  // Lo destructivo y global va al final, lejos de agregar ejercicio.
  if (editRoutine) h += `<div class="routine-reset"><button class="quiet" data-action="routine-reset">Volver al plan original</button></div>`;
  $('view-train').innerHTML = h;
}
function routineSet(day, items) { S.routine[activePlan(S).id][day] = items; persist(); render(); }

// Selector de ejercicios (agregar o cambiar uno de la rutina)
let PK = null;   // { day, i }
function openPicker(day, i) {
  PK = { day: Number(day), i: i === undefined || i === null ? null : Number(i) };
  const item = PK.i != null ? dayItems(PK.day)[PK.i] : null, current = item ? getEx(item.ex) : null;
  const lib = Object.values(EXERCISES).filter((e) => e.cat);
  const row = (e) => {
    const ok = !!implFor(e, S.equip);
    return `<button class="pick${current?.id === e.id ? ' on' : ''}" data-action="pick-ex" data-ex="${e.id}" ${ok ? '' : 'disabled'}><div class="thumb">${figureSVG(e, { animate: false, crop: true })}</div><span><b>${esc(e.name)}</b><br><span class="small muted">${ok ? (e.tag?.length ? 'Exige ' + e.tag.map((z) => zoneName(z).toLowerCase()).join(', ') : 'No carga tendones sensibles') : 'Falta: ' + missingLabel(e)}</span></span></button>`;
  };
  // Al cambiar, primero los ejercicios del mismo hueco; esos ids no se repiten en las categorías.
  const slot = item?.slot ? SLOTS[item.slot] : null;
  const slotIds = new Set(slot ? slot.ex : []);
  let h = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="pickersheet">Cancelar</button><strong>${PK.i != null ? 'Cambiar ejercicio' : `Agregar a ${esc(activePlan(S).days[PK.day].name)}`}</strong><span></span></div>`;
  if (slot) h += `<h2>Mismo movimiento: ${esc(slot.name.toLowerCase())}</h2>${slot.ex.map((id) => row(getEx(id))).join('')}`;
  h += `<h2>Mis ejercicios</h2>${S.exlib.map((c) => `<div class="pick-row">${row(getEx(c.id))}<button class="link" data-action="exform" data-id="${c.id}">Editar</button></div>`).join('')}
    <button class="sec" style="width:100%" data-action="exform">+ Crear ejercicio propio</button>`;
  for (const [c, name] of Object.entries(CATS)) {
    const inCat = lib.filter((e) => e.cat === c && !slotIds.has(e.id));
    if (inCat.length) h += `<h2>${esc(name)}</h2>${inCat.map(row).join('')}`;
  }
  dlg('pickersheet').html = h + '</div>';
  if (!$('pickersheet').open) $('pickersheet').showModal();
}
function missingLabel(e) {
  const miss = (e.needs || []).filter((n) => !S.equip[n]).map((n) => EQUIP_NAMES[n]);
  if (!miss.length) miss.push(e.impl?.startsWith('m:') ? 'la máquina' : EQUIP_NAMES[e.impl] || e.impl);
  return miss.join(', ');
}
function pickExercise(id) {
  const items = [...dayItems(PK.day)], swap = PK.i != null;
  // Lo que elige el usuario queda fijado; el cambio conserva el hueco para poder re-resolverlo.
  if (swap) items[PK.i] = { ...items[PK.i], ex: id, pinned: true }; else items.push({ slot: slotOf(id), ex: id, pinned: true });
  $('pickersheet').close(); routineSet(PK.day, items); PK = null;
  toast(swap ? 'Ejercicio cambiado.' : 'Ejercicio agregado.');
}

// Ejercicio propio (cualquier equipo, incluidas las máquinas que cargues)
let XF = null;   // borrador del formulario
function openExForm(id) {
  const c = S.exlib.find((x) => x.id === id) || { id: '', name: '', kind: 'peso', impl: S.equip.db ? 'db' : 'bw', tag: [], cat: 'empuje', start: '', note: '' };
  XF = { ...c, tag: [...(c.tag || [])] };
  renderExForm();
  if (!$('exformsheet').open) $('exformsheet').showModal();
}
function implOptions() {
  const e = S.equip, o = [];
  if (e.db) o.push(['db', 'Mancuernas']);
  if (e.kb?.length) o.push(['kb', 'Pesa rusa']);
  if (e.band) o.push(['band', 'Banda elástica']);
  for (const m of e.machines || []) o.push(['m:' + m.id, m.name]);
  o.push(['bw', 'Peso corporal']);
  return o;
}
function renderExForm() {
  const c = XF;
  dlg('exformsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="exformsheet">Cancelar</button><strong>${c.id ? 'Editar' : 'Nuevo'} ejercicio</strong><button class="link" data-action="exform-save">Guardar</button></div>
    <label class="field"><span>Nombre</span><input id="x-name" value="${esc(c.name)}" placeholder="Ej.: Prensa de piernas"></label>
    <label class="field"><span>Con qué se hace</span><select id="x-impl">${implOptions().map(([v, n]) => `<option value="${esc(v)}" ${c.impl === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <p class="faint small">¿Tu máquina no aparece? Agregala en Ajustes → Equipo → Máquinas.</p>
    <span class="small muted">Cómo se registra</span><div class="chips" style="margin:4px 0 8px">${[['peso', 'Kilos × reps'], ['reps', 'Solo reps'], ['tiempo', 'Segundos']].map(([k, n]) => `<button class="chip${c.kind === k ? ' on' : ''}" data-action="xf-kind" data-v="${k}">${n}</button>`).join('')}</div>
    ${c.kind === 'peso' ? `<label class="field"><span>Peso para empezar (kg, opcional: se ajusta con la primera serie)</span><input id="x-start" type="number" inputmode="decimal" step="0.5" value="${esc(c.start || '')}"></label>` : ''}
    <label class="field"><span>Grupo</span><select id="x-cat">${Object.entries(CATS).map(([k, n]) => `<option value="${k}" ${c.cat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <span class="small muted">Tendones que exige (para el modo dolor)</span><div class="chips" style="margin-top:4px">${ZONES.map((z) => `<button class="chip pain${c.tag.includes(z.id) ? ' on' : ''}" data-action="xf-tag" data-v="${z.id}">${esc(z.name)}</button>`).join('')}</div>
    <label class="field"><span>Nota o indicaciones</span><textarea id="x-note" rows="2">${esc(c.note)}</textarea></label>
    ${c.id ? '<button class="link danger" data-action="exform-del">Eliminar ejercicio</button>' : ''}</div>`;
}
function readExForm() { XF.name = $('x-name').value; XF.impl = $('x-impl').value; XF.cat = $('x-cat').value; XF.note = $('x-note').value; if ($('x-start')) XF.start = $('x-start').value; }
function saveExForm() {
  readExForm();
  const name = XF.name.trim(); if (!name) return toast('Poné un nombre.');
  const c = { id: XF.id || 'c_' + uid(), name, kind: XF.kind, impl: XF.impl, cat: XF.cat, tag: XF.tag, start: Number(XF.start) || 0, note: XF.note.trim() };
  const i = S.exlib.findIndex((x) => x.id === c.id), isNew = i < 0;
  isNew ? S.exlib.push(c) : (S.exlib[i] = c);
  $('exformsheet').close();
  if (isNew && PK && $('pickersheet').open) return pickExercise(c.id);
  persist(); if ($('pickersheet').open) openPicker(PK.day, PK.i); render();
  toast('Ejercicio guardado.');
}
function deleteExForm() {
  if (!confirm('¿Eliminar este ejercicio? Se quita también de la rutina.')) return;
  S.exlib = S.exlib.filter((x) => x.id !== XF.id);
  for (const days of Object.values(S.routine)) days.forEach((items, d) => { days[d] = items.filter((it) => it.ex !== XF.id); });
  $('exformsheet').close(); persist(); if ($('pickersheet').open) openPicker(PK.day, PK.i); render();
}

// Máquinas propias: nombre y rango de peso (mínimo, máximo, salto)
function openMachine(id) {
  const m = S.equip.machines.find((x) => x.id === id) || { id: '', name: '', min: 5, max: 100, step: 5 };
  dlg('machsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="machsheet">Cancelar</button><strong>${m.id ? 'Editar' : 'Nueva'} máquina</strong><button class="link" data-action="mach-save" data-id="${m.id}">Guardar</button></div>
    <label class="field"><span>Nombre</span><input id="m-name" value="${esc(m.name)}" placeholder="Ej.: Polea, Prensa, Barra con discos"></label>
    <div class="grid2" style="grid-template-columns:1fr 1fr 1fr"><label class="field"><span>Mínimo (kg)</span><input id="m-min" type="number" inputmode="decimal" step="0.5" value="${m.min}"></label>
    <label class="field"><span>Máximo (kg)</span><input id="m-max" type="number" inputmode="decimal" step="0.5" value="${m.max}"></label>
    <label class="field"><span>Salto (kg)</span><input id="m-step" type="number" inputmode="decimal" step="0.25" value="${m.step}"></label></div>
    <p class="faint small">La app redondea los pesos sugeridos a estos saltos. Después creá tus ejercicios con esta máquina desde Entreno → Editar rutina.</p>
    ${m.id ? `<button class="link danger" data-action="mach-del" data-id="${m.id}">Eliminar máquina</button>` : ''}</div>`;
  if (!$('machsheet').open) $('machsheet').showModal();
}
function saveMachine(id) {
  const num = (k) => Number(String($(k).value).replace(',', '.'));
  const m = { id: id || uid(), name: $('m-name').value.trim(), min: num('m-min'), max: num('m-max'), step: num('m-step') };
  if (!m.name) return toast('Poné un nombre.');
  if (!(m.step > 0) || !(m.max >= m.min) || m.min < 0) return toast('Revisá el rango: mínimo ≤ máximo y salto mayor a 0.');
  const i = S.equip.machines.findIndex((x) => x.id === m.id);
  i >= 0 ? (S.equip.machines[i] = m) : S.equip.machines.push(m);
  persist(); $('machsheet').close(); $('onb').open ? renderOnb() : render();
  toast(i >= 0 ? 'Máquina actualizada.' : 'Máquina agregada. Creá tu ejercicio en Entreno → Editar rutina.');
}

function setLabel(p) {
  if (!hasRepRange(p.ex)) return `${p.secs} s`;
  return `${p.range[0]}–${p.range[1]} reps`;
}
function openExercise(id) {
  const ex = getEx(id), lift = S.lifts[id];
  const hist = weightHistory(id);
  dlg('exsheet').html = `<div class="dlg"><div class="dlg-head"><strong>${esc(ex.name)}</strong><button class="link" data-action="close" data-dlg="exsheet">Cerrar</button></div>
    <div class="hero-fig">${figureSVG(ex)}</div>
    <ul class="muted">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    ${ex.mus?.length ? `<p class="small"><span class="mus-dot"></span>Trabaja: ${ex.mus.map((m) => MUSCLE_NAMES[m]).join(', ')}</p>` : ''}
    ${ex.tag?.length ? `<p class="small muted">Cuidado si te duele: ${ex.tag.map((z) => zoneName(z).toLowerCase()).join(', ')}.</p>` : ''}
    ${ex.kind === 'peso' && !lift ? `<p class="small">${{
      calib: `${CALIB_TAG} Todavía no tiene peso de trabajo: en la primera serie hacés reps hasta que te queden 2 y con eso lo calculamos.`,
      auto: `${GUESS_TAG} Todavía no tiene peso de trabajo: el que ves sale de tu perfil y de lo que levantaste en otros ejercicios. La primera serie que anotes lo fija.`,
      manual: 'Todavía no tiene peso de trabajo: el que uses la primera vez queda guardado.' }[weightMode()]}</p>` : ''}
    ${lift ? `<p>Peso de trabajo: <b class="num">${fmtKg(lift.w)}</b></p>${lift.e1rm ? `<p class="small muted">Lo máximo que podrías levantar una vez, estimado: ${lift.e1rm} kg.</p>` : ''}` : ''}
    ${hist.length > 1 ? `<h2>Progreso</h2>${lineChart(hist, { unit: 'kg', color: 'var(--acc)' })}` : ''}
    ${lift ? `<button class="link danger" data-action="recalibrate" data-ex="${id}">${weightMode() === 'calib' ? 'Volver a calibrar' : 'Borrar peso de trabajo'}</button>` : ''}</div>`;
  $('exsheet').showModal(); calmMotion($('exsheet'));
}

// Sesión de entreno en curso
let W = null;   // { plan, day, dayName, items, started, warm, off, out }
function startWorkout(day) {
  const items = [...planFor(day).filter((p) => !p.missing), ...maintenanceItems()].map((p) => ({
    ...p, rows: Array.from({ length: p.sets }, () => ({ w: p.pick ? '' : p.w || 0, reps: '', rir: '', secs: p.secs || '', done: false })),
  }));
  // Entrada en calor: movilidad, un isométrico por zona sensible (calma el dolor antes de cargar) y series de aproximación.
  const first = items.find((p) => p.ex.kind === 'peso' && p.w > 0);
  const warm = [{ txt: 'Movilidad 3–5 min: círculos de hombros, muñecas y cadera, sentadillas sin peso.' }];
  if (S.painMode) for (const [zone, z] of Object.entries(S.zones)) if (z.phase < 3) warm.push({ txt: `Isométrico de ${zoneName(zone).toLowerCase()}: 1 × 30–45 s (${rehabEx(zone, 1).name.toLowerCase()}). Suele bajar el dolor para entrenar.` });
  if (first) for (const x of warmupSets(first.w, first.steps)) warm.push({ txt: `${first.ex.name}: ${x.reps} reps con ${fmtKg(x.w)} (aproximación, no cuenta).` });
  W = { plan: activePlan(S).id, day, dayName: activePlan(S).days[day].name, items, started: Date.now(), warm: warm.map((x) => ({ ...x, done: false })), off: [], out: [] };
  // Qué es el RIR: abierto en el primer ejercicio con peso del primer entreno; después, al tocar la columna.
  W.rirHelp = S.sessions.some((s) => s.type === 'entreno') ? -1 : items.findIndex((p) => p.ex.kind === 'peso');
  // Con 2 o más ejercicios sin peso de trabajo, la explicación va una vez arriba y cada ejercicio lleva solo la etiqueta.
  W.calibIntro = items.filter((p) => p.calib).length >= 2;
  W.guessIntro = items.filter((p) => p.guess || p.pick).length >= 2;
  renderWorkout(); $('wsheet').showModal(); calmMotion($('wsheet')); keepAwake(true);
}
function renderWorkout() {
  // El ejercicio en curso es el primero con series pendientes; su primera serie pendiente es la que sigue.
  // Mientras falte la entrada en calor y no haya series hechas, el foco está en ella y no en el primer ejercicio.
  const warmNow = W.warm?.some((x) => !x.done) && !W.items.some((it) => it.rows.some((r) => r.done));
  const cur = warmNow ? -1 : W.items.findIndex((it) => it.rows.some((r) => !r.done));
  const total = W.items.reduce((n, it) => n + it.rows.length, 0), done = W.items.reduce((n, it) => n + it.rows.filter((r) => r.done).length, 0);
  const track = W.items.map((it) => `<i style="flex:${it.rows.length}"><b style="width:${(100 * it.rows.filter((r) => r.done).length) / it.rows.length}%"></b></i>`).join('');
  const body = W.items.map((it, i) => {
    const k = it.ex.kind, timed = k === 'tiempo' || k === 'iso', weighted = k === 'peso' || (k === 'iso' && it.w);
    const notes = [];
    if (it.calib && !W.calibIntro) notes.push(`<div class="note acc">Serie de calibración: con ${fmtKg(it.w)} hacé reps hasta que sientas que te salen solo 2 más, y frená ahí (eso es RIR 2). Anotá las reps y el RIR: con eso calculamos tu peso real.</div>`);
    if (it.pick && !W.guessIntro) notes.push(`<div class="note acc">Elegí el peso y anotalo en la primera serie: la próxima vez arranca con ese.</div>`);
    if (it.r?.mode === 'cap') notes.push(`<div class="note pain">Más liviano ${forZones(it.r)}: ${fmtKg(it.w)}${it.w < it.base ? ` en vez de ${fmtKg(it.base)}` : ', el peso más bajo que tenés'}.</div>`);
    if (it.r?.mode === 'alt') notes.push(`<div class="note pain">Variante ${forZones(it.r)}: hoy va ${esc(it.ex.name.toLowerCase())} en vez de ${esc(it.orig.name.toLowerCase())}.</div>`);
    if (it.maint) notes.push(`<div class="note pain">Mantenimiento de ${esc(zoneName(it.maint).toLowerCase())} (fase 3).</div>`);
    if (it.from) notes.push(`<div class="note">Solo por hoy: en vez de ${esc(getEx(it.from).name.toLowerCase())}.</div>`);
    const rirOpen = k === 'peso' && W.rirHelp === i;
    const head = `<div class="set head"><span>Serie</span><span>${weighted ? 'kg' : ''}</span><span>${timed ? 'seg' : 'reps'}</span>${k === 'peso' ? `<button class="rir-help" data-action="rir-help" data-i="${i}" aria-expanded="${rirOpen}">RIR <b aria-hidden="true">?</b><span class="sr">: qué es</span></button>` : '<span></span>'}<span></span></div>`
      + (rirOpen ? `<div class="note rir-note"><b>RIR</b> son las repeticiones que te quedaban al terminar la serie: cuántas más te salían bien. <b>0</b>: no podías ni una más. <b>2</b>: te quedaban 2. Con esto la app calcula tu peso y tus récords.</div>` : '');
    const next = i === cur ? it.rows.findIndex((r) => !r.done) : -1;
    const rows = it.rows.map((r, j) => `<div class="set${r.done ? ' done' : ''}${j === next ? ' next' : ''}">
      <span class="n">${j + 1}</span>
      ${weighted ? `<input type="number" inputmode="decimal" step="0.5" min="0" value="${r.w}" data-w="${i}.${j}.w" aria-label="Kilos">` : '<span></span>'}
      <input type="number" inputmode="numeric" min="0" value="${timed ? r.secs : r.reps}" placeholder="≈${hasRepRange(it.ex) ? repCenter(it.range) : it.secs}" data-w="${i}.${j}.${timed ? 'secs' : 'reps'}" aria-label="${timed ? 'Segundos' : 'Repeticiones'}">
      ${k === 'peso' ? `<select data-w="${i}.${j}.rir" aria-label="Repeticiones en reserva"><option value="">–</option>${[0, 1, 2, 3, 4].map((n) => `<option ${String(r.rir) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>` : '<span></span>'}
      <button class="ok" data-action="set-done" data-i="${i}" data-j="${j}" aria-label="Serie hecha">✓</button></div>`).join('');
    const state = it.rows.every((r) => r.done) ? ' done' : i === cur ? ' now' : '';
    return `<section class="card wex${it.r || it.maint ? ' pain' : ''}${state}"><div class="ex">
      <span class="wex-n" aria-hidden="true">${it.rows.every((r) => r.done) ? '✓' : i + 1}</span>
      <div class="info"><h3>${esc(it.ex.name)}</h3><p class="target"><span>${it.sets} × ${setLabel(it)}</span>${it.pick ? '<b>a elegir</b>' : ''}${loadTag(it)}</p>${it.impl === 'db' && it.w && platesFor(S.equip, it.w) ? `<p class="plates">Por lado: ${platesLabel(it.w)}</p>` : ''}</div>
      <div class="thumb" data-action="ex-detail" data-ex="${it.ex.id}" title="Ver en grande">${figureSVG(it.ex, { crop: true })}</div></div>
      ${notes.join('')}<div class="cues-row"><details class="cues"><summary>Cómo se hace</summary><ul>${it.ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>
      ${it.maint || it.rows.some((r) => r.done) ? '' : `<button class="swap-link" data-action="swap-today" data-i="${i}">Cambiar por hoy</button>`}</div>
      <div class="sets">${head}${rows}</div></section>`;
  }).join('');
  const warm = W.warm?.length ? `<details class="card warm${warmNow ? ' now' : ''}" ${W.warm.every((x) => x.done) ? '' : 'open'}><summary><h3>Entrada en calor</h3><span class="muted small">${W.warm.filter((x) => x.done).length} de ${W.warm.length}</span></summary>
    ${W.warm.map((x, i) => `<button class="warm-item${x.done ? ' on' : ''}${warmNow && i === W.warm.findIndex((y) => !y.done) ? ' next' : ''}" data-action="warm" data-i="${i}"><span class="box">${x.done ? '✓' : ''}</span><span>${esc(x.txt)}</span></button>`).join('')}</details>` : '';
  const calib = W.calibIntro && W.items.some((it) => it.calib) ? `<section class="card calib-intro"><h3>Hoy calibramos tus pesos</h3>
    <p>En la primera serie de cada ejercicio con <span class="nowrap"><span class="calib-tag">calibración</span>,</span> hacé reps hasta que sientas que te salen solo 2 más y frená ahí. Anotá las reps y el RIR: con eso calculamos tu peso de trabajo.</p>
    <p class="muted small">El peso que ves es un punto de partida.</p></section>`
    : W.guessIntro && W.items.some((it) => it.guess) ? `<section class="card calib-intro"><h3>Pesos estimados</h3>
    <p>Los pesos con <span class="nowrap"><span class="calib-tag">estimado</span></span> salen de tu perfil. Si te queda liviano o pesado, cambialo en la serie: con lo que anotes ajustamos los demás ejercicios.</p></section>`
    : W.guessIntro && W.items.some((it) => it.pick) ? `<section class="card calib-intro"><h3>Elegís vos los pesos</h3>
    <p>Anotá el peso que uses en cada serie. La próxima vez cada ejercicio arranca con el último que usaste.</p></section>` : '';
  dlg('wsheet').html = `<div class="dlg"><div class="dlg-head w-head"><button class="link danger" data-action="cancel-workout">Salir</button><div class="w-title"><strong>${esc(W.dayName)}</strong><span class="w-count">${done} de ${total} series</span></div><button class="link" data-action="finish-workout">Terminar</button>
      <div class="w-track" role="progressbar" aria-label="Series hechas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">${track}</div></div>${warm}${calib}${body}
    <button class="cta" data-action="finish-workout">Terminar entreno</button></div>`;
}
function setDone(i, j) {
  const it = W.items[i], r = it.rows[j], k = it.ex.kind;
  if (!r.done) {
    if ((k === 'peso' || k === 'reps') && !(Number(r.reps) > 0)) return toast('Anotá las repeticiones que hiciste.');
    if (k === 'peso' && it.pick && !(Number(r.w) > 0)) return toast('Anotá el peso que usaste.');
    if ((k === 'tiempo' || k === 'iso') && !(Number(r.secs) > 0)) r.secs = it.secs;
  }
  r.done = !r.done;
  if (r.done && it.calib && j === 0 && k === 'peso') {
    if (r.rir === '') { r.done = false; return toast('Elegí cuántas reps te quedaban (RIR).'); }
    const c = calibrate(Number(r.w), Number(r.reps), Number(r.rir), it.steps, it.range);
    S.lifts[it.ex.id] = { w: c.w, e1rm: c.e1rm };
    it.calib = false; it.calibrated = true; it.base = c.w;
    it.w = it.r ? painCap(c.w, it.steps) : c.w;
    it.rows.slice(1).forEach((x) => { if (!x.done) x.w = it.w; });
    persist();
    toast(`Calibrado: tu peso de trabajo es ${fmtKg(c.w)}${it.r ? ` (hoy ${fmtKg(it.w)} por modo dolor)` : ''}.`);
  }
  // Automático y manual: la primera serie anotada fija el peso de trabajo; en automático, además ajusta a los que siguen.
  if (r.done && (it.guess || it.pick) && k === 'peso' && Number(r.w) > 0) {
    // Con tope por dolor la serie va más liviana: el peso de trabajo no baja por eso.
    const w = Number(r.w), base = it.r ? Math.max(it.base || 0, w) : w;
    S.lifts[it.ex.id] = { w: base, e1rm: Math.round(epley1RM(w, Number(r.reps) + (Number(r.rir) || 0)) * 10) / 10 };
    // Las series que siguen pasan al peso anotado, salvo las que la persona ya cambió a mano.
    it.rows.forEach((x) => { if (!x.done && (!(Number(x.w) > 0) || Number(x.w) === it.w)) x.w = w; });
    it.guess = it.pick = false; it.first = true; it.base = base; it.w = w;
    persist();
    const n = weightMode() === 'auto' ? retuneGuesses() : 0;
    if (n) toast(`Con esta serie ajustamos el peso de ${n === 1 ? '1 ejercicio' : `${n} ejercicios`} que siguen.`);
  }
  renderWorkout();
  if (r.done && it.rows.some((x) => !x.done)) startRest(k === 'iso' ? ISO_REST : S.prefs.rest || REST_SECS);
}
// Re-estima los ejercicios del entreno que siguen sin peso propio ni series hechas; respeta el peso que la persona ya cambió.
// Devuelve cuántos cambiaron.
function retuneGuesses() {
  let n = 0;
  for (const it of W.items) {
    if (!it.guess || !it.ex.ratio || it.rows.some((x) => x.done)) continue;
    const base = guessFor(it.ex, it.steps, it.range), capped = it.r ? painCap(base, it.steps) : base;
    const w = it.deload ? roundDown(it.steps, capped * 0.9) : capped;
    if (w === it.w) continue;
    it.rows.forEach((x) => { if (Number(x.w) === it.w) x.w = w; });
    it.base = base; it.w = w; n++;
  }
  return n;
}
// "Hoy no puedo": el ejercicio se cambia solo en esta sesión por otro del mismo hueco; la rutina no se toca.
const EQUIP_NAMES = { bench: 'banco', bar: 'barra de dominadas', band: 'bandas', rings: 'aros', db: 'mancuernas', kb: 'pesas rusas' };
const equipName = (k) => (k.startsWith('m:') ? S.equip.machines.find((m) => 'm:' + m.id === k)?.name || 'la máquina' : EQUIP_NAMES[k]);
function openSwapToday(i) {
  const it = W.items[i], keys = equipUsed(it.ex, withoutEquip(S.equip, W.off));
  const opt = (off, txt) => `<button class="sec" style="width:100%" data-action="swap-why" data-i="${i}" data-off="${off}">${esc(txt)}</button>`;
  dlg('swapsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="swapsheet">Cancelar</button><strong>Cambiar por hoy</strong><span></span></div>
    <p class="muted">${esc(it.ex.name)}: ¿qué pasa? Lo cambiamos solo por hoy, tu rutina queda igual.</p>
    ${it.slot && SLOTS[it.slot] ? keys.map((k) => opt(k, `Hoy no puedo usar ${equipName(k)}`)).join('') + opt('', 'Otro motivo: dame otro ejercicio') : ''}
    <button class="link danger" data-action="swap-why" data-i="${i}" data-off="skip">Saltear este ejercicio</button></div>`;
  $('swapsheet').showModal();
}
function swapToday(i, off) {
  $('swapsheet').close();
  const target = W.items[i], name = target.ex.name;
  if (off === 'skip') { W.items.splice(i, 1); renderWorkout(); return toast(`Hoy sin ${name.toLowerCase()}.`); }
  if (off) W.off.push(off); else W.out.push(target.ex.id, target.orig?.id);
  const equip = withoutEquip(S.equip, W.off), opts = engineOpts();
  const changed = [], skipped = [];
  // Lo que ya tiene series hechas queda; el resto que no se puede hoy (o el elegido) se re-resuelve en su hueco.
  W.items = W.items.flatMap((it, j) => {
    const redo = j === i || (!it.maint && !it.rows.some((r) => r.done) && !implFor(it.ex, equip));
    if (!redo) return [it];
    const others = W.items.filter((_, k) => k !== j).map((x) => x.ex.id);
    const to = SLOTS[it.slot] ? resolveSlot(it.slot, equip, { ...opts, exclude: [...others, ...W.out] }) : null;
    const next = to && planItem(W.day, { slot: it.slot, ex: to }, equip);
    if (!next || next.missing) { skipped.push(it.ex.name); return []; }
    changed.push(next.ex.name);
    return [{ ...next, from: it.from || it.orig?.id || it.ex.id, rows: Array.from({ length: next.sets }, () => ({ w: next.w || 0, reps: '', rir: '', secs: next.secs || '', done: false })) }];
  });
  renderWorkout();
  const lower = (xs) => xs.map((x) => x.toLowerCase()).join(', ');
  toast([changed.length ? `Hoy va ${lower(changed)}${changed.length === 1 ? ` en vez de ${name.toLowerCase()}` : ''}.` : '', skipped.length ? `Sin opción con lo que tenés hoy: se saltea ${lower(skipped)}.` : ''].filter(Boolean).join(' '));
}
function finishWorkout() {
  const items = W.items.map((it) => ({ ex: it.ex.id, name: it.ex.name, from: it.from, reps: hasRepRange(it.ex) ? it.range : undefined, maint: it.maint || undefined, capped: !!it.r || !!it.deload, sets: it.rows.filter((r) => r.done).map((r) => ({ w: Number(r.w) || 0, reps: Number(r.reps) || 0, rir: r.rir === '' ? null : Number(r.rir), secs: Number(r.secs) || 0 })) }))
    .filter((x) => x.sets.length);
  if (!items.length) return toast('Marcá al menos una serie como hecha.');
  const prs = [], ups = [];
  for (const it of W.items) {
    const sets = it.rows.filter((r) => r.done);
    if (!sets.length) continue;
    if (it.ex.kind === 'peso' && S.lifts[it.ex.id]) {
      const lift = S.lifts[it.ex.id], prev = it.calibrated || it.first ? 0 : lift.e1rm || 0, w0 = lift.w, manual = weightMode() === 'manual';
      const best = Math.max(...sets.map((s) => epley1RM(Number(s.w), Number(s.reps) + (Number(s.rir) || 0))));
      if (prev && best > prev + 0.05) prs.push({ name: it.ex.name, val: `${Math.round(best * 10) / 10} kg (1RM estimado)` });
      lift.e1rm = Math.round(Math.max(lift.e1rm || 0, best) * 10) / 10;
      // Con tope por dolor o recién calibrado no se progresa: el peso de trabajo ya quedó definido.
      // En manual no se sugieren subidas: queda el último peso que usó.
      if (manual) lift.w = Number(sets.at(-1).w) || lift.w;
      else if (!it.r && !it.calibrated && !it.deload) lift.w = progress(lift.w, sets.map((s) => ({ reps: Number(s.reps) })), it.steps, it.range);
      if (lift.w !== w0 && !manual) ups.push({ ex: it.ex.id, name: it.ex.name, from: w0, to: lift.w });
    }
    if (it.ex.kind === 'reps') {
      const l = (S.lifts[it.ex.id] ||= { bestReps: 0 }), top = Math.max(...sets.map((s) => Number(s.reps) || 0));
      if (l.bestReps && top > l.bestReps) prs.push({ name: it.ex.name, val: `${top} repeticiones` });
      l.bestReps = Math.max(l.bestReps || 0, top);
    }
    if (it.ex.kind === 'tiempo') { const l = (S.lifts[it.ex.id] ||= { secs: 30 }); if (sets.every((s) => Number(s.secs) >= l.secs)) l.secs = Math.min(90, l.secs + 5); }
  }
  const session = { id: uid(), date: today(), type: 'entreno', plan: W.plan, day: W.day, tpl: String.fromCharCode(65 + W.day), items };
  Object.assign(session, sessionSummary(session, Date.now() - W.started), { prs, ups });
  const zones = [...new Set(W.items.flatMap((it) => (it.r ? it.r.zones : it.maint ? [it.maint] : [])))];
  S.plan.pos = nextDay(activePlan(S), W.day);   // desde el día hecho, no desde la posición guardada
  stopRest(); W = null; $('wsheet').close(); keepAwake(false);
  if (S.painMode && zones.length) askPain(session, zones);
  else saveSession(session);
}
function saveSession(session) {
  S.sessions.unshift(session); persist(); render();
  if (session.type === 'entreno') return showSummary(session);
  toast(session.type === 'dolor' ? 'Dolor anotado.' : 'Rehabilitación guardada.');
}
// Pantalla de cierre del entreno: números grandes, récords y lo que sube la próxima vez.
function showSummary(s) {
  const st = streak(S, today()), plan = activePlan(S);
  // Con peso sin cambios: le decimos en qué repeticiones sube (el tope del rango guardado en la sesión).
  const holds = weightMode() === 'manual' ? [] : unchangedWeightItems(s, (id) => getEx(id)?.kind === 'peso');
  dlg('sumsheet').html = `<div class="dlg"><div class="dlg-head"><strong>¡${esc(plan.days[s.day]?.name ?? `Entreno ${s.tpl}`)} hecho! 💪</strong><button class="link" data-action="close" data-dlg="sumsheet">Listo</button></div>
    <div class="stats"><div><span class="big num">${s.min}</span><span class="muted small">minutos</span></div><div><span class="big num">${s.sets}</span><span class="muted small">series</span></div><div><span class="big num">${s.vol >= 1000 ? (s.vol / 1000).toFixed(1).replace('.', ',') + 'k' : s.vol}</span><span class="muted small">kg × reps</span></div></div>
    ${st ? `<p class="streak">🔥 ${st} ${st === 1 ? 'semana cumplida' : 'semanas seguidas cumpliendo'}</p>` : ''}
    ${s.prs?.length ? `<h2>Récords</h2>${s.prs.map((p) => `<div class="row"><span>🏆 ${esc(p.name)}</span><b class="num">${esc(p.val)}</b></div>`).join('')}` : ''}
    ${s.ups?.length ? `<h2>La próxima vez</h2>${s.ups.map((u) => `<div class="row"><span>${esc(u.name)}</span><b class="num" style="color:${u.to > u.from ? 'var(--acc-fg)' : 'var(--pain-fg)'}">${fmtKg(u.from)} → ${fmtKg(u.to)}</b></div>`).join('')}` : ''}
    ${holds.length ? `<h2>Mismo peso la próxima</h2>${holds.map((x) => `<div class="row"><span>${esc(x.name)}</span><span class="muted small">cuando hagas ${x.reps[1]} en todas, sube</span></div>`).join('')}` : ''}
    <p class="muted small" style="margin-top:14px">Próximo: ${esc(plan.days[S.plan.pos].name)}.</p></div>`;
  $('sumsheet').showModal();
}

// Descanso entre series
let restTimer = null;
function startRest(secs) {
  stopRest();
  const el = $('rest'), end = Date.now() + secs * 1000;
  overlayHost().appendChild(el); el.hidden = false;
  let last = secs;
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    $('rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left !== last && left > 0 && left <= 3) cue('tick');
    last = left;
    if (!left) { stopRest(); cue('go', 'Siguiente serie'); }
  };
  tick(); restTimer = setInterval(tick, 250);
}
function stopRest() { clearInterval(restTimer); restTimer = null; $('rest').hidden = true; }

// ——— Sonidos, voz y pantalla prendida ———
let audioCtx = null;
// kind: 'tick' (cuenta final), 'go' (empezar), 'done' (terminar); text: lo que dice la voz si está activada.
function cue(kind, text) {
  if (kind) navigator.vibrate?.(kind === 'tick' ? 40 : kind === 'done' ? [180, 80, 180] : 120);
  if (S.prefs.sound && kind) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const notes = { tick: [[660, 0.07]], go: [[880, 0.12]], done: [[880, 0.1], [1175, 0.16]] }[kind];
      let t = audioCtx.currentTime;
      for (const [f, d] of notes) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.04;
      }
    } catch {}
  }
  if (S.prefs.voice && text && 'speechSynthesis' in window) {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'es-AR'; u.rate = 1.05; speechSynthesis.speak(u); } catch {}
  }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

// ——— Novedades (CHANGELOG.md) ———
function mdLite(md) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  let html = '', list = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^- /.test(line)) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.slice(2))}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (/^## /.test(line)) html += `<h2>${inline(line.slice(3))}</h2>`;
    else if (line.trim() && !/^# /.test(line)) html += `<p class="muted">${inline(line)}</p>`;
  }
  return html + (list ? '</ul>' : '');
}
async function openNews() {
  let md = '';
  try { md = await (await fetch('CHANGELOG.md', { cache: 'no-cache' })).text(); } catch { md = 'No se pudieron cargar las novedades sin conexión.'; }
  dlg('newssheet').html = `<div class="dlg news"><div class="dlg-head"><strong>Novedades</strong><button class="link" data-action="close" data-dlg="newssheet">Cerrar</button></div>${mdLite(md)}</div>`;
  if (!$('newssheet').open) $('newssheet').showModal();
  if (S.seenVersion !== APP_VERSION) { S.seenVersion = APP_VERSION; persist(); render(); }
}

// ——— Sesión de rehabilitación ———
let R = null;   // { slot, items, idx, set, phase: 'listo'|'hold'|'rest', end, timer }
function startRehab() {
  const items = rehabItems().map((it) => ({ ...it, done: 0 }));
  const custom = S.custom.filter((c) => !c.zone || S.zones[c.zone]).map((c) => ({ custom: c, done: false }));
  R = { slot: slotNow(), items, custom, idx: 0, state: 'listo' };
  renderRehab(); $('rsheet').showModal(); calmMotion($('rsheet')); keepAwake(true);
}
function renderRehab() {
  const it = R.items[R.idx];
  let main = '';
  if (it) {
    const iso = it.ex.kind === 'iso';
    const total = R.state === 'rest' ? ISO_REST : it.secs;
    const left = R.left ?? total;
    const C = 2 * Math.PI * 100;
    main = `<p class="small">Ejercicio ${R.idx + 1} de ${R.items.length} para tu ${esc(zoneName(it.zone).toLowerCase())}</p><p class="muted small">${esc(PHASES[S.zones[it.zone].phase].name)}</p>
      <h1 style="font-size:28px">${esc(it.ex.name)}</h1>
      <div class="hero-fig">${figureSVG(it.ex)}</div>
      <p class="num" style="text-align:center;font-size:20px">${iso ? `${it.sets} × ${it.secs} s` : `${it.sets} × ${it.reps} reps (3 s subir, 3 s bajar)`}${it.w ? ` con ${fmtKg(it.w)}` : ''}</p>
      ${iso ? `<div class="timer${R.state === 'rest' ? ' resting' : ''}"><svg viewBox="0 0 220 220"><circle class="track" cx="110" cy="110" r="100"/><circle class="bar" cx="110" cy="110" r="100" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - left / total)}"/></svg>
        <div class="label"><div><div class="big num" id="r-left">${left}</div><div class="muted">${R.state === 'rest' ? 'descanso' : R.state === 'hold' ? 'sostené' : `serie ${it.done + 1} de ${it.sets}`}</div></div></div></div>
        <button class="cta pain" data-action="${R.state === 'listo' ? 'rehab-go' : 'rehab-skip'}">${R.state === 'listo' ? `Empezar serie ${it.done + 1}` : R.state === 'hold' ? 'Terminar serie' : 'Saltar descanso'}</button>`
      : `<div class="chips" style="justify-content:center;margin:12px 0">${Array.from({ length: it.sets }, (_, s) => `<button class="chip${s < it.done ? ' on' : ''}" data-action="lento-set" data-s="${s}">Serie ${s + 1}</button>`).join('')}</div>
        <button class="cta pain" data-action="rehab-next" ${it.done < it.sets ? 'disabled' : ''}>Siguiente</button>`}
      <details class="cues"><summary>Cómo se hace</summary><ul>${it.ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>`;
  } else {
    main = `<h1 style="font-size:28px">${R.custom.length ? 'Tus ejercicios del fisio' : '¡Listo!'}</h1>
      ${R.custom.map((c, i) => `<div class="card"><div class="row"><div><h3>${esc(c.custom.name)}</h3><p class="muted small">${c.custom.sets} × ${c.custom.value} ${c.custom.mode === 'segundos' ? 's' : 'reps'}${c.custom.zone ? ` para tu ${esc(zoneName(c.custom.zone).toLowerCase())}` : ''}</p>${c.custom.note ? `<p class="small">${esc(c.custom.note)}</p>` : ''}</div>
        <button class="chip${c.done ? ' on' : ''}" data-action="custom-done" data-i="${i}">${c.done ? 'Hecho' : 'Marcar'}</button></div></div>`).join('')}
      <button class="cta pain" data-action="finish-rehab">Terminar y anotar dolor</button>`;
  }
  dlg('rsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="cancel-rehab">Salir</button><strong>Rehabilitación de la ${R.slot}</strong><span></span></div>${main}</div>`;
  calmMotion($('rsheet'));
}
// Solo actualiza el número y el anillo: redibujar todo reiniciaría la animación del boceto.
function rehabTick() {
  const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
  if (left !== R.left) {
    R.left = left;
    const total = R.state === 'rest' ? ISO_REST : R.items[R.idx].secs, bar = $('rsheet').querySelector('.timer .bar');
    if ($('r-left')) $('r-left').textContent = left;
    if (bar) bar.style.strokeDashoffset = 2 * Math.PI * 100 * (1 - left / total);
    if (left > 0 && left <= 3) cue('tick');
    if (R.state === 'hold' && left === Math.floor(total / 2) && total >= 20) cue(null, 'Mitad');
  }
  if (left > 0) return;
  clearInterval(R.timer); R.timer = null; R.left = null;
  const it = R.items[R.idx];
  if (R.state === 'hold') {
    it.done++;
    if (it.done >= it.sets) { R.state = 'listo'; R.idx++; cue('done', R.items[R.idx] ? 'Listo. Siguiente ejercicio' : 'Terminaste'); }
    else { R.state = 'rest'; R.end = Date.now() + ISO_REST * 1000; R.timer = setInterval(rehabTick, 250); cue('done', 'Descansá'); }
  } else if (R.state === 'rest') {
    R.state = 'listo';
    if (S.prefs.auto) return rehabGo();   // manos libres: la serie siguiente arranca sola
  }
  renderRehab();
}
function rehabGo() {
  const it = R.items[R.idx];
  R.state = 'hold'; R.end = Date.now() + it.secs * 1000; R.left = it.secs;
  R.timer = setInterval(rehabTick, 250); renderRehab(); cue('go', 'Sostené');
}
function rehabSkip() { R.end = Date.now(); rehabTick(); }
function finishRehab() {
  clearInterval(R?.timer);
  const done = R.items.filter((it) => it.done > 0);
  const items = done.map((it) => ({ ex: it.ex.id, zone: it.zone, sets: Array.from({ length: it.done }, () => ({ w: it.w, secs: it.ex.kind === 'iso' ? it.secs : 0, reps: it.ex.kind === 'lento' ? it.reps : 0, done: true })) }))
    .concat(R.custom.filter((c) => c.done).map((c) => ({ ex: 'custom:' + c.custom.id, name: c.custom.name, zone: c.custom.zone || undefined, sets: [{ done: true }] })));
  const session = { id: uid(), date: today(), type: 'rehab', slot: R.slot, items };
  if (!items.length) { toast('No hiciste ningún ejercicio todavía.'); return; }
  const zones = [...new Set([...done.map((i) => i.zone), ...R.custom.filter((c) => c.done && c.custom.zone).map((c) => c.custom.zone)])];
  R = null; $('rsheet').close(); keepAwake(false);
  if (zones.length) askPain(session, zones); else saveSession(session);
}

// ——— Dolor 0–10 ———
let P = null;   // { session, zones, vals }
function askPain(session, zones) {
  P = { session, zones, vals: {} };
  renderPain(); $('painsheet').showModal();
}
function renderPain() {
  dlg('painsheet').html = `<div class="dlg pain"><div class="dlg-head"><strong>¿Cuánto dolió?</strong><span></span></div>
    <p class="muted small">Durante el ejercicio, de 0 (nada) a 10 (máximo). Hasta 3–4 está bien.</p>
    ${P.zones.map((z) => `<h3 style="margin-top:14px">${esc(zoneName(z))}</h3><div class="chips scale">${Array.from({ length: 11 }, (_, n) => `<button class="chip${P.vals[z] === n ? ' on' : ''}" data-action="pain-val" data-zone="${z}" data-n="${n}">${n}</button>`).join('')}</div>`).join('')}
    <button class="cta pain" style="margin-top:18px" data-action="save-pain" ${P.zones.every((z) => P.vals[z] != null) ? '' : 'disabled'}>Guardar</button></div>`;
}
function savePain() {
  const { session, vals } = P;
  session.pain = vals;
  const msgs = [];
  if (session.type === 'rehab') {
    for (const [zone, val] of Object.entries(vals)) {
      const z = S.zones[zone]; if (!z || val <= PAIN_MAX) continue;
      // Pasó de 4: baja un salto ya, sin esperar a mañana.
      const ex = rehabEx(zone, z.phase);
      S.zones[zone] = { ...isoAdjust(z, ex, weightSteps(S.equip, implFor(ex, S.equip)), val, false), adjustedOn: today() };
      msgs.push(zoneName(zone).toLowerCase());
    }
  }
  P = null; $('painsheet').close(); saveSession(session);
  if (msgs.length) toast(`Dolió más de 4 en ${msgs.join(' y ')}: bajamos la carga para la próxima.`);
}
// Respuesta de "¿cómo amaneció?": ajusta la carga del isométrico con el dolor de ayer.
function answerCheck(zone, val) {
  const t = today(), y = addDays(t, -1), z = S.zones[zone];
  S.checks.push({ date: t, zone, val });
  if (z && z.phase < 3) {
    const pains = S.sessions.filter((s) => s.date === y && s.type === 'rehab' && s.pain?.[zone] != null).map((s) => s.pain[zone]);
    const worse = val === 'peor';
    if (pains.length && !(z.adjustedOn === y && !worse)) {
      const ex = rehabEx(zone, z.phase);
      const nz = isoAdjust(z, ex, weightSteps(S.equip, implFor(ex, S.equip)), Math.max(...pains), worse);
      if (nz.load !== z.load || nz.secs !== z.secs) toast(`${zoneName(zone)}: ${nz.load > (z.load || 0) || nz.secs > (z.secs || ISO_SECS) ? 'subimos' : 'bajamos'} a ${nz.secs} s${nz.load ? ` con ${fmtKg(nz.load)}` : ''}.`);
      S.zones[zone] = { ...nz, adjustedOn: undefined };
    }
  }
  persist(); render();
}

// ——— Dolor ———
// Avance de fase: con el criterio cumplido es la acción principal; antes, se ve cuánto falta y avanzar queda chico.
function phaseStep(zone, z) {
  const back = z.phase > 1 ? `<button class="quiet" data-action="phase" data-zone="${zone}" data-dir="-1">Volver a fase ${z.phase - 1}</button>` : '';
  if (z.phase >= 3) return back ? `<div class="phase-links">${back}</div>` : '';
  const next = PHASES[z.phase + 1], nextName = next.name.split(': ')[1];
  if (phaseReady(S, zone, today())) return `<button class="cta pain phase-go" data-action="phase" data-zone="${zone}" data-dir="1">Pasar a fase ${z.phase + 1}: ${esc(nextName)}</button>
    <p class="small muted">${esc(next.what)}</p>${back ? `<div class="phase-links">${back}</div>` : ''}`;
  const p = phaseProgress(S, zone, today()), days = Math.min(p.days, PHASE_DAYS);
  const pain = p.high ? 'Esta semana el dolor pasó de 3: esperá a que baje.' : p.worse ? 'Esta semana amaneció peor algún día: esperá a que se estabilice.'
    : p.logs < p.need ? `Registros de dolor esta semana: ${p.logs} de ${p.need}, todos en 3 o menos.` : '✓ Dolor de la semana en 3 o menos.';
  return `<div class="phase-prog"><p class="small">Para pasar a fase ${z.phase + 1}</p>
    <div class="phase-bar" role="progressbar" aria-label="Días en esta fase" aria-valuemin="0" aria-valuemax="${PHASE_DAYS}" aria-valuenow="${days}"><b style="width:${(100 * days) / PHASE_DAYS}%"></b></div>
    <p class="small muted">${days >= PHASE_DAYS ? `✓ ${PHASE_DAYS} días en esta fase.` : `${days} de ${PHASE_DAYS} días en esta fase.`}<br>${pain}</p></div>
    <div class="phase-links">${back}<button class="quiet" data-action="phase" data-zone="${zone}" data-dir="1">Avanzar igual</button></div>`;
}
function renderTendons() {
  let h = `<h1>Dolor</h1>
    <div class="card pain"><div class="row"><div><h3>Modo dolor</h3><p class="muted small">Isométricos diarios, registro de dolor y entreno adaptado en las zonas que marques.</p></div>
    <label class="switch"><input type="checkbox" data-action="pain-mode" ${S.painMode ? 'checked' : ''} aria-label="Modo dolor"><i></i></label></div></div>
    <h2>¿Qué te duele?</h2>`;
  // Las zonas, con las mismas casillas que el alta: la marcada despliega debajo lado, fase y ejercicio.
  h += `<div class="tiles list">${ZONES.map((zd) => {
    const z = S.zones[zd.id];
    const box = tile(`data-action="zone-toggle" data-zone="${zd.id}"`, !!z, esc(zd.name), esc(zd.hint));
    if (!z) return box;
    const ex = rehabEx(zd.id, z.phase), opts = z.phase < 3 ? rehabOptions(zd.id, z.phase) : [];
    return box + `<div class="zone-detail">
      <span class="small muted">¿De qué lado?</span><div class="chips" style="margin-top:6px">${Object.entries(SIDES).map(([k, v]) => `<button class="chip pain${z.side === k ? ' on' : ''}" data-action="zone-side" data-zone="${zd.id}" data-side="${k}">${v}</button>`).join('')}</div>
      <p class="small" style="margin-top:12px"><b>${esc(PHASES[z.phase].name)}</b>, desde el ${fmtDateLong(z.since)}<br><span class="muted">${esc(PHASES[z.phase].what)}</span></p>
      ${z.phase < 3 ? `<div class="ex" data-action="ex-detail" data-ex="${ex.id}"><div class="thumb">${figureSVG(ex, { crop: true })}</div><div class="info"><h3>${esc(ex.name)}</h3><p class="muted small">${z.phase === 1 ? `${ISO_SETS} × ${z.secs || ISO_SECS} s` : `${LENTO_SETS} × ${LENTO_REPS}`}${z.load ? ` con ${fmtKg(z.load)}` : ''}</p></div></div>` : ''}
      ${opts.length > 1 ? `<p class="small muted" style="margin:8px 0 4px">Otras opciones para esta fase:</p><div class="chips">${opts.map((o) => `<button class="chip pain${o.id === ex.id ? ' on' : ''}" data-action="rehab-choice" data-zone="${zd.id}" data-ex="${o.id}">${esc(o.name)}</button>`).join('')}</div>` : ''}
      ${phaseStep(zd.id, z)}</div>`;
  }).join('')}</div>`;
  h += `<h2>Ejercicios del fisio</h2><div class="card">${S.custom.length ? S.custom.map((c) => `<div class="row"><div><h3>${esc(c.name)}</h3><p class="muted small">${c.sets} × ${c.value} ${c.mode === 'segundos' ? 's' : 'reps'}${c.zone ? ` para tu ${esc(zoneName(c.zone).toLowerCase())}` : ''}</p></div><button class="link" data-action="custom-edit" data-id="${c.id}">Editar</button></div>`).join('') : '<p class="muted small">Cargá los ejercicios que te dio tu fisio: aparecen en cada sesión de rehabilitación.</p>'}
    <button class="sec" style="margin-top:10px;width:100%" data-action="custom-edit">+ Agregar ejercicio</button></div>
    <p class="faint small">Esto no reemplaza a un profesional. Si el dolor es agudo, apareció de golpe, hay hinchazón o pérdida de fuerza, consultá antes de cargar el tendón.</p>`;
  $('view-tendons').innerHTML = h;
}
function openCustom(id) {
  const c = S.custom.find((x) => x.id === id) || { id: '', name: '', zone: '', sets: 3, mode: 'reps', value: 15, note: '' };
  dlg('customsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="customsheet">Cancelar</button><strong>${c.id ? 'Editar' : 'Nuevo'} ejercicio</strong><button class="link" data-action="custom-save" data-id="${c.id}">Guardar</button></div>
    <label class="field"><span>Nombre</span><input id="c-name" value="${esc(c.name)}" placeholder="Ej.: Excéntrico de muñeca con Flexbar"></label>
    <label class="field"><span>Zona</span><select id="c-zone"><option value="">General</option>${ZONES.map((z) => `<option value="${z.id}" ${c.zone === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></label>
    <div class="grid2"><label class="field"><span>Series</span><input id="c-sets" type="number" inputmode="numeric" min="1" value="${c.sets}"></label>
    <label class="field"><span>${'Por serie'}</span><input id="c-value" type="number" inputmode="numeric" min="1" value="${c.value}"></label></div>
    <div class="chips">${['reps', 'segundos'].map((m) => `<button class="chip${c.mode === m ? ' on' : ''}" data-action="custom-mode" data-mode="${m}">${m}</button>`).join('')}</div>
    <label class="field"><span>Nota</span><textarea id="c-note" rows="2">${esc(c.note)}</textarea></label>
    ${c.id ? `<button class="link danger" data-action="custom-del" data-id="${c.id}">Eliminar</button>` : ''}</div>`;
  $('customsheet').dataset.mode = c.mode;
  $('customsheet').showModal();
}

// ——— Historial ———
let histZone = '', histEx = '';
function weightHistory(exId) {
  return S.sessions.filter((s) => s.type === 'entreno').map((s) => {
    const it = s.items.find((i) => i.ex === exId && !i.capped);
    return it && it.sets.length ? { x: s.date, y: Math.max(...it.sets.map((x) => x.w)) } : null;
  }).filter(Boolean).reverse();
}
function painHistory(zone) {
  const byDay = {};
  for (const s of S.sessions) if (s.pain?.[zone] != null) byDay[s.date] = Math.max(byDay[s.date] ?? 0, s.pain[zone]);
  return Object.entries(byDay).sort().map(([x, y]) => ({ x, y }));
}
function renderHistory() {
  const zones = [...new Set([...activeZones(), ...S.sessions.flatMap((s) => Object.keys(s.pain || {}))])];
  if (!zones.includes(histZone)) histZone = zones[0] || '';
  const exIds = [...new Set(S.sessions.filter((s) => s.type === 'entreno').flatMap((s) => s.items.filter((i) => getEx(i.ex)?.kind === 'peso').map((i) => i.ex)))];
  if (!exIds.includes(histEx)) histEx = exIds[0] || '';
  let h = `<div class="title-row"><h1>Historial</h1>${S.sessions.length ? '<button class="link" data-action="report">Informe para el fisio</button>' : ''}</div>`;
  // Sin entrenos, un solo vacío arriba que invita a empezar el día que toca.
  if (!S.sessions.some((s) => s.type === 'entreno')) {
    const plan = activePlan(S), day = dayIndex(plan, S.plan.pos);
    h += `<div class="card acc empty-hist"><h3>Todavía no entrenaste</h3><p class="muted small">Tu progreso aparece acá después del primer entreno.</p>
      <button class="cta" data-action="start-workout" data-day="${day}">Empezar ${esc(plan.days[day].name.toLowerCase())}</button></div>`;
  }
  if (exIds.length) h += `<h2>Peso por ejercicio</h2><div class="card acc"><select data-action="hist-ex" aria-label="Ejercicio">${exIds.map((e) => `<option value="${e}" ${e === histEx ? 'selected' : ''}>${esc(getEx(e)?.name || e)}</option>`).join('')}</select>
    ${lineChart(weightHistory(histEx), { unit: 'kg', color: 'var(--acc)' })}</div>`;
  if (S.sessions.length) h += `<h2>Sesiones</h2><div class="card">${S.sessions.slice(0, 60).map((s) => `<details class="sess-d"><summary class="sess"><span><span class="what">${s.type === 'entreno' ? `Entreno ${s.tpl}` : s.type === 'dolor' ? 'Registro de dolor' : `Rehabilitación de la ${s.slot}`}</span><br><span class="muted small">${fmtDate(s.date)}${s.min ? `, ${s.min} min y ${s.sets} series` : ''}${s.prs?.length ? ' 🏆' : ''}${s.pain ? '. Dolor: ' + Object.entries(s.pain).map(([z, v]) => `${zoneName(z).toLowerCase()} ${v}`).join(', ') : ''}</span></span><span class="tag ${s.type === 'entreno' ? 'acc' : 'pain'}">${s.items.length} ej.</span></summary>
      <ul class="small muted">${s.items.map((i) => `<li>${esc(getEx(i.ex)?.name || i.name || i.ex)}: ${i.sets.map((x) => (x.w ? `${x.w}×` : '') + (x.reps || (x.secs ? x.secs + 's' : '✓'))).join(', ')}</li>`).join('')}</ul>
      <button class="link danger small" data-action="del-session" data-id="${s.id}">Eliminar sesión</button></details>`).join('')}</div>`;
  // Dolor por zona va al final y solo si hay zonas o registros.
  if (zones.length) h += `<h2>Dolor por zona</h2><div class="card pain"><select data-action="hist-zone" aria-label="Zona">${zones.map((z) => `<option value="${z}" ${z === histZone ? 'selected' : ''}>${esc(zoneName(z))}</option>`).join('')}</select>
    ${lineChart(painHistory(histZone), { yMax: 10, limit: PAIN_MAX, unit: '/10', color: 'var(--pain)' })}</div>`;
  $('view-history').innerHTML = h;
}
// Informe para el fisio: página HTML independiente (se puede imprimir como PDF) con las últimas 6 semanas.
function reportHTML() {
  const t = today(), from = addDays(t, -41), recent = S.sessions.filter((s) => s.date >= from);
  const zones = [...new Set([...activeZones(), ...recent.flatMap((s) => Object.keys(s.pain || {}))])];
  const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).replace('.', ',') : '—');
  const zoneBlock = (zone) => {
    const z = S.zones[zone], pts = painHistory(zone).filter((p) => p.x >= from);
    const weeks = Array.from({ length: 6 }, (_, i) => { const a = addDays(t, -7 * (6 - i) + 1), b = addDays(a, 6); return { a, vals: pts.filter((p) => p.x >= a && p.x <= b).map((p) => p.y) }; });
    const checks = S.checks.filter((c) => c.zone === zone && c.date >= from);
    return `<section><h2>${esc(zoneName(zone))}${z ? `, ${{ der: 'lado derecho', izq: 'lado izquierdo', ambos: 'ambos lados' }[z.side] || ''}` : ''}</h2>
      ${z ? `<p><b>${esc(PHASES[z.phase].name)}</b>, desde el ${fmtDateLong(z.since)}. Ejercicio: ${esc(rehabEx(zone, z.phase).name)}${z.load ? ` con ${fmtKg(z.load)}` : ''}${z.phase === 1 ? `, ${z.secs || ISO_SECS} s por serie` : ''}. Dolor inicial: ${z.pain0 ?? '—'}/10.</p>` : ''}
      ${lineChart(pts, { yMax: 10, limit: PAIN_MAX, unit: '/10', color: '#E8590C' })}
      <table><tr><th>Semana desde</th>${weeks.map((w) => `<td>${fmtDate(w.a)}</td>`).join('')}</tr><tr><th>Dolor promedio</th>${weeks.map((w) => `<td>${avg(w.vals)}</td>`).join('')}</tr><tr><th>Máximo</th>${weeks.map((w) => `<td>${w.vals.length ? Math.max(...w.vals) : '—'}</td>`).join('')}</tr></table>
      <p class="muted">Al día siguiente: ${['mejor', 'igual', 'peor'].map((v) => `${v} ${checks.filter((c) => c.val === v).length}`).join(', ')}.</p></section>`;
  };
  const train = recent.filter((s) => s.type === 'entreno'), rehab = recent.filter((s) => s.type === 'rehab');
  const custom = S.custom.length ? `<h2>Ejercicios indicados por el fisio</h2><ul>${S.custom.map((c) => `<li>${esc(c.name)}: ${c.sets} × ${c.value} ${c.mode === 'segundos' ? 's' : 'reps'}${c.note ? ` — ${esc(c.note)}` : ''}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe XZ Fit</title>
<style>:root{--pain:#E8590C;--acc:#5C940D;--line:#DEE2E6;--faint:#868E96;--card:#fff}body{font:15px/1.45 system-ui,sans-serif;color:#212529;max-width:760px;margin:24px auto;padding:0 16px}h1{margin:0}h2{margin:28px 0 6px;font-size:19px}.muted{color:#6C757D}table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}th,td{border:1px solid var(--line);padding:5px;text-align:center}th{text-align:left;background:#F8F9FA}.chart svg{width:100%;max-width:520px;display:block}.chart .grid{stroke:var(--line)}.chart .axis{fill:var(--faint);font-size:11px}.chart .limit{stroke:var(--pain);stroke-dasharray:4 4;opacity:.7}.chart .series{fill:none;stroke-width:2}.chart .dot{stroke:#fff;stroke-width:2}.chart .hit{fill:transparent}.chart .empty{color:var(--faint);padding:12px 0}section{break-inside:avoid}@media print{button{display:none}}</style></head><body>
<h1>Informe de rehabilitación</h1>
<p class="muted">${esc(S.profile.name || 'Paciente')}, del ${fmtDate(from)} al ${fmtDate(t)}. Generado con XZ Fit ${APP_VERSION}.</p>
<p>Protocolo: isométricos (3 × 30–45 s, mañana y noche), luego isotónicos lentos 3 s/3 s y reintegración, con dolor tolerado hasta 3–4/10 y sin empeorar al día siguiente. Modo dolor ${S.painMode ? 'activo' : 'apagado'}.</p>
<p><b>${rehab.length}</b> sesiones de rehabilitación y <b>${train.length}</b> entrenos en el período.</p>
${zones.map(zoneBlock).join('') || '<p class="muted">Sin zonas con dolor registradas.</p>'}
${custom}
<button onclick="print()">Imprimir o guardar como PDF</button>
</body></html>`;
}

// Gráfico de una serie: fechas en x, valor en y; tocá un punto para ver el valor.
function lineChart(pts, { yMax, limit, unit, color }) {
  if (pts.length < 2) return `<div class="chart"><div class="empty">${pts.length ? `Un registro: ${pts[0].y}${unit === 'kg' ? ' kg' : unit}. Con dos ya se ve la línea.` : 'Sin registros todavía.'}</div></div>`;
  const W_ = 320, H = 150, L = 28, Rr = 8, T = 10, B = 22;
  const t0 = parseDay(pts[0].x), t1 = parseDay(pts[pts.length - 1].x), span = Math.max(1, t1 - t0);
  const max = yMax ?? (Math.max(...pts.map((p) => p.y)) * 1.15 || 1);
  const X = (k) => L + ((parseDay(k) - t0) / span) * (W_ - L - Rr), Y = (v) => T + (1 - v / max) * (H - T - B);
  const ticks = yMax === 10 ? [0, 5, 10] : [0, Math.round(max / 2), Math.round(max)];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="Gráfico de ${pts.length} registros">
    ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W_ - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${limit != null ? `<line class="limit" x1="${L}" x2="${W_ - Rr}" y1="${Y(limit)}" y2="${Y(limit)}"/>` : ''}
    <text class="axis" x="${L}" y="${H - 4}">${fmtDate(pts[0].x)}</text><text class="axis" x="${W_ - Rr}" y="${H - 4}" text-anchor="end">${fmtDate(pts[pts.length - 1].x)}</text>
    <path class="series" d="${d}" stroke="${color}"/>
    ${pts.map((p) => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${color}"/><circle class="hit" cx="${X(p.x)}" cy="${Y(p.y)}" r="14" data-tip="${esc(fmtDate(p.x))}|${p.y}${unit === 'kg' ? ' kg' : unit}"/>`).join('')}
  </svg></div>`;
}
function showTip(el) {
  const [date, val] = el.dataset.tip.split('|'), r = el.getBoundingClientRect(), tip = $('tip');
  overlayHost().appendChild(tip);
  tip.innerHTML = `<b>${esc(val)}</b> el ${esc(date)}`; tip.hidden = false;
  tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${r.top + r.height / 2 - 6}px`;
}

// Campo numérico con la unidad adentro.
const unitField = (label, attrs, unit) => `<label class="field"><span>${label}</span><div class="unit"><input type="number" ${attrs}><em>${unit}</em></div></label>`;
// Días de entreno: definen los días por semana, el "hoy toca" y los recordatorios.
function weekFields() {
  const n = S.rem.train.length;
  return `<div class="chips week">${Object.entries(DAY_NAMES).map(([k, v]) => `<button class="chip${S.rem.train.includes(k) ? ' on' : ''}" data-action="rem-day" data-v="${k}" aria-pressed="${S.rem.train.includes(k)}">${v}</button>`).join('')}</div>
    <p class="small week-sum"><b>${n} ${n === 1 ? 'día' : 'días'} por semana.</b> <span class="muted">Esos días el inicio te muestra qué toca.</span></p>`;
}
// ——— Ajustes ———
function renderSettings() {
  const p = S.profile, e = S.equip;
  let h = `<h1>Ajustes</h1>
  <h2>Perfil</h2><div class="card">
    <label class="field"><span>Nombre</span><input data-set="profile.name" value="${esc(p.name)}"></label>
    <span class="small muted">Sexo</span><div class="chips" style="margin:4px 0 8px">${[['h', 'Hombre'], ['m', 'Mujer'], ['x', 'Prefiero no decir']].map(([k, v]) => `<button class="chip${p.sex === k ? ' on' : ''}" data-action="set-sex" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="grid3">${unitField('Peso', `data-set="profile.weight" inputmode="decimal" value="${esc(p.weight)}"`, 'kg')}${unitField('Altura', `data-set="profile.height" inputmode="numeric" value="${esc(p.height)}"`, 'cm')}${unitField('Edad', `data-set="profile.age" inputmode="numeric" value="${esc(p.age)}"`, 'años')}</div>
    <span class="small muted">Días de entreno</span>${weekFields()}
    <span class="small muted" style="display:block;margin-top:12px">Experiencia</span><div class="chips" style="margin-top:4px">${EXPERIENCE.map((x) => `<button class="chip${p.exp === x.id ? ' on' : ''}" data-action="set-exp" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <p class="faint small">Con sexo, peso, edad y experiencia estimamos tu peso inicial. La altura casi no cambia el cálculo.</p></div>
  <h2>Pesos</h2>${weightModeFields()}
  <h2>Equipo</h2>${equipFields()}
  ${hasPainTab() ? '' : `<h2>Dolor</h2><div class="card pain"><h3>¿Te duele algo?</h3><p class="muted small">Marcá la zona y activá el modo dolor: suma ejercicios para el tendón y cuida esa zona en el entreno.</p><button class="sec" style="width:100%;margin-top:10px" data-action="go-pain">Marcar qué me duele</button></div>`}
  <h2>Tema</h2><div class="card"><div class="chips">${[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Según el sistema']].map(([k, n]) => `<button class="chip${(S.prefs.theme || 'dark') === k ? ' on' : ''}" data-action="theme" data-v="${k}">${n}</button>`).join('')}</div><p class="faint small">El claro se lee mejor a pleno sol.</p></div>
  <h2>Durante la sesión</h2><div class="card">
    <div class="row"><div><h3>Sonidos</h3><p class="muted small">Pitidos al empezar, en los últimos 3 s y al terminar.</p></div><label class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="sound" ${S.prefs.sound ? 'checked' : ''} aria-label="Sonidos"><i></i></label></div>
    <div class="row"><div><h3>Voz</h3><p class="muted small">"Sostené", "Descansá", "Siguiente serie".</p></div><label class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="voice" ${S.prefs.voice ? 'checked' : ''} aria-label="Voz"><i></i></label></div>
    <div class="row"><div><h3>Isométricos manos libres</h3><p class="muted small">Después del descanso, la serie siguiente arranca sola.</p></div><label class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="auto" ${S.prefs.auto ? 'checked' : ''} aria-label="Manos libres"><i></i></label></div>
    <span class="small muted">Descanso entre series de entreno</span><div class="chips" style="margin-top:4px">${[60, 90, 120, 180].map((n) => `<button class="chip${S.prefs.rest === n ? ' on' : ''}" data-action="pref" data-k="rest" data-v="${n}">${n < 120 ? n + ' s' : n / 60 + ' min'}</button>`).join('')}</div>
    <p class="faint small">La pantalla queda prendida mientras entrenás.</p></div>
  <h2>Recordatorios</h2><div class="card">
    <p class="muted small">Se agregan a tu calendario: es la forma más confiable de recibir avisos sin servidor.</p>
    <div class="grid2"><label class="field"><span>Isométricos mañana</span><input type="time" data-set="rem.am" value="${S.rem.am}"></label><label class="field"><span>Isométricos noche</span><input type="time" data-set="rem.pm" value="${S.rem.pm}"></label></div>
    <label class="field"><span>Hora del entreno (los días se eligen en Perfil)</span><input type="time" data-set="rem.trainAt" value="${S.rem.trainAt}"></label>
    <button class="sec" style="width:100%" data-action="ics">📅 Agregar al calendario</button>
    ${S.painMode ? '' : '<p class="faint small">Los isométricos se incluyen solo con el modo dolor activado.</p>'}</div>
  <h2>Copia de seguridad</h2><div class="card">
    <p class="muted small">Tus datos viven solo en este teléfono. Guardá una copia de vez en cuando (Drive, correo, WhatsApp).</p>
    <div class="btns"><button class="sec" data-action="export">Guardar copia</button><button class="sec" data-action="import">Restaurar copia</button></div>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
    <p class="faint small" id="persist-status"></p></div>
  <h2>Fuentes</h2><div class="card small">
    <p class="muted">Protocolo de tendones basado en:</p><ul>${SOURCES.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="muted">Ilustraciones generadas por código para esta app (sin imágenes de terceros). XZ Fit no es un consejo médico: consultá a un profesional ante dolor agudo, hinchazón o pérdida de fuerza.</p>
    <p class="faint">Versión ${APP_VERSION}. <button class="link" data-action="news">Ver novedades</button></p></div>
  <button class="link danger" data-action="reset">Borrar todos los datos</button>`;
  $('view-settings').innerHTML = h;
  navigator.storage?.persisted?.().then((ok) => { const el = $('persist-status'); if (el) el.textContent = ok ? '✓ Almacenamiento persistente: el navegador no borra los datos por falta de espacio.' : 'El navegador podría borrar los datos si falta espacio: instalá la app y guardá copias.'; });
}
// Casilla grande que se marca entera (accesorios, zonas con dolor).
const tile = (attrs, on, name, hint = '', type = 'checkbox') => `<label class="tile"><input type="${type}" ${attrs} ${on ? 'checked' : ''}><span><b>${name}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
function equipFields(prefix = '') {
  const e = S.equip;
  return `<h3 class="grp">Pesos libres</h3><div class="card">
    <div class="row"><div><h3>Mancuernas</h3>${e.db ? '' : '<p class="muted small" style="margin:0">No tengo</p>'}</div><label class="switch acc"><input type="checkbox" data-action="eq-db" ${e.db ? 'checked' : ''} aria-label="Tengo mancuernas"><i></i></label></div>
    ${e.db && !e.db.plates?.on ? `<div class="grid3">${[['Más liviana', 'min', 0.5], ['Más pesada', 'max', 0.5], ['De a', 'step', 0.25]].map(([n, k, st]) => unitField(n, `inputmode="decimal" step="${st}" data-set="equip.db.${k}" value="${e.db[k]}"`, 'kg')).join('')}</div>` : ''}
    ${e.db ? `<div class="row sub"><div><b>Son de discos</b><br><span class="small muted">Cargás barra y discos: la app calcula los pesos posibles y qué poner de cada lado.</span></div><label class="switch acc"><input type="checkbox" data-action="eq-plates" ${e.db.plates?.on ? 'checked' : ''} aria-label="Mancuernas de discos"><i></i></label></div>` : ''}
    ${e.db?.plates?.on ? platesFields() : ''}
    <hr><h3>Pesas rusas</h3><label class="field"><span>Los pesos que tenés, separados por coma</span><div class="unit"><input data-set="equip.kb" ${prefix} value="${e.kb.join(', ')}" placeholder="Ej.: 12, 20"><em>kg</em></div></label></div>
  <h3 class="grp">Accesorios</h3><div class="tiles">
    ${[['bench', 'Banco'], ['bar', 'Barra de dominadas'], ['band', 'Bandas elásticas']].map(([k, n]) => tile(`data-action="eq-flag" data-k="${k}"`, e[k], n)).join('')}${tile('data-action="eq-rings"', e.rings, 'Aros o TRX')}</div>
  <h3 class="grp">Máquinas y otros equipos</h3><div class="card">
    ${(e.machines || []).map((m) => `<div class="row"><div><b>${esc(m.name)}</b><br><span class="small muted">${m.min}–${m.max} kg, de a ${m.step}</span></div><button class="link" data-action="mach-edit" data-id="${m.id}">Editar</button></div>`).join('') || '<p class="muted small" style="margin:0">Polea, prensa, barra con discos: cualquier cosa con su rango de peso.</p>'}
    <button class="sec" style="width:100%;margin-top:10px" data-action="mach-edit">+ Agregar máquina</button></div>`;
}
// Mancuernas de discos: barra, lista de discos (peso y cantidad total) y los pesos que se pueden armar.
function platesFields() {
  const pl = S.equip.db.plates, steps = weightSteps(S.equip, 'db');
  return `<label class="field"><span>Barra de cada mancuerna (kg, con los cierres)</span><input type="number" inputmode="decimal" step="0.1" data-plate="bar" value="${pl.bar}"></label>
    ${pl.items.map((x, i) => `<div class="plate-row"><label class="field"><span>Disco (kg)</span><input type="number" inputmode="decimal" step="0.25" data-plate="${i}.kg" value="${x.kg}"></label><label class="field"><span>Cantidad total</span><input type="number" inputmode="numeric" min="0" data-plate="${i}.n" value="${x.n}"></label><button data-action="plate-del" data-i="${i}" aria-label="Quitar disco">✕</button></div>`).join('')}
    <button class="sec" style="width:100%" data-action="plate-add">+ Agregar disco</button>
    <p class="small" style="margin-top:8px"><span class="muted">Pesos posibles por mancuerna:</span> <b class="num">${steps.map((w) => String(w).replace('.', ',')).join(', ') || '—'}</b></p>
    <p class="faint small">Para el par se usan 4 discos iguales por cada uno que va de cada lado.</p>`;
}
const platesLabel = (w) => { const p = platesFor(S.equip, w); return !p ? '' : p.length ? p.map((x) => String(x).replace('.', ',')).join(' + ') + ' kg' : 'sin discos'; };

// Instalar la app: botón en Android/Chrome (beforeinstallprompt) e instrucciones en iPhone.
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installCard() {
  if (S.hideInstall || isStandalone() || !S.onboarded) return '';
  if (installEvt) return `<div class="card acc"><div class="row"><div><h3>Instalá la app</h3><p class="muted small">Abre a pantalla completa, sin barra del navegador, y protege mejor tus datos.</p></div></div><div class="btns"><button class="cta" data-action="install">Instalar</button></div><button class="link" data-action="install-hide">Ahora no</button></div>`;
  if (isIOS()) return `<div class="card acc"><h3>Instalala en tu iPhone</h3><p class="muted small">En Safari tocá <b>Compartir</b> (el cuadrado con la flecha) → <b>Agregar a inicio</b>. Así Safari no borra tus datos y se abre a pantalla completa.</p><button class="link" data-action="install-hide">Entendido</button></div>`;
  return '';
}
async function installApp() {
  if (!installEvt) return;
  installEvt.prompt();
  const r = await installEvt.userChoice.catch(() => null);
  installEvt = null;
  if (r?.outcome !== 'accepted') { S.hideInstall = true; persist(); }
  render();
}

function setPath(path, raw) {
  const keys = path.split('.'), last = keys.pop();
  let o = S; for (const k of keys) o = o[k];
  let v = raw;
  if (path === 'equip.kb') v = raw.split(/[,;\s]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0).sort((a, b) => a - b);
  else if (path.startsWith('equip.db.')) { v = Number(String(raw).replace(',', '.')); if (!(v > 0)) return; }
  o[last] = v;
  persist();
}

// ——— Primer uso ———
let onbStep = 0;
const ONB_STEPS = 4;
function renderOnb() {
  const p = S.profile;
  const steps = `<div class="steps">${Array.from({ length: ONB_STEPS }, (_, i) => `<i class="${i <= onbStep ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  // Bienvenida: primero el entreno, que es lo que busca casi todos; el cuidado de tendones va como apoyo.
  if (onbStep === 0) body = `<h1><span style="color:var(--acc-fg)">XZ</span> Fit</h1><div class="hero-fig sm">${figureSVG(EXERCISES.goblet)}</div>
    <h2 class="welcome">Tu rutina de fuerza, guiada serie por serie</h2>
    <ul class="pitch">
      <li><strong>Armada con tu equipo.</strong> Mancuernas, pesas rusas o máquinas: ves solo lo que podés hacer.</li>
      <li><strong>Sabés cuánto levantar.</strong> Te sugiere el peso de cada serie y te avisa cuándo subirlo.</li>
      <li><strong>Progresás sin estancarte.</strong> Si dejás de avanzar, ajusta el volumen o te da una semana de descarga.</li>
      <li class="care"><strong>Si algo te duele, se adapta.</strong> Baja la carga de esa zona y suma ejercicios para recuperar tendones.</li>
    </ul>
    <p class="muted small">Te toma un minuto. Tus datos quedan solo en este teléfono.</p>`;
  if (onbStep === 1) body = `<h1>Tu perfil</h1><p class="muted small">Con esto estimamos el peso de tu primera serie. Después se ajusta con lo que levantes.</p>
    <label class="field"><span>Nombre o apodo</span><input data-set="profile.name" value="${esc(p.name)}" autocomplete="nickname"></label>
    <span class="small muted">Sexo</span><div class="chips" style="margin:4px 0 8px">${[['h', 'Hombre'], ['m', 'Mujer'], ['x', 'Prefiero no decir']].map(([k, v]) => `<button class="chip${p.sex === k ? ' on' : ''}" data-action="set-sex" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="grid3">${unitField('Peso', `id="o-weight" data-set="profile.weight" inputmode="decimal" value="${esc(p.weight)}"`, 'kg')}${unitField('Altura', `data-set="profile.height" inputmode="numeric" value="${esc(p.height)}"`, 'cm')}${unitField('Edad', `data-set="profile.age" inputmode="numeric" value="${esc(p.age)}"`, 'años')}</div>
    <span class="small muted">¿Cuánto hace que entrenás con pesas?</span><div class="chips" style="margin:4px 0 16px">${EXPERIENCE.map((x) => `<button class="chip${p.exp === x.id ? ' on' : ''}" data-action="set-exp" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <span class="small muted">¿Qué días entrenás?</span>${weekFields()}
    <span class="small muted" style="display:block;margin-top:16px">¿Cómo querés los pesos?</span>${weightModeFields()}<p class="faint small">Lo cambiás cuando quieras en Ajustes.</p>`;
  if (onbStep === 2) body = `<h1>Tu equipo</h1><p class="muted small">Marcá lo que tenés. La rutina usa solo eso y redondea los pesos a lo que podés cargar.</p>${equipFields()}`;
  if (onbStep === 3) body = `<h1>¿Te duele algo?</h1><p class="muted small">Opcional. Si marcás una zona, la app la cuida: baja la carga de los ejercicios que la exigen y te propone ejercicios para recuperar el tendón. Si no te duele nada, seguí.</p>
    <div class="tiles list">${ZONES.map((z) => { const zz = S.zones[z.id]; return tile(`data-action="zone-toggle" data-zone="${z.id}"`, !!zz, esc(z.name), esc(z.hint)) + (!zz ? '' : `<div class="zone-detail">
      <span class="small muted">¿Cuánto duele hoy al usarla?</span><div class="chips scale" style="margin-top:6px">${Array.from({ length: 11 }, (_, n) => `<button class="chip pain${zz.pain0 === n ? ' on' : ''}" data-action="zone-pain" data-zone="${z.id}" data-n="${n}">${n}</button>`).join('')}</div>
      <div class="scale-ends small faint"><span>Nada</span><span>El peor dolor</span></div>
      <span class="small muted">¿De qué lado?</span><div class="chips" style="margin-top:6px">${Object.entries(SIDES).map(([k, v]) => `<button class="chip pain${zz.side === k ? ' on' : ''}" data-action="zone-side" data-zone="${z.id}" data-side="${k}">${v}</button>`).join('')}</div></div>`); }).join('')}</div>
    <p class="faint small">El modo dolor queda apagado hasta que lo actives desde el inicio. Usa el protocolo de isométricos del video de Jeremy Ethier con el investigador Keith Baar y el fisioterapeuta Coach Q. No reemplaza a un profesional.</p>`;
  dlg('onb').html = `<div class="dlg">${steps}${body}<div class="btns" style="margin-top:16px">${onbStep ? '<button class="sec" data-action="onb-back">Atrás</button>' : ''}<button class="cta" data-action="onb-next">${onbStep === 0 ? 'Armar mi rutina' : onbStep === ONB_STEPS - 1 ? 'Ver mi rutina' : 'Siguiente'}</button></div></div>`;
  calmMotion($('onb'));
}
function onbNext() {
  if (onbStep === 1 && !(Number(S.profile.weight) > 0)) return toast('Poné tu peso para estimar las cargas.');
  if (onbStep < ONB_STEPS - 1) { onbStep++; renderOnb(); $('onb').querySelector('.dlg').scrollTop = 0; return; }
  // La rutina se arma con el equipo elegido en el alta, y el plan (con su rampa de entrada) empieza hoy.
  resetRoutine(); S.plan.pos = 0; S.plan.since = today();
  S.onboarded = true; S.seenVersion = APP_VERSION; persist();
  navigator.storage?.persist?.();
  $('onb').close(); render();
}

// ——— Archivos (copia y calendario) ———
async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportData() { shareFile(`xz-fit-${today()}.json`, JSON.stringify({ app: 'tendon-fuerte', version: APP_VERSION, data: S }, null, 1), 'application/json'); }
async function importData(file) {
  try {
    const j = JSON.parse(await file.text()), d = j.data || j;
    if (!d.profile || !Array.isArray(d.sessions)) throw new Error('no es una copia de XZ Fit');
    if (!confirm(`¿Reemplazar tus datos por la copia (${d.sessions.length} sesiones)?`)) return;
    S = withDefaults(d); S.onboarded = true; applyTheme(); await persist(); render(); toast('Copia restaurada.');
  } catch (e) { toast('No se pudo leer el archivo: ' + e.message); }
}

// ——— Eventos ———
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) return showTab(tabBtn.dataset.tab);
  const hit = e.target.closest('[data-tip]');
  if (hit) return showTip(hit);
  $('tip').hidden = true;
  const el = e.target.closest('[data-action]');
  if (!el || el.matches('input, select')) return;
  const a = el.dataset.action, d = el.dataset;
  const actions = {
    'start-workout': () => startWorkout(Number(d.day)),
    'cancel-workout': () => { if (confirm('¿Salir sin guardar el entreno?')) { stopRest(); W = null; $('wsheet').close(); keepAwake(false); } },
    'finish-workout': finishWorkout,
    'set-done': () => setDone(+d.i, +d.j),
    'rir-help': () => { W.rirHelp = W.rirHelp === +d.i ? -1 : +d.i; renderWorkout(); },
    'swap-today': () => openSwapToday(+d.i),
    'swap-why': () => swapToday(+d.i, d.off),
    'skip-rest': stopRest,
    'ex-detail': () => openExercise(d.ex),
    'recalibrate': () => { if (confirm(weightMode() === 'calib' ? '¿Borrar el peso de trabajo y volver a calibrar?' : '¿Borrar el peso de trabajo de este ejercicio?')) { delete S.lifts[d.ex]; persist(); $('exsheet').close(); render(); } },
    'close': () => $(d.dlg).close(),
    'start-rehab': startRehab,
    'rehab-go': rehabGo,
    'rehab-skip': rehabSkip,
    'lento-set': () => { const it = R.items[R.idx]; it.done = +d.s < it.done ? +d.s : +d.s + 1; renderRehab(); },
    'rehab-next': () => { R.idx++; R.state = 'listo'; renderRehab(); },
    'custom-done': () => { R.custom[+d.i].done = !R.custom[+d.i].done; renderRehab(); },
    'finish-rehab': finishRehab,
    'cancel-rehab': () => { if (confirm('¿Salir sin guardar la sesión?')) { clearInterval(R?.timer); R = null; $('rsheet').close(); keepAwake(false); } },
    'pref': () => { S.prefs[d.k] = d.v === undefined ? !S.prefs[d.k] : Number(d.v); persist(); render(); if (d.k === 'sound' || d.k === 'voice') cue('go', 'Así suena'); },
    'news': openNews,
    'theme': () => { S.prefs.theme = d.v; applyTheme(); persist(); render(); },
    'quick-pain': () => askPain({ id: uid(), date: today(), type: 'dolor', items: [] }, activeZones()),
    'deload': () => { S.plan.deload = weekKey(today()); persist(); render(); toast('Semana de descarga: una serie menos y 90 % del peso. La próxima semana seguís normal.'); },
    'deload-no': () => { S.plan.deloadOffer = weekKey(today()); persist(); render(); },
    'deload-off': () => { S.plan.deload = ''; persist(); render(); },
    'unstall': () => { const l = S.lifts[d.ex], steps = weightSteps(S.equip, implFor(getEx(d.ex), S.equip)); l.w = roundDown(steps, l.w * 0.9); persist(); render(); toast(`${getEx(d.ex).name}: ${fmtKg(l.w)}. Volvé a subir desde acá.`); },
    'rehab-choice': () => {
      const z = S.zones[d.zone], ex = EXERCISES[d.ex], steps = weightSteps(S.equip, implFor(ex, S.equip));
      z.choice = { ...z.choice, [Math.min(2, z.phase)]: d.ex };
      // Otra herramienta: la carga arranca de nuevo desde lo mínimo del ejercicio elegido.
      if (ex.impl === 'bw') z.load = 0; else if (!steps.includes(z.load)) z.load = ex.load0 ? roundDown(steps, ex.load0) : 0;
      persist(); render(); toast(`${zoneName(d.zone)}: ${ex.name.toLowerCase()}.`);
    },
    'plate-add': () => { S.equip.db.plates.items.push({ kg: 1.25, n: 4 }); persist(); render(); },
    'plate-del': () => { S.equip.db.plates.items.splice(+d.i, 1); persist(); render(); },
    'install': installApp,
    'install-hide': () => { S.hideInstall = true; persist(); render(); },
    'warm': () => { W.warm[+d.i].done = !W.warm[+d.i].done; renderWorkout(); },
    'report': () => shareFile(`informe-xz-fit-${today()}.html`, reportHTML(), 'text/html'),
    'news-seen': () => { S.seenVersion = APP_VERSION; persist(); render(); },
    'pain-val': () => { P.vals[d.zone] = +d.n; renderPain(); },
    'save-pain': savePain,
    'check': () => answerCheck(d.zone, d.val),
    'pain-mode-on': () => { S.painMode = true; persist(); render(); toast('Modo dolor activado.'); },
    'go-pain': () => showTab('tendons'),
    'hide-pain-tip': () => { S.hidePainTip = true; persist(); render(); },
    'phase': () => {
      const z = S.zones[d.zone], to = z.phase + Number(d.dir);
      if (to < 1 || to > 3) return;
      if (Number(d.dir) > 0 && !phaseReady(S, d.zone, today()) && !confirm(`Todavía no cumple el criterio: ${PHASE_DAYS} días en la fase y una semana con dolor en 3 o menos. Avanzar antes de tiempo puede volver a irritar el tendón. ¿Avanzar igual?`)) return;
      S.zones[d.zone] = { ...z, phase: to, since: today() }; persist(); render();
    },
    'three-days': () => { if (S.rem.train.length < 3) S.rem.train = ['lu', 'mi', 'vi']; S.profile.days = 3; persist(); render(); toast('3 días por semana: el plan sigue rotando.'); },
    'zone-side': () => { S.zones[d.zone].side = d.side; persist(); $('onb').open ? renderOnb() : render(); },
    'zone-pain': () => { S.zones[d.zone].pain0 = +d.n; persist(); renderOnb(); },
    'custom-edit': () => openCustom(d.id),
    'custom-mode': () => { $('customsheet').dataset.mode = d.mode; $('customsheet').querySelectorAll('[data-action="custom-mode"]').forEach((b) => b.classList.toggle('on', b.dataset.mode === d.mode)); },
    'custom-save': () => {
      const name = $('c-name').value.trim(); if (!name) return toast('Poné un nombre.');
      const c = { id: d.id || uid(), name, zone: $('c-zone').value, sets: Math.max(1, +$('c-sets').value || 1), mode: $('customsheet').dataset.mode, value: Math.max(1, +$('c-value').value || 1), note: $('c-note').value.trim() };
      const i = S.custom.findIndex((x) => x.id === c.id); i >= 0 ? (S.custom[i] = c) : S.custom.push(c);
      persist(); $('customsheet').close(); render();
    },
    'custom-del': () => { if (confirm('¿Eliminar este ejercicio?')) { S.custom = S.custom.filter((x) => x.id !== d.id); persist(); $('customsheet').close(); render(); } },
    'del-session': () => {
      const i = S.sessions.findIndex((s) => s.id === d.id); if (i < 0) return;
      const [gone] = S.sessions.splice(i, 1); persist(); render();
      toast('Sesión eliminada.', () => { S.sessions.splice(i, 0, gone); persist(); render(); toast('Sesión recuperada.'); });
    },
    'undo': () => { const f = toastUndo; toastUndo = null; $('toast').hidden = true; f?.(); },
    'set-sex': () => { S.profile.sex = d.v; persist(); $('onb').open ? renderOnb() : render(); },
    'set-exp': () => { S.profile.exp = d.v; persist(); $('onb').open ? renderOnb() : render(); },
    'rem-day': () => { const t = S.rem.train; if (t.length === 1 && t[0] === d.v) return toast('Elegí al menos un día.'); S.rem.train = t.includes(d.v) ? t.filter((x) => x !== d.v) : Object.keys(DAY_NAMES).filter((k) => t.includes(k) || k === d.v); S.profile.days = S.rem.train.length; persist(); $('onb').open ? renderOnb() : render(); },
    'ics': () => shareFile('xz-fit.ics', icsText(S.rem, S.painMode, today()), 'text/calendar'),
    'export': exportData,
    'import': () => $('import-file').click(),
    'reset': () => { if (confirm('¿Borrar todos los datos? No se puede deshacer.') && confirm('¿Seguro? Se pierde todo el historial.')) { S = DEFAULT(); resetRoutine(); persist(); onbStep = 0; renderOnb(); $('onb').showModal(); } },
    'onb-next': onbNext,
    'edit-routine': () => { editRoutine = !editRoutine; if (editRoutine) editDay = dayIndex(activePlan(S), S.plan.pos); render(); },
    'edit-day': () => { editDay = +d.day; render(); },
    'routine-move': () => { const items = [...dayItems(+d.day)], i = +d.i, j = i + Number(d.d); [items[i], items[j]] = [items[j], items[i]]; routineSet(+d.day, items); },
    'routine-del': () => {
      const day = +d.day, items = dayItems(day);
      if (items.length <= 1) return toast('Dejá al menos un ejercicio.');
      routineSet(day, items.filter((_, i) => i !== +d.i));
      toast(`Quitaste ${getEx(items[+d.i].ex)?.name.toLowerCase() || 'el ejercicio'}.`, () => routineSet(day, items));
    },
    'routine-pick': () => openPicker(d.day, d.i),
    'routine-reset': () => {
      if (!confirm('¿Volver al plan original? Se arma de nuevo según tu equipo. Tus ejercicios propios siguen en Mis ejercicios.')) return;
      resetRoutine();
      persist(); render();
    },
    'pick-ex': () => pickExercise(d.ex),
    'exform': () => openExForm(d.id),
    'xf-kind': () => { readExForm(); XF.kind = d.v; renderExForm(); },
    'xf-tag': () => { readExForm(); XF.tag = XF.tag.includes(d.v) ? XF.tag.filter((z) => z !== d.v) : [...XF.tag, d.v]; renderExForm(); },
    'exform-save': saveExForm,
    'exform-del': deleteExForm,
    'mach-edit': () => openMachine(d.id),
    'mach-save': () => saveMachine(d.id),
    'mach-del': () => {
      if (!confirm('¿Eliminar la máquina? Los ejercicios que la usan quedan como "falta equipo".')) return;
      S.equip.machines = S.equip.machines.filter((m) => m.id !== d.id); persist(); $('machsheet').close(); $('onb').open ? renderOnb() : render();
    },
    'onb-back': () => { onbStep--; renderOnb(); },
  };
  actions[a]?.();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.set) { setPath(el.dataset.set, el.value); if (!$('onb').open && el.dataset.set.startsWith('equip')) render(); return; }
  if (el.dataset.w) { const [i, j, k] = el.dataset.w.split('.'); W.items[+i].rows[+j][k] = el.value; return; }
  const a = el.dataset.action;
  if (a === 'pain-mode') { S.painMode = el.checked; persist(); render(); toast(el.checked ? 'Modo dolor activado.' : 'Modo dolor apagado: el entreno usa los pesos completos.'); }
  if (a === 'zone-toggle') {
    if (el.checked) S.zones[el.dataset.zone] = newZone(el.dataset.zone);
    else if ($('onb').open || confirm(`¿Quitar ${zoneName(el.dataset.zone).toLowerCase()}? Se pierde la fase y la carga actual.`)) delete S.zones[el.dataset.zone];
    else el.checked = true;
    persist(); $('onb').open ? renderOnb() : render();
  }
  if (a === 'eq-db') { S.equip.db = el.checked ? { min: 2, max: 24, step: 2 } : null; persist(); $('onb').open ? renderOnb() : render(); }
  if (a === 'eq-rings') { S.equip.rings = el.checked; persist(); if (!$('onb').open) render(); }
  if (a === 'eq-flag') {
    S.equip[el.dataset.k] = el.checked; persist(); if (!$('onb').open) render();
    if (el.checked && el.dataset.k === 'bench' && !$('onb').open && S.routine[activePlan(S).id]?.flat().some((it) => it.ex === 'press_suelo')) toast('Con banco podés cambiar el press en el suelo por press en banco: Entreno → Editar rutina.');
    if (el.checked && el.dataset.k === 'bar') toast('Las dominadas quedan disponibles en Entreno → Editar rutina (cuidado con el codo).');
  }
  if (a === 'eq-plates') {
    S.equip.db.plates ||= { bar: 2, items: [{ kg: 5, n: 4 }, { kg: 2.5, n: 4 }, { kg: 1.25, n: 4 }] };
    S.equip.db.plates.on = el.checked; persist(); $('onb').open ? renderOnb() : render();
  }
  if (el.dataset.plate) {
    const [i, k] = el.dataset.plate.split('.'), v = Number(String(el.value).replace(',', '.'));
    if (i === 'bar') S.equip.db.plates.bar = v >= 0 ? v : 0; else if (v >= 0) S.equip.db.plates.items[+i][k] = v;
    persist(); $('onb').open ? renderOnb() : render(); return;
  }
  if (a === 'weights-mode') { S.prefs.weights = el.value; persist(); $('onb').open ? renderOnb() : render(); }
  if (a === 'pref-toggle') { S.prefs[el.dataset.k] = el.checked; persist(); if (el.checked && el.dataset.k !== 'auto') cue('go', 'Así suena'); }
  if (a === 'hist-zone') { histZone = el.value; renderHistory(); }
  if (a === 'hist-ex') { histEx = el.value; renderHistory(); }
  if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
});
document.addEventListener('input', (e) => { if (e.target.dataset.w) { const [i, j, k] = e.target.dataset.w.split('.'); W.items[+i].rows[+j][k] = e.target.value; } });
// Escape cierra los diálogos; en entreno y rehab se pregunta antes.
document.addEventListener('cancel', (e) => { if (['wsheet', 'rsheet', 'painsheet', 'onb'].includes(e.target.id)) e.preventDefault(); }, true);

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (tab === 'home') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('¡App instalada!'); render(); });

// ——— Arranque ———
(async () => {
  try { const d = await db.get('data'); if (d) S = withDefaults(d); } catch (e) { toast('No se pudo abrir la base de datos: ' + e.message); }
  applyTheme();
  if (!S.onboarded || !S.seenVersion) { S.seenVersion = S.onboarded ? '1.2.0' : APP_VERSION; }   // quien ya usaba la app ve las novedades nuevas
  render();
  if (!S.onboarded) { renderOnb(); $('onb').showModal(); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (W || R)) keepAwake(true); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
})();
