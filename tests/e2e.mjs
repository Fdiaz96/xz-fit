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
let nativeDialogs = 0;   // la app usa sus propias preguntas (#asksheet): un confirm() nativo es un error
page.on('dialog', (d) => { nativeDialogs++; d.accept(); });
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const overlaps = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const toastText = () => page.locator('#toast span').textContent();
// Mensaje debajo de un campo (error, aviso o "Guardado ✓").
const fmsg = (sel) => page.evaluate((sel) => document.querySelector(sel)?.closest('label.field')?.querySelector('.fmsg')?.textContent || '', sel);
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(S)));
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(80); };
// Responde la pregunta propia de la app con la acción (el botón de abajo).
const askYes = () => click('#asksheet [data-action="ask-go"]');
// Terminar el entreno; con series pendientes confirma "Terminar igual".
const finish = async () => { await click('#wsheet .dlg-head [data-action="finish-workout"]'); if (await page.locator('#finsheet[open]').count()) await click('#finsheet [data-action="finish-anyway"]'); };

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
// Título del día sin la duración estimada ("Día A · 6 ejercicios · ~45 min" → "Día A · 6 ejercicios").
const homeTitle = async () => (await page.locator('#view-home .card:has([data-action="start-workout"]) h3').textContent()).replace(/ · ~\d+ min/, '');
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
ok(await page.locator('#asksheet[open]').count() === 1 && (await page.locator('#asksheet strong').textContent()) === '¿Quitar hombro?' && await page.isChecked('#view-tendons [data-action="zone-toggle"][data-zone="hombro"]'), 'quitar una zona pregunta con un diálogo propio y el tilde queda puesto hasta responder');
await click('#asksheet .cta');
ok(!(await page.locator('#asksheet[open]').count()) && 'hombro' in (await state()).zones && await page.isChecked('#view-tendons [data-action="zone-toggle"][data-zone="hombro"]'), '"Mantener la zona" no quita nada');
await click('#view-tendons [data-action="zone-toggle"][data-zone="hombro"]');
await askYes();
ok(await painTab.isHidden() && await page.locator('#view-home').isVisible(), 'al desmarcar la última zona la pestaña se va y volvés a Hoy');
// Historial sin entrenos: el botón del día que toca y el gráfico de peso de muestra, sin la sección de dolor
await click('[data-tab="history"]');
ok(await page.locator('#view-history .empty-hist [data-action="start-workout"]').count() === 1 && await page.locator('#view-history h2').allTextContents().then((t) => t.join() === 'Peso por ejercicio'), 'historial nuevo: botón para empezar y solo el gráfico de peso, sin dolor');
ok(await page.locator('#view-history .chart.is-empty .ghost').count() === 1, 'el gráfico de peso aparece vacío con la línea de muestra');
await click('#view-history [data-action="hist-help"][data-k="ex"]');
ok(await page.locator('#view-history .help-note').isVisible(), 'el ? explica el gráfico de peso');
await click('#view-history [data-action="hist-help"][data-k="ex"]');
await click('#view-history .empty-hist [data-action="start-workout"]');
ok(await page.locator('#wsheet[open]').count() === 1, 'el botón del historial arranca el entreno');
await click('#wsheet [data-action="cancel-workout"]');
ok(await page.locator('#asksheet[open]').count() === 1 && (await page.locator('#asksheet .cta').textContent()) === 'Seguir entrenando' && await page.locator('#asksheet button.sec.danger').textContent() === 'Salir sin guardar', 'salir del entreno pregunta con un diálogo propio: "Seguir entrenando" o "Salir sin guardar"');
await shot('20-salir-sin-guardar');
await click('#asksheet .cta');
ok(await page.locator('#wsheet[open]').count() === 1, '"Seguir entrenando" deja el entreno abierto');
await click('#wsheet [data-action="cancel-workout"]');
await askYes();
ok(!(await page.locator('#wsheet[open]').count()), '"Salir sin guardar" cierra el entreno');
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
await page.waitForTimeout(150); await askYes();
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
ok((await page.locator('#view-home .week-meta').textContent()).includes('0 de 2 entrenos'), 'con 3 días en el perfil y fb2, la tarjeta semanal tiene 2 entrenos de objetivo');
ok(/ · ~\d+ min$/.test((await page.locator('#view-home .today h3').textContent()).trim()), 'el título del día suma la duración estimada ("~45 min")');
ok(await page.locator('#view-home .week-strip.home button').count() === 7 && await page.locator('#view-home .week-strip.home button.now').count() === 1, 'la tira de la semana tiene Lu–Do con hoy marcado');
ok(await page.locator('#view-home .board .chev').count() === await page.locator('#view-home .board li').count(), 'cada ejercicio de Hoy lleva un › de que se toca');
ok(await page.evaluate(() => stripLegend(PLANS.tp4).includes('<b>TA</b> Torso A') && stripLegend(PLANS.fb2) === ''), 'las siglas de la tira llevan leyenda ("TA Torso A"), salvo los días "Día A/B"');
ok(await page.locator('#view-home [data-action="start-workout"][data-day="0"]').count() === 1, 'el botón de empezar lleva el día del plan');
await bootSaved({ equip: { db: null, kb: [12, 20], rings: true } });
ok((await homeTitle()).trim() === 'Día A · 6 ejercicios', 'sin mancuernas el hueco lateral pasa a peso corporal: siguen 6');
ok(dayIds(await state(), 0).includes('elev_y_piso'), 'sin mancuernas, las elevaciones laterales pasan a elevaciones en Y boca abajo');
// Un ejercicio propio con una máquina que ya no está no tiene hueco: ese sí queda sin ejercicio posible.
const lostMach = { id: 'c_polea', name: 'Mi polea', kind: 'peso', impl: 'm:zz', cat: 'hombro', tag: [], start: 0, note: '' };
const lostA = ['goblet', 'press_suelo', 'remo_silla', 'rdl', 'c_polea', 'plancha'];   // TEMPLATES.A con la polea en lugar de las laterales
await bootSaved({ equip: { db: null, kb: [12, 20], rings: true }, exlib: [lostMach], templates: { A: lostA } });
ok((await homeTitle()).trim() === 'Día A · 5 ejercicios', 'un propio con una máquina que no está no tiene ejercicio posible: N baja a 5');
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
ok(!overlaps(await page.locator('#toast').boundingBox(), await page.locator('#view-train .add-ex').boundingBox()), 'el aviso "Ejercicio agregado" no tapa "+ Agregar ejercicio"');
ok(dayB.length === 7 && JSON.stringify(dayB.at(-1)) === JSON.stringify({ slot: await page.evaluate(() => slotOf('pullover')), ex: 'pullover', pinned: true }) && dayB.at(-1).slot !== null, 'agregar un ejercicio de la biblioteca: { slot: slotOf(id), ex, pinned: true }');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
const pickText = await page.locator('#pickersheet').innerText();
ok(!pickText.includes('Exige') && !pickText.includes('No carga tendones'), 'sin modo dolor el selector no muestra "Exige…"');
await click('#pickersheet [data-action="exform"]:not([data-id])');
await page.fill('#x-name', 'Remo en polea propio');
await click('#exformsheet [data-action="xf-mach"]');
await page.waitForSelector('#machsheet[open]');
await page.fill('#m-name', 'Polea alta');
await click('#machsheet [data-action="mach-save"]');
ok(await page.evaluate(() => $('exformsheet').open && !$('machsheet').open && $('x-name').value === 'Remo en polea propio' && $('x-impl').selectedOptions[0].text === 'Polea alta'), '"+ Agregar máquina" desde Nuevo ejercicio vuelve al formulario con la máquina elegida y sin perder el nombre');
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
await click('#toast [data-action="undo"]');
ok((await dayRoutine(1)).length === 8 && (await dayRoutine(1))[6].ex === customId, 'Quitar se puede deshacer desde el aviso');
await click('#view-train [data-action="routine-del"][data-day="1"][data-i="6"]');
await page.evaluate(() => routineSet(1, dayItems(1).slice(0, 1)));
await click('#view-train [data-action="routine-del"][data-day="1"][data-i="0"]');
ok((await dayRoutine(1)).length === 1 && (await toastText()).includes('Dejá al menos un ejercicio.'), 'no deja quitar el último ejercicio de un día');

// CK-23: "Volver al plan original" re-resuelve los huecos sin fijados y no toca Mis ejercicios
const exlibBefore = await page.evaluate(() => JSON.stringify(S.exlib));
ok(JSON.parse(exlibBefore).some((c) => c.id === customId), 'antes de volver al plan original el ejercicio propio está en Mis ejercicios');
ok((await page.locator('#view-train .note.acc').last().innerText()).includes('Las series y las reps las ajusta la app'), 'Editar rutina explica que series y reps las ajusta la app');
const routineBeforeReset = await page.evaluate(() => JSON.stringify(S.routine.fb2));
await click('[data-action="routine-reset"]');
await page.waitForSelector('#resetsheet[open]');
const resetText = await page.locator('#resetsheet').innerText();
ok(/los 2 días/.test(resetText) && resetText.includes('Mis ejercicios') && /mantener mis cambios/i.test(resetText), `"Volver al plan original" abre un diálogo propio que dice que afecta todos los días (${resetText.replace(/\s+/g, ' ').slice(0, 120)})`);
await click('#resetsheet [data-action="close"].cta');
ok(await page.evaluate(() => JSON.stringify(S.routine.fb2)) === routineBeforeReset, '"Mantener mis cambios" no toca la rutina');
await click('[data-action="routine-reset"]');
await click('#resetsheet [data-action="reset-routine"]');
ok((await toastText()).includes('Volviste al plan original'), 'al volver al plan original avisa con Deshacer');
await click('#toast [data-action="undo"]');
ok(await page.evaluate(() => JSON.stringify(S.routine.fb2)) === routineBeforeReset, 'volver al plan original se puede deshacer');
await click('[data-action="routine-reset"]');
await click('#resetsheet [data-action="reset-routine"]');
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
await click('#exformsheet [data-action="exform-del"]'); await askYes();
ok((await state()).exlib.length === 0 && !(await state()).routine.fb2.flat().some((it) => it.ex === customId), 'eliminar el ejercicio propio lo quita de todos los días de la rutina');
await click('#pickersheet [data-action="close"]');
ok(errors.length === errorsBeforeTrain, `vista Entreno y rutina sin errores de JavaScript${errors.length > errorsBeforeTrain ? ': ' + errors.slice(errorsBeforeTrain).join(' | ') : ''}`);

// 8b1. Editor por día y aviso de fijado
await bootSaved({ equip: { bench: true }, exlib: [myEx], templates: { B: ['swing', 'zancada', 'remo_silla', 'c_mio'] } });
await trainTab(); await click('[data-action="edit-routine"]');
ok(JSON.stringify(await page.locator('#view-train .chips .chip').allTextContents()) === JSON.stringify(['Día A', 'Día B']), 'CK-22: Editar rutina muestra las pestañas "Día A" y "Día B"');
await click('#view-train [data-action="routine-pick"][data-day="0"][data-i="1"]');
await page.waitForSelector('#pickersheet[open]');
ok((await page.locator('#pickersheet h2').first().textContent()) === 'Mismo movimiento: empuje horizontal', 'CK-22: el selector abre con el hueco "Mismo movimiento: empuje horizontal"');
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
// Selector: lo que ya está en el día sale marcado y no se puede agregar de nuevo; el buscador filtra por nombre
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
await page.waitForSelector('#pickersheet[open]');
const dupB = page.locator('#pickersheet [data-ex="zancada"]');
ok(await dupB.isDisabled() && (await dupB.textContent()).includes('Ya está en este día'), 'el selector marca "Ya está en este día" y no deja agregar un duplicado');
await page.fill('#pick-q', 'ZANCADA');
const visIds = await page.evaluate(() => [...document.querySelectorAll('#pickersheet button.pick')].filter((b) => b.offsetParent).map((b) => getEx(b.dataset.ex).name.toLowerCase()));
ok(visIds.length > 0 && visIds.every((n) => n.includes('zancada')), 'el buscador deja solo los ejercicios que coinciden (sin importar mayúsculas)');
ok(await page.evaluate(() => { const hs = [...document.querySelectorAll('#pickersheet .dlg > h2')], vis = (h) => { for (let n = h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) if (n.offsetParent && n.querySelector?.('button.pick, .thumb') || n.matches('button.pick') && n.offsetParent) return true; return false; };
  return hs.some((h) => !h.offsetParent) && hs.filter((h) => h.offsetParent).every((h) => h.textContent === 'Mis ejercicios' || vis(h)); }), 'el buscador oculta los grupos sin resultados');
await page.fill('#pick-q', 'xyzw');
ok(await page.locator('#pickersheet .pick-none').isVisible(), 'sin resultados avisa que no hay ejercicios con ese nombre');
await page.fill('#pick-q', '');
await page.locator('#pickersheet .dlg').evaluate((d) => { d.scrollTop = 99999; });
const head = await page.locator('#pickersheet .dlg-head').evaluate((h) => ({ top: h.getBoundingClientRect().top - h.closest('dialog').getBoundingClientRect().top, bg: getComputedStyle(h).backgroundColor }));
ok(head.top <= 1 && head.bg !== 'rgba(0, 0, 0, 0)', `el encabezado y el buscador quedan fijos arriba y con fondo sólido al scrollear (${JSON.stringify(head)})`);
await click('#pickersheet [data-action="close"]');
await click('#view-train [data-action="routine-pick"][data-day="1"]:not([data-i])');
ok(await page.inputValue('#pick-q') === '', 'al volver a abrir el selector la búsqueda arranca vacía');
await click('#pickersheet [data-action="close"]');
await click('[data-action="edit-routine"]');
ok(JSON.stringify(await page.locator('#view-train h2').allTextContents()) === JSON.stringify(['Día A · toca hoy', 'Día B']), 'al salir de editar vuelven los dos días apilados');

// Elegir plan desde Editar rutina: los ejercicios se arman solos, cambian los días y la rutina anterior queda guardada
await trainTab(); await click('[data-action="edit-routine"]');
ok(await page.locator('#view-train .plan-card h3').textContent() === 'Full body 2 días', 'Editar rutina muestra el plan actual');
await shot('plan-editor');
await click('#view-train [data-action="plan-open"]');
await page.waitForSelector('#plansheet[open]');
ok(JSON.stringify(await page.locator('#plansheet h2').allTextContents()) === JSON.stringify(['Cuerpo completo', 'Por grupos musculares', 'A tu medida']), 'la hoja agrupa los planes en cuerpo completo, por grupos y a tu medida');
ok(await page.locator('#plansheet .plan-foot .cta').isDisabled(), 'con el plan actual elegido no hay nada que confirmar');
await page.locator('#plansheet [data-action="plan-sel"][value="fb3"]').check({ force: true }); await page.waitForTimeout(80);
await shot('plan-sheet');
await click('#plansheet [data-action="plan-use"]');
ps = await state();
ok(ps.plan.id === 'fb3' && ps.plan.pos === 0 && ps.routine.fb3.length === 3 && JSON.stringify(ps.rem.train) === '["lu","mi","vi"]' && ps.profile.days === 3, 'Full body 3 días: arma los 3 días y propone lunes, miércoles y viernes');
ok(ps.routine.fb2[0][1].ex === 'press_banco' && ps.routine.fb2[0][1].pinned, 'la rutina editada de Full body 2 días queda guardada');
ok(JSON.stringify(await page.locator('#view-train .chips .chip').allTextContents()) === JSON.stringify(['Día A', 'Día B', 'Día C']), 'el editor muestra los 3 días del plan nuevo');
await click('#view-train [data-action="plan-open"]');
const kept = (id) => page.locator(`#plansheet .plan-opt:has([value="${id}"]) .kept`);
ok(/^Vuelve con tus cambios: sumaste mi remo en polea \(Día B\); .+ y \d cambios? más\.$/.test(await kept('fb2').textContent()), '"Vuelve con tus cambios" dice qué se cambió en Full body 2 días');
ok(await kept('gr5').count() === 0 && await kept('tp4').count() === 0, 'los planes nunca tocados no prometen cambios');
await page.locator('#plansheet [data-action="plan-sel"][value="gr5"]').check({ force: true }); await page.waitForTimeout(80);
await click('#plansheet [data-action="plan-use"]');
ok(JSON.stringify(await page.locator('#view-train .chips .chip').allTextContents()) === JSON.stringify(['Pecho', 'Hombros', 'Espalda', 'Piernas', 'Brazos']) && (await state()).profile.days === 5, 'por grupos 5 días: un día por grupo muscular, de lunes a viernes');
await click('#view-train [data-action="plan-open"]');
await page.locator('#plansheet [data-action="plan-sel"][value="fb2"]').check({ force: true }); await page.waitForTimeout(80);
await click('#plansheet [data-action="plan-use"]');
ok(JSON.stringify((await dayRoutine(0))[1]) === JSON.stringify(pinnedBench), 'volver a Full body 2 días recupera la rutina editada');
// Cambiar solo los días del plan actual no reinicia la rotación
await page.evaluate(() => { S.plan.pos = 1; });
await click('#view-train [data-action="plan-open"]');
await click('#plansheet [data-action="plan-day"][data-v="ju"]'); await click('#plansheet [data-action="plan-day"][data-v="vi"]');
ok(await page.locator('#plansheet .plan-foot .cta').textContent() === 'Guardar los días', 'con el mismo plan el botón guarda los días');
await click('#plansheet [data-action="plan-use"]');
ps = await state();
ok(ps.rem.train.join() === 'lu,vi' && ps.plan.id === 'fb2' && ps.plan.pos === 1, 'guarda lunes y viernes sin reiniciar el día que toca');
// Los días se tocan en la tarjeta "Tu plan": con el plan lleno, un día libre recibe el entreno más cercano
await click('#view-train .plan-card [data-action="card-day"][data-v="ma"]');
ps = await state();
ok(ps.rem.train.join() === 'ma,vi' && ps.plan.pos === 1 && (await toastText()).includes('Pasamos el entreno del Lu al Ma'), 'tocar el martes en la tarjeta pasa ahí el lunes, sin reiniciar el día que toca');
await shot('13-tarjeta-dias');
await click('#toast [data-action="undo"]');
ok((await state()).rem.train.join() === 'lu,vi', 'Deshacer vuelve a lunes y viernes');
await click('#view-train .plan-card [data-action="card-day"][data-v="lu"]');
ok((await state()).rem.train.join() === 'lu,vi' && (await toastText()).includes('tocá el día libre'), 'tocar un día marcado explica cómo moverlo');
await click('[data-tab="settings"]');
const setW = '#view-settings [data-set="profile.weight"]', wBefore = (await state()).profile.weight;
await page.fill(setW, '-5'); await page.dispatchEvent(setW, 'change');
ok((await fmsg(setW)) === 'Entre 30 y 250 kg' && (await state()).profile.weight === wBefore, 'Ajustes: peso -5 marca error y mantiene el último válido');
await page.fill(setW, '81'); await page.dispatchEvent(setW, 'change');
ok((await fmsg(setW)) === 'Guardado ✓' && (await state()).profile.weight === '81', 'Ajustes: un peso válido se guarda con "Guardado ✓"');
const setMax = '#view-settings [data-set="equip.db.max"]';
await page.fill(setMax, '1'); await page.dispatchEvent(setMax, 'change');
ok((await fmsg(setMax)).includes('Menos que la más liviana') && (await state()).equip.db.max === 24, 'Ajustes: mancuerna más pesada por debajo de la más liviana marca error');
await shot('29b-ajustes-errores');
await page.fill(setMax, '24'); await page.dispatchEvent(setMax, 'change');
ok((await fmsg(setMax)) === 'Guardado ✓', 'Ajustes: al corregir el equipo se guarda y redibuja con "Guardado ✓"');
await page.fill(setW, '80'); await page.dispatchEvent(setW, 'change');
ok(await page.locator('#view-settings [data-action="plan-open"]').count() === 1 && await page.locator('#view-settings .week-strip .on').count() === 2, 'Ajustes muestra los días del plan y abre el cambio de plan');
await trainTab();
await click('[data-action="edit-routine"]');

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
ok((await fmsg('#o-weight')) === 'Poné tu peso' && await page.evaluate(() => document.activeElement.id === 'o-weight' && $('o-weight').getAttribute('aria-invalid') === 'true'), 'sin peso no avanza: error en rojo debajo del campo y foco en el peso');
ok((await page.locator('#onb').textContent()).includes('Altura (opcional)') && (await page.locator('#onb').textContent()).includes('Nombre o apodo (opcional)'), 'nombre, altura y edad dicen "(opcional)"');
await page.fill('#o-weight', '5'); await page.dispatchEvent('#o-weight', 'change');
await page.fill('#onb [data-set="profile.age"]', '200'); await page.dispatchEvent('#onb [data-set="profile.age"]', 'change');
ok((await fmsg('#o-weight')) === 'Entre 30 y 250 kg' && (await fmsg('#onb [data-set="profile.age"]')) === 'Entre 12 y 100 años' && (await state()).profile.weight === '', 'peso 5 y edad 200 muestran el rango y no se guardan');
await shot('01b-alta-errores');
await click('[data-action="onb-next"]');
ok(await page.locator('#o-weight').count() === 1 && await page.evaluate(() => document.activeElement.id === 'o-weight'), 'con datos fuera de rango no avanza y enfoca el primero');
await page.fill('#onb [data-set="profile.name"]', 'Fede'); await page.dispatchEvent('#onb [data-set="profile.name"]', 'change');
await page.fill('#o-weight', '80'); await page.dispatchEvent('#o-weight', 'change');
await page.fill('#onb [data-set="profile.age"]', '30'); await page.dispatchEvent('#onb [data-set="profile.age"]', 'change');
await page.fill('#onb [data-set="profile.height"]', '178'); await page.dispatchEvent('#onb [data-set="profile.height"]', 'change');
ok((await fmsg('#o-weight')) === '' && (await fmsg('#onb [data-set="profile.age"]')) === '', 'al corregirlos se va el error');
ok(await page.locator('#onb [data-action="rem-day"]').count() === 0, 'el perfil ya no pide días sueltos: salen del plan');
await shot('02-perfil');
ok(await page.locator('#onb [data-action="weights-mode"]').count() === 3 && await page.locator('#onb [data-action="weights-mode"][value="auto"]').isChecked(), 'el primer uso ofrece 3 formas de elegir los pesos, con la automática marcada');
await page.check('#onb [data-action="weights-mode"][value="calib"]');
ok((await state()).prefs.weights === 'calib', 'elige pesos con calibración');
await click('[data-action="onb-next"]');
await page.fill('#onb [data-set="equip.db.min"]', '30'); await page.dispatchEvent('#onb [data-set="equip.db.min"]', 'change');
ok((await fmsg('#onb [data-set="equip.db.min"]')).includes('Pasa la más pesada') && (await state()).equip.db.min === 2, 'mancuernas: la más liviana mayor que la más pesada marca error y no se guarda');
await click('[data-action="onb-next"]');
ok(await page.locator('#onb [data-set="equip.db.min"]').count() === 1, 'con el rango de mancuernas mal no avanza');
await page.fill('#onb [data-set="equip.db.max"]', '40'); await page.dispatchEvent('#onb [data-set="equip.db.max"]', 'change');
let st0 = await state();
ok(st0.equip.db.min === 30 && st0.equip.db.max === 40 && (await fmsg('#onb [data-set="equip.db.min"]')) === '', 'al subir la más pesada, la más liviana pendiente se guarda sola');
await page.fill('#onb [data-set="equip.db.min"]', '2'); await page.dispatchEvent('#onb [data-set="equip.db.min"]', 'change');
await page.fill('#onb [data-set="equip.db.max"]', '24'); await page.dispatchEvent('#onb [data-set="equip.db.max"]', 'change');
await page.fill('#onb [data-set="equip.kb"]', '12, abc, 20'); await page.dispatchEvent('#onb [data-set="equip.kb"]', 'change');
ok((await fmsg('#onb [data-set="equip.kb"]')).includes('«abc»') && (await page.inputValue('#onb [data-set="equip.kb"]')) === '12, 20', 'pesas rusas avisa lo que dejó afuera');
await shot('02b-alta-equipo-avisos');
st0 = await state();
ok(st0.equip.db.min === 2 && st0.equip.db.max === 24, 'el rango de mancuernas vuelve a 2–24');
await page.fill('#onb [data-set="equip.kb"]', '12, 20'); await page.dispatchEvent('#onb [data-set="equip.kb"]', 'change');
// Solo peso corporal: vacía el equipo, el plan se arma entero sin material y al destildarlo vuelve lo que había
const bwTile = '#onb [data-action="eq-bw"]';
ok(!(await page.isChecked(bwTile)), 'con mancuernas, "Solo peso corporal" está sin marcar');
await page.locator(bwTile).check({ force: true }); await page.waitForTimeout(80);
st0 = await state();
ok(st0.equip.db === null && !st0.equip.kb.length && await page.isChecked(bwTile) && await page.locator('#onb [data-action="eq-db"]').isChecked() === false, 'Solo peso corporal apaga mancuernas y pesas rusas');
await shot('03a-equipo-peso-corporal');
await click('[data-action="onb-next"]');
ok(!(await page.locator('#onb').textContent()).includes('falta equipo'), 'sin equipo, el plan no deja ejercicios como "falta equipo"');
await page.locator('#onb details.cues').first().evaluate((d) => (d.open = true));
ok((await page.locator('#onb').textContent()).includes('Sentadilla sin peso'), 'sin equipo, el plan muestra ejercicios con peso corporal');
await shot('03b-plan-peso-corporal');
await click('[data-action="onb-back"]');
await page.locator(bwTile).uncheck({ force: true }); await page.waitForTimeout(80);
st0 = await state();
ok(st0.equip.db?.max === 24 && st0.equip.kb.join() === '12,20' && !st0.equipBak, 'al destildarlo vuelve el equipo que había');
await page.check('#onb [data-action="eq-rings"]');
await shot('03-equipo');
await click('[data-action="onb-next"]');
// Paso del plan: viene marcado el recomendado (novato → Full body 3 días) con sus días, y se puede elegir otro
ok(await page.locator('#onb [data-action="onb-plan"]').count() === 5 && await page.locator('#onb [data-action="onb-plan"][value="fb3"]').isChecked(), 'el primer uso ofrece los 4 planes y el personalizado con Full body 3 días recomendado');
ok((await state()).rem.train.join() === 'lu,mi,vi' && (await state()).profile.days === 3, 'el plan recomendado trae lunes, miércoles y viernes');
await page.locator('#onb [data-action="onb-plan"][value="gr5"]').check({ force: true }); await page.waitForTimeout(80);
ok((await state()).plan.id === 'gr5' && (await state()).rem.train.join() === 'lu,ma,mi,ju,vi', 'elegir por grupos 5 días cambia los días a lunes a viernes');
await shot('03b-plan');
await page.locator('#onb [data-action="onb-plan"][value="fb2"]').check({ force: true }); await page.waitForTimeout(80);
ok((await state()).plan.id === 'fb2' && (await state()).rem.train.join() === 'lu,ju', 'Full body 2 días: lunes y jueves');
// Los días del plan elegido se tocan: la cantidad la pone el plan, cuáles los decide la persona
const onbDay = (k) => click(`#onb [data-action="onb-day"][data-v="${k}"]`);
await onbDay('ma');
ok((await state()).rem.train.join() === 'ma,ju' && (await toastText()).includes('Pasamos el entreno del Lu al Ma'), 'con los 2 días marcados, tocar el martes pasa ahí el lunes');
await onbDay('lu');
ok((await state()).rem.train.join() === 'lu,ju', 'y tocar el lunes lo devuelve');
await onbDay('ju');
ok((await page.locator('#onb .day-hint').textContent()).includes('Elegí 1 día más'), 'al sacar un día pide elegir otro');
await click('[data-action="onb-next"]');
ok(await page.locator('#onb [data-action="onb-plan"]').count() > 0 && (await toastText()).includes('Elegí 1 día más'), 'no avanza con días de menos');
await onbDay('sa');
ok((await state()).rem.train.join() === 'lu,sa' && (await state()).profile.days === 2, 'Full body 2 días en lunes y sábado');
// A tu medida: cuántos días y cuáles; el plan sale de la cantidad
await page.locator('#onb [data-action="onb-plan"][value="custom"]').check({ force: true }); await page.waitForTimeout(80);
ok((await state()).plan.custom && (await state()).rem.train.join() === 'lu,sa' && (await state()).plan.id === 'fb2', 'a tu medida conserva los días marcados: 2 días arma Full body 2 días');
await onbDay('mi');
ok((await state()).plan.id === 'fb3' && (await state()).profile.days === 3, 'a tu medida con 3 días arma Full body 3 días');
for (const k of ['ma', 'ju', 'vi']) await onbDay(k);
ok((await state()).plan.id === 'ppl6' && (await state()).rem.train.length === 6, 'a tu medida con 6 días arma empuje, tracción y pierna');
await onbDay('do');
ok((await state()).rem.train.length === 6 && (await toastText()).includes('descanso'), 'no deja entrenar los 7 días');
await shot('03c-medida');
for (const k of ['ma', 'mi', 'ju', 'vi', 'sa']) await onbDay(k);
ok((await state()).plan.id === 'fb1' && (await page.locator('#onb .plan-opt.on').textContent()).includes('Full body 1 día'), 'a tu medida con 1 día arma Full body 1 día');
await onbDay('lu');
ok((await state()).rem.train.join() === 'lu' && (await toastText()).includes('al menos un día'), 'no deja la semana sin días');
// Los avisos no frenan toques ni pasan al paso siguiente; al cambiar de paso se arranca arriba
ok(await page.evaluate(() => { const t = $('toast'), r = t.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !t.hidden && !t.contains(el); }), 'el aviso deja tocar lo que tiene abajo');
ok(await page.evaluate(() => { const sc = $('onb').querySelector('.dlg'); sc.scrollTop = 400; toast('Prueba'); $('onb').querySelector('[data-action="onb-back"]').click(); return $('toast').hidden && $('onb').querySelector('.dlg').scrollTop === 0; }), 'al ir atrás en el alta se cierra el aviso y se arranca arriba');
await page.evaluate(() => { toast('Prueba'); $('onb').querySelector('[data-action="onb-next"]').click(); });
ok(await page.evaluate(() => $('toast').hidden) && await page.locator('#onb [data-action="onb-plan"]').count() > 0, 'al ir adelante en el alta se cierra el aviso');
await page.evaluate(() => toast('Prueba')); await click('#onb h1');
ok(await page.evaluate(() => $('toast').hidden), 'un toque en otro lado cierra el aviso');
await page.locator('#onb [data-action="onb-plan"][value="fb2"]').check({ force: true }); await page.waitForTimeout(80);
ok(!(await state()).plan.custom && (await state()).rem.train.join() === 'lu,ju', 'volver a un plan de la lista trae sus días');
await click('[data-action="onb-back"]'); await click('[data-action="onb-next"]');
ok(await page.locator('#onb [data-action="onb-plan"][value="fb2"]').isChecked(), 'volver atrás no pisa el plan elegido con el recomendado');
await click('[data-action="onb-next"]');
await page.check('#onb [data-zone="codo_lat"][data-action="zone-toggle"]');
await page.check('#onb [data-zone="muneca"][data-action="zone-toggle"]');
ok(await page.locator('#onb [data-action="zone-pain"].on, #onb [data-action="zone-side"].on').count() === 0, 'la escala y el lado del dolor arrancan sin elegir');
ok(await page.locator('#onb [data-action="onb-care"]').isChecked(), '"¿Activar el cuidado ahora?" viene prendido');
await click('#onb [data-action="zone-pain"][data-zone="codo_lat"][data-n="5"]');
await click('[data-action="onb-next"]');
ok(await page.locator('#onb[open]').count() === 1 && await page.locator('#onb .zone-detail .fmsg.err').count() === 3, 'sin escala o lado no termina el alta y marca lo que falta');
ok(await page.evaluate(() => document.activeElement?.dataset.action === 'zone-side' && document.activeElement.dataset.zone === 'codo_lat'), 'el foco va a lo primero que falta');
await click('#onb [data-action="zone-side"][data-zone="codo_lat"][data-side="der"]');
await click('#onb [data-action="zone-pain"][data-zone="muneca"][data-n="3"]');
await click('#onb [data-action="zone-side"][data-zone="muneca"][data-side="izq"]');
ok(await page.locator('#onb .zone-detail .fmsg.err').count() === 0, 'al elegir, los avisos se van');
await shot('04-dolor');
await page.locator('#onb [data-action="onb-care"]').uncheck({ force: true });
await click('[data-action="onb-next"]');
let s = await state();
ok(s.onboarded && s.profile.weight === '80' && s.equip.kb.join() === '12,20' && s.equip.rings, 'guarda perfil y equipo');
ok(Object.keys(s.zones).join() === 'codo_lat,muneca' && s.zones.codo_lat.pain0 === 5, 'guarda las zonas con dolor');
ok(s.painMode === false, 'con el cuidado apagado en el alta, el modo dolor queda apagado');
ok(await page.locator('[data-action="pain-mode-on"]').count() === 1, 'sugiere activar el modo dolor, sin activarlo solo');
ok(await page.evaluate(() => { const c = document.querySelector('#view-home [data-action="pain-mode-on"]'), r = document.querySelector('#view-home .card.today'); return !!(c && r && (c.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING)); }), 'la tarjeta "Activar modo dolor" va arriba de la rutina');
await shot('05-inicio');
{
  const cta = await page.locator('#view-home [data-action="start-workout"]').boundingBox(), bar = await page.locator('.tabbar').boundingBox();
  ok(cta && cta.y + cta.height <= bar.y, 'Hoy muestra Empezar sobre la barra de pestañas sin bajar');
}
ok(await page.evaluate(() => S.plan.since === today() && planFor(dayIndex(activePlan(S), S.plan.pos)).every((p) => p.missing || p.sets === 2)),
  'usuario nuevo: el plan empieza hoy y el primer entreno lleva 2 series por ejercicio (rampa de entrada)');

ok(await page.evaluate(() => { toast('Prueba'); document.querySelector('.tabbar [data-tab="train"]').click(); return $('toast').hidden; }), 'al cambiar de pestaña se cierra el aviso');
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
ok(!(await page.locator('#view-home').textContent()).includes('rehabs'), 'el inicio dice "sesiones de rehabilitación", no "rehabs"');
await click('[data-tab="train"]');
ok(await page.locator('#view-train >> text=más liviano por tu codo').count() >= 3 && await page.locator('#view-train >> text=al 60 %').count() === 0, 'remo, peso muerto y curl van "más liviano por tu codo"');
await click('[data-tab="tendons"]');
ok(await page.locator('#view-tendons >> text=Extensión de muñeca isométrica').count() === 1, 'codo lateral → extensión de muñeca isométrica');
await shot('08-tendones');
ok(!(await page.locator('#view-tendons').textContent()).includes(' · ') && (await page.locator('#view-tendons').textContent()).includes('Fase 1: isométricos, desde el'), 'Dolor: "Fase 1: isométricos, desde el …", sin puntos medios');
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
// Al empezar se ve la serie 1: entrada en calor, explicación de arriba y RIR plegadas.
{
  const s1 = await page.locator('#wsheet .set.next').first().boundingBox();
  ok(await page.locator('#wsheet details.warm[open]').count() === 0 && await page.locator('#wsheet details.calib-intro[open]').count() === 0 && await page.locator('#wsheet .rir-note').count() === 0, 'al empezar, la entrada en calor, la explicación y el RIR arrancan plegados');
  ok(s1 && s1.y + s1.height <= 844 && await page.locator('#wsheet .wex').first().locator('.set.next').count() === 1, 'la serie 1 del primer ejercicio queda a la vista y es la que sigue');
  await click('#wsheet details.warm summary');
  ok(await page.locator('#wsheet details.warm.now[open]').count() === 1 && await page.locator('#wsheet .set.next').count() === 0, 'abrir la entrada en calor la vuelve el foco');
  await click('#wsheet .rir-help');
  ok(await page.locator('#wsheet .rir-note').count() === 1, 'tocar RIR ? abre su explicación');
  await click('#wsheet .rir-help');
}
await click('#wsheet [data-action="warm"][data-i="0"]');
ok(await page.locator('#wsheet .warm-item.on').count() === 1 && await page.locator('#wsheet details.warm[open]').count() === 1, 'marca un ítem de la entrada en calor y sigue abierta');
await shot('09b-entrada-en-calor');
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
await page.waitForSelector('#finsheet[open]');
ok(/Te quedan \d+ series sin hacer/.test(await page.locator('#finsheet').textContent()), 'terminar con series pendientes pide confirmar y dice cuántas faltan');
await shot('17b-confirmar-terminar');
await click('#finsheet .cta');
ok(await page.locator('#finsheet[open]').count() === 0 && await page.locator('#wsheet[open]').count() === 1, '"Seguir entrenando" vuelve al entreno');
await finish();
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
ok((await page.locator('#sumsheet').textContent()).includes('kg levantados') && !(await page.locator('#sumsheet').textContent()).includes('1minutos'), 'el resumen habla de kg levantados y pluraliza los minutos');
await shot('18-resumen');
await click('#sumsheet [data-action="close"]');
ok((await page.locator('#view-home .week-strip.home button.done').count()) === 1 && (await page.locator('#view-home .week-strip.home button.done.now b').textContent()) === 'A', 'Inicio tilda el entreno de hoy en la tira con su sigla');
ok(!(await page.locator('#view-home .plan-line').textContent()).includes('Último'), 'con el entreno de hoy, no repite "Último: hoy"');
await click('#view-home .week-strip.home button.now');
ok((await page.locator('#view-home .week-peek').textContent()).includes('hiciste Día A'), 'tocar hoy en la tira dice qué se hizo');
const nextPlanned = page.locator('#view-home .week-strip.home button.plan').first();
if (await nextPlanned.count()) { await nextPlanned.click(); ok(/Día [AB], \d+ ejercicios/.test(await page.locator('#view-home .week-peek').textContent()), 'tocar un día que viene dice qué toca y cuántos ejercicios'); }
// Descanso y cronómetros del entreno: duración según ejercicio, serie siguiente a la vista, cronómetro de la plancha
{
  await page.evaluate(() => startWorkout(0));
  await page.waitForSelector('#wsheet[open]');
  const ix = await page.evaluate(() => { W.warm.forEach((x) => (x.done = true)); W.items.forEach((it) => { it.calib = it.guess = it.pick = false; }); renderWorkout();
    return { comp: W.items.findIndex((it) => it.ex.rtype === 'compuesto'), lat: W.items.findIndex((it) => it.ex.id === 'lateral'), plank: W.items.findIndex((it) => it.ex.id === 'plancha') }; });
  await click(`#wsheet [data-action="set-done"][data-i="${ix.comp}"][data-j="0"]`);
  ok((await page.locator('#rest-time').textContent()) === '1:30', 'un compuesto descansa lo elegido en Ajustes (1:30)');
  // La barra no tapa la serie siguiente y el final del entreno deja su alto libre.
  const nextBox = await page.locator('#wsheet .set.next').boundingBox(), restBox = await page.locator('#rest').boundingBox();
  ok(nextBox.y + nextBox.height <= restBox.y, 'la serie siguiente queda a la vista, arriba de la barra de descanso');
  await page.evaluate(() => { const sc = document.querySelector('#wsheet .dlg'); sc.scrollTop = sc.scrollHeight; });
  ok(!overlaps(await page.locator('#wsheet .dlg > .cta').boundingBox(), await page.locator('#rest').boundingBox()), 'con el descanso abierto, "Terminar entreno" no queda tapado');
  if (ix.lat >= 0) {
    // Con la serie que sigue fuera de pantalla, tildar la lleva a la vista.
    await page.evaluate((i) => { W.items.forEach((it, k) => { if (k < i) it.rows.forEach((r) => (r.done = true)); }); renderWorkout(); document.querySelector('#wsheet .dlg').scrollTop = 0; }, ix.lat);
    await click(`#wsheet [data-action="set-done"][data-i="${ix.lat}"][data-j="0"]`);
    ok((await page.locator('#rest-time').textContent()) === '1:00', 'elevaciones laterales descansan 1 min');
    await page.waitForTimeout(700);
    const nb = await page.locator('#wsheet .set.next').boundingBox(), rb = await page.locator('#rest').boundingBox();
    ok(nb.y > 60 && nb.y + nb.height <= rb.y, 'al tildar, la serie siguiente sube a la vista entre el encabezado y la barra');
  }
  if (ix.plank >= 0) {
    await page.evaluate(() => { W.items.forEach((it) => { if (it.ex.id !== 'plancha') it.rows.forEach((r) => (r.done = true)); }); renderWorkout(); });
    ok(await page.locator(`#wsheet [data-action="hold"][data-i="${ix.plank}"]`).count() === 2, 'la plancha tiene un cronómetro en cada serie');
    await click(`#wsheet [data-action="hold"][data-i="${ix.plank}"][data-j="0"]`);
    ok((await page.locator('#rest-label').textContent()) === 'Preparate' && await page.locator('#rest.hold').count() === 1, 'el cronómetro arranca con unos segundos para acomodarse');
    await page.evaluate(() => { hold.start = Date.now() - 20000; });
    await page.waitForFunction(() => document.querySelector('#rest-label').textContent === 'Sostené', null, { timeout: 7000 });
    await page.evaluate(() => { hold.start = Date.now() - 20000; });
    await click('#rest [data-action="hold-stop"]');
    const pr = await page.evaluate((i) => W.items[i].rows[0], ix.plank);
    ok(pr.done && pr.secs >= 20 && pr.secs < 25, `"Listo" anota los segundos sostenidos (${pr.secs} s) y tilda la serie`);
    ok((await page.locator('#rest-label').textContent()) === 'Descanso' && (await page.locator('#rest-time').textContent()) === '0:45', 'después de la plancha descansa 45 s');
    await click(`#wsheet [data-action="set-done"][data-i="${ix.plank}"][data-j="1"]`);
    ok(await page.locator('#rest').isHidden(), 'con la última serie del entreno no arranca el descanso');
  }
  await click('#wsheet [data-action="cancel-workout"]'); await askYes();
  await page.waitForTimeout(150);
}
ok((await page.locator('#view-home .today.rest .rest-title').textContent()) === 'Hoy ya entrenaste' && (await page.locator('#view-home .today.rest .rest-sum').textContent()).includes('2 series'), 'después de entrenar, Hoy dice "Hoy ya entrenaste" con un resumen chico');
await shot('05a-inicio-ya-entrenaste');
ok(await page.locator('#view-home .today .cta[data-action="start-workout"]').count() === 0 && (await page.locator('#view-home .today button.sec[data-action="start-workout"]').textContent()) === 'Entrenar igual' && await page.locator('#view-home .today .next-list:not([open])').count() === 1, 'ya entrenado: sin botón grande, "Entrenar igual" secundario y la lista plegada');
{
  // "Próximo" con el día que toca: mañana, el día de la semana o nada si no hay días marcados
  ok(await page.evaluate(() => { const r = [...S.rem.train]; S.rem.train = [weekdayKey(addDays(today(), 1))]; render(); const x = document.querySelector('#view-home .next-when').textContent; S.rem.train = [weekdayKey(addDays(today(), 3))]; render(); const y = document.querySelector('#view-home .next-when').textContent, want = parseDay(addDays(today(), 3)).toLocaleDateString('es', { weekday: 'long' }); S.rem.train = r; render(); return x === 'Próximo, mañana' && y === `Próximo, el ${want}`; }), 'ya entrenado: "Próximo, mañana" o "Próximo, el <día>" según los días del plan');
  await page.evaluate(() => { window.__restBk = JSON.stringify({ sessions: S.sessions, train: S.rem.train }); S.sessions.forEach((x) => { x.date = addDays(x.date, -1); }); S.rem.train = [weekdayKey(addDays(today(), 2))]; render(); });
  ok((await page.locator('#view-home .today.rest .rest-title').textContent()) === 'Hoy descansás' && (await page.locator('#view-home .today button.sec[data-action="start-workout"]').textContent()) === 'Empezar igual' && (await page.locator('#view-home .next-when').textContent()).startsWith('Próximo, el '), 'día fuera del plan: "Hoy descansás", el próximo con su día y "Empezar igual" secundario');
  await shot('05b-inicio-descanso');
  if (SHOTS) { await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await shot('05c-inicio-descanso-claro'); await page.evaluate(() => { applyTheme(); }); }
  await page.evaluate(() => { const b = JSON.parse(window.__restBk); S.sessions = b.sessions; S.rem.train = b.train; render(); });
}
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
  await finish();
  await page.waitForSelector('#sumsheet[open]');
};
const closeSummary = () => click('#sumsheet [data-action="close"]');

// CK-19, CK-21, CK-25 y calibración con el rango: Día A con 3 días en el perfil y plan de 20 días
await bootSaved({ profile: { days: 3, exp: 'medio' }, sessions: [{ ago: 20 }], equip: { db: { min: 2, max: 24, step: 2 } }, extra: { prefs: { weights: 'calib' } } });
await openDay(0);
ok(await cards().count() === 6, 'Día A: 6 ejercicios en el entreno');
const setCounts = await cards().evaluateAll((els) => els.map((e) => e.querySelectorAll('.set:not(.head)').length));
ok(setCounts.every((n) => n === 3), `CK-19: con 3 días en el perfil y fuera de la rampa cada ejercicio tiene 3 series (${setCounts.join(',')})`);
ok((await card('Elevaciones laterales').textContent()).includes('× 12–20') && (await card('Sentadilla goblet').textContent()).includes('× 6–12'), 'CK-21: laterales muestran "× 12–20" y la goblet "× 6–12"');
ok(await card('Elevaciones laterales').locator('input[data-w$=".0.reps"]').getAttribute('placeholder') === '≈16' && await card('Sentadilla goblet').locator('input[data-w$=".0.reps"]').getAttribute('placeholder') === '≈9', 'el placeholder de reps sugiere el centro del rango (≈16 y ≈9)');
// Tildar sin anotar: la serie muestra las reps cargadas y avisa una vez en el entreno.
{
  const gi = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Sentadilla goblet')));
  await click(`#wsheet [data-action="set-done"][data-i="${gi}"][data-j="1"]`);
  ok((await page.locator(`#wsheet input[data-w="${gi}.1.reps"]`).inputValue()) === '9' && (await toastText()).includes('Anotamos 9 reps'), 'tildar sin anotar muestra 9 en la serie y avisa "Anotamos 9 reps"');
  await page.evaluate(() => hideToast());
  await click(`#wsheet [data-action="set-done"][data-i="${gi}"][data-j="2"]`);
  ok(await page.locator('#toast').isHidden() || !(await toastText()).includes('Anotamos'), 'el aviso de lo anotado sale una sola vez por entreno');
  await click(`#wsheet [data-action="set-done"][data-i="${gi}"][data-j="1"]`); await click(`#wsheet [data-action="set-done"][data-i="${gi}"][data-j="2"]`);
  await page.evaluate((i) => { W.autoSaid = false; W.items[i].rows.forEach((r) => (r.reps = '')); stopRest(); hideToast(); renderWorkout(); }, gi);
}
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
await finish();
await page.waitForSelector('#sumsheet[open]');
const sumText = await page.locator('#sumsheet').textContent();
ok(sumText.includes('¡Día A hecho!') && sumText.includes('cuando hagas 20 en todas, sube') && sumText.includes('Próximo: Día B'), 'CK-21: el resumen dice "cuando hagas 20 en todas, sube" y "Próximo: Día B"');
const holdsText = (sumText.split('Mismo peso la próxima')[1] || '').split(/Solo por hoy|Quedó sin hacer/)[0];
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
await bootSaved({ equip: { db: null, kb: [12, 20], rings: true }, exlib: [lostMach], templates: { A: lostA } });
await click('[data-tab="train"]');
ok((await page.locator('#view-train').textContent()).includes('Falta equipo'), 'CK-26: el entreno muestra "Falta equipo" en el ítem sin ejercicio posible');
await openDay(0, 'train');
ok(await cards().count() === 5 && !(await page.locator('#wsheet').textContent()).includes('Mi polea'), 'CK-26: el entreno empieza con 5 ítems, sin el faltante');
await click('#wsheet [data-action="cancel-workout"]'); await askYes();
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
const skippedName = await page.evaluate(() => W.skipped?.at(-1));
const remoI = await page.evaluate(() => W.items.findIndex((it) => it.from === 'remo_aros'));
const remoJ = remoI === 0 ? 1 : 0;   // la 0.0 la tilda finishQuick
await page.fill(`#wsheet [data-w="${remoI}.${remoJ}.reps"]`, '10');
await click(`#wsheet [data-action="set-done"][data-i="${remoI}"][data-j="${remoJ}"]`);
await finishQuick();
s = await state();
ok((s.sessions[0].items[0].from ?? null) === firstFrom, 'la sesión guarda de qué ejercicio se cambió');
{
  const t = await page.locator('#sumsheet').textContent(), hold = t.split('Mismo peso la próxima')[1]?.split('Solo por hoy')[0] || '';
  ok(skippedName && s.sessions[0].skipped?.includes(skippedName) && t.includes('Quedó sin hacer') && t.includes('salteado') && /sin hacer/.test(t.split('Quedó sin hacer')[1]), `el resumen muestra lo salteado (${skippedName}) y las series sin hacer`);
  ok((t.includes('Solo por hoy') && t.includes('que vuelve la próxima') && t.includes('en vez de remo invertido en aros') && !hold.includes(s.sessions[0].items.find((x) => x.from === 'remo_aros').name)), 'lo cambiado por hoy aclara que vuelve el original y no sugiere "mismo peso"');
  await shot('18b-resumen-salteado');
}
ok(JSON.stringify(dayIds(s, 1)) === JSON.stringify(routineB) && s.equip.rings === true, 'la rutina y el equipo guardados no cambian');
await closeSummary();

// Pesos automáticos (por defecto): sin serie de calibración; la primera serie anotada fija ese peso y ajusta a los demás
await bootSaved({});
ok(await page.evaluate(() => S.prefs.weights) === 'auto', 'quien no eligió queda con pesos automáticos');
ok(await page.locator('#view-home .board .load.guess').count() >= 3 && await page.locator('#view-home .board .calib-tag').count() === 0 && ((await page.locator('#view-home .today').textContent()).includes('≈ son estimados') || await page.locator('#view-home .board-note').count() === 1), 'inicio: los pesos sin datos llevan ≈ y "estimado" se explica una vez, sin "calibración"');
await openDay(0);
ok((await page.locator('#wsheet .calib-intro').textContent()).includes('Pesos estimados') && !(await page.locator('#wsheet').textContent()).includes('calibramos'), 'el entreno explica los pesos estimados, sin calibración');
const guessW = () => page.evaluate(() => Object.fromEntries(W.items.filter((it) => it.guess && it.ex.ratio).map((it) => [it.ex.id, it.w])));
const gobI = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Sentadilla goblet')));
const guess0 = await guessW();
await card('Sentadilla goblet').locator(`input[data-w="${gobI}.0.w"]`).fill('20');
await card('Sentadilla goblet').locator(`input[data-w="${gobI}.0.reps"]`).fill('10');
await click(`#wsheet [data-action="set-done"][data-i="${gobI}"][data-j="0"]`);
ok((await toastText()).includes('ajustamos el peso'), 'la primera serie anotada avisa que ajusta los ejercicios que siguen');
const guess1 = await guessW(), guessIds = Object.keys(guess1);
ok(!('goblet' in guess1) && guessIds.length >= 2 && guessIds.every((id) => guess1[id] >= guess0[id]) && guessIds.some((id) => guess1[id] > guess0[id]), `con una goblet más pesada que lo estimado, los demás suben (${JSON.stringify(guess0)} → ${JSON.stringify(guess1)})`);
ok((await state()).lifts.goblet.w === 20, 'el peso anotado queda como peso de trabajo, sin serie de calibración');
ok(await card('Sentadilla goblet').locator(`input[data-w="${gobI}.1.w"]`).inputValue() === '20', 'las series siguientes toman el peso anotado');
await finish();
await page.waitForSelector('#sumsheet[open]');
ok(!(await page.locator('#sumsheet').textContent()).includes('Récords'), 'la primera vez de un ejercicio no cuenta como récord');
await closeSummary();

// Pesos manuales: sin sugerencias; se guarda el último peso usado y no hay subidas
await bootSaved({ extra: { prefs: { weights: 'manual' } } });
ok((await page.locator('#view-home .board .load').allTextContents()).some((x) => x === 'a elegir') && await page.locator('#view-home .board .load .calib-tag').count() === 0, 'manual: el inicio dice "a elegir" y sin etiquetas');
await openDay(0);
const latM = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Elevaciones laterales')));
ok(await card('Elevaciones laterales').locator(`input[data-w="${latM}.0.w"]`).inputValue() === '', 'manual: el peso arranca vacío');
await card('Elevaciones laterales').locator(`input[data-w="${latM}.0.reps"]`).fill('20');
await click(`#wsheet [data-action="set-done"][data-i="${latM}"][data-j="0"]`);
ok((await toastText()).includes('Anotá el peso'), 'manual: pide el peso antes de marcar la serie');
await card('Elevaciones laterales').locator(`input[data-w="${latM}.0.w"]`).fill('6');
await click(`#wsheet [data-action="set-done"][data-i="${latM}"][data-j="0"]`);
await finish();
await page.waitForSelector('#sumsheet[open]');
s = await state();
ok(s.lifts.lateral.w === 6 && !s.sessions[0].ups.length && !(await page.locator('#sumsheet').textContent()).includes('Mismo peso'), 'manual: guarda 6 kg aunque haya hecho el tope del rango, sin sugerir subidas');
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
  await finish();
  await page.waitForSelector('#sumsheet[open]');
  const lift = (await state()).lifts.lateral.w;
  await closeSummary();
  return lift;
};
await bootSaved({ profile: { exp: 'medio' }, sessions: [{ ago: 20 }], lifts: { lateral: { w: 4, e1rm: 8 } }, equip: { db: { min: 2, max: 24, step: 2 } } });
ok(await finishLaterales(20) === 6, 'progress con rango: laterales 3 × 20 (tope de 12–20) suben un salto, de 4 a 6 kg');
await bootSaved({ profile: { exp: 'medio' }, sessions: [{ ago: 20 }], lifts: { lateral: { w: 4, e1rm: 8 } }, equip: { db: { min: 2, max: 24, step: 2 } } });
ok(await finishLaterales(12) === 4, 'progress con rango: laterales 3 × 12 (mínimo, no el tope) no cambian de peso');

// Subir de nivel: 7 meses entrenando cada 4 días y más fuerte de lo estimado → la tarjeta propone "6 meses a 2 años"
{
  const lvBoot = () => bootSaved({ sessions: Array.from({ length: 53 }, (_, k) => ({ ago: k * 4 })), lifts: { goblet: { w: 20, e1rm: 200 } } });
  await lvBoot();
  const lvCard = page.locator('#view-home .card.ask', { hasText: '¿Actualizamos tu experiencia?' });
  ok(await lvCard.count() === 1 && (await lvCard.textContent()).includes('«6 meses a 2 años»'), 'nivel: con 7 meses constantes aparece la tarjeta que propone 6 meses a 2 años');
  await click('#view-home [data-action="level-up"]');
  ok(await page.evaluate(() => S.profile.exp) === 'medio' && await lvCard.count() === 0, 'nivel: "Cambiar experiencia" pasa a medio y saca la tarjeta');
  await openDay(0);
  ok((await card('Sentadilla goblet').textContent()).includes('× 6–12'), 'nivel: ya en medio, la goblet vuelve a "× 6–12"');
  await page.evaluate(() => { $('wsheet').close(); W = null; keepAwake(false); });
  await lvBoot();
  await click('#view-home [data-action="level-no"]');
  ok(await lvCard.count() === 0 && await page.evaluate(() => S.plan.levelOffer === today() && S.profile.exp === 'novato'), 'nivel: "Ahora no" la oculta y deja la experiencia igual');
}

// Novato: rango más chico (6–12 → 7–11) y el ✓ sin reps anotadas guarda las sugeridas
await bootSaved({ sessions: [{ ago: 20 }], lifts: { goblet: { w: 14, e1rm: 22 } }, equip: { db: { min: 2, max: 24, step: 2 } } });
await openDay(0);
ok((await card('Sentadilla goblet').textContent()).includes('× 7–11'), 'novato: la goblet muestra "× 7–11" en vez de 6–12');
{
  const i = await cards().evaluateAll((els) => els.findIndex((e) => e.textContent.includes('Sentadilla goblet')));
  await click(`#wsheet [data-action="set-done"][data-i="${i}"][data-j="0"]`);
  ok(await page.evaluate((i) => W.items[i].rows[0].done && W.items[i].rows[0].reps === 9, i), '✓ sin reps anotadas: la serie queda hecha con las 9 sugeridas');
  await page.evaluate(() => { $('wsheet').close(); W = null; keepAwake(false); });
}

// Modo dolor con la zona en brote: el remo pasa a su variante (sin aros, el isométrico del curl)
await bootSaved({ extra: { painMode: true, zones: { codo_lat: { side: 'der', pain0: 5, phase: 1, since: '2026-10-01', load: 2, secs: 30 } } } });
await page.evaluate(() => { S.checks.push({ id: 'ck', zone: 'codo_lat', val: 'peor', date: today() }); render(); });
await click('[data-tab="train"]');
const altName = await page.evaluate(() => EXERCISES.curl_iso.name);
const altRow = page.locator('#view-train .ex').filter({ hasText: 'variante por tu' });
ok(await altRow.count() >= 1 && (await altRow.first().textContent()).includes(altName), `modo dolor en brote: el remo muestra "variante por tu …" con ${altName}`);
{
  const note = page.locator('#view-train .swap-note').first();
  ok(/Cambiamos \d+ ejercicios? por tu codo/.test(await note.locator('summary').textContent()) && (await note.textContent()).includes('Ver por qué'), 'Entreno avisa "Cambiamos N ejercicios por tu codo (ver por qué)"');
  await note.locator('summary').click();
  const why = await note.innerText();
  ok(why.includes(`${altName} en vez de`) && why.includes('amaneció peor'), 'el porqué dice qué va en vez de qué y por qué');
  await shot('20c-cambiamos');
  await click('[data-tab="home"]');
  ok(await page.locator('#view-home .card.today .swap-note').count() === 1, 'Hoy también avisa los cambios del día');
  await click('[data-tab="train"]');
}
await click('[data-action="edit-routine"]');
await click('#view-train [data-action="routine-pick"]:not([data-i])');
await page.waitForSelector('#pickersheet[open]');
ok((await page.locator('#pickersheet').innerText()).includes('Exige'), 'con modo dolor el selector muestra qué tendones exige cada ejercicio');
await click('#pickersheet [data-action="close"]');

// Se restaura el usuario del flujo principal
await wipeDb(); await putData(mainUser); await page.reload(); await page.waitForTimeout(400);
await click('[data-tab="home"]');
s = await state();

// 5. Rehabilitación
await click('[data-action="start-rehab"]');
await page.waitForSelector('#rsheet[open]');
await shot('11-rehab');
// Cada sostén se completa entero (se adelanta el reloj); los descansos se saltean.
const holdFull = async () => { await page.evaluate(() => { R.end = Date.now(); }); await page.waitForTimeout(350); };
for (let i = 0; i < 40 && await page.locator('#rsheet [data-action="rehab-go"], #rsheet [data-action="rehab-skip"]').count(); i++) {
  if (await page.evaluate(() => R.state === 'hold')) await holdFull();
  else await click('#rsheet [data-action="rehab-go"], #rsheet [data-action="rehab-skip"]');
}
s = await state();
ok(s.sessions[0].type === 'rehab' && s.sessions[0].items.length === 2 && !s.sessions[0].pain, 'la rehabilitación se guarda al terminar la última serie, antes de anotar el dolor');
ok(s.sessions[0].items.every((i) => i.sets.every((x) => x.secs === s.zones[i.zone].secs)), 'guarda los segundos sostenidos de cada serie');
const doneTxt = await page.locator('#rsheet').innerText();
ok(/Sesión de la (mañana|noche) hecha/i.test(doneTxt) && /3 de 3 series de \d+ s/.test(doneTxt) && doneTxt.includes('Lo próximo'), `"¡Listo!" festeja y resume (${doneTxt.replace(/\s+/g, " ").slice(0, 200)})`);
ok(await page.locator('#rsheet .done-mark').count() === 1 && (await page.locator('#rsheet .dlg-head [data-action="cancel-rehab"]').textContent()) === 'Cerrar', 'tilde de festejo y "Cerrar" sin preguntar');
await shot('11b-rehab-listo');
const homeRehab = await page.locator('#view-home .card.rehab').innerText();
ok(homeRehab.includes('Hecha ✓') && homeRehab.includes('Lo próximo'), 'en Hoy la tarjeta queda con el tilde y lo próximo');
ok(await page.locator('#view-home .card.rehab').evaluate((c) => !!c.nextElementSibling?.matches('.card.today') || !!c.closest('#view-home').querySelector('.card.rehab ~ .card.today')), 'la tarjeta hecha sigue arriba del entreno');
await click('#rsheet [data-action="rehab-pain"]');
await click('#painsheet [data-zone="codo_lat"][data-n="6"]');
await click('#painsheet [data-zone="muneca"][data-n="2"]');
await click('[data-action="save-pain"]');
s = await state();
ok(s.sessions[0].type === 'rehab' && s.sessions[0].items.length === 2 && s.sessions[0].items.every((i) => i.sets.length === 3), 'guarda 2 isométricos de 3 series');
ok(s.zones.codo_lat.load === 2 && s.zones.codo_lat.secs === 35, 'dolor 6 → baja la carga (en el mínimo, baja el tiempo)');
ok((await toastText()).includes('bajamos'), 'avisa que bajó la carga');
ok((await state()).sessions.filter((x) => x.type === 'rehab').length === 1, 'el dolor se suma a la misma sesión, sin duplicarla');
// Cortar el sostén: antes de la mitad no cuenta; después, cuenta con los segundos reales. Salir sin terminar no guarda.
await page.evaluate(() => startRehab()); await page.waitForSelector('#rsheet[open]');
await click('#rsheet [data-action="rehab-go"]');
await click('#rsheet [data-action="rehab-skip"]');
ok(await page.evaluate(() => R.items[0].done === 0 && R.state === 'listo') && (await toastText()).includes('muy poco para contar'), 'cortada a los pocos segundos, la serie no cuenta y avisa');
await click('#rsheet [data-action="rehab-go"]');
await page.evaluate(() => { R.end = Date.now() + 10000; });
await click('#rsheet [data-action="rehab-skip"]');
ok(await page.evaluate(() => R.items[0].done === 1 && R.items[0].held[0] === R.items[0].secs - 10), 'cortada pasada la mitad, cuenta con el tiempo sostenido');
await click('#rsheet [data-action="cancel-rehab"]');
ok((await page.locator('#asksheet .cta').textContent()) === 'Seguir la sesión', 'salir a mitad de la rehabilitación pregunta con un diálogo propio');
await askYes();
ok(!(await page.locator('#rsheet[open]').count()) && (await state()).sessions.filter((x) => x.type === 'rehab').length === 1, 'salir a mitad de la sesión no la guarda');

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
{
  const t = await page.locator('#painsheet').textContent();
  ok(t.includes("¿Cuánto te duele ahora?") && t.includes("Ahora mismo") && !t.includes("Durante"), `fuera de un ejercicio pregunta "¿Cuánto te duele ahora?" (${t.replace(/\s+/g, ' ').slice(0, 160)})`);
  await click('#painsheet [data-action="close"]');
  ok(!(await page.locator('#painsheet[open]').count()), 'el registro suelto se puede cancelar');
}
await click('[data-tab="tendons"]');
ok(await page.locator('#view-tendons .pain-now [data-action="quick-pain"]').count() === 1, 'la pestaña Dolor tiene el acceso para anotar el dolor de ahora');
await click('#view-tendons [data-action="quick-pain"]');
await click('#painsheet [data-zone="codo_lat"][data-n="3"]');
await click('#painsheet [data-zone="muneca"][data-n="1"]');
await click('[data-action="save-pain"]');
ok((await state()).sessions[0].type === 'dolor' && (await state()).sessions[0].pain.muneca === 1, 'anota el dolor sin hacer una sesión');
ok((await page.locator('#view-tendons .pain-now').innerText()).includes('Último registro, hoy'), 'la tarjeta muestra el último registro');
await shot('12b-dolor-ahora');
await click('[data-tab="history"]');
{
  const row = (await page.locator('#view-history .sess').allTextContents()).find((t) => t.startsWith('Dolor anotado')) || '';
  ok(row && !row.includes('sin hacer') && row.includes('de 10'), `el registro suelto dice "Dolor anotado" con el valor, no "sin hacer" (${row})`);
  ok((await page.locator('#view-history').innerText()).includes('dolor más alto del día'), 'el gráfico de dolor aclara que grafica el más alto del día');
}
await click('[data-tab="home"]');
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
await page.evaluate(() => { const y = addDays(today(), -3); S.sessions.unshift({ id: 'later', date: y, type: 'dolor', items: [], pain: { codo_lat: 2 } }); histZone = 'codo_lat'; render(); });
{
  const tips = await page.locator('#view-history .card.pain .hit').evaluateAll((els) => els.map((e) => e.dataset.tip));
  ok(tips.some((t) => t.includes('|5/10|el más alto de 2 registros, el último fue 2')), `el punto aclara que es el más alto y cuál fue el último (${tips.join(' ; ')})`);
}
await page.evaluate(() => { S.sessions = S.sessions.filter((x) => x.id !== 'later'); persist(); render(); });
// Gráfico de peso: eje en el rango real con kg, varias fechas, resumen y etiqueta dentro de la tarjeta.
{
  await page.evaluate(() => {
    [[14, 12], [10, 12], [7, 13], [3, 13], [0, 14]].forEach(([ago, w], i) => S.sessions.push({ id: 'wc' + i, date: addDays(today(), -ago), type: 'entreno', tpl: 'A', items: [{ ex: 'rdl', sets: [{ w, reps: 10 }] }] }));
    histEx = 'rdl'; render(); scrollTo(0, 0);
  });
  const card = page.locator('#view-history .card.acc').filter({ has: page.locator('.chart svg') }).first();
  const axis = await card.locator('.chart .axis').allTextContents();
  ok(axis.includes('kg') && axis.includes('12') && axis.includes('14') && !axis.includes('0'), `el eje del peso va del rango real y dice kg (${axis.join(' ; ')})`);
  ok(axis.filter((t) => /[a-z]{3}/.test(t) && t !== 'kg').length >= 3, `muestra más de dos fechas (${axis.join(' ; ')})`);
  ok((await card.locator('.chart-trend').textContent()).trim() === '+2 kg en 2 semanas', 'resume "+2 kg en 2 semanas"');
  const hits = card.locator('.chart .hit');
  await hits.last().click(); await page.waitForTimeout(80);
  const [tb, cb] = [await page.locator('#tip').boundingBox(), await card.boundingBox()];
  ok(tb.y >= cb.y && tb.x >= cb.x && tb.x + tb.width <= cb.x + cb.width, 'la etiqueta del punto más alto queda dentro de la tarjeta');
  ok(await page.locator('#tip').evaluate((e) => e.classList.contains('below')), 'si arriba no entra, la etiqueta va debajo del punto');
  ok((await page.locator('#tip').textContent()).startsWith('14 kg'), 'la etiqueta dice el peso con kg');
  await page.evaluate(() => { S.sessions = S.sessions.filter((x) => !x.id.startsWith('wc')); render(); });
}
{
  const sess = await page.locator('#view-history .sess').allTextContents();
  ok(sess.some((t) => t.startsWith('Día A')) && !sess.some((t) => t.includes('Entreno A')), 'el historial nombra el entreno con el día del plan');
  ok(sess.some((t) => t.includes('Rehabilitación de la noche') && t.includes('sin hacer')), 'la rehabilitación sin ejercicios dice "sin hacer"');
  await page.evaluate(() => { S.sessions.push({ id: 'tp', date: addDays(today(), -5), type: 'entreno', plan: 'tp4', day: 0, tpl: 'A', items: [] }); render(); });
  ok((await page.locator('#view-history .sess').allTextContents()).some((t) => t.startsWith('Torso A')), 'con Torso y pierna el historial dice Torso A');
  await page.evaluate(() => { S.sessions = S.sessions.filter((x) => x.id !== 'tp'); persist(); render(); });
}
// Récords y detalle: el trofeo dice qué récord, tablita kg/reps/RIR, kg levantados contra la vez anterior, semanas y selector agrupado.
{
  await page.evaluate(() => {
    const it = (w, reps) => [{ ex: 'remo_inclinado', sets: [{ w, reps, rir: 2, secs: 0 }, { w, reps: reps - 1, rir: 1, secs: 0 }] }];
    S.sessions.unshift({ id: 'pr1', date: today(), type: 'entreno', plan: 'fb2', day: 1, tpl: 'B', items: it(14, 12), vol: 14 * 23, sets: 2, min: 30, prs: [{ ex: 'remo_inclinado', name: 'Remo inclinado con dos mancuernas', val: '19 kg', est: true }] });
    S.sessions.push({ id: 'pr0', date: addDays(today(), -30), type: 'entreno', plan: 'fb2', day: 1, tpl: 'B', items: it(12, 12), vol: 12 * 23, sets: 2, min: 30 });
    render();
  });
  const d = page.locator('#view-history details.sess-d', { hasText: 'Remo inclinado' }).first();
  const sum = await d.locator('summary').textContent();
  ok(sum.includes('1 récord') && sum.includes(String(14 * 23)) && sum.includes('kg levantados') && sum.includes(`+${2 * 23} kg vs. la anterior`), `la sesión destaca kg levantados, el cambio y cuántos récords (${sum.trim().replace(/\s+/g, ' ')})`);
  await d.evaluate((e) => (e.open = true));
  ok((await d.locator('.sd-prs').textContent()).includes('Remo inclinado con dos mancuernas: 19 kg, nuevo máximo estimado'), 'el detalle explica el récord: ejercicio, kilos y qué es');
  ok(JSON.stringify(await d.locator('.sd-sets th').allTextContents()) === '["Serie","kg","reps","RIR"]' && (await d.locator('.sd-sets tbody tr').first().textContent()) === '114122', 'el detalle es una tablita de kg, reps y RIR');
  const rec = await page.locator('#view-history .recs').textContent();
  ok(rec.includes('Remo inclinado con dos mancuernas') && rec.includes('14 kg × 12'), 'la sección Récords muestra el mejor peso del ejercicio');
  ok(await page.locator('#view-history .sess-wk .wk-head').first().textContent().then((t) => t.startsWith('Esta semana') && /\d de \d entrenos/.test(t)), 'las sesiones se agrupan por semana con los entrenos hechos');
  const groups = await page.locator('#view-history select[data-action="hist-ex"] optgroup').evaluateAll((g) => g.map((x) => x.label));
  ok(groups.length >= 2 && groups.indexOf('Tirón') > -1, `el selector de ejercicio se agrupa por zona (${groups.join(', ')})`);
  await page.evaluate(() => { S.sessions = S.sessions.filter((x) => !x.id.startsWith('pr')); persist(); render(); });
}
await shot('13-historial');

// 8a. Solo peso corporal en Ajustes: rearma lo que no eligió el usuario y al destildarlo vuelve todo
await click('[data-tab="settings"]');
{
  const before = await state(), plan = before.plan.id;
  await page.locator('#view-settings [data-action="eq-bw"]').check({ force: true }); await page.waitForTimeout(150);
  const bw = await state();
  ok(bw.equip.db === null && !bw.equip.rings && !bw.equip.kb.length && await page.isChecked('#view-settings [data-action="eq-bw"]'), 'Ajustes: Solo peso corporal vacía el equipo');
  ok(await page.evaluate((id) => S.routine[id].flat().filter((it) => !it.pinned && getEx(it.ex)).every((it) => possible(it.ex, S.equip, getEx)), plan), 'Ajustes: con peso corporal todos los ejercicios sin fijar se pueden hacer');
  ok((await toastText()).includes('sin material'), 'Ajustes: avisa que el plan usa ejercicios sin material');
  await shot('12b-ajustes-peso-corporal');
  await page.locator('#view-settings [data-action="eq-bw"]').uncheck({ force: true }); await page.waitForTimeout(150);
  const back = await state();
  ok(JSON.stringify(back.equip) === JSON.stringify(before.equip) && JSON.stringify(back.routine[plan]) === JSON.stringify(before.routine[plan]), 'Ajustes: al destildarlo vuelven el equipo y los mismos ejercicios');
}

// 8b. Equipo propio y rutina editable
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
await click('#wsheet [data-action="cancel-workout"]'); await askYes();

// 8b3. Tema claro
await click('[data-tab="settings"]');
await click('#view-settings [data-action="theme"][data-v="light"]');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'cambia al tema claro');
ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(242, 243, 245)', 'el fondo pasa a claro');
await click('[data-tab="home"]'); await shot('21-claro-inicio');
await click('[data-tab="train"]'); await shot('22-claro-entreno');
await click('[data-tab="settings"]');
await click('#view-settings [data-action="theme"][data-v="dark"]');
ok((await state()).prefs.themeSet === true && (await state()).prefs.theme === 'dark', 'elegir Oscuro queda guardado como elegido');
// Sin elegir tema, sigue al del teléfono (y los datos viejos con "Oscuro" por defecto pasan a "Según el sistema")
ok(await page.evaluate(() => withDefaults({ profile: {}, sessions: [], routine: {}, prefs: { theme: 'dark' } }).prefs.theme) === 'system', 'un tema oscuro nunca elegido pasa a "Según el sistema"');
ok(await page.evaluate(() => withDefaults({ profile: {}, sessions: [], routine: {}, prefs: { theme: 'dark', themeSet: true } }).prefs.theme) === 'dark' && await page.evaluate(() => withDefaults({ profile: {}, sessions: [], routine: {}, prefs: { theme: 'light' } }).prefs.theme) === 'light', 'un tema elegido se respeta');
await page.evaluate(() => { S.prefs.theme = 'system'; S.prefs.themeSet = false; applyTheme(); });
await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(100);
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'según el sistema: con el teléfono en claro, la app pasa a claro');
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(100);
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'y vuelve a oscuro con el teléfono en oscuro');
await page.evaluate(() => { S.prefs.theme = 'dark'; applyTheme(); persist(); render(); });
// Filas con interruptor: tocar el texto también lo cambia
const voiceBefore = (await state()).prefs.voice;
await click('#view-settings label.row.tap:has([data-k="voice"]) h3');
ok((await state()).prefs.voice === !voiceBefore, 'tocar el texto de la fila "Voz" cambia el interruptor');
await click('#view-settings label.row.tap:has([data-k="voice"]) p');
ok((await state()).prefs.voice === voiceBefore, 'y otro toque lo vuelve a dejar como estaba');

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
ok((await toastText()) === 'Informe descargado.', 'avisa "Informe descargado"');
ok(rep.includes(`del ${await page.evaluate(() => fmtDate(S.sessions.map((s) => s.date).concat(S.checks.map((c) => c.date)).sort()[0]))} al`), 'el período del informe arranca en la primera sesión');

// 8d2. Estancamiento y descarga
await page.evaluate(() => {
  S.lifts.rdl = { w: 10, e1rm: 14 };
  for (let i = 0; i < 3; i++) S.sessions.push({ id: 'st' + i, date: addDays(today(), -20 - i), type: 'entreno', tpl: 'A', items: [{ ex: 'rdl', sets: [{ w: 10, reps: 9 }, { w: 10, reps: 9 }] }, { ex: 'lateral', sets: [{ w: 4, reps: 9 }] }] });
  S.lifts.lateral = { w: 4, e1rm: 5 };
  S.painMode = false; persist(); render();
});
// Sin modo dolor, Historial ofrece exportar los entrenos en vez del informe para el fisio.
await click('[data-tab="history"]');
ok(await page.locator('#view-history [data-action="report"]').count() === 0, 'sin modo dolor no ofrece el informe para el fisio');
dl = page.waitForEvent('download'); await click('#view-history [data-action="export-train"]');
const trainRep = fs.readFileSync(await (await dl).path(), 'utf8');
if (SHOTS) fs.writeFileSync(`${SHOTS}/entrenos.html`, trainRep);
ok(trainRep.includes('Mis entrenos') && trainRep.includes('Peso muerto rumano') && trainRep.includes('10 kg × 9 reps') && !trainRep.includes('rehabilitación'), '"Exportar mis entrenos" trae las sesiones con kg y reps');
ok((await toastText()) === 'Informe descargado.', 'avisa al exportar los entrenos');
// Con 4 entrenos o más y sin copia, Hoy recuerda guardarla; "Ahora no" la pospone.
await page.evaluate(() => { S.backup = { last: '', snooze: '' }; render(); });
await click('[data-tab="home"]');
ok(await page.locator('#view-home .backup-ask').count() === 1, 'Hoy recuerda guardar una copia');
await click('#view-home .backup-ask [data-action="backup-no"]');
ok(await page.locator('#view-home .backup-ask').count() === 0 && (await state()).backup.snooze > await page.evaluate(() => today()), '"Ahora no" pospone el recordatorio');
await page.evaluate(() => { S.backup = { last: addDays(today(), -40), snooze: '' }; render(); });
ok(await page.locator('#view-home .backup-ask').count() === 1 && (await page.locator('#view-home .backup-ask').textContent()).includes('hace 40 días'), 'vuelve a recordarla si la última copia tiene más de un mes');
await page.evaluate(() => { S.backup = { last: today(), snooze: '' }; render(); });
ok(await page.locator('#view-home .backup-ask').count() === 0, 'con una copia reciente no la recuerda');
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
ok((await toastText()) === 'Copia guardada.' && (await page.locator('#view-settings .backup-last').textContent()) === 'Última copia: hoy.', 'avisa "Copia guardada" y muestra la última copia');
await page.waitForTimeout(150); await shot('14b-ajustes-copia');
await page.evaluate(() => { S.sessions = []; persist(); });
await page.setInputFiles('#import-file', { name: 'copia.json', mimeType: 'application/json', buffer: fs.readFileSync(backupPath) });
await page.waitForTimeout(150); await askYes();
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

// Ajustes: marcar Banco ofrece "Cambiar ahora", que pasa el press en el suelo a press en banco (fijado) y se deshace
await bootSaved({});
await click('[data-tab="settings"]');
await page.locator('#view-settings [data-action="eq-flag"][data-k="bench"]').check({ force: true }); await page.waitForTimeout(80);
ok(await page.locator('#toast:not([hidden]) [data-action="undo"]').textContent() === 'Cambiar ahora', 'Banco: el aviso trae el botón "Cambiar ahora"');
await click('#toast [data-action="undo"]');
ps = await state();
ok(ps.routine.fb2.flat().every((it) => it.ex !== 'press_suelo') && ps.routine.fb2.flat().some((it) => it.ex === 'press_banco' && it.pinned), '"Cambiar ahora" cambia el press en el suelo por press en banco fijado');
ok((await toastText()).startsWith('Listo: press en banco') && await page.locator('#toast [data-action="undo"]').textContent() === 'Deshacer', 'tras cambiar avisa "Listo" con Deshacer');
await click('#toast [data-action="undo"]');
ok((await state()).routine.fb2.flat().some((it) => it.ex === 'press_suelo'), 'Deshacer vuelve el press en el suelo');
// Novedades en lenguaje de usuario: sin términos técnicos ni el nombre viejo
await click('#view-settings [data-action="news"]'); await page.waitForSelector('#newssheet[open]');
const newsTxt = await page.locator('#newssheet').textContent();
ok(!/epley|indexeddb|pwa|wger|franpol|fitnessvolt|tend[oó]n fuerte|\.html|json|changelog|test/i.test(newsTxt) && newsTxt.includes('1.0.0'), 'Novedades sin Epley, IndexedDB, PWA, créditos técnicos ni el nombre viejo');
await click('#newssheet [data-action="close"]');
// Pesos: elegir una opción la deja entera arriba de la barra de pestañas
await page.evaluate(() => window.scrollTo(0, 0));
await page.evaluate(() => { const r = document.querySelector('#view-settings [data-action="weights-mode"][value="calib"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(80);
const barTop = (await page.locator('.tabbar').boundingBox()).y, modeBox = await page.locator('#view-settings [data-action="weights-mode"][value="calib"]').locator('xpath=ancestor::label[1]').boundingBox();
ok(modeBox.y + modeBox.height <= barTop + 1 && modeBox.y >= 0, 'la opción elegida en Pesos no queda tapada por la barra');

// Borrar todos los datos deja una rutina válida: tocar Banco en el alta no rompe el aviso del banco
const errorsBeforeReset = errors.length;
await click('[data-tab="settings"]');
await click('[data-action="reset"]');
await page.waitForSelector('#wipesheet[open]');
ok(await page.locator('#wipesheet [data-action="wipe-backup"]').count() === 1 && await page.locator('#wipesheet .wipe-go').isDisabled(), 'borrar datos ofrece "Guardar copia antes" y no deja borrar sin escribir BORRAR');
await page.fill('#wipe-q', 'borra');
ok(await page.locator('#wipesheet .wipe-go').isDisabled(), 'con otra palabra sigue sin dejar borrar');
await page.fill('#wipe-q', 'borrar');
ok(!(await page.locator('#wipesheet .wipe-go').isDisabled()), 'escribir BORRAR (sin importar mayúsculas) habilita el botón');
await click('#wipesheet .wipe-go');
await page.waitForSelector('#onb[open]');
await click('[data-action="onb-next"]');
await page.fill('#o-weight', '70');
await click('[data-action="onb-next"]');
await page.locator('#onb [data-action="eq-flag"][data-k="bench"]').check({ force: true });
await page.waitForTimeout(80);
ok(errors.length === errorsBeforeReset, `reset → alta → Banco sin errores de JavaScript${errors.length > errorsBeforeReset ? ': ' + errors.slice(errorsBeforeReset).join(' | ') : ''}`);
// Con el cuidado prendido (por defecto), el alta termina con el modo dolor activo
await click('[data-action="onb-next"]'); await click('[data-action="onb-next"]');
await page.check('#onb [data-zone="rodilla"][data-action="zone-toggle"]');
await click('#onb [data-action="zone-pain"][data-zone="rodilla"][data-n="4"]');
await click('#onb [data-action="zone-side"][data-zone="rodilla"][data-side="izq"]');
await click('[data-action="onb-next"]');
s = await state();
ok(s.onboarded && s.painMode === true && s.zones.rodilla.pain0 === 4 && s.zones.rodilla.side === 'izq', 'con el cuidado prendido, el alta activa el modo dolor con la escala y el lado elegidos');
ok(await page.locator('#view-home [data-action="pain-mode-on"]').count() === 0, 'con el modo activo no ofrece activarlo');

// El entreno en curso sobrevive a una recarga: Hoy ofrece "Seguir entreno" tal como quedó
const errorsBeforeLive = errors.length;
await page.evaluate(() => document.querySelector('#view-home [data-action="start-workout"]').click());
await page.waitForTimeout(150);
const firstWarm = await page.locator('#wsheet [data-action="warm"]').count();
if (firstWarm) { await click('#wsheet details.warm summary'); await click('#wsheet [data-action="warm"][data-i="0"]'); }
await click('#wsheet [data-action="set-done"][data-i="0"][data-j="0"]');
await page.fill('#wsheet [data-w="0.1.reps"]', '9');
await page.waitForTimeout(600);
await page.reload(); await page.waitForTimeout(500);
ok(await page.locator('#wsheet[open]').count() === 0 && await page.locator('#view-home .today.resume [data-action="resume-workout"]').count() === 1, 'al recargar en medio del entreno, Hoy ofrece "Seguir entreno"');
ok(/1 de \d+ series/.test(await page.locator('#view-home .today.resume h3').textContent()) && await page.locator('#view-home [data-action="start-workout"]').count() === 0, 'la tarjeta dice cuántas series van y reemplaza a "Empezar"');
if (SHOTS) await shot('resume-card');
await click('#view-home [data-action="resume-workout"]');
const live = await page.evaluate(() => ({ done: W.items[0].rows[0].done, reps: W.items[0].rows[1].reps, warm: W.warm[0]?.done, kind: typeof W.items[0].ex.name }));
ok(await page.locator('#wsheet[open]').count() === 1 && live.done && live.reps === '9' && live.kind === 'string' && (!firstWarm || live.warm), 'al seguir, vuelven la serie tildada, las reps escritas y la entrada en calor');
ok((await page.locator('#wsheet [data-w="0.1.reps"]').inputValue()) === '9', 'las reps escritas se ven en la serie');
await page.reload(); await page.waitForTimeout(500);
await click('#view-home [data-action="discard-workout"]');
ok(await page.locator('#view-home [data-action="resume-workout"]').count() === 0 && (await toastText()).includes('Entreno descartado'), 'descartar saca la tarjeta con aviso y "Deshacer"');
await click('#toast [data-action="undo"]');
ok(await page.locator('#view-home [data-action="resume-workout"]').count() === 1, '"Deshacer" devuelve el entreno sin terminar');
await click('#view-home [data-action="resume-workout"]');
await click('#wsheet [data-action="finish-workout"]');
if (await page.locator('#finsheet[open]').count()) await click('#finsheet [data-action="finish-anyway"]');
await page.waitForTimeout(200);
await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
await page.reload(); await page.waitForTimeout(500);
ok(await page.locator('#view-home [data-action="resume-workout"]').count() === 0, 'al terminar, el entreno guardado se borra y no se vuelve a ofrecer');
await page.evaluate(() => { saveLive({ ...JSON.parse(JSON.stringify({ plan: S.plan.id, day: 0, dayName: 'Viejo', started: Date.now() - 30 * 3600e3, warm: [], off: [], out: [] })), items: [{ ex: { id: 'goblet' }, rows: [{ done: true }] }] }); });
await page.waitForTimeout(200); await page.reload(); await page.waitForTimeout(500);
ok(await page.locator('#view-home [data-action="resume-workout"]').count() === 0, 'un entreno de hace más de 24 h ya no se ofrece');
ok(errors.length === errorsBeforeLive, `seguir entreno sin errores de JavaScript${errors.length > errorsBeforeLive ? ': ' + errors.slice(errorsBeforeLive).join(' | ') : ''}`);
errors.length = errorsBeforeReset;
// Sin pesas rusas, la sentadilla goblet y el swing se hacen con mancuerna y lo dicen (nombre, indicaciones y dibujo).
const kbView = await page.evaluate(() => {
  const bak = S.equip; const see = () => { const g = getEx('goblet'), w = getEx('swing'); return { name: w.name, cue: g.cues[0], prop: g.fig.props[0].t, impl: implFor(g, S.equip) }; };
  S.equip = { ...bak, db: { min: 2, max: 24, step: 2 }, kb: [] }; const sin = see();
  S.equip = { ...bak, db: { min: 2, max: 24, step: 2 }, kb: [12] }; const con = see();
  S.equip = bak; return { sin, con };
});
ok(kbView.sin.impl === 'db' && kbView.sin.name === 'Swing con mancuerna' && kbView.sin.cue.startsWith('Mancuerna') && kbView.sin.prop === 'db', 'sin pesas rusas, goblet y swing se muestran con mancuerna');
ok(kbView.con.impl === 'kb' && kbView.con.name === 'Swing con pesa rusa' && kbView.con.prop === 'kb', 'con pesas rusas siguen con pesa rusa');
// Condiciones de salud: descanso mínimo, reps más altas (pesos más livianos) y cuidados
{
  await bootSaved({ profile: { exp: 'medio' }, sessions: [{ ago: 20 }] });
  const goblet0 = await page.evaluate(() => planFor(0).find((p) => p.ex.id === 'goblet'));
  ok(await page.locator('#view-home .care').count() === 0, 'sin condiciones no hay tarjeta de cuidados');
  await click('[data-tab="settings"]');
  await page.locator('#view-settings [data-action="cond-toggle"][value="marfan"]').check({ force: true }); await page.waitForTimeout(80);
  ok((await state()).profile.conds.includes('marfan'), 'marcar Marfan en Ajustes lo guarda en el perfil');
  ok(await page.locator('#view-settings [data-k="rest"][data-v="60"]').isDisabled() && await page.locator('#view-settings [data-k="rest"][data-v="90"]').isDisabled() && !(await page.locator('#view-settings [data-k="rest"][data-v="120"]').isDisabled()), 'con Marfan, 60 s y 90 s de descanso quedan desactivados');
  ok((await page.locator('#view-settings').textContent()).includes('Por tu condición descansás al menos 2 min'), 'Ajustes explica el descanso mínimo');
  const goblet1 = await page.evaluate(() => planFor(0).find((p) => p.ex.id === 'goblet'));
  ok(goblet1.range[0] >= 12 && goblet1.w <= goblet0.w, `con Marfan la goblet va a 12 reps o más y no más pesada (${goblet0.range.join('–')} ${goblet0.w} kg → ${goblet1.range.join('–')} ${goblet1.w} kg)`);
  await click('[data-tab="home"]');
  ok(await page.locator('#view-home .care').count() === 1 && (await page.locator('#view-home .care summary').textContent()).includes('Descanso de 2 min'), 'Hoy muestra los cuidados por la condición');
  await page.evaluate(() => startWorkout(0)); await page.waitForSelector('#wsheet[open]');
  ok(await page.locator('#wsheet .care').count() === 1, 'el entreno arranca con los cuidados plegados');
  const li = await page.evaluate(() => { W.warm.forEach((x) => (x.done = true)); W.items.forEach((it) => { it.calib = it.guess = it.pick = false; }); renderWorkout(); return W.items.findIndex((it) => it.ex.id === 'lateral' || it.ex.cat === 'core'); });
  await click(`#wsheet [data-action="set-done"][data-i="${Math.max(0, li)}"][data-j="0"]`);
  ok((await page.locator('#rest-time').textContent()) === '2:00', 'con Marfan hasta un aislamiento descansa 2 min');
  await page.evaluate(() => endWorkout());
  // Embarazo: los ejercicios boca arriba llevan aviso
  await page.evaluate(() => { S.profile.conds = ['embarazo']; S.equip.bench = true; S.routine.fb2[0][1] = { slot: S.routine.fb2[0][1].slot, ex: 'press_banco', pinned: true }; persist(); render(); });
  ok((await page.locator('#view-home .board').textContent()).includes('boca arriba'), 'con embarazo, el press en banco avisa en Hoy que es boca arriba');
  await page.evaluate(() => { S.profile.conds = []; persist(); render(); });
}
ok(nativeDialogs === 0, `ninguna pregunta nativa del navegador (confirm/alert): ${nativeDialogs}`);
ok(errors.length === 0, `sin errores de JavaScript${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} fallaron` : '\nTodo OK');
process.exit(failures ? 1 : 0);
