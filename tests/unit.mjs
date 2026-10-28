// Pruebas de las reglas (logic.js) sin navegador. Uso: node tests/unit.mjs
import fs from 'fs';
import vm from 'vm';
const ctx = vm.createContext({});
for (const f of ['data.js', 'logic.js', 'figures.js']) vm.runInContext(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), ctx);
const L = (expr) => vm.runInContext(expr, ctx);
let failures = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) failures++; };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (${JSON.stringify(a)})`);

// Equipo
const equip = { db: { min: 2, max: 24, step: 2 }, kb: [20, 12], rings: true };
ctx.equip = equip;
// Equipo por defecto de la app (copia de DEFAULT().equip en app.js): sin aros, pesas rusas, banco, barra ni banda.
const defEq = { db: { min: 2, max: 24, step: 2 }, kb: [], rings: false, bench: false, bar: false, band: false, machines: [] };
ctx.defEq = defEq;
ctx.fullEq = { ...defEq, kb: [12, 20], rings: true, bench: true, bar: true, band: true };
ctx.noDb = { ...defEq, db: null };   // sin mancuernas: el deltoides posterior no tiene ningún ejercicio posible
eq(L('weightSteps(equip, "db")').length, 12, 'mancuernas de 2 a 24 de a 2 = 12 pesos');
eq(L('weightSteps(equip, "kb")'), [12, 20], 'pesas rusas ordenadas');
eq(L('roundDown([2,4,6], 5.9)'), 4, 'redondea hacia abajo');
eq(L('roundDown([2,4,6], 1)'), 2, 'por debajo del mínimo usa el más liviano');
eq(L('stepUp([2,4,6], 6)'), 6, 'no sube más allá del máximo');
eq(L('implFor(EXERCISES.goblet, { db: equip.db, kb: [] })'), 'db', 'goblet sin pesa rusa usa mancuerna');
eq(L('implFor(EXERCISES.remo_aros, { db: null, kb: [] })'), null, 'sin aros no hay remo en aros');

// Equipo extra y máquinas
ctx.eq2 = { db: equip.db, kb: [], rings: false, bench: false, bar: false, band: true, machines: [{ id: 'p1', name: 'Polea', min: 5, max: 20, step: 2.5 }] };
eq(L('implFor(EXERCISES.press_banco, eq2)'), null, 'press en banco sin banco → no se puede');
eq(L('implFor(EXERCISES.press_banco, { ...eq2, bench: true })'), 'db', 'con banco → mancuernas');
eq(L('implFor(EXERCISES.dominadas, eq2)'), null, 'dominadas sin barra ni aros → no');
eq(L('implFor(EXERCISES.dominadas, { ...eq2, rings: true })'), 'rings', 'dominadas con aros');
eq(L('implFor(EXERCISES.face_pull, eq2)'), 'band', 'face pull con banda');
eq(L('implFor({ impl: "m:p1" }, eq2)'), 'm:p1', 'ejercicio con máquina propia');
eq(L('implFor({ impl: "m:zz" }, eq2)'), null, 'máquina borrada → falta equipo');
eq(L('weightSteps(eq2, "m:p1")'), [5, 7.5, 10, 12.5, 15, 17.5, 20], 'pesos de la máquina de a 2,5');
ok(L('Object.values(EXERCISES).filter((e) => e.cat).every((e) => CATS[e.cat])'), 'cada ejercicio de la biblioteca tiene categoría válida');

// Mancuernas de discos
ctx.pl = { bar: 2, items: [{ kg: 5, n: 4 }, { kg: 2.5, n: 4 }, { kg: 1.25, n: 4 }] };
eq([...L('plateCombos(pl)').keys()].sort((a, b) => a - b), [2, 4.5, 7, 9.5, 12, 14.5, 17, 19.5], 'barra 2 kg + discos de 5, 2,5 y 1,25 (4 de cada uno): pesos posibles');
eq(L('plateCombos(pl).get(9.5)'), [2.5, 1.25], '9,5 kg = 2,5 + 1,25 por lado');
ctx.eqp = { db: { min: 2, max: 24, step: 2, plates: { ...ctx.pl, on: true } }, kb: [] };
eq(L('weightSteps(eqp, "db")').length, 8, 'con discos, los pasos salen de las combinaciones');
eq(L('platesFor(eqp, 12)'), [5], '12 kg = un disco de 5 por lado');
eq(L('platesFor({ db: { min: 2, max: 24, step: 2 } }, 12)'), null, 'sin modo discos no hay cálculo');
ctx.pl8 = { bar: 2, items: [{ kg: 2.5, n: 8 }] };
eq([...L('plateCombos(pl8)').keys()].sort((a, b) => a - b), [2, 7, 12], '8 discos de 2,5: hasta 2 por lado');

// Estimación de peso
ctx.man = { sex: 'h', weight: 80, age: 30, exp: 'novato' };
ctx.woman = { sex: 'm', weight: 60, age: 30, exp: 'novato' };
const sw = (p, ex, impl) => L(`startWeight(${p}, EXERCISES.${ex}, weightSteps(equip, '${impl}'))`);
eq(sw('man', 'press_suelo', 'db'), 8, 'hombre 80 kg novato: press en el suelo arranca con 8 kg por mano');
eq(sw('man', 'goblet', 'kb'), 12, 'goblet arranca con la pesa rusa de 12');
eq(sw('man', 'lateral', 'db'), 2, 'elevaciones laterales arrancan con 2 kg');
ok(sw('woman', 'press_suelo', 'db') < sw('man', 'press_suelo', 'db'), 'mujer de 60 kg arranca más liviano');
ok(L('estimate1RM({ ...man, exp: "medio" }, EXERCISES.rdl)') > L('estimate1RM(man, EXERCISES.rdl)'), 'más experiencia → más peso estimado');
ok(L('estimate1RM({ ...man, age: 55 }, EXERCISES.rdl)') < L('estimate1RM(man, EXERCISES.rdl)'), 'más edad → menos peso estimado');

// Pesos automáticos: lo levantado en un ejercicio ajusta la estimación de los demás
L('var exOf = (id) => EXERCISES[id]');
eq(L('strengthScale(man, {}, exOf)'), 0, 'sin datos no hay escala');
const est = (ex) => L(`estimate1RM(man, EXERCISES.${ex})`);
ok(Math.abs(L(`strengthScale(man, { goblet: { w: 1, e1rm: ${est('goblet') * 1.5} } }, exOf)`) - 1.5) < 1e-9, 'escala = 1RM anotado / estimado');
eq(L(`strengthScale(man, { goblet: { e1rm: ${est('goblet') * 1.2} }, rdl: { e1rm: ${est('rdl') * 2} }, lateral: { e1rm: ${est('lateral') * 0.8} } }, exOf)`), 1.2, 'con varios ejercicios usa la mediana');
eq(L(`strengthScale(man, { goblet: { e1rm: ${est('goblet') * 50} } }, exOf)`), 3, 'un dato disparatado queda acotado');
const gw = (scale) => L(`guessWeight(man, EXERCISES.press_suelo, weightSteps(equip, "db"), undefined, ${scale})`);
eq(gw(0), sw('man', 'press_suelo', 'db'), 'sin escala, el peso estimado es el de siempre (70 %)');
ok(gw(1.5) > gw(0) && gw(0.5) <= gw(0), 'más fuerte que lo estimado → sugiere más; más débil → no más');

// Calibración: 8 kg × 10 reps con 4 en reserva → 1RM ≈ 11,7 → trabajo (10 reps, RIR 2) ≈ 8,4 → 8 kg
eq(L('calibrate(8, 10, 4, weightSteps(equip, "db"))'), { e1rm: 11.7, w: 8 }, 'calibración con Epley');
eq(L('calibrate(8, 28, 2, weightSteps(equip, "db"))').w, 10, 'si hizo muchas reps, sube el peso de trabajo');
eq(L('calibrate(8, 6, 0, weightSteps(equip, "db"))').w, 6, 'si apenas llegó a 6, baja el peso de trabajo');

// Doble progresión
const steps = '[2,4,6,8,10,12]';
eq(L(`progress(8, [{reps:12},{reps:12},{reps:12}], ${steps})`), 10, '12 en todas las series → sube un salto');
eq(L(`progress(8, [{reps:12},{reps:10},{reps:9}], ${steps})`), 8, 'dentro del rango → mismo peso');
eq(L(`progress(8, [{reps:9},{reps:7}], ${steps})`), 6, 'alguna por debajo de 8 → baja un salto');

// Doble progresión con rango propio del ejercicio
eq(L(`progress(8, [{reps:20},{reps:20},{reps:20}], ${steps}, [12, 20])`), 10, 'rango 12–20: 20 en todas → sube');
eq(L(`progress(8, [{reps:20},{reps:20},{reps:19}], ${steps}, [12, 20])`), 8, 'rango 12–20: 20/20/19 → mismo peso');
eq(L(`progress(8, [{reps:12},{reps:12},{reps:12}], ${steps}, [12, 20])`), 8, 'rango 12–20: 12/12/12 (el mínimo) → mismo peso');
eq(L(`progress(8, [{reps:15},{reps:11}], ${steps}, [12, 20])`), 6, 'rango 12–20: alguna por debajo de 12 → baja');
eq(L(`progress(8, [{reps:0},{reps:0}], ${steps}, [6, 12])`), 8, 'rango 6–12: sin reps hechas → mismo peso');
eq(L(`progress(8, [{reps:12},{reps:12}], ${steps}, [8, 12])`), L(`progress(8, [{reps:12},{reps:12}], ${steps})`), 'rango 8–12 = sin rango');
const calSteps = 'weightSteps(equip, "db")';
const calTarget = (reps) => L(`roundDown(${calSteps}, weightForReps(epley1RM(8, 14), ${reps}))`);
eq(L(`calibrate(8, 10, 4, ${calSteps}, [12, 20])`).w, calTarget(18), 'calibración 12–20 apunta a 18 reps');
eq(L(`calibrate(8, 10, 4, ${calSteps}, [10, 15])`).w, calTarget(15), 'calibración 10–15 apunta a 15 reps');
eq(L(`calibrate(8, 10, 4, ${calSteps}, [6, 12])`).w, calTarget(11), 'calibración 6–12 apunta a 11 reps');
eq(L(`calibrate(8, 10, 4, ${calSteps}, [8, 12])`), L(`calibrate(8, 10, 4, ${calSteps})`), 'calibración 8–12 = sin rango');
eq(L('repCenter([10, 15])'), 13, 'centro de 10–15 redondea a 13');
eq(L('repCenter([8, 12])'), 10, 'centro de 8–12 es 10');
eq(L('repRange({ reps: [12, 20] })'), [12, 20], 'repRange toma el rango del ejercicio');
eq(L('repRange({}, { reps: [6, 8] })'), [6, 8], 'repRange prefiere el rango del hueco');
eq(L('noviceRange([6, 12])'), [7, 11], 'novato: 6–12 se achica a 7–11');
eq(L('noviceRange([12, 20])'), [14, 18], 'novato: 12–20 se achica a 14–18');
eq(L('noviceRange([6, 8])'), [6, 8], 'novato: un rango ya chico no cambia');
const startWithRange = (range) => L(`startWeight(man, EXERCISES.press_suelo, ${calSteps}${range ? `, ${range}` : ''})`);
eq(startWithRange('[8, 12]'), startWithRange(), 'startWeight con 8–12 = sin rango');
ok(startWithRange('[12, 20]') <= startWithRange('[8, 12]'), 'startWeight con 12–20 no supera al de 8–12');
eq(L(`painCap(10, ${steps})`), 6, 'modo dolor: 60 % redondeado hacia abajo');

// Modo dolor
const T = '2026-10-20';
ctx.st = { painMode: true, zones: { codo_lat: { phase: 1, since: '2026-10-01' } }, sessions: [], checks: [] };
eq(L(`restriction(st, EXERCISES.curl_martillo, '${T}')`), { zones: ['codo_lat'], mode: 'cap', flare: false }, 'curl martillo con codo en fase 1 → al 60 %');
eq(L(`restriction(st, EXERCISES.goblet, '${T}')`), null, 'la sentadilla no exige el codo → sin restricción');
L(`st.sessions.push({ date: '2026-10-19', pain: { codo_lat: 6 } })`);
eq(L(`restriction(st, EXERCISES.curl_martillo, '${T}')`).mode, 'alt', 'dolor > 4 ayer → variante amable');
eq(L(`restriction({ ...st, painMode: false }, EXERCISES.curl_martillo, '${T}')`), null, 'con el modo dolor apagado no hay restricciones');
eq(L(`pendingChecks(st, '${T}')`), ['codo_lat'], 'pregunta cómo amaneció si ayer hubo dolor registrado');
L(`st.checks.push({ date: '${T}', zone: 'codo_lat', val: 'igual' })`);
eq(L(`pendingChecks(st, '${T}')`), [], 'no vuelve a preguntar el mismo día');

// Carga de los isométricos
const z = '{ load: 4, secs: 45 }';
eq(L(`isoAdjust(${z}, EXERCISES.iso_ext_muneca, ${steps}, 2, false)`).load, 6, 'dolor ≤ 2 y no peor → sube un salto');
eq(L(`isoAdjust(${z}, EXERCISES.iso_ext_muneca, ${steps}, 5, false)`).load, 2, 'dolor > 4 → baja un salto');
eq(L(`isoAdjust(${z}, EXERCISES.iso_ext_muneca, ${steps}, 3, true)`).load, 2, 'amaneció peor → baja un salto');
eq(L(`isoAdjust(${z}, EXERCISES.iso_ext_muneca, ${steps}, 3, false)`).load, 4, 'dolor 3 → se mantiene');
eq(L(`isoAdjust({ load: 2, secs: 45 }, EXERCISES.iso_ext_muneca, ${steps}, 6, false)`).secs, 35, 'en el mínimo de peso, baja el tiempo');
eq(L(`isoAdjust({ load: 0, secs: 45 }, EXERCISES.iso_pared, [], 1, false)`).secs, 50, 'sin peso: sube 5 s');
eq(L(`isoAdjust({ load: 0, secs: 60 }, EXERCISES.iso_talones, ${steps}, 1, false)`), { load: 2, secs: 45 }, 'puntas de pie: después de 60 s agrega mancuernas');
eq(L(`isoAdjust({ load: 2, secs: 45 }, EXERCISES.iso_talones, ${steps}, 6, false)`).load, 0, 'puntas de pie: con dolor vuelve a sin peso');

// Avance de fase
ctx.ph = { painMode: true, zones: { codo_lat: { phase: 1, since: '2026-10-01' } }, checks: [],
  sessions: ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'].map((d) => ({ date: d, pain: { codo_lat: 2 } })) };
ok(L(`phaseReady(ph, 'codo_lat', '${T}')`), 'lista para avanzar: 19 días en fase, 6 registros ≤ 3');
L(`ph.sessions[0].pain.codo_lat = 4`);
ok(!L(`phaseReady(ph, 'codo_lat', '${T}')`), 'un registro de 4 en la semana la frena');
L(`ph.sessions[0].pain.codo_lat = 2; ph.zones.codo_lat.since = '2026-10-15'`);
ok(!L(`phaseReady(ph, 'codo_lat', '${T}')`), 'menos de 10 días en la fase la frena');

// Volumen: +30 % máx por semana
eq(L(`weekBudget({}, 2, 6, '${T}')`).budget, 36, '2 días × 6 ejercicios × 3 series = 36');
eq(L(`weekBudget({ budget: 36, week: '2026-10-19' }, 3, 6, '${T}')`).budget, 36, 'cambiar a 3 días a mitad de semana no sube el volumen');
eq(L(`weekBudget({ budget: 36, week: '2026-10-12' }, 3, 6, '${T}')`).budget, 46, 'semana nueva: 36 × 1,3 = 46');
eq(L(`weekBudget({ budget: 46, week: '2026-10-12' }, 3, 6, '${T}')`).budget, 54, 'y después llega al objetivo de 54');
eq(L('setsPerExercise(36, 2, 6)'), [3, 3, 3, 3, 3, 3], '36 series en 2 días = 3 por ejercicio');
eq(L('setsPerExercise(36, 3, 6)'), [2, 2, 2, 2, 2, 2], 'mismas 36 en 3 días = 2 por ejercicio');
eq(L('setsPerExercise(46, 3, 6)').reduce((a, b) => a + b) * 3, 45, '46 en 3 días ≈ 45 (compuestos primero)');

// Entrada en calor
eq(L(`warmupSets(10, ${steps})`), [{ w: 4, reps: 8 }, { w: 6, reps: 4 }], 'aproximación para 10 kg: 4 × 8 y 6 × 4');
eq(L(`warmupSets(2, ${steps})`), [], 'con el peso mínimo no hay aproximación');
eq(L(`warmupSets(10, ${steps}, true)`), [{ w: 6, reps: 6 }], 'aproximación corta para la otra mitad: 6 × 6');
eq(L('warmupMoves([EXERCISES.press_banco, EXERCISES.curl_martillo]).map((x) => x.t)'), ['Activar', 'Hombros y brazos'], 'día de torso: solo movilidad de arriba');
eq(L('warmupMoves([EXERCISES.goblet, EXERCISES.talones_lenta]).map((x) => x.t)'), ['Activar', 'Cadera y piernas'], 'día de pierna: solo movilidad de abajo');
ok(L('warmupMoves([EXERCISES.goblet, EXERCISES.talones_lenta])[1].d').includes('puntas de pie'), 'con gemelos suma rebotes en puntas');
eq(L('warmupMoves([EXERCISES.plancha]).length'), 3, 'sin mitad clara: las dos movilidades');
eq(L('bodyHalf(EXERCISES.rdl)'), 'lower', 'peso muerto rumano es de la mitad de abajo');

// Estancamiento y día de la semana
const ses = (w, reps) => `{ type: 'entreno', items: [{ ex: 'rdl', sets: [{ w: ${w}, reps: ${reps[0]} }, { w: ${w}, reps: ${reps[1]} }] }] }`;
ctx.stA = L(`({ sessions: [${ses(10, [9, 8])}, ${ses(10, [9, 9])}, ${ses(10, [10, 8])}] })`);
ok(L('stalled(stA, "rdl")'), '3 sesiones con 10 kg sin sumar repeticiones → estancado');
ctx.stB = L(`({ sessions: [${ses(10, [11, 10])}, ${ses(10, [9, 9])}, ${ses(10, [10, 8])}] })`);
ok(!L('stalled(stB, "rdl")'), 'si las repeticiones suben, no está estancado');
ctx.stC = L(`({ sessions: [${ses(12, [8, 8])}, ${ses(10, [12, 12])}, ${ses(10, [10, 8])}] })`);
ok(!L('stalled(stC, "rdl")'), 'si subió el peso, no está estancado');
eq(L(`weekdayKey('${T}')`), 'ma', 'el 20/10/2026 es martes');

// Semana, racha y resumen
ctx.wk = { painMode: true, profile: { days: 2 }, zones: { codo_lat: { phase: 1 } }, sessions: [
  { date: '2026-10-19', type: 'entreno' }, { date: '2026-10-20', type: 'rehab' }, { date: '2026-10-20', type: 'rehab' },
  { date: '2026-10-13', type: 'entreno' }, { date: '2026-10-15', type: 'entreno' }, { date: '2026-10-07', type: 'entreno' }, { date: '2026-10-09', type: 'entreno' }] };
eq(L(`weekStats(wk, '${T}')`), { train: 1, target: 2, rehab: 2, rehabTarget: 14 }, 'semana: 1 de 2 entrenos, 2 de 14 rehabs (fase 1)');
eq(L(`streak(wk, '${T}')`), 2, 'racha: las 2 semanas anteriores cumplidas (la actual todavía no)');
L(`wk.sessions.push({ date: '2026-10-21', type: 'entreno' })`);
eq(L(`streak(wk, '${T}')`), 3, 'al cumplir la semana actual, la racha suma');
eq(L(`sessionSummary({ items: [{ sets: [{ w: 10, reps: 10 }, { w: 10, reps: 8 }] }, { sets: [{ secs: 30 }] }] }, 25 * 60000)`), { sets: 3, vol: 180, min: 25 }, 'resumen: series, volumen y minutos');

// Calendario
const ics = L(`icsText({ am: '08:00', pm: '20:00', train: ['lu', 'ju'], trainAt: '19:00' }, true, '${T}')`);
ok(ics.includes('RRULE:FREQ=DAILY') && ics.includes('DTSTART:20261020T080000'), 'ics con isométricos diarios a las 8');
ok(ics.includes('BYDAY=MO,TH') && ics.includes('\r\n'), 'ics con entreno lunes y jueves (CRLF)');
ok(!L(`icsText({ am: '08:00', pm: '20:00', train: [], trainAt: '19:00' }, false, '${T}')`).includes('VEVENT'), 'sin modo dolor ni días, no hay eventos');

// Bocetos
const ids = L('Object.keys(EXERCISES)');
ok(ids.every((id) => L(`figureSVG(EXERCISES.${id}).startsWith('<svg')`)), `los ${ids.length} ejercicios tienen ilustración`);
ok(L('figureSVG(EXERCISES.goblet).includes("<animate")') && !L('figureSVG(EXERCISES.goblet, { animate: false }).includes("<animate")'), 'ilustraciones animadas y estáticas');
ok(ids.every((id) => L(`EXERCISES.${id}.mus.length && EXERCISES.${id}.mus.every((m) => MUSCLE_NAMES[m])`)), 'cada ejercicio dice qué músculos trabaja');
ok(L('figureSVG(EXERCISES.curl_martillo).includes("#E5262E")') && !L('figureSVG(EXERCISES.curl_martillo, { muscles: false }).includes("#E5262E")'), 'el músculo trabajado se ilumina en rojo (y se puede apagar)');
ok(L('figureSVG(EXERCISES.lateral).includes(PAL.db) && figureSVG(EXERCISES.lateral).includes(PAL.floor)'), 'mancuernas en 3D sobre el piso isométrico');
ok(L('figureSVG(EXERCISES.press_suelo).split(PAL.db).length') > L('figureSVG(EXERCISES.remo_silla).split(PAL.db).length'), 'con las dos manos libres hay dos mancuernas; en el remo a un brazo, una');
ok(L('Object.values(EXERCISES).every((e) => !/NaN|undefined/.test(figureSVG(e)) && !/NaN|undefined/.test(figureSVG(e, { crop: true })))'), 'ninguna ilustración tiene coordenadas inválidas');
// Músculos en todas las animaciones: no desaparecen, no se hinchan y los miembros no se acortan entre fotogramas.
// Miran al piso y se ven asomando por el borde (vis baja, pero con ancho): el pecho y el abdomen en plancha y flexiones,
// y el tríceps abajo en los press acostados (el codo apoyado y abierto).
const MUS_EXC = new Set(['plancha abs', 'flexiones chest', 'press_suelo triceps', 'press_banco triceps']);
const stats = L(`Object.values(EXERCISES).map((e) => [e.id, muscleStats(e)])`);
const bad = (fn, onlyPrimary) => stats.flatMap(([id, st]) => st.muscles.filter((m) => (!onlyPrimary || m.primary) && !MUS_EXC.has(id + ' ' + m.m) && m.frames.some((p, i) => p && fn(p, m.frames[i - 1]))).map((m) => id + ' ' + m.m));
let issues = bad((p) => p.vis < 0.15, true);
ok(!issues.length, `el músculo trabajado se ve en todos los fotogramas ${issues.join(', ')}`);
issues = stats.flatMap(([id, st]) => st.muscles.filter((m) => m.primary && m.frames.some((p) => p && p.w < 0.2)).map((m) => id + ' ' + m.m));
ok(!issues.length, `el músculo principal nunca desaparece, ni siquiera si mira al piso ${issues.join(', ')}`);
issues = bad((p) => p.w > Math.max(0.32 * p.len / p.R, 0.31) || Math.abs(p.o) + p.w > 0.93);
ok(!issues.length, `los músculos no se hinchan ni se salen del contorno ${issues.join(', ')}`);
issues = bad((p, prev) => prev && prev.w > 0.1 && Math.abs(p.w * p.R - prev.w * prev.R) > 0.3 * prev.w * prev.R + 0.4);
ok(!issues.length, `el ancho del músculo cambia de a poco entre fotogramas ${issues.join(', ')}`);
const lenVar = L(`Object.values(EXERCISES).filter((e) => e.fig.b).map((e) => { const { FR } = framesOf(e.fig); const segs = FR.map((J) => ['ua', 'fa', 'th', 'sh'].map((k) => { const s = segOf(k, J, '1'); return s ? Math.hypot(...sub3(s[1], s[0])) : 0; })); const A = segs[0], B = segs[segs.length - 1]; return [e.id, segs.every((sg) => sg.every((x, k) => x >= Math.min(A[k], B[k]) * 0.98 - 0.05 && x <= Math.max(A[k], B[k]) * 1.02 + 0.05))]; })`);
issues = lenVar.filter(([, okk]) => !okk).map(([id]) => id);
ok(!issues.length, `brazos y piernas no se acortan a mitad del movimiento (interpolación por ángulos) ${issues.join(', ')}`);
ok(L(`figureSVG(EXERCISES.curl_martillo).includes('keyTimes="0;0.083')`), 'la animación usa fotogramas intermedios');
ok(L(`muscleStats(EXERCISES.rdl).yaw < 0 && muscleStats(EXERCISES.lateral).yaw === 65 && muscleStats(EXERCISES.curl_martillo).yaw === 40`), 'la cámara gira para mostrar isquios y glúteos (peso muerto), es más frontal en los dibujados de frente y queda en 40° en el resto');
// Articulaciones: en ningún fotograma un codo o una rodilla se dobla para el lado imposible (más de 12°).
const disl = L(`Object.values(EXERCISES).filter((e) => !e.fig.front).flatMap((e) => framesOf(e.fig).FR.flatMap((J) => ['1', '2'].flatMap((n) => [['S', 'E', 'W', 1, 'codo'], ['Hp', 'K', 'F', -1, 'rodilla']].filter(([a, b, c, sg]) => {
  if (!J[a + n] || !J[b + n] || !J[c + n]) return false;
  const D = unit3(sub3(J[b + n], J[a + n])), F = unit3(sub3(J[c + n], J[b + n]));
  if (Math.abs(D[2]) > 0.5 || Math.abs(F[2]) > 0.5) return false;
  return dot3(F, unit3([-D[1], D[0], 0])) * sg < -0.21;
}).map(([, , , , name]) => e.id + ' ' + name))))`);
ok(!disl.length, `ningún codo ni rodilla se dobla al revés ${[...new Set(disl)].join(', ')}`);
ok(L('framesOf(EXERCISES.remo_aros.fig).FR.every((J) => J.fw[1] > 0)'), 'en el remo invertido el personaje está boca arriba');
ok(L('framesOf(EXERCISES.ext_muneca_lenta.fig).FR.every((J, i, all) => Math.abs(J.W1[1] - all[0].W1[1]) < 0.5)'), 'en la extensión de muñeca se mueve la mano y el antebrazo queda apoyado');
ok(L(`framesOf(EXERCISES.prono_lenta.fig).FR.length > 1 && !figureSVG(EXERCISES.prono_lenta).includes('values="1;0;1')`), 'en la pronación y supinación la mancuerna gira (no aparece y desaparece)');
ok(Object.values(L('REHAB')).every((p) => L(`EXERCISES['${p[1]}'] && EXERCISES['${p[2]}']`)), 'cada zona tiene ejercicios de fase 1 y 2');
ok(L('Object.values(REHAB_OPTIONS).every((z) => [1, 2].every((f) => z[f].length && z[f].every((id) => EXERCISES[id] && EXERCISES[id].zone !== undefined || EXERCISES[id].tag)))'), 'las opciones de rehabilitación existen');
ok(L('Object.entries(REHAB).every(([z, p]) => REHAB_OPTIONS[z][1][0] === p[1] && REHAB_OPTIONS[z][2][0] === p[2])'), 'la primera opción de cada fase es la del protocolo base');
ok(Object.values(L('TEMPLATES')).flat().every((id) => L(`!!EXERCISES['${id}']`)), 'las plantillas usan ejercicios existentes');

// ——— Catálogos de planes ———
const SLOT_IDS = ['empuje_h', 'empuje_inc', 'empuje_v', 'traccion_v', 'traccion_h', 'rodilla', 'unilateral', 'bisagra', 'gluteo', 'gemelos',
  'lateral', 'deltoides_post', 'biceps', 'triceps', 'abdominal', 'isometrico'];
eq(L('Object.keys(SLOTS)'), SLOT_IDS, 'SLOTS tiene los 16 patrones en orden');
ok(L('Object.values(SLOTS).every((s) => s.name && s.ex.length && s.ex.every((id) => !!EXERCISES[id]))'), 'cada hueco tiene nombre, lista no vacía e ids existentes');
eq(L('["empuje_h", "empuje_inc"].filter((k) => SLOTS[k].ex.includes("flexiones")).length'), 2, 'flexiones figura en empuje_h y empuje_inc');
const REP_TYPES = {
  compuesto: ['goblet', 'sumo_kb', 'press_suelo', 'press_banco', 'flexiones', 'press_hombros', 'remo_silla', 'remo_aros', 'remo_inclinado',
    'dominadas', 'rdl', 'swing', 'pm_una_pierna', 'zancada', 'bulgara', 'hip_thrust', 'puente'],
  aislamiento: ['curl_martillo', 'curl_concentrado', 'triceps', 'patada_triceps', 'press_frances', 'pullover', 'elev_frontal', 'gemelos_1pierna'],
  deltoides: ['lateral', 'face_pull', 'rot_ext_banda'],
};
Object.entries(REP_TYPES).forEach(([type, ids]) => ids.forEach((id) => eq(L(`EXERCISES.${id}.reps`), L(`REP_RANGE.${type}`), `${id}: rango de ${type}`)));
eq(L('REP_RANGE'), { compuesto: [6, 12], aislamiento: [10, 15], deltoides: [12, 20], abdominal: [10, 15] }, 'REP_RANGE: rangos por tipo');
ok(L('EXERCISES.lateral.reps !== REP_RANGE.deltoides'), 'cada ejercicio recibe una copia del rango, no el arreglo compartido');
eq(L('[...new Set(Object.values(SLOTS).flatMap((s) => s.ex))].filter((id) => !EXERCISES[id].reps).sort()'),
  ['curl_iso', 'dead_bug', 'iso_pared', 'plancha', 'remo_aros_iso', 'sentadilla_pared'], 'sin rango solo los por tiempo, isométricos y dead_bug');
eq(L('repRange(EXERCISES.dead_bug)'), [8, 12], 'dead_bug usa 8–12 por defecto');
eq(L('repRange({})'), [8, 12], 'ejercicio propio sin rango usa 8–12');
eq(L('Object.keys(PLANS)'), ['fb2', 'fb3', 'tp4', 'gr5', 'fb1', 'ppl6'], 'catálogo: dos de cuerpo completo, dos por grupos y dos solo para el plan a tu medida');
eq(L('Object.values(PLANS).filter((p) => PLAN_KINDS[p.kind]).map((p) => p.id)'), ['fb2', 'fb3', 'tp4', 'gr5'], 'la lista muestra 4 planes; fb1 y ppl6 los arma el plan a tu medida');
eq(L('Object.entries(PLAN_BY_DAYS).map(([n, id]) => PLANS[id].days.length === Number(n))'), [true, true, true, true, true, true], 'a tu medida: de 1 a 6 días, cada cantidad da un plan con esa cantidad de días');
ok(L('Object.values(PLANS).every((p) => (PLAN_KINDS[p.kind] || p.kind === "medida") && p.week.length === p.days.length && p.days.every((d) => d.short && d.slots.every((s) => !!SLOTS[s.slot])))'),
  'cada plan tiene tipo, un día de semana por día del plan, sigla y huecos existentes');
for (const id of ['fb3', 'tp4', 'gr5', 'fb1', 'ppl6']) {
  ok(L(`resolvePlan(PLANS.${id}, defEq).every((d) => d.every((it) => possible(it.ex, defEq)))`), `${id}: con mancuernas solas se arman todos los ejercicios`);
  ok(L(`resolvePlan(PLANS.${id}, defEq).every((d) => new Set(d.map((it) => it.ex)).size === d.length)`), `${id}: ningún ejercicio se repite en el mismo día`);
  ok(L(`resolvePlan(PLANS.${id}, fullEq).every((d) => d.every((it) => possible(it.ex, fullEq)))`), `${id}: con todo el equipo se arman todos los ejercicios`);
}
eq(L('PLANS.fb2.name'), 'Full body 2 días', 'nombre de fb2');
eq(L('PLANS.fb2.days.map((d) => d.name)'), ['Día A', 'Día B'], 'fb2 tiene los días A y B');
ok(L('PLANS.fb2.days.every((d) => d.slots.length === 6 && d.slots.every((s) => s.sets === 3))'), 'fb2: 6 huecos por día, 3 series cada uno');
ok(!!L('PLANS.fb2.source'), 'fb2 tiene fuente');
eq(L('PLANS.fb2.days.map((d) => d.slots.map((s) => s.slot))'), [
  ['rodilla', 'empuje_h', 'traccion_h', 'bisagra', 'lateral', 'abdominal'],
  ['unilateral', 'empuje_v', 'traccion_h', 'bisagra', 'biceps', 'triceps'],
], 'fb2 sigue el orden de huecos de A y B');
eq(L('PLANS.fb2.days.map((d) => d.slots.filter((s) => s.ex).map((s) => s.ex))'), [['remo_silla', 'rdl'], ['remo_aros', 'swing']], 'fb2: preferencias de los huecos repetidos');
ok(L('PLANS.fb2.days.every((d) => d.slots.every((s) => !!SLOTS[s.slot]))'), 'los huecos de fb2 existen en SLOTS');

// ——— Motor de planes ———
const exIds = (expr) => L(`(${expr}).map((it) => it.ex)`);
const B_NO_RINGS = L('TEMPLATES.B').map((id) => (id === 'remo_aros' ? 'remo_silla' : id));
ctx.noEq = { ...defEq, db: null };

// Resolver el plan con el equipo por defecto = lo que hoy arma la app para A y B
eq(exIds('resolvePlan(PLANS.fb2, defEq)[0]'), L('TEMPLATES.A'), 'fb2 con equipo por defecto: Día A = TEMPLATES.A');
eq(exIds('resolvePlan(PLANS.fb2, defEq)[1]'), B_NO_RINGS, 'fb2 sin aros: Día B = TEMPLATES.B con remo en silla');
eq(exIds('resolvePlan(PLANS.fb2, { ...defEq, rings: true })[1]'), L('TEMPLATES.B'), 'fb2 con aros: Día B = TEMPLATES.B tal cual');
ok(L('resolvePlan(PLANS.fb2, defEq).flat().every((it) => it.pinned === false && it.slot)'), 'resolvePlan deja todo sin fijar y con hueco');
eq(L('resolvePlan(PLANS.fb2, noEq)[0][4]'), { slot: 'lateral', ex: 'lateral', pinned: false }, 'resolvePlan: hueco sin posible guarda su primer ejercicio (Falta equipo)');
eq(L('resolvePlan(PLANS.fb2, noEq)[0][2].ex'), 'remo_silla', 'resolvePlan: hueco sin posible guarda la preferencia del plan');

// resolveSlot: primer posible, bw, exclude y preferencia
eq(L('resolveSlot("empuje_h", fullEq)'), 'press_banco', 'resolveSlot con todo el equipo: el primero del hueco');
eq(L('resolveSlot("empuje_h", defEq)'), 'press_suelo', 'resolveSlot sin banco: saltea press en banco');
eq(L('resolveSlot("deltoides_post", noDb)'), null, 'resolveSlot sin banda ni mancuernas: ningún posible → null');
eq(L('resolveSlot("deltoides_post", defEq)'), 'pajaros', 'resolveSlot sin banda: pájaros con mancuernas');
eq(L('resolveSlot("empuje_h", defEq, { bw: true })'), 'flexiones', 'bw: saltea mancuernas y da peso corporal');
eq(L('resolveSlot("lateral", fullEq, { bw: true })'), null, 'bw en un hueco sin peso corporal → null');
eq(L('resolveSlot("bisagra", defEq, { exclude: ["rdl"] })'), 'swing', 'exclude: [primero] → el siguiente posible');
eq(L('resolveSlot("bisagra", defEq, { pref: "pm_una_pierna" })'), 'pm_una_pierna', 'la preferencia se prueba primero');
eq(L('resolveSlot("traccion_h", defEq, { pref: "remo_aros" })'), 'remo_silla', 'preferencia imposible → sigue por el hueco');
eq(L('resolveSlot("bisagra", defEq, { pref: "swing", exclude: ["swing"] })'), 'rdl', 'una preferencia excluida se saltea');
ok(L('(() => { try { resolveSlot("zzz", fullEq); return false; } catch (e) { return /zzz/.test(e.message); } })()'), 'hueco inexistente → error');
ok(L('(() => { try { resolvePlan({ days: [{ slots: [{ slot: "zzz" }] }] }, fullEq); return false; } catch (e) { return true; } })()'), 'resolvePlan con hueco inexistente también falla');

// possible: la única regla es implFor, y los propios se buscan con getEx
ok(L('possible("remo_aros", defEq)') === false && L('possible("remo_aros", { ...defEq, rings: true })'), 'possible: remo en aros solo con aros');
ok(L('possible("press_banco", fullEq) === !!implFor(EXERCISES.press_banco, fullEq)'), 'possible coincide con implFor');
ok(!L('possible("press_banco", defEq)') && L('possible("press_banco", { ...defEq, bench: true })'), 'possible: press en banco solo con banco');
ok(!L('possible("c_x", defEq)'), 'possible: propio desconocido → no');
ok(L('possible("c_x", defEq, () => ({ impl: "bw" }))'), 'possible: propio buscado con getEx');

// resolveDay: lo posible queda igual (misma referencia) y la entrada no se modifica
ctx.keepDay = [{ slot: 'empuje_h', ex: 'press_suelo', pinned: true }, { slot: 'rodilla', ex: 'goblet', pinned: false }];
ctx.rdKeep = L('resolveDay(keepDay, defEq)');
ok(L('rdKeep.items[0] === keepDay[0] && rdKeep.items[1] === keepDay[1]'), 'resolveDay: fijado y no fijado posibles quedan iguales');
ok(L('!rdKeep.changed && rdKeep.notices.length === 0'), 'resolveDay: sin cambios ni avisos');
ok(L('resolveDay(keepDay, { ...defEq, bench: true }).items[0] === keepDay[0]'), 'resolveDay: al agregar banco, el press en el suelo no se "mejora"');
ctx.upgDay = [{ slot: 'empuje_h', ex: 'press_suelo', pinned: false }];
ctx.rdUpg = L('resolveDay(upgDay, { ...defEq, bench: true })');
ok(L('rdUpg.items[0] === upgDay[0] && !rdUpg.changed'), 'resolveDay: no fijado posible queda igual aunque con banco el preferido del hueco pase a ser posible');
ctx.ghostDay = [{ slot: 'zzz', ex: 'press_banco', pinned: true }];
ctx.rdGhost = L('resolveDay(ghostDay, defEq)');
ok(L('rdGhost.items[0] === ghostDay[0] && !rdGhost.changed && rdGhost.notices.length === 0'), 'resolveDay: hueco inexistente en SLOTS se trata como sin hueco (por referencia, sin aviso)');
ctx.mixDay = [{ slot: 'empuje_h', ex: 'press_suelo', pinned: false }, { slot: 'empuje_h', ex: 'press_banco', pinned: true },
  { slot: 'traccion_h', ex: 'remo_aros', pinned: false }, { slot: null, ex: 'c_x', pinned: true }];
const mixBefore = structuredClone(L('mixDay'));
ctx.rdMix = L('resolveDay(mixDay, defEq)');
eq(L('mixDay'), mixBefore, 'resolveDay no modifica el arreglo recibido');
ok(L('rdMix.items !== mixDay'), 'resolveDay devuelve un arreglo nuevo');

// resolveDay: los no fijados imposibles se re-resuelven sin repetir ejercicios en el día
eq(L('rdMix.items[2]'), { slot: 'traccion_h', ex: 'remo_silla', pinned: false }, 'no fijado imposible → primer posible del hueco');
eq(L('rdMix.items[1].ex'), 'flexiones', 'el reemplazo saltea press en el suelo, que ya está en el día');
eq(exIds('rdMix.items').length, new Set(exIds('rdMix.items')).size, 'el día no queda con ejercicios repetidos');
ok(L('rdMix.items[3] === mixDay[3]'), 'un ítem sin hueco (propio) imposible queda tal cual');
ok(L('rdMix.changed'), 'resolveDay marca changed cuando reemplaza');
eq(L('resolveDay([{ slot: "empuje_h", ex: "press_banco", pinned: false }], defEq).notices'), [], 'reemplazar un no fijado no avisa');
eq(L('resolveDay([{ slot: "traccion_h", ex: "remo_silla", pinned: false }, { slot: "traccion_h", ex: "remo_aros", pinned: false }], defEq).items[1].ex'),
  'remo_inclinado', 'dos remos en el mismo día: el segundo pasa al siguiente posible');

// resolveDay: un fijado imposible se re-resuelve y avisa una sola vez
ctx.rdPin = L('resolveDay([{ slot: "empuje_h", ex: "press_banco", pinned: true }], defEq)');
eq(L('rdPin.items'), [{ slot: 'empuje_h', ex: 'press_suelo', pinned: false }], 'fijado imposible → se re-resuelve y queda sin fijar');
eq(L('rdPin.notices'), [{ from: 'press_banco', to: 'press_suelo' }], 'fijado imposible → un aviso');
eq(L('resolveDay(rdPin.items, defEq)'), { items: [{ slot: 'empuje_h', ex: 'press_suelo', pinned: false }], notices: [], changed: false }, 'segunda pasada: sin aviso ni cambios');
ctx.rdPinMissing = L('resolveDay([{ slot: "deltoides_post", ex: "face_pull", pinned: true }], noDb)');
eq(L('rdPinMissing.notices'), [{ from: 'face_pull', to: null }], 'fijado sin reemplazo posible → aviso con to null');
eq(L('rdPinMissing.items[0]'), { slot: 'deltoides_post', ex: 'face_pull', pinned: false }, 'fijado sin reemplazo: mismo ejercicio, sin fijar');
eq(L('resolveDay(rdPinMissing.items, noDb).notices'), [], 'fijado sin reemplazo: la segunda pasada no avisa');

// Hueco sin ejercicio posible: el ítem se conserva y la app lo muestra como "Falta equipo"
ctx.rdMissing = L('resolveDay([{ slot: "deltoides_post", ex: "face_pull", pinned: false }], noDb)');
ok(L('rdMissing.items[0].ex === "face_pull" && !possible(rdMissing.items[0].ex, noDb)'), 'hueco sin posible: mismo ejercicio y possible da false');
ok(L('!rdMissing.changed && rdMissing.notices.length === 0'), 'hueco sin posible no fijado: sin cambios ni avisos (no persiste en cada render)');

// Migración de las plantillas A/B
ctx.migNoRings = L('routineFromTemplates(TEMPLATES, defEq)');
eq(exIds('migNoRings[0]'), L('TEMPLATES.A'), 'migración: el Día A pasa tal cual');
ok(L('migNoRings[1].some((it) => it.ex === "remo_silla" && it.pinned) && !migNoRings[1].some((it) => it.ex === "remo_aros")'), 'migración sin aros: remo en silla fijado, sin remo en aros');
ok(L('migNoRings.flat().every((it) => it.pinned === true && it.slot === slotOf(it.ex))'), 'migración: todo fijado y con su hueco');
eq(exIds('routineFromTemplates(TEMPLATES, { ...defEq, rings: true })[1]'), L('TEMPLATES.B'), 'migración con aros: B conserva el remo en aros');
eq(L('routineFromTemplates({ A: ["press_banco", "c_x"], B: ["iso_pared"] }, defEq)'),
  [[{ slot: 'empuje_h', ex: 'press_banco', pinned: true }, { slot: null, ex: 'c_x', pinned: true }], [{ slot: 'isometrico', ex: 'iso_pared', pinned: true }]],
  'migración: ediciones y ejercicio propio (slot null) quedan fijados');
eq(L('ringsSwap("remo_aros", defEq)'), 'remo_silla', 'ringsSwap sin aros: remo_aros → remo_silla');
eq(L('ringsSwap("remo_aros_iso", defEq)'), 'curl_iso', 'ringsSwap sin aros: remo_aros_iso → curl_iso');
eq(L('ringsSwap("remo_aros", { ...defEq, rings: true })'), 'remo_aros', 'ringsSwap con aros: sin cambios');
eq(L('ringsSwap("goblet", defEq)'), 'goblet', 'ringsSwap: un ejercicio sin alternativa queda igual');
eq(L('slotOf("press_banco")'), 'empuje_h', 'slotOf toma el primer hueco que lo lista');
eq(L('slotOf("c_x")'), null, 'slotOf de un propio → null');

// Inicio del plan, plan activo y rotación
eq(L('firstWorkout([{ type: "rehab", date: "2026-01-01" }, { type: "entreno", date: "2026-03-05" }, { type: "entreno", date: "2026-02-10" }])'), '2026-02-10', 'firstWorkout: el entreno más viejo, ignora rehab');
eq(L('firstWorkout([{ type: "rehab", date: "2026-01-01" }])'), '', 'firstWorkout sin entrenos → vacío');
ok(L('activePlan({ plan: { id: "zzz" } }) === PLANS.fb2 && activePlan({}) === PLANS.fb2'), 'plan inexistente o ausente → fb2');
ok(L('activePlan({ plan: { id: "fb2" } }) === PLANS.fb2'), 'plan existente → ese plan');
ctx.p3 = { days: [{}, {}, {}] };
eq(L('nextDay(PLANS.fb2, 0)'), 1, 'rotación de 2 días: 0 → 1');
eq(L('nextDay(PLANS.fb2, 1)'), 0, 'rotación de 2 días: el último vuelve al primero');
eq(L('nextDay(p3, 2)'), 0, 'rotación de 3 días: el último vuelve al primero');
eq(L('nextDay(p3, 1)'), 2, 'rotación de 3 días: 1 → 2');
eq(L('nextDay(PLANS.fb2, 5)'), 0, 'posición fuera de rango → 0');
eq(L('[-1, 1.5, undefined].map((p) => nextDay(PLANS.fb2, p))'), [0, 0, 0], 'nextDay con posición inválida → 0');
eq(L('[-1, 1.5, undefined, 2, 1].map((p) => dayIndex(PLANS.fb2, p))'), [0, 0, 0, 0, 1], 'dayIndex corrige posiciones inválidas');

// Series: rampa de entrada y descarga
eq(L(`weeksSince('', '${T}')`), 0, 'sin inicio de plan → semana 0');
eq(L(`weeksSince('2026-10-07', '${T}')`), 1, '13 días → 1 semana completa');
eq(L(`weeksSince('2026-10-06', '${T}')`), 2, '14 días → 2 semanas completas');
eq(L('setsFor(3, 0, false)'), 2, 'rampa: semana 0 → una serie menos');
eq(L('setsFor(3, 1, false)'), 2, 'rampa: semana 1 → una serie menos');
eq(L('setsFor(3, 2, false)'), 3, 'semana 2: series completas');
eq(L('setsFor(3, 3, false)'), 3, 'semana 3: series completas');
eq(L('setsFor(3, 5, true)'), 2, 'descarga: una serie menos');
eq(L('setsFor(3, 0, true)'), 1, 'rampa + descarga: dos series menos');
eq(L('setsFor(1, 0, true)'), 1, 'nunca menos de 1 serie');
eq(L('daySlot(PLANS.fb2.days[0], "traccion_h")'), { slot: 'traccion_h', sets: 3, ex: 'remo_silla' }, 'daySlot da el hueco del día');
eq(L('daySlot(PLANS.fb2.days[0], null)'), null, 'daySlot de un ítem sin hueco → null');
eq(L('DEFAULT_SETS'), 3, 'un ítem sin hueco lleva 3 series');

// Resumen: qué ejercicios con peso se quedan igual (se cruza por id, no por nombre)
ctx.sumS = { items: [{ ex: 'a', name: 'Igual', reps: [8, 12] }, { ex: 'b', name: 'Sube', reps: [8, 12] }, { ex: 'c', name: 'Sin rango' }, { ex: 'd', name: 'Sin peso', reps: [8, 12] }], ups: [{ ex: 'b', name: 'Otro nombre', from: 10, to: 12 }] };
eq(L('unchangedWeightItems(sumS, (id) => id !== "d").map((x) => x.ex)'), ['a'], 'resumen: solo los de peso, con rango y sin cambio de peso (por id)');
eq(L('unchangedWeightItems({ items: sumS.items }, (id) => id !== "d").map((x) => x.ex)'), ['a', 'b'], 'resumen: sin ups todos los de peso con rango quedan igual');
ctx.sumCap = { items: [{ ex: 'a', reps: [8, 12], capped: true }, { ex: 'b', reps: [8, 12], capped: false }, { ex: 'c', reps: [8, 12] }] };
eq(L('unchangedWeightItems(sumCap, () => true).map((x) => x.ex)'), ['b', 'c'], 'resumen: los topados por dolor o en descarga (capped) no prometen subida');
// Qué ejercicios llevan rango de repeticiones
eq(L('["peso", "reps", "tiempo", "iso", "lento"].map((kind) => hasRepRange({ kind }))'), [true, true, false, false, false], 'hasRepRange: solo peso y reps llevan rango');

// Tarjeta semanal: el objetivo son los días del plan activo, no los del perfil
ctx.wk3 = { plan: { id: 'fb2' }, profile: { days: 3 }, painMode: false, zones: {}, sessions: [{ date: T, type: 'entreno' }] };
eq(L(`weekStats(wk3, '${T}').target`), 2, 'semana: con 3 días en el perfil y fb2, el objetivo es 2 entrenos');
eq(L(`weekStats({ ...wk3, plan: undefined }, '${T}').target`), 2, 'semana: sin plan guardado se usa fb2 (objetivo 2)');
eq(L(`weekStats({ ...wk3, plan: { id: 'zzz' } }, '${T}').target`), 2, 'semana: plan inexistente → fb2 (objetivo 2)');
eq(L(`streak(wk3, '${T}')`), 0, 'la racha sigue usando los días del perfil (1 de 3 no cumple la semana)');

// "Hoy no puedo": equipo que usa el ejercicio y equipo del día sin lo que falta
ctx.ringsEq = { ...defEq, rings: true, bench: true, machines: [{ id: 'p1', name: 'Polea', min: 5, max: 20, step: 2.5 }] };
eq(L('equipUsed(EXERCISES.remo_aros, ringsEq)'), ['rings'], 'equipUsed: remo en aros usa aros');
eq(L('equipUsed(EXERCISES.press_banco, ringsEq)'), ['bench', 'db'], 'equipUsed: press en banco usa banco y mancuernas');
eq(L('equipUsed(EXERCISES.flexiones, ringsEq)'), [], 'equipUsed: peso corporal no usa nada');
eq(L('equipUsed(EXERCISES.remo_aros, defEq)'), [], 'equipUsed: si no se puede hacer, nada');
eq(L('withoutEquip(ringsEq, ["rings"]).rings'), false, 'withoutEquip saca los aros');
eq(L('[withoutEquip(ringsEq, ["db"]).db, withoutEquip({ ...ringsEq, kb: [12] }, ["kb"]).kb.length, withoutEquip(ringsEq, ["m:p1"]).machines.length]'), [null, 0, 0], 'withoutEquip saca mancuernas, pesas rusas y máquinas');
eq(L('ringsEq.rings && ringsEq.machines.length'), 1, 'withoutEquip no toca el equipo original');
eq(L('resolveSlot("traccion_h", withoutEquip(ringsEq, ["rings"]), { exclude: ["remo_aros"] })'), 'remo_silla', 'sin aros hoy, el remo pasa a remo en silla');

// Sugerir subir de nivel: tiempo sin cortes largos, constancia y una señal (más fuerte de lo estimado o estancado tras una descarga)
L(`var lvDates = (days, step, gap) => { const r = []; for (let a = days; a >= 0; a -= step) if (!gap || a > gap[0] || a < gap[1]) r.push(addDays('2026-10-27', -a)); return r.reverse(); };
var lvState = (o) => ({ profile: { sex: 'h', weight: '70', age: '30', exp: 'novato', ...o.profile }, painMode: false, zones: {}, plan: { ...o.plan },
  lifts: o.lifts || { goblet: { w: 20, e1rm: 200 } },
  sessions: lvDates(o.days, o.step || 4, o.gap).map((date) => ({ type: 'entreno', date, items: ['goblet', 'rdl'].map((ex) => ({ ex, sets: [{ w: 20, reps: 8 }] })) })) });
var lv = (o) => suggestLevelUp(lvState(o), '2026-10-27', (id) => EXERCISES[id])?.next ?? null;
var weak = { goblet: { w: 20, e1rm: 1 }, rdl: { w: 20, e1rm: 1 } };`);
eq(L('lv({ days: 150 })'), null, 'nivel: novato con 5 meses todavía no sube');
eq(L('lv({ days: 210 })'), 'medio', 'nivel: novato con 7 meses, constante y más fuerte de lo estimado → medio');
eq(L('lv({ days: 210, gap: [120, 40] })'), null, 'nivel: un corte de más de 8 semanas reinicia el tiempo');
eq(L('lv({ days: 210, step: 7 })'), null, 'nivel: 1 entreno por semana no alcanza');
eq(L('lv({ days: 210, lifts: weak })'), null, 'nivel: con el tiempo pero sin señal (ni fuerza ni estancamiento) no sube');
eq(L('lv({ days: 900, profile: { exp: "avanzado" } })'), null, 'nivel: avanzado no tiene a dónde subir');
eq(L('lv({ days: 760, profile: { exp: "medio" }, lifts: weak, plan: { deload: "2026-W40" } })'), 'avanzado', 'nivel: medio con 2 años, estancado aunque hizo descarga → avanzado');
eq(L('lv({ days: 760, profile: { exp: "medio" }, lifts: weak })'), null, 'nivel: estancado sin haber hecho descarga no alcanza');
eq(L('lv({ days: 210, plan: { levelOffer: "2026-10-17" } })'), null, 'nivel: "Ahora no" hace 10 días la calla');
eq(L('lv({ days: 210, plan: { levelOffer: "2026-09-17" } })'), 'medio', 'nivel: pasados 30 días vuelve a ofrecerse');
eq(L('suggestLevelUp({ ...lvState({ days: 210 }), painMode: true, zones: { codo_lat: { phase: 1 } } }, "2026-10-27", (id) => EXERCISES[id])'), null, 'nivel: en fase 1 de dolor no se ofrece');

console.log(failures ? `\n${failures} fallaron` : '\nTodo OK');
process.exit(failures ? 1 : 0);
