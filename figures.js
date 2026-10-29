// Ilustraciones de ejercicios en vista isométrica: personaje plano con ropa (remera amarilla, short gris, zapatillas),
// con contorno, animado entre la postura a y la b (SMIL, sin librerías). Generadas por código: sin imágenes de terceros.
// Las posturas de data.js son de perfil (o de frente); acá se pasan a 3D (x adelante, y arriba, z hacia la derecha del
// personaje) y se proyectan con una cámara isométrica. Cada parte es una cápsula proyectada; se anima interpolando su
// contorno (atributo d) en varios fotogramas intermedios calculados por ángulos, así los miembros no se acortan a mitad
// de camino. Las partes de un miembro forman una sola silueta, los miembros se ordenan por profundidad y el músculo que
// trabaja el ejercicio se ilumina en rojo; la cámara gira lo necesario para que ese músculo se vea.

const PAL = {
  line: '#22262D', skin: '#F1C6A3', skin2: '#D9A684', shirt: '#F6C514', shirt2: '#D7A90B', shorts: '#5E6673', shorts2: '#454C58',
  shoe: '#FFFFFF', shoe2: '#D3D7DD', hair: '#3A2A1F', db: '#2F7BEA', db2: '#1F5FBF', bar: '#9AA3AF', kb: '#33383F',
  wood: '#8A5A3C', wood2: '#6E452D', wall: '#E3E6EA', floor: '#E6E9ED', floor2: '#CDD2D8', floor3: '#BAC0C8',
  shadow: 'rgba(38,42,49,.12)', muscle: '#E5262E',
};
const OW = 3.2;   // grosor del contorno: la mitad queda afuera de la silueta

// ——— Vectores y cámara ———
const add3 = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub3 = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const scl3 = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const dot3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross3 = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const unit3 = (p) => scl3(p, 1 / (Math.hypot(...p) || 1));
const mix3 = (p, q, t) => add3(p, scl3(sub3(q, p), t));
const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
const r1 = (n) => Math.round(n * 10) / 10;
const pt2 = (q) => `${r1(q[0])} ${r1(q[1])}`;
// Cámara elevada 28° y girada alrededor del personaje: 0° = de perfil por su derecha, 40° = tres cuartos de frente
// (la habitual), negativos = tres cuartos de atrás. Es una variable de módulo: cada dibujo fija la suya (todo es sincrónico).
function camera(yaw, pitch) {
  pitch ??= 28;   // un ejercicio puede pedir mirar más desde arriba (fig.pitch)
  const a = (yaw * Math.PI) / 180, b = (pitch * Math.PI) / 180;
  return { yaw, r: [Math.cos(a), 0, -Math.sin(a)], u: [-Math.sin(a) * Math.sin(b), Math.cos(b), -Math.cos(a) * Math.sin(b)], v: [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)] };
}
let CAM = camera(40);
const prj = (P) => [100 + dot3(P, CAM.r), 150 - dot3(P, CAM.u)];   // punto 3D → pantalla (y hacia abajo)
const prjV = (d) => [dot3(d, CAM.r), -dot3(d, CAM.u)];              // dirección 3D → pantalla
const depth = (P) => dot3(P, CAM.v);                                 // más grande = más cerca

// ——— De la postura de data.js a 3D ———
const LIMB_Z = { E: 13, W: 13, G: 13, K: 6.5, F: 6.5, T: 6.5 };   // G: punta de la mano (si la muñeca se mueve)   // distancia al centro del cuerpo (hacia los costados)
const UA = 19.5, FA = 23;                                  // largo de brazo y antebrazo (para deducir la profundidad de frente)
function pose3D(raw, f) {
  const front = !!f.front, zo = { ...f.z, ...raw.z }, J = {};   // z: por ejercicio o por postura
  const V = (pt, z) => (front ? [0, 150 - pt[1], z] : [pt[0] - 100, 150 - pt[1], z]);
  J.N = V(raw.N, 0); J.P = V(raw.P, 0);
  if (front) { J.N[2] = 100 - raw.N[0]; J.P[2] = 100 - raw.P[0]; J.N[0] = raw.x?.N ?? 0; J.P[0] = raw.x?.P ?? 0; }
  J.up = unit3(sub3(J.N, J.P)); J.fw = [J.up[1], -J.up[0], 0]; J.lat = [0, 0, 1];
  J.H = add3(J.N, scl3(J.up, 13));
  for (const n of ['1', '2']) {
    const s = n === '1' ? 1 : -1;
    // Lado lejano sin dato: espejo del cercano (la mano y la punta del pie, solo si muñeca o tobillo también son espejo).
    const get = (k) => raw[k + n] ?? ((k === 'G' && raw['W' + n]) || (k === 'T' && raw['F' + n]) ? undefined : raw[k + '1']);
    J['S' + n] = front ? add3(J.N, [0, -4, 12.5 * s]) : add3(mix3(J.N, J.P, 0.12), [0, 0, 12.5 * s]);
    J['Hp' + n] = add3(J.P, [0, 0, 6.5 * s]);
    for (const k of ['E', 'W', 'G', 'K', 'F', 'T']) {
      const p = get(k); if (!p) continue;
      let z = zo[k] ?? (k === 'G' ? zo.W : null) ?? LIMB_Z[k];
      if (front && zo[k] == null) z = Math.max(s * (100 - p[0]), z);
      J[k + n] = V(p, z * s);
    }
    if (front && J['E' + n]) {   // de frente, un brazo que se ve corto va hacia adelante
      const yz = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);
      J['E' + n][0] = J['S' + n][0] + Math.sqrt(Math.max(0, UA ** 2 - yz(J['E' + n], J['S' + n]) ** 2));
      if (J['W' + n]) J['W' + n][0] = J['E' + n][0] + Math.sqrt(Math.max(0, FA ** 2 - yz(J['W' + n], J['E' + n]) ** 2));
    }
    // De frente se puede indicar cuánto va cada articulación hacia adelante (x): rodillas sobre los pies, cadera atrás.
    if (front && raw.x) for (const k of ['E', 'W', 'G', 'K', 'F', 'T']) if (raw.x[k] != null && J[k + n]) J[k + n][0] = raw.x[k];
    J['T' + n] ??= add3(J['F' + n], [10, 0, 0]);
  }
  return J;
}

// Postura intermedia: la cadera se mueve en línea recta y cada segmento gira (slerp) manteniendo su largo.
function slerp(u, v, t) {
  const c = Math.max(-1, Math.min(1, dot3(u, v))), w = Math.acos(c);
  if (w < 1e-3) return unit3(mix3(u, v, t));
  const s = Math.sin(w);
  return add3(scl3(u, Math.sin((1 - t) * w) / s), scl3(v, Math.sin(t * w) / s));
}
function poseAt(A, B, t) {
  if (!B || t === 0) return A;
  if (t === 1) return B;
  const J = { lat: [0, 0, 1] }, lerp = (a, b) => a + (b - a) * t;
  const bone = (from, k0, k1) => {   // J[k1] = J[from] + dirección interpolada × largo interpolado
    const dA = sub3(A[k1], A[k0]), dB = sub3(B[k1], B[k0]);
    return add3(from, scl3(slerp(unit3(dA), unit3(dB), t), lerp(Math.hypot(...dA), Math.hypot(...dB))));
  };
  J.P = mix3(A.P, B.P, t); J.N = bone(J.P, 'P', 'N');
  J.up = unit3(sub3(J.N, J.P)); J.fw = [J.up[1], -J.up[0], 0]; J.H = add3(J.N, scl3(J.up, 13));
  // Hombros y caderas: fijos al torso (se expresan en sus ejes arriba/adelante/costado).
  const local = (K, k, o) => { const d = sub3(K[k], K[o]); return [dot3(d, K.up), dot3(d, K.fw), d[2]]; };
  const place = (k, o) => { const a = local(A, k, o), b = local(B, k, o); return add3(J[o], add3(scl3(J.up, lerp(a[0], b[0])), add3(scl3(J.fw, lerp(a[1], b[1])), [0, 0, lerp(a[2], b[2])]))); };
  for (const n of ['1', '2']) {
    J['S' + n] = place('S' + n, 'N'); J['Hp' + n] = place('Hp' + n, 'P');
    if (A['E' + n]) J['E' + n] = bone(J['S' + n], 'S' + n, 'E' + n);
    if (A['W' + n]) J['W' + n] = bone(J['E' + n], 'E' + n, 'W' + n);
    if (A['G' + n]) J['G' + n] = bone(J['W' + n], 'W' + n, 'G' + n);
    if (A['K' + n]) J['K' + n] = bone(J['Hp' + n], 'Hp' + n, 'K' + n);
    if (A['F' + n]) J['F' + n] = bone(J['K' + n], 'K' + n, 'F' + n);
    if (A['T' + n]) J['T' + n] = bone(J['F' + n], 'F' + n, 'T' + n);
  }
  return J;
}
// Fotogramas de la animación: 7 posturas con aceleración suave (ida); la animación va y vuelve.
const FRAMES = 6, easeT = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
function framesOf(f) {
  const A = pose3D(f.a, f), B = f.b ? pose3D({ ...f.a, ...f.b }, f) : null;
  const ts = Array.from({ length: FRAMES + 1 }, (_, i) => easeT(i / FRAMES));
  if (!B && f.roll) return { FR: ts.map((t) => ({ ...A, roll: f.roll[0] + (f.roll[1] - f.roll[0]) * t })), ts, A, B };   // solo gira la mano
  if (!B) return { FR: [A], ts: [0], A, B };
  return { FR: ts.map((t) => poseAt(A, B, t)), ts, A, B };
}

// ——— Formas proyectadas ———
// Cápsula de p a q (2D), radio ra en p y rb en q (misma estructura siempre, para poder interpolar).
function capsule(p, q, ra, rb) {
  const [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), nx = -uy, ny = ux;
  const P = (c, r, s) => `${r1(c[0] + nx * r * s)} ${r1(c[1] + ny * r * s)}`;
  return `M${P(p, ra, 1)}L${P(q, rb, 1)}A${rb} ${rb} 0 0 0 ${P(q, rb, -1)}L${P(p, ra, -1)}A${ra} ${ra} 0 0 0 ${P(p, ra, 1)}Z`;
}
// Elipse con centro c y semiejes A y B (vectores 2D), con curvas de Bézier (estructura fija).
function ellipse(c, A, B) {
  const k = 0.5523, P = (a, b) => pt2([c[0] + A[0] * a + B[0] * b, c[1] + A[1] * a + B[1] * b]);
  return `M${P(1, 0)}C${P(1, k)} ${P(k, 1)} ${P(0, 1)}C${P(-k, 1)} ${P(-1, k)} ${P(-1, 0)}C${P(-1, -k)} ${P(-k, -1)} ${P(0, -1)}C${P(k, -1)} ${P(1, -k)} ${P(1, 0)}Z`;
}
const circlePath = (c, r) => ellipse(c, [r, 0], [0, r]);
// Disco 3D (centro, normal, radio) proyectado: devuelve centro y semiejes (el primero, el mayor).
function disc(c3, n, R) {
  let e1 = cross3(n, CAM.v); if (Math.hypot(...e1) < 1e-3) e1 = cross3(n, [0, 1, 0]);
  e1 = unit3(e1); const e2 = unit3(cross3(n, e1));
  return [prj(c3), prjV(scl3(e1, R)), prjV(scl3(e2, R))];
}
// Músculo: huso a lo largo del segmento entre t0 y t1, centrado en o (fracción del radio, sobre la normal) y de medio ancho w.
function lens([p, q, ra, rb], o, t0, t1, w) {
  const [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), n = [-uy, ux];
  const R = (t) => ra + (rb - ra) * Math.min(1, Math.max(0, t));
  const P = (t, k) => { const m = mix(p, q, t), r = R(t) * k; return `${r1(m[0] + n[0] * r)} ${r1(m[1] + n[1] * r)}`; };
  const tm = (t0 + t1) / 2;
  return `M${P(t0, o)}Q${P(tm, o + 2 * w)} ${P(t1, o)}Q${P(tm, o - 2 * w)} ${P(t0, o)}Z`;
}
// Ancho proyectado de una sección elíptica del torso (semiejes al costado y hacia adelante) medido según la normal m.
const halfWidth = (J, side, fwd, m) => { const a = prjV(scl3(J.lat, side)), b = prjV(scl3(J.fw, fwd)); return Math.hypot(a[0] * m[0] + a[1] * m[1], b[0] * m[0] + b[1] * m[1]); };

// Segmentos 3D [desde, hasta, radio inicial, radio final]. El del torso usa el ancho proyectado de su sección.
function segOf(key, J, n) {
  if (key === 'ua') return J['E' + n] && [J['S' + n], J['E' + n], 5.2, 4.3];
  if (key === 'fa') return J['W' + n] && [J['E' + n], J['W' + n], 4.3, 3.3];
  if (key === 'th') return J['K' + n] && [J['Hp' + n], J['K' + n], 7.6, 5.8];
  if (key === 'sh') return J['F' + n] && [J['K' + n], J['F' + n], 5.6, 3.9];
  const a = mix3(J.N, J.P, -0.06), b = mix3(J.N, J.P, 0.86), [p, q] = [prj(a), prj(b)], [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), m = [-uy, ux];
  return [a, b, halfWidth(J, 12.5, 8.5, m), halfWidth(J, 11, 7.5, m)];
}
// Hacia dónde mira la cara anterior del segmento (pecho, bíceps, cuádriceps).
// Si la articulación está doblada se usa hacia dónde se dobla (el codo se cierra hacia adelante del brazo; la rodilla,
// hacia atrás del muslo y de la pierna), que vale en cualquier postura; si está recta, la orientación del cuerpo.
function front3(f, key, J, n) {
  if (key === 'to') return J.fw;
  const s = segOf(key, J, n), d = unit3(sub3(s[1], s[0]));
  let base = f.front ? J.fw : [-d[1], d[0], 0];
  if (Math.hypot(...base) < 1e-3) base = J.fw;
  base = sub3(base, scl3(d, dot3(base, d)));
  const other = { ua: ['W', 'E', 1], th: ['F', 'K', -1], sh: ['Hp', 'K', -1] }[key];
  if (other && J[other[0] + n]) {
    const v = sub3(J[other[0] + n], J[other[1] + n]), perp = sub3(v, scl3(d, dot3(v, d))), k = Math.min(1, Math.hypot(...perp) / (0.45 * Math.hypot(...v)));
    if (k > 0) base = add3(scl3(unit3(base), 1 - k), scl3(unit3(perp), other[2] * k));
  }
  return unit3(base);
}

// Músculos como parches sobre la superficie: [segmento, t0, t1 (a lo largo del hueso), ángulo alrededor del hueso
// (0 = adelante, 180 = atrás), medio arco que cubre]. Proporciones según dónde está el vientre de cada músculo.
const MUS = {
  delt: [['ua', -0.15, 0.42, 0, 110]], biceps: [['ua', 0.3, 0.92, 0, 50]], triceps: [['ua', 0.15, 0.95, 180, 60]],
  forearm: [['fa', 0.05, 0.68, 0, 75]], chest: [['to', 0.08, 0.42, 32, 30], ['to', 0.08, 0.42, -32, 30]], abs: [['to', 0.45, 0.92, 0, 32]],
  back: [['to', 0.08, 0.6, 180, 70]], lumbar: [['to', 0.6, 0.96, 180, 35]], glutes: [['th', -0.25, 0.3, [120, -120], 40]],
  quads: [['th', 0.36, 0.95, 0, 70]], hams: [['th', 0.25, 0.92, 180, 60]], calves: [['sh', 0.05, 0.52, 180, 65]],
};
// Cómo se ve un parche en una postura: el huso va centrado en o y tiene medio ancho w (fracciones del radio dibujado).
// Solo cuenta la parte que mira a la cámara; nunca pasa del contorno ni se vuelve más ancho que 0,3 de su largo.
// primary: el primer músculo del ejercicio. Si mira para el otro lado se asoma por el borde; los demás se ocultan.
function patch(f, [key, t0, t1, ang, span], J, n, primary = true) {
  if (Array.isArray(ang)) {   // posterolateral (glúteos): se usa el lado que mira a la cámara
    const [p1, p2] = ang.map((g) => patch(f, [key, t0, t1, g, span], J, n, primary));
    return !p1 || (p2 && p2.vis > p1.vis) ? p2 : p1;
  }
  const s = segOf(key, J, n); if (!s) return null;
  const p = prj(s[0]), q = prj(s[1]), [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), n2 = [-uy, ux];
  const d = unit3(sub3(s[1], s[0])), f3 = front3(f, key, J, n);
  const a = unit3(sub3(f3, scl3(d, dot3(f3, d)))), l = unit3(cross3(d, a));
  const R = (s[2] + s[3]) / 2, [ra, rl] = key === 'to' ? [8.5, 12.5] : [R, R];
  let lo = Infinity, hi = -Infinity, vis = -1, peek = 0;
  for (let i = 0; i <= 36; i++) {
    const g = ((ang + span * (i / 18 - 1)) * Math.PI) / 180, c = Math.cos(g), sn = Math.sin(g);
    const fac = dot3(unit3(add3(scl3(a, c / ra), scl3(l, sn / rl))), CAM.v);
    const pv = prjV(add3(scl3(a, ra * c), scl3(l, rl * sn))), o = (pv[0] * n2[0] + pv[1] * n2[1]) / R;
    if (fac > vis) { vis = fac; peek = o; }
    if (fac < -0.02) continue;
    lo = Math.min(lo, o); hi = Math.max(hi, o);
  }
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) * (t1 - t0);
  // Si mira para el otro lado (p. ej. el abdomen en la plancha), se asoma por el borde más cercano: nunca desaparece.
  if (lo > hi) { const w = primary ? Math.min(0.28, (0.3 * len) / R) : 0; return { s2: [p, q, s[2], s[3]], o: Math.sign(peek || 1) * (0.92 - w), w, vis, len, R }; }
  // El ancho crece de a poco a medida que el músculo gira hacia la cámara (sin saltos entre fotogramas).
  const show = Math.min(1, Math.max(0, (vis - 0.15) / 0.75));
  const base = primary ? 0.28 : 0.28 * Math.min(1, Math.max(0, (vis - 0.3) / 0.3));   // los secundarios aparecen de a poco
  let o = (lo + hi) / 2, w = base + Math.max(0, (hi - lo) / 2 - 0.28) * show;
  w = Math.min(w, Math.max((0.3 * len) / R, 0.3), 0.92);   // escorzado (apunta a la cámara) queda como una gota chica, no desaparece
  if (Math.abs(o) + w > 0.92) o = Math.sign(o) * (0.92 - w);
  return { s2: [p, q, s[2], s[3]], o, w, vis, len, R };
}
// Un músculo a lo largo de la animación: se suaviza el centro y el ancho entre fotogramas vecinos (los extremos quedan igual).
function patchesOver(f, def, FR, n, primary = true) {
  const P = FR.map((J) => patch(f, def, J, n, primary));
  if (P.length < 3 || P.some((x) => !x)) return P;
  for (let pass = 0; pass < 3; pass++) {
    const prev = P.map((x) => ({ ...x }));
    for (let i = 1; i < P.length - 1; i++) for (const k of ['o', 'w']) P[i][k] = (prev[i - 1][k] + 2 * prev[i][k] + prev[i + 1][k]) / 4;
  }
  for (const x of P) {   // después de suavizar, los mismos topes: no más ancho que 0,3 del largo ni fuera del contorno
    x.w = Math.min(x.w, Math.max((0.3 * x.len) / x.R, 0.3), 0.92);
    if (Math.abs(x.o) + x.w > 0.92) x.o = Math.sign(x.o) * (0.92 - x.w);
  }
  return P;
}
// Ángulo de cámara para un ejercicio: el que mejor muestra sus músculos (lado cercano) en todos los fotogramas,
// sin perder del todo la cara. Se prefiere el habitual (40°) si no hay motivo para girar.
const CAM_YAWS = [40, 15, -15], CAM_YAWS_FRONT = [65, 80, 50];   // automático: de frente a perfil; de atrás, solo a mano (fig.cam)   // los dibujados de frente, más de frente
const camCache = new Map();
function pickCam(ex, FR) {
  if (ex.fig.cam != null) return ex.fig.cam;
  const key = ex.id ? ex.id + JSON.stringify(ex.fig.a) : null;
  if (key && camCache.has(key)) return camCache.get(key);
  const defs = (ex.mus || []).flatMap((m) => MUS[m] || []);
  const yaws = ex.fig.front ? CAM_YAWS_FRONT : CAM_YAWS;
  let best = yaws[0], bestScore = -Infinity;
  for (const yaw of yaws) {
    CAM = camera(yaw);
    let score = (yaw === yaws[0] ? 0.6 : 0) - (yaw <= -40 ? 0.35 : 0);   // de atrás solo si hace mucha falta: de perfil se entiende mejor
    for (const J of FR) {
      for (const def of defs) { const v = patch(ex.fig, def, J, '1')?.vis ?? 1; score += v < 0.15 ? -3 : Math.min(v, 0.8); }
      score += 0.25 * dot3(J.fw, CAM.v);
    }
    score /= FR.length;
    if (score > bestScore + 1e-6) { best = yaw; bestScore = score; }
  }
  if (key) camCache.set(key, best);
  return best;
}
// Diagnóstico para los tests: cómo queda cada músculo en cada fotograma.
function muscleStats(ex) {
  const f = ex.fig, { FR } = framesOf(f);
  CAM = camera(pickCam(ex, FR), ex.fig.pitch);
  return {
    yaw: CAM.yaw,
    bones: FR.map((J) => ['ua', 'fa', 'th', 'sh'].map((k) => { const s = segOf(k, J, '1'); return s ? Math.hypot(...sub3(s[1], s[0])) : 0; })),
    muscles: (ex.mus || []).flatMap((m, i) => (MUS[m] || []).map((def) => ({ m, primary: i === 0, frames: patchesOver(f, def, FR, '1', i === 0) }))),
  };
}

// at: dibuja quieta la postura intermedia t (0 = a, 1 = b), para revisar el movimiento.
function figureSVG(ex, { animate = true, size = '', crop = false, muscles = true, at = null } = {}) {
  const f = ex.fig, L = PAL.line, fr = framesOf(f);
  CAM = camera(pickCam(ex, fr.FR), ex.fig.pitch);
  const FR = at == null ? fr.FR : [f.roll && !fr.B ? { ...fr.A, roll: f.roll[0] + (f.roll[1] - f.roll[0]) * at } : poseAt(fr.A, fr.B, at)], ts = at == null ? fr.ts : [at], A = FR[0], moving = FR.length > 1;
  const dur = `${f.dur || 3}s`;
  // Animación por fotogramas: ida por las 7 posturas y vuelta, a intervalos iguales (la suavidad ya está en las posturas).
  const loop = (vals) => [...vals, ...vals.slice(0, -1).reverse()];
  const timing = (n) => `keyTimes="${Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * 1000) / 1000).join(';')}" calcMode="linear" dur="${dur}" repeatCount="indefinite"`;
  const animV = (attr, vals, tag = 'animate', extra = '') => {
    if (!animate || !moving || vals.every((v) => v === vals[0])) return '';
    const all = loop(vals);
    return `<${tag} attributeName="${attr}" ${extra}values="${all.join(';')}" ${timing(all.length)}/>`;
  };
  // Forma que depende de la postura: se calcula en cada fotograma y se anima el contorno.
  const path = (fn, attrs, extra = '') => {
    const ds = FR.map(fn); if (!ds[0]) return '';
    return `<path d="${ds[0]}" ${attrs}>${animV('d', ds)}${extra}</path>`;
  };
  // Una sola silueta por grupo: primero todas las formas engrosadas en color de línea, después los rellenos sin borde.
  const group = (parts, over = '') => parts.map(([fn]) => path(fn, `fill="${L}" stroke="${L}" stroke-width="${OW}" stroke-linejoin="round"`)).join('')
    + parts.map(([fn, fill]) => path(fn, `fill="${fill}"`)).join('') + over;
  const shade = (n, k) => PAL[k + (n === '2' ? '2' : '')];
  const seg2 = (key, J, n) => { const s = segOf(key, J, n); return s && [prj(s[0]), prj(s[1]), s[2], s[3]]; };
  const seg = (key, n, t0 = 0, t1 = 1, ra, rb) => (J) => {
    const s = seg2(key, J, n); if (!s) return '';
    return capsule(mix(s[0], s[1], t0), mix(s[0], s[1], t1), ra ?? s[2], rb ?? s[3]);
  };
  // Músculos iluminados: más intensos hacia la postura b (contracción); en los isométricos, un pulso suave. El tamaño no cambia.
  const mus = muscles ? ex.mus || [] : [];
  const glow = !animate ? '' : moving ? animV('opacity', ts.map((t) => r1(0.6 + 0.4 * t))) : '<animate attributeName="opacity" values=".65;1;.65" dur="2.4s" repeatCount="indefinite"/>';
  // Un músculo oculto (ancho 0) se reduce a un punto, así no queda dibujado su borde.
  const musOn = (keys, n) => mus.flatMap((m, j) => (MUS[m] || []).map((def) => [def, j === 0])).filter(([[k]]) => keys.includes(k))
    .map(([def, primary]) => { const Ps = patchesOver(f, def, FR, n, primary); return path((J, i) => {
      const P = Ps[i]; if (!P) return '';
      const k = Math.min(1, P.w / 0.12), tm = (def[1] + def[2]) / 2;
      return lens(P.s2, P.o, tm + (def[1] - tm) * k, tm + (def[2] - tm) * k, P.w);
    },
      `fill="${n === '2' ? '#B81D24' : PAL.muscle}" stroke="#9E1219" stroke-width=".7" stroke-linejoin="round" opacity=".9"`, glow); }).join('');

  // ——— Partes del cuerpo ———
  const legParts = (n) => [
    [seg('th', n), shade(n, 'skin')], [seg('sh', n), shade(n, 'skin')], [seg('th', n, 0, 0.45, 8.8, 7.6), shade(n, 'shorts')],
    [(J) => capsule(prj(J['F' + n]), prj(J['T' + n]), 4.4, 3.6), shade(n, 'shoe')],
  ];
  const armParts = (n) => [[seg('ua', n), shade(n, 'skin')], [seg('fa', n), shade(n, 'skin')], [seg('ua', n, -0.05, 0.42, 6.6, 6.1), shade(n, 'shirt')]];
  // Mano: puño redondo; si la postura trae la punta de la mano (G), una cápsula que gira en la muñeca.
  const hand = (n) => path((J) => (J['G' + n] ? capsule(prj(J['W' + n]), prj(J['G' + n]), 3.4, 3.9) : J['W' + n] ? circlePath(prj(J['W' + n]), 3.9) : ''), `fill="${shade(n, 'skin')}" stroke="${L}" stroke-width="1.6" stroke-linejoin="round"`);
  const torso = (J) => { const [p, q, ra, rb] = seg2('to', J); return capsule(p, q, ra, rb); };
  const pelvis = (J) => {
    const a = mix3(J.N, J.P, 0.8), [p, q] = [prj(a), prj(J.P)], [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), m = [-uy, ux];
    return capsule(p, q, halfWidth(J, 11, 7.5, m), halfWidth(J, 12, 8, m));
  };

  // Cabeza y cara: puntos sobre la cabeza en ejes adelante (a), arriba (b) y costado derecho (c).
  const HR = 10.6, fp = (J, a, b, c) => prj(add3(J.H, add3(scl3(J.fw, a), add3(scl3(J.up, b), scl3(J.lat, c)))));
  const faces = (a, b, c) => dot3(unit3(add3(scl3(A.fw, a), add3(scl3(A.up, b), scl3(A.lat, c)))), CAM.v) > 0.12;
  const stroke = (fn, w) => path(fn, `fill="none" stroke="${L}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
  const hair = (J) => {   // casquete: arco por arriba y atrás de la cabeza, de la nuca a la frente
    // Visto de atrás (la cara mira lejos de la cámara) el pelo cubre casi toda la cabeza.
    const c = prj(J.H), u = unit(...prjV(J.up)), fw = prjV(J.fw), h = unit(u[0] - fw[0] * 0.8, u[1] - fw[1] * 0.8), R = HR + 0.4;
    const away = Math.max(0, -dot3(J.fw, CAM.v)), b0 = -1.85 - away * 0.9, f0 = 1.15 + away * 1.6;
    const at = (ang, r) => { const cs = Math.cos(ang), sn = Math.sin(ang); return [c[0] + (h[0] * cs - h[1] * sn) * r, c[1] + (h[0] * sn + h[1] * cs) * r]; };
    return `M${pt2(at(b0, R))}A${R} ${R} 0 1 1 ${pt2(at(f0, R))}Q${pt2(at((b0 + f0) / 2 + Math.PI, HR * (0.3 + away * 0.5)))} ${pt2(at(b0, R))}Z`;
  };
  const ear = faces(0, 0, 1) ? [[(J) => circlePath(fp(J, 1.2, -1.8, HR - 0.4), 2.6), PAL.skin]] : [];
  const nose = faces(1, 0, 0) || dot3(A.fw, CAM.v) > -0.5 ? [[(J) => circlePath(fp(J, HR - 0.4, -0.8, 0), 2.2), PAL.skin]] : [];
  const faceParts = [-1, 1].filter((k) => faces(0.9, 0.15, k * 0.36) && dot3(unit3(add3(scl3(A.fw, 0.9), add3(scl3(A.up, 0.15), scl3(A.lat, k * 0.36)))), CAM.v) > 0.42).map((k) =>
    path((J) => circlePath(fp(J, 9.6, 1.6, k * 3.9), 1.4), `fill="${L}"`)
    + stroke((J) => `M${pt2(fp(J, 9.6, 4.8, k * 2.2))}L${pt2(fp(J, 8.4, 5.1, k * 5.8))}`, 1.3)).join('')
    + (faces(0.9, -0.4, 0) ? stroke((J) => `M${pt2(fp(J, 9.4, -4.6, -2.6))}Q${pt2(fp(J, 10.4, -6.6, 0))} ${pt2(fp(J, 9.4, -4.6, 2.6))}`, 1.2)
      + path((J) => circlePath(fp(J, HR + 0.6, -1.4, 0.3), 0.9), `fill="${PAL.skin2}"`) : '')
    + (ear.length ? stroke((J) => `M${pt2(fp(J, 2.2, 0.4, HR))}Q${pt2(fp(J, 0, -1, HR + 0.4))} ${pt2(fp(J, 2.2, -3.6, HR))}`, 1) : '');
  const head = group([
    [(J) => capsule(prj(J.N), prj(mix3(J.N, J.H, 0.55)), 3.6, 3.6), PAL.skin], ...ear, ...nose,
    [(J) => circlePath(prj(J.H), HR), PAL.skin], [hair, PAL.hair],
  ], faceParts);

  // ——— Objetos (mancuernas, pesa rusa, aros, banda, toalla) ———
  const props = [];
  for (const p of f.props || []) {
    props.push(p);
    const mirrored = f.a.W2 === undefined && !f.front && !f.z?.W && !f.one;
    if (p.at === 'W1' && mirrored && ['db', 'ring', 'band'].includes(p.t)) props.push({ ...p, at: 'W2' });
  }
  const propsOf = (n) => props.filter((p) => p.at.slice(-1) === n).map((p) => propSVG(p, FR, ts, { path, group, animV, animate, front: !!f.front, dur }));
  const arm = (n) => {
    const ps = propsOf(n).filter((p) => !p.own);
    return group(armParts(n), musOn(['ua', 'fa'], n)) + ps.map((p) => p.under).join('') + hand(n) + ps.map((p) => p.over).join('');
  };

  // Grupos ordenados por profundidad (promedio de los fotogramas).
  const zOf = (fn) => FR.reduce((s, J) => s + fn(J), 0) / FR.length;
  const avgD = (keys) => (J) => keys.filter((k) => J[k]).reduce((s, k, _, arr) => s + depth(J[k]) / arr.length, 0);
  const groups = [
    { z: zOf(avgD(['N', 'P'])), svg: group([[pelvis, PAL.shorts], [torso, PAL.shirt]], musOn(['to'], '1')) },
    { z: zOf((J) => depth(J.H)) + 4, svg: head },
    // La pesa rusa se ordena sola por su profundidad (la campana cuelga debajo del mango): de atrás queda tapada por el cuerpo.
    ...props.filter((p) => p.t === 'kb').map((p) => {
      const n = p.at.slice(-1), c = (J) => { const w = p.mid ? mix3(J.W1, J.W2, 0.5) : J[p.at]; return [w[0], w[1] - 12, w[2]]; };
      return { z: zOf((J) => depth(c(J))) - 1, svg: propSVG(p, FR, ts, { path, group, animV, animate, front: !!f.front, dur }).under };
    }),
    ...['1', '2'].flatMap((n) => [
      { z: zOf(avgD(['S' + n, 'E' + n, 'W' + n])) + 2, svg: arm(n) },
      { z: zOf(avgD(['Hp' + n, 'K' + n, 'F' + n])), svg: group(legParts(n), musOn(['th', 'sh'], n)) },
    ]),
  ].sort((a, b) => a.z - b.z);

  // Piso: baldosa isométrica que abarca al personaje y la escena; sombra debajo del cuerpo.
  const pts3 = FR.flatMap((J) => ['N', 'P', 'H', 'S1', 'S2', 'E1', 'E2', 'W1', 'W2', 'G1', 'G2', 'K1', 'K2', 'F1', 'F2', 'T1', 'T2'].filter((k) => J[k]).map((k) => J[k]));
  const scene = (f.scene || []).map((s) => sceneBoxes(s, !!f.front, A));
  const sceneP = scene.flatMap((s) => s.pts);
  const xs = [...pts3, ...sceneP].map((p) => p[0]), zs = [...pts3, ...sceneP].map((p) => p[2]);
  const X0 = Math.min(...xs) - 18, X1 = Math.max(...xs) + 18, Z0 = Math.min(-26, ...zs) - 12, Z1 = Math.max(26, ...zs) + 12;
  const floor = box([X0, X1], [-7, 0], [Z0, Z1], [PAL.floor, PAL.floor2, PAL.floor3], 'rgba(34,38,45,.18)');
  const cx = (A.P[0] + (A.F1?.[0] ?? A.P[0])) / 2, sh = disc([cx, 0, 0], [0, 1, 0], 1);
  const shadow = `<path d="${ellipse(sh[0], scl3(sh[1], 30).slice(0, 2), scl3(sh[2], 18).slice(0, 2))}" fill="${PAL.shadow}"/>`;

  // Encuadre: miniaturas cuadradas alrededor del cuerpo; grande, 200×170 con el piso y la escena.
  const p2 = pts3.map(prj).concat(FR.map((J) => { const c = prj(J.H); return [c[0], c[1] - HR - 4]; }));
  const fl = [[X0, -7, Z0], [X1, -7, Z0], [X0, -7, Z1], [X1, -7, Z1], [X1, 0, Z1]].map(prj);
  const bb = (ps) => [Math.min(...ps.map((q) => q[0])), Math.min(...ps.map((q) => q[1])), Math.max(...ps.map((q) => q[0])), Math.max(...ps.map((q) => q[1]))];
  let vb;
  if (crop) {
    const [x0, y0, x1, y1] = bb(p2), side = Math.max(x1 - x0, y1 - y0) + 26, cxx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
    vb = [cxx - side / 2, cyy - side / 2, side, side];
  } else {
    const [x0, y0, x1, y1] = bb([...p2, ...fl, ...sceneP.map(prj)]);
    let w = x1 - x0 + 16, h = y1 - y0 + 16;
    if (w / h > 200 / 170) h = (w * 170) / 200; else w = (h * 200) / 170;
    vb = [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }
  return `<svg class="fig ${size}" viewBox="${vb.map(r1).join(' ')}" role="img" aria-label="Ilustración: ${ex.name}">
    ${floor}${shadow}${scene.map((s) => s.svg).join('')}${groups.map((g) => g.svg).join('')}</svg>`;
}

// Caja 3D [x], [y], [z] con las tres caras visibles (arriba, frente y costado) en tonos de un mismo color.
function box(X, Y, Z, [top, side1, side2], line = PAL.line) {
  const c = (i, j, k) => prj([X[i], Y[j], Z[k]]), poly = (ps) => `M${ps.map(pt2).join('L')}Z`;
  const zi = CAM.v[2] >= 0 ? 1 : 0, xi = CAM.v[0] >= 0 ? 1 : 0;   // caras que miran a la cámara
  const faces = [
    [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], [c(0, 0, zi), c(1, 0, zi), c(1, 1, zi), c(0, 1, zi)], [c(xi, 0, 0), c(xi, 0, 1), c(xi, 1, 1), c(xi, 1, 0)],
  ];
  return faces.map((ps, i) => `<path d="${poly(ps)}" fill="${[top, side1, side2][i]}" stroke="${line}" stroke-width="1.1" stroke-linejoin="round"/>`).join('');
}
const tones = (c1, c2, c3) => [c1, c2, c3 || c2];
// Escenas (silla, banco, pared, barra, columna, máquina) armadas con cajas. Se dibujan detrás del personaje.
function sceneBoxes(s, front, A) {
  // Coordenadas de data.js (x, y del dibujo; d = profundidad) → 3D.
  const M = (x, y, d) => (front ? [d, 150 - y, 100 - x] : [x - 100, 150 - y, d]);
  const parts = [], pts = [];
  const add = (xs, ys, ds, col) => {
    const P = [M(xs[0], ys[0], ds[0]), M(xs[1], ys[1], ds[1])];
    const X = [Math.min(P[0][0], P[1][0]), Math.max(P[0][0], P[1][0])], Y = [Math.min(P[0][1], P[1][1]), Math.max(P[0][1], P[1][1])], Z = [Math.min(P[0][2], P[1][2]), Math.max(P[0][2], P[1][2])];
    parts.push(box(X, Y, Z, col)); pts.push([X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]]);
  };
  const W = tones('#9C6A4A', PAL.wood, PAL.wood2), MET = tones('#B4BBC4', '#9AA3AF', '#848D99'), PAD = tones('#454B55', '#2F343C', '#262A31');
  if (s.t === 'wall') { const x = s.left ? [s.x - 5, s.x] : [s.x, s.x + 5]; add(x, [150, 40], [-34, 34], tones('#EEF0F3', PAL.wall, '#D5D9DE')); }
  if (s.t === 'chair') {
    for (const lx of [s.x + 2, s.x + s.w - 6]) for (const d of [-13, 9]) add([lx, lx + 4], [150, s.y + 5], [d, d + 4], W);
    const bx = s.back === 'left' ? s.x : s.x + s.w - 4;
    for (const d of [-13, 9]) add([bx, bx + 4], [s.y, s.y - 40], [d, d + 4], W);
    add([bx - 0.5, bx + 4.5], [s.y - 26, s.y - 42], [-14, 14], W);
    add([s.x - 2, s.x + s.w + 2], [s.y + 6, s.y], [-15, 15], W);
  }
  if (s.t === 'bench') {
    for (const lx of [s.x + 8, s.x + s.w - 14]) add([lx, lx + 6], [150, s.y + 6], [-9, 9], MET);
    add([s.x, s.x + s.w], [s.y + 8, s.y], [-12, 12], PAD);
  }
  if (s.t === 'bar') {
    for (const d of [-34, 30]) add([97, 101], [150, -16], [d, d + 4], MET);
    add([96, 100], [s.y + 2, s.y - 2], [-34, 34], MET);
  }
  if (s.t === 'stack') {
    add([s.x, s.x + 30], [150, 20], [-16, 16], tones('#E1E4E8', '#D1D5DB', '#BFC4CB'));
    for (let i = 0; i < 6; i++) add([s.x + 4, s.x + 26], [144 - i * 6, 139 - i * 6], [-11, 11], tones('#5B6573', '#4B5563', '#3D4652'));
  }
  if (s.t === 'table') {   // mesa firme: tapa en s.y, de s.x a s.x + s.w, con las patas en las puntas
    for (const lx of [s.x + 1, s.x + s.w - 5]) for (const d of [-30, 26]) add([lx, lx + 4], [150, s.y + 4], [d, d + 4], W);
    add([s.x, s.x + s.w], [s.y + 4, s.y], [-32, 32], W);
  }
  if (s.t === 'post') { const d = front && A.W1 ? A.W1[0] : 0; add([s.x - 3, s.x + 3], [150, 0], [d - 3, d + 3], MET); }   // de frente, a la altura de la mano
  // Las escenas se dibujan de atrás hacia adelante dentro de sí mismas (orden de armado).
  return { svg: parts.join(''), pts };
}

// Mancuerna según el agarre: 'end' con el mango hacia los costados (palmas abajo o arriba), 'neutral' perpendicular al
// antebrazo, 'along' a lo largo del antebrazo. Con dos agarres (p. ej. ['end', 'neutral']) pasa de uno al otro.
function handleDir(grip, J, n, front) {
  if (grip === 'end') return front ? [1, 0, 0] : [0, 0, 1];   // de punta: hacia quien mira en el dibujo original
  const d = J['G' + n] ? unit3(sub3(J['G' + n], J['W' + n])) : unit3(sub3(J['W' + n], J['E' + n]));
  if (grip === 'along') return d;
  const a = [-d[1], d[0], 0], neutral = front || Math.hypot(...a) < 1e-3 ? [1, 0, 0] : unit3(a);
  if (grip !== 'roll') return neutral;
  // Pronación y supinación: el mango gira alrededor del antebrazo, de neutro (0°) hacia los costados (±90°).
  const g = ((J.roll || 0) * Math.PI) / 180, side = unit3(cross3(d, neutral));
  return add3(scl3(neutral, Math.cos(g)), scl3(side, Math.sin(g)));
}
function propSVG(p, FR, ts, { path, group, animV, animate, front, dur }) {
  const L = PAL.line, n = p.at.slice(-1), A = FR[0];
  const posOf = (J) => (p.mid ? mix3(J.W1, J.W2, 0.5) : (p.at[0] === 'W' && J['G' + n] && mix3(J['W' + n], J['G' + n], 0.55)) || J[p.at]);   // con mano articulada, la pesa va en la mano
  if (p.t === 'db') {
    const one = (grip, extra = '') => {
      // Discos: cilindro (cara interna, costado y cara externa) a cada lado de la mano; mango entre ellos.
      const plate = (sgn) => {
        const geo = (J) => { const h = handleDir(grip, J, n, front), w = posOf(J), cIn = add3(w, scl3(h, sgn * 8)), cOut = add3(w, scl3(h, sgn * 12)); return [disc(cIn, h, 7.2), disc(cOut, h, 7.2)]; };
        const quad = (J) => { const [[c1, a1], [c2, a2]] = geo(J); return `M${pt2([c1[0] + a1[0], c1[1] + a1[1]])}L${pt2([c2[0] + a2[0], c2[1] + a2[1]])}L${pt2([c2[0] - a2[0], c2[1] - a2[1]])}L${pt2([c1[0] - a1[0], c1[1] - a1[1]])}Z`; };
        return group([[(J) => ellipse(...geo(J)[0]), PAL.db2], [quad, PAL.db2], [(J) => ellipse(...geo(J)[1]), PAL.db]],
          path((J) => { const [c, a, b] = geo(J)[1]; return ellipse(c, scl3([...a, 0], 0.3).slice(0, 2), scl3([...b, 0], 0.3).slice(0, 2)); }, `fill="${PAL.bar}" stroke="${L}" stroke-width="1"`));
      };
      const bar = path((J) => { const h = handleDir(grip, J, n, front), w = posOf(J); return capsule(prj(add3(w, scl3(h, -9))), prj(add3(w, scl3(h, 9))), 1.9, 1.9); }, `fill="${PAL.bar}" stroke="${L}" stroke-width="1.2"`);
      // Qué disco queda adelante; si cambia durante el giro, se alternan dos versiones (una visible por vez).
      const signs = FR.map((J) => (dot3(handleDir(grip, J, n, front), CAM.v) >= 0 ? 1 : -1));
      if (signs.every((x) => x === signs[0]) || !animate) return { under: `<g${extra}>${plate(-signs[0])}${bar}</g>`, over: `<g${extra}>${plate(signs[0])}</g>` };
      const loopS = [...signs, ...signs.slice(0, -1).reverse()];
      const show = (sg) => `<animate attributeName="opacity" calcMode="discrete" values="${loopS.map((x) => (x === sg ? 1 : 0)).join(';')}" dur="${dur}" repeatCount="indefinite"/>`;
      const both = (layer) => [1, -1].map((sg) => `<g opacity="${signs[0] === sg ? 1 : 0}">${show(sg)}${layer(sg)}</g>`).join('');
      return { under: both((sg) => plate(-sg) + bar), over: both((sg) => plate(sg)) };
    };
    if (Array.isArray(p.grip)) {
      // Cambio de agarre: una vista se desvanece mientras aparece la otra (en los isométricos, un ida y vuelta de 6 s).
      const k = ts.length > 1 ? ts : [0, 0.5, 1, 0.5];
      const fade = (inv) => (animate ? `<animate attributeName="opacity" values="${[...k, ...k.slice(0, -1).reverse()].map((t) => r1(inv ? 1 - t : t)).join(';')}" dur="6s" repeatCount="indefinite"/>` : '');
      const [g1, g2] = [one(p.grip[0], ` opacity="1"`), one(p.grip[1], ` opacity="0"`)];
      const inject = (s, inv) => s.replace('>', `>${fade(inv)}`);
      return { under: inject(g1.under, true) + inject(g2.under, false), over: inject(g1.over, true) + inject(g2.over, false) };
    }
    return one(p.grip || (front ? 'end' : 'neutral'));
  }
  const a = prj(posOf(A));
  const move = animV('transform', FR.map((J) => pt2(prj(posOf(J)))), 'animateTransform', 'type="translate" ');
  const place = (s) => `<g transform="translate(${pt2(a)})">${move}${s}</g>`;
  if (p.t === 'kb') return { own: true, under: place(`<path d="M-5.5 5V-.5a5.5 5.5 0 0111 0V5" fill="none" stroke="${L}" stroke-width="5"/><path d="M-5.5 5V-.5a5.5 5.5 0 0111 0V5" fill="none" stroke="${PAL.kb}" stroke-width="2.6"/><circle cx="0" cy="12" r="9" fill="${PAL.kb}" stroke="${L}" stroke-width="1.5"/><path d="M-4 8a5 5 0 014-2" stroke="#6B7280" stroke-width="1.6" fill="none" stroke-linecap="round"/>`), over: '' };
  // Punto fijo de la banda: sobre la columna (de perfil, en el centro; de frente, a la altura de la mano en la postura a).
  const M = (x, y) => (front ? [A[p.at][0], 150 - y, 100 - x] : [x - 100, 150 - y, 0]);
  if (p.t === 'towel') {   // toalla enrollada entre las dos manos
    const grip = (J, k) => (J['G' + k.slice(-1)] ? mix3(J[k], J['G' + k.slice(-1)], 0.55) : J[k]);   // con mano articulada, en el puño
    const ln = (w, extra) => path((J) => `M${pt2(prj(grip(J, p.at)))}L${pt2(prj(grip(J, p.to)))}`, `fill="none" stroke-width="${w}" stroke-linecap="round" ${extra}`);
    return { under: ln(9, `stroke="${L}"`) + ln(6.4, 'stroke="#7FB3D5"') + ln(6.4, 'stroke="#5E97BF" stroke-dasharray="2 3"'), over: '' };
  }
  if (p.t === 'band') {
    const anchor = () => prj(M(p.x, p.y));
    return { under: path((J) => `M${pt2(anchor(J))}L${pt2(prj(J[p.at]))}`, 'fill="none" stroke="#E5484D" stroke-width="3" stroke-linecap="round"') + path((J) => circlePath(anchor(J), 3), `fill="#E5484D" stroke="${L}" stroke-width="1"`), over: '' };
  }
  if (p.t === 'arrow') {   // hacia dónde se hace fuerza (isométricos): flecha naranja que late, junto a la mano
    const ax = (J, k) => add3(add3(J[p.at], [0, 10, 0]), scl3(p.dir, k));
    const head = (J) => {
      const a2 = prj(ax(J, -13)), b2 = prj(ax(J, 4)), [ux, uy] = unit(b2[0] - a2[0], b2[1] - a2[1]), m = [-uy, ux], c = [b2[0] - ux * 6, b2[1] - uy * 6];
      return `M${pt2(a2)}L${pt2(c)}M${pt2([c[0] + m[0] * 4.5, c[1] + m[1] * 4.5])}L${pt2(b2)}L${pt2([c[0] - m[0] * 4.5, c[1] - m[1] * 4.5])}Z`;
    };
    const pulse = animate ? '<animate attributeName="opacity" values=".35;1;.35" dur="1.2s" repeatCount="indefinite"/>' : '';
    return { under: '', over: `<g>${pulse}${path(head, `fill="${L}" stroke="${L}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`)}${path(head, 'fill="#FF6B2C" stroke="#FF6B2C" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"')}</g>` };
  }
  if (p.t === 'ring') {
    const top = (J) => prj([J[p.at][0], 175, J[p.at][2]]);
    return { under: path((J) => { const w = prj(J[p.at]); return `M${pt2(top(J))}L${pt2([w[0], w[1] - 5])}`; }, 'fill="none" stroke="#1F2937" stroke-width="2.2"')
      + path((J) => circlePath(prj(J[p.at]), 5.5), `fill="none" stroke="${L}" stroke-width="3.6"`) + path((J) => circlePath(prj(J[p.at]), 5.5), 'fill="none" stroke="#8B5E3C" stroke-width="2"'), over: '' };
  }
  return { under: '', over: '' };
}
