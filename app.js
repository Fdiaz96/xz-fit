// XZ Fit (antes Tendón Fuerte) — rehabilitación de tendones y entreno con mancuernas. Los datos viven solo en el celular
// (IndexedDB). Los identificadores internos siguen siendo "tendon-fuerte" para no perder los datos ya guardados.
// Protocolo de tendones del video de Jeremy Ethier con Keith Baar y Coach Q; reglas en logic.js, bocetos en figures.js.

const APP_VERSION = '1.31.0';
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
// "Cambiamos 2 ejercicios por tu codo": los cambios del modo dolor dichos una vez, con el porqué plegado.
function swapNote(items) {
  const alts = [...new Map(items.filter((p) => p.r?.mode === 'alt' && !p.missing).map((p) => [p.ex.id, p])).values()];
  if (!alts.length) return '';
  const r = { zones: [...new Set(alts.flatMap((p) => p.r.zones))] }, n = alts.length;
  return `<details class="note pain swap-note"><summary><span>${n === 1 ? 'Cambiamos 1 ejercicio' : `Cambiamos ${n} ejercicios`} ${forZones(r)}</span><span class="why">Ver por qué</span></summary>
    <ul>${alts.map((p) => `<li><b>${esc(p.ex.name)}</b> en vez de ${esc(p.orig.name.toLowerCase())}</li>`).join('')}</ul>
    <p>En los últimos días el dolor pasó de ${PAIN_MAX} o amaneció peor. Hasta que se calme va una variante que carga menos la zona; cuando baje, vuelve el ejercicio de siempre con su peso.</p></details>`;
}
const CALIB_TAG = '<span class="calib-tag">calibración</span>';
const GUESS_TAG = '<span class="calib-tag">estimado</span>';

// ——— Estado y guardado ———
const DEFAULT = () => ({
  v: 1, onboarded: false, painMode: false, hidePainTip: false,
  profile: { name: '', sex: 'h', weight: '', height: '', age: '', exp: 'novato', days: 2 },
  equip: { db: { min: 2, max: 24, step: 2 }, kb: [], rings: false, bench: false, bar: false, band: false, machines: [] },
  equipBak: null,   // el equipo que había antes de elegir "Solo peso corporal", para devolverlo al destildarlo
  routine: {}, exlib: [],
  zones: {}, lifts: {}, sessions: [], checks: [], custom: [],
  backup: { last: '', snooze: '' },   // última copia guardada y hasta cuándo no recordarla
  plan: { id: 'fb2', custom: false, pos: 0, since: '', bw: false, deload: '', deloadOffer: '' },
  rem: { am: '08:00', pm: '20:00', train: ['lu', 'ju'], trainAt: '19:00' },
  prefs: { sound: true, voice: false, rest: 90, auto: true, theme: 'system', themeSet: false, weights: 'auto' }, seenVersion: '',
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
    plan: { ...plan, id: PLANS[plan.id] ? plan.id : 'fb2' }, backup: { ...base.backup, ...d.backup }, routine: { ...d.routine }, rem: { ...base.rem, ...d.rem }, prefs: { ...base.prefs, ...d.prefs }, exlib: d.exlib || [] };
  // Antes el tema arrancaba en oscuro: si nunca lo eligió, ahora sigue al del teléfono. Uno elegido (incluso Claro) se respeta.
  if (!out.prefs.themeSet && out.prefs.theme === 'dark') out.prefs.theme = 'system';
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
// Si ya está abierto, mantiene el scroll: marcar una serie no te lleva arriba de todo.
const dlg = (id) => ({
  set html(v) {
    const d = $(id), kept = ['toast', 'rest', 'tip'].map($).filter((el) => el.parentNode === d);
    const top = d.open ? d.querySelector('.dlg')?.scrollTop || 0 : 0;
    d.innerHTML = v; kept.forEach((el) => d.appendChild(el));
    const sc = d.querySelector('.dlg'); if (sc && top) sc.scrollTop = top;
  },
});
let toastTimer;
function overlayHost() { return [...document.querySelectorAll('dialog[open]')].pop() || document.body; }
// undo: función opcional que muestra el botón "Deshacer" (o el que diga label, p. ej. "Cambiar ahora"); el aviso dura más.
// El aviso no frena los toques (pasan al botón de abajo) y dura según lo que haya que leer.
let toastUndo = null;
function toast(msg, undo, label = 'Deshacer') {
  const t = $('toast'), host = overlayHost(); host.appendChild(t);
  t.querySelector('span').textContent = msg; t.hidden = false; t.style.top = t.style.bottom = '';
  t.querySelector('button')?.remove(); toastUndo = undo || null;
  if (undo) t.insertAdjacentHTML('beforeend', `<button type="button" data-action="undo">${esc(label)}</button>`);
  // Elige dónde pisa menos botones y campos: primero su lugar de siempre (en una hoja, el hueco de arriba si entra),
  // después arriba o abajo de todo; ante un empate queda el primero (igual deja tocar lo de abajo y dura poco).
  const sheetTop = host.matches?.('dialog.sheet') ? host.getBoundingClientRect().top - t.offsetHeight - 8 : -1;
  const places = [...(sheetTop >= 4 ? [[sheetTop + 'px', 'auto']] : []), ['', ''], ['calc(12px + var(--safe-t))', 'auto'], ['auto', 'calc(16px + var(--safe-b))']];
  const place = ([top, bottom]) => { t.style.top = top; t.style.bottom = bottom; };
  // Se ubica antes de pintar, cuando la pantalla ya se redibujó con lo que generó el aviso.
  requestAnimationFrame(() => {
    if (t.hidden) return;
    let best = places[0], min = Infinity;
    for (const pl of places) { place(pl); const n = coveredControls(t); if (n < min) { min = n; best = pl; } if (!n) break; }
    place(best);
  });
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, undo ? (label === 'Deshacer' ? 5000 : 7000) : Math.min(4500, 1800 + msg.length * 30));
}
// Cuántos puntos del aviso caen sobre un control. El aviso no recibe toques, así que elementFromPoint ve lo de abajo.
// Las filas del pizarrón de Hoy no cuentan: son la lista del día (se tocan para ver el detalle), no botones de acción.
function coveredControls(t) {
  const r = t.getBoundingClientRect(); let n = 0;
  for (const x of [r.left + 12, r.left + r.width / 2, r.right - 12]) for (const y of [r.top + 4, r.top + r.height / 2, r.bottom - 4]) {
    const el = document.elementFromPoint(x, y);
    if (el?.closest('button, input, select, textarea, a[href], #rest') && !el.closest('.board')) n++;
  }
  return n;
}
function hideToast() { clearTimeout(toastTimer); $('toast').hidden = true; toastUndo = null; }
// Un toque en cualquier otro lado cierra el aviso (salvo el que ofrece "Deshacer").
document.addEventListener('pointerdown', (e) => { const t = $('toast'); if (!t.hidden && !toastUndo && !t.contains(e.target)) hideToast(); }, true);

// ——— Tema ———
function applyTheme() {
  const pref = S.prefs.theme || 'system';
  const t = pref === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F2F3F5' : '#0E0F11');
  try { localStorage.setItem('tf-theme', t); } catch {}
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => (S.prefs.theme || 'system') === 'system' && applyTheme());

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
// Recordar la copia cada tanto: con 4 entrenos o más, si nunca guardaste una o pasó más de un mes (y no dijiste "Ahora no" hace poco).
const BACKUP_EVERY = 30;
const backupDue = (t) => S.sessions.filter((s) => s.type === 'entreno').length >= 4 && backupAge(t) > BACKUP_EVERY && !(S.backup.snooze > t);
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
  if (EXERCISES[id]) return kbAsDb(EXERCISES[id]);
  const c = S.exlib.find((x) => x.id === id);
  return c ? { ...c, custom: true, tag: c.tag || [], cues: c.note ? [c.note] : ['Ejercicio propio: anotá el peso y las repeticiones de cada serie.'], fig: customFig(c.impl) } : null;
}
// Sin pesas rusas, los ejercicios de pesa rusa que admiten mancuerna se hacen con mancuerna (implFor): el nombre,
// las indicaciones y el dibujo lo dicen, así no aparece una pesa rusa que no tenés.
const kbDb = new Map();
function kbAsDb(ex) {
  if (ex.impl !== 'kb' || !ex.alsoDb || S.equip?.kb?.length || !S.equip?.db) return ex;
  if (!kbDb.has(ex.id)) {
    const db = (s) => s.replace(/Pesa rusa o mancuerna/g, 'Mancuerna').replace(/pesa rusa/g, 'mancuerna').replace(/Pesa rusa/g, 'Mancuerna');
    kbDb.set(ex.id, { ...ex, name: db(ex.name), cues: ex.cues.map(db), fig: { ...ex.fig, props: ex.fig.props.map((p) => (p.t === 'kb' ? { ...p, t: 'db' } : p)) } });
  }
  return kbDb.get(ex.id);
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
// Al prender o apagar "Solo peso corporal" lo que no eligió el usuario se rearma con el equipo nuevo (si no, al volver
// a tener mancuernas quedarían los ejercicios sin material). Lo fijado y lo propio quedan.
function rearmRoutine() {
  const plan = activePlan(S), stored = S.routine[plan.id];
  if (stored?.length === plan.days.length) S.routine[plan.id] = refreshUnpinned(plan, stored, S.equip, engineOpts());
}
// "Cambiar ahora" del aviso del banco: el press en el suelo pasa a press en banco en todos los días (queda fijo, como
// si lo eligieras en Editar rutina) y se puede deshacer. Si el día ya tiene press en banco, ese queda como está.
function benchSwap() {
  const id = activePlan(S).id, before = JSON.parse(JSON.stringify(S.routine[id]));
  S.routine[id] = before.map((day) => day.map((it) => it.ex === 'press_suelo' && !day.some((x) => x.ex === 'press_banco') ? { ...it, ex: 'press_banco', pinned: true } : it));
  persist(); render();
  toast('Listo: press en banco en vez de press en el suelo.', () => { S.routine[id] = before; persist(); render(); });
}
// En el alta los accesorios no redibujan la pantalla: la casilla "Solo peso corporal" se acomoda sola.
const syncBwTile = () => document.querySelectorAll('[data-action="eq-bw"]').forEach((x) => (x.checked = noEquip(S.equip)));
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
  const slot = daySlot(spec, it.slot), range = S.profile.exp === 'novato' ? noviceRange(repRange(ex, slot)) : repRange(ex, slot);
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
// Cuándo toca la próxima sesión, con la del momento hecha: isométricos mañana y noche; isotónicos (fase 2), día por medio.
function rehabNext(slot, done) {
  const iso = Object.values(S.zones).some((z) => z.phase === 1);
  return !iso ? 'pasado mañana' : slot === 'mañana' && !done.noche ? 'a la noche' : 'mañana a la mañana';
}
const activeZones = () => Object.keys(S.zones);
function newZone(zone, pain = 5, side = 'der') {
  const ex = EXERCISES[REHAB_OPTIONS[zone][1][0]], steps = weightSteps(S.equip, implFor(ex, S.equip));
  return { side, pain0: pain, phase: 1, since: today(), load: ex.load0 ? roundDown(steps, ex.load0) : 0, secs: ISO_SECS };
}

// ——— Inicio ———
// Cuándo toca el próximo día del plan después de hoy: "mañana", "el jueves" o nada si no hay días marcados.
function nextTrainWhen(t) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, i);
    if (S.rem.train.includes(weekdayKey(d))) return i === 1 ? 'mañana' : `el ${parseDay(d).toLocaleDateString('es', { weekday: 'long' })}`;
  }
  return '';
}
function renderHome() {
  const t = today(), checks = pendingChecks(S, t);
  const hasZones = activeZones().length > 0;
  const ws = weekStats(S, t), st = streak(S, t);
  const date = parseDay(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }).replace(',', '');
  let h = `<header class="home-head"><p class="greet">${S.profile.name ? `Hola, ${esc(S.profile.name)}` : 'Hola'}</p><h1>${date[0].toUpperCase() + date.slice(1)}</h1></header>
    <div class="home-week">${homeWeek(t)}<p class="week-meta"><span>${ws.train} de ${ws.target} entrenos esta semana</span>${st ? `<span>Racha de ${st} ${st === 1 ? 'semana' : 'semanas'}</span>` : ''}
      ${ws.rehabTarget ? `<span class="rehab-n">${ws.rehab} de ${ws.rehabTarget} sesiones de rehabilitación</span>` : ''}</p></div>`;
  for (const zone of checks) {
    h += `<div class="card ask pain"><h3>¿Cómo amaneció tu ${esc(zoneName(zone).toLowerCase())}?</h3><p class="muted small">Comparado con ayer. Si está peor, bajamos la carga.</p>
      <div class="btns">${['mejor', 'igual', 'peor'].map((v) => `<button class="sec" data-action="check" data-zone="${zone}" data-val="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>`;
  }
  // Rehabilitación: va antes del entreno si falta la del momento; si ya está hecha, queda abajo y chica.
  let rehab = '', rehabFirst = false;
  if (S.painMode) {
    const items = rehabItems();
    const slot = slotNow(), done = { mañana: rehabDone('mañana'), noche: rehabDone('noche') };
    // Hecha la del momento, la tarjeta queda en su lugar con el tilde y lo próximo (los isotónicos de fase 2 ya no figuran hoy).
    if (items.length || S.custom.length || done[slot]) {
      rehabFirst = true;
      const cell = (s) => `<span class="slot${done[s] ? ' done' : ''}${s === slot ? ' now' : ''}">${s[0].toUpperCase() + s.slice(1)}<b>${done[s] ? 'Hecha ✓' : s === slot ? 'Toca ahora' : 'Pendiente'}</b></span>`;
      rehab = `<div class="card rehab${done[slot] ? ' done' : ''}"><div class="slots">${cell('mañana')}${cell('noche')}</div>
        <h3>Rehabilitación de la ${slot}${done[slot] ? ' hecha' : ''}</h3>
        <p class="muted small">${done[slot] ? `Lo próximo: ${rehabNext(slot, done)}.` : items.map((i) => esc(i.ex.name)).join(', ') || 'Tus ejercicios del fisio'}</p>
        ${done[slot] ? '' : `<button class="cta pain" data-action="start-rehab">Empezar rehabilitación</button>`}</div>`;
    } else if (!hasZones) rehab = `<div class="card ask pain"><h3>Modo dolor activo</h3><p class="muted small">Marcá qué te duele en la pestaña Dolor para armar tu rehabilitación.</p></div>`;
    else rehab = `<div class="card ask pain"><h3>Hoy no hay rehabilitación aparte</h3>${Object.values(S.zones).some((z) => z.phase === 3) ? '<p class="muted small">Los isométricos de mantenimiento van al final del entreno.</p>' : ''}</div>`;
  }
  // Con zonas marcadas y el modo apagado, la propuesta va arriba de la rutina: cambia los pesos de hoy.
  if (!S.painMode && hasZones && !S.hidePainTip) {
    h += `<div class="card ask pain"><h3>Tenés dolor en ${esc(activeZones().map((z) => zoneName(z).toLowerCase()).join(' y '))}</h3>
      <p class="muted small">El modo dolor agrega isométricos diarios y cuida esas zonas en el entreno de hoy. También lo prendés desde la pestaña Dolor.</p>
      <div class="btns"><button class="cta pain" data-action="pain-mode-on">Activar modo dolor</button></div>
      <button class="link" data-action="hide-pain-tip">Ahora no</button></div>`;
  }
  if (rehabFirst) h += rehab;
  // El entreno del día, como la pizarra del gimnasio: el día en grande y la lista en orden.
  const plan = activePlan(S), day = dayIndex(plan, S.plan.pos), doable = planFor(day).filter((p) => !p.missing);
  const last = S.sessions.find((s) => s.type === 'entreno');
  const doneToday = last?.date === t, trainDay = S.rem.train.includes(weekdayKey(t));
  // Sin entrenos guardados, el día no importa: el primero siempre se presenta en positivo.
  const first = !last;
  const firstHint = doable.some((p) => p.calib) ? ' Con la primera serie de cada ejercicio calibramos tus pesos.'
    : doable.some((p) => p.guess) ? ' Los pesos con ≈ son estimados: con tu primera serie ajustamos el resto.'
    : doable.some((p) => p.pick) ? ' Elegís vos los pesos de cada ejercicio.' : '';
  const dayMsg = first ? `Tu primer entreno.${firstHint}` : 'Hoy toca entrenar';
  // El peso con su unidad, igual que en Entreno; si todavía no es un peso de trabajo, la etiqueta va debajo.
  // "Estimado" se explica una sola vez debajo de la lista; cada peso estimado lleva solo un ≈ delante.
  const load = (p) => p.ex.kind !== 'peso' ? '' : p.guess && !p.calib ? `<span class="load guess"><i aria-label="estimado">≈</i>${loadText(p)}</span>` : `<span class="load">${loadText(p)}${loadTag(p)}</span>`;
  const guessNote = !first && doable.some((p) => p.guess && !p.calib && p.ex.kind === 'peso') ? `<p class="board-note">≈ Peso estimado: sale de tu perfil y de lo que levantás en otros ejercicios. Con tu primera serie lo ajustamos.</p>` : '';
  const board = `<ol class="board">${doable.map((p) => `<li><button data-action="ex-detail" data-ex="${p.ex.id}"><span class="name">${esc(p.ex.name)}${p.r ? `<em>${painTag(p.r)}</em>` : ''}</span><span class="dose">${p.sets} × ${setLabel(p)}</span>${load(p)}<span class="chev" aria-hidden="true">›</span></button></li>`).join('')}</ol>${guessNote}`;
  const mins = workoutMinutes(doable.reduce((n, p) => n + p.sets, 0), S.prefs.rest || REST_SECS);
  const title = `<h3><span class="day-name">${esc(plan.days[day].name)}</span><span class="sep"> · </span><span class="day-count">${doable.length} ejercicios${mins ? ` · ~${mins} min` : ''}</span></h3>`;
  const lastLine = last && last.date !== t ? `<span>Último: ${fmtDate(last.date)}</span>` : '';
  const deloadNote = S.plan.deload === weekKey(t) ? ' Semana de descarga.' : '';
  if (LIVE) {
    // Un entreno quedó sin terminar (recarga o pestaña descargada): retomarlo es lo primero, tal como quedó.
    const total = LIVE.items.reduce((n, it) => n + it.rows.length, 0), sets = LIVE.items.reduce((n, it) => n + it.rows.filter((r) => r.done).length, 0);
    const at = new Date(LIVE.started), when = dayKey(at) === t ? '' : ` del ${at.toLocaleDateString('es', { weekday: 'long' })}`;
    h += `<section class="card today on resume">
    <p class="plan-line"><span>${esc(plan.name)}</span><span>Empezado${when} a las ${at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></p>
    <p class="day-msg">Tenés un entreno sin terminar. Quedó guardado tal como lo dejaste.</p>
    <h3><span class="day-name">${esc(LIVE.dayName)}</span><span class="sep"> · </span><span class="day-count">${sets} de ${total} series</span></h3>
    <div class="w-track resume-track" aria-hidden="true">${LIVE.items.map((it) => `<i style="flex:${it.rows.length}"><b style="width:${(100 * it.rows.filter((r) => r.done).length) / it.rows.length}%"></b></i>`).join('')}</div>
    <button class="cta stick" data-action="resume-workout">Seguir entreno</button>
    <button class="link danger resume-drop" data-action="discard-workout">Descartar este entreno</button></section>`;
  } else if (!first && (doneToday || !trainDay)) {
    // Ya entrenó o hoy no es día del plan: el estado va en grande y lo próximo queda en segundo plano, sin empujar a entrenar.
    const when = nextTrainWhen(t), done = S.sessions.filter((s) => s.type === 'entreno' && s.date === t);
    const sets = done.reduce((n, s) => n + (s.sets || 0), 0), min = done.reduce((n, s) => n + (s.min || 0), 0);
    const names = [...new Set(done.map((s) => activePlan(S).days[s.day]?.name ?? `Entreno ${s.tpl}`))].join(' y ');
    const sum = doneToday ? `${esc(names)}: ${sets} ${sets === 1 ? 'serie' : 'series'}${min ? ` en ${min} ${min === 1 ? 'minuto' : 'minutos'}` : ''}.` : 'Descansar también es parte del plan.';
    h += `<section class="card today rest">
    <p class="plan-line"><span>${esc(plan.name)}</span>${lastLine}</p>
    <h2 class="rest-title">${doneToday ? 'Hoy ya entrenaste' : 'Hoy descansás'}</h2>
    <p class="rest-sum">${sum}${deloadNote}</p>
    <div class="next"><p class="next-when">Próximo${when ? `, ${when}` : ''}</p>${title}
      <details class="next-list"><summary>Ver ejercicios</summary>${board}</details></div>
    <button class="sec next-go" data-action="start-workout" data-day="${day}">${doneToday ? 'Entrenar igual' : 'Empezar igual'}</button></section>`;
  } else h += `<section class="card today on">
    <p class="plan-line"><span>${esc(plan.name)}</span>${lastLine}</p>
    <p class="day-msg">${dayMsg}${deloadNote}</p>
    ${title}${swapNote(doable)}${board}
    <button class="cta stick" data-action="start-workout" data-day="${day}">Empezar ${esc(plan.days[day].name.toLowerCase())}</button></section>`;
  if (S.painMode && hasZones) h += `<button class="sec quick-pain" data-action="quick-pain">Anotar cómo está el dolor ahora</button>`;
  if (!rehabFirst) h += rehab;
  // Avisos y decisiones pendientes, debajo del entreno.
  if (S.painMode) for (const zone of activeZones()) if (phaseReady(S, zone, t)) h += `<div class="card ask pain"><h3>${esc(zoneName(zone))}: lista para avanzar</h3><p class="muted small">Dolor ≤ 3 y sin empeorar toda la semana.</p><button class="link" data-action="phase" data-zone="${zone}" data-dir="1">Pasar a ${esc(PHASES[S.zones[zone].phase + 1].name.toLowerCase())}</button></div>`;
  const stuck = [...new Set(S.routine[plan.id].flat().map((it) => it.ex))].filter((id) => S.lifts[id] && stalled(S, id));
  if (stuck.length >= 2 && S.plan.deload !== weekKey(t) && S.plan.deloadOffer !== weekKey(t)) h += `<div class="card ask"><h3>¿Semana de descarga?</h3><p class="muted small">${stuck.length} ejercicios no progresan hace 3 sesiones (${stuck.slice(0, 3).map((id) => esc(getEx(id)?.name.toLowerCase() || id)).join(', ')}). Una semana con una serie menos y 90 % del peso suele destrabar.</p><div class="btns"><button class="cta" data-action="deload">Hacer descarga esta semana</button></div><button class="link" data-action="deload-no">Ahora no</button></div>`;
  if (plan.id === 'fb2' && suggestThreeDays(S, t)) h += `<div class="card ask"><h3>¿Probás Full body 3 días?</h3><p class="muted small">Venís constante. Con un día más entrenás cada músculo 3 veces por semana, con ejercicios distintos cada día.</p><button class="link" data-action="three-days">Ver el plan</button></div>`;
  const lvl = suggestLevelUp(S, t, getEx);
  if (lvl) {
    const name = EXPERIENCE.find((x) => x.id === lvl.next).name, times = Math.round(lvl.perWeek);
    h += `<div class="card ask"><h3>¿Actualizamos tu experiencia?</h3>
      <p class="muted small">Entrenás hace ${lvl.months} meses, unas ${times} veces por semana, y ${lvl.why === 'strong' ? 'levantás más de lo que estimamos para tu nivel' : 'tus pesos dejaron de subir aunque ya hiciste una descarga'}. Te proponemos pasar a «${esc(name.toLowerCase())}».</p>
      <p class="muted small">${lvl.next === 'medio' ? 'El rango de repeticiones vuelve a ser el completo (por ejemplo 6–12) y los' : 'Los'} pesos de ejercicios nuevos se estiman más altos. Tus pesos de trabajo no cambian.</p>
      <div class="btns"><button class="cta" data-action="level-up" data-v="${lvl.next}">Cambiar experiencia</button></div>
      <button class="link" data-action="level-no">Ahora no</button></div>`;
  }
  if (backupDue(t)) h += `<div class="card ask backup-ask"><h3>¿Guardás una copia?</h3><p class="muted small">Tus datos viven solo en este teléfono. ${lastBackupText(t)} Guardala en Drive, el correo o WhatsApp.</p><div class="btns"><button class="cta" data-action="export">Guardar copia</button></div><button class="link" data-action="backup-no">Ahora no</button></div>`;
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
    <p class="muted train-sub">${esc(plan.name)}: cada ejercicio sube dentro de su rango.</p>`;
  if (!S.profile.weight) h += `<div class="note acc">Completá tu peso en Ajustes para que la app estime cuánto levantar.</div>`;
  if (S.plan.deload === weekKey(today())) h += `<div class="note acc">Semana de descarga: una serie menos y 90 % del peso. <button class="link small" data-action="deload-off">Cancelar</button></div>`;
  if (editRoutine) h += planCard() + `<div class="note acc">Cambiá, quitá, agregá u ordená ejercicios. Las series y las reps las ajusta la app: cuando llegás al tope del rango sube el peso, y en la semana de descarga baja una serie.</div>`;
  if (editRoutine) h += `<div class="chips day-tabs">${plan.days.map((dd, d) => `<button class="chip${d === editDay ? ' on' : ''}" data-action="edit-day" data-day="${d}">${esc(dd.name)}</button>`).join('')}</div>`;
  // Cada día como en la pizarra del inicio: el nombre en grande, el que toca subrayado en lima y con el botón lleno.
  plan.days.forEach((dd, d) => {
    if (editRoutine && d !== editDay) return;
    const items = planFor(d), now = d === todayDay;
    h += `<section class="plan-day${now ? ' now' : ''}"><h2><span class="day-name">${esc(dd.name)}</span>${now ? '<span class="sep"> · </span><span class="day-now">toca hoy</span>' : ''}</h2>${editRoutine ? '' : swapNote(items)}<ul class="plan-list">`;
    h += items.map((p, i) => `<li class="ex${p.missing ? ' missing' : ''}${editRoutine ? ' editing' : ''}"${editRoutine ? '' : ` data-action="ex-detail" data-ex="${p.ex.id}"`}>
        <div class="thumb">${figureSVG(p.ex, { crop: true })}</div>
        <div class="info"><h3>${esc(p.ex.name)}</h3><p class="dose">${p.missing ? 'Falta equipo' : `${p.sets} × ${setLabel(p)}`}${p.r ? `<em>${painTag(p.r)}</em>` : ''}</p>${p.stalled && !editRoutine ? `<p class="stall">Estancado: <button class="link small" data-action="unstall" data-ex="${p.ex.id}">bajar 10 % y volver a subir</button></p>` : ''}</div>
        ${editRoutine ? `<div class="tools"><button class="move" data-action="routine-move" data-day="${d}" data-i="${i}" data-d="-1" aria-label="Subir" ${i ? '' : 'disabled'}>↑</button><button class="move" data-action="routine-move" data-day="${d}" data-i="${i}" data-d="1" aria-label="Bajar" ${i < items.length - 1 ? '' : 'disabled'}>↓</button>
          <button class="sec" data-action="routine-pick" data-day="${d}" data-i="${i}">Cambiar</button><button class="sec del" data-action="routine-del" data-day="${d}" data-i="${i}">Quitar</button></div>`
          : `<div class="w">${p.ex.kind === 'peso' ? `${p.w ? `<span class="num">${String(p.w).replace('.', ',')}</span><span class="unit">kg</span>` : `<span class="unit">${loadText(p)}</span>`}${loadTag(p)}` : ''}</div>`}</li>`).join('');
    h += `</ul>`;
    h += editRoutine ? `<button class="sec add-ex" data-action="routine-pick" data-day="${d}">+ Agregar ejercicio</button>`
      : `<button class="cta${now ? ' stick' : ' ghost'}" data-action="start-workout" data-day="${d}" ${items.some((p) => !p.missing) ? '' : 'disabled'}>Empezar ${esc(dd.name)}</button>`;
    h += `</section>`;
  });
  // Lo destructivo y global va al final, lejos de agregar ejercicio.
  if (editRoutine) h += `<div class="routine-reset"><button class="quiet" data-action="routine-reset">Volver al plan original</button></div>`;
  $('view-train').innerHTML = h;
}
function routineSet(day, items) { S.routine[activePlan(S).id][day] = items; persist(); render(); }

// ——— Plan de entrenamiento (primer uso, Editar rutina → Cambiar plan y Ajustes) ———
// "Lu, Mi y Vi"
const daysText = (keys) => { const n = keys.map((k) => DAY_NAMES[k]); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0] || ''; };
// Semana tipo: los días de entrenamiento con la sigla del día del plan que toca, en orden de rotación.
// Con action, cada día es un botón para marcarlo o desmarcarlo.
function weekStrip(plan, days, action) {
  let i = 0;
  const cells = Object.entries(DAY_NAMES).map(([k, v]) => {
    const on = days.includes(k), sigla = on ? plan.days[i++ % plan.days.length].short : '';
    const inner = `<small>${v}</small><b>${esc(sigla)}</b>`;
    return action ? `<button class="${on ? 'on' : ''}" data-action="${action}" data-v="${k}" aria-pressed="${on}" aria-label="${v}">${inner}</button>` : `<span class="${on ? 'on' : ''}">${inner}</span>`;
  }).join('');
  return action ? `<div class="week-strip edit">${cells}</div>` : `<div class="week-strip" role="img" aria-label="${esc(`Entrenás ${daysText(days)}`)}">${cells}</div>`;
}
// Qué quiere decir cada sigla de la tira ("TA Torso A"). Con días "Día A/B/C" la sigla ya se entiende sola.
function stripLegend(plan) {
  if (plan.days.every((d) => d.name === `Día ${d.short}`)) return '';
  return `<p class="strip-legend">${plan.days.map((d) => `<span><b>${esc(d.short)}</b> ${esc(d.name)}</span>`).join('')}</p>`;
}
// La semana actual en el inicio: cada día con la sigla de lo hecho o de lo que toca, hoy marcado y lo hecho tildado.
// Tocar un día muestra debajo qué toca (o qué se hizo) con el nombre completo.
let homePeek = '';   // fecha del día tocado en la tira del inicio
function homeWeek(t) {
  const plan = activePlan(S), days = weekPlan(S, t);
  const longDay = (date) => { const n = parseDay(date).toLocaleDateString('es', { weekday: 'long' }); return n[0].toUpperCase() + n.slice(1); };
  const what = (x) => {
    const name = x.day !== null ? plan.days[x.day].name : '';
    if (x.done) return name ? `hiciste ${name}` : 'entrenaste';
    if (x.day !== null) { const n = planFor(x.day).filter((p) => !p.missing).length; return `${x.today ? 'toca ' : ''}${name}, ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`; }
    return x.train && x.past ? 'no entrenaste' : 'descanso';
  };
  const cells = days.map((x) => {
    const sigla = x.day !== null ? plan.days[x.day].short : x.done ? '✓' : '';
    const cls = [x.done ? 'done' : x.day !== null ? 'plan' : x.train && x.past ? 'missed' : 'rest', x.today ? 'now' : '', homePeek === x.date ? 'peek' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-action="week-day" data-v="${x.date}" aria-pressed="${homePeek === x.date}" aria-label="${esc(`${x.today ? 'Hoy, ' : ''}${longDay(x.date)}: ${what(x)}`)}"><small>${x.today ? 'Hoy' : DAY_NAMES[x.k]}</small><b>${esc(sigla)}</b></button>`;
  }).join('');
  const peek = days.find((x) => x.date === homePeek);
  return `<div class="week-strip home">${cells}</div>${peek ? `<p class="week-peek" role="status"><b>${peek.today ? 'Hoy' : longDay(peek.date)}</b>: ${esc(what(peek))}.</p>` : ''}`;
}
// Elección de plan en curso: { id, days }. id es un plan de la lista o 'custom' (a tu medida: los días deciden el plan).
const MAX_DAYS = 6;   // el séptimo día siempre es de descanso
const choicePlan = (c) => PLANS[c.id === 'custom' ? PLAN_BY_DAYS[c.days.length] || 'fb2' : c.id];
const currentChoice = () => ({ id: S.plan.custom ? 'custom' : activePlan(S).id, days: [...S.rem.train] });
// Cambiar de plan en la lista propone sus días; pasar a "a tu medida" conserva los días marcados.
const pickChoice = (c, id) => ({ id, days: id === 'custom' ? c.days.slice(0, MAX_DAYS) : [...PLANS[id].week] });
// Tocar un día: lo saca o lo suma. Un plan de la lista tiene una cantidad fija de días; a tu medida, de 1 a 6.
// Con el plan de la lista lleno, tocar un día libre mueve ahí el día marcado más cercano (moved: [de, a]).
// Devuelve la elección nueva o un texto con lo que falta.
function toggleChoiceDay(c, k) {
  if (c.days.includes(k)) return c.id === 'custom' && c.days.length === 1 ? 'Elegí al menos un día.' : { ...c, days: c.days.filter((d) => d !== k) };
  const max = c.id === 'custom' ? MAX_DAYS : PLANS[c.id].days.length, keys = Object.keys(DAY_NAMES);
  if (c.days.length >= max && c.id === 'custom') return 'Dejá al menos un día de descanso por semana.';
  const from = c.days.length >= max ? nearestDay(c.days, k, keys) : null;
  return { id: c.id, days: keys.filter((d) => (c.days.includes(d) && d !== from) || d === k), ...(from ? { moved: [from, k] } : {}) };
}
// "Pasamos el entreno del Lu al Ma."
const movedText = ([from, to]) => `Pasamos el entreno del ${DAY_NAMES[from]} al ${DAY_NAMES[to]}.`;
// Qué falta para confirmar ('' si está completa).
function choiceMissing(c) {
  if (c.id === 'custom') return c.days.length ? '' : 'Elegí al menos un día.';
  const left = PLANS[c.id].days.length - c.days.length;
  return left > 0 ? `Elegí ${left} ${left === 1 ? 'día más' : 'días más'} para ${PLANS[c.id].name}.` : '';
}
// Guarda la elección en el estado; con restart, la rotación y la rampa vuelven a empezar si cambia el plan (en el alta las inicia onbNext).
function applyChoice(c, restart = false) {
  const plan = choicePlan(c);
  if (restart && plan.id !== activePlan(S).id) S.plan = { ...S.plan, pos: 0, since: today(), deload: '' };
  S.plan = { ...S.plan, id: plan.id, custom: c.id === 'custom' };
  S.rem.train = [...c.days]; S.profile.days = c.days.length;
}
// Cómo se tocan los días: en un plan de la lista la cantidad es fija, así que tocar un día libre mueve ahí el más cercano.
const dayHint = (id) => (id === 'custom' ? 'Tocá un día para sumarlo o sacarlo.' : 'Tocá un día libre para pasar ahí el entreno más cercano.');
function planCard() {
  const plan = activePlan(S);
  return `<div class="plan-card"><div class="row"><div><span class="small muted">Tu plan${S.plan.custom ? ', a tu medida' : ''}</span><h3>${esc(plan.name)}</h3></div><button class="sec" data-action="plan-open">Cambiar plan</button></div>
    ${weekStrip(plan, S.rem.train, 'card-day')}${stripLegend(plan)}
    <p class="small muted">Rota ${esc(plan.days.map((d) => d.name).join(', '))}. Si faltás un día, seguís con el que toca. ${dayHint(S.plan.custom ? 'custom' : plan.id)}</p></div>`;
}
// Los ejercicios de cada día del plan: la versión guardada (con los cambios del usuario) si existe; si no, la que se armaría hoy.
function planExercises(p) {
  const saved = S.routine[p.id]?.length === p.days.length ? S.routine[p.id] : resolvePlan(p, S.equip, engineOpts());
  const names = (day) => day.filter((it) => getEx(it.ex)).map((it) => getEx(it.ex).name).join(', ');
  return { saved, html: `<details class="cues"><summary>Ver ejercicios</summary><ul>${p.days.map((d, i) => `<li><b>${esc(d.name)}:</b> ${esc(names(saved[i]))}</li>`).join('')}</ul>
      <p class="small"><a href="${p.source.url}" target="_blank" rel="noopener">${esc(p.source.title)}</a></p></details>` };
}
const missingNote = (saved) => {
  const n = saved.flat().filter((it) => !possible(it.ex, S.equip, getEx)).length;
  return n ? `<small class="warn">Con tu equipo, ${n === 1 ? '1 ejercicio queda' : `${n} ejercicios quedan`} como "falta equipo".</small>` : '';
};
// En un plan que no es el actual: qué cambios suyos recupera al volver (solo si los hay). Muestra dos y cuenta el resto.
function keptChanges(p, saved) {
  if (S.routine[p.id]?.length !== p.days.length) return '';
  const name = (id) => getEx(id)?.name, low = (id) => name(id).toLowerCase();
  const ch = routineChanges(saved, freshRoutine(p)).filter((x) => (!x.from || name(x.from)) && (!x.to || name(x.to)));
  if (!ch.length) return '';
  const where = (x) => (p.days.length > 1 ? ` (${p.days[x.day].name})` : '');
  const text = (x) => ({ swap: () => `${name(x.to)} en vez de ${low(x.from)}`, add: () => `sumaste ${low(x.to)}`, del: () => `sacaste ${low(x.from)}`, order: () => 'otro orden' })[x.kind]() + where(x);
  const more = ch.length - 2;
  return `<small class="kept">Vuelve con tus cambios: ${esc(ch.slice(0, 2).map(text).join('; '))}${more > 0 ? ` y ${more} ${more === 1 ? 'cambio más' : 'cambios más'}` : ''}.</small>`;
}
// Planes agrupados por tipo y al final el plan a tu medida. Lo usan la hoja "Elegí tu plan" y el primer uso.
// El elegido muestra su semana con los días para tocar. action/dayAction son los data-action del radio y de los días,
// cur el plan actual (null en el alta) y tag la marca junto al nombre.
function planOptions(c, { action, dayAction, cur = null, tag = {} }) {
  const days = (p) => {
    const miss = choiceMissing(c);
    return `${weekStrip(p, c.days, dayAction)}${stripLegend(p)}<p class="small ${miss ? 'warn' : 'muted'} day-hint">${esc(miss) || (c.id === 'custom' ? 'Tocá los días para elegir cuáles entrenás.' : dayHint(c.id))}</p>`;
  };
  const opt = (p) => {
    const on = c.id === p.id, ex = planExercises(p);
    return `<div class="plan-opt${on ? ' on' : ''}"><label class="tile"><input type="radio" name="plan" data-action="${action}" value="${p.id}" ${on ? 'checked' : ''}><span>
        <b>${esc(p.name)}${tag[p.id] ? ` <em class="tag-now">${tag[p.id]}</em>` : ''}</b>
        <small>${p.days.length} días por semana, ${p.mins} min por sesión. ${esc(p.for)}</small>
        ${on ? '' : weekStrip(p, p.week)}${missingNote(ex.saved)}
        ${cur && p.id !== cur ? keptChanges(p, ex.saved) : ''}
      </span></label>${on ? days(p) : ''}${ex.html}</div>`;
  };
  let h = Object.entries(PLAN_KINDS).map(([kind, title]) => `<h2>${esc(title)}</h2>${Object.values(PLANS).filter((p) => p.kind === kind).map(opt).join('')}`).join('');
  const on = c.id === 'custom', mine = on && choicePlan(c), ex = mine && planExercises(mine), n = c.days.length;
  h += `<h2>A tu medida</h2><div class="plan-opt${on ? ' on' : ''}"><label class="tile"><input type="radio" name="plan" data-action="${action}" value="custom" ${on ? 'checked' : ''}><span>
      <b>Personalizado${tag.custom ? ` <em class="tag-now">${tag.custom}</em>` : ''}</b>
      <small>${on ? `${n} ${n === 1 ? 'día' : 'días'} por semana: la app arma ${esc(mine.name)}. ${esc(mine.for)}` : 'Elegís cuántos días entrenás y cuáles. La app arma el plan que mejor encaja, de 1 a 6 días.'}</small>
      ${on ? missingNote(ex.saved) : ''}
    </span></label>${on ? days(mine) + ex.html : ''}</div>`;
  return h;
}
let PC = null;   // elección en la hoja "Elegí tu plan", antes de confirmar
function openPlans(id) { PC = id ? pickChoice(currentChoice(), id) : currentChoice(); renderPlans(); if (!$('plansheet').open) $('plansheet').showModal(); }
function renderPlans() {
  const now = currentChoice(), same = PC.id === now.id && PC.days.join() === now.days.join(), miss = choiceMissing(PC), plan = choicePlan(PC);
  const keeps = plan.id === activePlan(S).id;
  let h = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="plansheet">Cancelar</button><strong>Elegí tu plan</strong><span></span></div>
    <p class="muted small">La app arma los ejercicios de cada día con tu equipo. Después podés cambiar cualquiera en Editar rutina.</p>`;
  h += planOptions(PC, { action: 'plan-sel', dayAction: 'plan-day', cur: activePlan(S).id, tag: { [now.id]: 'el tuyo' } });
  h += `<div class="plan-foot">${same ? '<button class="cta" disabled>Es tu plan actual</button>'
    : miss ? `<button class="cta" disabled>Usar ${esc(plan.name)}</button><p class="small warn">${esc(miss)}</p>`
    : `<button class="cta" data-action="plan-use">${keeps ? 'Guardar los días' : `Usar ${esc(plan.name)}`}</button><p class="small muted">Entrenás ${daysText(PC.days)}${keeps ? ' y seguís con el día que te toca' : ` y el primer entreno es ${esc(plan.days[0].name)}`}. Tus pesos y tu historial se mantienen.</p>`}</div></div>`;
  dlg('plansheet').html = h;
}
// Tocar un día en la hoja o en el alta: actualiza la elección o explica por qué no.
function choiceDay(c, k, then) {
  const r = toggleChoiceDay(c, k); if (typeof r === 'string') return toast(r);
  then({ id: r.id, days: r.days });
  if (r.moved) toast(movedText(r.moved));
}
// Tocar un día en la tarjeta "Tu plan" (Editar rutina y Ajustes): guarda al toque, con Deshacer. Si el cambio arma
// otro plan (a tu medida con más o menos días) abre la hoja para confirmarlo; un día marcado se mueve tocando el libre.
function cardDay(k) {
  const before = currentChoice(), r = toggleChoiceDay(before, k);
  if (typeof r === 'string') return toast(r);
  const c = { id: r.id, days: r.days };
  if (choiceMissing(c)) return toast(`Para mover el ${DAY_NAMES[k]}, tocá el día libre adonde lo querés pasar.`);
  if (choicePlan(c).id !== activePlan(S).id) { PC = c; renderPlans(); return $('plansheet').showModal(); }
  applyChoice(c); persist(); render();
  toast(`${r.moved ? movedText(r.moved) + ' ' : ''}Entrenás ${daysText(S.rem.train)}.`, () => { applyChoice(before); persist(); render(); });
}
function usePlan() {
  if (choiceMissing(PC)) return toast(choiceMissing(PC));
  const before = activePlan(S).id;
  applyChoice(PC, true);
  const plan = activePlan(S);
  if (plan.id !== before) editDay = 0;
  PC = null; $('plansheet').close(); persist(); render();
  toast(plan.id !== before ? `Plan cambiado a ${plan.name}. Entrenás ${daysText(S.rem.train)}.` : `Días guardados: ${daysText(S.rem.train)}.`);
}
// Plan sugerido en el primer uso según la experiencia: cuerpo completo 3 días para quien empieza, torso y pierna para el resto.
const recommendedPlan = (exp) => (exp === 'novato' ? 'fb3' : 'tp4');

// Selector de ejercicios (agregar o cambiar uno de la rutina)
let PK = null;   // { day, i }
function openPicker(day, i) {
  if (!$('pickersheet').open) pickQ = '';   // la búsqueda se mantiene solo mientras el selector sigue abierto
  PK = { day: Number(day), i: i === undefined || i === null ? null : Number(i) };
  const item = PK.i != null ? dayItems(PK.day)[PK.i] : null, current = item ? getEx(item.ex) : null;
  const lib = Object.values(EXERCISES).filter((e) => e.cat);
  // Lo que ya está en el día no se ofrece de nuevo: evita tener el mismo ejercicio dos veces.
  const inDay = new Set(dayItems(PK.day).map((it) => it.ex));
  const row = (e) => {
    const ok = !!implFor(e, S.equip), here = inDay.has(e.id) && current?.id !== e.id;
    // Qué tendones exige solo importa con el modo dolor prendido; sin él, la fila queda con el nombre solo.
    const sub = here ? '✓ Ya está en este día' : !ok ? 'Falta: ' + missingLabel(e) : !S.painMode ? '' : e.tag?.length ? 'Exige ' + e.tag.map((z) => zoneName(z).toLowerCase()).join(', ') : 'No carga tendones sensibles';
    return `<button class="pick${current?.id === e.id ? ' on' : ''}${here ? ' here' : ''}" data-action="pick-ex" data-ex="${e.id}" data-q="${esc(fold(e.name))}" ${ok && !here ? '' : 'disabled'}><div class="thumb">${figureSVG(e, { animate: false, crop: true })}</div><span><b>${esc(e.name)}</b>${sub ? `<br><span class="small muted">${sub}</span>` : ''}</span></button>`;
  };
  // Al cambiar, primero los ejercicios del mismo hueco; esos ids no se repiten en las categorías.
  const slot = item?.slot ? SLOTS[item.slot] : null;
  const slotIds = new Set(slot ? slot.ex : []);
  let h = `<div class="dlg"><div class="dlg-head pick-head"><button class="link" data-action="close" data-dlg="pickersheet">Cancelar</button><strong>${PK.i != null ? 'Cambiar ejercicio' : `Agregar a ${esc(activePlan(S).days[PK.day].name)}`}</strong><span></span>
    <input type="search" id="pick-q" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" autocomplete="off" enterkeyhint="search" value="${esc(pickQ)}"></div>`;
  if (slot) h += `<h2>Mismo movimiento: ${esc(slot.name.toLowerCase())}</h2>${slot.ex.map((id) => row(getEx(id))).join('')}`;
  h += `<h2>Mis ejercicios</h2>${S.exlib.map((c) => `<div class="pick-row">${row(getEx(c.id))}<button class="link" data-action="exform" data-id="${c.id}">Editar</button></div>`).join('')}
    <button class="sec" style="width:100%" data-action="exform">+ Crear ejercicio propio</button>`;
  for (const [c, name] of Object.entries(CATS)) {
    const inCat = lib.filter((e) => e.cat === c && !slotIds.has(e.id));
    if (inCat.length) h += `<h2>${esc(name)}</h2>${inCat.map(row).join('')}`;
  }
  h += `<p class="pick-none small muted" hidden>Ningún ejercicio se llama así. Probá con otra palabra o creá uno propio.</p>`;
  dlg('pickersheet').html = h + '</div>';
  filterPicker();
  if (!$('pickersheet').open) $('pickersheet').showModal();
}
// Búsqueda del selector: filtra por nombre sin tildes ni mayúsculas y oculta los grupos que quedan vacíos.
let pickQ = '';
const fold = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function filterPicker() {
  const d = $('pickersheet'), q = fold(pickQ.trim());
  let any = false;
  d.querySelectorAll('button.pick').forEach((b) => {
    const hit = !q || b.dataset.q.includes(q);
    (b.closest('.pick-row') || b).hidden = !hit; any ||= hit;
  });
  d.querySelectorAll('.dlg > h2').forEach((t) => {
    let n = t.nextElementSibling, vis = false;
    for (; n && n.tagName !== 'H2'; n = n.nextElementSibling) if (n.matches('button.pick, .pick-row') && !n.hidden) vis = true;
    t.hidden = !vis && t.textContent !== 'Mis ejercicios';   // Mis ejercicios queda: tiene "+ Crear ejercicio propio"
  });
  const none = d.querySelector('.pick-none'); if (none) none.hidden = any;
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
  // Al agregar, el ejercicio nuevo y "+ Agregar ejercicio" quedan a la vista, no debajo del aviso.
  if (!swap) document.querySelector('#view-train .add-ex')?.scrollIntoView({ block: 'center' });
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
    <button class="link small xf-mach" data-action="xf-mach">+ Agregar máquina</button>
    <span class="small muted">Cómo se registra</span><div class="chips" style="margin:4px 0 8px">${[['peso', 'Kilos × reps'], ['reps', 'Solo reps'], ['tiempo', 'Segundos']].map(([k, n]) => `<button class="chip${c.kind === k ? ' on' : ''}" data-action="xf-kind" data-v="${k}">${n}</button>`).join('')}</div>
    ${c.kind === 'peso' ? `<label class="field"><span>Peso para empezar (kg, opcional: se ajusta con la primera serie)</span><input id="x-start" type="number" inputmode="decimal" step="0.5" value="${esc(c.start || '')}"></label>` : ''}
    <label class="field"><span>Grupo</span><select id="x-cat">${Object.entries(CATS).map(([k, n]) => `<option value="${k}" ${c.cat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <span class="small muted">Tendones que exige (para el modo dolor)</span><div class="chips" style="margin-top:4px">${ZONES.map((z) => `<button class="chip pain${c.tag.includes(z.id) ? ' on' : ''}" data-action="xf-tag" data-v="${z.id}">${esc(z.name)}</button>`).join('')}</div>
    <label class="field"><span>Nota o indicaciones</span><textarea id="x-note" rows="2">${esc(c.note)}</textarea></label>
    <p class="faint small">Las series y las reps las arma la app según cómo se registra, igual que en el resto de la rutina.</p>
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
async function deleteExForm() {
  if (!await ask({ title: '¿Eliminar este ejercicio?', text: 'Se quita también de la rutina, en todos los días donde esté.', keep: 'Mantener el ejercicio', go: 'Eliminar ejercicio', danger: true })) return;
  S.exlib = S.exlib.filter((x) => x.id !== XF.id);
  for (const days of Object.values(S.routine)) days.forEach((items, d) => { days[d] = items.filter((it) => it.ex !== XF.id); });
  $('exformsheet').close(); persist(); if ($('pickersheet').open) openPicker(PK.day, PK.i); render();
}

// Máquinas propias: nombre y rango de peso (mínimo, máximo, salto)
// fromEx: se abrió desde "Nuevo ejercicio"; al guardar, la máquina queda elegida en el formulario.
let machFromEx = false;
function openMachine(id, fromEx = false) {
  machFromEx = fromEx;
  const m = S.equip.machines.find((x) => x.id === id) || { id: '', name: '', min: 5, max: 100, step: 5 };
  dlg('machsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="machsheet">Cancelar</button><strong>${m.id ? 'Editar' : 'Nueva'} máquina</strong><button class="link" data-action="mach-save" data-id="${m.id}">Guardar</button></div>
    <label class="field"><span>Nombre</span><input id="m-name" value="${esc(m.name)}" placeholder="Ej.: Polea, Prensa, Barra con discos"></label>
    <div class="grid2" style="grid-template-columns:1fr 1fr 1fr"><label class="field"><span>Mínimo (kg)</span><input id="m-min" type="number" inputmode="decimal" step="0.5" value="${m.min}"></label>
    <label class="field"><span>Máximo (kg)</span><input id="m-max" type="number" inputmode="decimal" step="0.5" value="${m.max}"></label>
    <label class="field"><span>Salto (kg)</span><input id="m-step" type="number" inputmode="decimal" step="0.25" value="${m.step}"></label></div>
    <p class="faint small">La app redondea los pesos sugeridos a estos saltos.${fromEx ? '' : ' Después creá tus ejercicios con esta máquina desde Entreno → Editar rutina.'}</p>
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
  persist(); $('machsheet').close();
  if (machFromEx && XF && $('exformsheet').open) { XF.impl = 'm:' + m.id; renderExForm(); return toast(`Máquina agregada: ${m.name}.`); }
  $('onb').open ? renderOnb() : render();
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
let W = null;   // { plan, day, dayName, items, started, warm, off, out, skipped }
// El entreno en curso se guarda aparte (clave 'live', fuera de la copia de seguridad) tras cada cambio: si se recarga
// la página o el sistema descarga la pestaña, Hoy ofrece "Seguir entreno". Los ejercicios van por id y se rearman al volver.
let LIVE = null;   // entreno sin terminar encontrado al arrancar, mientras no se retome ni se descarte
const LIVE_HOURS = 24;   // pasado ese tiempo ya no se ofrece
let liveTimer;
function saveLive(w = W) {
  clearTimeout(liveTimer);
  if (!w) return;
  const snap = JSON.parse(JSON.stringify({ ...w, items: w.items.map((it) => ({ ...it, ex: it.ex.id, orig: it.orig?.id })) }));
  saving = saving.then(() => db.set('live', snap)).catch(() => {});
}
const saveLiveSoon = () => { clearTimeout(liveTimer); liveTimer = setTimeout(saveLive, 400); };   // mientras se escribe en una serie
function clearLive() { clearTimeout(liveTimer); LIVE = null; saving = saving.then(() => db.set('live', null)).catch(() => {}); }
// Un entreno guardado vuelve si es reciente y del plan activo; un ejercicio propio borrado desaparece.
function reviveLive(d) {
  const plan = activePlan(S);
  if (!d?.items || !(Date.now() - d.started < LIVE_HOURS * 3600e3) || d.plan !== plan.id || !plan.days[d.day]) return null;
  const items = d.items.map((it) => ({ ...it, ex: getEx(it.ex), orig: it.orig ? getEx(it.orig) : undefined })).filter((it) => it.ex);
  return items.length ? { ...d, items } : null;
}
function resumeWorkout() {
  W = LIVE; LIVE = null;
  renderWorkout(); $('wsheet').showModal(); calmMotion($('wsheet')); keepAwake(true); render();
}
function discardLive() {
  const w = LIVE; clearLive(); render();
  toast('Entreno descartado.', () => { LIVE = w; saveLive(w); render(); });
}
function endWorkout() { stopRest(); W = null; clearLive(); $('wsheet').close(); keepAwake(false); }
function startWorkout(day) {
  const items = [...planFor(day).filter((p) => !p.missing), ...maintenanceItems()].map((p) => ({
    ...p, rows: Array.from({ length: p.sets }, () => ({ w: p.pick ? '' : p.w || 0, reps: '', rir: '', secs: p.secs || '', done: false })),
  }));
  // Entrada en calor: activación y movilidad de lo que se entrena hoy, un isométrico por zona sensible (calma el dolor
  // antes de cargar) y series de aproximación del primer ejercicio con peso de cada mitad del cuerpo.
  const warm = warmupMoves(items.map((p) => p.ex));
  if (S.painMode) for (const [zone, z] of Object.entries(S.zones)) if (z.phase < 3) warm.push({ t: `Isométrico de ${zoneName(zone).toLowerCase()}`, d: `1 × 30–45 s de ${rehabEx(zone, 1).name.toLowerCase()}. Suele bajar el dolor para entrenar.`, min: 1 });
  const halves = [];
  for (const p of items) {
    const half = bodyHalf(p.ex);
    if (p.ex.kind !== 'peso' || !(p.w > 0) || halves.includes(half)) continue;
    const sets = warmupSets(p.w, p.steps, warm.some((x) => x.ramp));
    halves.push(half);
    if (sets.length) warm.push({ ramp: true, t: `Aproximación: ${p.ex.name.toLowerCase()}`, d: `${sets.map((x, k) => `${k ? 'después ' : ''}${x.reps} reps con ${fmtKg(x.w)}`).join(', ')}. No cuentan como series.`, min: 1 });
  }
  LIVE = null;   // empezar otro reemplaza al que quedó sin terminar
  W = { plan: activePlan(S).id, day, dayName: activePlan(S).days[day].name, items, started: Date.now(), warm: warm.map((x) => ({ ...x, done: false })), off: [], out: [] };
  // Al empezar se ve la serie 1: la entrada en calor, la explicación de arriba y la del RIR arrancan plegadas y se abren al tocarlas.
  W.rirHelp = -1; W.warmOpen = W.introOpen = false;
  // Con 2 o más ejercicios sin peso de trabajo, la explicación va una vez arriba y cada ejercicio lleva solo la etiqueta.
  W.calibIntro = items.filter((p) => p.calib).length >= 2;
  W.guessIntro = items.filter((p) => p.guess || p.pick).length >= 2;
  renderWorkout(); $('wsheet').showModal(); calmMotion($('wsheet')); keepAwake(true);
}
function renderWorkout() {
  // El ejercicio en curso es el primero con series pendientes; su primera serie pendiente es la que sigue.
  // Con la entrada en calor abierta, a medias y sin series hechas, el foco está en ella y no en el primer ejercicio.
  const warmOpen = W.warmOpen && W.warm?.some((x) => !x.done);
  const warmNow = warmOpen && !W.items.some((it) => it.rows.some((r) => r.done));
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
      ${k === 'peso' ? `<select data-w="${i}.${j}.rir" aria-label="Repeticiones en reserva"><option value="">–</option>${[0, 1, 2, 3, 4].map((n) => `<option ${String(r.rir) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>`
        : timed && !r.done ? `<button class="hold-go" data-action="hold" data-i="${i}" data-j="${j}" aria-label="Cronómetro de la serie ${j + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg></button>` : '<span></span>'}
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
  const warmMin = W.warm?.reduce((n, x) => n + (x.min || 1), 0);
  const warm = W.warm?.length ? `<details class="card warm fold${warmNow ? ' now' : ''}" data-fold="warmOpen" ${warmOpen ? 'open' : ''}><summary><div><h3>Entrada en calor</h3><span class="muted small">Unos ${warmMin} minutos</span></div><span class="muted small">${W.warm.filter((x) => x.done).length} de ${W.warm.length}</span></summary>
    ${W.warm.map((x, i) => `<button class="warm-item${x.done ? ' on' : ''}${warmNow && i === W.warm.findIndex((y) => !y.done) ? ' next' : ''}" data-action="warm" data-i="${i}"><span class="box">${x.done ? '✓' : ''}</span><span><b>${esc(x.t)}</b>${esc(x.d)}</span></button>`).join('')}</details>` : '';
  const intro = (title, gist, body) => `<details class="card calib-intro fold" data-fold="introOpen" ${W.introOpen ? 'open' : ''}><summary><div><h3>${title}</h3><span class="muted small">${gist}</span></div></summary>${body}</details>`;
  const calib = W.calibIntro && W.items.some((it) => it.calib) ? intro('Hoy calibramos tus pesos', 'En la primera serie, reps hasta que te queden 2', `
    <p>En la primera serie de cada ejercicio con <span class="nowrap"><span class="calib-tag">calibración</span>,</span> hacé reps hasta que sientas que te salen solo 2 más y frená ahí. Anotá las reps y el RIR: con eso calculamos tu peso de trabajo.</p>
    <p class="muted small">El peso que ves es un punto de partida.</p>`)
    : W.guessIntro && W.items.some((it) => it.guess) ? intro('Pesos estimados', 'Si te queda liviano o pesado, cambialo en la serie', `
    <p>Los pesos con <span class="nowrap"><span class="calib-tag">estimado</span></span> salen de tu perfil. Con lo que anotes en la serie ajustamos los demás ejercicios.</p>`)
    : W.guessIntro && W.items.some((it) => it.pick) ? intro('Elegís vos los pesos', 'Anotá el peso que uses en cada serie', `
    <p>Anotá el peso que uses en cada serie. La próxima vez cada ejercicio arranca con el último que usaste.</p>`) : '';
  dlg('wsheet').html = `<div class="dlg"><div class="dlg-head w-head"><button class="link danger" data-action="cancel-workout">Salir</button><div class="w-title"><strong>${esc(W.dayName)}</strong><span class="w-count">${done} de ${total} series</span></div><button class="link" data-action="finish-workout">Terminar</button>
      <div class="w-track" role="progressbar" aria-label="Series hechas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">${track}</div></div>${warm}${calib}${body}
    <button class="cta" data-action="finish-workout">Terminar entreno</button></div>`;
  saveLive();   // cada tilde, cambio o paso de la entrada en calor redibuja: queda guardado al instante
}
function setDone(i, j) {
  const it = W.items[i], r = it.rows[j], k = it.ex.kind;
  let auto = '';   // lo que se anotó solo, para avisarlo
  if (!r.done) {
    // Sin reps anotadas valen las sugeridas (el centro del rango), salvo en la serie de calibración, que necesita las reales.
    if ((k === 'peso' || k === 'reps') && !(Number(r.reps) > 0)) {
      if (it.calib && j === 0 && k === 'peso') return toast('Anotá las repeticiones que hiciste.');
      r.reps = repCenter(it.range); auto = `${r.reps} reps`;
    }
    if (k === 'peso' && it.pick && !(Number(r.w) > 0)) return toast('Anotá el peso que usaste.');
    if ((k === 'tiempo' || k === 'iso') && !(Number(r.secs) > 0)) { r.secs = it.secs; auto = `${r.secs} s`; }
  }
  let said = false;   // ya hubo otro aviso por esta serie
  r.done = !r.done;
  if (r.done && it.calib && j === 0 && k === 'peso') {
    if (r.rir === '') { r.done = false; return toast('Elegí cuántas reps te quedaban (RIR).'); }
    const c = calibrate(Number(r.w), Number(r.reps), Number(r.rir), it.steps, it.range);
    S.lifts[it.ex.id] = { w: c.w, e1rm: c.e1rm };
    it.calib = false; it.calibrated = true; it.base = c.w;
    it.w = it.r ? painCap(c.w, it.steps) : c.w;
    it.rows.slice(1).forEach((x) => { if (!x.done) x.w = it.w; });
    persist();
    said = true;
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
    if (n) { said = true; toast(`Con esta serie ajustamos el peso de ${n === 1 ? '1 ejercicio' : `${n} ejercicios`} que siguen.`); }
  }
  renderWorkout();
  // Tildar sin anotar guarda lo sugerido: se avisa la primera vez del entreno (la serie ya muestra el valor cargado).
  if (r.done && auto && !said && !W.autoSaid) { W.autoSaid = true; toast(`Anotamos ${auto}, lo sugerido. Si hiciste otra cosa, cambialo en la serie.`); }
  // Descansa mientras quede alguna serie del entreno (también al pasar al ejercicio siguiente), lo que pide este ejercicio.
  // Con la última serie hecha no hay nada que esperar: se corta el descanso que viniera corriendo.
  if (r.done) W.items.some((x) => x.rows.some((y) => !y.done)) ? startRest(restSecs(it.ex, S.prefs.rest || REST_SECS)) : stopRest();
  if (r.done) showNextSet();
}
// Lleva la serie que sigue a la vista, entre el encabezado y la barra de descanso, si quedó tapada o fuera de pantalla.
function showNextSet() {
  const sc = $('wsheet').querySelector('.dlg'), set = sc?.querySelector('.set.next');
  if (!set) return;
  const head = sc.querySelector('.dlg-head').getBoundingClientRect().bottom + 8, bar = $('rest');
  const foot = (bar.hidden ? innerHeight : bar.getBoundingClientRect().top) - 12, r = set.getBoundingClientRect();
  if (r.top >= head && r.bottom <= foot) return;
  // Con lugar, deja ver también el nombre del ejercicio; si no, la serie queda justo arriba de la barra.
  const card = set.closest('.wex').getBoundingClientRect(), dy = card.top < r.top && r.bottom - card.top <= foot - head ? card.top - head : r.bottom - foot;
  sc.scrollBy({ top: dy, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
  if (off === 'skip') { W.items.splice(i, 1); (W.skipped ||= []).push(name); renderWorkout(); return toast(`Hoy sin ${name.toLowerCase()}.`); }
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
  if (skipped.length) (W.skipped ||= []).push(...skipped);
  renderWorkout();
  const lower = (xs) => xs.map((x) => x.toLowerCase()).join(', ');
  toast([changed.length ? `Hoy va ${lower(changed)}${changed.length === 1 ? ` en vez de ${name.toLowerCase()}` : ''}.` : '', skipped.length ? `Sin opción con lo que tenés hoy: se saltea ${lower(skipped)}.` : ''].filter(Boolean).join(' '));
}
// Terminar con series sin hacer pide confirmación (salvo que ya se haya confirmado con "Terminar igual").
function finishWorkout(sure) {
  const left = workoutLeft(W.items);
  if (left.sets && W.items.some((it) => it.rows.some((r) => r.done)) && sure !== true) return confirmFinish(left);
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
      // Récord en kilos enteros: el máximo estimado (lo que levantaría una vez) tiene que subir al menos 1 kg redondeado.
      if (prev && Math.round(best) > Math.round(prev)) prs.push({ ex: it.ex.id, name: it.ex.name, val: fmtKg(Math.round(best)), est: true });
      lift.e1rm = Math.round(Math.max(lift.e1rm || 0, best) * 10) / 10;
      // Con tope por dolor o recién calibrado no se progresa: el peso de trabajo ya quedó definido.
      // En manual no se sugieren subidas: queda el último peso que usó.
      if (manual) lift.w = Number(sets.at(-1).w) || lift.w;
      else if (!it.r && !it.calibrated && !it.deload) lift.w = progress(lift.w, sets.map((s) => ({ reps: Number(s.reps) })), it.steps, it.range);
      if (lift.w !== w0 && !manual) ups.push({ ex: it.ex.id, name: it.ex.name, from: w0, to: lift.w });
    }
    if (it.ex.kind === 'reps') {
      const l = (S.lifts[it.ex.id] ||= { bestReps: 0 }), top = Math.max(...sets.map((s) => Number(s.reps) || 0));
      if (l.bestReps && top > l.bestReps) prs.push({ ex: it.ex.id, name: it.ex.name, val: `${top} repeticiones` });
      l.bestReps = Math.max(l.bestReps || 0, top);
    }
    if (it.ex.kind === 'tiempo') { const l = (S.lifts[it.ex.id] ||= { secs: 30 }); if (sets.every((s) => Number(s.secs) >= l.secs)) l.secs = Math.min(90, l.secs + 5); }
  }
  const session = { id: uid(), date: today(), type: 'entreno', plan: W.plan, day: W.day, tpl: String.fromCharCode(65 + W.day), items };
  if (W.skipped?.length) session.skipped = [...W.skipped];
  if (left.sets) session.left = left.items;
  Object.assign(session, sessionSummary(session, Date.now() - W.started), { prs, ups });
  const zones = [...new Set(W.items.flatMap((it) => (it.r ? it.r.zones : it.maint ? [it.maint] : [])))];
  S.plan.pos = nextDay(activePlan(S), W.day);   // desde el día hecho, no desde la posición guardada
  endWorkout();
  if (S.painMode && zones.length) askPain(session, zones);
  else saveSession(session);
}
function confirmFinish(left) {
  const list = left.items.map((x) => `${x.name.toLowerCase()}${x.n < x.of ? ` (${x.n})` : ''}`);
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0]);
  dlg('finsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="finsheet">Cancelar</button><strong>¿Terminar el entreno?</strong><span></span></div>
    <p>Te ${left.sets === 1 ? 'queda 1 serie' : `quedan ${left.sets} series`} sin hacer: ${esc(and(list))}.</p>
    <p class="muted small">Se guarda lo que hiciste y lo que falta queda anotado como sin hacer. El peso de lo que no hiciste no cambia.</p>
    <button class="cta" data-action="close" data-dlg="finsheet">Seguir entrenando</button>
    <button class="sec" data-action="finish-anyway">Terminar igual</button></div>`;
  $('finsheet').showModal();
}
// "Volver al plan original": diálogo propio que dice qué se rearma (todos los días del plan) y qué queda.
function confirmReset() {
  const plan = activePlan(S), names = plan.days.map((dd) => dd.name);
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0]);
  dlg('resetsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="resetsheet">Cancelar</button><strong>¿Volver al plan original?</strong><span></span></div>
    <p>Se rearman ${names.length > 1 ? `los ${names.length} días` : 'el día'} de ${esc(plan.name)} (${esc(and(names))}) según tu equipo: se pierden los ejercicios que cambiaste, agregaste o reordenaste en ${names.length > 1 ? 'todos' : 'él'}.</p>
    <p class="muted small">Tus pesos, tu historial y tus ejercicios propios (en Mis ejercicios) no cambian. Los otros planes quedan como estaban.</p>
    <button class="cta" data-action="close" data-dlg="resetsheet">Mantener mis cambios</button>
    <button class="sec" data-action="reset-routine">Volver al plan original</button></div>`;
  $('resetsheet').showModal();
}
// "Borrar todos los datos": ofrece guardar una copia antes y pide escribir BORRAR, así no se borra de un toque.
let wipeQ = '';
const wipeOk = () => wipeQ.trim().toUpperCase() === 'BORRAR';
function confirmWipe() {
  const n = S.sessions.length;
  dlg('wipesheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="wipesheet">Cancelar</button><strong>¿Borrar todos los datos?</strong><span></span></div>
    <p>Se borran de este teléfono ${n ? `tus ${n === 1 ? 'sesión' : `${n} sesiones`}, ` : ''}tu rutina, tus pesos, tu equipo y tu perfil${Object.keys(S.zones).length ? ', y el registro de dolor' : ''}. No se puede deshacer.</p>
    <div class="wipe-copy"><button class="sec" data-action="wipe-backup">Guardar copia antes</button><p class="small muted">${lastBackupText(today())}</p></div>
    <label class="field"><span>Para confirmar, escribí BORRAR</span><input id="wipe-q" value="${esc(wipeQ)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"></label>
    <button class="sec danger wipe-go" data-action="wipe-go" ${wipeOk() ? '' : 'disabled'}>Borrar todos los datos</button></div>`;
  if (!$('wipesheet').open) $('wipesheet').showModal();
}
// Pregunta propia de la app (en vez de confirm()): título, qué pasa y dos botones. El de arriba es el que no
// cambia nada; el de abajo hace la acción. Devuelve una promesa: true si tocó la acción, false si canceló o cerró.
let askDone = null;
function ask({ title, text, note = '', keep = 'Cancelar', go, danger = false }) {
  askDone?.(false);
  dlg('asksheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="close" data-dlg="asksheet">Cancelar</button><strong>${esc(title)}</strong><span></span></div>
    <p>${esc(text)}</p>${note ? `<p class="muted small">${esc(note)}</p>` : ''}
    <button class="cta" data-action="close" data-dlg="asksheet">${esc(keep)}</button>
    <button class="sec${danger ? ' danger' : ''}" data-action="ask-go">${esc(go)}</button></div>`;
  $('asksheet').showModal();
  return new Promise((res) => { askDone = (v) => { askDone = null; res(v); }; });
}
function wipeAll() {
  if (!wipeOk()) return;
  $('wipesheet').close(); wipeQ = '';
  clearLive(); S = DEFAULT(); resetRoutine(); persist(); onbStep = 0; onbPlanSet = false; onbCare = true; onbPainCheck = false; renderOnb(); $('onb').showModal();
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
  // Lo cambiado solo por hoy no entra en "La próxima vez": la próxima vuelve el ejercicio de la rutina.
  const swapped = s.items.filter((x) => x.from), ups = (s.ups || []).filter((u) => !swapped.some((x) => x.ex === u.ex));
  const left = [...(s.skipped || []).map((name) => ({ name, txt: 'salteado' })), ...(s.left || []).map((x) => ({ name: x.name, txt: x.n === x.of ? 'sin hacer' : `${x.n} de ${x.of} series sin hacer` }))];
  dlg('sumsheet').html = `<div class="dlg"><div class="dlg-head"><strong>¡${esc(plan.days[s.day]?.name ?? `Entreno ${s.tpl}`)} hecho! 💪</strong><button class="link" data-action="close" data-dlg="sumsheet">Listo</button></div>
    <div class="stats"><div><span class="big num">${s.min}</span><span class="muted small">${s.min === 1 ? 'minuto' : 'minutos'}</span></div><div><span class="big num">${s.sets}</span><span class="muted small">${s.sets === 1 ? 'serie' : 'series'}</span></div><div><span class="big num">${s.vol >= 1000 ? (s.vol / 1000).toFixed(1).replace('.', ',') + 'k' : s.vol}</span><span class="muted small">kg levantados</span></div></div>
    ${st ? `<p class="streak">🔥 ${st} ${st === 1 ? 'semana cumplida' : 'semanas seguidas cumpliendo'}</p>` : ''}
    ${s.prs?.length ? `<h2>Récords</h2>${s.prs.some((p) => p.est) ? '<p class="muted small sum-note">En kilos: tu máximo estimado, lo que levantarías una sola vez según tus series.</p>' : ''}${s.prs.map((p) => `<div class="row"><span>🏆 ${esc(p.name)}</span><b class="num">${esc(p.val)}</b></div>`).join('')}` : ''}
    ${ups.length ? `<h2>La próxima vez</h2>${ups.map((u) => `<div class="row"><span>${esc(u.name)}</span><b class="num" style="color:${u.to > u.from ? 'var(--acc-fg)' : 'var(--pain-fg)'}">${fmtKg(u.from)} → ${fmtKg(u.to)}</b></div>`).join('')}` : ''}
    ${holds.length ? `<h2>Mismo peso la próxima</h2>${holds.map((x) => `<div class="row"><span>${esc(x.name)}</span><span class="muted small">cuando hagas ${x.reps[1]} en todas, sube</span></div>`).join('')}` : ''}
    ${swapped.length ? `<h2>Solo por hoy</h2>${swapped.map((x) => `<div class="row"><span>${esc(x.name)}</span><span class="muted small">en vez de ${esc((getEx(x.from)?.name || 'otro').toLowerCase())}, que vuelve la próxima con su peso</span></div>`).join('')}` : ''}
    ${left.length ? `<h2>Quedó sin hacer</h2>${left.map((x) => `<div class="row"><span>${esc(x.name)}</span><span class="muted small">${x.txt}</span></div>`).join('')}` : ''}
    <p class="muted small" style="margin-top:14px">Próximo: ${esc(plan.days[S.plan.pos].name)}.</p></div>`;
  $('sumsheet').showModal();
}

// Descanso entre series. La misma barra hace de cronómetro en las series por tiempo (plancha, isométricos).
let restTimer = null, hold = null;
// Cuenta regresiva en la barra: label, botón (texto y acción) y qué hacer al llegar a 0.
function barCount(secs, label, btn, action, onEnd, mode = '') {
  clearInterval(restTimer);
  const el = $('rest'), end = Date.now() + secs * 1000;
  overlayHost().appendChild(el); el.hidden = false; el.className = mode;
  $('rest-label').textContent = label;
  const b = el.querySelector('button'); b.textContent = btn; b.dataset.action = action;
  let last = secs;
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    $('rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left !== last && left > 0 && left <= 3) cue('tick');
    last = left;
    if (!left) onEnd();
  };
  tick(); restTimer = setInterval(tick, 250);
}
function startRest(secs) {
  stopRest();
  barCount(secs, 'Descanso', 'Saltar', 'skip-rest', () => { stopRest(); cue('go', 'Siguiente serie'); });
}
function stopRest() { clearInterval(restTimer); restTimer = null; hold = null; $('rest').hidden = true; }
// Cronómetro de una serie por tiempo: 5 s para acomodarse y después el tiempo de la serie. Al terminar (o con "Listo")
// la serie queda hecha con los segundos sostenidos y arranca el descanso.
const HOLD_PREP = 5;
function startHold(i, j) {
  stopRest();
  const it = W.items[i], r = it.rows[j], secs = Number(r.secs) > 0 ? Number(r.secs) : it.secs;
  hold = { i, j, secs };
  cue('go', 'Preparate');
  barCount(HOLD_PREP, 'Preparate', 'Cancelar', 'skip-rest', () => {
    hold.start = Date.now(); cue('go', 'Ya');
    barCount(secs, 'Sostené', 'Listo', 'hold-stop', () => endHold(secs), 'hold');
  }, 'hold');
}
function endHold(secs) {
  const h = hold; if (!h || !W) return stopRest();
  if (secs == null) secs = h.start ? Math.max(1, Math.round((Date.now() - h.start) / 1000)) : 0;
  stopRest();
  if (!secs) return;
  cue('done', 'Listo');
  const r = W.items[h.i].rows[h.j];
  r.secs = secs; r.done = false;
  setDone(h.i, h.j);
}

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
let R = null;   // { slot, items, idx, set, phase: 'listo'|'hold'|'rest', end, timer, saved: id de la sesión ya guardada }
const ISO_MIN = 0.5;   // una serie isométrica cuenta si se sostuvo al menos la mitad del tiempo
function startRehab() {
  const items = rehabItems().map((it) => ({ ...it, done: 0, held: [] }));
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
    // Terminada la última serie la sesión ya quedó guardada: esta pantalla festeja, resume y deja el dolor como paso opcional.
    if (!R.saved && R.items.length) saveRehab();
    const sess = S.sessions.find((x) => x.id === R.saved), done = { mañana: rehabDone('mañana'), noche: rehabDone('noche') };
    const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0]);
    const dose = (it) => it.ex.kind === 'iso' ? `de ${it.held.every((x) => x === it.held[0]) ? it.held[0] : and(it.held.map(String))} s` : `de ${it.reps} reps`;
    const sum = R.items.filter((it) => it.done).map((it) => `<div class="row"><span>${esc(it.ex.name)}</span><span class="num">${it.done} de ${it.sets} series ${dose(it)}</span></div>`).join('');
    const custom = R.custom.map((c, i) => `<div class="card"><div class="row"><div><h3>${esc(c.custom.name)}</h3><p class="muted small">${c.custom.sets} × ${c.custom.value} ${c.custom.mode === 'segundos' ? 's' : 'reps'}${c.custom.zone ? ` para tu ${esc(zoneName(c.custom.zone).toLowerCase())}` : ''}</p>${c.custom.note ? `<p class="small">${esc(c.custom.note)}</p>` : ''}</div>
        <button class="chip${c.done ? ' on' : ''}" data-action="custom-done" data-i="${i}">${c.done ? 'Hecho' : 'Marcar'}</button></div></div>`).join('');
    const ws = weekStats(S, today());
    main = sess ? `<div class="rehab-done"><div class="done-mark${R.cheered ? ' still' : ''}" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><path d="M38 62l15 15 30-34"/></svg></div>
        <h1>¡Sesión de la ${R.slot} hecha!</h1>
        <p class="muted">Lo próximo: ${rehabNext(R.slot, done)}.${ws.rehabTarget ? ` Llevás ${ws.rehab} de ${ws.rehabTarget} sesiones esta semana.` : ''}</p></div>
      ${sum ? `<div class="card rehab-sum">${sum}</div>` : ''}
      ${custom ? `<h2>Tus ejercicios del fisio</h2>${custom}` : ''}
      <button class="cta pain" data-action="rehab-pain">Anotar cómo dolió</button>
      <p class="faint small rehab-opt">Opcional. Con varios registros por semana sabemos si podés pasar de fase.</p>
      <button class="sec rehab-close" data-action="rehab-close">Listo</button>`
      : `<h1 style="font-size:28px">Tus ejercicios del fisio</h1>${custom}<p class="faint small rehab-opt">Marcá los que hiciste: la sesión se guarda con el primero.</p>`;
    if (sess) R.cheered = true;   // el festejo se anima una vez, no al marcar los ejercicios del fisio
  }
  dlg('rsheet').html = `<div class="dlg"><div class="dlg-head"><button class="link" data-action="cancel-rehab">${R.saved ? 'Cerrar' : 'Salir'}</button><strong>Rehabilitación de la ${R.slot}</strong><span></span></div>${main}</div>`;
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
    // Se guarda lo sostenido de verdad; cortada antes de la mitad, la serie no cuenta y se repite.
    const held = R.held ?? it.secs; R.held = null;
    if (held < it.secs * ISO_MIN) {
      R.state = 'listo'; renderRehab();
      return toast(`Sostuviste ${held} s de ${it.secs}: muy poco para contar la serie. Repetila cuando puedas; si duele, cortá acá.`);
    }
    it.held.push(held); it.done++;
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
// "Terminar serie" en pleno sostén: anota los segundos sostenidos hasta ahí.
function rehabSkip() {
  if (R.state === 'hold') R.held = Math.max(0, R.items[R.idx].secs - Math.ceil((R.end - Date.now()) / 1000));
  R.end = Date.now(); rehabTick();
}
// Guarda (o actualiza) la sesión con lo hecho: se llama al terminar la última serie y al marcar los ejercicios del fisio.
function saveRehab() {
  const items = R.items.filter((it) => it.done > 0).map((it) => ({ ex: it.ex.id, zone: it.zone, sets: Array.from({ length: it.done }, (_, k) => ({ w: it.w, secs: it.ex.kind === 'iso' ? it.held[k] : 0, reps: it.ex.kind === 'lento' ? it.reps : 0, done: true })) }))
    .concat(R.custom.filter((c) => c.done).map((c) => ({ ex: 'custom:' + c.custom.id, name: c.custom.name, zone: c.custom.zone || undefined, sets: [{ done: true }] })));
  const i = S.sessions.findIndex((x) => x.id === R.saved);
  if (!items.length) { if (i >= 0) S.sessions.splice(i, 1); R.saved = null; }
  else if (i >= 0) S.sessions[i].items = items;
  else { const session = { id: uid(), date: today(), type: 'rehab', slot: R.slot, items }; S.sessions.unshift(session); R.saved = session.id; }
  persist(); render();
}
function closeRehab() { clearInterval(R?.timer); R = null; $('rsheet').close(); keepAwake(false); }
// El dolor, después y opcional: se anota sobre la sesión ya guardada.
function rehabPain() {
  const sess = S.sessions.find((x) => x.id === R.saved); if (!sess) return;
  const zones = [...new Set(sess.items.map((i) => i.zone).filter(Boolean))];
  closeRehab();
  if (zones.length) askPain(sess, zones); else toast('Rehabilitación guardada.');
}

// ——— Dolor 0–10 ———
let P = null;   // { session, zones, vals }
function askPain(session, zones) {
  P = { session, zones, vals: {} };
  renderPain(); $('painsheet').showModal();
}
function renderPain() {
  // Fuera de un ejercicio se pregunta por ahora; si la sesión ya está guardada (o es solo el registro), se puede dejar para después.
  const now = P.session.type === 'dolor', later = now || S.sessions.includes(P.session);
  const when = now ? 'Ahora mismo' : P.session.type === 'rehab' ? 'Durante la rehabilitación' : 'Durante el entreno';
  dlg('painsheet').html = `<div class="dlg pain"><div class="dlg-head">${later ? `<button class="link" data-action="close" data-dlg="painsheet">${now ? 'Cancelar' : 'Ahora no'}</button>` : '<span></span>'}<strong>${now ? '¿Cuánto te duele ahora?' : '¿Cuánto dolió?'}</strong><span></span></div>
    <p class="muted small">${when}, de 0 (nada) a 10 (máximo). Hasta 3–4 está bien.</p>
    ${P.zones.map((z) => `<h3 style="margin-top:14px">${esc(zoneName(z))}</h3><div class="chips scale">${Array.from({ length: 11 }, (_, n) => `<button class="chip${P.vals[z] === n ? ' on' : ''}" data-action="pain-val" data-zone="${z}" data-n="${n}">${n}</button>`).join('')}</div>`).join('')}
    <button class="cta pain" style="margin-top:18px" data-action="save-pain" ${P.zones.every((z) => P.vals[z] != null) ? '' : 'disabled'}>Guardar</button>
    ${P.zones.every((z) => P.vals[z] != null) ? '' : `<p class="faint small" style="text-align:center;margin-top:8px">Marcá el dolor de ${P.zones.length > 1 ? 'cada zona' : 'la zona'} para guardar.</p>`}</div>`;
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
  P = null; $('painsheet').close();
  // La rehabilitación ya está guardada desde la última serie: solo se le suma el dolor.
  if (S.sessions.includes(session)) { persist(); render(); toast('Dolor anotado.'); } else saveSession(session);
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
// Anotar el dolor de ahora, sin hacer una sesión, con el último registro a la vista.
function painNowCard() {
  const last = S.sessions.find((s) => s.pain && Object.keys(s.pain).length);
  const when = last && (last.date === today() ? 'hoy' : last.date === addDays(today(), -1) ? 'ayer' : `el ${fmtDate(last.date)}`);
  return `<div class="card pain-now"><h3>¿Cuánto te duele ahora?</h3>
    <p class="muted small">${last ? `Último registro, ${when}: ${Object.entries(last.pain).map(([z, v]) => `${esc(zoneName(z).toLowerCase())} ${v}`).join(', ')}.` : 'Anotalo cuando quieras, aunque no entrenes: cuenta para avanzar de fase.'}</p>
    <button class="sec" data-action="quick-pain">Anotar dolor</button></div>`;
}
function renderTendons() {
  let h = `<h1>Dolor</h1>
    <div class="card pain"><label class="row tap"><div><h3>Modo dolor</h3><p class="muted small">Isométricos diarios, registro de dolor y entreno adaptado en las zonas que marques.</p></div>
    <span class="switch"><input type="checkbox" data-action="pain-mode" ${S.painMode ? 'checked' : ''} aria-label="Modo dolor"><i></i></span></label></div>
    ${S.painMode && activeZones().length ? painNowCard() : ''}
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
const histHelp = { ex: false, pain: false };
// Título de sección con un "?" que abre la explicación del gráfico.
const helpHead = (title, k) => `<div class="h2-row"><h2>${title}</h2><button class="help-q" data-action="hist-help" data-k="${k}" aria-expanded="${histHelp[k]}"><span aria-hidden="true">?</span><span class="sr">Qué muestra ${title.toLowerCase()}</span></button></div>`;
// Un punto por día: el peso más alto de ese día (dos entrenos el mismo día no apilan puntos en la misma fecha).
function weightHistory(exId) {
  const byDay = {};
  for (const s of S.sessions) {
    const it = s.type === 'entreno' && s.items.find((i) => i.ex === exId && !i.capped);
    if (it && it.sets.length) byDay[s.date] = Math.max(byDay[s.date] ?? 0, ...it.sets.map((x) => x.w));
  }
  return Object.entries(byDay).sort().map(([x, y]) => ({ x, y }));
}
// Un punto por día con el dolor más alto; n y last dicen cuántas veces se anotó y el último valor, para aclararlo al tocar.
function painHistory(zone) {
  const byDay = {};
  for (const s of [...S.sessions].reverse()) if (s.pain?.[zone] != null) {
    const d = (byDay[s.date] ||= { y: 0, n: 0 }); d.y = Math.max(d.y, s.pain[zone]); d.n++; d.last = s.pain[zone];
  }
  return Object.entries(byDay).sort().map(([x, d]) => ({ x, ...d }));
}
const painTipNote = (p) => (p.n > 1 ? `el más alto de ${p.n} registros${p.last !== p.y ? `, el último fue ${p.last}` : ''}` : '');
// Ejercicios del gráfico agrupados por zona del cuerpo y en orden alfabético dentro de cada una.
function exOptions(ids) {
  const groups = {};
  for (const id of ids) (groups[getEx(id)?.cat || ''] ||= []).push(id);
  const name = (id) => getEx(id)?.name || id;
  return [...Object.keys(CATS), ''].filter((c) => groups[c]).map((c) => `<optgroup label="${c ? CATS[c] : 'Otros'}">${groups[c].sort((a, b) => name(a).localeCompare(name(b), 'es'))
    .map((e) => `<option value="${e}" ${e === histEx ? 'selected' : ''}>${esc(name(e))}</option>`).join('')}</optgroup>`).join('');
}
// Récords: el mejor de cada ejercicio, los más nuevos primero; se ven 5 y el resto al pedirlo.
let histRecAll = false;
const recVal = (r) => (r.kind === 'peso' ? `${fmtKg(r.w)} × ${r.reps}` : `${r.reps} reps`);
function histRecords(recs) {
  const shown = histRecAll ? recs : recs.slice(0, 5);
  return `<h2>Récords</h2><div class="card recs">${shown.map((r) => `<div class="rec"><span><span class="what">${esc(getEx(r.ex)?.name || r.ex)}</span><br><span class="faint small">${r.date === today() ? 'hoy' : fmtDate(r.date)}</span></span><b class="num">${recVal(r)}</b></div>`).join('')}
    ${recs.length > 5 ? `<button class="link small" data-action="hist-recs" aria-expanded="${histRecAll}">${histRecAll ? 'Ver menos' : `Ver los ${recs.length} récords`}</button>` : ''}
    <p class="faint small rec-note">Tu mejor serie en cada ejercicio: el peso más alto y cuántas repeticiones hiciste con él.</p></div>`;
}
// Un récord del entreno en una frase: "Remo: 14 kg, nuevo máximo estimado".
const prText = (p) => `${esc(p.name)}: ${esc(p.val)}, ${p.est ? 'nuevo máximo estimado' : 'nuevo récord'}`;
// Detalle de un ejercicio: una tablita con kg, reps (o segundos) y RIR, solo con las columnas que tienen datos.
function setsTable(i) {
  const has = (k) => i.sets.some((x) => (k === 'rir' ? x.rir != null : x[k]));
  const cols = [['w', 'kg'], ['reps', 'reps'], ['secs', 'seg'], ['rir', 'RIR']].filter(([k]) => has(k));
  if (!cols.length) return `<p class="faint small">${i.sets.length} ${i.sets.length === 1 ? 'serie hecha' : 'series hechas'}</p>`;
  return `<table class="sd-sets"><thead><tr><th>Serie</th>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>${i.sets.map((x, n) => `<tr><td>${n + 1}</td>${cols.map(([k]) => `<td>${x[k] == null || x[k] === '' ? '–' : String(x[k]).replace('.', ',')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const fmtVol = (v) => (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(v));
// El número de la derecha: en un entreno, los kg levantados y cuánto cambió contra la vez anterior del mismo día.
function sessNumber(s) {
  if (s.type === 'dolor' && s.pain) return `<span class="sess-n pain"><b>${Math.max(...Object.values(s.pain))}</b><span>de 10</span></span>`;
  if (s.type === 'entreno' && s.vol) {
    const prev = prevSameDay(S.sessions, s), d = prev?.vol ? s.vol - prev.vol : null;
    const delta = d == null ? '' : `<span class="sess-delta${d > 0 ? ' up' : ''}">${d === 0 ? 'igual que la anterior' : `${d > 0 ? '+' : '−'}${fmtVol(Math.abs(d))} kg vs. la anterior`}</span>`;
    return `<span class="sess-n"><b>${fmtVol(s.vol)}</b><span>kg levantados</span>${delta}</span>`;
  }
  const n = s.items.length;
  return `<span class="sess-n${s.type === 'entreno' ? '' : ' pain'}">${n ? `<b>${n}</b><span>${n === 1 ? 'ejercicio' : 'ejercicios'}</span>` : '<span>sin hacer</span>'}</span>`;
}
function sessDetail(s) {
  const prs = s.prs || [], isPr = (i) => prs.some((p) => (p.ex ? p.ex === i.ex : p.name === (getEx(i.ex)?.name || i.name)));
  return `${prs.length ? `<div class="sd-prs">${prs.map((p) => `<p>🏆 ${prText(p)}</p>`).join('')}${prs.some((p) => p.est) ? '<p class="faint small">Máximo estimado: lo que levantarías una sola vez según tus series.</p>' : ''}</div>` : ''}
    ${s.items.map((i) => `<div class="sd-ex"><p class="sd-name">${esc(getEx(i.ex)?.name || i.name || i.ex)}${isPr(i) ? ' <span aria-label="récord">🏆</span>' : ''}</p>${setsTable(i)}</div>`).join('')}`;
}
// Sesiones agrupadas por semana, con los entrenos hechos contra los del plan y la racha arriba.
function histSessions() {
  const st = streak(S, today()), goal = S.profile.days, thisWk = weekKey(today());
  const wkName = (wk) => (wk === thisWk ? 'Esta semana' : wk === addDays(thisWk, -7) ? 'La semana pasada' : `Semana del ${parseDay(wk).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`);
  return `<h2>Sesiones</h2>${st ? `<p class="hist-streak">🔥 ${st} ${st === 1 ? 'semana cumplida' : 'semanas seguidas cumpliendo'}</p>` : ''}
    ${sessionWeeks(S.sessions.slice(0, 60)).map((w) => `<div class="card sess-wk"><div class="wk-head"><span>${wkName(w.wk)}</span><span class="${w.train >= goal ? 'wk-ok' : 'faint'}">${w.train} de ${goal} entrenos${w.train >= goal ? ' ✓' : ''}</span></div>
    ${w.list.map((s) => `<details class="sess-d"><summary class="sess"><span><span class="what">${s.type === 'entreno' ? esc(PLANS[s.plan]?.days[s.day]?.name ?? `Entreno ${s.tpl}`) : s.type === 'dolor' ? 'Dolor anotado' : `Rehabilitación de la ${s.slot}`}</span><br><span class="muted small">${fmtDate(s.date)}${s.min ? `, ${s.min} min y ${s.sets} series` : ''}${s.prs?.length ? `. <span class="nowrap">🏆 ${s.prs.length === 1 ? '1 récord' : `${s.prs.length} récords`}</span>` : ''}${s.pain ? '. Dolor: ' + Object.entries(s.pain).map(([z, v]) => `${zoneName(z).toLowerCase()} ${v}`).join(', ') : ''}</span></span>${sessNumber(s)}</summary>
      ${sessDetail(s)}
      <button class="link danger small" data-action="del-session" data-id="${s.id}">Eliminar sesión</button></details>`).join('')}</div>`).join('')}`;
}
function renderHistory() {
  const zones = [...new Set([...activeZones(), ...S.sessions.flatMap((s) => Object.keys(s.pain || {}))])];
  if (!zones.includes(histZone)) histZone = zones[0] || '';
  const exIds = [...new Set(S.sessions.filter((s) => s.type === 'entreno').flatMap((s) => s.items.filter((i) => getEx(i.ex)?.kind === 'peso').map((i) => i.ex)))];
  if (!exIds.includes(histEx)) histEx = exIds[0] || '';
  const recs = exRecords(S.sessions, getEx);
  let h = `<div class="title-row"><h1>Historial</h1>${!S.sessions.length ? '' : S.painMode ? '<button class="link" data-action="report">Informe para el fisio</button>' : S.sessions.some((s) => s.type === 'entreno') ? '<button class="link" data-action="export-train">Exportar mis entrenos</button>' : ''}</div>`;
  // Sin entrenos, un solo vacío arriba que invita a empezar el día que toca.
  if (!S.sessions.some((s) => s.type === 'entreno')) {
    const plan = activePlan(S), day = dayIndex(plan, S.plan.pos);
    h += `<div class="card acc empty-hist"><h3>Todavía no entrenaste</h3><p class="muted small">Tu progreso aparece acá después del primer entreno.</p>
      <button class="cta" data-action="start-workout" data-day="${day}">Empezar ${esc(plan.days[day].name.toLowerCase())}</button></div>`;
  }
  // El gráfico de peso está siempre: sin entrenos con pesas muestra cómo se va a ver.
  h += `${helpHead('Peso por ejercicio', 'ex')}<div class="card acc">${histHelp.ex ? `<div class="note acc help-note">Cada punto es el peso más alto que levantaste en ese ejercicio en un día. Si la línea sube, estás ganando fuerza. Tocá un punto para ver el número. Los días con peso bajado por dolor no cuentan.</div>` : ''}
    ${exIds.length ? `<select data-action="hist-ex" aria-label="Ejercicio">${exOptions(exIds)}</select>` : ''}
    ${lineChart(weightHistory(histEx), { unit: 'kg', color: 'var(--acc)', empty: 'Cuando termines un entreno con pesas, acá vas a ver cómo sube cada ejercicio.' })}</div>`;
  if (recs.length) h += histRecords(recs);
  if (S.sessions.length) h += histSessions();
  // Dolor por zona va al final y solo si hay zonas o registros.
  if (zones.length) h += `${helpHead('Dolor por zona', 'pain')}<div class="card pain">${histHelp.pain ? `<div class="note pain help-note">Cada punto es el dolor más alto que anotaste ese día, de 0 a 10 (si anotaste varias veces, al tocarlo ves cuántas y el último valor). La línea punteada es el ${PAIN_MAX}: hasta ahí el dolor es tolerable y podés seguir entrenando. Tocá un punto para ver el número.</div>` : ''}<select data-action="hist-zone" aria-label="Zona">${zones.map((z) => `<option value="${z}" ${z === histZone ? 'selected' : ''}>${esc(zoneName(z))}</option>`).join('')}</select>
    ${lineChart(painHistory(histZone), { yMax: 10, limit: PAIN_MAX, unit: '/10', color: 'var(--pain)', note: painTipNote })}
    ${painHistory(histZone).length ? '<p class="chart-cap">Cada punto es el dolor más alto del día, no el último que anotaste.</p>' : ''}</div>`;
  $('view-history').innerHTML = h;
}
// Desde cuándo cuenta el informe: las últimas 6 semanas, pero no antes de la primera sesión o registro guardado.
function reportFrom(t) {
  const first = S.sessions.map((s) => s.date).concat(S.checks.map((c) => c.date)).sort()[0] || t, from = addDays(t, -41);
  return first > from ? first : from;
}
const reportCSS = ':root{--pain:#E8590C;--acc:#5C940D;--line:#DEE2E6;--faint:#868E96;--card:#fff}body{font:15px/1.45 system-ui,sans-serif;color:#212529;max-width:760px;margin:24px auto;padding:0 16px}h1{margin:0}h2{margin:28px 0 6px;font-size:19px}.muted{color:#6C757D}table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}th,td{border:1px solid var(--line);padding:5px;text-align:center}th{text-align:left;background:#F8F9FA}section{break-inside:avoid}@media print{button{display:none}}';
// Informe para el fisio: página HTML independiente (se puede imprimir como PDF) con las últimas 6 semanas
// (o desde la primera sesión, si empezaste hace menos: la tabla tiene una columna por semana desde ahí).
function reportHTML() {
  const t = today(), from = reportFrom(t), recent = S.sessions.filter((s) => s.date >= from);
  const nWeeks = Math.ceil((Math.round((parseDay(t) - parseDay(from)) / 864e5) + 1) / 7);
  const zones = [...new Set([...activeZones(), ...recent.flatMap((s) => Object.keys(s.pain || {}))])];
  const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).replace('.', ',') : '—');
  const zoneBlock = (zone) => {
    const z = S.zones[zone], pts = painHistory(zone).filter((p) => p.x >= from);
    const weeks = Array.from({ length: nWeeks }, (_, i) => { const a = i ? addDays(t, -7 * (nWeeks - i) + 1) : from, b = addDays(a, 6); return { a, vals: pts.filter((p) => p.x >= a && p.x <= b).map((p) => p.y) }; });
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
<style>${reportCSS}.chart svg{width:100%;max-width:520px;display:block}.chart .grid{stroke:var(--line)}.chart .axis{fill:var(--faint);font-size:11px}.chart .limit{stroke:var(--pain);stroke-dasharray:4 4;opacity:.7}.chart .series{fill:none;stroke-width:2}.chart .dot{stroke:#fff;stroke-width:2}.chart .hit{fill:transparent}.chart .empty,.chart .chart-cap{color:var(--faint);padding:8px 0;margin:0}.chart .ghost{fill:none;stroke:var(--line);stroke-width:2;stroke-dasharray:5 5}</style></head><body>
<h1>Informe de rehabilitación</h1>
<p class="muted">${esc(S.profile.name || 'Paciente')}, del ${fmtDate(from)} al ${fmtDate(t)}. Generado con XZ Fit ${APP_VERSION}.</p>
<p>Protocolo: isométricos (3 × 30–45 s, mañana y noche), luego isotónicos lentos 3 s/3 s y reintegración, con dolor tolerado hasta 3–4/10 y sin empeorar al día siguiente. Modo dolor ${S.painMode ? 'activo' : 'apagado'}.</p>
<p><b>${rehab.length}</b> sesiones de rehabilitación y <b>${train.length}</b> entrenos en el período.</p>
${zones.map(zoneBlock).join('') || '<p class="muted">Sin zonas con dolor registradas.</p>'}
${custom}
<button onclick="print()">Imprimir o guardar como PDF</button>
</body></html>`;
}
// Sin modo dolor: tus entrenos desde el primero, con récords y cada serie, para guardar o mostrarle a quien quieras.
function trainingHTML() {
  const t = today(), list = S.sessions.filter((s) => s.type === 'entreno'), from = list.map((s) => s.date).sort()[0] || t;
  const recs = exRecords(S.sessions, getEx), min = list.reduce((a, s) => a + (s.min || 0), 0);
  const name = (s) => esc(PLANS[s.plan]?.days[s.day]?.name ?? `Entreno ${s.tpl}`);
  const sets = (i) => i.sets.map((x) => (x.w ? `${String(x.w).replace('.', ',')} kg × ` : '') + (x.secs ? `${x.secs} s` : `${x.reps ?? '–'} reps`) + (x.rir != null ? ` (RIR ${x.rir})` : '')).join(', ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mis entrenos XZ Fit</title>
<style>${reportCSS}td{text-align:left}h3{margin:18px 0 0;font-size:16px}</style></head><body>
<h1>Mis entrenos</h1>
<p class="muted">${S.profile.name ? esc(S.profile.name) + ', del' : 'Del'} ${fmtDate(from)} al ${fmtDate(t)}. Generado con XZ Fit ${APP_VERSION}.</p>
<p><b>${list.length}</b> ${list.length === 1 ? 'entreno' : 'entrenos'}${min ? `, ${min} minutos en total` : ''}.</p>
${recs.length ? `<h2>Récords</h2><table><tr><th>Ejercicio</th><th>Mejor serie</th><th>Fecha</th></tr>${recs.map((r) => `<tr><td>${esc(getEx(r.ex)?.name || r.ex)}</td><td>${recVal(r)}</td><td>${fmtDate(r.date)}</td></tr>`).join('')}</table>` : ''}
<h2>Sesiones</h2>
${list.map((s) => `<section><h3>${name(s)}, ${fmtDateLong(s.date)}</h3><table>${s.items.map((i) => `<tr><th>${esc(getEx(i.ex)?.name || i.name || i.ex)}</th><td>${sets(i) || 'sin series'}</td></tr>`).join('')}</table></section>`).join('')}
<button onclick="print()">Imprimir o guardar como PDF</button>
</body></html>`;
}

// Gráfico de una serie: fechas en x, valor en y; tocá un punto para ver el valor.
// Sin puntos dibuja una línea de muestra con el aviso; con uno solo, el punto va al centro.
// En kg el eje y va del rango real (no desde 0) para que 12→14 kg se note, y arriba resume cuánto subió.
const numEs = (v) => String(+v.toFixed(2)).replace('.', ',');
const fmtAxisDate = (k) => parseDay(k).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
// Eje y "lindo" para kg: 3 o 4 marcas con paso redondo que cubren del mínimo al máximo.
function kgTicks(lo, hi) {
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((st) => (Math.ceil(hi / st) - Math.floor(lo / st)) <= 3) || 100;
  const a = Math.max(0, Math.floor(lo / step) * step), z = Math.ceil(hi / step) * step;
  return Array.from({ length: Math.round((z - a) / step) + 1 }, (_, i) => a + i * step);
}
// "+2 kg en 2 semanas": del primer al último punto.
function weightTrend(pts) {
  const diff = pts[pts.length - 1].y - pts[0].y, days = Math.round((parseDay(pts[pts.length - 1].x) - parseDay(pts[0].x)) / 864e5);
  const span = days < 14 ? `${days} ${days === 1 ? 'día' : 'días'}` : days < 61 ? `${Math.round(days / 7)} semanas` : `${Math.round(days / 30.4)} meses`;
  if (!diff) return `<p class="chart-trend"><b>Mismo peso</b> que hace ${span}</p>`;
  return `<p class="chart-trend"><b>${diff > 0 ? '+' : '−'}${numEs(Math.abs(diff))} kg</b> en ${span}</p>`;
}
function lineChart(pts, { yMax, limit, unit, color, note, empty = 'Sin registros todavía.' }) {
  const kg = unit === 'kg' && yMax == null, W_ = 320, H = 150, L = 30, Rr = 8, T = kg ? 20 : 10, B = 22, fmt = (v) => `${unit === 'kg' ? fmtKg(v) : v + unit}`;
  const ticks = yMax != null ? (yMax === 10 ? [0, 5, 10] : [0, yMax / 2, yMax])
    : pts.length && kg ? kgTicks(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)))
    : [0, 5, 10];
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid = (labels) => ticks.map((v) => `<line class="grid" x1="${L}" x2="${W_ - Rr}" y1="${Y(v)}" y2="${Y(v)}"/>${labels ? `<text class="axis" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${numEs(v)}</text>` : ''}`).join('')
    + (labels && kg ? `<text class="axis" x="${L - 6}" y="${T - 8}" text-anchor="end">kg</text>` : '')
    + (limit != null ? `<line class="limit" x1="${L}" x2="${W_ - Rr}" y1="${Y(limit)}" y2="${Y(limit)}"/>` : '');
  if (!pts.length) {
    const ghost = [0.22, 0.3, 0.28, 0.45, 0.52, 0.66].map((v, i, a) => `${i ? 'L' : 'M'}${(L + 10 + (i / (a.length - 1)) * (W_ - L - Rr - 20)).toFixed(1)} ${Y(lo + v * (hi - lo)).toFixed(1)}`).join('');
    return `<div class="chart is-empty"><svg viewBox="0 0 ${W_} ${H}" aria-hidden="true">${grid(false)}<path class="ghost" d="${ghost}"/></svg><p class="empty">${esc(empty)}</p></div>`;
  }
  const t0 = parseDay(pts[0].x), t1 = parseDay(pts[pts.length - 1].x), span = t1 - t0;
  const X = (k) => (span ? L + ((parseDay(k) - t0) / span) * (W_ - L - Rr) : (L + W_ - Rr) / 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  // Fechas: la primera, la última y hasta dos del medio si entran sin pisarse.
  const shown = [pts[0]];
  if (span) {
    for (const p of pts.slice(1, -1)) if (shown.length < 3 && X(p.x) - X(shown[shown.length - 1].x) >= 48 && X(pts[pts.length - 1].x) - X(p.x) >= 48) shown.push(p);
    shown.push(pts[pts.length - 1]);
  }
  const dates = shown.map((p, i) => `<text class="axis" x="${X(p.x)}" y="${H - 4}" text-anchor="${!span ? 'middle' : i === 0 ? 'start' : i === shown.length - 1 ? 'end' : 'middle'}">${esc(fmtAxisDate(p.x))}</text>`).join('');
  return `<div class="chart">${kg && pts.length > 1 ? weightTrend(pts) : ''}<svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="Gráfico de ${pts.length} registros">
    ${grid(true)}${dates}
    <path class="series" d="${d}" stroke="${color}"/>
    ${pts.map((p) => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${color}"/><circle class="hit" cx="${X(p.x)}" cy="${Y(p.y)}" r="14" data-tip="${esc(fmtDate(p.x))}|${esc(fmt(p.y))}|${esc(note?.(p) || '')}"/>`).join('')}
  </svg>${pts.length === 1 ? `<p class="chart-cap">Un día anotado: ${fmt(pts[0].y)}. Desde el segundo se ve la línea.</p>` : ''}</div>`;
}
function showTip(el) {
  const [date, val, note] = el.dataset.tip.split('|'), r = el.getBoundingClientRect(), tip = $('tip');
  overlayHost().appendChild(tip);
  tip.innerHTML = `<b>${esc(val)}</b> el ${esc(date)}${note ? `<br><span class="tip-note">${esc(note)}</span>` : ''}`; tip.hidden = false;
  // Centrado en el punto, pero siempre dentro de la tarjeta (y de la pantalla): cerca de un borde se corre
  // hacia adentro, y si arriba del punto no entra, va debajo.
  const box = (el.closest('.card, dialog, .chart') || document.body).getBoundingClientRect();
  const left = Math.max(box.left, 0) + 8, right = Math.min(box.right, innerWidth) - 8, top = Math.max(box.top, 0) + 4;
  const half = tip.offsetWidth / 2, x = Math.min(Math.max(r.left + r.width / 2, left + half), right - half);
  const cy = r.top + r.height / 2, below = cy - 6 - 10 - tip.offsetHeight < top;
  tip.classList.toggle('below', below);
  tip.style.left = `${x}px`; tip.style.top = `${below ? cy + 6 : cy - 6}px`;
}

// Campo numérico con la unidad adentro.
const unitField = (label, attrs, unit) => `<label class="field"><span>${label}</span><div class="unit"><input type="number" ${attrs}><em>${unit}</em></div></label>`;
// ——— Ajustes ———
function renderSettings() {
  const p = S.profile, e = S.equip;
  let h = `<h1>Ajustes</h1>
  <h2>Perfil</h2><div class="card">
    <label class="field"><span>Nombre <i class="opt">(opcional)</i></span><input data-set="profile.name" value="${esc(p.name)}"></label>
    <span class="small muted">Sexo</span><div class="chips" style="margin:4px 0 8px">${[['h', 'Hombre'], ['m', 'Mujer'], ['x', 'Prefiero no decir']].map(([k, v]) => `<button class="chip${p.sex === k ? ' on' : ''}" data-action="set-sex" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="grid3">${unitField('Peso', `data-set="profile.weight" inputmode="decimal" value="${esc(p.weight)}"`, 'kg')}${unitField('Altura <i class="opt">(opcional)</i>', `data-set="profile.height" inputmode="numeric" value="${esc(p.height)}"`, 'cm')}${unitField('Edad <i class="opt">(opcional)</i>', `data-set="profile.age" inputmode="numeric" value="${esc(p.age)}"`, 'años')}</div>
    <span class="small muted">Días de entreno: ${esc(activePlan(S).name)}</span>${weekStrip(activePlan(S), S.rem.train, 'card-day')}${stripLegend(activePlan(S))}
    <p class="faint small">${dayHint(S.plan.custom ? 'custom' : activePlan(S).id)}</p>
    <button class="sec" style="width:100%" data-action="plan-open">Cambiar plan o días</button>
    <span class="small muted" style="display:block;margin-top:12px">Experiencia</span><div class="chips" style="margin-top:4px">${EXPERIENCE.map((x) => `<button class="chip${p.exp === x.id ? ' on' : ''}" data-action="set-exp" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <p class="faint small">Con sexo, peso, edad y experiencia estimamos tu peso inicial. La altura casi no cambia el cálculo.</p></div>
  <h2>Pesos</h2>${weightModeFields()}
  <h2>Equipo</h2>${equipFields()}
  ${hasPainTab() ? '' : `<h2>Dolor</h2><div class="card pain"><h3>¿Te duele algo?</h3><p class="muted small">Marcá la zona y activá el modo dolor: suma ejercicios para el tendón y cuida esa zona en el entreno.</p><button class="sec" style="width:100%;margin-top:10px" data-action="go-pain">Marcar qué me duele</button></div>`}
  <h2>Tema</h2><div class="card"><div class="chips">${[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Según el sistema']].map(([k, n]) => `<button class="chip${(S.prefs.theme || 'system') === k ? ' on' : ''}" data-action="theme" data-v="${k}">${n}</button>`).join('')}</div><p class="faint small">El claro se lee mejor a pleno sol.</p></div>
  <h2>Durante la sesión</h2><div class="card">
    <label class="row tap"><div><h3>Sonidos</h3><p class="muted small">Pitidos al empezar, en los últimos 3 s y al terminar.</p></div><span class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="sound" ${S.prefs.sound ? 'checked' : ''} aria-label="Sonidos"><i></i></span></label>
    <label class="row tap"><div><h3>Voz</h3><p class="muted small">"Sostené", "Descansá", "Siguiente serie".</p></div><span class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="voice" ${S.prefs.voice ? 'checked' : ''} aria-label="Voz"><i></i></span></label>
    <label class="row tap"><div><h3>Isométricos manos libres</h3><p class="muted small">Después del descanso, la serie siguiente arranca sola.</p></div><span class="switch acc"><input type="checkbox" data-action="pref-toggle" data-k="auto" ${S.prefs.auto ? 'checked' : ''} aria-label="Manos libres"><i></i></span></label>
    <span class="small muted">Descanso entre series de entreno</span><div class="chips" style="margin-top:4px">${[60, 90, 120, 180].map((n) => `<button class="chip${S.prefs.rest === n ? ' on' : ''}" data-action="pref" data-k="rest" data-v="${n}">${n < 120 ? n + ' s' : n / 60 + ' min'}</button>`).join('')}</div>
    <p class="faint small">La pantalla queda prendida mientras entrenás.</p></div>
  <h2>Recordatorios</h2><div class="card">
    <p class="muted small">Se agregan a tu calendario: es la forma más confiable de recibir avisos sin servidor.</p>
    <div class="grid2"><label class="field"><span>Isométricos mañana</span><input type="time" data-set="rem.am" value="${S.rem.am}"></label><label class="field"><span>Isométricos noche</span><input type="time" data-set="rem.pm" value="${S.rem.pm}"></label></div>
    <label class="field"><span>Hora del entreno</span><input type="time" data-set="rem.trainAt" value="${S.rem.trainAt}"></label>
    <button class="sec" style="width:100%" data-action="ics">📅 Agregar al calendario</button>
    ${S.painMode ? '' : '<p class="faint small">Los isométricos se incluyen solo con el modo dolor activado.</p>'}</div>
  <h2>Copia de seguridad</h2><div class="card">
    <p class="muted small">Tus datos viven solo en este teléfono. Guardá una copia de vez en cuando (Drive, correo, WhatsApp).</p>
    <div class="btns"><button class="sec" data-action="export">Guardar copia</button><button class="sec" data-action="import">Restaurar copia</button></div>
    <p class="small backup-last${backupAge(today()) > BACKUP_EVERY && S.sessions.length ? ' due' : ''}">${lastBackupText(today())}</p>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
    <p class="faint small" id="persist-status"></p></div>
  <h2>Fuentes</h2><div class="card small">
    <p class="muted">Protocolo de tendones basado en:</p><ul>${SOURCES.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="muted">Ilustraciones dibujadas para esta app (sin imágenes de terceros). XZ Fit no es un consejo médico: consultá a un profesional ante dolor agudo, hinchazón o pérdida de fuerza.</p>
    <p class="faint">Versión ${APP_VERSION}. <button class="link" data-action="news">Ver novedades</button></p></div>
  <button class="link danger" data-action="reset">Borrar todos los datos</button>`;
  $('view-settings').innerHTML = h;
  navigator.storage?.persisted?.().then((ok) => { const el = $('persist-status'); if (el) el.textContent = ok ? '✓ Almacenamiento persistente: el navegador no borra los datos por falta de espacio.' : 'El navegador podría borrar los datos si falta espacio: instalá la app y guardá copias.'; });
}
// Casilla grande que se marca entera (accesorios, zonas con dolor).
const tile = (attrs, on, name, hint = '', type = 'checkbox') => `<label class="tile"><input type="${type}" ${attrs} ${on ? 'checked' : ''}><span><b>${name}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
function equipFields(prefix = '') {
  const e = S.equip, bw = noEquip(e);
  return `<div class="tiles one">${tile('data-action="eq-bw"', bw, 'Solo peso corporal', bw ? 'Tu plan usa ejercicios sin material: sentadillas, flexiones, remo con toalla… Si conseguís algo, marcalo abajo.' : 'No tengo equipo: armá el plan con ejercicios sin material.')}</div>
  <h3 class="grp">Pesos libres</h3><div class="card">
    <label class="row tap"><div><h3>Mancuernas</h3>${e.db ? '' : '<p class="muted small" style="margin:0">No tengo</p>'}</div><span class="switch acc"><input type="checkbox" data-action="eq-db" ${e.db ? 'checked' : ''} aria-label="Tengo mancuernas"><i></i></span></label>
    ${e.db && !e.db.plates?.on ? `<div class="grid3">${[['Más liviana', 'min', 0.5], ['Más pesada', 'max', 0.5], ['De a', 'step', 0.25]].map(([n, k, st]) => unitField(n, `inputmode="decimal" step="${st}" data-set="equip.db.${k}" value="${e.db[k]}"`, 'kg')).join('')}</div>` : ''}
    ${e.db ? `<label class="row tap sub"><div><b>Son de discos</b><br><span class="small muted">Cargás barra y discos: la app calcula los pesos posibles y qué poner de cada lado.</span></div><span class="switch acc"><input type="checkbox" data-action="eq-plates" ${e.db.plates?.on ? 'checked' : ''} aria-label="Mancuernas de discos"><i></i></span></label>` : ''}
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

// Guarda un campo solo si es válido (checkField); si no, queda el último valor válido.
function setPath(path, raw) {
  const r = checkField(path, raw, S.equip);
  if (r.err) return r;
  const keys = path.split('.'), last = keys.pop();
  let o = S; for (const k of keys) o = o[k];
  o[last] = r.v;
  persist();
  return r;
}
// Mensaje debajo del campo: error (borde rojo), aviso, o "Guardado ✓" que se va solo. Sin mensaje, lo limpia.
function fieldMsg(el, msg = '', kind = 'err') {
  const box = el.closest('label.field'); if (!box) return;
  box.querySelector('.fmsg')?.remove();
  if (kind === 'err' && msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  if (!msg) return;
  box.insertAdjacentHTML('beforeend', `<small class="fmsg ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${esc(msg)}</small>`);
  if (kind === 'ok') setTimeout(() => box.querySelector('.fmsg.ok')?.remove(), 2600);
}
// Cambio en un campo del alta o de Ajustes. Los que habían quedado con error se reintentan
// (p. ej. la más liviana vale después de subir la más pesada) y conservan lo escrito tras redibujar.
function onSetField(el) {
  const path = el.dataset.set, inOnb = $('onb').open, root = inOnb ? $('onb') : $('view-settings');
  const r = setPath(path, el.value);
  if (r.err) return fieldMsg(el, r.err);
  const still = [...root.querySelectorAll('[data-set][aria-invalid]')].filter((x) => x !== el).map((x) => [x.dataset.set, x.value]).filter(([p, v]) => setPath(p, v).err);
  if (!inOnb && path.startsWith('equip')) render();
  const field = (p) => root.querySelector(`[data-set="${p}"]`);
  root.querySelectorAll('[data-set][aria-invalid]').forEach((x) => { if (!still.some(([p]) => p === x.dataset.set)) fieldMsg(x); });
  for (const [p, v] of still) { const x = field(p); if (x) { x.value = v; fieldMsg(x, checkField(p, v, S.equip).err); } }
  const now = field(path) || el;
  if (path === 'equip.kb') { now.value = r.v.join(', '); syncBwTile(); }
  if (r.note) fieldMsg(now, r.note, 'warn');
  else if (!inOnb) fieldMsg(now, 'Guardado ✓', 'ok');
  else fieldMsg(now);
}
// En el alta no se avanza con campos inválidos: se marcan todos y el primero recibe el foco.
function onbFieldsOk() {
  const bad = [...$('onb').querySelectorAll('[data-set]')].filter((x) => { const e = checkField(x.dataset.set, x.value, S.equip).err; if (e) fieldMsg(x, e); return e; });
  bad[0]?.focus();
  return !bad.length;
}

// ——— Primer uso ———
let onbStep = 0;
const ONB_STEPS = 5;
let onbPlanSet = false;   // en el alta, el plan recomendado se marca una sola vez; después manda lo que elija la persona
let onbCare = true;       // "¿Activar el cuidado ahora?" en el paso del dolor: prendido salvo que lo apaguen
let onbPainCheck = false; // tras tocar "Ver mi rutina" con zonas sin escala o lado, se marcan en rojo
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
    <label class="field"><span>Nombre o apodo <i class="opt">(opcional)</i></span><input data-set="profile.name" value="${esc(p.name)}" autocomplete="nickname"></label>
    <span class="small muted">Sexo</span><div class="chips" style="margin:4px 0 8px">${[['h', 'Hombre'], ['m', 'Mujer'], ['x', 'Prefiero no decir']].map(([k, v]) => `<button class="chip${p.sex === k ? ' on' : ''}" data-action="set-sex" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="grid3">${unitField('Peso', `id="o-weight" data-set="profile.weight" inputmode="decimal" value="${esc(p.weight)}"`, 'kg')}${unitField('Altura <i class="opt">(opcional)</i>', `data-set="profile.height" inputmode="numeric" value="${esc(p.height)}"`, 'cm')}${unitField('Edad <i class="opt">(opcional)</i>', `data-set="profile.age" inputmode="numeric" value="${esc(p.age)}"`, 'años')}</div>
    <span class="small muted">¿Cuánto hace que entrenás con pesas?</span><div class="chips" style="margin:4px 0 16px">${EXPERIENCE.map((x) => `<button class="chip${p.exp === x.id ? ' on' : ''}" data-action="set-exp" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <span class="small muted">¿Cómo querés los pesos?</span>${weightModeFields()}<p class="faint small">Lo cambiás cuando quieras en Ajustes.</p>`;
  if (onbStep === 2) body = `<h1>Tu equipo</h1><p class="muted small">Marcá lo que tenés. La rutina usa solo eso y redondea los pesos a lo que podés cargar. Sin nada, también se puede.</p>${equipFields()}`;
  if (onbStep === 3) {
    const rec = recommendedPlan(p.exp);
    if (!onbPlanSet) { applyChoice(pickChoice(currentChoice(), rec)); onbPlanSet = true; }
    body = `<h1>Tu plan</h1><p class="muted small">Elegí cómo repartir la semana. Cada plan trae sus días de entreno, que podés cambiar, y la app arma los ejercicios de cada día con tu equipo.</p>
      ${planOptions(currentChoice(), { action: 'onb-plan', dayAction: 'onb-day', tag: { [rec]: 'recomendado' } })}
      <p class="faint small">Lo cambiás cuando quieras en Entreno → Editar rutina.</p>`;
  }
  if (onbStep === 4) {
    // Escala y lado arrancan sin elegir: los pide la persona (un 5 por defecto pasaba como dato real).
    const miss = (msg) => onbPainCheck ? `<small class="fmsg err" role="alert">${msg}</small>` : '';
    const hasZones = activeZones().length > 0;
    body = `<h1>¿Te duele algo?</h1><p class="muted small">Opcional. Si marcás una zona, la app la cuida: baja la carga de los ejercicios que la exigen y te propone ejercicios para recuperar el tendón. Si no te duele nada, seguí.</p>
    <div class="tiles list">${ZONES.map((z) => { const zz = S.zones[z.id]; return tile(`data-action="zone-toggle" data-zone="${z.id}"`, !!zz, esc(z.name), esc(z.hint)) + (!zz ? '' : `<div class="zone-detail" data-zone="${z.id}">
      <span class="small muted">¿Cuánto duele hoy al usarla?</span><div class="chips scale" style="margin-top:6px">${Array.from({ length: 11 }, (_, n) => `<button class="chip pain${zz.pain0 === n ? ' on' : ''}" data-action="zone-pain" data-zone="${z.id}" data-n="${n}">${n}</button>`).join('')}</div>
      <div class="scale-ends small faint"><span>Nada</span><span>El peor dolor</span></div>${zz.pain0 == null ? miss('Elegí cuánto duele, de 0 a 10.') : ''}
      <span class="small muted">¿De qué lado?</span><div class="chips" style="margin-top:6px">${Object.entries(SIDES).map(([k, v]) => `<button class="chip pain${zz.side === k ? ' on' : ''}" data-action="zone-side" data-zone="${z.id}" data-side="${k}">${v}</button>`).join('')}</div>${zz.side == null ? miss('Elegí de qué lado.') : ''}</div>`); }).join('')}</div>
    ${hasZones ? `<div class="card pain care-now"><label class="row tap"><div><h3>¿Activar el cuidado ahora?</h3><p class="muted small">Desde tu primer entreno baja la carga de lo que exige esa zona y suma isométricos a la mañana y a la noche.</p></div>
      <span class="switch"><input type="checkbox" data-action="onb-care" ${onbCare ? 'checked' : ''} aria-label="Activar el cuidado ahora"><i></i></span></label></div>` : ''}
    <p class="faint small">El modo dolor se prende y se apaga cuando quieras en la pestaña Dolor. Usa el protocolo de isométricos del video de Jeremy Ethier con el investigador Keith Baar y el fisioterapeuta Coach Q. No reemplaza a un profesional.</p>`;
  }
  dlg('onb').html = `<div class="dlg">${steps}${body}<div class="btns" style="margin-top:16px">${onbStep ? '<button class="sec" data-action="onb-back">Atrás</button>' : ''}<button class="cta" data-action="onb-next">${onbStep === 0 ? 'Armar mi rutina' : onbStep === ONB_STEPS - 1 ? 'Ver mi rutina' : 'Siguiente'}</button></div></div>`;
  calmMotion($('onb'));
}
// Cambiar de paso: el aviso del paso anterior no pasa al nuevo y se arranca desde arriba.
function onbGo(d) { onbStep += d; hideToast(); renderOnb(); $('onb').querySelector('.dlg').scrollTop = 0; }
function onbNext() {
  if ((onbStep === 1 || onbStep === 2) && !onbFieldsOk()) return;
  if (onbStep === 3 && choiceMissing(currentChoice())) return toast(choiceMissing(currentChoice()));
  if (onbStep < ONB_STEPS - 1) { onbGo(1); return; }
  // Cada zona marcada necesita su escala y su lado; la primera que falte recibe el foco.
  const open = Object.entries(S.zones).find(([, z]) => z.pain0 == null || z.side == null);
  if (open) {
    onbPainCheck = true; renderOnb();
    const box = $('onb').querySelector(`.zone-detail[data-zone="${open[0]}"]`);
    box?.scrollIntoView({ block: 'center' });
    box?.querySelector(open[1].pain0 == null ? '[data-action="zone-pain"]' : '[data-action="zone-side"]')?.focus({ preventScroll: true });
    return;
  }
  if (activeZones().length) S.painMode = onbCare;
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
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return null; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}
// Comparte o descarga un informe y avisa cómo salió (si cancelás el menú de compartir, no dice nada).
async function shareReport(name, html) {
  const r = await shareFile(name, html, 'text/html');
  if (r) toast(r === 'shared' ? 'Informe compartido.' : 'Informe descargado.');
}
// La copia ya lleva la fecha de hoy como última copia, así restaurarla no vuelve a pedir otra enseguida.
async function exportData() {
  const t = today(), data = { ...S, backup: { last: t, snooze: '' } };
  const r = await shareFile(`xz-fit-${t}.json`, JSON.stringify({ app: 'tendon-fuerte', version: APP_VERSION, data }, null, 1), 'application/json');
  if (!r) return;
  S.backup = data.backup; persist(); render(); toast('Copia guardada.');
}
const backupAge = (t) => (S.backup.last ? Math.round((parseDay(t) - parseDay(S.backup.last)) / 864e5) : Infinity);
// "Última copia: hoy", "ayer" o la fecha; si pasó más de un mes, también cuántos días hace.
function lastBackupText(t) {
  const n = backupAge(t);
  if (n === Infinity) return 'Todavía no guardaste ninguna copia.';
  return `Última copia: ${n <= 0 ? 'hoy' : n === 1 ? 'ayer' : fmtDate(S.backup.last)}${n > BACKUP_EVERY ? `, hace ${n} días` : ''}.`;
}
async function importData(file) {
  try {
    const j = JSON.parse(await file.text()), d = j.data || j;
    if (!d.profile || !Array.isArray(d.sessions)) throw new Error('no es una copia de XZ Fit');
    const n = d.sessions.length;
    if (!await ask({ title: '¿Restaurar esta copia?', text: `Tus datos de este teléfono se reemplazan por los de la copia (${n === 1 ? '1 sesión' : `${n} sesiones`}). Lo que anotaste después de guardarla se pierde.`, keep: 'Mantener mis datos', go: 'Restaurar copia' })) return;
    clearLive(); S = withDefaults(d); S.onboarded = true; applyTheme(); await persist(); render(); toast('Copia restaurada.');
  } catch (e) { toast('No se pudo leer el archivo: ' + e.message); }
}

// ——— Eventos ———
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) { hideToast(); return showTab(tabBtn.dataset.tab); }  // el aviso de una pestaña no pasa a la otra
  const hit = e.target.closest('[data-tip]');
  if (hit) return showTip(hit);
  $('tip').hidden = true;
  const el = e.target.closest('[data-action]');
  if (!el || el.matches('input, select')) return;
  const a = el.dataset.action, d = el.dataset;
  const actions = {
    'start-workout': () => startWorkout(Number(d.day)),
    'cancel-workout': async () => { if (await ask({ title: '¿Salir sin guardar?', text: 'Las series que marcaste en este entreno se pierden.', note: 'Para guardarlas, tocá "Terminar".', keep: 'Seguir entrenando', go: 'Salir sin guardar', danger: true })) endWorkout(); },
    'resume-workout': resumeWorkout,
    'discard-workout': discardLive,
    'finish-workout': () => finishWorkout(),
    'finish-anyway': () => { $('finsheet').close(); finishWorkout(true); },
    'set-done': () => setDone(+d.i, +d.j),
    'rir-help': () => { W.rirHelp = W.rirHelp === +d.i ? -1 : +d.i; renderWorkout(); },
    'swap-today': () => openSwapToday(+d.i),
    'swap-why': () => swapToday(+d.i, d.off),
    'skip-rest': stopRest,
    'hold': () => startHold(+d.i, +d.j),
    'hold-stop': () => endHold(),
    'ex-detail': () => openExercise(d.ex),
    'recalibrate': async () => {
      const calib = weightMode() === 'calib';
      if (!await ask({ title: calib ? '¿Volver a calibrar?' : '¿Borrar el peso de trabajo?', text: calib ? 'Se borra el peso de trabajo de este ejercicio y la próxima vez lo calibrás de nuevo.' : 'Se borra el peso de trabajo de este ejercicio y la próxima vez arranca de cero.', note: 'Tu historial no cambia.', keep: 'Mantener el peso', go: calib ? 'Volver a calibrar' : 'Borrar el peso', danger: true })) return;
      delete S.lifts[d.ex]; persist(); $('exsheet').close(); render();
    },
    'close': () => $(d.dlg).close(),
    'start-rehab': startRehab,
    'rehab-go': rehabGo,
    'rehab-skip': rehabSkip,
    'lento-set': () => { const it = R.items[R.idx]; it.done = +d.s < it.done ? +d.s : +d.s + 1; renderRehab(); },
    'rehab-next': () => { R.idx++; R.state = 'listo'; renderRehab(); },
    'custom-done': () => { R.custom[+d.i].done = !R.custom[+d.i].done; saveRehab(); renderRehab(); },
    'rehab-pain': rehabPain,
    'rehab-close': () => { closeRehab(); toast('Rehabilitación guardada.'); },
    'cancel-rehab': async () => { if (R.saved) { closeRehab(); toast('Rehabilitación guardada.'); } else if (await ask({ title: '¿Salir sin guardar?', text: 'Lo que hiciste en esta sesión de rehabilitación no se anota.', keep: 'Seguir la sesión', go: 'Salir sin guardar', danger: true })) closeRehab(); },
    'pref': () => { S.prefs[d.k] = d.v === undefined ? !S.prefs[d.k] : Number(d.v); persist(); render(); if (d.k === 'sound' || d.k === 'voice') cue('go', 'Así suena'); },
    'news': openNews,
    'theme': () => { S.prefs.theme = d.v; S.prefs.themeSet = true; applyTheme(); persist(); render(); },
    'quick-pain': () => askPain({ id: uid(), date: today(), type: 'dolor', items: [] }, activeZones()),
    'deload': () => { S.plan.deload = weekKey(today()); persist(); render(); toast('Semana de descarga: una serie menos y 90 % del peso. La próxima semana seguís normal.'); },
    'level-up': () => { S.profile.exp = d.v; persist(); render(); toast(`Experiencia cambiada: ${EXPERIENCE.find((x) => x.id === d.v).name.toLowerCase()}.`); },
    'level-no': () => { S.plan.levelOffer = today(); persist(); render(); },
    'deload-no': () => { S.plan.deloadOffer = weekKey(today()); persist(); render(); },
    'deload-off': () => { S.plan.deload = ''; persist(); render(); },
    'unstall': () => { const l = S.lifts[d.ex], steps = weightSteps(S.equip, implFor(getEx(d.ex), S.equip)); l.w = roundDown(steps, l.w * 0.9); persist(); render(); toast(`${getEx(d.ex).name}: ${fmtKg(l.w)}. Volvé a subir desde acá.`); },
    'rehab-choice': () => {
      const z = S.zones[d.zone], ex = EXERCISES[d.ex], steps = weightSteps(S.equip, implFor(ex, S.equip));
      z.choice = { ...z.choice, [Math.min(2, z.phase)]: d.ex };
      // Otra herramienta: la carga arranca de nuevo desde lo mínimo del ejercicio elegido.
      if (ex.impl === 'bw') z.load = 0; else if (!steps.includes(z.load)) z.load = ex.load0 ? roundDown(steps, ex.load0) : 0;
      persist(); render(); toast(`${zoneName(d.zone)}: ${ex.name}.`);
    },
    'plate-add': () => { S.equip.db.plates.items.push({ kg: 1.25, n: 4 }); persist(); render(); },
    'plate-del': () => { S.equip.db.plates.items.splice(+d.i, 1); persist(); render(); },
    'install': installApp,
    'install-hide': () => { S.hideInstall = true; persist(); render(); },
    'warm': () => { W.warm[+d.i].done = !W.warm[+d.i].done; renderWorkout(); },
    'hist-help': () => { histHelp[d.k] = !histHelp[d.k]; renderHistory(); },
    'hist-recs': () => { histRecAll = !histRecAll; renderHistory(); },
    'report': () => shareReport(`informe-xz-fit-${today()}.html`, reportHTML()),
    'export-train': () => shareReport(`entrenos-xz-fit-${today()}.html`, trainingHTML()),
    'backup-no': () => { S.backup.snooze = addDays(today(), 14); persist(); render(); },
    'week-day': () => { homePeek = homePeek === d.v ? '' : d.v; renderHome(); },
    'news-seen': () => { S.seenVersion = APP_VERSION; persist(); render(); },
    'pain-val': () => { P.vals[d.zone] = +d.n; renderPain(); },
    'save-pain': savePain,
    'check': () => answerCheck(d.zone, d.val),
    'pain-mode-on': () => { S.painMode = true; persist(); render(); toast('Modo dolor activado.'); },
    'go-pain': () => { hideToast(); showTab('tendons'); },
    'hide-pain-tip': () => { S.hidePainTip = true; persist(); render(); },
    'phase': async () => {
      const z = S.zones[d.zone], to = z.phase + Number(d.dir);
      if (to < 1 || to > 3) return;
      if (Number(d.dir) > 0 && !phaseReady(S, d.zone, today()) && !await ask({ title: `¿Pasar a la fase ${to}?`, text: `Todavía no cumple el criterio: ${PHASE_DAYS} días en la fase y una semana con dolor en 3 o menos.`, note: 'Avanzar antes de tiempo puede volver a irritar el tendón.', keep: `Seguir en la fase ${z.phase}`, go: 'Avanzar igual' })) return;
      S.zones[d.zone] = { ...S.zones[d.zone], phase: to, since: today() }; persist(); render();
    },
    'three-days': () => openPlans('fb3'),
    'plan-open': () => openPlans(),
    'plan-use': usePlan,
    'card-day': () => cardDay(d.v),
    'plan-day': () => choiceDay(PC, d.v, (c) => { PC = c; renderPlans(); }),
    'onb-day': () => choiceDay(currentChoice(), d.v, (c) => { applyChoice(c); persist(); renderOnb(); }),
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
    'custom-del': async () => { if (await ask({ title: '¿Eliminar este ejercicio?', text: 'Se quita de tus ejercicios del fisio. No se puede deshacer.', keep: 'Mantener el ejercicio', go: 'Eliminar ejercicio', danger: true })) { S.custom = S.custom.filter((x) => x.id !== d.id); persist(); $('customsheet').close(); render(); } },
    'del-session': () => {
      const i = S.sessions.findIndex((s) => s.id === d.id); if (i < 0) return;
      const [gone] = S.sessions.splice(i, 1); persist(); render();
      toast('Sesión eliminada.', () => { S.sessions.splice(i, 0, gone); persist(); render(); toast('Sesión recuperada.'); });
    },
    'undo': () => { const f = toastUndo; hideToast(); f?.(); },
    'set-sex': () => { S.profile.sex = d.v; persist(); $('onb').open ? renderOnb() : render(); },
    'set-exp': () => { S.profile.exp = d.v; persist(); $('onb').open ? renderOnb() : render(); },
    'ics': () => shareFile('xz-fit.ics', icsText(S.rem, S.painMode, today()), 'text/calendar'),
    'export': exportData,
    'import': () => $('import-file').click(),
    'reset': () => { wipeQ = ''; confirmWipe(); },
    'wipe-backup': async () => { await exportData(); if ($('wipesheet').open) confirmWipe(); },
    'wipe-go': wipeAll,
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
    'routine-reset': confirmReset,
    'reset-routine': () => {
      const plan = activePlan(S), before = structuredClone(S.routine[plan.id]);
      $('resetsheet').close(); resetRoutine(); persist(); render();
      toast(`Volviste al plan original en los ${plan.days.length} días.`, () => { S.routine[plan.id] = before; persist(); render(); });
    },
    'pick-ex': () => pickExercise(d.ex),
    'exform': () => openExForm(d.id),
    'xf-kind': () => { readExForm(); XF.kind = d.v; renderExForm(); },
    'xf-tag': () => { readExForm(); XF.tag = XF.tag.includes(d.v) ? XF.tag.filter((z) => z !== d.v) : [...XF.tag, d.v]; renderExForm(); },
    'exform-save': saveExForm,
    'exform-del': deleteExForm,
    'mach-edit': () => openMachine(d.id),
    'xf-mach': () => { readExForm(); openMachine('', true); },
    'mach-save': () => saveMachine(d.id),
    'ask-go': () => { const done = askDone; askDone = null; $('asksheet').close(); done?.(true); },
    'mach-del': async () => {
      if (!await ask({ title: '¿Eliminar la máquina?', text: 'Los ejercicios que la usan quedan como "falta equipo" hasta que la vuelvas a cargar o los cambies.', keep: 'Mantener la máquina', go: 'Eliminar máquina', danger: true })) return;
      S.equip.machines = S.equip.machines.filter((m) => m.id !== d.id); persist(); $('machsheet').close(); $('onb').open ? renderOnb() : render();
    },
    'onb-back': () => onbGo(-1),
  };
  actions[a]?.();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.set) return onSetField(el);
  if (el.dataset.w) { const [i, j, k] = el.dataset.w.split('.'); W.items[+i].rows[+j][k] = el.value; saveLive(); return; }
  const a = el.dataset.action;
  if (a === 'onb-care') onbCare = el.checked;
  if (a === 'pain-mode') { S.painMode = el.checked; persist(); render(); toast(el.checked ? 'Modo dolor activado.' : 'Modo dolor apagado: el entreno usa los pesos completos.'); }
  if (a === 'zone-toggle') {
    const zone = el.dataset.zone, name = zoneName(zone).toLowerCase();
    if (el.checked) S.zones[zone] = $('onb').open ? newZone(zone, null, null) : newZone(zone);
    else if ($('onb').open) delete S.zones[zone];
    else {   // fuera del inicio, quitar una zona pierde su fase: se pregunta y el tilde queda puesto hasta responder
      el.checked = true;
      return ask({ title: `¿Quitar ${name}?`, text: `Se pierde la fase y la carga actual de ${name}.`, keep: 'Mantener la zona', go: 'Quitar zona', danger: true })
        .then((yes) => { if (yes && S.zones[zone]) { delete S.zones[zone]; persist(); render(); } });
    }
    persist(); $('onb').open ? renderOnb() : render();
  }
  if (a === 'eq-db') { S.equip.db = el.checked ? { min: 2, max: 24, step: 2 } : null; rearmRoutine(); persist(); $('onb').open ? renderOnb() : render(); }
  if (a === 'eq-bw') {
    // Prenderlo guarda el equipo y lo vacía; apagarlo lo devuelve (o vuelve a las mancuernas de fábrica).
    if (el.checked) { if (!noEquip(S.equip)) S.equipBak = S.equip; S.equip = bareEquip(S.equip); }
    else { S.equip = S.equipBak || { ...S.equip, db: { min: 2, max: 24, step: 2 } }; S.equipBak = null; }
    rearmRoutine(); persist(); $('onb').open ? renderOnb() : render();
    if (!$('onb').open) toast(el.checked ? 'Listo: tu plan usa ejercicios sin material.' : 'Volvió tu equipo: rearmamos los ejercicios que no habías elegido vos.');
  }
  if (a === 'eq-rings') { S.equip.rings = el.checked; persist(); if (!$('onb').open) render(); else syncBwTile(); }
  if (a === 'eq-flag') {
    S.equip[el.dataset.k] = el.checked; persist(); if (!$('onb').open) render(); else syncBwTile();
    if (el.checked && el.dataset.k === 'bench' && !$('onb').open && S.routine[activePlan(S).id]?.flat().some((it) => it.ex === 'press_suelo')) toast('Con banco podés hacer press en banco en vez de press en el suelo.', benchSwap, 'Cambiar ahora');
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
  if (a === 'plan-sel') { PC = el.value === currentChoice().id ? currentChoice() : pickChoice(PC, el.value); renderPlans(); }
  if (a === 'onb-plan') { applyChoice(pickChoice(currentChoice(), el.value)); persist(); renderOnb(); }
  if (a === 'weights-mode') {
    S.prefs.weights = el.value; persist(); $('onb').open ? renderOnb() : render();
    // La opción elegida queda entera a la vista, no debajo de la barra de pestañas.
    if (!$('onb').open) document.querySelector(`#view-settings [data-action="weights-mode"][value="${el.value}"]`)?.closest('.tile').scrollIntoView({ block: 'nearest' });
  }
  if (a === 'pref-toggle') { S.prefs[el.dataset.k] = el.checked; persist(); if (el.checked && el.dataset.k !== 'auto') cue('go', 'Así suena'); }
  if (a === 'hist-zone') { histZone = el.value; renderHistory(); }
  if (a === 'hist-ex') { histEx = el.value; renderHistory(); }
  if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
});
document.addEventListener('input', (e) => { if (e.target.id === 'pick-q') { pickQ = e.target.value; filterPicker(); return; }
  if (e.target.id === 'wipe-q') { wipeQ = e.target.value; $('wipesheet').querySelector('.wipe-go').disabled = !wipeOk(); return; } if (e.target.dataset.w) { const [i, j, k] = e.target.dataset.w.split('.'); W.items[+i].rows[+j][k] = e.target.value; saveLiveSoon(); } });
// Escape cierra los diálogos; en entreno y rehab se pregunta antes.
// Lo plegable del entreno recuerda si quedó abierto entre redibujos; la entrada en calor abierta pasa a ser el foco.
document.addEventListener('toggle', (e) => {
  const f = e.target.dataset?.fold;
  if (!f || !W || W[f] === e.target.open) return;
  W[f] = e.target.open;
  if (f === 'warmOpen') renderWorkout();
}, true);
$('asksheet').addEventListener('close', () => askDone?.(false));   // Cancelar, Esc o atrás: no hace nada
document.addEventListener('cancel', (e) => { if (['wsheet', 'rsheet', 'painsheet', 'onb'].includes(e.target.id)) e.preventDefault(); }, true);

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (tab === 'home') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('¡App instalada!'); render(); });

// ——— Arranque ———
(async () => {
  try { const d = await db.get('data'); if (d) S = withDefaults(d); } catch (e) { toast('No se pudo abrir la base de datos: ' + e.message); }
  try { if (S.onboarded) LIVE = reviveLive(await db.get('live')); } catch {}
  applyTheme();
  if (!S.onboarded || !S.seenVersion) { S.seenVersion = S.onboarded ? '1.2.0' : APP_VERSION; }   // quien ya usaba la app ve las novedades nuevas
  render();
  if (!S.onboarded) { renderOnb(); $('onb').showModal(); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (W || R)) keepAwake(true); else if (W) saveLive(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
})();
