// Pruebas de punta a punta de XZ Fit (Playwright + Chromium).
// Uso: python -m http.server 8124 & ; node tests/e2e.mjs   (SHOTS=carpeta guarda capturas)
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:8124/';
const SHOTS = process.env.SHOTS;
let failures = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, colorScheme: 'dark' });
await ctx.addInitScript(() => { delete Navigator.prototype.canShare; delete Navigator.prototype.share; });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const toastText = () => page.locator('#toast span').textContent();
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(S)));
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(80); };

let dl;
// 0a. Motor de planes: migración, sincronización e inicio
// Cada caso borra la base, guarda datos como los dejaba la v1.14 (templates A/B y plan con budget/week/next) y recarga.
const errorsBeforePlans = errors.length;
let ps;   // estado leído en este bloque (s se declara en la sección 1)
const wipeDb = () => page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('tendon-fuerte'); q.onsuccess = q.onerror = q.onblocked = r; }));
// putData guarda un estado crudo; buildV114 lo arma en la página (fecha las sesiones con today()/addDays) y saveV114 devuelve lo guardado para compararlo.
const putData = (d) => page.evaluate((d) => new Promise((res) => {
  const r = indexedDB.open('tendon-fuerte', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(d, 'data'); t.oncomplete = () => { r.result.close(); res(); }; };
}), d);
const buildV114 = (o) => page.evaluate((o) => {
  const old = { v: 1, onboarded: true, painMode: false, seenVersion: '1.14.1',
    profile: { name: 'Vieja', sex: 'm', weight: '60', height: '165', age: '35', exp: 'novato', days: 2, ...o.profile },
    equip: { db: { min: 2, max: 24, step: 2 }, kb: [], rings: false, bench: false, bar: false, band: false, machines: [], ...o.equip },
    templates: { ...TEMPLATES, ...o.templates }, exlib: o.exlib || [], zones: {}, lifts: o.lifts || {}, checks: [], custom: [],
    sessions: (o.sessions || []).map((x, i) => ({ id: 'v' + i, date: addDays(today(), -x.ago), type: 'entreno', tpl: 'A', items: x.items || [] })),
    plan: { budget: 36, week: weekKey(today()), next: 'A', ...o.plan }, ...o.extra };
  return old;
}, o);
const saveV114 = async (o) => { const old = await buildV114(o); await putData(old); return old; };
const bootSaved = async (o = {}) => { await wipeDb(); const saved = await saveV114(o); await page.reload(); await page.waitForTimeout(400); return saved; };
const homeTitle = () => page.locator('#view-home .card:has([data-action="start-workout"]) h3').textContent();
const daySets = () => page.evaluate(() => planFor(dayIndex(activePlan(S), S.plan.pos)).filter((p) => !p.missing).map((p) => p.sets));
const dayIds = (st, d) => st.routine.fb2[d].map((it) => it.ex);
const pinnedNotice = async () => (await toastText()).includes('ya no se puede');
await page.goto(URL);

// CK-5: la rutina editada pasa tal cual y fijada (con aros y banco, así todo sigue siendo posible)
const myEx = { id: 'c_mio', name: 'Mi remo en polea', kind: 'peso', impl: 'db', cat: 'tiron', tag: [], start: 0, note: '' };
const editedTpl = { A: ['goblet', 'press_banco', 'remo_silla', 'rdl', 'lateral', 'plancha'], B: ['swing', 'zancada', 'remo_aros', 'press_hombros', 'triceps', 'curl_martillo', 'c_mio'] };
await bootSaved({ templates: editedTpl, exlib: [myEx], equip: { rings: true, bench: true } });
ps = await state();
ok(JSON.stringify(dayIds(ps, 0)) === JSON.stringify(editedTpl.A) && JSON.stringify(dayIds(ps, 1)) === JSON.stringify(editedTpl.B), 'migración v1.14: la rutina editada queda igual, ítem por ítem y en el mismo orden');
ok(ps.routine.fb2.flat().every((it) => it.pinned === true), 'migración v1.14: todos los ejercicios quedan fijados');
ok(ps.routine.fb2[1][6].slot === null && !('templates' in ps), 'el ejercicio propio queda sin hueco y templates desaparece');
ok(!(await pinnedNotice()), 'migrar una rutina posible no muestra avisos');
// La pestaña Dolor: oculta sin modo dolor ni zonas, a mano desde Ajustes y aparece al marcar una zona
const painTab = page.locator('.tabbar [data-tab="tendons"]');
ok(await painTab.isHidden() && await page.locator('.tabbar button:visible').count() === 4, 'sin dolor ni zonas, la barra tiene cuatro pestañas');
await click('[data-tab="settings"]');
await click('#view-settings [data-action="go-pain"]');
ok(await page.locator('#view-tendons').isVisible(), 'desde Ajustes se llega a la vista de dolor');
await click('#view-tendons [data-action="zone-toggle"][data-zone="hombro"]');
ok(await painTab.isVisible() && (await painTab.textContent()).trim() === 'Dolor', 'al marcar una zona aparece la pestaña "Dolor"');
await click('#view-tendons [data-action="zone-toggle"][data-zone="hombro"]');
ok(await painTab.isHidden() && await page.locator('#view-home').isVisible(), 'al desmarcar la última zona la pestaña se va y volvés a Hoy');
// Historial sin entrenos: un solo vacío con el botón del día que toca, sin la sección de dolor
await click('[data-tab="history"]');
ok(await page.locator('#view-history .empty-hist [data-action="start-workout"]').count() === 1 && await page.locator('#view-history h2').count() === 0, 'historial nuevo: un solo vacío con botón para empezar, sin dolor');
await click('#view-history .empty-hist [data-action="start-workout"]');
ok(await page.locator('#wsheet[open]').count() === 1, 'el botón del historial arranca el entreno');
await click('#wsheet [data-action="cancel-workout"]');
await click('[data-tab="home"]');

// CK-6: next 'B' → pos 1, se quitan budget/week/next y lifts/sesiones no cambian
const liftsB = { goblet: { w: 12, e1rm: 18 }, press_suelo: { w: 8 } };
const sessionsB = [{ ago: 3, items: [{ ex: 'goblet', sets: [{ w: 12, reps: 10 }] }] }, { ago: 6, items: [{ ex: 'press_suelo', sets: [{ w: 8, reps: 11 }] }] }];
const savedB = await bootSaved({ plan: { next: 'B' }, lifts: liftsB, sessions: sessionsB });
ps = await state();
ok(ps.plan.pos === 1 && ps.plan.id === 'fb2' && ['budget', 'week', 'next'].every((k) => !(k in ps.plan)), 'migración: next B → pos 1, sin budget/week/next');
ok((await homeTitle()).startsWith('Día B'), 'migración: el inicio muestra el Día B que tocaba');
ok(JSON.stringify(ps.lifts) === JSON.stringify(savedB.lifts) && JSON.stringify(ps.sessions) === JSON.stringify(savedB.sessions), 'migración: pesos y sesiones quedan iguales');
ok(ps.plan.since === savedB.sessions[1].date, 'migración: el plan empieza con el primer entreno guardado');
const migrated = JSON.stringify({ routine: ps.routine, plan: ps.plan });
await page.reload(); await page.waitForTimeout(300); await page.reload(); await page.waitForTimeout(300);
ps = await state();
ok(JSON.stringify({ routine: ps.routine, plan: ps.plan }) === migrated, 'migración idempotente: recargar dos veces no cambia rutina ni plan');
await click('[data-tab="settings"]');
await page.setInputFiles('#import-file', { name: 'v114.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'tendon-fuerte', version: '1.14.1', data: savedB })) });
await page.waitForTimeout(300);
ps = await state();
ok(JSON.stringify({ routine: ps.routine, plan: ps.plan }) === migrated, 'importar la misma copia de la v1.14 deja rutina y plan iguales');
ok(await page.evaluate(() => JSON.stringify(withDefaults(S)) === JSON.stringify(S)), 'withDefaults sobre datos ya migrados no cambia nada');
await bootSaved({ plan: { next: 'A' } });
ok((await state()).plan.pos === 0, 'migración: next A → pos 0');

// CK-7: el inicio del plan de un usuario migrado es su primer entreno (rampa solo si fue hace menos de 14 días)
for (const [ago, sets] of [[20, 3], [14, 3], [13, 2]]) {
  await bootSaved({ sessions: [{ ago }] });
  const all = await daySets();
  ok(all.length === 6 && all.every((n) => n === sets), `migrado con primer entreno hace ${ago} días: ${sets} series por ejercicio (${all.join(',')})`);
}

// CK-20 y CK-24: tarjeta de inicio "<día> · N ejercicios" y objetivo semanal por días del plan
await bootSaved({ profile: { days: 3 } });
ok((await homeTitle()).trim() === 'Día A · 6 ejercicios', 'inicio con el equipo por defecto: "Día A · 6 ejercicios"');
const homeText = await page.locator('#view-home').textContent();
ok(!homeText.includes('Entreno A') && !homeText.includes('Cuerpo completo') && homeText.includes('Full body 2 días'), 'el inicio ya no dice "Entreno A" ni "Cuerpo completo" y nombra el plan');
ok(await page.locator('#view-home .week .dots i').count() === 2, 'con 3 días en el perfil y fb2, la tarjeta semanal tiene 2 entrenos de objetivo');
ok(await page.locator('#view-home [data-action="start-workout"][data-day="0"]').count() === 1, 'el botón de empezar lleva el día del plan');
await bootSaved({ equip: { db: null, kb: [12, 20], rings: true } });
ok((await homeTitle()).trim() === 'Día A · 5 ejercicios', 'sin mancuernas el hueco lateral no tiene ejercicio posible: N baja a 5');
ok(await page.evaluate(() => !implFor(EXERCISES.lateral, S.equip) && !implFor(EXERCISES.elev_frontal, S.equip)), 'implFor trata db: null como sin mancuernas');

// CK-27: un plan inexistente vuelve a fb2 sin errores
await bootSaved({ plan: { id: 'zzz', pos: 0 }, extra: { routine: { zzz: [] } } });
ok((await state()).plan.id === 'fb2' && (await homeTitle()).startsWith('Día A · '), 'plan guardado "zzz": la app usa fb2 y el inicio muestra el Día A');

// CK-32: sin aros, el remo en aros migra como remo en silla fijado y sin aviso
await bootSaved();
ps = await state();
ok(ps.routine.fb2[1].some((it) => it.ex === 'remo_silla' && it.pinned) && !dayIds(ps, 1).includes('remo_aros'), 'migración sin aros: el Día B tiene el remo en silla fijado');
ok(!(await pinnedNotice()), 'migración sin aros: no aparece el aviso de ejercicio fijado imposible');
await page.reload(); await page.waitForTimeout(400);
ok(!(await pinnedNotice()), 'migración sin aros: tampoco al recargar');

// CK-12 (sincronización): un fijado que ya no es posible se reemplaza, se guarda sin fijar y avisa una sola vez
await bootSaved({ templates: { A: ['goblet', 'press_banco', 'remo_silla', 'rdl', 'lateral', 'plancha'] } });
ok((await toastText()).trim() === 'Press en banco con mancuernas ya no se puede con tu equipo: lo cambiamos por press en el suelo con mancuernas.', 'fijado imposible al arrancar: un solo aviso con el reemplazo');
await page.reload(); await page.waitForTimeout(400);
ok((await state()).routine.fb2[0][1].ex === 'press_suelo' && (await state()).routine.fb2[0][1].pinned === false && !(await pinnedNotice()), 'el reemplazo quedó guardado sin fijar y al recargar no vuelve a avisar');

// CK-28: el estancamiento se busca en la rutina guardada (press en banco y curl concentrado no están en TEMPLATES)
const stuckItems = [{ ex: 'press_banco', sets: [{ w: 10, reps: 10 }, { w: 10, reps: 10 }] }, { ex: 'curl_concentrado', sets: [{ w: 6, reps: 10 }, { w: 6, reps: 10 }] }];
await bootSaved({ templates: { A: ['goblet', 'press_banco', 'remo_silla', 'rdl', 'curl_concentrado', 'plancha'] },
  equip: { bench: true }, lifts: { press_banco: { w: 10 }, curl_concentrado: { w: 6 } }, sessions: [2, 5, 8].map((ago) => ({ ago, items: stuckItems })) });
ok(await page.locator('#view-home >> text=¿Semana de descarga?').count() === 1, 'con 2 ejercicios de la rutina estancados 3 sesiones, el inicio ofrece la descarga');
ok(errors.length === errorsBeforePlans, `motor de planes sin errores de JavaScript${errors.length > errorsBeforePlans ? ': ' + errors.slice(errorsBeforePlans).join(' | ') : ''}`);

// 0b. Motor de planes: vista Entreno y rutina
// Usuarios v1.14 inyectados en IndexedDB (bootSaved); cada caso edita la rutina por la pantalla y mira lo guardado.
const errorsBeforeTrain = errors.length;
const trainTab = () => click('[data-tab="train"]');
const dayRoutine = (d) => page.evaluate((d) => JSON.parse(JSON.stringify(S.routine.fb2[d])), d);

// Vista Entreno: días apilados desde el plan, "toca hoy" y botones con el día del plan
await bootSaved();
await trainTab();
ok(JSON.stringify(await page.locator('#view-train h2').allTextContents()) === JSON.stringify(['Día A · toca hoy', 'Día B']), 'Entreno: apila "Día A · toca hoy" y "Día B" desde el plan');
ok(await page.locator('#view-train .ex').count() === 12, 'Entreno: con el equipo por defecto muestra los 12 ejercicios');
ok(await page.locator('#view-train [data-action="start-workout"][data-day="0"]').count() === 1 && await page.locator('#view-train [data-action="start-workout"][data-day="1"]').count() === 1, 'Entreno: un botón de empezar por día con data-day 0 y 1');
const trainHead = await page.locator('#view-train p.muted').first().textContent();
ok(trainHead.includes('Full body 2 días') && trainHead.includes('cada ejercicio sube dentro de su rango') && !trainHead.includes('Cuerpo completo'), 'Entreno: el encabezado nombra el plan y el rango, no "Cuerpo completo A/B"');
await bootSaved({ plan: { next: 'B' } });
await trainTab();
ok(JSON.stringify(await page.locator('#view-train h2').allTextContents()) === JSON.stringify(['Día A', 'Día B · toca hoy']), 'Entreno: con pos 1 "toca hoy" pasa al Día B');

await bootSaved({ equip: { bench: true } });
// "+ Agregar": ejercicio de la biblioteca (con su hueco) y ejercicio propio (sin hueco), ambos fijados
await trainTab(); await click('[data-action="edit-routine"]');
await click('[data-action="edit-day"][data-day="1"]');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await page.waitForSelector('#pickersheet[open]');
await click('#pickersheet [data-ex="pullover"]');
let dayB = await dayRoutine(1);
ok(dayB.length === 7 && JSON.stringify(dayB.at(-1)) === JSON.stringify({ slot: await page.evaluate(() => slotOf('pullover')), ex: 'pullover', pinned: true }) && dayB.at(-1).slot !== null, 'agregar un ejercicio de la biblioteca: { slot: slotOf(id), ex, pinned: true }');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await click('#pickersheet [data-action="exform"]:not([data-id])');
await page.fill('#x-name', 'Remo en polea propio');
await click('[data-action="exform-save"]');
dayB = await dayRoutine(1);
const customId = dayB.at(-1).ex;
ok(customId.startsWith('c_') && dayB.at(-1).slot === null && dayB.at(-1).pinned === true, 'agregar un ejercicio propio: { slot: null, ex: c_…, pinned: true }');

// Subir y Quitar actúan solo en su día
const dayABefore = await dayRoutine(0);
await click('#view-train [data-action="routine-move"][data-day="1"][data-i="7"][data-d="-1"]');
dayB = await dayRoutine(1);
ok(dayB[6].ex === customId && dayB[7].ex === 'pullover' && JSON.stringify(await dayRoutine(0)) === JSON.stringify(dayABefore), 'Subir reordena dentro del Día B y no toca el Día A');
await click('#view-train [data-action="routine-del"][data-day="1"][data-i="6"]');
dayB = await dayRoutine(1);
ok(dayB.length === 7 && !dayB.some((it) => it.ex === customId) && JSON.stringify(await dayRoutine(0)) === JSON.stringify(dayABefore), 'Quitar saca el ítem del Día B y deja intacto el Día A');
await page.evaluate(() => routineSet(1, dayItems(1).slice(0, 1)));
await click('#view-train [data-action="routine-del"][data-day="1"][data-i="0"]');
ok((await dayRoutine(1)).length === 1 && (await toastText()).includes('Dejá al menos un ejercicio.'), 'no deja quitar el último ejercicio de un día');

// CK-23: "Volver al plan original" re-resuelve los huecos sin fijados y no toca Mis ejercicios
const exlibBefore = await page.evaluate(() => JSON.stringify(S.exlib));
ok(JSON.parse(exlibBefore).some((c) => c.id === customId), 'antes de volver al plan original el ejercicio propio está en Mis ejercicios');
await click('[data-action="routine-reset"]');
ok(await page.evaluate(() => JSON.stringify(S.routine.fb2) === JSON.stringify(resolvePlan(activePlan(S), S.equip, { getEx, bw: S.plan.bw }))), 'CK-23: "Volver al plan original" deja la rutina igual a resolver los huecos');
ok((await state()).routine.fb2.flat().every((it) => it.pinned === false), 'CK-23: tras volver al plan original no queda nada fijado');
ok(await page.evaluate(() => JSON.stringify(S.exlib)) === exlibBefore, 'CK-23: el ejercicio propio sigue en Mis ejercicios');

// Eliminar un ejercicio propio lo quita de todos los días
await click('[data-action="edit-day"][data-day="0"]');
await click('#view-train [data-action="routine-pick"][data-day="0"]:not([data-i])');
await page.waitForSelector('#pickersheet[open]');
await click(`#pickersheet [data-ex="${customId}"]`);
ok((await dayRoutine(0)).some((it) => it.ex === customId), 'el ejercicio propio vuelve a estar en la rutina');
await click('[data-action="edit-day"][data-day="1"]');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await click(`#pickersheet [data-ex="${customId}"]`);
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await click(`#pickersheet [data-action="exform"][data-id="${customId}"]`);
await click('#exformsheet [data-action="exform-del"]');
ok((await state()).exlib.length === 0 && !(await state()).routine.fb2.flat().some((it) => it.ex === customId), 'eliminar el ejercicio propio lo quita de todos los días de la rutina');
await click('#pickersheet [data-action="close"]');
ok(errors.length === errorsBeforeTrain, `vista Entreno y rutina sin errores de JavaScript${errors.length > errorsBeforeTrain ? ': ' + errors.slice(errorsBeforeTrain).join(' | ') : ''}`);

// 8b1. Editor por día y aviso de fijado
await bootSaved({ equip: { bench: true }, exlib: [myEx], templates: { B: ['swing', 'zancada', 'remo_silla', 'c_mio'] } });
await trainTab(); await click('[data-action="edit-routine"]');
ok(JSON.stringify(await page.locator('#view-train .chips .chip').allTextContents()) === JSON.stringify(['Día A', 'Día B']), 'CK-22: Editar rutina muestra las pestañas "Día A" y "Día B"');
await click('#view-train [data-action="routine-pick"][data-day="0"][data-i="1"]');
await page.waitForSelector('#pickersheet[open]');
ok((await page.locator('#pickersheet h2').first().textContent()) === 'Empuje horizontal · mismo hueco', 'CK-22: el selector abre con el hueco "Empuje horizontal · mismo hueco"');
ok(await page.locator('#pickersheet [data-ex]').first().getAttribute('data-ex') === 'press_banco', 'CK-22: el primer ejercicio del selector es press en banco, antes de Mis ejercicios');
const sameSlot = await page.locator('#pickersheet h2').first().evaluate((h) => { const ids = []; for (let n = h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) { const id = n.dataset.ex; if (id) ids.push(id); } return ids; });
ok(JSON.stringify(sameSlot) === JSON.stringify(['press_banco', 'press_suelo', 'flexiones']), 'CK-22: el mismo hueco lista press en banco, press en el suelo y flexiones');
ok(await page.evaluate(() => { const v = [...document.querySelectorAll('#pickersheet [data-ex]')].map((e) => e.dataset.ex); return v.length === new Set(v).size; }), 'en el selector de cambio cada [data-ex] aparece una sola vez');
await click('#pickersheet [data-ex="press_banco"]');
const pinnedBench = { slot: 'empuje_h', ex: 'press_banco', pinned: true };
ok(JSON.stringify((await dayRoutine(0))[1]) === JSON.stringify(pinnedBench), 'CK-22: elegir press en banco lo deja fijado');
await page.reload(); await page.waitForTimeout(400);
ok(JSON.stringify((await dayRoutine(0))[1]) === JSON.stringify(pinnedBench), 'CK-22: el press en banco fijado sobrevive al recargar');

// Las pestañas muestran un solo día en edición; al salir vuelven los dos
await trainTab(); await click('[data-action="edit-routine"]');
await click('[data-action="edit-day"][data-day="1"]');
ok(JSON.stringify(await page.locator('#view-train h2').allTextContents()) === JSON.stringify(['Día B']) && await page.locator('#view-train .ex').count() === 4, 'la pestaña Día B muestra solo los ítems del Día B');
const hasSameSlot = () => page.locator('#pickersheet h2', { hasText: 'mismo hueco' }).count();
await click('#view-train [data-action="routine-pick"][data-day="1"][data-i="3"]');
await page.waitForSelector('#pickersheet[open]');
ok(await hasSameSlot() === 0, 'un ejercicio propio (sin hueco) no muestra la sección "mismo hueco"');
await click('#pickersheet [data-action="close"]');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await page.waitForSelector('#pickersheet[open]');
ok(await hasSameSlot() === 0, '"+ Agregar" no muestra la sección "mismo hueco"');
await click('#pickersheet [data-action="close"]');
await click('[data-action="edit-routine"]');
ok(JSON.stringify(await page.locator('#view-train h2').allTextContents()) === JSON.stringify(['Día A · toca hoy', 'Día B']), 'al salir de editar vuelven los dos días apilados');

// CK-12: quitar el banco con el press en banco fijado avisa una sola vez
await click('[data-tab="settings"]');
await page.uncheck('#view-settings [data-action="eq-flag"][data-k="bench"]');
ok((await toastText()).trim() === 'Press en banco con mancuernas ya no se puede con tu equipo: lo cambiamos por press en el suelo con mancuernas.', 'CK-12: al quitar el banco aparece el aviso del fijado');
ok(JSON.stringify((await dayRoutine(0))[1]) === JSON.stringify({ slot: 'empuje_h', ex: 'press_suelo', pinned: false }), 'CK-12: el ítem pasa a press en el suelo sin fijar');
await page.reload(); await page.waitForTimeout(400);
ok(!(await pinnedNotice()), 'CK-12: el aviso no vuelve a aparecer al recargar');
await click('[data-tab="train"]'); await click('[data-tab="home"]');
ok(!(await pinnedNotice()), 'CK-12: ni al volver al inicio');

// 1. Primer uso
await page.goto(URL);
await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('tendon-fuerte'); q.onsuccess = q.onerror = q.onblocked = r; }));
await page.reload();
await page.waitForSelector('#onb[open]');
ok(true, 'la primera vez abre la bienvenida');
await shot('01-bienvenida');
await click('[data-action="onb-next"]');
await click('[data-action="onb-next"]');
ok((await toastText()).includes('peso'), 'pide el peso para estimar cargas');
await page.fill('#onb [data-set="profile.name"]', 'Fede'); await page.dispatchEvent('#onb [data-set="profile.name"]', 'change');
await page.fill('#o-weight', '80'); await page.dispatchEvent('#o-weight', 'change');
await page.fill('#onb [data-set="profile.age"]', '30'); await page.dispatchEvent('#onb [data-set="profile.age"]', 'change');
await page.fill('#onb [data-set="profile.height"]', '178'); await page.dispatchEvent('#onb [data-set="profile.height"]', 'change');
await click('#onb [data-action="rem-day"][data-v="mi"]');
ok((await state()).profile.days === 3, 'los días por semana salen de los días elegidos');
await click('#onb [data-action="rem-day"][data-v="mi"]');
await click('#onb [data-action="rem-day"][data-v="ju"]'); await click('#onb [data-action="rem-day"][data-v="lu"]');
ok((await state()).rem.train.join() === 'lu' && (await toastText()).includes('al menos'), 'no deja la semana sin días');
await click('#onb [data-action="rem-day"][data-v="ju"]');
await click('#onb [data-action="rem-day"][data-v="ju"]'); await click('#onb [data-action="rem-day"][data-v="vi"]');
ok((await state()).rem.train.join() === 'lu,vi', 'elige los días de entreno en el primer uso');
await click('#onb [data-action="rem-day"][data-v="vi"]'); await click('#onb [data-action="rem-day"][data-v="ju"]');
await shot('02-perfil');
await click('[data-action="onb-next"]');
await page.fill('#onb [data-set="equip.kb"]', '12, 20'); await page.dispatchEvent('#onb [data-set="equip.kb"]', 'change');
await page.check('#onb [data-action="eq-rings"]');
await shot('03-equipo');
await click('[data-action="onb-next"]');
await page.check('#onb [data-zone="codo_lat"][data-action="zone-toggle"]');
await page.check('#onb [data-zone="muneca"][data-action="zone-toggle"]');
await click('#onb [data-action="zone-pain"][data-zone="codo_lat"][data-n="5"]');
await shot('04-dolor');
await click('[data-action="onb-next"]');
let s = await state();
ok(s.onboarded && s.profile.weight === '80' && s.equip.kb.join() === '12,20' && s.equip.rings, 'guarda perfil y equipo');
ok(Object.keys(s.zones).join() === 'codo_lat,muneca' && s.zones.codo_lat.pain0 === 5, 'guarda las zonas con dolor');
ok(s.painMode === false, 'el modo dolor queda apagado');
ok(await page.locator('[data-action="pain-mode-on"]').count() === 1, 'sugiere activar el modo dolor, sin activarlo solo');
await shot('05-inicio');
ok(await page.evaluate(() => S.plan.since === today() && planFor(dayIndex(activePlan(S), S.plan.pos)).every((p) => p.missing || p.sets === 2)),
  'usuario nuevo: el plan empieza hoy y el primer entreno lleva 2 series por ejercicio (rampa de entrada)');

// 2. Entreno con el modo dolor apagado: pesos completos
await click('[data-tab="train"]');
ok(await page.locator('#view-train >> text=más liviano').count() === 0, 'sin modo dolor no hay ejercicios más livianos');
ok(await page.locator('#view-train >> text=Remo invertido en aros').count() === 1, 'con aros incluye el remo invertido');
await shot('06-entreno');
ok(await page.locator('#view-train .thumb svg animate').count() > 0, 'las miniaturas del entreno están animadas');

// 3. Modo dolor
await click('[data-tab="home"]');
await click('[data-action="pain-mode-on"]');
ok((await state()).painMode, 'activa el modo dolor');
ok(await page.locator('[data-action="start-rehab"]').count() === 1, 'aparece la rehabilitación del día');
await shot('07-inicio-dolor');
await click('[data-tab="train"]');
ok(await page.locator('#view-train >> text=más liviano por tu codo').count() >= 3 && await page.locator('#view-train >> text=al 60 %').count() === 0, 'remo, peso muerto y curl van "más liviano por tu codo"');
await click('[data-tab="tendons"]');
ok(await page.locator('#view-tendons >> text=Extensión de muñeca isométrica').count() === 1, 'codo lateral → extensión de muñeca isométrica');
await shot('08-tendones');
// Avance de fase: antes del criterio no hay botón destacado; al cumplirlo, pasar de fase es la acción principal
const codoDetail = page.locator('#view-tendons .zone-detail:has([data-zone="codo_lat"])');
ok(await codoDetail.locator('.cta').count() === 0 && (await codoDetail.textContent()).includes('de 10 días en esta fase') && await codoDetail.locator('button.quiet[data-dir="1"]').count() === 1, 'fase sin criterio: muestra el progreso y "Avanzar igual" chico');
const phaseBackup = await page.evaluate(() => { const b = JSON.stringify({ zones: S.zones, sessions: S.sessions }); S.zones.codo_lat.since = addDays(today(), -12); for (let i = 1; i <= 5; i++) S.sessions.push({ id: 'ph' + i, date: addDays(today(), -i), type: 'dolor', items: [], pain: { codo_lat: 2 } }); render(); return b; });
ok((await codoDetail.locator('.cta[data-action="phase"][data-dir="1"]').textContent()).includes('Pasar a fase 2: isotónicos lentos'), 'con el criterio cumplido, "Pasar a fase 2" es el botón principal');
await page.evaluate((b) => { Object.assign(S, JSON.parse(b)); render(); }, phaseBackup);

// 4. Entreno A con calibración
await click('[data-tab="home"]');
// Primer día: aunque hoy no sea día de entreno, el inicio no habla de descanso
const remTrain = await page.evaluate(() => { const r = [...S.rem.train]; S.rem.train = r.filter((d) => d !== weekdayKey(today())); render(); return r; });
const firstMsg = await page.locator('#view-home .today .day-msg').textContent();
ok(firstMsg.includes('Tu primer entreno') && !(await page.locator('#view-home .today').textContent()).includes('descanso') && await page.locator('#view-home .today.on').count() === 1, 'el primer día dice "Tu primer entreno", con acento y sin "descanso"');
ok(!(await page.locator('#view-home .today .plan-line').textContent()).includes('Primer entreno'), 'el primer entreno no se repite en la línea del plan');
const homeLoads = await page.locator('#view-home .board .load').allTextContents();
ok(homeLoads.length >= 3 && homeLoads.every((x) => / kg|sin peso/.test(x)) && await page.locator('#view-home .board .load .calib-tag').count() === homeLoads.length, 'inicio: cada peso lleva "kg" y la etiqueta de calibración debajo, como en Entreno');
await page.evaluate((r) => { S.rem.train = r; render(); }, remTrain);
await click('#view-home [data-action="start-workout"]');
await page.waitForSelector('#wsheet[open]');
ok((await page.locator('#wsheet .warm').textContent()).includes('Isométrico de codo lateral'), 'la entrada en calor incluye el isométrico de la zona sensible');
await click('#wsheet [data-action="warm"][data-i="0"]');
ok(await page.locator('#wsheet .warm-item.on').count() === 1, 'marca un ítem de la entrada en calor');
const first = page.locator('#wsheet .wex').first();
ok(await page.locator('#wsheet .calib-intro').count() === 1 && (await page.locator('#wsheet .calib-intro').textContent()).includes('Hoy calibramos tus pesos'), 'el primer entreno explica la calibración una sola vez, arriba');
ok(await first.locator('.calib-tag').count() === 1 && !(await page.locator('#wsheet').textContent()).includes('Serie de calibración'), 'cada ejercicio a calibrar lleva la etiqueta, sin repetir la explicación');
ok((await first.locator('input[data-w="0.0.w"]').inputValue()) === '12', 'goblet arranca con la pesa rusa de 12');
await first.locator('input[data-w="0.0.reps"]').fill('20');
await first.locator('select[data-w="0.0.rir"]').selectOption('2');
await click('#wsheet [data-action="set-done"][data-i="0"][data-j="0"]');
ok((await toastText()).includes('Calibrado'), 'calcula el peso de trabajo');
ok(!(await page.locator('#rest').isHidden()), 'arranca el descanso');
await shot('09-entreno-sesion');
await click('#rest [data-action="skip-rest"]');
const row = page.locator('#wsheet .wex').nth(2);
ok((await row.locator('.note.pain').textContent()) === 'Más liviano por tu codo y tu muñeca: 6 kg en vez de 10 kg.', 'el remo avisa que va más liviano por el codo y la muñeca, con el peso de siempre');
await row.locator('input[data-w="2.0.reps"]').fill('12');
await row.locator('select[data-w="2.0.rir"]').selectOption('3');
await click('#wsheet [data-action="set-done"][data-i="2"][data-j="0"]');
await click('#wsheet .dlg-head [data-action="finish-workout"]');
await page.waitForSelector('#painsheet[open]');
ok(true, 'al terminar pregunta el dolor de las zonas cuidadas');
await shot('10-dolor-entreno');
await click('#painsheet [data-zone="codo_lat"][data-n="3"]');
await click('#painsheet [data-zone="muneca"][data-n="2"]');
await click('[data-action="save-pain"]');
s = await state();
ok(s.sessions[0].type === 'entreno' && s.sessions[0].pain.codo_lat === 3, 'guarda el entreno con el dolor');
await page.waitForSelector('#sumsheet[open]');
ok((await page.locator('#sumsheet').textContent()).includes('series') && s.sessions[0].sets === 2, 'muestra el resumen del entreno (2 series)');
await shot('18-resumen');
await click('#sumsheet [data-action="close"]');
ok((await page.locator('#view-home .week .dots i.on').count()) === 1, 'Inicio muestra 1 entreno hecho esta semana');
ok((await page.locator('#view-home .today .day-msg').textContent()).includes('Entreno de hoy hecho'), 'después del primer entreno vuelven los mensajes de siempre');
ok(s.lifts.goblet && s.lifts.goblet.w === 12, 'el goblet queda calibrado');
ok(s.plan.pos === 1, 'el próximo entreno es el B (Día B)');

// 4b. Rotación, rango visible y sesiones
// Cada caso inyecta un usuario v1.14 (bootSaved); al final se restaura el usuario del flujo principal.
const errorsBefore4b = errors.length;
const mainUser = await state();
const cards = () => page.locator('#wsheet .wex');
const card = (name) => cards().filter({ hasText: name }).first();
const openDay = async (day, from = 'home') => { await click(`[data-tab="${from}"]`); await click(`#view-${from} [data-action="start-workout"][data-day="${day}"]`); await page.waitForSelector('#wsheet[open]'); };
// Marca la primera serie del primer ejercicio y termina; sin dolor activo se cae directo al resumen.
const finishQuick = async () => {
  await cards().first().locator('input[data-w="0.0.reps"]').fill('10');
  if (await cards().first().locator('select[data-w="0.0.rir"]').count()) await cards().first().locator('select[data-w="0.0.rir"]').selectOption('2');
  await click('#wsheet [data-action="set-done"][data-i="0"][data-j="0"]');
  await click('#wsheet .dlg-head [data-action="finish-workout"]');
  await page.waitForSelector('#sumsheet[open]');
};
const closeSummary = () => click('#sumsheet [data-action="close"]');

// CK-19, CK-21, CK-25 y calibración con el rango: Día A con 3 días en el perfil y plan de 20 días
await bootSaved({ profile: { days: 3 }, sessions: [{ ago: 20 }], equip: { db: { min: 2, max: 24, step: 2 } } });
await openDay(0);
ok(await cards().count() === 6, 'Día A: 6 ejercicios en el entreno');
const setCounts = await cards().evaluateAll((els) => els.map((e) => e.querySelectorAll('.set:not(.head)').length));
ok(setCounts.every((n) => n === 3), `CK-19: con 3 días en el perfil y fuera de la rampa cada ejercicio tiene 3 series (${setCounts.join(',')})`);
ok((await card('Elevaciones laterales').textContent()).includes('× 12–20') && (await card('Sentadilla goblet').textContent()).includes('× 6–12'), 'CK-21: laterales muestran "× 12–20" y la goblet "× 6–12"');
ok(await card('Elevaciones laterales').locator('input[data-w$=".0.reps"]').getAttribute('placeholder') === '≈16' && await card('Sentadilla goblet').locator('input[data-w$=".0.reps"]').getAttribute('placeholder') === '≈9', 'el placeholder de reps sugiere el centro del rango (≈16 y ≈9)');
ok((await page.locator('#wsheet .dlg-head strong').textContent()) === 'Día A', 'el encabezado del entreno es el nombre del día');
// Calibración: 6 kg × 15 reps con RIR 2, rango [12, 20] apunta a 18 reps → 4 kg (sin rango daría 6)
const lat = card('Elevaciones laterales'), latI = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Elevaciones laterales')));
await lat.locator(`input[data-w="${latI}.0.w"]`).fill('6');
await lat.locator(`input[data-w="${latI}.0.reps"]`).fill('15');
await lat.locator(`select[data-w="${latI}.0.rir"]`).selectOption('2');
await click(`#wsheet [data-action="set-done"][data-i="${latI}"][data-j="0"]`);
ok((await state()).lifts.lateral.w === 4, 'la calibración usa el rango: 6 kg × 15 con RIR 2 deja lateral en 4 kg');
const plI = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Plancha')));
await click(`#wsheet [data-action="set-done"][data-i="${plI}"][data-j="0"]`);
await click('#wsheet .dlg-head [data-action="finish-workout"]');
await page.waitForSelector('#sumsheet[open]');
const sumText = await page.locator('#sumsheet').textContent();
ok(sumText.includes('¡Día A hecho!') && sumText.includes('cuando hagas 20 en todas, sube') && sumText.includes('Próximo: Día B'), 'CK-21: el resumen dice "cuando hagas 20 en todas, sube" y "Próximo: Día B"');
const holdsText = sumText.split('Mismo peso la próxima')[1] || '';
ok(holdsText.includes('Elevaciones laterales') && !holdsText.includes('Plancha'), 'el aviso de subida sale en laterales y no en la plancha (por tiempo)');
s = await state();
const sess = s.sessions[0], latItem = sess.items.find((i) => i.ex === 'lateral');
ok(sess.plan === 'fb2' && sess.day === 0 && sess.tpl === 'A' && JSON.stringify(latItem.reps) === '[12,20]', 'CK-25: la sesión guarda plan fb2, day 0, tpl A y reps [12, 20] en laterales');
ok(sess.items.find((i) => i.ex === 'plancha').reps === undefined, 'los ejercicios por tiempo no guardan rango');
await closeSummary();
ok(s.plan.pos === 1, 'CK-14: tras el Día A el próximo es el Día B');

// CK-14: rotación A → B → A, entreno B a mano cuando tocaba A y fechas corridas sin entrenar
await click('[data-tab="home"]');
ok((await homeTitle()).startsWith('Día B'), 'CK-14: el inicio propone el Día B');
await openDay(1); await finishQuick(); await closeSummary();
ok((await state()).plan.pos === 0 && (await homeTitle()).startsWith('Día A'), 'CK-14: hecho el Día B el inicio propone el Día A');
await openDay(1, 'train'); await finishQuick(); await closeSummary();
ok((await state()).plan.pos === 0, 'CK-14: el Día B empezado a mano cuando tocaba el A deja como próximo el Día A');
await page.evaluate(() => { S.sessions.forEach((x) => { x.date = addDays(x.date, -5); }); persist(); });
await page.reload(); await page.waitForTimeout(400);
ok((await homeTitle()).startsWith('Día A'), 'CK-14: con las fechas corridas varios días sigue proponiendo el día que tocaba');

// CK-25: una sesión vieja con solo tpl se lee en el historial
// La sesión vieja lleva una letra que ninguna sesión nueva usa (fb2 solo tiene A y B), así que la fila solo puede salir de leer tpl.
await page.evaluate(() => { S.sessions.unshift({ id: 'old-tpl', date: '2025-03-07', type: 'entreno', tpl: 'C', items: [] }); persist(); });
await page.reload(); await page.waitForTimeout(400);
await click('[data-tab="history"]');
ok(await page.locator('#view-history .sess', { hasText: 'Entreno C' }).count() === 1, 'CK-25: el historial muestra la sesión vieja con solo tpl (sin plan ni day)');

// CK-26: sin el equipo de un hueco el ítem dice "Falta equipo" y el entreno empieza con los demás
await bootSaved({ equip: { db: null, kb: [12, 20], rings: true } });
await click('[data-tab="train"]');
ok((await page.locator('#view-train').textContent()).includes('Falta equipo'), 'CK-26: el entreno muestra "Falta equipo" en el ítem sin ejercicio posible');
await openDay(0, 'train');
ok(await cards().count() === 5 && !(await page.locator('#wsheet').textContent()).includes('Elevaciones laterales'), 'CK-26: el entreno empieza con 5 ítems, sin el faltante');
await click('#wsheet [data-action="cancel-workout"]');
// Hoy no puedo: llueve y no hay aros → el remo en aros del Día B cambia solo en esta sesión
await bootSaved({ equip: { db: { min: 2, max: 24, step: 2 }, rings: true } });
const routineB = dayIds(await state(), 1);
await openDay(1, 'train');
ok(routineB.includes('remo_aros') && (await page.locator('#wsheet').textContent()).includes('Remo invertido en aros'), 'el Día B con aros trae remo en aros');
await click(`#wsheet [data-action="swap-today"][data-i="${await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Remo invertido en aros')))}"]`);
await page.waitForSelector('#swapsheet[open]');
ok((await page.locator('#swapsheet').textContent()).includes('Hoy no puedo usar aros'), 'la hoja ofrece "Hoy no puedo usar aros"');
await click('#swapsheet [data-action="swap-why"][data-off="rings"]');
const wText = await page.locator('#wsheet').textContent();
ok(!wText.includes('Remo invertido en aros') && wText.includes('Solo por hoy: en vez de remo invertido en aros'), `el remo en aros se cambia solo por hoy (${await toastText()})`);
ok(await page.evaluate(() => W.items.every((it) => implFor(it.ex, { ...S.equip, rings: false }))), 'ningún ejercicio de la sesión usa aros');
const otherI = await cards().evaluateAll((els) => els.findIndex((e) => !e.textContent.includes('Solo por hoy')));
const otherName = await page.evaluate((i) => W.items[i].ex.name, otherI);
await click(`#wsheet [data-action="swap-today"][data-i="${otherI}"]`);
await click('#swapsheet [data-action="swap-why"][data-off=""]');
ok(await page.evaluate((n) => !W.items.some((it) => it.ex.name === n), otherName), `otro motivo: ${otherName} se cambia por otro del mismo hueco o se saltea (${await toastText()})`);
await click(`#wsheet [data-action="swap-today"][data-i="0"]`);
await click('#swapsheet [data-action="swap-why"][data-off="skip"]');
const firstFrom = await page.evaluate(() => W.items[0].from ?? null);
ok(await page.evaluate(() => W.items.some((it) => it.from === 'remo_aros')), 'saltear otro ejercicio no deshace el cambio de los aros');
await finishQuick();
s = await state();
ok((s.sessions[0].items[0].from ?? null) === firstFrom, 'la sesión guarda de qué ejercicio se cambió');
ok(JSON.stringify(dayIds(s, 1)) === JSON.stringify(routineB) && s.equip.rings === true, 'la rutina y el equipo guardados no cambian');
await closeSummary();
ok(errors.length === errorsBefore4b, `rotación, rango y sesiones sin errores de JavaScript${errors.length > errorsBefore4b ? ': ' + errors.slice(errorsBefore4b).join(' | ') : ''}`);

// progress() recibe el rango del ejercicio: laterales (12–20) suben con 3 × 20 y se quedan con 3 × 12
const finishLaterales = async (reps) => {
  await openDay(0);
  const i = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Elevaciones laterales')));
  for (let j = 0; j < 3; j++) {
    await card('Elevaciones laterales').locator(`input[data-w="${i}.${j}.reps"]`).fill(String(reps));
    await card('Elevaciones laterales').locator(`select[data-w="${i}.${j}.rir"]`).selectOption('2');
    await click(`#wsheet [data-action="set-done"][data-i="${i}"][data-j="${j}"]`);
  }
  await click('#wsheet .dlg-head [data-action="finish-workout"]');
  await page.waitForSelector('#sumsheet[open]');
  const lift = (await state()).lifts.lateral.w;
  await closeSummary();
  return lift;
};
await bootSaved({ sessions: [{ ago: 20 }], lifts: { lateral: { w: 4, e1rm: 8 } }, equip: { db: { min: 2, max: 24, step: 2 } } });
ok(await finishLaterales(20) === 6, 'progress con rango: laterales 3 × 20 (tope de 12–20) suben un salto, de 4 a 6 kg');
await bootSaved({ sessions: [{ ago: 20 }], lifts: { lateral: { w: 4, e1rm: 8 } }, equip: { db: { min: 2, max: 24, step: 2 } } });
ok(await finishLaterales(12) === 4, 'progress con rango: laterales 3 × 12 (mínimo, no el tope) no cambian de peso');

// Modo dolor con la zona en brote: el remo pasa a su variante (sin aros, el isométrico del curl)
await bootSaved({ extra: { painMode: true, zones: { codo_lat: { side: 'der', pain0: 5, phase: 1, since: '2026-10-01', load: 2, secs: 30 } } } });
await page.evaluate(() => { S.checks.push({ id: 'ck', zone: 'codo_lat', val: 'peor', date: today() }); render(); });
await click('[data-tab="train"]');
const altName = await page.evaluate(() => EXERCISES.curl_iso.name);
const altRow = page.locator('#view-train .ex').filter({ hasText: 'variante por tu' });
ok(await altRow.count() >= 1 && (await altRow.first().textContent()).includes(altName), `modo dolor en brote: el remo muestra "variante por tu …" con ${altName}`);

// Se restaura el usuario del flujo principal
await wipeDb(); await putData(mainUser); await page.reload(); await page.waitForTimeout(400);
await click('[data-tab="home"]');
s = await state();

// 5. Rehabilitación
await click('[data-action="start-rehab"]');
await page.waitForSelector('#rsheet[open]');
await shot('11-rehab');
for (let i = 0; i < 20 && await page.locator('#rsheet [data-action="rehab-go"], #rsheet [data-action="rehab-skip"]').count(); i++) {
  await click('#rsheet [data-action="rehab-go"], #rsheet [data-action="rehab-skip"]');
}
await click('[data-action="finish-rehab"]');
await click('#painsheet [data-zone="codo_lat"][data-n="6"]');
await click('#painsheet [data-zone="muneca"][data-n="2"]');
await click('[data-action="save-pain"]');
s = await state();
ok(s.sessions[0].type === 'rehab' && s.sessions[0].items.length === 2 && s.sessions[0].items.every((i) => i.sets.length === 3), 'guarda 2 isométricos de 3 series');
ok(s.zones.codo_lat.load === 2 && s.zones.codo_lat.secs === 35, 'dolor 6 → baja la carga (en el mínimo, baja el tiempo)');
ok((await toastText()).includes('bajamos'), 'avisa que bajó la carga');

// 6. Al día siguiente: ¿cómo amaneció?
await page.evaluate(() => { const y = addDays(today(), -1); S.sessions.forEach((s) => (s.date = y)); Object.values(S.zones).forEach((z) => z.adjustedOn && (z.adjustedOn = y)); render(); });
ok(await page.locator('[data-action="check"][data-zone="muneca"]').count() === 3, 'pregunta cómo amaneció cada zona');
await shot('12-amanecio');
await click('[data-action="check"][data-zone="muneca"][data-val="mejor"]');
s = await state();
ok(s.zones.muneca.load === 4, 'muñeca con dolor 2 y amaneció mejor → sube a 4 kg');
await click('[data-action="check"][data-zone="codo_lat"][data-val="igual"]');
ok((await state()).zones.codo_lat.secs === 35, 'codo ya ajustado ayer → no vuelve a bajar');
ok(await page.locator('[data-action="check"]').count() === 0, 'no vuelve a preguntar');

// 6b. Anotar dolor en cualquier momento
await click('[data-tab="home"]');
await click('[data-action="quick-pain"]');
await click('#painsheet [data-zone="codo_lat"][data-n="3"]');
await click('#painsheet [data-zone="muneca"][data-n="1"]');
await click('[data-action="save-pain"]');
ok((await state()).sessions[0].type === 'dolor' && (await state()).sessions[0].pain.muneca === 1, 'anota el dolor sin hacer una sesión');
await page.evaluate(() => { S.sessions = S.sessions.filter((x) => x.type !== 'dolor'); persist(); render(); });

// 7. Ejercicio propio del fisio (y elegir otra opción de rehabilitación)
await click('[data-tab="tendons"]');
await page.evaluate(() => { S.zones.codo_lat.phase = 2; render(); });
await click('#view-tendons [data-action="rehab-choice"][data-zone="codo_lat"][data-ex="tyler_toalla"]');
ok((await state()).zones.codo_lat.choice[2] === 'tyler_toalla', 'elige Tyler twist con toalla para la fase 2 del codo');
ok(await page.locator('#view-tendons >> text=Tyler twist con toalla').count() >= 1, 'la tarjeta muestra la opción elegida');
await shot('20-opciones-rehab');
await page.evaluate(() => { S.zones.codo_lat.phase = 1; render(); });
await click('[data-action="custom-edit"]');
await page.fill('#c-name', 'Tyler twist con toalla'); await page.selectOption('#c-zone', 'codo_lat');
await click('[data-action="custom-save"]');
ok((await state()).custom[0].name === 'Tyler twist con toalla', 'agrega un ejercicio del fisio');

// 8. Historial (con un registro de hace 3 días para que haya línea)
await page.evaluate(() => { S.sessions.push({ id: 'old', date: addDays(today(), -3), type: 'rehab', slot: 'noche', items: [], pain: { codo_lat: 5 } }); persist(); });
await click('[data-tab="history"]');
ok(await page.locator('#view-history .chart svg').count() >= 1, 'muestra el gráfico de dolor');
await page.locator('#view-history .hit').first().click();
ok(!(await page.locator('#tip').isHidden()), 'tocar un punto muestra el valor');
await shot('13-historial');

// 8b. Equipo propio y rutina editable
await click('[data-tab="settings"]');
await page.check('#view-settings [data-action="eq-flag"][data-k="bench"]');
ok((await state()).equip.bench === true, 'marca que tiene banco');
await click('#view-settings [data-action="mach-edit"]');
await page.fill('#m-name', 'Polea'); await page.fill('#m-min', '5'); await page.fill('#m-max', '50'); await page.fill('#m-step', '2.5');
await click('[data-action="mach-save"]');
s = await state();
ok(s.equip.machines.length === 1 && s.equip.machines[0].step === 2.5, 'agrega una máquina con su rango de peso');
await click('[data-tab="train"]');
await click('[data-action="edit-routine"]');
await click('[data-action="edit-day"][data-day="0"]');
await click('#view-train [data-action="routine-pick"][data-day="0"][data-i="1"]');
await page.waitForSelector('#pickersheet[open]');
ok(!(await page.locator('#pickersheet [data-ex="press_banco"]').isDisabled()), 'con banco, el press en banco se puede elegir');
ok(!(await page.locator('#pickersheet [data-ex="dominadas"]').isDisabled()), 'con aros, las dominadas se pueden hacer en aros');
await shot('15-selector');
await click('#pickersheet [data-ex="press_banco"]');
ok(await page.evaluate(() => S.routine.fb2[0][1].ex === 'press_banco' && S.routine.fb2[0][1].pinned), 'cambia el press en el suelo por press en banco');
await click('[data-action="edit-day"][data-day="1"]');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await click('#pickersheet [data-action="exform"]');
await page.fill('#x-name', 'Jalón en polea'); await page.selectOption('#x-impl', 'm:' + s.equip.machines[0].id);
await click('#exformsheet [data-action="xf-tag"][data-v="codo_lat"]');
await click('[data-action="exform-save"]');
s = await state();
ok(s.exlib.length === 1 && s.exlib[0].impl.startsWith('m:') && s.routine.fb2[1].at(-1).ex === s.exlib[0].id && s.routine.fb2[1].at(-1).slot === null && s.routine.fb2[1].at(-1).pinned, 'crea un ejercicio propio con la máquina y lo suma al día B');
await click('#view-train [data-action="routine-move"][data-day="1"][data-i="6"][data-d="-1"]');
ok((await state()).routine.fb2[1][5].ex === s.exlib[0].id, 'reordena la rutina');
await shot('16-editar-rutina');
await click('[data-action="edit-routine"]');
const jalon = page.locator('#view-train .ex', { hasText: 'Jalón en polea' });
ok((await jalon.locator('.num').textContent()).trim() === '5', 'arranca en el mínimo de la máquina (5 kg) para calibrar');

// 8b2. Mancuernas de discos
await click('[data-tab="settings"]');
await page.check('#view-settings [data-action="eq-plates"]');
ok((await state()).equip.db.plates.on === true, 'activa mancuernas de discos');
ok((await page.locator('#view-settings').textContent()).includes('Pesos posibles'), 'muestra los pesos posibles');
await click('[data-tab="train"]');
await click('#view-train [data-action="start-workout"][data-day="0"]');
ok(await page.locator('#wsheet .plates').count() > 0, 'en la sesión muestra los discos por lado');
await shot('19-discos');
await click('#wsheet [data-action="cancel-workout"]');

// 8b3. Tema claro
await click('[data-tab="settings"]');
await click('#view-settings [data-action="theme"][data-v="light"]');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'cambia al tema claro');
ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(242, 243, 245)', 'el fondo pasa a claro');
await click('[data-tab="home"]'); await shot('21-claro-inicio');
await click('[data-tab="train"]'); await shot('22-claro-entreno');
await click('[data-tab="settings"]');
await click('#view-settings [data-action="theme"][data-v="dark"]');

// 8c. Preferencias de sesión y novedades
await click('[data-tab="settings"]');
await click('#view-settings [data-action="pref"][data-k="rest"][data-v="120"]');
ok((await state()).prefs.rest === 120, 'cambia el descanso entre series a 2 min');
await click('#view-settings [data-action="news"]');
await page.waitForSelector('#newssheet[open] h2');
ok((await page.locator('#newssheet').textContent()).includes('1.3.0'), 'Novedades muestra el changelog');
await shot('17-novedades');
await click('#newssheet [data-action="close"]');

// 8d. Informe para el fisio
await click('[data-tab="history"]');
dl = page.waitForEvent('download'); await click('[data-action="report"]');
const rep = fs.readFileSync(await (await dl).path(), 'utf8');
if (SHOTS) fs.writeFileSync(`${SHOTS}/informe.html`, rep);
ok(rep.includes('Informe') && rep.includes('Codo lateral') && rep.includes('<svg'), 'el informe trae zonas y gráfico de dolor');

// 8d2. Estancamiento y descarga
await page.evaluate(() => {
  S.lifts.rdl = { w: 10, e1rm: 14 };
  for (let i = 0; i < 3; i++) S.sessions.push({ id: 'st' + i, date: addDays(today(), -20 - i), type: 'entreno', tpl: 'A', items: [{ ex: 'rdl', sets: [{ w: 10, reps: 9 }, { w: 10, reps: 9 }] }, { ex: 'lateral', sets: [{ w: 4, reps: 9 }] }] });
  S.lifts.lateral = { w: 4, e1rm: 5 };
  S.painMode = false; persist(); render();
});
await click('[data-tab="home"]');
ok(await page.locator('[data-action="deload"]').count() === 1, 'sugiere semana de descarga con 2 ejercicios estancados');
const rdlPlan = () => page.evaluate(() => { const it = activePlan(S).days.flatMap((_, d) => planFor(d)).find((x) => x.ex.id === 'rdl'); return { sets: it.sets, w: it.w, steps: weightSteps(S.equip, it.impl) }; });
const rdlNormal = await rdlPlan();
await click('[data-action="deload"]');
const rdlDeload = await rdlPlan();
ok(rdlDeload.sets === Math.max(1, rdlNormal.sets - 1) && rdlDeload.w === await page.evaluate(([steps, w]) => roundDown(steps, w * 0.9), [rdlNormal.steps, rdlNormal.w]) && rdlDeload.w < rdlNormal.w, 'la descarga baja una serie y deja el peso al 90 %');
await click('[data-tab="train"]');
ok((await page.locator('#view-train').textContent()).includes('Semana de descarga'), 'el entreno avisa la semana de descarga');
await click('#view-train [data-action="deload-off"]');
const rdlRow = page.locator('#view-train .ex', { hasText: 'Peso muerto rumano' }).first();
ok(await rdlRow.locator('[data-action="unstall"]').count() === 1, 'marca el peso muerto como estancado');
await rdlRow.locator('[data-action="unstall"]').click(); await page.waitForTimeout(100);
ok((await state()).lifts.rdl.w === await page.evaluate(() => roundDown(weightSteps(S.equip, 'db'), 9)), 'bajar 10 %: de 10 a 9 kg redondeado a lo que se puede armar');
await page.evaluate(() => { S.sessions = S.sessions.filter((x) => !x.id.startsWith('st')); S.painMode = true; persist(); render(); });

// 8e. Eliminar sesión y deshacer
await click('[data-tab="history"]');
const before = (await state()).sessions.length;
await page.locator('#view-history details.sess-d').first().evaluate((d) => (d.open = true));
await click('#view-history [data-action="del-session"]');
ok((await state()).sessions.length === before - 1, 'elimina una sesión sin preguntar');
await click('#toast [data-action="undo"]');
ok((await state()).sessions.length === before, 'Deshacer la recupera');

// 9. Calendario y copia
await click('[data-tab="settings"]');
await shot('14-ajustes');
dl = page.waitForEvent('download'); await click('[data-action="ics"]');
const ics = fs.readFileSync(await (await dl).path(), 'utf8');
ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('FREQ=DAILY') && ics.includes('BYDAY=MO,TH'), 'el .ics trae isométricos diarios y entreno lunes y jueves');
dl = page.waitForEvent('download'); await click('[data-action="export"]');
const backupPath = await (await dl).path();
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
ok(backup.app === 'tendon-fuerte' && backup.data.sessions.length === 3, 'la copia trae las sesiones');
await page.evaluate(() => { S.sessions = []; persist(); });
await page.setInputFiles('#import-file', { name: 'copia.json', mimeType: 'application/json', buffer: fs.readFileSync(backupPath) });
await page.waitForTimeout(300);
ok((await state()).sessions.length === 3, 'restaurar la copia recupera las sesiones');

// 10. Datos persistentes y sin conexión
await page.reload(); await page.waitForTimeout(300);
ok((await state()).sessions.length === 3 && !(await page.locator('#onb').getAttribute('open')), 'los datos sobreviven a recargar');
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 5000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload(); await page.waitForTimeout(300);
ok(await page.locator('#view-home h1').count() === 1, 'abre sin conexión');
await ctx.setOffline(false);

// 11. Migración: datos guardados por la versión 1.0 (sin rutina, preferencias ni equipo extra)
await putData({ v: 1, onboarded: true, painMode: true, profile: { name: 'Viejo', sex: 'h', weight: '75', height: '', age: '40', exp: 'novato', days: 2 },
    equip: { db: { min: 2, max: 24, step: 2 }, kb: [12], rings: false }, zones: { codo_lat: { side: 'der', pain0: 5, phase: 1, since: '2026-10-01', load: 2, secs: 45 } },
    lifts: { goblet: { w: 12, e1rm: 18 } }, sessions: [{ id: 'x', date: '2026-10-10', type: 'entreno', tpl: 'A', items: [{ ex: 'goblet', sets: [{ w: 12, reps: 10 }] }] }], checks: [], custom: [],
    plan: { budget: 36, week: '2026-10-05', next: 'B' }, rem: { am: '08:00', pm: '20:00', train: ['lu'], trainAt: '19:00' } });
await page.reload(); await page.waitForTimeout(400);
s = await state();
ok(s.profile.name === 'Viejo' && s.routine.fb2.length === 2 && s.routine.fb2.every((d) => d.length === 6) && s.plan.pos === 1 && !('next' in s.plan) && s.prefs.rest === 90 && Array.isArray(s.equip.machines), 'migra datos de la v1.0 con los valores nuevos por defecto');
ok(await page.locator('#view-home .card').count() > 0 && await page.locator('#view-home >> text=Novedades de la versión').count() === 1, 'quien venía de antes ve la tarjeta de novedades');
await click('[data-tab="train"]');
ok(await page.locator('#view-train .ex').count() >= 12, 'la rutina se arma con los datos viejos');

// Borrar todos los datos deja una rutina válida: tocar Banco en el alta no rompe el aviso del banco
const errorsBeforeReset = errors.length;
await click('[data-tab="settings"]');
await click('[data-action="reset"]');
await page.waitForSelector('#onb[open]');
await click('[data-action="onb-next"]');
await page.fill('#o-weight', '70');
await click('[data-action="onb-next"]');
await page.locator('#onb [data-action="eq-flag"][data-k="bench"]').check({ force: true });
await page.waitForTimeout(80);
ok(errors.length === errorsBeforeReset, `reset → alta → Banco sin errores de JavaScript${errors.length > errorsBeforeReset ? ': ' + errors.slice(errorsBeforeReset).join(' | ') : ''}`);
errors.length = errorsBeforeReset;
ok(errors.length === 0, `sin errores de JavaScript${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} fallaron` : '\nTodo OK');
process.exit(failures ? 1 : 0);
