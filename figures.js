// Ilustraciones de ejercicios en vista isométrica: personaje atlético con ropa (remera amarilla ajustada, short gris,
// zapatillas), con contorno, luz y sombra, animado entre la postura a y la b (SMIL, sin librerías). Generadas por código:
// sin imágenes de terceros. Las posturas de data.js son de perfil (o de frente); acá se pasan a 3D (x adelante, y arriba,
// z hacia la derecha del personaje) y se proyectan con una cámara isométrica. Cada parte es un miembro con perfil muscular
// (deltoides, bíceps, cuádriceps, gemelo…) proyectado; se anima interpolando su contorno (atributo d) en varios fotogramas
// intermedios calculados por ángulos, así los miembros no se acortan a mitad de camino. Las partes de un miembro forman una
// sola silueta, los miembros se ordenan por profundidad, una luz fija (arriba a la izquierda) sombrea cada parte, el
// músculo que trabaja se ilumina con un resplandor rojo y una línea punteada marca el recorrido del movimiento.

const PAL = {
  line: '#22262D', skin: '#F2C9A6', skin2: '#D9A07A', shirt: '#F6C514', shirt2: '#CFA20A', shorts: '#5E6673', shorts2: '#434A56',
  shoe: '#FFFFFF', shoe2: '#C9CED6', hair: '#3A2A1F', db: '#2F7BEA', db2: '#1F5FBF', bar: '#9AA3AF', kb: '#33383F',
  wood: '#8A5A3C', wood2: '#6E452D', wall: '#E3E6EA', floor: '#E6E9ED', floor2: '#CDD2D8', floor3: '#BAC0C8',
  shade: 'rgba(40,28,16,.15)', light: 'rgba(255,255,255,.32)', muscle: '#E5262E', guide: '#FF6B2C',
};
const OW = 3.2;   // grosor del contorno: la mitad queda afuera de la silueta
const LS = [-0.55, -0.835];   // hacia la luz, en pantalla (arriba a la izquierda)

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
      let z = zo[k + n] ?? zo[k] ?? (k === 'G' ? zo['W' + n] ?? zo.W : null) ?? LIMB_Z[k];   // z: { W2: … } vale solo para ese lado
      if (front && zo[k] == null && zo[k + n] == null) z = Math.max(s * (100 - p[0]), z);
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
// Fotogramas de la animación: 11 posturas con aceleración suave (ida); la animación va y vuelve con una pausa en cada extremo.
const FRAMES = 10, easeT = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
function framesOf(f, frames = FRAMES) {
  const A = pose3D(f.a, f), B = f.b ? pose3D({ ...f.a, ...f.b }, f) : null;
  const ts = Array.from({ length: frames + 1 }, (_, i) => easeT(i / frames));
  if (!B && f.roll) return { FR: ts.map((t) => ({ ...A, roll: f.roll[0] + (f.roll[1] - f.roll[0]) * t })), ts, A, B };   // solo gira la mano
  if (!B) return { FR: [A], ts: [0], A, B };
  return { FR: ts.map((t) => poseAt(A, B, t)), ts, A, B };
}
// Ciclo de la animación: ida, pausa, vuelta, pausa (como una repetición real: subir, sostener, bajar). Devuelve los
// valores en ese orden y los tiempos clave (fracción del ciclo) de cada uno.
const HOLD = 0.08;
function loopOf(vals) {
  const n = vals.length, values = [vals[0], ...vals, vals[n - 1], ...vals.slice(0, -1).reverse()];
  const kt = (i) => Math.round((HOLD + ((0.5 - HOLD) * i) / (n - 1)) * 1000) / 1000;
  const keyTimes = [0, ...Array.from({ length: n }, (_, i) => kt(i)), ...Array.from({ length: n }, (_, i) => Math.round((0.5 + kt(i)) * 1000) / 1000)];
  return { values, keyTimes };
}
const timing = (keyTimes, dur, calc = 'linear') => `keyTimes="${keyTimes.join(';')}" calcMode="${calc}" dur="${dur}" repeatCount="indefinite"`;

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
// Curva suave por una lista de puntos 2D (Catmull-Rom → Bézier cúbicas), cerrada o abierta. Con la misma cantidad de
// puntos tiene siempre la misma estructura, así se puede animar el atributo d.
// Como la curva es continua, desde el segundo tramo alcanza con el comando S (el primer control es el reflejo del anterior).
function blob(P, closed = true) {
  const n = P.length, at = (i) => P[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt2(P[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += (i ? 'S' : `C${pt2([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} `) + `${pt2([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt2(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// Tono más claro (k > 0, hacia el blanco) o más oscuro (k < 0, hacia el negro) de un color #rrggbb.
function tint(hex, k) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// Disco 3D (centro, normal, radio) proyectado: devuelve centro y semiejes (el primero, el mayor).
function disc(c3, n, R) {
  let e1 = cross3(n, CAM.v); if (Math.hypot(...e1) < 1e-3) e1 = cross3(n, [0, 1, 0]);
  e1 = unit3(e1); const e2 = unit3(cross3(n, e1));
  return [prj(c3), prjV(scl3(e1, R)), prjV(scl3(e2, R))];
}
// Aro 3D (centro, semiejes A y B en 3D): solo la mitad que mira a la cámara, como el ruedo de una manga o una cintura.
function ring(c, A, B) {
  const a = dot3(unit3(A), CAM.v), b = dot3(unit3(B), CAM.v), f = Math.atan2(b, a);
  return blob(Array.from({ length: 7 }, (_, i) => { const g = f - Math.PI / 2 + (Math.PI * i) / 6; return prj(add3(c, add3(scl3(A, Math.cos(g)), scl3(B, Math.sin(g))))); }), false);
}
// Aro alrededor de un hueso de dirección d, de radio R.
function ringOn(c, d, R) {
  let e1 = cross3(d, [0, 1, 0]); if (Math.hypot(...e1) < 1e-3) e1 = cross3(d, [1, 0, 0]);
  e1 = unit3(e1); const e2 = unit3(cross3(d, e1));
  return ring(c, scl3(e1, R), scl3(e2, R));
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

// ——— Perfiles musculares ———
// Medio ancho base a lo largo de cada hueso (t de 0 a 1) y vientres hacia adelante (front) y atrás (back): deltoides y
// bíceps en el brazo, extensores en el antebrazo, cuádriceps e isquios en el muslo, gemelo en la pierna.
const lin = (pts, t) => { let i = 1; while (i < pts.length - 1 && pts[i][0] < t) i++; const [t0, w0] = pts[i - 1], [t1, w1] = pts[i]; return w0 + ((w1 - w0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))); };
const bump = (c, w, h) => (t) => h * Math.exp(-(((t - c) / w) ** 2));
const PROF = {
  ua: { base: [[0, 6.4], [0.2, 6.1], [0.5, 5.5], [0.8, 4.9], [1, 4.4]], front: bump(0.56, 0.22, 1.3), back: bump(0.5, 0.25, 0.8) },
  fa: { base: [[0, 4.6], [0.25, 4.9], [0.5, 4.2], [0.8, 3.5], [1, 3.2]], front: bump(0.25, 0.2, 0.7), back: bump(0.3, 0.22, 0.6) },
  th: { base: [[0, 8.8], [0.3, 8.5], [0.6, 7.5], [0.85, 6.4], [1, 6]], front: bump(0.55, 0.22, 1.4), back: bump(0.4, 0.25, 0.9) },
  sh: { base: [[0, 5.8], [0.2, 5.9], [0.5, 4.9], [0.8, 3.9], [1, 3.6]], front: bump(0.4, 0.3, 0.3), back: bump(0.3, 0.17, 1.6) },
};
// Torso en V: hombros y espalda anchos, cintura más fina, cadera un poco más ancha (semiejes al costado y hacia adelante).
const TO_SIDE = [[0, 14.2], [0.15, 13.6], [0.4, 12.2], [0.65, 10.4], [0.85, 10.8], [1, 11.4]], TO_FWD = [[0, 8], [0.15, 9.2], [0.4, 8.8], [0.65, 7.6], [1, 8]];
const STA = [0, 0.2, 0.45, 0.72, 1];   // estaciones a lo largo del hueso
// Contorno de un miembro de p a q (2D) con medio ancho w(t, lado) (lado +1 sobre la normal, −1 el otro, 0 el promedio),
// entre t0 y t1, con puntas redondeadas (cap: cuánto sobresalen, en radios). 16 puntos, siempre los mismos.
function limbPts(p, q, w, t0 = 0, t1 = 1, cap = [0.9, 0.9]) {
  const [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), n = [-uy, ux];
  const at = (t, s) => { const c = mix(p, q, t), r = w(t, s) * s; return [c[0] + n[0] * r, c[1] + n[1] * r]; };
  const tip = (t, k, s) => { const c = mix(p, q, t), r = w(t, 0), a = k * (s ? 0.7 : 1) * r, b = s ? 0.75 * r * s : 0; return [c[0] + ux * a + n[0] * b, c[1] + uy * a + n[1] * b]; };
  const st = STA.map((t) => t0 + (t1 - t0) * t);
  return [tip(t0, -cap[0], 0), tip(t0, -cap[0], 1), ...st.map((t) => at(t, 1)), tip(t1, cap[1], 1), tip(t1, cap[1], 0), tip(t1, cap[1], -1), ...st.slice().reverse().map((t) => at(t, -1)), tip(t0, -cap[0], -1)];
}
// Media luna de sombra (o de brillo) de un miembro: del borde del lado s hacia adentro, con intensidad k (0 = nada).
function rimPts(p, q, w, s, k, t0 = 0, t1 = 1, inset = 0.42) {
  const [ux, uy] = unit(q[0] - p[0], q[1] - p[1]), n = [-uy, ux];
  const st = STA.map((t) => t0 + (t1 - t0) * t), ins = (i) => (i === 0 || i === STA.length - 1 ? 0.3 : 1) * inset * k;
  const at = (t, i, f) => { const c = mix(p, q, t), r = w(t, s) * s * (1 - f); return [c[0] + n[0] * r, c[1] + n[1] * r]; };
  return [...st.map((t, i) => at(t, i, i === 0 || i === STA.length - 1 ? 0.08 : 0)), ...st.map((t, i) => at(t, i, ins(i))).reverse()];
}

// Segmentos 3D [desde, hasta, radio inicial, radio final]. El del torso usa el ancho proyectado de su sección.
function segOf(key, J, n) {
  if (key === 'ua') return J['E' + n] && [J['S' + n], J['E' + n], 6.4, 4.4];
  if (key === 'fa') return J['W' + n] && [J['E' + n], J['W' + n], 4.6, 3.2];
  if (key === 'th') return J['K' + n] && [J['Hp' + n], J['K' + n], 8.8, 6];
  if (key === 'sh') return J['F' + n] && [J['K' + n], J['F' + n], 5.8, 3.6];
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
let FIG_N = 0;   // para que los degradados y las formas de cada SVG tengan id propio (conviven muchos en una pantalla)
function figureSVG(ex, { animate = true, size = '', crop = false, muscles = true, at = null } = {}) {
  const f = ex.fig, L = PAL.line, fr = framesOf(f, crop ? 6 : FRAMES), uid = (++FIG_N).toString(36), detail = !crop;
  CAM = camera(pickCam(ex, fr.FR), ex.fig.pitch);
  const FR = at == null ? fr.FR : [f.roll && !fr.B ? { ...fr.A, roll: f.roll[0] + (f.roll[1] - f.roll[0]) * at } : poseAt(fr.A, fr.B, at)], ts = at == null ? fr.ts : [at], A = FR[0], moving = FR.length > 1;
  const dur = `${f.dur || 3}s`;
  // Animación por fotogramas: ida por las posturas, pausa, vuelta y pausa (la suavidad ya está en las posturas).
  const animV = (attr, vals, tag = 'animate', extra = '') => {
    if (!animate || !moving || vals.every((v) => v === vals[0])) return '';
    const { values, keyTimes } = loopOf(vals);
    return `<${tag} attributeName="${attr}" ${extra}values="${values.join(';')}" ${timing(keyTimes, dur)}/>`;
  };
  // Forma que depende de la postura: se calcula en cada fotograma y se anima el contorno.
  const path = (fn, attrs, extra = '') => {
    const ds = FR.map(fn); if (!ds[0]) return '';
    return `<path d="${ds[0]}" ${attrs}>${animV('d', ds)}${extra}</path>`;
  };
  // La misma forma dibujada dos veces (contorno y relleno) se define una sola vez y se reutiliza con <use>.
  let defs = '', pid = 0;
  const shape = (fn) => { const ds = FR.map(fn); if (!ds[0]) return null; const id = `p${uid}-${pid++}`; defs += `<path id="${id}" d="${ds[0]}">${animV('d', ds)}</path>`; return id; };
  // Una sola silueta por grupo: primero todas las formas engrosadas en color de línea, después los rellenos sin borde,
  // después sombras y detalles (decor) y por último los músculos (over).
  const group = (parts, decor = '', over = '') => {
    const ids = parts.map(([fn]) => shape(fn));
    return ids.map((id) => id && `<use href="#${id}" fill="${L}" stroke="${L}" stroke-width="${OW}" stroke-linejoin="round"/>`).join('')
      + ids.map((id, i) => id && `<use href="#${id}" fill="${parts[i][1]}"/>`).join('') + decor + over;
  };
  // Rellenos con volumen: cada parte lleva un degradado de su color, más claro arriba a la izquierda (de donde viene la
  // luz) y más oscuro abajo a la derecha; sigue a la forma en la animación sin costo.
  for (const k of ['skin', 'skin2', 'shirt', 'shirt2', 'shorts', 'shorts2', 'shoe', 'shoe2']) defs += `<linearGradient id="g${uid}${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint(PAL[k], 0.24)}"/><stop offset=".45" stop-color="${PAL[k]}"/><stop offset="1" stop-color="${tint(PAL[k], -0.2)}"/></linearGradient>`;
  const shade = (n, k) => `url(#g${uid}${k}${n === '2' ? '2' : ''})`;
  const seg2 = (key, J, n) => { const s = segOf(key, J, n); return s && [prj(s[0]), prj(s[1]), s[2], s[3]]; };
  const norm2 = ([p, q]) => { const [ux, uy] = unit(q[0] - p[0], q[1] - p[1]); return [-uy, ux]; };
  // Geometría 2D de una parte: segmento, función de ancho (con los vientres hacia el lado que mira adelante) y puntas.
  const geo = (key, J, n, extra = 0) => {
    if (key === 'to') { const s = [prj(mix3(J.N, J.P, -0.08)), prj(mix3(J.N, J.P, 0.9))], m = norm2(s); return { s, w: (t) => halfWidth(J, lin(TO_SIDE, t), lin(TO_FWD, t), m), cap: [0.28, 0.35] }; }
    if (key === 'pv') {   // pelvis: abulta hacia atrás (glúteos), de frente queda plana
      const s = [prj(mix3(J.N, J.P, 0.7)), prj(mix3(J.N, J.P, 1.04))], m = norm2(s), bk = prjV(scl3(J.fw, -1)), fac = bk[0] * m[0] + bk[1] * m[1], glute = bump(0.72, 0.28, 2.6);
      return { s, w: (t, sd = 0) => halfWidth(J, 10.6 + 1.6 * t, 7.4 + 0.6 * t, m) + (sd * fac > 0 ? sd * fac * glute(t) : 0), cap: [0.2, 0.42] };
    }
    const s = seg2(key, J, n); if (!s) return null;
    const pv = prjV(front3(f, key, J, n)), m = norm2(s), fac = pv[0] * m[0] + pv[1] * m[1], P = PROF[key];
    return { s, w: (t, sd = 0) => lin(P.base, t) + extra + (sd * fac > 0 ? sd * fac * P.front(t) : -sd * fac * P.back(t)), cap: [0.9, 0.9] };
  };
  const limb = (key, n, t0 = 0, t1 = 1, extra = 0) => (J) => { const g = geo(key, J, n, extra); return g ? blob(limbPts(g.s[0], g.s[1], g.w, t0, t1, g.cap)) : ''; };
  // Sombra del lado opuesto a la luz (o brillo del lado iluminado): se desvanece cuando el hueso apunta hacia la luz,
  // así la sombra cambia de lado sin saltos entre fotogramas.
  const rim = (key, n, t0 = 0, t1 = 1, extra = 0, lit = false) => (J) => {
    const g = geo(key, J, n, extra); if (!g) return '';
    const m = norm2(g.s), dl = m[0] * LS[0] + m[1] * LS[1];
    const side = (dl > 0 ? -1 : 1) * (lit ? -1 : 1), k = Math.min(1, Math.abs(dl) * 1.4);
    return blob(rimPts(g.s[0], g.s[1], g.w, side, k, t0, t1, lit ? 0.2 : 0.42));
  };
  const shadeOf = (key, n, t0, t1, extra) => path(rim(key, n, t0, t1, extra), `fill="${PAL.shade}"`);
  const lightOf = (key, n, t0, t1, extra) => path(rim(key, n, t0, t1, extra, true), `fill="${PAL.light}"`);
  const stroke = (fn, w, col = L, extra = '') => path(fn, `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}`);
  // Músculos iluminados: resplandor rojo que se funde con la piel, más intenso hacia la postura b (contracción); en los
  // isométricos, un latido suave. El tamaño no cambia.
  const mus = muscles ? ex.mus || [] : [];
  const glow = !animate ? '' : moving ? animV('opacity', ts.map((t) => r1(0.55 + 0.45 * t))) : '<animate attributeName="opacity" values=".6;1;.6" dur="2.4s" repeatCount="indefinite"/>';
  if (mus.length) defs += `<radialGradient id="mg${uid}"><stop offset="0" stop-color="#FF5A3C" stop-opacity=".95"/><stop offset=".45" stop-color="${PAL.muscle}" stop-opacity=".8"/><stop offset="1" stop-color="${PAL.muscle}" stop-opacity="0"/></radialGradient><radialGradient id="mg${uid}b"><stop offset="0" stop-color="#D33A2E" stop-opacity=".9"/><stop offset=".45" stop-color="#B81D24" stop-opacity=".75"/><stop offset="1" stop-color="#B81D24" stop-opacity="0"/></radialGradient>`;
  // Un músculo oculto (ancho 0) se reduce a un punto, así no queda dibujado.
  const musOn = (keys, n) => mus.flatMap((m, j) => (MUS[m] || []).map((def) => [def, j === 0])).filter(([[k]]) => keys.includes(k))
    .map(([def, primary]) => { const Ps = patchesOver(f, def, FR, n, primary); return path((J, i) => {
      const P = Ps[i]; if (!P) return '';
      const k = Math.min(1, P.w / 0.12), tm = (def[1] + def[2]) / 2, w = Math.min(P.w * 1.3, 0.98 - Math.abs(P.o));
      return lens(P.s2, P.o, tm + (def[1] - 0.04 - tm) * k, tm + (def[2] + 0.04 - tm) * k, w);
    }, `fill="url(#mg${uid}${n === '2' ? 'b' : ''})"`, glow); }).join('');

  // ——— Partes del cuerpo ———
  const sole = (n) => (J) => `M${pt2(prj(add3(J['F' + n], [0, -2.6, 0])))}L${pt2(prj(add3(J['T' + n], [0, -2.6, 0])))}`;
  const legParts = (n) => [
    [limb('th', n), shade(n, 'skin')], [limb('sh', n), shade(n, 'skin')], [limb('th', n, -0.02, 0.46, 0.9), shade(n, 'shorts')],
    [(J) => capsule(prj(J['F' + n]), prj(J['T' + n]), 4.6, 3.8), shade(n, 'shoe')],
  ];
  // Rótula: un óvalo chico sobre la rodilla, si mira a la cámara.
  const kneeFw = (n) => A['K' + n] && front3(f, 'th', A, n);
  // En las miniaturas (crop) no se dibujan los detalles finos (ruedos, rótula, suela, pulgar, pectorales): no se ven y pesan.
  const legDecor = (n) => !detail ? '' : stroke((J) => { const g = geo('th', J, n); return g ? ringOn(mix3(J['Hp' + n], J['K' + n], 0.46), unit3(sub3(J['K' + n], J['Hp' + n])), g.w(0.46, 0) + 0.9) : ''; }, 1.3, shade(n, 'shorts2'))
    + (kneeFw(n) && dot3(kneeFw(n), CAM.v) > 0.35 ? path((J) => circlePath(prj(add3(J['K' + n], scl3(front3(f, 'th', J, n), 4.6))), 1.9), `fill="${PAL.skin2}" opacity=".45"`) : '')
    + stroke(sole(n), 2.4, PAL.shoe2);
  const armParts = (n) => [[limb('ua', n), shade(n, 'skin')], [limb('fa', n), shade(n, 'skin')], [limb('ua', n, -0.08, 0.42, 0.9), shade(n, 'shirt')]];
  const armDecor = (n) => !detail ? '' : stroke((J) => { const g = geo('ua', J, n); return g ? ringOn(mix3(J['S' + n], J['E' + n], 0.42), unit3(sub3(J['E' + n], J['S' + n])), g.w(0.42, 0) + 0.9) : ''; }, 1.3, shade(n, 'shirt2'));
  // Mano: puño con pulgar; si la postura trae la punta de la mano (G), una cápsula que gira en la muñeca.
  const hand = (n) => {
    const fist = (J) => (J['G' + n] ? capsule(prj(J['W' + n]), prj(J['G' + n]), 3.6, 4) : J['W' + n] ? circlePath(prj(J['W' + n]), 4.2) : '');
    const thumb = (J) => {
      if (!J['W' + n]) return '';
      const w = prj(J['W' + n]), e = prj(J['E' + n]), d = unit(w[0] - e[0], w[1] - e[1]);
      let m = [-d[1], d[0]]; if (m[1] > 0) m = [-m[0], -m[1]];   // el pulgar queda arriba
      const c = J['G' + n] ? mix(w, prj(J['G' + n]), 0.35) : [w[0] + d[0] * 1.2, w[1] + d[1] * 1.2];
      return circlePath([c[0] + m[0] * 3.2, c[1] + m[1] * 3.2], 1.8);
    };
    // Palma indicada (ejercicios de muñeca): palma arriba, la palma clara mirando hacia arriba con el pliegue de los dedos;
    // palma abajo, el dorso arriba con los nudillos marcados.
    const side = (J) => { const w = prj(J['W' + n]), g = prj(J['G' + n]), d = unit(g[0] - w[0], g[1] - w[1]), u = unit(...prjV(palmUp(J, n))); return { w, g, d, u }; };
    const marks = !(f.palm && A['G' + n] && detail) ? '' : f.palm === 'up'
      ? path((J) => { const { w, g, u } = side(J), c = mix(w, g, 0.5); return ellipse([c[0] + u[0] * 1.6, c[1] + u[1] * 1.6], scl3([...unit(g[0] - w[0], g[1] - w[1]), 0], 3.4).slice(0, 2), [u[0] * 1.9, u[1] * 1.9]); }, `fill="#F9DECB"`)
        + stroke((J) => { const { w, g, u } = side(J), a = mix(w, g, 0.72); return `M${pt2([a[0] + u[0] * 2.8, a[1] + u[1] * 2.8])}L${pt2([a[0] - u[0] * 0.6, a[1] - u[1] * 0.6])}`; }, 1, PAL.skin2)
      : stroke((J) => { const { w, g, d, u } = side(J); return [0.62, 0.8, 0.98].map((t) => { const c = mix(w, g, t), r = 3.9 - t; return `M${pt2([c[0] + u[0] * r - d[0], c[1] + u[1] * r - d[1]])}Q${pt2([c[0] + u[0] * (r + 1.1), c[1] + u[1] * (r + 1.1)])} ${pt2([c[0] + u[0] * r + d[0], c[1] + u[1] * r + d[1]])}`; }).join(''); }, 1, PAL.skin2);
    return group([[fist, shade(n, 'skin')], ...(detail && !f.palm ? [[thumb, shade(n, 'skin')]] : [])]).replace(`stroke-width="${OW}"`, 'stroke-width="2.2"').replace(`stroke-width="${OW}"`, 'stroke-width="2.2"') + marks;
  };
  const torso = limb('to', '1'), pelvis = limb('pv', '1');
  // Detalles del torso: cuello de la remera, cintura del short, pectorales y abdomen (de frente) o columna (de espaldas).
  const sp = (J, t, g, k = 1) => prj(add3(mix3(J.N, J.P, t), add3(scl3(J.fw, lin(TO_FWD, t) * Math.cos(g) * k), scl3(J.lat, lin(TO_SIDE, t) * Math.sin(g) * k))));
  const facing = dot3(A.fw, CAM.v);
  // De espaldas o de costado-atrás: la costura del short entre los glúteos.
  const seam = detail && facing < -0.15 ? stroke((J) => `M${pt2(prj(add3(mix3(J.N, J.P, 0.82), scl3(J.fw, -8.4))))}Q${pt2(prj(add3(mix3(J.N, J.P, 0.95), scl3(J.fw, -10.6))))} ${pt2(prj(add3(mix3(J.N, J.P, 1.06), scl3(J.fw, -7))))}`, 1.2, PAL.shorts2) : '';
  const torsoDecor = shadeOf('pv', '1') + seam + shadeOf('to', '1') + lightOf('to', '1') + (!detail ? '' : stroke((J) => ring(mix3(J.N, J.P, 0.72), scl3(J.lat, 11), scl3(J.fw, 7.6)), 2.2, PAL.shorts2)
    + stroke((J) => ring(add3(J.N, scl3(J.up, -2.5)), scl3(J.lat, 6.4), scl3(J.fw, 4.6)), 1.5, PAL.shirt2)
    + (facing > 0.3 ? [-1, 1].map((k) => stroke((J) => `M${pt2(sp(J, 0.19, k * 0.8, 1.02))}Q${pt2(sp(J, 0.34, k * 0.42, 1.04))} ${pt2(sp(J, 0.31, k * 0.06, 1.03))}`, 1.1, PAL.shirt2, ' opacity=".7"')).join('')
      + stroke((J) => `M${pt2(sp(J, 0.4, 0, 1.02))}L${pt2(sp(J, 0.7, 0, 1.02))}M${pt2(sp(J, 0.5, -0.3, 1.02))}L${pt2(sp(J, 0.5, 0.3, 1.02))}M${pt2(sp(J, 0.6, -0.27, 1.02))}L${pt2(sp(J, 0.6, 0.27, 1.02))}`, 1, PAL.shirt2, ' opacity=".5"') : '')
    + (facing < -0.3 ? stroke((J) => `M${pt2(sp(J, 0.08, Math.PI, 1.02))}L${pt2(sp(J, 0.66, Math.PI, 1.02))}`, 1.1, PAL.shirt2, ' opacity=".6"')
      + [-1, 1].map((k) => stroke((J) => `M${pt2(sp(J, 0.12, Math.PI + k * 0.75, 1.03))}Q${pt2(sp(J, 0.3, Math.PI + k * 0.5, 1.04))} ${pt2(sp(J, 0.36, Math.PI + k * 0.15, 1.03))}`, 1, PAL.shirt2, ' opacity=".55"')).join('') : ''));

  // Cabeza y cara: puntos sobre la cabeza en ejes adelante (a), arriba (b) y costado derecho (c).
  const HR = 10.6, fp = (J, a, b, c) => prj(add3(J.H, add3(scl3(J.fw, a), add3(scl3(J.up, b), scl3(J.lat, c)))));
  const faces = (a, b, c) => dot3(unit3(add3(scl3(A.fw, a), add3(scl3(A.up, b), scl3(A.lat, c)))), CAM.v) > 0.12;
  // Óvalo de la cabeza (apenas más alto que ancho) en los ejes de pantalla del cuerpo.
  const axes = (J) => { let u = prjV(J.up); u = Math.hypot(...u) < 0.2 ? [0, -1] : unit(...u); return [[-u[1] * HR * 0.98, u[0] * HR * 0.98], [u[0] * HR * 1.05, u[1] * HR * 1.05]]; };
  const skull = (J) => { const [a, b] = axes(J); return ellipse(prj(J.H), a, b); };
  const skullShade = (J) => {   // media luna abajo a la derecha (lado opuesto a la luz), dentro del óvalo
    const [a, b] = axes(J), c = prj(J.H), D = [-LS[0], -LS[1]], g0 = Math.atan2(D[0] * b[0] + D[1] * b[1], D[0] * a[0] + D[1] * a[1]);
    const P = Array.from({ length: 7 }, (_, i) => { const g = g0 - 1.3 + (2.6 * i) / 6, k = 0.93; return [c[0] + (a[0] * Math.cos(g) + b[0] * Math.sin(g)) * k, c[1] + (a[1] * Math.cos(g) + b[1] * Math.sin(g)) * k]; });
    return blob([...P, ...P.map((p, i) => { const k = 0.64 + 0.3 * Math.abs(i - 3) / 3; return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]; }).reverse()]);
  };
  const hair = (J) => {   // casquete: arco por arriba y atrás de la cabeza, de la nuca a la frente, con un mechón adelante
    // Visto de atrás (la cara mira lejos de la cámara) el pelo cubre casi toda la cabeza.
    const c = prj(J.H), u = unit(...prjV(J.up)), fw = prjV(J.fw), h = unit(u[0] - fw[0] * 0.8, u[1] - fw[1] * 0.8), R = HR + 0.6;
    const away = Math.max(0, -dot3(J.fw, CAM.v)), b0 = -1.85 - away * 0.9, f0 = 1.15 + away * 1.6;
    const at = (ang, r) => { const cs = Math.cos(ang), sn = Math.sin(ang); return [c[0] + (h[0] * cs - h[1] * sn) * r, c[1] + (h[0] * sn + h[1] * cs) * r]; };
    return `M${pt2(at(b0, R))}A${R} ${R} 0 1 1 ${pt2(at(f0, R))}Q${pt2(at(f0 + 0.2, R * 1.02))} ${pt2(at(f0 + 0.55, R * 0.6))}Q${pt2(at((b0 + f0) / 2 + Math.PI, HR * (0.3 + away * 0.5)))} ${pt2(at(b0, R))}Z`;
  };
  const ear = faces(0, 0, 1) ? [[(J) => circlePath(fp(J, 1.2, -1.8, HR - 0.4), 2.6), PAL.skin]] : [];
  const nose = faces(1, 0, 0) || dot3(A.fw, CAM.v) > -0.5 ? [[(J) => circlePath(fp(J, HR - 0.4, -0.8, 0), 2.2), PAL.skin]] : [];
  // Ojos y cejas (bajan con el esfuerzo hacia la postura b), boca, nariz y oreja según hacia dónde mira la cara.
  const faceParts = [-1, 1].filter((k) => faces(0.9, 0.15, k * 0.36) && dot3(unit3(add3(scl3(A.fw, 0.9), add3(scl3(A.up, 0.15), scl3(A.lat, k * 0.36)))), CAM.v) > 0.42).map((k) =>
    path((J) => circlePath(fp(J, 9.6, 1.6, k * 3.9), 1.5), `fill="${L}"`)
    + stroke((J, i) => `M${pt2(fp(J, 9.4, 4.4 - 1.1 * ts[i], k * 2.3))}L${pt2(fp(J, 8.8, 5.2, k * 5.7))}`, 1.3)).join('')
    + (faces(0.9, -0.4, 0) ? stroke((J) => `M${pt2(fp(J, 9.4, -4.6, -2.6))}Q${pt2(fp(J, 10.4, -6.6, 0))} ${pt2(fp(J, 9.4, -4.6, 2.6))}`, 1.2)
      + path((J) => circlePath(fp(J, HR + 0.6, -1.4, 0.3), 0.9), `fill="${PAL.skin2}"`) : '')
    + (ear.length ? stroke((J) => `M${pt2(fp(J, 2.2, 0.4, HR))}Q${pt2(fp(J, 0, -1, HR + 0.4))} ${pt2(fp(J, 2.2, -3.6, HR))}`, 1) : '');
  const head = group([
    [(J) => capsule(prj(J.N), prj(mix3(J.N, J.H, 0.55)), 4.8, 4.4), shade('1', 'skin')], ...ear, ...nose,
    [skull, shade('1', 'skin')], [hair, PAL.hair],
  ], path(skullShade, `fill="${PAL.shade}"`), faceParts);

  // ——— Objetos (mancuernas, pesa rusa, aros, banda, toalla) ———
  const props = [];
  for (const p of f.props || []) {
    props.push(p);
    const mirrored = f.a.W2 === undefined && !f.front && !f.z?.W && !f.one;
    if (p.at === 'W1' && mirrored && ['db', 'ring', 'band'].includes(p.t)) props.push({ ...p, at: 'W2' });
  }
  const ctxP = { path, group, animV, animate, front: !!f.front, dur, palm: f.palm };
  const propsOf = (n) => props.filter((p) => p.at.slice(-1) === n).map((p) => propSVG(p, FR, ts, ctxP));
  const arm = (n) => {
    const ps = propsOf(n).filter((p) => !p.own);
    return group(armParts(n), armDecor(n), musOn(['ua', 'fa'], n)) + ps.map((p) => p.under).join('') + hand(n) + ps.map((p) => p.over).join('');
  };

  // Grupos ordenados por profundidad (promedio de los fotogramas).
  const zOf = (fn) => FR.reduce((s, J) => s + fn(J), 0) / FR.length;
  const avgD = (keys) => (J) => keys.filter((k) => J[k]).reduce((s, k, _, arr) => s + depth(J[k]) / arr.length, 0);
  const groups = [
    { z: zOf(avgD(['N', 'P'])), svg: group([[pelvis, shade('1', 'shorts')], [torso, shade('1', 'shirt')]], torsoDecor, musOn(['to'], '1')) },
    { z: zOf((J) => depth(J.H)) + 4, svg: head },
    // La pesa rusa se ordena sola por su profundidad (la campana cuelga debajo del mango): de atrás queda tapada por el cuerpo.
    ...props.filter((p) => p.t === 'kb').map((p) => {
      const c = (J) => { const w = p.mid ? mix3(J.W1, J.W2, 0.5) : J[p.at]; return [w[0], w[1] - 12, w[2]]; };
      return { z: zOf((J) => depth(c(J))) - 1, svg: propSVG(p, FR, ts, ctxP).under };
    }),
    ...['1', '2'].flatMap((n) => [
      { z: zOf(avgD(['S' + n, 'E' + n, 'W' + n])) + 2, svg: arm(n) },
      { z: zOf(avgD(['Hp' + n, 'K' + n, 'F' + n])), svg: group(legParts(n), legDecor(n), musOn(['th', 'sh'], n)) },
    ]),
  ].sort((a, b) => a.z - b.z);

  // Piso: baldosa isométrica que abarca al personaje y la escena; sombra difusa debajo del cuerpo, que lo sigue.
  const pts3 = FR.flatMap((J) => ['N', 'P', 'H', 'S1', 'S2', 'E1', 'E2', 'W1', 'W2', 'G1', 'G2', 'K1', 'K2', 'F1', 'F2', 'T1', 'T2'].filter((k) => J[k]).map((k) => J[k]));
  const scene = (f.scene || []).map((s) => sceneBoxes(s, !!f.front, A));
  const sceneP = scene.flatMap((s) => s.pts);
  const xs = [...pts3, ...sceneP].map((p) => p[0]), zs = [...pts3, ...sceneP].map((p) => p[2]);
  const X0 = Math.min(...xs) - 18, X1 = Math.max(...xs) + 18, Z0 = Math.min(-26, ...zs) - 12, Z1 = Math.max(26, ...zs) + 12;
  defs += `<radialGradient id="sg${uid}"><stop offset="0" stop-color="#262A31" stop-opacity=".22"/><stop offset=".6" stop-color="#262A31" stop-opacity=".12"/><stop offset="1" stop-color="#262A31" stop-opacity="0"/></radialGradient><linearGradient id="fg${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EEF0F3"/><stop offset="1" stop-color="#DCE0E5"/></linearGradient>`;
  const floor = box([X0, X1], [-7, 0], [Z0, Z1], [`url(#fg${uid})`, PAL.floor2, PAL.floor3], 'rgba(34,38,45,.18)');
  const shadow = path((J) => {
    const F = J.F1 || J.P, c = [(J.P[0] + F[0]) / 2, 0, (J.P[2] + F[2]) / 2], k = 0.8 + 0.3 * Math.max(0, 1 - Math.max(0, J.P[1]) / 90), sh = disc(c, [0, 1, 0], 1);
    return ellipse(sh[0], scl3([...sh[1], 0], 32 * k).slice(0, 2), scl3([...sh[2], 0], 19 * k).slice(0, 2));
  }, `fill="url(#sg${uid})"`);

  // Guía del recorrido: línea punteada por donde va la mano (o el pie, la cadera…) que más se mueve, con flecha en la
  // postura b y un punto que la recorre al ritmo de la animación. Solo en la vista grande.
  let guide = '', guidePts = [];
  if (!crop && moving && fr.B) {
    let best = null;
    for (const k of ['G1', 'W1', 'G2', 'W2', 'F2', 'K2', 'F1', 'K1', 'N', 'P']) {   // la cabeza no: la guía taparía la cara
      if (!FR.every((J) => J[k])) continue;
      const P = FR.map((J) => prj(J[k])), span = Math.max(...P.map((q) => Math.hypot(q[0] - P[0][0], q[1] - P[0][1])));
      if (span > 6 && (!best || span > best.span * 1.15)) best = { P, span, k };
    }
    if (best) {
      // Corrida hacia afuera del cuerpo, paralela al movimiento, para no tapar la mano ni la pesa (más lejos si el
      // recorrido es corto, como en la muñeca, porque ahí la pesa ocupa casi todo el trayecto).
      const body = FR.map((J) => mix(prj(J.N), prj(J.P), 0.5)).reduce((s, q) => [s[0] + q[0] / FR.length, s[1] + q[1] / FR.length], [0, 0]);
      const mid = best.P.reduce((s, q) => [s[0] + q[0] / best.P.length, s[1] + q[1] / best.P.length], [0, 0]);
      const ch = unit(best.P.at(-1)[0] - best.P[0][0], best.P.at(-1)[1] - best.P[0][1]);   // de costado al recorrido, del lado de afuera del cuerpo
      let out = [-ch[1], ch[0]]; const side = out[0] * (mid[0] - body[0]) + out[1] * (mid[1] - body[1]);
      if (side < 0 || (Math.abs(side) < 2 && out[0] < 0)) out = [-out[0], -out[1]];
      const k = best.span < 20 ? 13 : 10;
      // La mano que gira en la muñeca: arco alrededor de la muñeca, más afuera que la punta de la mano.
      const pivot = best.k[0] === 'G' && FR.map((J) => prj(J['W' + best.k[1]]));
      const P = pivot ? best.P.map((q, i) => { const c = pivot[i], r = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1, s2 = (r + 9) / r; return [c[0] + (q[0] - c[0]) * s2, c[1] + (q[1] - c[1]) * s2]; })
        : best.P.map((q) => [q[0] + out[0] * k, q[1] + out[1] * k]), d = blob(P, false); guidePts = P; const e = P[P.length - 1], [ux, uy] = unit(e[0] - P[P.length - 2][0], e[1] - P[P.length - 2][1]), m = [-uy, ux];
      const tip = [e[0] + ux * 3, e[1] + uy * 3], arrow = `M${pt2(tip)}L${pt2([e[0] - ux * 2.6 + m[0] * 3.2, e[1] - uy * 2.6 + m[1] * 3.2])}L${pt2([e[0] - ux * 2.6 - m[0] * 3.2, e[1] - uy * 2.6 - m[1] * 3.2])}Z`;
      const dot = animate ? `<circle r="2.7" cx="${r1(P[0][0])}" cy="${r1(P[0][1])}" fill="${PAL.guide}" stroke="#FFF" stroke-width="1.3">${animV('cx', P.map((q) => r1(q[0])))}${animV('cy', P.map((q) => r1(q[1])))}</circle>` : '';
      guide = `<g class="guide"><path d="${d}" fill="none" stroke="#FFF" stroke-width="3.6" stroke-linecap="round" opacity=".6"/><path d="${d}" fill="none" stroke="${PAL.guide}" stroke-width="1.7" stroke-dasharray="2.6 3" stroke-linecap="round"/><circle cx="${r1(P[0][0])}" cy="${r1(P[0][1])}" r="1.8" fill="#FFF" stroke="${PAL.guide}" stroke-width="1.3"/><path d="${arrow}" fill="${PAL.guide}" stroke="#FFF" stroke-width="1" stroke-linejoin="round"/>${dot}</g>`;
    }
  }

  // Encuadre: miniaturas cuadradas alrededor del cuerpo; grande, 200×170 con el piso y la escena.
  const p2 = pts3.map(prj).concat(FR.map((J) => { const c = prj(J.H); return [c[0], c[1] - HR - 4]; }), FR.flatMap((J) => [[0, 13, 0], [0, -13, 0], [13, 0, 0], [-13, 0, 0]].map((o) => prj(add3(J.P, o)))));
  const fl = [[X0, -7, Z0], [X1, -7, Z0], [X0, -7, Z1], [X1, -7, Z1], [X1, 0, Z1]].map(prj);
  const bb = (ps) => [Math.min(...ps.map((q) => q[0])), Math.min(...ps.map((q) => q[1])), Math.max(...ps.map((q) => q[0])), Math.max(...ps.map((q) => q[1]))];
  let vb;
  if (crop) {
    const [x0, y0, x1, y1] = bb(p2), side = Math.max(x1 - x0, y1 - y0) + 28, cxx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
    vb = [cxx - side / 2, cyy - side / 2, side, side];
  } else {
    // focus: primer plano de unas articulaciones (p. ej. antebrazo y mano en los ejercicios de muñeca), con la guía.
    const near = f.focus && FR.flatMap((J) => f.focus.filter((k) => J[k]).map((k) => prj(J[k])));
    const [x0, y0, x1, y1] = near ? bb(near) : bb([...p2, ...fl, ...sceneP.map(prj)]), pad = near ? 34 : 16;
    let w = x1 - x0 + pad, h = y1 - y0 + pad;
    if (w / h > 200 / 170) h = (w * 170) / 200; else w = (h * 200) / 170;
    vb = [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }
  return `<svg class="fig ${size}" viewBox="${vb.map(r1).join(' ')}" role="img" aria-label="Ilustración: ${ex.name}"><defs>${defs}</defs>
    ${floor}${shadow}${scene.map((s) => s.svg).join('')}${groups.map((g) => g.svg).join('')}${guide}</svg>`;
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
  if (grip === 'side') return [0, 0, 1];                       // prono con los codos abiertos: mango de costado a costado
  const d = J['G' + n] ? unit3(sub3(J['G' + n], J['W' + n])) : unit3(sub3(J['W' + n], J['E' + n]));
  if (grip === 'along') return d;
  const a = [-d[1], d[0], 0], neutral = front || Math.hypot(...a) < 1e-3 ? [1, 0, 0] : unit3(a);
  if (grip !== 'roll') return neutral;
  // Pronación y supinación: el mango gira alrededor del antebrazo, de neutro (0°) hacia los costados (±90°).
  const g = ((J.roll || 0) * Math.PI) / 180, side = unit3(cross3(d, neutral));
  return add3(scl3(neutral, Math.cos(g)), scl3(side, Math.sin(g)));
}
// Perpendicular a la mano (de la muñeca a la punta) en el plano vertical, hacia arriba: el lado de la palma si mira arriba.
const palmUp = (J, n) => { const d = unit3(sub3(J['G' + n], J['W' + n])); let u = [-d[1], d[0], 0]; if (u[1] < 0) u = scl3(u, -1); return u; };
function propSVG(p, FR, ts, { path, group, animV, animate, front, dur, palm }) {
  const L = PAL.line, n = p.at.slice(-1), A = FR[0];
  // Con mano articulada, la pesa va en la mano; si se indica la palma, el mango queda sobre la palma (arriba) o debajo
  // de los dedos (palma abajo, la mano encima del mango), así se distingue extensión de flexión de muñeca.
  const inHand = (J) => { const c = mix3(J['W' + n], J['G' + n], 0.55); return palm ? add3(c, scl3(palmUp(J, n), palm === 'up' ? 3.4 : -3.4)) : c; };
  const posOf = (J) => (p.mid ? mix3(J.W1, J.W2, 0.5) : (p.at[0] === 'W' && J['G' + n] && inHand(J)) || J[p.at]);
  if (p.t === 'db') {
    // Mancuerna liviana (sm, la de rehabilitación): discos más chicos y más juntos, así no tapan la mano.
    const DB = p.sm ? { in: 6, out: 8.5, r: 4.8 } : { in: 8, out: 12, r: 7.2 };
    const one = (grip, extra = '') => {
      // Discos: cilindro (cara interna, costado y cara externa) a cada lado de la mano; mango entre ellos.
      const plate = (sgn) => {
        const geo = (J) => { const h = handleDir(grip, J, n, front), w = posOf(J), cIn = add3(w, scl3(h, sgn * DB.in)), cOut = add3(w, scl3(h, sgn * DB.out)); return [disc(cIn, h, DB.r), disc(cOut, h, DB.r)]; };
        const quad = (J) => { const [[c1, a1], [c2, a2]] = geo(J); return `M${pt2([c1[0] + a1[0], c1[1] + a1[1]])}L${pt2([c2[0] + a2[0], c2[1] + a2[1]])}L${pt2([c2[0] - a2[0], c2[1] - a2[1]])}L${pt2([c1[0] - a1[0], c1[1] - a1[1]])}Z`; };
        return group([[(J) => ellipse(...geo(J)[0]), PAL.db2], [quad, PAL.db2], [(J) => ellipse(...geo(J)[1]), PAL.db]],
          path((J) => { const [c, a, b] = geo(J)[1]; return ellipse(c, scl3([...a, 0], 0.3).slice(0, 2), scl3([...b, 0], 0.3).slice(0, 2)); }, `fill="${PAL.bar}" stroke="${L}" stroke-width="1"`));
      };
      const bar = path((J) => { const h = handleDir(grip, J, n, front), w = posOf(J); return capsule(prj(add3(w, scl3(h, -DB.in - 1))), prj(add3(w, scl3(h, DB.in + 1))), 1.9, 1.9); }, `fill="${PAL.bar}" stroke="${L}" stroke-width="1.2"`);
      // Qué disco queda adelante; si cambia durante el giro, se alternan dos versiones (una visible por vez).
      const signs = FR.map((J) => (dot3(handleDir(grip, J, n, front), CAM.v) >= 0 ? 1 : -1));
      // Palma arriba: el mango descansa en la palma, se dibuja sobre la mano.
      if (palm === 'up' && (signs.every((x) => x === signs[0]) || !animate)) return { under: `<g${extra}>${plate(-signs[0])}</g>`, over: `<g${extra}>${bar}${plate(signs[0])}</g>` };
      if (signs.every((x) => x === signs[0]) || !animate) return { under: `<g${extra}>${plate(-signs[0])}${bar}</g>`, over: `<g${extra}>${plate(signs[0])}</g>` };
      const { values, keyTimes } = loopOf(signs);
      const show = (sg) => `<animate attributeName="opacity" values="${values.map((x) => (x === sg ? 1 : 0)).join(';')}" ${timing(keyTimes, dur, 'discrete')}/>`;
      const both = (layer) => [1, -1].map((sg) => `<g opacity="${signs[0] === sg ? 1 : 0}">${show(sg)}${layer(sg)}</g>`).join('');
      return { under: both((sg) => plate(-sg) + bar), over: both((sg) => plate(sg)) };
    };
    if (Array.isArray(p.grip)) {
      // Cambio de agarre: una vista se desvanece mientras aparece la otra (en los isométricos, un ida y vuelta de 6 s).
      const { values, keyTimes } = loopOf(ts.length > 1 ? ts : [0, 0.5, 1]);
      const fade = (inv) => (animate ? `<animate attributeName="opacity" values="${values.map((t) => r1(inv ? 1 - t : t)).join(';')}" ${timing(keyTimes, '6s')}/>` : '');
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
    const ln = (w, extra, anim = '') => path((J) => `M${pt2(prj(grip(J, p.at)))}L${pt2(prj(grip(J, p.to)))}`, `fill="none" stroke-width="${w}" stroke-linecap="round" ${extra}`, anim);
    return { under: ln(9, `stroke="${L}"`) + ln(6.4, 'stroke="#7FB3D5"') + ln(6.4, 'stroke="#5E97BF" stroke-dasharray="2 3"', animate && FR.length > 1 ? `<animate attributeName="stroke-dashoffset" values="0;10;0" dur="${dur}" repeatCount="indefinite"/>` : ''), over: '' };
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
    return { under: '', over: `<g>${pulse}${path(head, `fill="${L}" stroke="${L}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`)}${path(head, `fill="${PAL.guide}" stroke="${PAL.guide}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`)}</g>` };
  }
  if (p.t === 'ring') {
    const top = (J) => prj([J[p.at][0], 175, J[p.at][2]]);
    return { under: path((J) => { const w = prj(J[p.at]); return `M${pt2(top(J))}L${pt2([w[0], w[1] - 5])}`; }, 'fill="none" stroke="#1F2937" stroke-width="2.2"')
      + path((J) => circlePath(prj(J[p.at]), 5.5), `fill="none" stroke="${L}" stroke-width="3.6"`) + path((J) => circlePath(prj(J[p.at]), 5.5), 'fill="none" stroke="#8B5E3C" stroke-width="2"'), over: '' };
  }
  return { under: '', over: '' };
}
