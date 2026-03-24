const { Router } = require('express');
const crypto = require('crypto');
const { getPrisma } = require('../db');
const { loadUser, requireAuth, requireRole } = require('../authUtils');

const router = Router();

// Map URL entity name → Prisma model name (camelCase)
const ENTITY_MAP = {
  AppUser: 'appUser',
  Student: 'student',
  Teacher: 'teacher',
  Staff: 'staff',
  Class: 'class',
  Subject: 'subject',
  Grade: 'grade',
  Exam: 'exam',
  Attendance: 'attendance',
  Schedule: 'schedule',
  ScheduleEvent: 'scheduleEvent',
  SchoolYear: 'schoolYear',
  Message: 'message',
  Homework: 'homework',
  Event: 'event',
  Sanction: 'sanction',
  Resource: 'resource',
  Payment: 'payment',
  Litigation: 'litigation',
  UserProfile: 'userProfile',
  Promotion: 'promotion',
  Parent: 'parent',
  StudentGuardian: 'studentGuardian',
  Period: 'period',
  SocialGroup: 'socialGroup',
  SocialPost: 'socialPost',
  SocialBadge: 'socialBadge',
  Project: 'project',
  Task: 'task',
  Sprint: 'sprint',
  Room: 'room',
  VisioSession: 'visioSession',
  GradeHistory: 'gradeHistory',
  ParentAppointment: 'parentAppointment',
};

function getModel(entityName) {
  const prisma = getPrisma();
  const modelKey = ENTITY_MAP[entityName];
  if (!modelKey || !prisma[modelKey]) return null;
  return prisma[modelKey];
}

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/** Generate a random provisional password: 4 uppercase + 4 digits = 8 chars, e.g. "TKXY8492" */
function generateProvisionalPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

/**
 * Upsert a Parent record from student parent fields.
 * Returns the parent record or null if no email provided.
 */
async function upsertParent(data) {
  const prisma = getPrisma();
  const email = data.parent_email?.trim();
  if (!email) return null;

  const nameParts = (data.parent_name || '').trim().split(/\s+/);
  const first_name = nameParts[0] || 'Parent';
  const last_name = nameParts.slice(1).join(' ') || '';

  const existing = await prisma.parent.findUnique({ where: { email } });
  if (existing) {
    return prisma.parent.update({
      where: { email },
      data: {
        ...(first_name && { first_name }),
        ...(last_name !== undefined && { last_name }),
        ...(data.parent_phone && { phone: data.parent_phone }),
      },
    });
  }
  return prisma.parent.create({
    data: { first_name, last_name, email, phone: data.parent_phone || null },
  });
}

/**
 * Link a Parent to a Student via StudentGuardian join table.
 * Creates the link if it doesn't exist yet.
 * relation: 'tuteur' | 'père' | 'mère' | 'autre'
 */
async function linkGuardian(studentId, parentId, relation = 'tuteur', isPrimary = false) {
  const prisma = getPrisma();
  const existing = await prisma.studentGuardian.findFirst({
    where: { student_id: studentId, parent_id: parentId },
  });
  if (!existing) {
    await prisma.studentGuardian.create({
      data: { student_id: studentId, parent_id: parentId, relation, is_primary: isPrimary },
    });
  }
}

/** Generate student code: EL-YYYY-XXXX */
function generateStudentCode() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(1000 + Math.random() * 9000));
  return `EL-${year}-${num}`;
}

/**
 * Auto-create an AppUser account when a Student, Teacher, or Staff is created.
 * Returns { appUser, provisionalPassword } or null if skipped.
 */
async function autoCreateAppUser(entityName, entity) {
  const prisma = getPrisma();
  let login, role, memberType, fullName, notifyEmail;

  if (entityName === 'Student') {
    login = entity.student_code;
    role = 'eleve';
    memberType = 'Student';
    fullName = `${entity.first_name} ${entity.last_name}`;
    notifyEmail = entity.parent_email || null;
  } else if (entityName === 'Teacher') {
    login = entity.email;
    role = 'enseignant';
    memberType = 'Teacher';
    fullName = `${entity.first_name} ${entity.last_name}`;
    notifyEmail = entity.email || null;
  } else if (entityName === 'Staff') {
    login = entity.email;
    role = 'secretaire'; // default role for staff; admin can change later
    memberType = 'Staff';
    fullName = `${entity.first_name} ${entity.last_name}`;
    notifyEmail = entity.email || null;
  } else {
    return null;
  }

  if (!login) return null;

  // Check if AppUser already exists for this login
  const existing = await prisma.appUser.findFirst({ where: { login: login.toLowerCase() } });
  if (existing) return null;

  const provisionalPassword = generateProvisionalPassword();
  const pinHash = sha256(provisionalPassword);

  const appUser = await prisma.appUser.create({
    data: {
      login: login.toLowerCase(),
      pin_hash: pinHash,
      full_name: fullName,
      role,
      member_type: memberType,
      member_id: entity.id,
      status: 'active',
      must_change_pin: true, // force password change on first login
    },
  });

  // Log credentials since email is disabled
  console.log(`\n📧 Nouveaux identifiants créés pour ${fullName}:`);
  console.log(`   Login    : ${login.toLowerCase()}`);
  console.log(`   Mot de passe provisoire : ${provisionalPassword}`);
  if (notifyEmail) console.log(`   À envoyer à : ${notifyEmail}\n`);

  return { appUser, provisionalPassword, notifyEmail };
}

/**
 * Auto-create an AppUser for a Parent if no account exists yet for this email.
 * Login = parent.email (lowercase). Role = 'parent'. Member = Parent record.
 * Returns { appUser, provisionalPassword } or null if already exists / no email.
 */
async function autoCreateParentUser(parent) {
  const prisma = getPrisma();
  if (!parent?.email) return null;

  const login = parent.email.toLowerCase().trim();
  // Ne pas créer de doublon — vérification par login (= email)
  const existing = await prisma.appUser.findFirst({ where: { login } });
  if (existing) return null;

  const provisionalPassword = generateProvisionalPassword();
  const pinHash = sha256(provisionalPassword);
  const fullName = `${parent.first_name || ''} ${parent.last_name || ''}`.trim() || 'Parent';

  const appUser = await prisma.appUser.create({
    data: {
      login,
      pin_hash: pinHash,
      full_name: fullName,
      role: 'parent',
      member_type: 'Parent',
      member_id: parent.id,
      status: 'active',
      must_change_pin: true,
    },
  });

  console.log(`\n👨‍👩‍👧 Compte parent créé pour ${fullName}:`);
  console.log(`   Login    : ${login}`);
  console.log(`   Mot de passe provisoire : ${provisionalPassword}\n`);

  return { appUser, provisionalPassword };
}

// Serialize array/object fields to JSON strings before writing to SQLite.
// Only fields explicitly listed in JSON_FIELDS are serialized — prevents
// accidentally serializing Date objects, nested Prisma relations, or
// other non-JSON payload fields passed by the client.
function serializeJsonFields(data) {
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  for (const [key, val] of Object.entries(result)) {
    if (
      JSON_FIELDS.has(key) &&
      (Array.isArray(val) || (val !== null && typeof val === 'object' && !(val instanceof Date)))
    ) {
      result[key] = JSON.stringify(val);
    }
  }
  return result;
}

// Champs dont la valeur est stockée en JSON (tableaux ou objets)
// Uniquement ces champs sont parsés — évite la corruption de champs texte
// commençant accidentellement par '[' ou '{'.
const JSON_FIELDS = new Set([
  'subject_ids', 'student_ids', 'teacher_ids', 'class_ids',
  'exam_ids', 'resource_ids', 'assigned_cycles',
  'tags', 'options', 'settings', 'permissions', 'metadata',
  'attached_files', 'members', 'grades', 'choices', 'categories',
]);

// Parse JSON string fields back to arrays/objects when reading from SQLite
function parseJsonFields(item) {
  if (!item || typeof item !== 'object') return item;
  const result = { ...item };
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === 'string' && JSON_FIELDS.has(key)) {
      try { result[key] = JSON.parse(val); } catch {}
    }
  }
  return result;
}

// ── Règles d'accès par cycle (directeurs) ──────────────────────────────────
// Niveaux par système éducatif — synchronisé avec educationSystems.jsx (frontend)
// Index de cycle: 0=primaire, 1=collège/moyen, 2=lycée/secondaire
const EDUCATION_CYCLE_LEVELS = {
  francais: [
    ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
    ['6ème', '5ème', '4ème', '3ème'],
    ['2nde', '1ère', 'Terminale'],
  ],
  tunisien: [
    ['1ère AP', '2ème AP', '3ème AP', '4ème AP', '5ème AP', '6ème AP'],
    ['7ème de base', '8ème de base', '9ème de base'],
    ['1ère Sec', '2ème Sec', '3ème Sec', '4ème Sec'],
  ],
  canadien: [
    ['1re année', '2e année', '3e année', '4e année', '5e année', '6e année'],
    ['Sec 1', 'Sec 2', 'Sec 3'],
    ['Sec 4', 'Sec 5'],
  ],
  ib: [
    ['PYP 1', 'PYP 2', 'PYP 3', 'PYP 4', 'PYP 5', 'PYP 6'],
    ['MYP 1', 'MYP 2', 'MYP 3', 'MYP 4', 'MYP 5'],
    ['DP 1', 'DP 2'],
  ],
};

// Rôle directeur → index de cycle (0=primaire, 1=collège, 2=lycée)
const DIRECTOR_CYCLE_INDEX = {
  directeur_primaire: 0,
  directeur_college:  1,
  directeur_lycee:    2,
};

/**
 * Retourne les niveaux autorisés pour un utilisateur selon son rôle et ses cycles assignés.
 * - directeur_primaire/college/lycee : cycle fixe par rôle
 * - cpe / secretaire : cycles définis dans assigned_cycles (JSON array d'indices)
 * Retourne null si aucune restriction de cycle.
 */
function getEffectiveCycleLevels(user, educationSystem = 'francais') {
  const { role } = user;
  const systemLevels = EDUCATION_CYCLE_LEVELS[educationSystem] || EDUCATION_CYCLE_LEVELS.francais;

  // Directeur : cycle fixe par rôle
  const directorIdx = DIRECTOR_CYCLE_INDEX[role];
  if (directorIdx !== undefined) {
    return systemLevels[directorIdx] || null;
  }

  // CPE ou Secrétaire : cycles définis dans assigned_cycles
  if (role === 'cpe' || role === 'secretaire') {
    let cycles = [];
    try { cycles = user.assigned_cycles ? JSON.parse(user.assigned_cycles) : []; } catch {}
    if (!cycles.length) return null;
    const levels = [];
    for (const idx of cycles) {
      const cyc = systemLevels[idx];
      if (cyc) levels.push(...cyc);
    }
    return levels.length ? levels : null;
  }

  return null;
}

// Middleware d'authentification — importé depuis authUtils.js
// Supporte : X-Session-Token (HMAC signé, préféré) et X-User-Id (legacy fallback)

// Applique les contraintes d'accès au clause WHERE selon le rôle
async function applyAccessFilter(entityName, where, user, educationSystem = 'francais') {
  if (!user) return where;
  const { role, member_id } = user;
  const prisma = getPrisma();

  // ── Cycle-based access : directeur, cpe, secrétaire ──────────────────────
  const cycleLevels = getEffectiveCycleLevels(user, educationSystem);
  if (cycleLevels) {
    // Helper : IDs des classes du cycle
    const getCycleClassIds = async () => {
      const classes = await prisma.class.findMany({ where: { level: { in: cycleLevels } }, select: { id: true } });
      return classes.map(c => c.id);
    };

    switch (entityName) {
      case 'Class':
        where.level = { in: cycleLevels };
        break;

      // Entités directement liées à une classe
      case 'Student':
      case 'Attendance':
      case 'Exam':
      case 'Schedule':
      case 'ScheduleEvent':
      case 'Homework':
      case 'VisioSession': {
        where.class_id = { in: await getCycleClassIds() };
        break;
      }

      // Entités filtrées par niveau
      case 'Subject':
      case 'Resource':
        where.level = { in: cycleLevels };
        break;

      // Enseignants : ceux qui ont un créneau dans les classes du cycle
      case 'Teacher': {
        const classIds = await getCycleClassIds();
        const schedules = await prisma.schedule.findMany({
          where: { class_id: { in: classIds } },
          select: { teacher_id: true },
        });
        const teacherIds = [...new Set(schedules.map(s => s.teacher_id).filter(Boolean))];
        where.id = { in: teacherIds };
        break;
      }

      // Notes : via student_id
      case 'Grade':
      case 'GradeHistory': {
        const classIds = await getCycleClassIds();
        const students = await prisma.student.findMany({ where: { class_id: { in: classIds } }, select: { id: true } });
        where.student_id = { in: students.map(s => s.id) };
        break;
      }

      // Sanctions : class_id disponible directement
      case 'Sanction': {
        where.class_id = { in: await getCycleClassIds() };
        break;
      }

      // Finance : paiements et contentieux via student_id
      case 'Payment':
      case 'Litigation': {
        const classIds = await getCycleClassIds();
        const students = await prisma.student.findMany({ where: { class_id: { in: classIds } }, select: { id: true } });
        where.student_id = { in: students.map(s => s.id) };
        break;
      }

      // Event, SocialGroup, SocialPost, SocialBadge, Project, Task, Sprint
      // → pas de lien direct avec un cycle : pas de filtre appliqué
    }
    return where;
  }

  // ── Enseignant : cloisonnement par matières accréditées (Filtrage F2) ──────
  if (role === 'enseignant' && member_id) {
    if (entityName === 'Subject') {
      // F2 : ne voir que ses matières habilitées
      const teacher = await prisma.teacher.findFirst({ where: { id: member_id } });
      let subjectIds = [];
      try { subjectIds = JSON.parse(teacher?.subject_ids || '[]'); } catch {}
      // Si aucune habilitation définie → accès à toutes les matières actives (admin peut gérer)
      if (subjectIds.length > 0) where.id = { in: subjectIds };
    } else if (entityName === 'Exam' || entityName === 'Homework') {
      where.teacher_id = member_id;
    } else if (entityName === 'Schedule') {
      // Enseignant voit l'emploi du temps COMPLET des classes où il intervient
      // (pas seulement ses propres cours — il doit voir toute la grille de sa classe)
      const mySlots = await prisma.schedule.findMany({
        where: { teacher_id: member_id },
        select: { class_id: true },
      });
      const classIds = [...new Set(mySlots.map(s => s.class_id).filter(Boolean))];
      where.class_id = { in: classIds.length > 0 ? classIds : ['__none__'] };
    } else if (entityName === 'Grade' || entityName === 'GradeHistory') {
      // Notes / historique des examens que le prof a créés
      const exams = await prisma.exam.findMany({ where: { teacher_id: member_id }, select: { id: true } });
      where.exam_id = { in: exams.map(e => e.id) };
    } else if (entityName === 'Sanction') {
      // Sanctions : uniquement pour les classes où l'enseignant intervient
      const mySlots = await prisma.schedule.findMany({
        where: { teacher_id: member_id }, select: { class_id: true },
      });
      const classIds = [...new Set(mySlots.map(s => s.class_id).filter(Boolean))];
      where.class_id = { in: classIds.length > 0 ? classIds : ['__none__'] };
    }
    return where;
  }

  // ── Élève : ne voit que ses propres données ───────────────────────────────
  if (role === 'eleve' && member_id) {
    if (entityName === 'Grade' || entityName === 'GradeHistory' || entityName === 'Attendance' || entityName === 'Sanction') {
      where.student_id = member_id;
    } else if (entityName === 'Student') {
      where.id = member_id;
    } else if (entityName === 'Homework' || entityName === 'Schedule') {
      const student = await prisma.student.findUnique({ where: { id: member_id }, select: { class_id: true } });
      // Élève ne voit QUE sa propre classe — sans classe affectée, rien n'est visible
      where.class_id = student?.class_id ?? '__none__';
      // Élèves ne voient que les créneaux publiés (pas les brouillons)
      if (entityName === 'Schedule') where.status = 'publie';
    } else if (entityName === 'VisioSession') {
      const student = await prisma.student.findUnique({ where: { id: member_id }, select: { class_id: true } });
      where.class_id = student?.class_id ?? '__none__';
    } else if (entityName === 'Subject') {
      // F3 : matières présentes dans les notes ou l'emploi du temps de l'élève
      const student = await prisma.student.findUnique({ where: { id: member_id }, select: { class_id: true } });
      const grades = await prisma.grade.findMany({ where: { student_id: member_id }, select: { exam_id: true } });
      const examIds = grades.map(g => g.exam_id).filter(Boolean);
      const exams = examIds.length > 0
        ? await prisma.exam.findMany({ where: { id: { in: examIds } }, select: { subject_id: true } })
        : [];
      const schedules = student?.class_id
        ? await prisma.schedule.findMany({ where: { class_id: student.class_id }, select: { subject_id: true } })
        : [];
      const subjectIds = [...new Set(
        [...exams.map(e => e.subject_id), ...schedules.map(s => s.subject_id)].filter(Boolean)
      )];
      where.id = { in: subjectIds.length > 0 ? subjectIds : ['__none__'] };
    }
    return where;
  }

  // ── Parent : ne voit que les données de ses enfants ─────────────────────
  if (role === 'parent' && member_id) {
    // member_id is a Parent.id — look up linked students via StudentGuardian
    const guardianLinks = await prisma.studentGuardian.findMany({
      where: { parent_id: member_id }, select: { student_id: true },
    });
    const linkedIds = guardianLinks.map(g => g.student_id);
    // Legacy fallback: if no guardian links found, treat member_id as student_id directly
    const childIds = linkedIds.length > 0 ? linkedIds : [member_id];
    const childrenByParentId = await prisma.student.findMany({
      where: { id: { in: childIds } }, select: { id: true, class_id: true },
    });
    const classIds = [...new Set(childrenByParentId.map(s => s.class_id).filter(Boolean))];

    if (entityName === 'Grade' || entityName === 'GradeHistory' || entityName === 'Attendance' || entityName === 'Sanction') {
      where.student_id = { in: childIds };
    } else if (entityName === 'Student') {
      where.id = { in: childIds };
    } else if (entityName === 'Homework' || entityName === 'Schedule') {
      if (classIds.length > 0) where.class_id = { in: classIds };
      else if (childIds.length === 1) {
        const s = await prisma.student.findUnique({ where: { id: childIds[0] }, select: { class_id: true } });
        if (s?.class_id) where.class_id = s.class_id;
      }
      // Parents ne voient que les créneaux publiés
      if (entityName === 'Schedule') where.status = 'publie';
    } else if (entityName === 'VisioSession') {
      if (classIds.length > 0) where.class_id = { in: classIds };
    } else if (entityName === 'Payment' || entityName === 'Litigation') {
      // Parent ne voit que les paiements/contentieux de ses enfants
      where.student_id = { in: childIds };
    } else if (entityName === 'ParentAppointment') {
      // Parent ne voit que ses propres rendez-vous
      where.parent_id = member_id;
    }
    return where;
  }

  // ── Comptable : accès limité à Finance, RH — blocage des données académiques ──
  if (role === 'comptable') {
    const BLOCKED = [
      'Grade', 'GradeHistory', 'Student', 'Attendance', 'Sanction',
      'Exam', 'Homework', 'Resource', 'Schedule', 'ScheduleEvent',
      'VisioSession', 'SocialPost', 'SocialGroup', 'Message',
    ];
    if (BLOCKED.includes(entityName)) {
      where.id = '__none__'; // Aucun enregistrement ne correspond — accès bloqué
    }
    return where;
  }

  return where;
}

// Build Prisma where clause from Base44-style filter object
function buildWhere(filters) {
  if (!filters || typeof filters !== 'object') return {};
  if (Array.isArray(filters)) return {};

  const where = {};
  for (const [key, val] of Object.entries(filters)) {
    if (key === '$or') {
      where.OR = val.map(buildWhere);
    } else if (key === '$and') {
      where.AND = val.map(buildWhere);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const prismaOp = {};
      if ('$in' in val) prismaOp.in = val.$in;
      if ('$nin' in val) prismaOp.notIn = val.$nin;
      if ('$gt' in val) prismaOp.gt = val.$gt;
      if ('$gte' in val) prismaOp.gte = val.$gte;
      if ('$lt' in val) prismaOp.lt = val.$lt;
      if ('$lte' in val) prismaOp.lte = val.$lte;
      if ('$ne' in val) prismaOp.not = val.$ne;
      if ('$contains' in val) prismaOp.contains = val.$contains;
      where[key] = prismaOp;
    } else {
      where[key] = val;
    }
  }
  return where;
}

// ── Génération de lien de visioconférence ─────────────────────────────────
function generateMeetingLink(provider) {
  if (provider === 'jitsi') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz23456789';
    let suffix = '';
    for (let i = 0; i < 10; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return { url: `https://meet.jit.si/EduGest-${suffix}`, id: suffix };
  }
  if (provider === 'google_meet') {
    const alpha = 'abcdefghijklmnopqrstuvwxyz';
    const rand = (n) => Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    const code = `${rand(3)}-${rand(4)}-${rand(3)}`;
    return { url: `https://meet.google.com/${code}`, id: code };
  }
  // Teams et Zoom : l'utilisateur colle son propre lien
  return { url: null, id: null };
}

// Appliquer loadUser + requireAuth sur toutes les routes
// Tout accès à l'API entités requiert une session valide (token signé ou X-User-Id legacy)
router.use(loadUser);
router.use(requireAuth);

// POST /api/entities/VisioSession/generate-link — génère un lien de réunion
router.post('/VisioSession/generate-link', (req, res) => {
  const { provider } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider requis' });
  const valid = ['jitsi', 'google_meet', 'teams', 'zoom'];
  if (!valid.includes(provider)) return res.status(400).json({ error: `Fournisseur inconnu: ${provider}` });
  const result = generateMeetingLink(provider);
  res.json({ provider, url: result.url, id: result.id });
});

// GET /api/entities/:entity — list all or filtered
router.get('/:entity', async (req, res) => {
  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    let where = {};
    if (req.query.filters) {
      try { where = buildWhere(JSON.parse(req.query.filters)); } catch {}
    }
    // Champs sensibles interdits en filtre direct — empêche l'énumération via
    // GET /api/entities/AppUser?pin_hash=... ou ?token=...
    const SENSITIVE_QUERY_FIELDS = new Set([
      'pin_hash', 'password', 'token', 'secret', 'api_key',
      'reset_token', 'access_token', 'refresh_token',
    ]);
    const reserved = new Set(['filters', 'limit', 'offset', 'order']);
    for (const [k, v] of Object.entries(req.query)) {
      if (!reserved.has(k) && !SENSITIVE_QUERY_FIELDS.has(k)) where[k] = v;
    }

    // Appliquer les filtres d'accès selon le rôle de l'utilisateur connecté
    where = await applyAccessFilter(entityName, where, req.user, req.educationSystem);

    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset) : undefined;

    // GradeHistory uses changed_at, all others use created_date
    const orderByField = entityName === 'GradeHistory' ? 'changed_at' : 'created_date';
    const items = await model.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [orderByField]: 'desc' },
    });
    res.json(items.map(parseJsonFields));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entities/:entity/:id — get one (avec filtre d'accès)
router.get('/:entity/:id', async (req, res) => {
  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    // Apply access filter on an empty where, then AND with the specific id
    let accessWhere = {};
    accessWhere = await applyAccessFilter(entityName, accessWhere, req.user, req.educationSystem);
    const where = Object.keys(accessWhere).length > 0
      ? { AND: [{ id: req.params.id }, accessWhere] }
      : { id: req.params.id };
    const item = await model.findFirst({ where });
    if (!item) return res.status(403).json({ error: 'Accès refusé ou enregistrement introuvable' });
    res.json(parseJsonFields(item));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * RG-EDT — Validate Schedule data before create/update.
 * Returns { errors: string[] } — errors block the operation.
 *
 * Hard constraints (bloquants) :
 *   RG-EDT-01 : Unicité enseignant sur le créneau
 *   RG-EDT-02 : Unicité classe sur le créneau
 *   RG-EDT-03 : Unicité salle sur le créneau
 *   RG-EDT-04 : Capacité salle vs taille classe
 */
async function validateSchedule(data, scheduleId = null) {
  const prisma = getPrisma();
  const errors = [];

  const { day_of_week, start_time, end_time } = data;
  if (!day_of_week || !start_time || !end_time) return { errors };
  if (start_time >= end_time) {
    errors.push("L'heure de fin doit être postérieure à l'heure de début.");
    return { errors };
  }

  // 1. Récupérer tous les créneaux du même jour (hors enregistrement courant)
  const existing = await prisma.schedule.findMany({
    where: {
      day_of_week,
      ...(scheduleId ? { id: { not: scheduleId } } : {}),
    },
  });

  // 2. Filtrer les créneaux qui se chevauchent : s1.start < e2 AND s1.end > s2.start
  const conflicting = existing.filter(s => s.start_time < end_time && s.end_time > start_time);

  // 3. Batch-fetch toutes les entités nécessaires pour les messages d'erreur (évite N+1)
  const teacherIdsNeeded = [...new Set([data.teacher_id, ...conflicting.map(s => s.teacher_id)].filter(Boolean))];
  const classIdsNeeded   = [...new Set([data.class_id,   ...conflicting.map(s => s.class_id)].filter(Boolean))];
  const subjectIdsNeeded = [...new Set(conflicting.map(s => s.subject_id).filter(Boolean))];
  const roomIdsNeeded    = [...new Set([data.room_id].filter(Boolean))];

  const [teachers, classes, subjects, rooms] = await Promise.all([
    teacherIdsNeeded.length ? prisma.teacher.findMany({ where: { id: { in: teacherIdsNeeded } } }) : [],
    classIdsNeeded.length   ? prisma.class.findMany({ where: { id: { in: classIdsNeeded } } })   : [],
    subjectIdsNeeded.length ? prisma.subject.findMany({ where: { id: { in: subjectIdsNeeded } } }) : [],
    roomIdsNeeded.length    ? prisma.room.findMany({ where: { id: { in: roomIdsNeeded } } })     : [],
  ]);

  const tMap = Object.fromEntries(teachers.map(t => [t.id, t]));
  const cMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const sMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const rMap = Object.fromEntries(rooms.map(r => [r.id, r]));

  // RG-EDT-01 : enseignant déjà occupé
  if (data.teacher_id) {
    const c = conflicting.find(s => s.teacher_id === data.teacher_id);
    if (c) {
      const t   = tMap[data.teacher_id];
      const cls = cMap[c.class_id];
      errors.push(`RG-EDT-01 : ${t?.first_name ?? ''} ${t?.last_name ?? ''} est déjà en cours de ${c.start_time} à ${c.end_time} (${cls?.name || 'classe inconnue'}).`);
    }
  }

  // RG-EDT-02 : classe déjà en cours
  if (data.class_id) {
    const c = conflicting.find(s => s.class_id === data.class_id);
    if (c) {
      const sub = sMap[c.subject_id];
      errors.push(`RG-EDT-02 : Cette classe a déjà un cours (${sub?.name || 'matière inconnue'}) de ${c.start_time} à ${c.end_time}.`);
    }
  }

  // RG-EDT-03 : salle déjà occupée
  if (data.room_id) {
    const c = conflicting.find(s => s.room_id === data.room_id);
    if (c) {
      const room = rMap[data.room_id];
      errors.push(`RG-EDT-03 : La salle "${room?.name || data.room_id}" est déjà occupée de ${c.start_time} à ${c.end_time}.`);
    }
  }

  // RG-EDT-04 : capacité salle insuffisante
  if (data.room_id && data.class_id) {
    const room = rMap[data.room_id];
    const cls  = cMap[data.class_id];
    if (room?.capacity && cls?.capacity && cls.capacity > room.capacity) {
      errors.push(`RG-EDT-04 : La salle "${room.name}" (capacité ${room.capacity}) est insuffisante pour la classe "${cls.name}" (${cls.capacity} élèves).`);
    }
  }

  return { errors };
}

/**
 * RG-MAT — Validate Subject data before create/update.
 * Returns array of error messages (empty = valid).
 */
async function validateSubject(data, subjectId = null) {
  const prisma = getPrisma();
  const errors = [];

  // RG-MAT-02 : coefficient > 0 si matière évaluable
  const isEvaluable = data.is_evaluable !== false && data.is_evaluable !== 'false';
  if (isEvaluable) {
    const coeff = Number(data.coefficient);
    if ('coefficient' in data && (isNaN(coeff) || coeff <= 0)) {
      errors.push('RG-MAT-02 : Le coefficient doit être strictement supérieur à 0. Pour une matière non évaluée, activez le flag "Non évaluée".');
    }
  }

  // RG-MAT-01 : code unique par niveau
  if (data.code && String(data.code).trim()) {
    const codeVal = String(data.code).trim().toUpperCase();
    const existing = await prisma.subject.findFirst({
      where: {
        code: codeVal,
        level: data.level || null,
        ...(subjectId ? { id: { not: subjectId } } : {}),
      },
    });
    if (existing) {
      const levelLabel = data.level ? ` pour le niveau "${data.level}"` : ' (sans niveau défini)';
      errors.push(`RG-MAT-01 : Le code "${codeVal}" est déjà utilisé par "${existing.name}"${levelLabel}.`);
    }
  }

  return errors;
}

/**
 * Validate Student data before create/update.
 * Returns array of error messages (empty = valid).
 */
async function validateStudent(data, studentId = null) {
  const prisma = getPrisma();
  const errors = [];

  // parent_email obligatoire
  if (!data.parent_email || !String(data.parent_email).trim()) {
    errors.push("L'email du parent/tuteur est obligatoire.");
  }

  // Un élève ne peut être affecté qu'à une seule classe par année scolaire
  if (data.class_id && studentId) {
    const targetClass = await prisma.class.findUnique({ where: { id: data.class_id } });
    if (targetClass?.school_year) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { class_id: true } });
      if (student?.class_id && student.class_id !== data.class_id) {
        const currentClass = await prisma.class.findUnique({ where: { id: student.class_id } });
        if (currentClass?.school_year === targetClass.school_year) {
          errors.push(
            `L'élève est déjà affecté à la classe "${currentClass.name}" pour l'année scolaire ${targetClass.school_year}. ` +
            `Un élève ne peut être affecté qu'à une seule classe par année scolaire.`
          );
        }
      }
    }
  }

  return errors;
}

// POST /api/entities/:entity — create
router.post('/:entity', async (req, res) => {
  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const data = { ...req.body };

    // Extract additional guardians before Prisma create (Student model has no `guardians` field)
    const additionalGuardians = (entityName === 'Student' && Array.isArray(data.guardians))
      ? data.guardians
      : [];
    // Save parent_relation before stripping — used later for StudentGuardian link
    const primaryGuardianRelation = data.parent_relation || 'tuteur';
    if (entityName === 'Student') {
      delete data.guardians;
      // parent_relation is not a Student model field — used only for StudentGuardian link
      delete data.parent_relation;
    }

    // Validate Student business rules
    if (entityName === 'Student') {
      const validationErrors = await validateStudent(data, null);
      if (validationErrors.length > 0) {
        return res.status(422).json({ error: validationErrors.join(' ') });
      }
    }

    // Validate Subject business rules (RG-MAT-01, RG-MAT-02)
    if (entityName === 'Subject') {
      const subjectErrors = await validateSubject(data, null);
      if (subjectErrors.length > 0) {
        return res.status(422).json({ error: subjectErrors.join(' ') });
      }
    }

    // RG-EDT : Schedule — contraintes dures (conflits, capacité)
    if (entityName === 'Schedule') {
      const scheduleValidation = await validateSchedule(data, null);
      if (scheduleValidation.errors.length > 0) {
        return res.status(422).json({ error: scheduleValidation.errors.join(' ') });
      }
    }

    // RG-MAT-04 : Schedule — vérifier l'accréditation enseignant/matière
    if (entityName === 'Schedule' && data.teacher_id && data.subject_id) {
      const prisma = getPrisma();
      const teacher = await prisma.teacher.findUnique({ where: { id: data.teacher_id } });
      if (teacher) {
        let teacherSubjectIds = [];
        try { teacherSubjectIds = JSON.parse(teacher.subject_ids || '[]'); } catch {}
        if (teacherSubjectIds.length > 0 && !teacherSubjectIds.includes(data.subject_id)) {
          const subject = await prisma.subject.findUnique({ where: { id: data.subject_id } });
          return res.status(422).json({
            error: `RG-MAT-04 : ${teacher.first_name} ${teacher.last_name} n'est pas accrédité(e) pour enseigner "${subject?.name || data.subject_id}". Mettez à jour ses habilitations dans la fiche enseignant.`,
          });
        }
      }
    }

    // Auto-generate student_code if creating a Student without one
    if (entityName === 'Student' && !data.student_code) {
      const prisma = getPrisma();
      let code;
      let attempts = 0;
      do {
        code = generateStudentCode();
        const exists = await prisma.student.findFirst({ where: { student_code: code } });
        if (!exists) break;
      } while (++attempts < 10);
      data.student_code = code;
    }

    const item = await model.create({ data: serializeJsonFields(data) });

    // Auto-link/create Parent record for Student via StudentGuardian
    if (entityName === 'Student' && data.parent_email) {
      const parent = await upsertParent(data);
      if (parent) {
        await linkGuardian(item.id, parent.id, primaryGuardianRelation, true);
        item.parent_id = parent.id; // keep for backward compat in response
        await autoCreateParentUser(parent); // auto-create AppUser for primary parent
      }
    }

    // Process additional guardians (from multi-guardian form)
    if (entityName === 'Student' && additionalGuardians.length > 0) {
      for (const g of additionalGuardians) {
        const gEmail = g.email?.trim();
        if (!gEmail) continue; // email is required per entry — skip if missing
        const gParent = await upsertParent({
          parent_email: gEmail,
          parent_name: `${g.first_name || ''} ${g.last_name || ''}`.trim() || g.name || '',
          parent_phone: g.phone || '',
        });
        if (gParent) {
          await linkGuardian(item.id, gParent.id, g.relation || 'tuteur', false);
          await autoCreateParentUser(gParent);
        }
      }
    }

    // Auto-create AppUser for Student, Teacher, Staff
    const autoUser = await autoCreateAppUser(entityName, item);

    const response = { ...parseJsonFields(item) };
    if (autoUser) {
      response._account = {
        login: autoUser.appUser.login,
        provisional_password: autoUser.provisionalPassword,
        notify_email: autoUser.notifyEmail,
        must_change_on_first_login: true,
      };
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/entities/:entity/bulk — bulk create
// Accès : tout utilisateur authentifié SAUF élèves et parents
router.post('/:entity/bulk', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  if (['eleve', 'parent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé. Les élèves et parents ne peuvent pas effectuer de créations en masse.' });
  }

  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    await model.createMany({ data: items, skipDuplicates: true });
    const created = await model.findMany({
      orderBy: { created_date: 'desc' },
      take: items.length,
    });
    res.status(201).json(created.map(parseJsonFields));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/entities/:entity/:id — update
router.put('/:entity/:id', async (req, res) => {
  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const prisma = getPrisma();

    // Validate Subject business rules on update (RG-MAT-01, RG-MAT-02)
    if (entityName === 'Subject') {
      const subjectErrors = await validateSubject(req.body, req.params.id);
      if (subjectErrors.length > 0) return res.status(422).json({ error: subjectErrors.join(' ') });
    }

    // RG-EDT : Schedule update — contraintes dures (fusion des champs existants + nouveaux)
    if (entityName === 'Schedule') {
      const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
      const mergedData = { ...existing, ...req.body };
      const scheduleValidation = await validateSchedule(mergedData, req.params.id);
      if (scheduleValidation.errors.length > 0) {
        return res.status(422).json({ error: scheduleValidation.errors.join(' ') });
      }
    }

    // RG-MAT-04 : Schedule update — re-vérifier l'accréditation si teacher_id ou subject_id change
    if (entityName === 'Schedule' && (req.body.teacher_id || req.body.subject_id)) {
      const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
      const teacherId  = req.body.teacher_id  ?? existing?.teacher_id;
      const subjectId  = req.body.subject_id  ?? existing?.subject_id;
      if (teacherId && subjectId) {
        const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
        if (teacher) {
          let teacherSubjectIds = [];
          try { teacherSubjectIds = JSON.parse(teacher.subject_ids || '[]'); } catch {}
          if (teacherSubjectIds.length > 0 && !teacherSubjectIds.includes(subjectId)) {
            const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
            return res.status(422).json({
              error: `RG-MAT-04 : ${teacher.first_name} ${teacher.last_name} n'est pas accrédité(e) pour enseigner "${subject?.name || subjectId}".`,
            });
          }
        }
      }
    }

    // Validate Student business rules on update
    if (entityName === 'Student') {
      const errors = [];
      // Email validation only when the field is explicitly being updated
      if ('parent_email' in req.body && (!req.body.parent_email || !String(req.body.parent_email).trim())) {
        errors.push("L'email du parent/tuteur est obligatoire.");
      }
      // One-class-per-year when class_id is changing
      if (req.body.class_id) {
        const classErrors = await validateStudent({ class_id: req.body.class_id, parent_email: '_skip_' }, req.params.id);
        errors.push(...classErrors.filter(e => !e.includes('email')));
      }
      if (errors.length > 0) return res.status(422).json({ error: errors.join(' ') });
    }

    // SchoolYear archiving: auto-archive diplômé/transféré students from that year's classes
    if (entityName === 'SchoolYear' && req.body.status === 'archived') {
      const year = await prisma.schoolYear.findUnique({ where: { id: req.params.id } });
      if (year?.name) {
        const classes = await prisma.class.findMany({
          where: { school_year: year.name },
          select: { id: true },
        });
        if (classes.length > 0) {
          const classIds = classes.map(c => c.id);
          await prisma.student.updateMany({
            where: {
              class_id: { in: classIds },
              status: { in: ['graduated', 'transferred'] },
            },
            data: { class_id: null },
          });
        }
      }
    }

    const item = await model.update({
      where: { id: req.params.id },
      data: serializeJsonFields(req.body),
    });

    // Auto-link/create Parent record when parent fields are updated on Student
    if (entityName === 'Student' && (req.body.parent_email || req.body.parent_name || req.body.parent_phone)) {
      const current = await prisma.student.findUnique({ where: { id: req.params.id } });
      const mergedData = {
        parent_email: req.body.parent_email ?? current?.parent_email,
        parent_name: req.body.parent_name ?? current?.parent_name,
        parent_phone: req.body.parent_phone ?? current?.parent_phone,
      };
      const parent = await upsertParent(mergedData);
      if (parent) {
        await linkGuardian(req.params.id, parent.id, req.body.parent_relation || 'tuteur', true);
      }
    }

    res.json(parseJsonFields(item));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/entities/:entity/:id — delete
// Accès : tout utilisateur authentifié SAUF élèves et parents
router.delete('/:entity/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  if (['eleve', 'parent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé. Les élèves et parents ne peuvent pas supprimer des enregistrements.' });
  }

  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    // RG-MAT-03 : protection soft-delete pour Subject
    if (entityName === 'Subject') {
      const prisma = getPrisma();
      const examCount     = await prisma.exam.count({ where: { subject_id: req.params.id } });
      const homeworkCount = await prisma.homework.count({ where: { subject_id: req.params.id } });
      const scheduleCount = await prisma.schedule.count({ where: { subject_id: req.params.id } });
      const resourceCount = await prisma.resource.count({ where: { subject_id: req.params.id } });
      const total = examCount + homeworkCount + scheduleCount + resourceCount;
      if (total > 0) {
        const details = [
          examCount     > 0 ? `${examCount} examen(s)`     : null,
          homeworkCount > 0 ? `${homeworkCount} devoir(s)`  : null,
          scheduleCount > 0 ? `${scheduleCount} créneau(x)` : null,
          resourceCount > 0 ? `${resourceCount} ressource(s)`: null,
        ].filter(Boolean).join(', ');
        return res.status(409).json({
          error: `RG-MAT-03 : Impossible de supprimer cette matière — elle est liée à ${details}. Archivez-la plutôt (status = "inactive") pour préserver l'historique.`,
          can_archive: true,
          linked_counts: { examCount, homeworkCount, scheduleCount, resourceCount },
        });
      }
    }

    await model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { router, autoCreateAppUser, autoCreateParentUser, generateStudentCode, sha256 };
