require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const PIN = '12345678';
const PIN_HASH = sha256(PIN);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

// ─── name pools ─────────────────────────────────────────────────────────────
const PRENOMS_M = ['Ahmed','Mohamed','Youssef','Amine','Karim','Bilal','Hamza','Rayan','Ilyes','Nassim','Sofiane','Walid','Adel','Djamel','Farid','Khaled','Lotfi','Mehdi','Nabil','Omar','Rachid','Samir','Tarek','Zakaria','Anis','Bachir','Cherif','Fares','Ghiles','Houssem'];
const PRENOMS_F = ['Amira','Sara','Yasmine','Nour','Imane','Rania','Meriem','Sonia','Asma','Fatima','Houda','Ines','Karima','Lamia','Malika','Naima','Ouahiba','Rahma','Samira','Tinhinane','Widad','Zahia','Amel','Bouchra','Chaima','Djamila','Farida','Ghania','Hakima','Ismahane'];
const NOMS = ['Benali','Boudiaf','Chabane','Djamel','Ferhat','Ghomri','Hamidi','Ibrahimi','Khelifi','Larbi','Mansouri','Nouri','Ouali','Rahmani','Saadi','Taleb','Uld-Ali','Brahimi','Merabtine','Boukhari','Ziani','Meziane','Berber','Hadjadj','Kouider','Maamar','Nacer','Oudjit','Rezig','Smail','Toumi','Benmoussa','Gherbi','Lounès','Chikhi','Debbah','Attar','Lakehal','Boudali','Seghir'];
const VILLES = ['Alger','Oran','Constantine','Annaba','Blida','Batna','Sétif','Sidi Bel Abbès','Biskra','Tébessa'];
const QUALIFS = ['Licence en Mathématiques','Master en Sciences','Licence en Lettres','Master en Physique','Licence en Informatique','Master en Chimie','Licence en Histoire','Master en Anglais','Doctorat en Mathématiques','Master en Sciences de l\'Éducation'];

// ─── school data ────────────────────────────────────────────────────────────
const YEARS = [
  { name: '2022-2023', start: '2022-09-04', end: '2023-06-29', status: 'archived', passing: 10 },
  { name: '2023-2024', start: '2023-09-03', end: '2024-06-27', status: 'archived', passing: 10 },
  { name: '2024-2025', start: '2024-09-01', end: '2025-06-26', status: 'active',   passing: 10 },
];

const LEVELS = ['6ème','5ème','4ème','3ème','2nde','1ère','Terminale'];
const SECTIONS = ['A','B'];

const SUBJECTS_DATA = [
  { name: 'Mathématiques',       code: 'MATH', coefficient: 5, color: '#3B82F6', category: 'scientifique', weekly_hours: 5 },
  { name: 'Français',            code: 'FR',   coefficient: 4, color: '#10B981', category: 'litteraire',   weekly_hours: 4 },
  { name: 'Langue Arabe',        code: 'AR',   coefficient: 4, color: '#F59E0B', category: 'litteraire',   weekly_hours: 4 },
  { name: 'Anglais',             code: 'ANG',  coefficient: 3, color: '#8B5CF6', category: 'litteraire',   weekly_hours: 3 },
  { name: 'Sciences Naturelles', code: 'SVT',  coefficient: 3, color: '#22C55E', category: 'scientifique', weekly_hours: 3 },
  { name: 'Physique-Chimie',     code: 'PC',   coefficient: 4, color: '#06B6D4', category: 'scientifique', weekly_hours: 4 },
  { name: 'Histoire-Géographie', code: 'HG',   coefficient: 2, color: '#F97316', category: 'general',      weekly_hours: 2 },
  { name: 'Éducation Physique',  code: 'EPS',  coefficient: 2, color: '#EC4899', category: 'sport',        weekly_hours: 2, is_evaluable: true },
  { name: 'Informatique',        code: 'INFO', coefficient: 2, color: '#6366F1', category: 'scientifique', weekly_hours: 2 },
  { name: 'Philosophie',         code: 'PHILO',coefficient: 2, color: '#84CC16', category: 'litteraire',   weekly_hours: 2 },
  { name: 'Éducation Islamique', code: 'EI',   coefficient: 1, color: '#A78BFA', category: 'general',      weekly_hours: 1 },
  { name: 'Sciences Physiques',  code: 'SP',   coefficient: 3, color: '#14B8A6', category: 'scientifique', weekly_hours: 3 },
];

const ROOMS_DATA = [
  { name: 'Salle 101', code: 'S101', type: 'classroom', capacity: 32, building: 'Bâtiment A', floor: '1', equipment: ['tableau','projecteur'] },
  { name: 'Salle 102', code: 'S102', type: 'classroom', capacity: 32, building: 'Bâtiment A', floor: '1', equipment: ['tableau'] },
  { name: 'Salle 103', code: 'S103', type: 'classroom', capacity: 30, building: 'Bâtiment A', floor: '1', equipment: ['tableau','climatiseur'] },
  { name: 'Salle 201', code: 'S201', type: 'classroom', capacity: 32, building: 'Bâtiment A', floor: '2', equipment: ['tableau','projecteur'] },
  { name: 'Salle 202', code: 'S202', type: 'classroom', capacity: 30, building: 'Bâtiment A', floor: '2', equipment: ['tableau'] },
  { name: 'Salle 203', code: 'S203', type: 'classroom', capacity: 32, building: 'Bâtiment A', floor: '2', equipment: ['tableau','climatiseur'] },
  { name: 'Salle 301', code: 'S301', type: 'classroom', capacity: 30, building: 'Bâtiment B', floor: '3', equipment: ['tableau'] },
  { name: 'Salle 302', code: 'S302', type: 'classroom', capacity: 32, building: 'Bâtiment B', floor: '3', equipment: ['tableau','projecteur'] },
  { name: 'Labo Physique',  code: 'LABO-PC',  type: 'laboratory', capacity: 24, building: 'Bâtiment B', floor: '1', equipment: ['paillasses','hotte','projecteur'] },
  { name: 'Labo Informatique', code: 'LABO-INFO', type: 'computer_lab', capacity: 20, building: 'Bâtiment B', floor: '2', equipment: ['ordinateurs','projecteur','wifi'] },
  { name: 'Salle Polyvalente', code: 'POLY', type: 'hall', capacity: 120, building: 'Bâtiment C', floor: '0', equipment: ['scène','micro','projecteur'] },
  { name: 'Gymnase', code: 'GYM', type: 'gymnasium', capacity: 60, building: 'Annexe Sport', floor: '0', equipment: ['vestiaires','matériel sportif'] },
  { name: 'Bibliothèque', code: 'BIB', type: 'library', capacity: 40, building: 'Bâtiment C', floor: '1', equipment: ['étagères','wifi','imprimante'] },
  { name: 'Salle des Profs', code: 'SP', type: 'staff_room', capacity: 20, building: 'Bâtiment A', floor: '0', equipment: ['tables','imprimante','wifi'] },
];

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Dimanche'];
const TIME_SLOTS = [
  { start: '08:00', end: '09:30' },
  { start: '09:45', end: '11:15' },
  { start: '11:30', end: '13:00' },
  { start: '14:00', end: '15:30' },
  { start: '15:45', end: '17:15' },
];

// ─── name generators ─────────────────────────────────────────────────────────
let _nameCounter = 0;
function studentName(gender) {
  const prenoms = gender === 'M' ? PRENOMS_M : PRENOMS_F;
  return { first_name: prenoms[_nameCounter % prenoms.length], last_name: NOMS[(_nameCounter + 7) % NOMS.length] };
}

let _teacherIdx = 0;
function nextTeacherName() {
  const gender = _teacherIdx % 3 === 0 ? 'F' : 'M';
  const prenoms = gender === 'M' ? PRENOMS_M : PRENOMS_F;
  const n = { first_name: prenoms[_teacherIdx % prenoms.length], last_name: NOMS[(_teacherIdx + 3) % NOMS.length] };
  _teacherIdx++;
  return n;
}

function email(first, last, domain = 'ecole-excellence.dz') {
  const fn = first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const ln = last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  return `${fn}.${ln}@${domain}`;
}

function randomDate(start, end) {
  const s = new Date(start), e = new Date(end);
  return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().split('T')[0];
}

function studentCode(yr, n) {
  return `EL-${yr}-${String(n).padStart(4,'0')}`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗑️  Nettoyage de la base de données...\n');

  // Delete in reverse-dependency order
  await prisma.sprint.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.socialPost.deleteMany();
  await prisma.socialBadge.deleteMany();
  await prisma.socialGroup.deleteMany();
  await prisma.litigation.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.sanction.deleteMany();
  await prisma.event.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.message.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.scheduleEvent.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.studentGuardian.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.room.deleteMany();
  await prisma.period.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.appUser.deleteMany();

  console.log('✅ Base vidée\n');

  // ── ADMIN ACCOUNTS ──────────────────────────────────────────────────────
  console.log('👤 Création des comptes admin...');
  const ADMIN_ACCOUNTS = [
    { login: 'admin',        full_name: 'Administrateur Système',  role: 'admin_systeme' },
    { login: 'directeur',    full_name: 'Meziane Abdelkader',       role: 'directeur_general' },
    { login: 'dir.college',  full_name: 'Benali Mourad',            role: 'directeur_college' },
    { login: 'dir.lycee',    full_name: 'Khelifi Nadia',            role: 'directeur_lycee' },
    { login: 'cpe',          full_name: 'Rahmani Souad',            role: 'cpe' },
    { login: 'secretaire',   full_name: 'Boudali Samia',            role: 'secretaire' },
    { login: 'comptable',    full_name: 'Smail Rachid',             role: 'comptable' },
  ];
  for (const a of ADMIN_ACCOUNTS) {
    // must_change_pin: true — force le changement du PIN provisoire à la 1re connexion
    await prisma.appUser.create({ data: { login: a.login, pin_hash: PIN_HASH, full_name: a.full_name, role: a.role, member_type: 'none', status: 'active', must_change_pin: true } });
  }
  console.log(`  ✅ ${ADMIN_ACCOUNTS.length} comptes admin\n`);

  // ── SCHOOL YEARS ────────────────────────────────────────────────────────
  console.log('📅 Années scolaires...');
  const schoolYears = [];
  for (const y of YEARS) {
    const sy = await prisma.schoolYear.create({ data: { name: y.name, start_date: y.start, end_date: y.end, status: y.status, passing_grade: y.passing, archived_date: y.status === 'archived' ? new Date(y.end) : null } });
    schoolYears.push({ ...sy, ...y });
  }
  console.log(`  ✅ ${schoolYears.length} années scolaires\n`);

  // ── PERIODS ─────────────────────────────────────────────────────────────
  console.log('📆 Périodes (trimestres)...');
  const allPeriods = {};
  for (const sy of schoolYears) {
    const yr = parseInt(sy.name.split('-')[0]);
    const periods = [
      { name: '1er Trimestre', order: 1, start_date: `${yr}-09-01`, end_date: `${yr}-11-30`, status: sy.status === 'active' ? 'closed' : 'closed' },
      { name: '2ème Trimestre', order: 2, start_date: `${yr}-12-01`, end_date: `${yr+1}-02-28`, status: sy.status === 'active' ? 'closed' : 'closed' },
      { name: '3ème Trimestre', order: 3, start_date: `${yr+1}-03-01`, end_date: `${yr+1}-06-30`, status: sy.status === 'active' ? 'open' : 'closed' },
    ];
    allPeriods[sy.name] = [];
    for (const p of periods) {
      const per = await prisma.period.create({ data: { school_year_id: sy.id, name: p.name, type: 'trimestre', order: p.order, start_date: p.start_date, end_date: p.end_date, status: p.status } });
      allPeriods[sy.name].push(per);
    }
  }
  console.log(`  ✅ ${schoolYears.length * 3} périodes\n`);

  // ── ROOMS ───────────────────────────────────────────────────────────────
  console.log('🏛️  Salles...');
  const rooms = [];
  for (const r of ROOMS_DATA) {
    const room = await prisma.room.create({ data: { name: r.name, code: r.code, type: r.type, capacity: r.capacity, building: r.building, floor: r.floor, equipment: JSON.stringify(r.equipment), status: 'active', description: `${r.type === 'classroom' ? 'Salle de cours standard' : r.type === 'laboratory' ? 'Laboratoire équipé' : r.type === 'computer_lab' ? 'Salle informatique' : r.type === 'gymnasium' ? 'Gymnase couvert' : 'Salle ' + r.name}` } });
    rooms.push(room);
  }
  const classrooms = rooms.filter(r => r.type === 'classroom');
  console.log(`  ✅ ${rooms.length} salles\n`);

  // ── SUBJECTS ────────────────────────────────────────────────────────────
  console.log('📚 Matières...');
  const subjects = [];
  for (const s of SUBJECTS_DATA) {
    const sub = await prisma.subject.create({ data: { name: s.name, code: s.code, coefficient: s.coefficient, color: s.color, category: s.category, weekly_hours: s.weekly_hours, is_evaluable: s.is_evaluable !== false, status: 'active', description: `Cours de ${s.name}` } });
    subjects.push(sub);
  }
  console.log(`  ✅ ${subjects.length} matières\n`);

  // ── STAFF ───────────────────────────────────────────────────────────────
  console.log('👔 Personnel administratif...');
  const staffData = [
    { first_name: 'Souad',   last_name: 'Rahmani',  role: 'CPE',           phone: '0550123456', hire_date: '2018-09-01', contract_type: 'CDI', salary: 65000 },
    { first_name: 'Samia',   last_name: 'Boudali',  role: 'Secrétaire',    phone: '0661234567', hire_date: '2019-01-15', contract_type: 'CDI', salary: 55000 },
    { first_name: 'Rachid',  last_name: 'Smail',    role: 'Comptable',     phone: '0770234567', hire_date: '2017-09-01', contract_type: 'CDI', salary: 70000 },
    { first_name: 'Nadia',   last_name: 'Ouali',    role: 'Intendant',     phone: '0550345678', hire_date: '2020-03-01', contract_type: 'CDD', salary: 50000 },
    { first_name: 'Kamel',   last_name: 'Ferhat',   role: 'Surveillant',   phone: '0661345678', hire_date: '2021-09-01', contract_type: 'CDD', salary: 42000 },
    { first_name: 'Houda',   last_name: 'Ziani',    role: 'Documentaliste',phone: '0770345678', hire_date: '2019-09-01', contract_type: 'CDI', salary: 52000 },
  ];
  const staffMembers = [];
  for (const s of staffData) {
    const st = await prisma.staff.create({ data: { ...s, status: 'active', address: `${rand(1,50)} Rue des Eucalyptus, ${pick(VILLES)}`, employee_code: `ST-${rand(100,999)}` } });
    staffMembers.push(st);
    const login = email(s.first_name, s.last_name, 'ecole-excellence.dz');
    await prisma.appUser.create({ data: { login, pin_hash: PIN_HASH, full_name: `${s.first_name} ${s.last_name}`, role: s.role === 'CPE' ? 'cpe' : s.role === 'Comptable' ? 'comptable' : 'secretaire', member_type: 'Staff', member_id: st.id, status: 'active', must_change_pin: false, email: login } });
  }
  console.log(`  ✅ ${staffMembers.length} membres du personnel\n`);

  // ── TEACHERS ────────────────────────────────────────────────────────────
  console.log('👩‍🏫 Enseignants...');
  // Assign subjects: each teacher specialises in 1-2 subjects
  const teacherSubjectAssignments = [
    [0, 11],   // Maths + Sciences Physiques
    [0],       // Maths
    [1],       // Français
    [1, 9],    // Français + Philo
    [2],       // Arabe
    [2, 10],   // Arabe + Éd. Islamique
    [3],       // Anglais
    [4, 5],    // SVT + PC
    [5],       // Physique-Chimie
    [6],       // Histoire-Géo
    [7],       // EPS
    [8],       // Informatique
    [9, 1],    // Philo + Français
    [4],       // SVT
    [0, 8],    // Maths + Info
  ];
  const teachers = [];
  for (let i = 0; i < teacherSubjectAssignments.length; i++) {
    const sIds = teacherSubjectAssignments[i].map(idx => subjects[idx].id);
    const n = nextTeacherName();
    const gender = i % 3 === 0 ? 'F' : 'M';
    const hireYear = rand(2015, 2021);
    const t = await prisma.teacher.create({ data: {
      first_name: n.first_name, last_name: n.last_name,
      email: email(n.first_name, n.last_name),
      phone: `0${pick(['5','6','7'])}${rand(10000000,99999999)}`,
      subject_ids: JSON.stringify(sIds),
      hire_date: `${hireYear}-09-01`,
      status: 'active',
      address: `${rand(1,100)} Cité des Enseignants, ${pick(VILLES)}`,
      qualification: pick(QUALIFS),
      employee_code: `ENS-${String(i+1).padStart(3,'0')}`,
      contract_type: pick(['CDI','CDI','CDI','CDD']),
      salary: randF(70000, 120000, 0),
    }});
    teachers.push({ ...t, subjectIndices: teacherSubjectAssignments[i] });
    await prisma.appUser.create({ data: { login: email(n.first_name, n.last_name), pin_hash: PIN_HASH, full_name: `${n.first_name} ${n.last_name}`, role: 'enseignant', member_type: 'Teacher', member_id: t.id, status: 'active', must_change_pin: false, email: email(n.first_name, n.last_name) } });
  }
  console.log(`  ✅ ${teachers.length} enseignants\n`);

  // ── CLASSES + STUDENTS ──────────────────────────────────────────────────
  console.log('🏫 Classes et élèves...');

  // Map: level → main_teacher index (pick by subject match)
  const levelMainTeacher = { '6ème': 4, '5ème': 0, '4ème': 8, '3ème': 5, '2nde': 1, '1ère': 3, 'Terminale': 12 };

  const allClasses = {}; // schoolYear.name → array of class records
  const allStudents = {}; // schoolYear.name → array of {student, class_id}
  let globalStudentNum = 1;

  for (const sy of schoolYears) {
    allClasses[sy.name] = [];
    allStudents[sy.name] = [];
    let roomIdx = 0;

    for (const level of LEVELS) {
      for (const section of SECTIONS) {
        const cls = await prisma.class.create({ data: {
          name: `${level} ${section}`,
          level,
          school_year: sy.name,
          main_teacher_id: teachers[levelMainTeacher[level]]?.id || teachers[0].id,
          room: classrooms[roomIdx % classrooms.length].name,
          capacity: 30,
        }});
        allClasses[sy.name].push(cls);
        roomIdx++;

        // 20–29 students per class
        const count = rand(20, 29);
        for (let s = 0; s < count; s++) {
          const gender = s % 2 === 0 ? 'M' : 'F';
          const prenoms = gender === 'M' ? PRENOMS_M : PRENOMS_F;
          const first_name = prenoms[(globalStudentNum + s) % prenoms.length];
          const last_name = NOMS[(globalStudentNum + s * 3) % NOMS.length];
          const dob_year = parseInt(level.replace(/[^0-9]/g,'') || '2') + 2007 - parseInt(sy.name.split('-')[0]) + 2022;
          const student = await prisma.student.create({ data: {
            first_name, last_name,
            student_code: studentCode(sy.name.split('-')[0], globalStudentNum),
            date_of_birth: `${rand(2005,2012)}-${String(rand(1,12)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`,
            gender,
            class_id: cls.id,
            enrollment_date: sy.start_date,
            status: 'active',
            address: `${rand(1,200)} Rue ${pick(['de la Paix','des Frères','du 1er Novembre','de l\'Indépendance'])}, ${pick(VILLES)}`,
            medical_notes: s % 15 === 0 ? 'Allergie aux arachides' : s % 20 === 0 ? 'Asthme léger' : null,
          }});

          // Parent
          const p_first = gender === 'M' ? pick(PRENOMS_M) : pick(PRENOMS_F);
          const p_last = last_name;
          const p_email = email(p_first, p_last, 'gmail.com');
          let parent;
          const existingParent = await prisma.parent.findUnique({ where: { email: p_email } });
          if (existingParent) {
            parent = existingParent;
          } else {
            parent = await prisma.parent.create({ data: {
              first_name: p_first, last_name: p_last,
              email: p_email,
              phone: `0${pick(['5','6','7'])}${rand(10000000,99999999)}`,
              address: student.address,
              relation: pick(['père','mère','tuteur']),
            }});
            // AppUser for parent
            const existingPU = await prisma.appUser.findFirst({ where: { login: p_email } });
            if (!existingPU) {
              await prisma.appUser.create({ data: { login: p_email, pin_hash: PIN_HASH, full_name: `${p_first} ${p_last}`, role: 'parent', member_type: 'Parent', member_id: parent.id, status: 'active', must_change_pin: false, email: p_email } });
            }
          }
          await prisma.studentGuardian.create({ data: { student_id: student.id, parent_id: parent.id, relation: pick(['père','mère','tuteur']), is_primary: true } });

          // AppUser for student
          await prisma.appUser.create({ data: { login: student.student_code, pin_hash: PIN_HASH, full_name: `${first_name} ${last_name}`, role: 'eleve', member_type: 'Student', member_id: student.id, status: 'active', must_change_pin: false } });

          allStudents[sy.name].push({ student, class_id: cls.id });
          globalStudentNum++;
        }
      }
    }
    console.log(`  📘 ${sy.name}: ${allClasses[sy.name].length} classes, ${allStudents[sy.name].length} élèves`);
  }
  console.log();

  // ── SCHEDULES ───────────────────────────────────────────────────────────
  console.log('📋 Emplois du temps...');
  // Build teacher→subjects map
  const teacherSubjectMap = {}; // teacher.id → [subject.id]
  for (const t of teachers) {
    teacherSubjectMap[t.id] = t.subjectIndices.map(i => subjects[i].id);
  }

  // For each class in the current year, create a weekly schedule
  const currentYear = schoolYears.find(sy => sy.status === 'active');
  let scheduleCount = 0;
  for (const cls of allClasses[currentYear.name]) {
    // Assign 8 slots per week
    const usedSlots = new Set(); // "day|slot"
    const usedTeacherSlots = new Set(); // "teacher|day|slot"
    const subjectQueue = shuffle(subjects.slice(0, 9)); // use first 9 subjects

    for (let si = 0; si < Math.min(8, subjectQueue.length); si++) {
      const subject = subjectQueue[si];
      // Find a teacher who teaches this subject
      const eligibleTeachers = teachers.filter(t => teacherSubjectMap[t.id]?.includes(subject.id));
      const teacher = eligibleTeachers.length > 0 ? pick(eligibleTeachers) : teachers[0];
      const room = pick(classrooms);

      // Find available slot
      let placed = false;
      const shuffledDays = shuffle(DAYS);
      for (const day of shuffledDays) {
        for (const slot of TIME_SLOTS) {
          const key = `${day}|${si}`;
          const tKey = `${teacher.id}|${day}|${slot.start}`;
          if (!usedSlots.has(key) && !usedTeacherSlots.has(tKey)) {
            await prisma.schedule.create({ data: {
              class_id: cls.id,
              subject_id: subject.id,
              teacher_id: teacher.id,
              room_id: room.id,
              day_of_week: day,
              start_time: slot.start,
              end_time: slot.end,
              status: 'publie',
              school_year: currentYear.name,
            }});
            usedSlots.add(key);
            usedTeacherSlots.add(tKey);
            scheduleCount++;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }
  }
  console.log(`  ✅ ${scheduleCount} créneaux (${currentYear.name})\n`);

  // ── EXAMS + GRADES ──────────────────────────────────────────────────────
  console.log('📝 Examens et notes...');
  let examCount = 0, gradeCount = 0;

  for (const sy of schoolYears) {
    const periods = allPeriods[sy.name];
    const classes = allClasses[sy.name];

    for (const cls of classes) {
      const classStudents = allStudents[sy.name].filter(s => s.class_id === cls.id);
      const mainSubjects = subjects.slice(0, 8); // main evaluable subjects

      for (const period of periods) {
        for (const subject of mainSubjects) {
          // 2 exams per subject per period: devoir + composition
          const examTypes = [
            { title: `Devoir 1 - ${subject.name}`, type: 'devoir', coefficient: 1, max_score: 20 },
            { title: `Composition - ${subject.name}`, type: 'composition', coefficient: 2, max_score: 20 },
          ];

          // Find teacher for this subject
          const eligibleTeachers = teachers.filter(t => teacherSubjectMap[t.id]?.includes(subject.id));
          const teacher = eligibleTeachers.length > 0 ? eligibleTeachers[0] : teachers[0];

          for (const et of examTypes) {
            const examDate = randomDate(period.start_date, period.end_date);
            const exam = await prisma.exam.create({ data: {
              title: et.title,
              class_id: cls.id,
              subject_id: subject.id,
              teacher_id: teacher.id,
              date: examDate,
              type: et.type,
              coefficient: et.coefficient,
              max_score: et.max_score,
              trimester: period.name,
              period_id: period.id,
              description: `${et.type === 'devoir' ? 'Évaluation formative' : 'Évaluation sommative'} - ${subject.name}`,
            }});
            examCount++;

            // Grades for each student
            for (const { student } of classStudents) {
              const absent = Math.random() < 0.03; // 3% absence rate
              const score = absent ? null : randF(1, 20);
              await prisma.grade.create({ data: {
                student_id: student.id,
                exam_id: exam.id,
                score: absent ? null : Math.min(20, Math.max(1, score)),
                absent,
                comment: absent ? 'Absent lors de l\'évaluation' : score >= 16 ? 'Excellent travail' : score >= 12 ? 'Bon travail' : score >= 8 ? 'Peut mieux faire' : 'Insuffisant — nécessite un soutien',
              }});
              gradeCount++;
            }
          }
        }
      }
    }
    console.log(`  📊 ${sy.name}: ${examCount} examens, ${gradeCount} notes`);
  }
  console.log();

  // ── ATTENDANCE ──────────────────────────────────────────────────────────
  console.log('📅 Présences (année courante)...');
  let attCount = 0;
  // Generate attendance for past 60 school days in current year
  const today = new Date();
  const schoolDays = [];
  for (let d = 0; d < 120; d++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d);
    const dow = dt.getDay();
    if (dow !== 5 && dow !== 6) { // skip Friday and Saturday (Algerian weekend)
      const ds = dt.toISOString().split('T')[0];
      if (ds >= currentYear.start_date) schoolDays.push(ds);
    }
    if (schoolDays.length >= 60) break;
  }

  for (const { student, class_id } of allStudents[currentYear.name]) {
    for (const date of schoolDays.slice(0, 20)) { // last 20 days per student
      const status = Math.random() < 0.92 ? 'present' : Math.random() < 0.5 ? 'absent' : 'retard';
      if (status !== 'present' || Math.random() < 0.3) { // only record non-present + some present
        await prisma.attendance.create({ data: { student_id: student.id, class_id, date, status, comment: status === 'retard' ? 'Retard non justifié' : status === 'absent' ? pick(['Maladie','Raison familiale','Non justifié']) : null } });
        attCount++;
      }
    }
  }
  console.log(`  ✅ ${attCount} enregistrements de présence\n`);

  // ── HOMEWORK ─────────────────────────────────────────────────────────────
  console.log('📖 Devoirs...');
  let hwCount = 0;
  for (const cls of allClasses[currentYear.name]) {
    for (const subject of subjects.slice(0, 7)) {
      const eligibleTeachers = teachers.filter(t => teacherSubjectMap[t.id]?.includes(subject.id));
      const teacher = eligibleTeachers.length > 0 ? eligibleTeachers[0] : teachers[0];
      for (let w = 1; w <= 8; w++) {
        const dueDate = new Date(currentYear.start_date);
        dueDate.setDate(dueDate.getDate() + w * 7 + rand(0, 4));
        await prisma.homework.create({ data: {
          title: `Devoir ${w} — ${subject.name}`,
          class_id: cls.id,
          subject_id: subject.id,
          teacher_id: teacher.id,
          due_date: dueDate.toISOString().split('T')[0],
          description: pick([
            `Exercices pages ${rand(10,50)}-${rand(51,80)} du manuel`,
            `Rédiger une synthèse de ${rand(1,3)} pages sur le chapitre ${w}`,
            `Résoudre les problèmes ${rand(1,5)} à ${rand(6,10)} de la fiche distribuée`,
            `Réviser le cours et préparer une fiche de révision`,
            `Compléter les exercices de l'annexe ${w}`,
          ]),
          status: dueDate < today ? 'closed' : 'active',
        }});
        hwCount++;
      }
    }
  }
  console.log(`  ✅ ${hwCount} devoirs\n`);

  // ── PAYMENTS ─────────────────────────────────────────────────────────────
  console.log('💰 Paiements...');
  let payCount = 0;
  const PAYMENT_TYPES = [
    { label: 'Frais de scolarité T1', amount: 15000, category: 'scolarite' },
    { label: 'Frais de scolarité T2', amount: 15000, category: 'scolarite' },
    { label: 'Frais de scolarité T3', amount: 15000, category: 'scolarite' },
    { label: 'Frais d\'inscription',  amount: 5000,  category: 'inscription' },
    { label: 'Cantine scolaire',      amount: 8000,  category: 'cantine' },
    { label: 'Transport scolaire',    amount: 6000,  category: 'transport' },
    { label: 'Activités parascolaires', amount: 3000, category: 'activite' },
  ];
  for (const sy of schoolYears) {
    for (const { student } of allStudents[sy.name]) {
      for (const pt of PAYMENT_TYPES.slice(0, rand(3, 6))) {
        const paid_ratio = sy.status === 'archived' ? 1 : Math.random() < 0.7 ? 1 : Math.random() < 0.5 ? 0.5 : 0;
        const amount_paid = parseFloat((pt.amount * paid_ratio).toFixed(0));
        const status = amount_paid >= pt.amount ? 'paid' : amount_paid > 0 ? 'partial' : 'pending';
        await prisma.payment.create({ data: {
          student_id: student.id,
          label: pt.label,
          amount: pt.amount,
          amount_paid,
          due_date: randomDate(sy.start_date, sy.end_date),
          category: pt.category,
          status,
          payment_method: paid_ratio > 0 ? pick(['espèces','virement','chèque']) : null,
          school_year: sy.name,
          notes: status === 'partial' ? 'Paiement partiel en attente de solde' : null,
        }});
        payCount++;
      }
    }
  }
  console.log(`  ✅ ${payCount} paiements\n`);

  // ── EVENTS ───────────────────────────────────────────────────────────────
  console.log('🎉 Événements scolaires...');
  const eventsData = [
    { title: 'Rentrée Scolaire', type: 'ceremonie', target: 'tous', offset: 0 },
    { title: 'Journée Portes Ouvertes', type: 'portes_ouvertes', target: 'parents', offset: 30 },
    { title: 'Sortie Pédagogique 6ème', type: 'sortie', target: 'classe', offset: 45 },
    { title: 'Conseil de Classe T1', type: 'conseil', target: 'enseignants', offset: 90 },
    { title: 'Fête des Mères', type: 'fete', target: 'tous', offset: 110 },
    { title: 'Compétition Sportive Inter-classes', type: 'sport', target: 'eleves', offset: 130 },
    { title: 'Remise des Bulletins T1', type: 'ceremonie', target: 'parents', offset: 95 },
    { title: 'Conseil de Classe T2', type: 'conseil', target: 'enseignants', offset: 180 },
    { title: 'Journée Culturelle', type: 'culturel', target: 'tous', offset: 200 },
    { title: 'Examens Blancs', type: 'examen', target: 'eleves', offset: 210 },
    { title: 'Sortie Musée National', type: 'sortie', target: 'eleves', offset: 220 },
    { title: 'Remise Diplômes 3ème', type: 'ceremonie', target: 'tous', offset: 270 },
    { title: 'Clôture de l\'Année Scolaire', type: 'ceremonie', target: 'tous', offset: 280 },
  ];
  let evtCount = 0;
  for (const sy of schoolYears) {
    const startDate = new Date(sy.start_date);
    for (const ev of eventsData) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + ev.offset);
      await prisma.event.create({ data: {
        title: ev.title,
        description: `Événement scolaire : ${ev.title}`,
        date: d.toISOString().split('T')[0],
        start_time: pick(['08:00','09:00','10:00','14:00']),
        end_time: pick(['11:00','12:00','16:00','17:00']),
        location: pick(['Salle Polyvalente','Cour de l\'école','Gymnase','Salle 101','Bibliothèque']),
        type: ev.type,
        target: ev.target,
      }});
      evtCount++;
    }
  }
  console.log(`  ✅ ${evtCount} événements\n`);

  // ── SANCTIONS ────────────────────────────────────────────────────────────
  console.log('⚠️  Sanctions...');
  let sanctCount = 0;
  const SANCTION_TYPES = ['avertissement','exclusion_cours','convocation_parents','retenue','exclusion_temporaire'];
  const SANCTION_REASONS = ['Perturbation du cours','Retards répétés','Insubordination','Oubli de matériel répété','Comportement irrespectueux','Usage du téléphone','Triche lors d\'un examen'];
  for (const sy of schoolYears) {
    const targetStudents = allStudents[sy.name].slice(0, Math.floor(allStudents[sy.name].length * 0.12));
    for (const { student, class_id } of targetStudents) {
      const numSanctions = rand(1, 3);
      for (let i = 0; i < numSanctions; i++) {
        await prisma.sanction.create({ data: {
          student_id: student.id, class_id,
          type: pick(SANCTION_TYPES),
          reason: pick(SANCTION_REASONS),
          date: randomDate(sy.start_date, sy.end_date),
          duration: pick(['1 jour','2 jours','1 semaine',null,null]),
          status: sy.status === 'archived' ? 'resolved' : pick(['active','resolved']),
          resolved_at: sy.status === 'archived' ? randomDate(sy.start_date, sy.end_date) : null,
        }});
        sanctCount++;
      }
    }
  }
  console.log(`  ✅ ${sanctCount} sanctions\n`);

  // ── MESSAGES ─────────────────────────────────────────────────────────────
  console.log('💬 Messages...');
  let msgCount = 0;
  const msgTemplates = [
    { subject: 'Absence de votre enfant', content: 'Bonjour, votre enfant a été absent le {date}. Merci de fournir un justificatif.', sender: 'secretaire', recipient: 'parent', priority: 'normal' },
    { subject: 'Résultats du conseil de classe', content: 'Les résultats du conseil de classe du trimestre sont disponibles. Merci de venir récupérer le bulletin.', sender: 'directeur', recipient: 'parent', priority: 'normal' },
    { subject: 'Convocation — Réunion parents-enseignants', content: 'Vous êtes convoqué(e) à une réunion le vendredi prochain à 16h00 en salle polyvalente.', sender: 'cpe', recipient: 'parent', priority: 'high' },
    { subject: 'Retard injustifié', content: 'Votre enfant a accumulé plusieurs retards non justifiés ce mois-ci.', sender: 'cpe', recipient: 'parent', priority: 'high' },
    { subject: 'Félicitations — Excellent trimestre', content: 'Félicitations ! Votre enfant a obtenu d\'excellents résultats ce trimestre.', sender: 'directeur', recipient: 'parent', priority: 'normal' },
  ];
  const parentUsers = await prisma.appUser.findMany({ where: { role: 'parent' }, take: 30 });
  for (const tmpl of msgTemplates) {
    for (let i = 0; i < 8; i++) {
      const recipient = parentUsers[i % parentUsers.length];
      if (!recipient) continue;
      await prisma.message.create({ data: {
        sender_type: tmpl.sender, sender_name: pick(['Direction','Secrétariat','CPE']),
        recipient_type: 'parent', recipient_id: recipient.id,
        subject: tmpl.subject,
        content: tmpl.content.replace('{date}', randomDate(currentYear.start_date, new Date().toISOString().split('T')[0])),
        priority: tmpl.priority, read: Math.random() < 0.6,
      }});
      msgCount++;
    }
  }
  console.log(`  ✅ ${msgCount} messages\n`);

  // ── RESOURCES ────────────────────────────────────────────────────────────
  console.log('📂 Ressources pédagogiques...');
  let resCount = 0;
  const resTypes = ['cours','exercices','correction','fiche_revision','video','examen_blanc'];
  for (const subject of subjects.slice(0, 8)) {
    for (const level of ['6ème','5ème','4ème','3ème','2nde','1ère','Terminale']) {
      for (let i = 0; i < rand(2, 4); i++) {
        const type = pick(resTypes);
        await prisma.resource.create({ data: {
          title: `${type === 'cours' ? 'Cours' : type === 'exercices' ? 'Exercices' : type === 'correction' ? 'Corrigé' : type === 'fiche_revision' ? 'Fiche de révision' : type === 'video' ? 'Vidéo pédagogique' : 'Examen blanc'} — ${subject.name} — ${level}`,
          description: `Ressource pédagogique de ${subject.name} pour le niveau ${level}`,
          subject_id: subject.id, type, level,
          file_url: `https://ressources.ecole-excellence.dz/${subject.code?.toLowerCase()}/${level.replace('ème','e').replace('nde','nde')}/${type}_${i+1}.pdf`,
        }});
        resCount++;
      }
    }
  }
  console.log(`  ✅ ${resCount} ressources\n`);

  // ── PROMOTIONS ───────────────────────────────────────────────────────────
  console.log('🎓 Promotions...');
  let promoCount = 0;
  // Year 1 → Year 2 promotions
  for (let yi = 0; yi < 2; yi++) {
    const fromYear = schoolYears[yi];
    const toYear = schoolYears[yi + 1];
    const fromClasses = allClasses[fromYear.name];
    for (const cls of fromClasses) {
      const students = allStudents[fromYear.name].filter(s => s.class_id === cls.id);
      // Find matching class in next year (same level/section)
      const nextCls = allClasses[toYear.name].find(c => c.name === cls.name);
      for (const { student } of students) {
        const promoted = Math.random() < 0.88;
        await prisma.promotion.create({ data: {
          student_id: student.id,
          from_class: cls.id, to_class: nextCls?.id || null,
          school_year: fromYear.name,
          status: promoted ? 'promoted' : 'redoublant',
        }});
        promoCount++;
      }
    }
  }
  console.log(`  ✅ ${promoCount} promotions\n`);

  // ── LITIGATIONS ──────────────────────────────────────────────────────────
  console.log('⚖️  Litiges...');
  let litCount = 0;
  const litTitles = ['Non-paiement des frais de scolarité','Contestation de note','Comportement d\'un élève','Dégradation de matériel','Dispute entre élèves','Plainte d\'un parent','Incident en classe'];
  const allStudentsList = allStudents[currentYear.name];
  for (let i = 0; i < 15; i++) {
    const { student } = allStudentsList[rand(0, allStudentsList.length - 1)];
    await prisma.litigation.create({ data: {
      student_id: student.id,
      title: pick(litTitles),
      description: 'Dossier ouvert suite à signalement. En cours de traitement par l\'administration.',
      status: pick(['open','open','in_progress','resolved']),
      priority: pick(['low','normal','high']),
      resolved_at: Math.random() < 0.4 ? randomDate(currentYear.start_date, new Date().toISOString().split('T')[0]) : null,
    }});
    litCount++;
  }
  console.log(`  ✅ ${litCount} litiges\n`);

  // ── SOCIAL GROUPS ────────────────────────────────────────────────────────
  console.log('👥 Groupes sociaux...');
  const groupsData = [
    'Espace Enseignants', 'Club Sciences', 'Club Lecture', 'Sport & Bien-être',
    'Parents d\'élèves', 'Annonces Générales', 'Projets Pédagogiques', 'Club Informatique',
  ];
  const socialGroups = [];
  for (const name of groupsData) {
    const g = await prisma.socialGroup.create({ data: { name, status: 'active' } });
    socialGroups.push(g);
  }
  // Posts
  const postContents = [
    'Rappel : réunion pédagogique vendredi à 14h en salle des profs.',
    'Les résultats du concours de mathématiques sont disponibles sur le tableau d\'affichage.',
    'Félicitations à notre équipe de football qui a remporté le tournoi inter-établissements !',
    'La bibliothèque sera fermée ce jeudi pour inventaire.',
    'Nouveau livre disponible : « Mathématiques pour la Terminale » — à emprunter dès maintenant.',
    'Rappel : les bulletins du 2ème trimestre seront remis aux parents le 15 du mois.',
    'Atelier théâtre tous les mardis de 16h à 18h — inscriptions ouvertes.',
    'Concours de dictée inter-classes : inscriptions jusqu\'au vendredi.',
    'Le club informatique organise un hackathon éducatif le mois prochain.',
    'Journée sportive prévue le 20 — prévoir une tenue adaptée.',
  ];
  let postCount = 0;
  const teacherUsers = await prisma.appUser.findMany({ where: { role: 'enseignant' }, take: 10 });
  for (const group of socialGroups) {
    for (let i = 0; i < rand(3, 6); i++) {
      const author = pick(teacherUsers);
      await prisma.socialPost.create({ data: {
        group_id: group.id,
        content: pick(postContents),
        author_id: author?.id,
        author_name: author?.full_name || 'Enseignant',
        reactions: JSON.stringify({ '👍': rand(0, 12), '❤️': rand(0, 5), '👏': rand(0, 8) }),
        is_pinned: Math.random() < 0.15,
        is_flagged: false,
      }});
      postCount++;
    }
  }
  console.log(`  ✅ ${socialGroups.length} groupes, ${postCount} publications\n`);

  // ── BADGES ───────────────────────────────────────────────────────────────
  const badgesData = [
    { name: 'Meilleur élève', description: 'Moyenne trimestrielle ≥ 16/20', icon: '🏆', condition: 'avg >= 16' },
    { name: 'Assidu', description: '0 absence sur le trimestre', icon: '✅', condition: 'absences == 0' },
    { name: 'Progrès remarquable', description: '+3 points de moyenne vs trimestre précédent', icon: '📈', condition: 'progress >= 3' },
    { name: 'Lecteur passionné', description: '5 livres empruntés ce mois', icon: '📚', condition: 'books >= 5' },
    { name: 'Sportif de l\'année', description: 'Participation à toutes les activités sportives', icon: '⚽', condition: 'sport_events >= 5' },
  ];
  for (const b of badgesData) await prisma.socialBadge.create({ data: b });
  console.log(`  ✅ ${badgesData.length} badges\n`);

  // ── PROJECTS / SPRINTS / TASKS ───────────────────────────────────────────
  console.log('🗂️  Projets...');
  const projectsData = [
    { name: 'Refonte du système de notation', description: 'Modernisation du bulletin scolaire numérique', kpi: 75, target: 100 },
    { name: 'Plan de communication parents', description: 'Amélioration de la communication école-famille', kpi: 60, target: 100 },
    { name: 'Audit des infrastructures', description: 'État des lieux et plan de rénovation', kpi: 40, target: 100 },
    { name: 'Programme soutien scolaire', description: 'Mise en place d\'ateliers de remédiation', kpi: 85, target: 100 },
  ];
  const taskStatuses = ['todo','in_progress','done'];
  const taskPriorities = ['low','normal','high'];
  let taskCount = 0;
  for (const pd of projectsData) {
    const project = await prisma.project.create({ data: { name: pd.name, description: pd.description, current_kpi: pd.kpi, target_kpi: pd.target, status: 'active' } });
    // Sprint
    const sprint = await prisma.sprint.create({ data: { name: `Sprint 1 — ${pd.name}`, project_id: project.id, start_date: currentYear.start_date, end_date: new Date().toISOString().split('T')[0], status: 'active', goal: pd.description } });
    // Tasks
    const taskNames = [`Analyse des besoins`, `Rédaction du cahier des charges`, `Phase de développement`, `Tests et validation`, `Déploiement et formation`, `Suivi post-déploiement`];
    const assignees = [...ADMIN_ACCOUNTS];
    for (const tn of taskNames) {
      const assignee = await prisma.appUser.findFirst({ where: { login: pick(assignees).login } });
      await prisma.task.create({ data: { title: `${tn} — ${pd.name}`, description: `Tâche dans le cadre du projet : ${pd.description}`, status: pick(taskStatuses), priority: pick(taskPriorities), assignee_id: assignee?.id, project_id: project.id, due_date: randomDate(currentYear.start_date, currentYear.end_date) } });
      taskCount++;
    }
  }
  console.log(`  ✅ ${projectsData.length} projets, ${taskCount} tâches\n`);

  // ── SCHEDULE EVENTS ─────────────────────────────────────────────────────
  console.log('📌 Événements emploi du temps...');
  let seCount = 0;
  const schedules = await prisma.schedule.findMany({ take: 20 });
  for (const sched of schedules.slice(0, 15)) {
    const eventType = pick(['absence_enseignant','cours_annule','rattrapage','deplacement']);
    await prisma.scheduleEvent.create({ data: {
      schedule_id: sched.id,
      class_id: sched.class_id,
      subject_id: sched.subject_id,
      teacher_id: sched.teacher_id,
      event_date: randomDate(currentYear.start_date, new Date().toISOString().split('T')[0]),
      start_time: sched.start_time,
      end_time: sched.end_time,
      event_type: eventType,
      status: 'active',
      description: eventType === 'absence_enseignant' ? 'Enseignant absent — cours non assuré' : eventType === 'cours_annule' ? 'Cours annulé — activité pédagogique' : eventType === 'rattrapage' ? 'Séance de rattrapage programmée' : 'Cours déplacé en salle voisine',
      declared_by: 'secretaire',
      title: eventType === 'absence_enseignant' ? 'Absence enseignant' : eventType === 'cours_annule' ? 'Cours annulé' : eventType === 'rattrapage' ? 'Rattrapage' : 'Cours déplacé',
    }});
    seCount++;
  }
  console.log(`  ✅ ${seCount} événements EDT\n`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  const counts = {
    appUsers: await prisma.appUser.count(),
    students: await prisma.student.count(),
    parents: await prisma.parent.count(),
    teachers: await prisma.teacher.count(),
    staff: await prisma.staff.count(),
    classes: await prisma.class.count(),
    subjects: await prisma.subject.count(),
    rooms: await prisma.room.count(),
    exams: await prisma.exam.count(),
    grades: await prisma.grade.count(),
    schedules: await prisma.schedule.count(),
    payments: await prisma.payment.count(),
    attendances: await prisma.attendance.count(),
    events: await prisma.event.count(),
    homework: await prisma.homework.count(),
    messages: await prisma.message.count(),
    sanctions: await prisma.sanction.count(),
    resources: await prisma.resource.count(),
    promotions: await prisma.promotion.count(),
    litigations: await prisma.litigation.count(),
  };

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ BASE DE DONNÉES REMPLIE AVEC SUCCÈS');
  console.log('═══════════════════════════════════════════════════');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} : ${v}`);
  }
  console.log('───────────────────────────────────────────────────');
  console.log('  Mot de passe par défaut : 12345678');
  console.log('  Comptes admin : admin / directeur / cpe / secretaire / comptable');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
