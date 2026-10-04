/* Tilde — sample data (2C 2026). The prototype pins "today" to Tue 13/10/2026 so the
   week includes a national holiday (12/10). Override with ?hoy=YYYY-MM-DD. */
window.SUBJECT_COLORS = [
  { key: 'frambuesa', es: 'Frambuesa', en: 'Raspberry' },
  { key: 'mandarina', es: 'Mandarina', en: 'Tangerine' },
  { key: 'ambar', es: 'Ámbar', en: 'Amber' },
  { key: 'lima', es: 'Lima', en: 'Lime' },
  { key: 'pino', es: 'Pino', en: 'Pine' },
  { key: 'turquesa', es: 'Turquesa', en: 'Teal' },
  { key: 'cielo', es: 'Cielo', en: 'Sky' },
  { key: 'cobalto', es: 'Cobalto', en: 'Cobalt' },
  { key: 'uva', es: 'Uva', en: 'Grape' },
  { key: 'fucsia', es: 'Fucsia', en: 'Fuchsia' },
  { key: 'cacao', es: 'Cacao', en: 'Cocoa' },
  { key: 'grafito', es: 'Grafito', en: 'Graphite' }
];

/* Feriados nacionales de Argentina 2026 (inamovibles + trasladables en su fecha de goce).
   Sin días no laborables (Jueves Santo) ni días con fines turísticos (23/03, 10/07, 07/12). */
window.AR_HOLIDAYS = [
  { date: '2026-01-01', es: 'Año Nuevo', en: "New Year's Day" },
  { date: '2026-02-16', es: 'Carnaval', en: 'Carnival' },
  { date: '2026-02-17', es: 'Carnaval', en: 'Carnival' },
  { date: '2026-03-24', es: 'Día Nacional de la Memoria por la Verdad y la Justicia', en: 'National Day of Remembrance for Truth and Justice' },
  { date: '2026-04-02', es: 'Día del Veterano y de los Caídos en Malvinas', en: 'Malvinas Veterans Day' },
  { date: '2026-04-03', es: 'Viernes Santo', en: 'Good Friday' },
  { date: '2026-05-01', es: 'Día del Trabajador', en: 'Labour Day' },
  { date: '2026-05-25', es: 'Revolución de Mayo', en: 'May Revolution' },
  { date: '2026-06-15', es: 'Paso a la Inmortalidad de Güemes', en: 'Güemes Day' },
  { date: '2026-06-20', es: 'Paso a la Inmortalidad de Belgrano', en: 'Flag Day (Belgrano)' },
  { date: '2026-07-09', es: 'Día de la Independencia', en: 'Independence Day' },
  { date: '2026-08-17', es: 'Paso a la Inmortalidad de San Martín', en: 'San Martín Day' },
  { date: '2026-10-12', es: 'Día del Respeto a la Diversidad Cultural', en: 'Day of Respect for Cultural Diversity' },
  { date: '2026-11-23', es: 'Día de la Soberanía Nacional', en: 'National Sovereignty Day' },
  { date: '2026-12-08', es: 'Inmaculada Concepción de María', en: 'Immaculate Conception' },
  { date: '2026-12-25', es: 'Navidad', en: 'Christmas Day' }
];

window.SAMPLE = function () {
  return {
    user: { name: 'Pato Zárate', email: 'patoyzo06@gmail.com', initials: 'PZ' },
    subjects: [
      { id: 's1', name: 'Lógica Computacional', commission: 'Com. 2', teacher: 'Mariana Ferreyra', term: '2C 2026', credits: 6, color: 'cobalto', archived: false, grades: { course: 8, final: null },
        docs: [ { id: 'd1', type: 'doc', name: 'Apunte: deducción natural', url: 'https://docs.google.com/document/d/ejemplo1' }, { id: 'd2', type: 'pdf', name: 'Copi — Introducción a la lógica (cap. 3)', url: 'https://drive.google.com/file/d/ejemplo2' }, { id: 'd3', type: 'link', name: 'Campus — Lógica', url: 'https://campus.ejemplo.edu.ar/logica' } ] },
      { id: 's2', name: 'Programación Orientada a Objetos', commission: 'Com. 1', teacher: 'Diego Salvatierra', term: '2C 2026', credits: 8, color: 'pino', archived: false, grades: { course: 9, final: null },
        docs: [ { id: 'd4', type: 'slides', name: 'Clase 6 — Herencia y polimorfismo', url: 'https://docs.google.com/presentation/d/ejemplo4' }, { id: 'd5', type: 'doc', name: 'Enunciado TP integrador', url: 'https://docs.google.com/document/d/ejemplo5' } ] },
      { id: 's3', name: 'Física II', commission: 'Com. 3', teacher: 'Laura Benítez', term: '2C 2026', credits: 8, color: 'mandarina', archived: false, grades: { course: null, final: null },
        docs: [ { id: 'd6', type: 'pdf', name: 'Guía 4 — Electrostática', url: 'https://drive.google.com/file/d/ejemplo6' }, { id: 'd7', type: 'sheet', name: 'Mediciones laboratorio 1', url: 'https://docs.google.com/spreadsheets/d/ejemplo7' }, { id: 'd8', type: 'image', name: 'Foto del pizarrón 06/10', url: 'https://drive.google.com/file/d/ejemplo8' }, { id: 'd9', type: 'pdf', name: 'Resnick — Física vol. 2', url: 'https://drive.google.com/file/d/ejemplo9' } ] },
      { id: 's4', name: 'Diseño y Procesamiento de Documentos XML', commission: 'Com. 1', teacher: 'Pablo Rinaldi', term: '2C 2026', credits: 4, color: 'uva', archived: false, grades: { course: null, final: null },
        docs: [ { id: 'd10', type: 'doc', name: 'Enunciado TP 2 — Facturas XML', url: 'https://docs.google.com/document/d/ejemplo10' } ] },
      { id: 's5', name: 'Química', commission: 'Com. 4', teacher: 'Silvia Acosta', term: '2C 2026', credits: 6, color: 'turquesa', archived: false, grades: { course: null, final: null }, docs: [] },
      { id: 's6', name: 'Inglés técnico', commission: 'Com. 5', teacher: 'Ana Quiroga', term: '2C 2026', credits: 2, color: 'fucsia', archived: false, grades: { course: 9, final: 8 }, docs: [] },
      { id: 's7', name: 'Álgebra', commission: 'Com. 1', teacher: 'Gustavo Medina', term: '1C 2026', credits: 8, color: 'frambuesa', archived: true, grades: { course: 8, final: 9 }, docs: [ { id: 'd11', type: 'pdf', name: 'Práctica 5 — Transformaciones lineales', url: 'https://drive.google.com/file/d/ejemplo11' } ] },
      { id: 's8', name: 'Introducción a la Programación', commission: 'Com. 3', teacher: 'Valeria Ortiz', term: '1C 2026', credits: 6, color: 'ambar', archived: true, grades: { course: 7, final: 7 }, docs: [] }
    ],
    classes: [
      { id: 'c1', subjectId: 's1', day: 1, start: '08:00', end: '10:00', room: 'Aula 305' },
      { id: 'c2', subjectId: 's1', day: 3, start: '08:00', end: '10:00', room: 'Aula 305' },
      { id: 'c3', subjectId: 's2', day: 2, start: '14:00', end: '17:00', room: 'Laboratorio 2' },
      { id: 'c4', subjectId: 's2', day: 4, start: '18:00', end: '20:00', room: 'Aula 210' },
      { id: 'c5', subjectId: 's3', day: 1, start: '18:00', end: '20:00', room: 'Aula 110' },
      { id: 'c6', subjectId: 's3', day: 4, start: '08:30', end: '11:00', room: 'Aula 110' },
      { id: 'c7', subjectId: 's4', day: 3, start: '18:00', end: '20:00', room: 'Aula 402' },
      { id: 'c8', subjectId: 's5', day: 2, start: '08:00', end: '10:00', room: 'Aula 201' },
      { id: 'c9', subjectId: 's5', day: 5, start: '08:00', end: '10:00', room: 'Lab. de Química' },
      { id: 'c10', subjectId: 's6', day: 5, start: '14:00', end: '15:30', room: 'Aula 12' }
    ],
    events: [
      { id: 'e1', title: 'Vóley', color: 'lima', start: '21:00', end: '23:00', repeat: { type: 'weekly', days: [1, 3] }, until: null, date: null },
      { id: 'e2', title: 'Cerámica', color: 'cacao', start: '19:00', end: '21:00', repeat: { type: 'weekly', days: [2] }, until: null, date: null },
      { id: 'e3', title: 'Ayudantía de Álgebra', color: 'frambuesa', start: '14:00', end: '16:00', repeat: { type: 'weekly', days: [4] }, until: '2026-11-26', date: null },
      { id: 'e4', title: 'Consulta Física II', color: 'mandarina', start: '10:00', end: '11:30', repeat: { type: 'none', days: [] }, until: null, date: '2026-10-15' },
      { id: 'e5', title: 'Viaje a la facu', color: 'grafito', start: '12:30', end: '14:00', repeat: { type: 'weekly', days: [2] }, until: null, date: null }
    ],
    skips: [ { kind: 'class', id: 'c7', date: '2026-10-14' } ],
    holidayRestores: [],
    tasks: [
      { id: 't1', title: 'Resolver guía 4: ejercicios 1 a 8', subjectId: 's3', priority: 2, due: null, lead: null, date: '2026-10-12', done: false, doneAt: null, order: 1,
        subtasks: [ { id: 'st1', title: 'Ejercicios 1 y 2', done: true }, { id: 'st2', title: 'Ejercicios 3 y 4', done: true }, { id: 'st3', title: 'Ejercicios 5 y 6', done: false }, { id: 'st4', title: 'Ejercicios 7 y 8', done: false } ] },
      { id: 't2', title: 'TP 2: parser de facturas en XML', subjectId: 's4', priority: 3, due: '2026-10-16', lead: 5, date: null, done: false, doneAt: null, order: 2, calId: 'ce3',
        subtasks: [ { id: 'st5', title: 'Definir el XSD', done: true }, { id: 'st6', title: 'Validar los ejemplos', done: true }, { id: 'st7', title: 'Transformación XSLT a HTML', done: false }, { id: 'st8', title: 'Escribir el informe', done: false } ] },
      { id: 't3', title: 'Leer capítulo 3 de Copi', subjectId: 's1', priority: 2, due: null, lead: null, date: '2026-10-13', done: false, doneAt: null, order: 3, subtasks: [] },
      { id: 't4', title: 'Informe de laboratorio 1', subjectId: 's5', priority: 3, due: '2026-10-12', lead: 4, date: null, done: false, doneAt: null, order: 4, subtasks: [] },
      { id: 't5', title: 'Ejercicios de herencia y polimorfismo', subjectId: 's2', priority: 1, due: null, lead: null, date: '2026-10-10', done: false, doneAt: null, order: 5, subtasks: [] },
      { id: 't6', title: 'Repasar estequiometría', subjectId: 's5', priority: 1, due: null, lead: null, date: '2026-10-13', done: true, doneAt: '2026-10-13', order: 6, subtasks: [] },
      { id: 't7', title: 'Comprar guardapolvo para el laboratorio', subjectId: null, priority: 0, due: null, lead: null, date: '2026-10-13', done: true, doneAt: '2026-10-13', order: 7, subtasks: [] },
      { id: 't8', title: 'Parcial · Física II', subjectId: 's3', priority: 3, due: '2026-10-20', lead: 7, date: null, done: false, doneAt: null, order: 8, calId: 'ce1', subtasks: [] },
      { id: 't9', title: 'Preparar preguntas para la consulta', subjectId: 's3', priority: 0, due: null, lead: null, date: '2026-10-14', done: false, doneAt: null, order: 9, subtasks: [] },
      { id: 't10', title: 'Guía 3 de Lógica: deducción natural', subjectId: 's1', priority: 2, due: null, lead: null, date: '2026-10-15', done: false, doneAt: null, order: 10,
        subtasks: [ { id: 'st9', title: 'Reglas de introducción', done: false }, { id: 'st10', title: 'Reglas de eliminación', done: false }, { id: 'st11', title: 'Ejercicios integradores', done: false } ] },
      { id: 't11', title: 'Reading: unit 4 vocabulary', subjectId: 's6', priority: 0, due: null, lead: null, date: '2026-10-14', done: false, doneAt: null, order: 11, subtasks: [] },
      { id: 't12', title: 'Parcial · Lógica Computacional', subjectId: 's1', priority: 3, due: '2026-10-22', lead: 5, date: null, done: false, doneAt: null, order: 12, calId: 'ce2', subtasks: [] },
      { id: 't13', title: 'Pasar en limpio apuntes de POO', subjectId: 's2', priority: 0, due: null, lead: null, date: '2026-10-16', done: false, doneAt: null, order: 13, subtasks: [] },
      { id: 't15', title: 'Guía 1 de Lógica: tablas de verdad', subjectId: 's1', priority: 1, due: null, lead: null, date: '2026-09-02', done: true, doneAt: '2026-09-03', order: 15, subtasks: [] },
      { id: 't16', title: 'Guía 2 de Lógica: formalización', subjectId: 's1', priority: 1, due: null, lead: null, date: '2026-09-16', done: true, doneAt: '2026-09-17', order: 16, subtasks: [] },
      { id: 't17', title: 'TP 1: modelo de clases', subjectId: 's2', priority: 3, due: '2026-09-25', lead: 5, date: null, done: true, doneAt: '2026-09-24', order: 17, subtasks: [] },
      { id: 't18', title: 'Ejercicios de encapsulamiento', subjectId: 's2', priority: 0, due: null, lead: null, date: '2026-09-29', done: true, doneAt: '2026-09-29', order: 18, subtasks: [] },
      { id: 't19', title: 'Guía 3 de Física: campo eléctrico', subjectId: 's3', priority: 2, due: null, lead: null, date: '2026-10-01', done: true, doneAt: '2026-10-02', order: 19, subtasks: [] },
      { id: 't20', title: 'TP 1: DTD de una biblioteca', subjectId: 's4', priority: 3, due: '2026-09-18', lead: 5, date: null, done: true, doneAt: '2026-09-18', order: 20, subtasks: [] },
      { id: 't21', title: 'Unit 3 exercises', subjectId: 's6', priority: 0, due: null, lead: null, date: '2026-10-05', done: true, doneAt: '2026-10-05', order: 21, subtasks: [] },
      { id: 't22', title: 'Leer cap. 2 de Chang', subjectId: 's5', priority: 0, due: null, lead: null, date: '2026-10-06', done: true, doneAt: '2026-10-07', order: 22, subtasks: [] },
      { id: 't14', title: 'Pedir turno para el laboratorio de Física', subjectId: null, priority: 1, due: null, lead: null, date: '2026-10-15', done: false, doneAt: null, order: 14, subtasks: [] }
    ],
    calEvents: [
      { id: 'ce1', category: 'parcial', subjectId: 's3', title: '', date: '2026-10-20', lead: 7 },
      { id: 'ce2', category: 'parcial', subjectId: 's1', title: '', date: '2026-10-22', lead: 5 },
      { id: 'ce3', category: 'tp', subjectId: 's4', title: 'TP 2 · XML', date: '2026-10-16', lead: 5 },
      { id: 'ce4', category: 'parcial', subjectId: 's5', title: '', date: '2026-10-27', lead: 5 },
      { id: 'ce5', category: 'parcial', subjectId: 's2', title: '', date: '2026-10-28', lead: 5 },
      { id: 'ce6', category: 'tp', subjectId: 's2', title: 'TP integrador · POO', date: '2026-10-30', lead: 7 },
      { id: 'ce7', category: 'recuperatorio', subjectId: 's3', title: '', date: '2026-11-03', confirmed: false },
      { id: 'ce8', category: 'recuperatorio', subjectId: 's1', title: '', date: '2026-11-05', confirmed: true },
      { id: 'ce9', category: 'tp', subjectId: 's6', title: 'Writing task · Inglés', date: '2026-10-20', lead: 3 },
      { id: 'ce10', category: 'tp', subjectId: 's5', title: 'Informe lab. 2 · Química', date: '2026-10-20', lead: 4 },
      { id: 'ce11', category: 'recuperatorio', subjectId: 's5', title: '', date: '2026-10-20', confirmed: false },
      { id: 'ce12', category: 'final', subjectId: 's7', title: 'Final · Álgebra (mesa de diciembre)', date: '2026-12-09' },
      { id: 'ce13', category: 'final', subjectId: 's6', title: '', date: '2026-11-25' },
      { id: 'ce14', category: 'tp', subjectId: 's4', title: 'TP 3 · XSLT', date: '2026-11-06', lead: 5 },
      { id: 'ce15', category: 'feriado', subjectId: null, title: 'Día del Estudiante (sin clases)', date: '2026-09-21', manual: true }
    ],
    sessions: [
      { id: 'h1', date: '2026-10-13', subjectId: 's3', preset: '50/10', focus: 100, breaks: 10, cycles: 2, tasks: 1 },
      { id: 'h2', date: '2026-10-12', subjectId: 's4', preset: '25/5', focus: 100, breaks: 15, cycles: 4, tasks: 2 },
      { id: 'h3', date: '2026-10-11', subjectId: 's1', preset: '90/20', focus: 90, breaks: 0, cycles: 1, tasks: 0 },
      { id: 'h4', date: '2026-10-10', subjectId: null, preset: '25/5', focus: 50, breaks: 5, cycles: 2, tasks: 3 },
      { id: 'h5', date: '2026-10-08', subjectId: 's2', preset: '50/10', focus: 150, breaks: 20, cycles: 3, tasks: 2 },
      { id: 'h6', date: '2026-10-07', subjectId: 's3', preset: '25/5', focus: 75, breaks: 10, cycles: 3, tasks: 1 },
      { id: 'h7', date: '2026-10-06', subjectId: 's5', preset: '50/10', focus: 50, breaks: 0, cycles: 1, tasks: 1 },
      { id: 'h8', date: '2026-10-03', subjectId: 's1', preset: '25/5', focus: 100, breaks: 15, cycles: 4, tasks: 2 },
      { id: 'h9', date: '2026-10-01', subjectId: 's4', preset: '50/10', focus: 100, breaks: 10, cycles: 2, tasks: 1 },
      { id: 'h10', date: '2026-09-29', subjectId: 's2', preset: 'Personalizado 40/8', focus: 120, breaks: 16, cycles: 3, tasks: 2 }
    ],
    weeklyFocus: [ 310, 420, 260, 515, 380, 455, 545, 200 ], /* minutes, last 8 weeks, current last */
    friends: [
      { id: 'f1', name: 'Camila Ríos', initials: 'CR', color: 'cielo', live: { minutes: 42, subject: 'Física II', preset: '50/10' } },
      { id: 'f2', name: 'Tomás Giménez', initials: 'TG', color: 'lima', live: { minutes: 12, subject: 'Álgebra', preset: '25/5' } },
      { id: 'f3', name: 'Lucía Méndez', initials: 'LM', color: 'uva', live: null, last: 'hace 2 h' },
      { id: 'f4', name: 'Nicolás Paz', initials: 'NP', color: 'ambar', live: null, last: 'ayer' }
    ],
    feed: [
      { friend: 'f3', when: 'hace 2 h', subject: 'Química', focus: 100, cycles: 4, tasks: 3 },
      { friend: 'f1', when: 'hace 5 h', subject: 'Física II', focus: 50, cycles: 1, tasks: 1 },
      { friend: 'f4', when: 'ayer', subject: 'Programación Orientada a Objetos', focus: 150, cycles: 3, tasks: 2 },
      { friend: 'f2', when: 'ayer', subject: 'Álgebra', focus: 75, cycles: 3, tasks: 0 }
    ]
  };
};
