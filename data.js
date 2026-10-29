// Datos fijos de XZ Fit: zonas de tendón, ejercicios (con sus bocetos) y plantillas de entreno.
// Bocetos: articulaciones en un lienzo de 200×170 (y de -10 a 160, piso en y=150), vista de costado mirando a la derecha.
// N cuello, P cadera, E codo, W mano, K rodilla, F tobillo, T punta del pie. 1 = lado cercano, 2 = lado lejano.

const ZONES = [
  { id: 'codo_lat', name: 'Codo lateral', hint: 'Codo de tenista: duele afuera del codo al agarrar o extender la muñeca.' },
  { id: 'codo_med', name: 'Codo medial', hint: 'Codo de golfista: duele adentro del codo al agarrar o flexionar la muñeca.' },
  { id: 'muneca', name: 'Muñeca', hint: 'Dorso de la muñeca al agarrar, girar o apoyar peso.' },
  { id: 'hombro', name: 'Hombro', hint: 'Duele al empujar o levantar el brazo (press, elevaciones).' },
  { id: 'rodilla', name: 'Rodilla', hint: 'Tendón rotuliano: debajo de la rótula al saltar, subir escaleras o hacer sentadilla.' },
  { id: 'aquiles', name: 'Aquiles', hint: 'Detrás del tobillo al correr, saltar o pararte en puntas.' },
];
const ZONE = Object.fromEntries(ZONES.map((z) => [z.id, z]));

// Rehabilitación por zona y fase (1 isométricos, 2 isotónicos lentos, 3 integración + mantenimiento).
const REHAB = {
  codo_lat: { 1: 'iso_ext_muneca', 2: 'ext_muneca_lenta' },
  codo_med: { 1: 'iso_flex_muneca', 2: 'flex_muneca_lenta' },
  muneca: { 1: 'iso_prono', 2: 'prono_lenta' },
  hombro: { 1: 'iso_pared', 2: 'lateral_lenta' },
  rodilla: { 1: 'sentadilla_pared', 2: 'goblet_lenta' },
  aquiles: { 1: 'iso_talones', 2: 'talones_lenta' },
};
const PHASES = {
  1: { name: 'Fase 1: isométricos', short: 'Isométricos', what: '3 sostenidas de 45 s, mañana y noche. Calman el dolor y le dan señal de reparación a todo el tendón.' },
  2: { name: 'Fase 2: isotónicos lentos', short: 'Lentos', what: '3×15 subiendo en 3 s y bajando en 3 s, día por medio. Recuperan fuerza con movimiento.' },
  3: { name: 'Fase 3: integración', short: 'Integración', what: 'Vuelven los ejercicios normales con todo el peso. 5–10 min de isométricos después de entrenar para mantener.' },
};

// Posturas base reutilizadas.
const STAND = { N: [100, 45], P: [100, 88], E1: [105, 68], W1: [109, 91], K1: [102, 119], F1: [100, 150] };
const SEATED = { N: [106, 68], P: [92, 108], E1: [110, 100], W1: [134, 100], K1: [128, 110], F1: [130, 150], E2: [106, 99], W2: [114, 108], K2: [124, 111], F2: [126, 150] };
// Ejercicios de muñeca sentado: la otra mano descansa en el borde de la silla, lejos del regazo.
const WRIST_SEAT = { ...SEATED, E2: [96, 92], W2: [94, 113], z: { E2: 3, W2: 5 } };
const CHAIR_SEAT = { t: 'chair', x: 74, y: 112, w: 40, back: 'left' };

// kind: peso (kg × reps), iso (sostener s), lento (reps a tempo 3/3), tiempo (s, sin peso), reps (sin peso).
// tag: tendones que exige. ratio: 1RM de un novato hombre por implemento / peso corporal. alt: variante amable.
const EXERCISES = {
  // ——— Rehabilitación ———
  iso_ext_muneca: {
    name: 'Extensión de muñeca isométrica', kind: 'iso', impl: 'db', load0: 2, zone: 'codo_lat',
    cues: ['Sentado, antebrazo apoyado en el muslo, palma hacia abajo y la mano fuera de la rodilla.', 'Sostené la mancuerna con la muñeca recta o apenas levantada, sin moverla.', 'Dolor tolerable: hasta 3–4 sobre 10.'],
    fig: { a: { ...WRIST_SEAT, G1: [142, 100] }, palm: 'down', props: [{ t: 'db', at: 'W1', sm: true }], scene: [CHAIR_SEAT] },
  },
  ext_muneca_lenta: {
    name: 'Extensión de muñeca lenta', kind: 'lento', impl: 'db', load0: 2, zone: 'codo_lat',
    cues: ['Sentado, antebrazo apoyado en el muslo, palma hacia abajo y la mano fuera de la rodilla.', 'Subí la mano en 3 s y bajala en 3 s.', 'Si duele más de 4, bajá el peso.'],
    fig: { a: { ...WRIST_SEAT, G1: [140.2, 107.4] }, b: { G1: [140.2, 92.6] }, palm: 'down', props: [{ t: 'db', at: 'W1', sm: true }], scene: [CHAIR_SEAT], dur: 6, cam: 40, pitch: 36, focus: ['H', 'E1', 'G1', 'K1'] },
  },
  iso_flex_muneca: {
    name: 'Flexión de muñeca isométrica', kind: 'iso', impl: 'db', load0: 2, zone: 'codo_med',
    cues: ['Sentado, antebrazo en el muslo, palma hacia arriba.', 'Sostené la mancuerna con la muñeca recta, sin moverla.', 'Dolor tolerable: hasta 3–4 sobre 10.'],
    fig: { a: { ...WRIST_SEAT, G1: [142, 100] }, palm: 'up', props: [{ t: 'db', at: 'W1', sm: true }], scene: [CHAIR_SEAT] },
  },
  flex_muneca_lenta: {
    name: 'Flexión de muñeca lenta', kind: 'lento', impl: 'db', load0: 2, zone: 'codo_med',
    cues: ['Palma hacia arriba, antebrazo apoyado.', 'Subí la mano en 3 s y bajala en 3 s.'],
    fig: { a: { ...WRIST_SEAT, G1: [140.2, 107.4] }, b: { G1: [140.2, 92.6] }, palm: 'up', props: [{ t: 'db', at: 'W1', sm: true }], scene: [CHAIR_SEAT], dur: 6, cam: 40, pitch: 36, focus: ['H', 'E1', 'G1', 'K1'] },
  },
  iso_prono: {
    name: 'Sostén neutro de muñeca', kind: 'iso', impl: 'db', load0: 2, zone: 'muneca',
    cues: ['Sentado, antebrazo en el muslo, la mancuerna vertical como un martillo.', 'Agarrala de un extremo (más difícil) o del centro (más fácil).', 'Muñeca recta, sin moverla.'],
    fig: { a: { ...WRIST_SEAT, G1: [142, 100] }, props: [{ t: 'db', at: 'W1' }], scene: [CHAIR_SEAT] },
  },
  prono_lenta: {
    name: 'Pronación y supinación lenta', kind: 'lento', impl: 'db', load0: 2, zone: 'muneca',
    cues: ['Mancuerna vertical agarrada de un extremo.', 'Girá la palma hacia abajo en 3 s y hacia arriba en 3 s.', 'El antebrazo no se mueve.'],
    fig: { a: { ...WRIST_SEAT, G1: [142, 100] }, props: [{ t: 'db', at: 'W1' }], scene: [CHAIR_SEAT], dur: 6 },
  },
  iso_pared: {
    name: 'Empuje isométrico contra la pared', kind: 'iso', impl: 'bw', zone: 'hombro',
    cues: ['De pie frente a la pared, manos a la altura del pecho como en un press.', 'Empujá fuerte sin mover nada (al 50–70 % de tu fuerza).', 'Si duele más de 4, empujá más suave.'],
    fig: { a: { N: [100, 45], P: [96, 88], E1: [124, 50], W1: [148, 52], E2: [121, 52], W2: [146, 55], K1: [104, 119], F1: [110, 150], K2: [92, 119], F2: [86, 150] }, scene: [{ t: 'wall', x: 152 }] },
  },
  lateral_lenta: {
    name: 'Elevación lateral lenta', kind: 'lento', impl: 'db', load0: 2, zone: 'hombro',
    cues: ['De pie, brazos al costado, codos apenas flexionados.', 'Subí hasta la altura de los hombros en 3 s y bajá en 3 s.'],
    fig: { front: true, a: { N: [100, 45], P: [100, 88], E1: [93, 69], W1: [91, 92], E2: [107, 69], W2: [109, 92], K1: [94, 119], F1: [93, 150], K2: [106, 119], F2: [107, 150] }, b: { E1: [68, 50], W1: [45, 51], E2: [132, 50], W2: [155, 51] }, props: [{ t: 'db', at: 'W1' }, { t: 'db', at: 'W2' }], dur: 6 },
  },
  sentadilla_pared: {
    name: 'Sentadilla isométrica en pared', kind: 'iso', impl: 'bw', zone: 'rodilla',
    cues: ['Espalda apoyada en la pared, bajá hasta un ángulo cómodo (no hace falta llegar a 90°).', 'Rodillas en línea con los pies.', 'Si duele más de 4, subí un poco.'],
    fig: { a: { N: [70, 68], P: [70, 112], E1: [76, 90], W1: [98, 104], K1: [102, 112], F1: [102, 150] }, scene: [{ t: 'wall', x: 60, left: true }] },
  },
  goblet_lenta: {
    name: 'Sentadilla goblet lenta', kind: 'lento', impl: 'kb', alsoDb: true, load0: 8, zone: 'rodilla',
    cues: ['Pesa rusa o mancuerna contra el pecho.', 'Bajá en 3 s y subí en 3 s, hasta donde no duela más de 4.'],
    fig: 'goblet', dur: 6,
  },
  iso_talones: {
    name: 'Puntas de pie isométrico', kind: 'iso', impl: 'db', load0: 0, zone: 'aquiles',
    cues: ['De pie, subí a media punta y quedate ahí.', 'Apoyá una mano en la pared si necesitás equilibrio.', 'Para más carga, sostené mancuernas.'],
    fig: { a: { ...STAND, N: [100, 39], P: [100, 82], E1: [102, 62], W1: [104, 86], K1: [102, 113], F1: [100, 144], T1: [109, 150] }, props: [{ t: 'db', at: 'W1' }] },
  },
  talones_lenta: {
    name: 'Elevación de talones lenta', kind: 'lento', impl: 'db', load0: 0, zone: 'aquiles',
    cues: ['Subí en 3 s y bajá en 3 s.', 'Con el tiempo hacelo a una pierna o con mancuernas.'],
    fig: { a: STAND, b: { N: [100, 37], P: [100, 80], E1: [102, 60], W1: [104, 84], K1: [102, 111], F1: [100, 142], T1: [109, 150] }, props: [{ t: 'db', at: 'W1' }], dur: 6 },
  },

  // ——— Entreno ———
  goblet: {
    name: 'Sentadilla goblet', kind: 'peso', impl: 'kb', alsoDb: true, ratio: 0.35, lower: true, tag: ['rodilla'],
    cues: ['Pesa rusa contra el pecho, codos hacia abajo.', 'Bajá con la espalda recta hasta que los codos rocen las rodillas.', 'Sin rebotar abajo.'],
    fig: { a: { N: [100, 45], P: [100, 88], E1: [110, 68], W1: [114, 56], K1: [102, 119], F1: [100, 150] }, b: { N: [100, 78], P: [82, 118], E1: [110, 100], W1: [114, 88], K1: [112, 122], F1: [100, 150] }, props: [{ t: 'kb', at: 'W1' }] },
  },
  press_suelo: {
    name: 'Press en el suelo con mancuernas', kind: 'peso', impl: 'db', ratio: 0.2, tag: ['hombro', 'codo_med'],
    cues: ['Acostado, rodillas flexionadas, codos a 45° del cuerpo.', 'Apoyá suave los brazos en el piso en cada repetición, sin rebotar.'],
    fig: { a: { N: [60, 143], P: [103, 143], E1: [71, 146], W1: [71, 123], K1: [128, 118], F1: [138, 150], z: { E: 28, W: 24 } }, b: { E1: [66, 120], W1: [65, 97], z: { E: 16, W: 14 } }, props: [{ t: 'db', at: 'W1' }] },
  },
  remo_silla: {
    name: 'Remo a un brazo apoyado en silla', kind: 'peso', impl: 'db', ratio: 0.25, tag: ['codo_lat', 'muneca'], alt: 'remo_aros_iso',
    cues: ['Mano libre en el asiento de una silla, espalda recta.', 'Tirá el codo hacia la cadera, agarre neutro (palma mirando al cuerpo).', 'Usá straps si te molesta el agarre.'],
    fig: { a: { N: [130, 84], P: [88, 92], E1: [128, 108], W1: [131, 132], E2: [132, 100], W2: [140, 115], K1: [84, 121], F1: [80, 150], K2: [96, 122], F2: [100, 150] }, b: { E1: [112, 76], W1: [118, 98] }, props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'chair', x: 130, y: 115, w: 40, back: 'right' }] },
  },
  rdl: {
    name: 'Peso muerto rumano con mancuernas', kind: 'peso', impl: 'db', ratio: 0.25, lower: true, tag: ['codo_lat', 'muneca'], alt: 'puente',
    cues: ['Mancuernas pegadas a las piernas, rodillas apenas flexionadas.', 'Llevá la cadera atrás hasta sentir los isquios, espalda recta.'],
    fig: { a: { ...STAND, E1: [104, 68], W1: [106, 92] }, b: { N: [108, 62], P: [76, 88], E1: [104, 88], W1: [99, 113], K1: [96, 119], F1: [97, 150] }, props: [{ t: 'db', at: 'W1' }] },
  },
  lateral: {
    name: 'Elevaciones laterales', kind: 'peso', impl: 'db', ratio: 0.06, tag: ['hombro'],
    cues: ['Subí hasta la altura de los hombros, codos apenas flexionados.', 'Bajá controlando, sin balancearte.'],
    fig: 'lateral_lenta', dur: 3,
  },
  plancha: {
    name: 'Plancha', kind: 'tiempo', impl: 'bw', tag: ['hombro'],
    cues: ['Antebrazos en el piso, codos debajo de los hombros.', 'Cuerpo en línea recta, apretá abdomen y glúteos.'],
    fig: { a: { N: [140, 128], P: [98, 132], E1: [138, 150], W1: [162, 150], K1: [66, 138], F1: [36, 146], T1: [34, 150] } },
  },
  zancada: {
    name: 'Zancada inversa con mancuernas', kind: 'peso', impl: 'db', ratio: 0.15, lower: true, tag: ['rodilla'],
    cues: ['Paso largo hacia atrás, bajá la rodilla de atrás cerca del piso.', 'El peso sobre el talón de adelante.'],
    fig: { a: STAND, b: { N: [100, 69], P: [100, 112], E1: [102, 92], W1: [103, 116], K1: [118, 118], F1: [118, 150], K2: [96, 144], F2: [74, 141], T2: [82, 150] }, props: [{ t: 'db', at: 'W1' }] },
  },
  press_hombros: {
    name: 'Press de hombros con mancuernas', kind: 'peso', impl: 'db', ratio: 0.15, tag: ['hombro', 'codo_med'],
    cues: ['De pie o sentado en una silla sin respaldo alto.', 'Empujá hacia arriba sin arquear la espalda baja.'],
    fig: { front: true, a: { N: [100, 45], P: [100, 88], E1: [70, 57], W1: [72, 35], E2: [130, 57], W2: [128, 35], K1: [94, 119], F1: [93, 150], K2: [106, 119], F2: [107, 150] }, b: { E1: [80, 31], W1: [79, 8], E2: [120, 31], W2: [121, 8] }, props: [{ t: 'db', at: 'W1' }, { t: 'db', at: 'W2' }] },
  },
  remo_aros: {
    name: 'Remo invertido en aros', kind: 'reps', impl: 'rings', tag: ['codo_lat', 'codo_med', 'muneca'], alt: 'remo_aros_iso',
    cues: ['Cuerpo recto inclinado, talones en el piso.', 'Tirá el pecho hacia los aros, palmas enfrentadas.', 'Más fácil: pies más atrás. Más difícil: pies más adelante.'],
    fig: { a: { N: [68, 100], P: [106, 121], E1: [69, 77], W1: [66, 54], K1: [134, 136], F1: [160, 150], T1: [163, 141] }, b: { N: [76, 85], P: [110, 113], E1: [92, 82], W1: [76, 66], K1: [136, 132], F1: [160, 150], T1: [163, 141] }, props: [{ t: 'ring', at: 'W1', x: 72 }] },
  },
  swing: {
    name: 'Swing con pesa rusa', kind: 'peso', impl: 'kb', alsoDb: true, ratio: 0.3, lower: true, tag: ['codo_lat', 'muneca'], alt: 'puente',
    cues: ['La fuerza sale de la cadera, no de los brazos.', 'Subí la pesa hasta la altura del pecho y dejala caer entre las piernas.'],
    fig: { a: { N: [120, 66], P: [86, 92], E1: [114, 90], W1: [111, 112], K1: [98, 120], F1: [98, 150] }, b: { ...STAND, E1: [124, 50], W1: [148, 52] }, props: [{ t: 'kb', at: 'W1' }], dur: 1.6 },
  },
  curl_martillo: {
    name: 'Curl martillo', kind: 'peso', impl: 'db', ratio: 0.12, tag: ['codo_lat', 'muneca'], alt: 'curl_iso',
    cues: ['Palmas enfrentadas, codos pegados al cuerpo.', 'Subí sin balancear y bajá en 2–3 s.'],
    fig: { a: STAND, b: { E1: [105, 68], W1: [122, 51] }, props: [{ t: 'db', at: 'W1' }] },
  },
  triceps: {
    name: 'Extensión de tríceps sobre la cabeza', kind: 'peso', impl: 'db', ratio: 0.15, tag: ['codo_med', 'hombro'],
    cues: ['Una mancuerna con las dos manos sobre la cabeza.', 'Bajala detrás de la cabeza doblando solo los codos.'],
    fig: { a: { ...STAND, E1: [109, 22], W1: [108, -3] }, b: { E1: [109, 22], W1: [90, 36] }, props: [{ t: 'db', at: 'W1' }] },
  },
  // Variantes amables (modo dolor)
  remo_aros_iso: {
    name: 'Remo isométrico en aros', kind: 'iso', impl: 'rings', tag: ['codo_lat', 'muneca'],
    cues: ['Quedate arriba del remo con el pecho cerca de los aros.', 'Sin moverte; dolor hasta 3–4 sobre 10.'],
    fig: { a: { N: [76, 85], P: [110, 113], E1: [92, 82], W1: [76, 66], K1: [136, 132], F1: [160, 150], T1: [163, 141] }, props: [{ t: 'ring', at: 'W1', x: 74 }] },
  },
  puente: {
    name: 'Puente de glúteos con mancuerna', kind: 'peso', impl: 'db', ratio: 0.4, lower: true, tag: [],
    cues: ['Acostado, mancuerna sobre la cadera, sostenida con las manos.', 'Subí la cadera apretando glúteos, sin arquear la espalda.'],
    fig: { a: { N: [60, 143], P: [103, 145], E1: [80, 146], W1: [100, 140], K1: [128, 118], F1: [138, 150] }, b: { P: [103, 124], W1: [100, 120], E1: [80, 136], K1: [130, 114] }, props: [{ t: 'db', at: 'W1' }] },
  },
  curl_iso: {
    name: 'Curl isométrico a mitad de recorrido', kind: 'iso', impl: 'db', load0: 2, tag: ['codo_lat'],
    cues: ['Codo a 90°, palma hacia el cuerpo, sostené sin moverte.', 'Peso liviano: dolor hasta 3–4 sobre 10.'],
    fig: { a: { ...STAND, W1: [124, 66] }, props: [{ t: 'db', at: 'W1' }] },
  },
};

// Ejercicios que dependen de equipo extra (banco, barra, bandas). needs = equipo obligatorio.
Object.assign(EXERCISES, {
  press_banco: {
    name: 'Press en banco con mancuernas', kind: 'peso', impl: 'db', needs: ['bench'], ratio: 0.22, tag: ['hombro', 'codo_med'],
    cues: ['Acostado en el banco, pies firmes en el piso.', 'Bajá las mancuernas al costado del pecho en 2 s, codos a 45°.', 'Empujá sin bloquear de golpe los codos.'],
    fig: { a: { N: [62, 110], P: [104, 112], E1: [72, 120], W1: [72, 97], K1: [128, 122], F1: [130, 150], z: { E: 28, W: 24 } }, b: { E1: [67, 87], W1: [66, 64], z: { E: 16, W: 14 } }, props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'bench', x: 46, y: 118, w: 70 }] },
  },
  dominadas: {
    name: 'Dominadas (agarre neutro)', kind: 'reps', impl: 'bar', alsoRings: true, tag: ['codo_lat', 'codo_med', 'hombro'], alt: 'remo_aros_iso',
    cues: ['Colgate con las palmas enfrentadas si podés (o en aros).', 'Subí hasta que el mentón pase la barra, bajá en 2–3 s.', 'Si no llegás, hacé solo la bajada lenta (negativas).'],
    fig: { a: { N: [100, 42], P: [100, 85], E1: [101, 20], W1: [100, -2], K1: [104, 115], F1: [100, 142], T1: [108, 146] }, b: { N: [100, 12], P: [100, 55], E1: [117, 14], W1: [100, -2], K1: [104, 85], F1: [100, 112], T1: [108, 116] }, scene: [{ t: 'bar', y: -2 }], dur: 3.4 },
  },
  rot_ext_banda: {
    name: 'Rotación externa con banda', kind: 'reps', impl: 'band', tag: ['hombro'],
    cues: ['Codo pegado al cuerpo a 90°, una toalla entre codo y costado ayuda.', 'Llevá la mano hacia afuera sin despegar el codo, volvé en 2–3 s.', 'Ideal como entrada en calor y para hombros sensibles.'],
    fig: { front: true, a: { N: [100, 45], P: [100, 88], E1: [87, 71], W1: [90, 78], E2: [113, 69], W2: [115, 92], K1: [94, 119], F1: [93, 150], K2: [106, 119], F2: [107, 150] }, b: { W1: [65, 74] }, props: [{ t: 'band', at: 'W1', x: 168, y: 76 }], scene: [{ t: 'post', x: 168 }] },
  },
  face_pull: {
    name: 'Face pull con banda', kind: 'reps', impl: 'band', tag: ['hombro'],
    cues: ['Banda a la altura de la cara.', 'Tirá hacia la frente separando las manos, codos altos.', 'Apretá atrás 1 s y volvé despacio.'],
    fig: { a: { ...STAND, E1: [124, 46], W1: [148, 44] }, b: { E1: [100, 44], W1: [114, 38], z: { E: 28, W: 12 } }, props: [{ t: 'band', at: 'W1', x: 176, y: 40 }], scene: [{ t: 'post', x: 176 }] },
  },
});
// Biblioteca ampliada (v1.7): más opciones con mancuernas, pesa rusa y peso corporal para el editor de rutina.
const HINGE = { N: [122, 70], P: [86, 94], K1: [96, 122], F1: [96, 150] };
const LYING = { N: [60, 143], P: [103, 143], K1: [128, 118], F1: [138, 150] };
Object.assign(EXERCISES, {
  remo_inclinado: {
    name: 'Remo inclinado con dos mancuernas', kind: 'peso', impl: 'db', ratio: 0.22, cat: 'tiron', tag: ['codo_lat', 'muneca'], alt: 'remo_aros_iso',
    cues: ['Cadera atrás, espalda recta, torso casi paralelo al piso.', 'Llevá los codos hacia la cadera, palmas enfrentadas.', 'Bajá controlando, sin redondear la espalda.'],
    fig: { a: { ...HINGE, E1: [122, 94], W1: [124, 118] }, b: { E1: [102, 82], W1: [112, 100] }, props: [{ t: 'db', at: 'W1' }] },
  },
  bulgara: {
    name: 'Sentadilla búlgara con mancuernas', kind: 'peso', impl: 'db', ratio: 0.12, lower: true, cat: 'piernas', tag: ['rodilla'],
    cues: ['Empeine de atrás apoyado en una silla.', 'Bajá recto hasta que la rodilla de atrás quede cerca del piso.', 'Empujá con el talón de adelante.'],
    fig: {
      a: { N: [100, 43], P: [100, 86], E1: [104, 66], W1: [107, 90], K1: [110, 118], F1: [112, 150], K2: [84, 116], F2: [64, 108], T2: [55, 106] },
      b: { N: [99, 67], P: [96, 110], E1: [103, 90], W1: [106, 114], K1: [124, 120], F1: [114, 150], K2: [80, 140], F2: [64, 110], T2: [55, 107] },
      props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'chair', x: 34, y: 112, w: 34, back: 'left' }],
    },
  },
  hip_thrust: {
    name: 'Hip thrust con mancuerna', kind: 'peso', impl: 'db', ratio: 0.45, lower: true, cat: 'bisagra', tag: [],
    cues: ['Espalda alta apoyada en el borde de una silla o sillón firme.', 'Mancuerna sobre la cadera, sostenida con las manos.', 'Subí la cadera hasta alinear rodillas, cadera y hombros; apretá 1 s.'],
    fig: { a: { N: [72, 110], P: [106, 134], E1: [86, 124], W1: [104, 128], K1: [130, 114], F1: [136, 150] }, b: { P: [110, 112], E1: [88, 114], W1: [108, 106], K1: [136, 112] }, props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'chair', x: 30, y: 112, w: 36, back: 'left' }] },
  },
  pajaros: {
    name: 'Pájaros con mancuernas', kind: 'peso', impl: 'db', ratio: 0.04, cat: 'hombro', tag: ['hombro'],
    cues: ['Cadera atrás, espalda recta, torso casi paralelo al piso.', 'Abrí los brazos hacia los costados con los codos apenas flexionados, hasta la altura de la espalda.', 'Apretá atrás 1 s y bajá despacio, sin tirar con el cuello.'],
    fig: { a: { ...HINGE, E1: [122, 94], W1: [124, 118] }, b: { E1: [120, 86], W1: [120, 96], z: { E: 30, W: 48 } }, props: [{ t: 'db', at: 'W1' }], cam: 75, pitch: 40 },
  },
  pullover: {
    name: 'Pullover con mancuerna', kind: 'peso', impl: 'db', needs: ['bench'], ratio: 0.15, cat: 'tiron', tag: ['hombro'],
    cues: ['Acostado en el banco, una mancuerna con las dos manos sobre el pecho.', 'Bajala detrás de la cabeza con los codos apenas flexionados.', 'Volvé usando la espalda y el pecho, sin arquear la zona lumbar.'],
    fig: { a: { N: [62, 110], P: [104, 112], E1: [66, 88], W1: [66, 64], K1: [128, 122], F1: [130, 150] }, b: { E1: [42, 100], W1: [20, 96] }, props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'bench', x: 46, y: 118, w: 70 }] },
  },
  elev_frontal: {
    name: 'Elevación frontal con mancuernas', kind: 'peso', impl: 'db', ratio: 0.06, cat: 'hombro', tag: ['hombro'],
    cues: ['Brazos casi rectos, palmas hacia abajo o enfrentadas.', 'Subí hasta la altura de los hombros sin balancear el cuerpo.'],
    fig: { a: { ...STAND }, b: { E1: [124, 48], W1: [148, 48] }, props: [{ t: 'db', at: 'W1' }] },
  },
  curl_concentrado: {
    name: 'Curl concentrado', kind: 'peso', impl: 'db', ratio: 0.1, cat: 'brazos', tag: ['codo_lat', 'codo_med'],
    cues: ['Sentado, codo apoyado en la cara interna del muslo.', 'Subí la mancuerna sin mover el codo y bajá en 2–3 s.'],
    fig: { a: { ...SEATED, N: [112, 70], E1: [120, 106], W1: [125, 130] }, b: { E1: [120, 106], W1: [131, 86] }, props: [{ t: 'db', at: 'W1' }], scene: [CHAIR_SEAT] },
  },
  patada_triceps: {
    name: 'Patada de tríceps', kind: 'peso', impl: 'db', ratio: 0.06, cat: 'brazos', tag: ['codo_med'],
    cues: ['Mano libre en una silla, espalda recta.', 'Brazo pegado al costado; estirá el codo hacia atrás y volvé despacio.'],
    fig: { a: { N: [130, 84], P: [88, 92], E1: [108, 90], W1: [110, 112], E2: [132, 100], W2: [140, 115], K1: [84, 121], F1: [80, 150], K2: [96, 122], F2: [100, 150] }, b: { W1: [86, 95] }, props: [{ t: 'db', at: 'W1' }], scene: [{ t: 'chair', x: 130, y: 115, w: 40, back: 'right' }] },
  },
  press_frances: {
    name: 'Press francés en el suelo', kind: 'peso', impl: 'db', ratio: 0.08, cat: 'brazos', tag: ['codo_med'],
    cues: ['Acostado, brazos verticales, palmas enfrentadas.', 'Doblá solo los codos llevando las mancuernas al costado de la cabeza.', 'Si molesta el codo, usá menos peso o cambiá por la patada de tríceps.'],
    fig: { a: { ...LYING, E1: [66, 120], W1: [64, 96] }, b: { W1: [46, 112] }, props: [{ t: 'db', at: 'W1' }] },
  },
  flexiones: {
    name: 'Flexiones de brazos', kind: 'reps', impl: 'bw', cat: 'empuje', tag: ['hombro', 'muneca'],
    cues: ['Manos debajo de los hombros, cuerpo en línea recta.', 'Bajá el pecho cerca del piso con los codos a 45°.', 'Más fácil: con las rodillas apoyadas o las manos en una silla. Si molesta la muñeca, apoyá en mancuernas con agarre neutro.'],
    fig: { a: { N: [136, 108], P: [96, 118], E1: [134, 128], W1: [136, 149], K1: [66, 131], F1: [36, 144], T1: [34, 150] }, b: { N: [136, 132], P: [96, 135], E1: [120, 136], K1: [64, 140], F1: [36, 146] }, dur: 2.4 },
  },
  pm_una_pierna: {
    name: 'Peso muerto a una pierna', kind: 'peso', impl: 'db', ratio: 0.12, lower: true, cat: 'bisagra', tag: ['codo_lat', 'muneca'], alt: 'puente',
    cues: ['Parado en una pierna, rodilla apenas flexionada.', 'Inclinate llevando la otra pierna atrás, en línea con el torso.', 'Volvé apretando el glúteo; apoyate en la pared si perdés el equilibrio.'],
    fig: { a: { ...STAND }, b: { N: [130, 80], P: [92, 90], E1: [128, 104], W1: [129, 128], K1: [96, 120], F1: [96, 150], K2: [62, 88], F2: [34, 86], T2: [30, 78] }, props: [{ t: 'db', at: 'W1' }] },
  },
  sumo_kb: {
    name: 'Sentadilla sumo con pesa rusa', kind: 'peso', impl: 'kb', alsoDb: true, ratio: 0.35, lower: true, cat: 'piernas', tag: ['rodilla'],
    cues: ['Pies más abiertos que los hombros, puntas hacia afuera.', 'La pesa cuelga entre las piernas con los brazos estirados.', 'Bajá con el pecho alto y las rodillas siguiendo a los pies.'],
    fig: {
      front: true,
      // x: cuánto va hacia adelante cada articulación (de frente no se ve): al bajar, las rodillas avanzan hacia adelante
      // por encima de los pies (no se abren hacia los costados) y la cadera va un poco atrás.
      a: { N: [100, 45], P: [100, 88], E1: [94, 68], W1: [100, 92], E2: [106, 68], W2: [100, 92], K1: [84, 119], F1: [79, 150], K2: [116, 119], F2: [121, 150], T1: [75, 150], T2: [125, 150], x: { K: 3, F: 3, T: 13 } },
      b: { N: [100, 72], P: [100, 110], E1: [94, 93], W1: [100, 116], E2: [106, 93], W2: [100, 116], K1: [79, 121], F1: [79, 150], K2: [121, 121], F2: [121, 150], T1: [75, 150], T2: [125, 150], x: { N: 7, P: -8, K: 17, F: 3, E: 9, W: 9, T: 13 } },
      props: [{ t: 'kb', at: 'W1' }],
    },
  },
  gemelos_1pierna: {
    name: 'Gemelos a una pierna', kind: 'reps', impl: 'bw', cat: 'piernas', tag: ['aquiles'],
    cues: ['En una pierna, con una mano en la pared.', 'Subí en 2 s, pausa arriba, bajá en 3 s.', 'Para más carga, sostené una mancuerna del lado que trabaja.'],
    fig: { a: { ...STAND, E1: [112, 62], W1: [131, 66], K2: [94, 118], F2: [80, 126], T2: [76, 132] }, b: { N: [100, 37], P: [100, 80], E1: [112, 55], W1: [131, 60], K1: [102, 111], F1: [100, 142], T1: [109, 150], K2: [94, 110], F2: [80, 118], T2: [76, 124] }, scene: [{ t: 'wall', x: 134 }], dur: 5 },
  },
  dead_bug: {
    name: 'Dead bug', kind: 'reps', impl: 'bw', cat: 'core', tag: [],
    cues: ['Boca arriba, brazos al techo y piernas en mesa (90°).', 'Estirá un brazo hacia atrás y la pierna contraria hacia adelante sin despegar la zona lumbar.', 'Volvé y cambiá de lado. Lento y respirando.'],
    fig: { a: { N: [60, 143], P: [103, 143], E1: [62, 121], W1: [59, 98], K1: [104, 112], F1: [128, 112] }, b: { E1: [46, 126], W1: [26, 124], K1: [128, 134], F1: [156, 140] }, dur: 3.4 },
  },
});
// Peso corporal (v1.30.1): sin ningún equipo, cada hueco tiene al menos un ejercicio (dos donde un día repite el patrón).
// Van últimos en cada hueco, así quien tiene equipo sigue viendo lo mismo. Solo piden una silla, una mesa firme o una toalla y una puerta.
const TABLE = { t: 'table', x: 22, y: 98, w: 62 };
const UNDER_TABLE = { N: [68, 140], P: [108, 144], E1: [76, 120], W1: [80, 100], K1: [138, 146], F1: [168, 149], T1: [170, 141] };
const PRONE = { N: [138, 145], P: [96, 146], K1: [65, 147], F1: [35, 148], T1: [31, 150] };
Object.assign(EXERCISES, {
  sentadilla_bw: {
    name: 'Sentadilla sin peso', kind: 'reps', impl: 'bw', lower: true, cat: 'piernas', tag: ['rodilla'],
    cues: ['Pies al ancho de los hombros, brazos adelante para equilibrarte.', 'Bajá con la espalda recta hasta donde puedas sin que se levanten los talones.', 'Más difícil: bajá en 3 s y hacé una pausa abajo.'],
    fig: { a: { ...EXERCISES.goblet.fig.a, E1: [119.5, 50], W1: [142.5, 50] }, b: { ...EXERCISES.goblet.fig.b, E1: [117, 83], W1: [140, 83] } },
  },
  zancada_bw: {
    name: 'Zancada inversa sin peso', kind: 'reps', impl: 'bw', lower: true, cat: 'piernas', tag: ['rodilla'],
    cues: ['Paso largo hacia atrás, bajá la rodilla de atrás cerca del piso.', 'El peso sobre el talón de adelante; manos en la cintura.', 'Más difícil: bajá en 3 s o pasá a la búlgara con el pie de atrás en una silla.'],
    fig: { a: STAND, b: EXERCISES.zancada.fig.b },
  },
  puente_bw: {
    name: 'Puente de glúteos', kind: 'reps', impl: 'bw', lower: true, cat: 'bisagra', tag: [],
    cues: ['Acostado boca arriba, rodillas flexionadas, brazos en el piso.', 'Subí la cadera apretando glúteos hasta alinear rodillas, cadera y hombros.', 'Sostené 1 s arriba y bajá despacio.'],
    fig: { a: { N: [60, 143], P: [103, 145], E1: [84, 147], W1: [107, 148], K1: [128, 118], F1: [138, 150] }, b: { P: [103, 124], K1: [130, 114] } },
  },
  puente_1pierna: {
    name: 'Puente de glúteos a una pierna', kind: 'reps', impl: 'bw', lower: true, cat: 'bisagra', tag: [],
    cues: ['Como el puente, pero con una pierna estirada en línea con el muslo.', 'Empujá con el talón que está apoyado, sin girar la cadera.', 'Hacé todas las repeticiones de un lado y después cambiá.'],
    fig: {
      a: { N: [60, 143], P: [103, 145], E1: [84, 147], W1: [107, 148], K1: [128, 118], F1: [138, 150], K2: [128, 118], F2: [151, 93], T2: [155.7, 87.8] },
      b: { P: [103, 124], K1: [130, 114], K2: [132, 113], F2: [163, 101], T2: [169.6, 98.6] },
    },
  },
  pica: {
    name: 'Flexiones en pica', kind: 'reps', impl: 'bw', cat: 'empuje', tag: ['hombro', 'muneca'],
    cues: ['Manos y pies en el piso, cadera bien alta: el cuerpo forma una V invertida.', 'Doblá los codos llevando la cabeza hacia el piso, entre las manos.', 'Más difícil: con los pies en una silla.'],
    // V invertida amplia: piernas estiradas, manos lejos de los pies y una línea recta de la cadera a las manos; al bajar
    // la cabeza va hacia el piso por delante de las manos.
    fig: { a: { N: [127, 119], P: [100, 90], E1: [141.6, 134.7], W1: [156, 150], K1: [88, 118], F1: [75, 147], T1: [67, 150] }, b: { N: [134, 127], P: [100, 96], E1: [136, 144], K1: [86, 121] }, dur: 2.4, cam: 25, pitch: 20 },
  },
  flex_declinadas: {
    name: 'Flexiones con los pies en una silla', kind: 'reps', impl: 'bw', cat: 'empuje', tag: ['hombro', 'muneca'],
    cues: ['Pies en el asiento de una silla, manos en el piso debajo de los hombros.', 'Cuerpo en línea recta; bajá el pecho con los codos a 45°.', 'Trabaja más la parte de arriba del pecho que la flexión común.'],
    fig: {
      a: { N: [136, 106], P: [94, 107], E1: [133, 127], W1: [134, 148], K1: [64, 107], F1: [36, 106], T1: [33, 111] },
      b: { N: [136, 128], P: [95, 117], E1: [116, 137], K1: [65, 112] }, scene: [{ t: 'chair', x: 18, y: 112, w: 34, back: 'left' }], dur: 2.4,
    },
  },
  flex_cerradas: {
    name: 'Flexiones cerradas', kind: 'reps', impl: 'bw', cat: 'brazos', tag: ['hombro', 'muneca', 'codo_med'],
    cues: ['Manos juntas debajo del pecho, codos pegados al cuerpo.', 'Bajá despacio sin abrir los codos: trabaja sobre todo el tríceps.', 'Más fácil: con las rodillas apoyadas.'],
    fig: { ...EXERCISES.flexiones.fig, z: { E: 10, W: 5 } },
  },
  fondos_silla: {
    name: 'Fondos de tríceps en una silla', kind: 'reps', impl: 'bw', cat: 'brazos', tag: ['hombro', 'codo_med', 'muneca'],
    cues: ['Manos en el borde de una silla firme, dedos hacia adelante, cadera cerca del asiento.', 'Bajá doblando los codos hacia atrás hasta unos 90° y volvé a subir.', 'Más fácil: rodillas dobladas. Más difícil: piernas estiradas.'],
    fig: {
      a: { N: [94, 66], P: [94, 109], E1: [89, 91], W1: [84, 111], K1: [121.7, 120.6], F1: [134, 150] },
      b: { N: [96, 84], P: [96, 127], E1: [76.5, 89.3], K1: [125, 119.3] }, scene: [{ t: 'chair', x: 48, y: 112, w: 36, back: 'left' }],
    },
  },
  remo_toalla: {
    name: 'Remo con toalla en una puerta', kind: 'reps', impl: 'bw', cat: 'tiron', tag: ['codo_lat', 'muneca'],
    cues: ['Pasá una toalla por el picaporte de los dos lados de una puerta cerrada y bien trabada.', 'Agarrá las puntas, pies cerca de la puerta, y dejate caer hacia atrás con el cuerpo recto.', 'Tirá los codos hacia atrás hasta acercar el pecho. Más difícil: pies más cerca de la puerta.'],
    fig: {
      a: { N: [84, 55], P: [102, 94], E1: [107, 62], W1: [128, 64], K1: [116, 121], F1: [128, 150] },
      b: { N: [110, 47], P: [117, 89], E1: [106, 70], K1: [124, 120] }, scene: [{ t: 'post', x: 136 }],
    },
  },
  remo_mesa: {
    name: 'Remo invertido bajo una mesa', kind: 'reps', impl: 'bw', cat: 'tiron', tag: ['codo_lat', 'codo_med', 'muneca'],
    cues: ['Acostado debajo de una mesa firme, agarrá el borde con las manos al ancho de los hombros.', 'Con el cuerpo recto y los talones en el piso, subí el pecho hacia la mesa.', 'Bajá en 2–3 s. Más fácil: rodillas dobladas.'],
    fig: { a: UNDER_TABLE, b: { N: [70, 112], P: [108, 130], E1: [93.6, 118.6], K1: [138, 140] }, scene: [TABLE], cam: 10, pitch: 14 },
  },
  curl_mesa: {
    name: 'Curl de bíceps bajo una mesa', kind: 'reps', impl: 'bw', cat: 'brazos', tag: ['codo_lat', 'codo_med'],
    cues: ['Como el remo bajo la mesa, pero con las palmas hacia vos.', 'Subí doblando solo los codos, con las manos que terminan cerca de la frente.', 'Más fácil: rodillas dobladas y pies más cerca.'],
    fig: { a: UNDER_TABLE, b: { N: [84, 118], P: [121.7, 131.9], E1: [100.1, 102.6], K1: [145, 140.5] }, scene: [TABLE], cam: 10, pitch: 14 },
  },
  elev_y_piso: {
    name: 'Elevaciones en Y boca abajo', kind: 'reps', impl: 'bw', cat: 'hombro', tag: ['hombro'],
    cues: ['Acostado boca abajo, brazos estirados hacia adelante formando una Y, pulgares arriba.', 'Despegá los brazos del piso apretando entre los omóplatos, sin levantar el pecho.', 'Pausa 1 s arriba y bajá despacio.'],
    fig: { a: { ...PRONE, E1: [150, 146], W1: [170, 147] }, b: { E1: [150, 140], W1: [169, 134] }, z: { E: 22, W: 30 } },
  },
  elev_t_piso: {
    name: 'Aperturas en T boca abajo', kind: 'reps', impl: 'bw', cat: 'hombro', tag: ['hombro'],
    cues: ['Acostado boca abajo, brazos abiertos hacia los costados formando una T.', 'Despegá los brazos del piso llevando los omóplatos hacia atrás.', 'Pausa 1 s arriba y bajá despacio.'],
    fig: { a: { ...PRONE, E1: [134, 147], W1: [134, 148] }, b: { E1: [134, 139], W1: [134, 132] }, z: { E: 32, W: 55 } },
  },
});
// Rehabilitación: alternativas por zona y fase (el usuario elige; la primera es la del video).
Object.assign(EXERCISES, {
  iso_rot_ext_pared: {
    name: 'Rotación externa isométrica contra la pared', kind: 'iso', impl: 'bw', zone: 'hombro',
    cues: ['De pie al lado de un marco de puerta, codo pegado al cuerpo a 90°.', 'Empujá el dorso de la mano hacia afuera contra el marco, sin mover el brazo.', 'Fuerza moderada (50–70 %); dolor hasta 3–4 sobre 10.'],
    fig: { front: true, a: { N: [100, 45], P: [100, 88], E1: [87, 71], W1: [76, 76], E2: [113, 69], W2: [115, 92], K1: [94, 119], F1: [93, 150], K2: [106, 119], F2: [107, 150] }, props: [{ t: 'arrow', at: 'W1', dir: [0, 0, 1] }], scene: [{ t: 'wall', x: 72, left: true }], cam: 100 },
  },
  iso_rodilla_sentado: {
    name: 'Extensión de rodilla isométrica sentado', kind: 'iso', impl: 'bw', zone: 'rodilla',
    cues: ['Sentado, estirá la rodilla hasta que la pierna quede casi horizontal y sostené.', 'Para más carga: una banda atada a la pata de la silla o una tobillera con peso.', 'Dolor hasta 3–4 sobre 10.'],
    fig: { a: { ...SEATED, K1: [128, 110], F1: [154, 118], T1: [161, 110] }, scene: [CHAIR_SEAT] },
  },
  iso_gemelo_sentado: {
    name: 'Gemelos isométrico sentado', kind: 'iso', impl: 'db', load0: 2, zone: 'aquiles',
    cues: ['Sentado, talones levantados, mancuerna apoyada sobre las rodillas.', 'Sostené arriba sin moverte.', 'Buena opción si de pie molesta demasiado.'],
    fig: { a: { ...SEATED, F1: [130, 142], T1: [138, 150], F2: [126, 142], T2: [134, 150], E1: [116, 96], W1: [126, 104] }, props: [{ t: 'db', at: 'W1' }], scene: [CHAIR_SEAT] },
  },
  excentrico_muneca: {
    name: 'Excéntrico de muñeca', kind: 'lento', impl: 'db', load0: 2, zone: 'codo_lat',
    cues: ['Antebrazo apoyado en el muslo, palma hacia abajo.', 'Subí la mano ayudándote con la otra y bajala sola en 4 s.', 'Clásico para codo de tenista: la bajada es lo que cuenta.'],
    fig: { a: { ...WRIST_SEAT, G1: [140.2, 92.6] }, b: { G1: [140.2, 107.4] }, palm: 'down', props: [{ t: 'db', at: 'W1', sm: true }], scene: [CHAIR_SEAT], dur: 5, cam: 40, pitch: 36, focus: ['H', 'E1', 'G1', 'K1'] },
  },
  tyler_toalla: {
    name: 'Tyler twist con toalla', kind: 'lento', impl: 'bw', zone: 'codo_lat',
    cues: ['Toalla enrollada con las dos manos, brazos adelante.', 'Retorcé la toalla con la mano sana y dejá que la del codo afectado ceda despacio (4 s).', 'Sin Flexbar: la toalla bien enrollada funciona parecido.'],
    // Las muñecas giran en sentidos opuestos retorciendo la toalla (la del codo dolorido termina flexionada, en excéntrico).
    fig: { front: true, a: { N: [100, 45], P: [100, 88], E1: [86, 55], W1: [87, 62], G1: [87, 57], E2: [114, 55], W2: [113, 62], G2: [113, 67], K1: [94, 119], F1: [93, 150], K2: [106, 119], F2: [107, 150], x: { G: 47 } }, b: { G1: [87, 67], G2: [113, 57] }, props: [{ t: 'towel', at: 'W1', to: 'W2' }], dur: 5, cam: 38, pitch: 24, focus: ['H', 'E1', 'E2', 'G1', 'G2', 'P'] },
  },
});
const REHAB_OPTIONS = {
  codo_lat: { 1: ['iso_ext_muneca'], 2: ['ext_muneca_lenta', 'excentrico_muneca', 'tyler_toalla'] },
  codo_med: { 1: ['iso_flex_muneca'], 2: ['flex_muneca_lenta'] },
  muneca: { 1: ['iso_prono'], 2: ['prono_lenta', 'ext_muneca_lenta'] },
  hombro: { 1: ['iso_pared', 'iso_rot_ext_pared'], 2: ['lateral_lenta', 'rot_ext_banda'] },
  rodilla: { 1: ['sentadilla_pared', 'iso_rodilla_sentado'], 2: ['goblet_lenta'] },
  aquiles: { 1: ['iso_talones', 'iso_gemelo_sentado'], 2: ['talones_lenta'] },
};
// Categorías para elegir reemplazos en el editor de rutina.
const CATS = { piernas: 'Piernas', empuje: 'Empuje', tiron: 'Tirón', bisagra: 'Cadera', hombro: 'Hombro', brazos: 'Brazos', core: 'Core' };
Object.entries({
  goblet: 'piernas', zancada: 'piernas', press_suelo: 'empuje', press_banco: 'empuje', press_hombros: 'empuje', remo_silla: 'tiron', remo_aros: 'tiron',
  dominadas: 'tiron', rdl: 'bisagra', swing: 'bisagra', puente: 'bisagra', lateral: 'hombro', rot_ext_banda: 'hombro', face_pull: 'hombro',
  curl_martillo: 'brazos', triceps: 'brazos', plancha: 'core',
}).forEach(([id, c]) => (EXERCISES[id].cat = c));
for (const [id, ex] of Object.entries(EXERCISES)) {
  ex.id = id;
  if (typeof ex.fig === 'string') ex.fig = { ...EXERCISES[ex.fig].fig, dur: ex.dur ?? EXERCISES[ex.fig].fig.dur };
}

// Músculos que trabaja cada ejercicio: se iluminan en rojo en la ilustración y se nombran en el detalle.
const MUSCLE_NAMES = {
  forearm: 'antebrazo', delt: 'hombros', chest: 'pecho', triceps: 'tríceps', biceps: 'bíceps', back: 'espalda',
  lumbar: 'zona lumbar', abs: 'abdomen', glutes: 'glúteos', quads: 'cuádriceps', hams: 'isquiotibiales', calves: 'gemelos',
};
Object.entries({
  forearm: ['iso_ext_muneca', 'ext_muneca_lenta', 'iso_flex_muneca', 'flex_muneca_lenta', 'iso_prono', 'prono_lenta', 'excentrico_muneca', 'tyler_toalla'],
  'chest delt': ['iso_pared'], delt: ['lateral_lenta', 'lateral', 'elev_frontal', 'rot_ext_banda', 'iso_rot_ext_pared'],
  'quads glutes': ['sentadilla_pared', 'goblet_lenta', 'goblet', 'zancada', 'bulgara', 'sumo_kb', 'sentadilla_bw', 'zancada_bw'], quads: ['iso_rodilla_sentado'],
  calves: ['iso_talones', 'talones_lenta', 'gemelos_1pierna', 'iso_gemelo_sentado'],
  'chest triceps': ['press_suelo', 'press_banco', 'flexiones', 'flex_declinadas'], 'triceps chest': ['flex_cerradas'],
  'back biceps': ['remo_silla', 'remo_inclinado', 'remo_aros', 'remo_aros_iso', 'dominadas', 'remo_toalla', 'remo_mesa'],
  'hams glutes lumbar': ['rdl', 'pm_una_pierna'], 'glutes hams': ['swing', 'puente', 'hip_thrust', 'puente_bw', 'puente_1pierna'], abs: ['plancha', 'dead_bug'],
  'delt triceps': ['press_hombros', 'pica'], 'biceps forearm': ['curl_martillo'], biceps: ['curl_iso', 'curl_concentrado', 'curl_mesa'],
  triceps: ['triceps', 'patada_triceps', 'press_frances', 'fondos_silla'], 'delt back': ['face_pull', 'pajaros', 'elev_y_piso', 'elev_t_piso'], 'back chest': ['pullover'],
}).forEach(([m, ids]) => ids.forEach((id) => (EXERCISES[id].mus = m.split(' '))));

// Rango de repeticiones de la doble progresión según el tipo de ejercicio (Mono Culturista). Sin dato, logic.js usa [8, 12].
// Quedan sin rango los ejercicios por tiempo o isométricos (plancha, *_iso, sentadilla_pared, iso_pared) y dead_bug, que hoy no tiene tipo de rango.
const REP_RANGE = { compuesto: [6, 12], aislamiento: [10, 15], deltoides: [12, 20], abdominal: [10, 15], piernas_sin_peso: [12, 20] };
Object.entries({
  compuesto: ['goblet', 'sumo_kb', 'press_suelo', 'press_banco', 'flexiones', 'press_hombros', 'remo_silla', 'remo_aros', 'remo_inclinado',
    'dominadas', 'rdl', 'swing', 'pm_una_pierna', 'zancada', 'bulgara', 'hip_thrust', 'puente',
    'pica', 'flex_declinadas', 'flex_cerradas', 'fondos_silla', 'remo_toalla', 'remo_mesa'],
  aislamiento: ['curl_martillo', 'curl_concentrado', 'triceps', 'patada_triceps', 'press_frances', 'pullover', 'elev_frontal', 'gemelos_1pierna', 'curl_mesa'],
  deltoides: ['lateral', 'face_pull', 'pajaros', 'rot_ext_banda', 'elev_y_piso', 'elev_t_piso'],
  // Sin peso, las piernas necesitan más repeticiones para llegar cerca del fallo.
  piernas_sin_peso: ['sentadilla_bw', 'zancada_bw', 'puente_bw', 'puente_1pierna'],
}).forEach(([type, ids]) => ids.forEach((id) => { EXERCISES[id].reps = [...REP_RANGE[type]]; EXERCISES[id].rtype = type; }));

// Cómo se ve la mancuerna (ver dumbbell() en figures.js). Sin dato: de frente 'end', de costado 'neutral'.
Object.entries({
  end: ['iso_ext_muneca', 'ext_muneca_lenta', 'iso_flex_muneca', 'flex_muneca_lenta', 'excentrico_muneca', 'press_suelo', 'press_banco', 'rdl',
    'puente', 'hip_thrust', 'curl_iso', 'curl_concentrado', 'elev_frontal', 'iso_gemelo_sentado'],
  along: ['triceps', 'pullover'],
  side: ['press_hombros'],
}).forEach(([g, ids]) => ids.forEach((id) => EXERCISES[id].fig.props.forEach((p) => p.t === 'db' && (p.grip = g))));
EXERCISES.prono_lenta.fig.props[0].grip = 'roll';
EXERCISES.prono_lenta.fig.roll = [-45, 45];   // 90° en total: 45° hacia palma abajo y 45° hacia palma arriba desde la posición vertical
// Manos juntas (una sola pesa con las dos manos) o apoyadas en la cadera: distancia de codos y manos al centro del cuerpo.
Object.entries({
  goblet: { E: 10, W: 4 }, goblet_lenta: { E: 10, W: 4 }, sumo_kb: { E: 9, W: 3 }, swing: { E: 9, W: 3 }, triceps: { E: 9, W: 3 },
  pullover: { E: 10, W: 3 }, puente: { W: 9 }, hip_thrust: { W: 9 },
}).forEach(([id, z]) => (EXERCISES[id].fig = { ...EXERCISES[id].fig, z }));
// Cámara a mano donde el ángulo automático no muestra bien el ejercicio: dominadas (tres cuartos de atrás), sumo (de costado y desde
// arriba, para ver las rodillas abrirse) y peso muerto rumano (casi de perfil, para ver la bisagra de cadera).
Object.entries({ dominadas: -65, sumo_kb: 45, rdl: -6, remo_aros_iso: -15 }).forEach(([id, cam]) => (EXERCISES[id].fig = { ...EXERCISES[id].fig, cam }));
EXERCISES.sumo_kb.fig.pitch = 35;   // un poco más desde arriba: se ve cómo las rodillas avanzan sobre los pies
// Press acostados: un poco más desde arriba para ver el pecho y los dos brazos.
for (const id of ['press_suelo', 'press_banco']) EXERCISES[id].fig = { ...EXERCISES[id].fig, cam: 40, pitch: 40 };


// Cuerpo completo A/B (6 ejercicios por día). Sin banco: press en el suelo y remo apoyado en silla.
const TEMPLATES = {
  A: ['goblet', 'press_suelo', 'remo_silla', 'rdl', 'lateral', 'plancha'],
  B: ['zancada', 'press_hombros', 'remo_aros', 'swing', 'curl_martillo', 'triceps'],
};

// Huecos por patrón de movimiento: cada uno lista los ejercicios de la biblioteca por orden de preferencia (pesado → liviano → peso corporal).
// El orden de declaración importa: slotOf(id) devuelve el primer hueco que lista el ejercicio.
const SLOTS = {
  empuje_h: { name: 'Empuje horizontal', ex: ['press_banco', 'press_suelo', 'flexiones'] },
  empuje_inc: { name: 'Empuje inclinado', ex: ['press_banco', 'flexiones', 'flex_declinadas'] },
  empuje_v: { name: 'Empuje vertical', ex: ['press_hombros', 'pica'] },
  traccion_v: { name: 'Tracción vertical', ex: ['dominadas', 'pullover', 'remo_inclinado', 'remo_silla', 'remo_mesa', 'remo_toalla'] },   // sin barra ni banco, un remo
  traccion_h: { name: 'Tracción horizontal', ex: ['remo_aros', 'remo_silla', 'remo_inclinado', 'remo_toalla', 'remo_mesa'] },
  rodilla: { name: 'Rodilla dominante', ex: ['goblet', 'sumo_kb', 'sentadilla_bw'] },
  unilateral: { name: 'Unilateral', ex: ['zancada', 'bulgara', 'zancada_bw'] },
  bisagra: { name: 'Bisagra', ex: ['rdl', 'swing', 'pm_una_pierna', 'puente_1pierna'] },
  gluteo: { name: 'Glúteo', ex: ['hip_thrust', 'puente', 'puente_bw'] },
  gemelos: { name: 'Gemelos', ex: ['gemelos_1pierna'] },
  lateral: { name: 'Lateral', ex: ['lateral', 'elev_frontal', 'elev_y_piso', 'elev_t_piso'] },
  deltoides_post: { name: 'Deltoides posterior', ex: ['face_pull', 'pajaros', 'rot_ext_banda', 'elev_t_piso', 'elev_y_piso', 'remo_toalla'] },
  biceps: { name: 'Bíceps', ex: ['curl_martillo', 'curl_concentrado', 'curl_mesa', 'remo_toalla'] },
  triceps: { name: 'Tríceps', ex: ['triceps', 'patada_triceps', 'press_frances', 'fondos_silla', 'flex_cerradas'] },
  abdominal: { name: 'Abdominal', ex: ['plancha', 'dead_bug'] },
  isometrico: { name: 'Isométrico', ex: ['remo_aros_iso', 'curl_iso', 'sentadilla_pared', 'iso_pared'] },
};

// Planes: lista de días, cada día una lista de huecos con sus series. `ex` fija la preferencia cuando un hueco se repite en el plan.
// `kind` agrupa los planes en el selector, `week` son los días de entrenamiento que propone y `short` es la sigla del día en la semana tipo.
// Full body 2 días equivale a TEMPLATES.A/B (mismo orden de huecos).
// Los de tipo 'medida' no se listan: solo los arma el plan a tu medida según la cantidad de días (PLAN_BY_DAYS).
const PLAN_KINDS = { fb: 'Cuerpo completo', grupos: 'Por grupos musculares' };
const PLANS = {
  fb2: {
    id: 'fb2',
    name: 'Full body 2 días',
    kind: 'fb', week: ['lu', 'ju'], mins: '40–50',
    for: 'Para arrancar o si tenés poco tiempo: todo el cuerpo en cada sesión.',
    source: {
      title: 'Mono Culturista: rangos por ejercicio, 3 series por ejercicio, cada músculo al menos 2 veces por semana',
      url: 'https://www.youtube.com/@MonoCulturista',
      videos: ['ioDqs84m9-Y', 'bJ2N1LdXkeo', 'xAAB_3xZ-Ho'],
    },
    days: [
      {
        name: 'Día A', short: 'A',
        slots: [
          { slot: 'rodilla', sets: 3 }, { slot: 'empuje_h', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' },
          { slot: 'bisagra', sets: 3, ex: 'rdl' }, { slot: 'lateral', sets: 3 }, { slot: 'abdominal', sets: 3 },
        ],
      },
      {
        name: 'Día B', short: 'B',
        slots: [
          { slot: 'unilateral', sets: 3 }, { slot: 'empuje_v', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_aros' },
          { slot: 'bisagra', sets: 3, ex: 'swing' }, { slot: 'biceps', sets: 3 }, { slot: 'triceps', sets: 3 },
        ],
      },
    ],
  },
  fb3: {
    id: 'fb3',
    name: 'Full body 3 días',
    kind: 'fb', week: ['lu', 'mi', 'vi'], mins: '40–50',
    for: 'Todo el cuerpo en cada sesión, con ejercicios distintos cada día: cada músculo 3 veces por semana.',
    source: { title: 'Mono Culturista: Rutina full body en casa', url: 'https://www.youtube.com/watch?v=NAdjjNPJKw0', videos: ['NAdjjNPJKw0'] },
    days: [
      {
        name: 'Día A', short: 'A',
        slots: [
          { slot: 'rodilla', sets: 3 }, { slot: 'empuje_h', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' },
          { slot: 'bisagra', sets: 3, ex: 'rdl' }, { slot: 'lateral', sets: 3 }, { slot: 'abdominal', sets: 3 },
        ],
      },
      {
        name: 'Día B', short: 'B',
        slots: [
          { slot: 'unilateral', sets: 3 }, { slot: 'empuje_v', sets: 3 }, { slot: 'traccion_v', sets: 3 },
          { slot: 'gluteo', sets: 3 }, { slot: 'biceps', sets: 3 }, { slot: 'triceps', sets: 3 },
        ],
      },
      {
        name: 'Día C', short: 'C',
        slots: [
          { slot: 'unilateral', sets: 3, ex: 'bulgara' }, { slot: 'empuje_inc', sets: 3, ex: 'flexiones' }, { slot: 'traccion_h', sets: 3, ex: 'remo_inclinado' },
          { slot: 'bisagra', sets: 3, ex: 'pm_una_pierna' }, { slot: 'deltoides_post', sets: 3 }, { slot: 'abdominal', sets: 3, ex: 'dead_bug' },
        ],
      },
    ],
  },
  tp4: {
    id: 'tp4',
    name: 'Torso y pierna 4 días',
    kind: 'grupos', week: ['lu', 'ma', 'ju', 'vi'], mins: '40–55',
    for: 'Para ganar músculo: la parte de arriba y las piernas en días separados, cada músculo 2 veces por semana.',
    source: { title: 'Mono Culturista: El método griego (forma de V)', url: 'https://www.youtube.com/watch?v=aEawunv6L9I', videos: ['aEawunv6L9I', 'xAAB_3xZ-Ho'] },
    days: [
      {
        name: 'Torso A', short: 'TA',
        slots: [
          { slot: 'empuje_h', sets: 3 }, { slot: 'traccion_v', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' },
          { slot: 'empuje_v', sets: 3 }, { slot: 'lateral', sets: 3 }, { slot: 'biceps', sets: 3 }, { slot: 'triceps', sets: 3 },
        ],
      },
      {
        name: 'Pierna A', short: 'PA',
        slots: [{ slot: 'rodilla', sets: 3 }, { slot: 'bisagra', sets: 3, ex: 'rdl' }, { slot: 'gemelos', sets: 3 }, { slot: 'abdominal', sets: 3 }],
      },
      {
        name: 'Torso B', short: 'TB',
        slots: [
          { slot: 'empuje_inc', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_inclinado' }, { slot: 'traccion_v', sets: 3 },
          { slot: 'lateral', sets: 3 }, { slot: 'deltoides_post', sets: 3 }, { slot: 'biceps', sets: 3, ex: 'curl_concentrado' }, { slot: 'triceps', sets: 3, ex: 'press_frances' },
        ],
      },
      {
        name: 'Pierna B', short: 'PB',
        slots: [
          { slot: 'unilateral', sets: 3, ex: 'bulgara' }, { slot: 'bisagra', sets: 3, ex: 'pm_una_pierna' }, { slot: 'gluteo', sets: 3 },
          { slot: 'gemelos', sets: 3 }, { slot: 'abdominal', sets: 3, ex: 'dead_bug' },
        ],
      },
    ],
  },
  gr5: {
    id: 'gr5',
    name: 'Por grupos 5 días',
    kind: 'grupos', week: ['lu', 'ma', 'mi', 'ju', 'vi'], mins: '30–40',
    for: 'Un grupo muscular por día, sesiones cortas. Mejor si entrenás hace más de 6 meses.',
    source: { title: 'Mono Culturista: Físico atlético en 90 días', url: 'https://www.youtube.com/watch?v=48OsVIHE9jk', videos: ['48OsVIHE9jk'] },
    days: [
      {
        name: 'Pecho', short: 'Pe',
        slots: [{ slot: 'empuje_h', sets: 3 }, { slot: 'empuje_inc', sets: 3 }, { slot: 'triceps', sets: 3 }, { slot: 'triceps', sets: 3, ex: 'press_frances' }],
      },
      {
        name: 'Hombros', short: 'Ho',
        slots: [
          { slot: 'empuje_v', sets: 3 }, { slot: 'lateral', sets: 3 }, { slot: 'lateral', sets: 3, ex: 'elev_frontal' },
          { slot: 'deltoides_post', sets: 3 }, { slot: 'abdominal', sets: 3 }, { slot: 'abdominal', sets: 3, ex: 'dead_bug' },
        ],
      },
      {
        name: 'Espalda', short: 'Es',
        slots: [
          { slot: 'traccion_v', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' }, { slot: 'bisagra', sets: 3, ex: 'rdl' },
          { slot: 'deltoides_post', sets: 3 }, { slot: 'biceps', sets: 3 },
        ],
      },
      {
        name: 'Piernas', short: 'Pi',
        slots: [{ slot: 'rodilla', sets: 3 }, { slot: 'unilateral', sets: 3 }, { slot: 'gluteo', sets: 3 }, { slot: 'gemelos', sets: 3 }, { slot: 'abdominal', sets: 3 }],
      },
      {
        name: 'Brazos', short: 'Br',
        slots: [
          { slot: 'biceps', sets: 3 }, { slot: 'triceps', sets: 3 }, { slot: 'biceps', sets: 3, ex: 'curl_concentrado' },
          { slot: 'triceps', sets: 3, ex: 'patada_triceps' }, { slot: 'lateral', sets: 3 },
        ],
      },
    ],
  },
  fb1: {
    id: 'fb1',
    name: 'Full body 1 día',
    kind: 'medida', week: ['mi'], mins: '45–55',
    for: 'Una sesión por semana con los movimientos básicos de todo el cuerpo.',
    source: { title: 'Mono Culturista: rangos por ejercicio, 3 series por ejercicio', url: 'https://www.youtube.com/@MonoCulturista', videos: ['ioDqs84m9-Y'] },
    days: [
      {
        name: 'Día A', short: 'A',
        slots: [
          { slot: 'rodilla', sets: 3 }, { slot: 'empuje_h', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' },
          { slot: 'bisagra', sets: 3, ex: 'rdl' }, { slot: 'empuje_v', sets: 3 }, { slot: 'abdominal', sets: 3 },
        ],
      },
    ],
  },
  ppl6: {
    id: 'ppl6',
    name: 'Empuje, tracción y pierna 6 días',
    kind: 'medida', week: ['lu', 'ma', 'mi', 'ju', 'vi', 'sa'], mins: '30–40',
    for: 'Empuje, tracción y pierna dos veces por semana, sesiones cortas.',
    source: { title: 'Mono Culturista: 3 series por ejercicio, cada músculo al menos 2 veces por semana', url: 'https://www.youtube.com/@MonoCulturista', videos: ['bJ2N1LdXkeo'] },
    days: [
      { name: 'Empuje A', short: 'EA', slots: [{ slot: 'empuje_h', sets: 3 }, { slot: 'empuje_v', sets: 3 }, { slot: 'lateral', sets: 3 }, { slot: 'triceps', sets: 3 }] },
      { name: 'Tracción A', short: 'TA', slots: [{ slot: 'traccion_v', sets: 3 }, { slot: 'traccion_h', sets: 3, ex: 'remo_silla' }, { slot: 'deltoides_post', sets: 3 }, { slot: 'biceps', sets: 3 }] },
      { name: 'Pierna A', short: 'PA', slots: [{ slot: 'rodilla', sets: 3 }, { slot: 'bisagra', sets: 3, ex: 'rdl' }, { slot: 'gemelos', sets: 3 }, { slot: 'abdominal', sets: 3 }] },
      { name: 'Empuje B', short: 'EB', slots: [{ slot: 'empuje_inc', sets: 3 }, { slot: 'empuje_v', sets: 3 }, { slot: 'lateral', sets: 3, ex: 'elev_frontal' }, { slot: 'triceps', sets: 3, ex: 'press_frances' }] },
      { name: 'Tracción B', short: 'TB', slots: [{ slot: 'traccion_h', sets: 3, ex: 'remo_inclinado' }, { slot: 'traccion_v', sets: 3 }, { slot: 'deltoides_post', sets: 3 }, { slot: 'biceps', sets: 3, ex: 'curl_concentrado' }] },
      {
        name: 'Pierna B', short: 'PB',
        slots: [{ slot: 'unilateral', sets: 3, ex: 'bulgara' }, { slot: 'bisagra', sets: 3, ex: 'pm_una_pierna' }, { slot: 'gluteo', sets: 3 }, { slot: 'gemelos', sets: 3 }, { slot: 'abdominal', sets: 3, ex: 'dead_bug' }],
      },
    ],
  },
};

// Plan a tu medida: con cuántos días entrenás decide el plan (el séptimo día siempre es de descanso).
const PLAN_BY_DAYS = { 1: 'fb1', 2: 'fb2', 3: 'fb3', 4: 'tp4', 5: 'gr5', 6: 'ppl6' };

const EXPERIENCE = [
  { id: 'novato', name: 'Menos de 6 meses', mult: 1 },
  { id: 'medio', name: '6 meses a 2 años', mult: 1.5 },
  { id: 'avanzado', name: 'Más de 2 años', mult: 2 },
];

const SOURCES = [
  { title: 'Jeremy Ethier — It\'s Weird, But It Re-Builds Your Tendons In 30 Days (con Keith Baar y Coach Q)', url: 'https://www.youtube.com/watch?v=GSwL3Lgw6zI' },
  { title: 'Built With Science (Jeremy Ethier)', url: 'https://builtwithscience.com/' },
  { title: 'Fuente Oswald — SIL Open Font License 1.1', url: 'fonts/OFL.txt' },
];

// Si falta el equipo: aros → remo en silla; pesa rusa → mancuerna (alsoDb).
const NO_RINGS = { remo_aros: 'remo_silla', remo_aros_iso: 'curl_iso' };
