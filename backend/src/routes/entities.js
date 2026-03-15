const { Router } = require('express');
const crypto = require('crypto');
const { getPrisma } = require('../db');

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
  SocialGroup: 'socialGroup',
  SocialPost: 'socialPost',
  SocialBadge: 'socialBadge',
  Project: 'project',
  Task: 'task',
  Sprint: 'sprint',
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

/** Generate a random provisional password: 3 uppercase + 3 digits, e.g. "TKX849" */
function generateProvisionalPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
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

// Serialize array/object fields to JSON strings before writing to SQLite
function serializeJsonFields(data) {
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  for (const [key, val] of Object.entries(result)) {
    if (Array.isArray(val) || (val !== null && typeof val === 'object' && !(val instanceof Date))) {
      result[key] = JSON.stringify(val);
    }
  }
  return result;
}

// Parse JSON string fields back to arrays/objects when reading from SQLite
function parseJsonFields(item) {
  if (!item || typeof item !== 'object') return item;
  const result = { ...item };
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
      try { result[key] = JSON.parse(val); } catch {}
    }
  }
  return result;
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

// GET /api/entities/:entity — list all or filtered
router.get('/:entity', async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    let where = {};
    if (req.query.filters) {
      try { where = buildWhere(JSON.parse(req.query.filters)); } catch {}
    }
    const reserved = new Set(['filters', 'limit', 'offset', 'order']);
    for (const [k, v] of Object.entries(req.query)) {
      if (!reserved.has(k)) where[k] = v;
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset) : undefined;

    const items = await model.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { created_date: 'desc' },
    });
    res.json(items.map(parseJsonFields));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entities/:entity/:id — get one
router.get('/:entity/:id', async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const item = await model.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(parseJsonFields(item));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entities/:entity — create
router.post('/:entity', async (req, res) => {
  const entityName = req.params.entity;
  const model = getModel(entityName);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const data = { ...req.body };

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
router.post('/:entity/bulk', async (req, res) => {
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
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const item = await model.update({
      where: { id: req.params.id },
      data: serializeJsonFields(req.body),
    });
    res.json(parseJsonFields(item));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/entities/:entity/:id — delete
router.delete('/:entity/:id', async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: 'Unknown entity' });

  try {
    await model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
