/**
 * POST /api/import/:entity
 * Import en masse depuis un tableau JSON de lignes déjà mappées.
 * Résolution automatique des champs *_id par nom si la valeur n'est pas un UUID.
 */
const { Router } = require('express');
const { getPrisma } = require('../db');
const { loadUser, requireAuth, requireRole } = require('../authUtils');

const router = Router();

// Toutes les routes d'import requièrent une authentification et un rôle élevé.
// Les élèves, parents et enseignants ne peuvent pas importer de données en masse.
router.use(loadUser);
router.use(requireAuth);
router.use(requireRole('admin_systeme', 'admin', 'directeur_primaire', 'directeur_college', 'directeur_lycee', 'secretaire'));

// ── Configuration des entités importables ─────────────────────────────────
const IMPORT_CONFIG = {
  Student:  { model: 'student',  required: ['first_name', 'last_name'] },
  Teacher:  { model: 'teacher',  required: ['first_name', 'last_name'] },
  Staff:    { model: 'staff',    required: ['first_name', 'last_name'] },
  Class:    { model: 'class',    required: ['name'] },
  Subject:  { model: 'subject',  required: ['name'] },
  Parent:   { model: 'parent',   required: ['first_name', 'last_name'] },
  Room:     { model: 'room',     required: ['name'] },
  Payment:  { model: 'payment',  required: ['student_id', 'label', 'amount'] },
  Exam:     { model: 'exam',     required: ['title'] },
  Attendance: { model: 'attendance', required: ['student_id', 'date'] },
};

// Champs numériques par entité
const NUMERIC_FIELDS = {
  Teacher:  ['salary'],
  Staff:    ['salary'],
  Class:    ['capacity'],
  Subject:  ['coefficient', 'weekly_hours'],
  Room:     ['capacity'],
  Payment:  ['amount', 'amount_paid'],
  Exam:     ['coefficient', 'max_score'],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Résolution *_id par nom si valeur non-UUID ─────────────────────────────
async function resolveId(field, value, prisma) {
  if (!value || UUID_RE.test(String(value).trim())) return value;
  const v = String(value).trim();
  try {
    switch (field) {
      case 'class_id': {
        const c = await prisma.class.findFirst({ where: { name: { contains: v } } });
        return c?.id ?? value;
      }
      case 'subject_id': {
        const s = await prisma.subject.findFirst({
          where: { OR: [{ name: { contains: v } }, { code: v }] },
        });
        return s?.id ?? value;
      }
      case 'teacher_id': {
        const parts = v.split(/\s+/);
        const t = await prisma.teacher.findFirst({
          where: {
            OR: [
              { email: v },
              { first_name: { contains: parts[0] } },
            ],
          },
        });
        return t?.id ?? value;
      }
      case 'student_id': {
        const byCode = await prisma.student.findFirst({ where: { student_code: v } });
        if (byCode) return byCode.id;
        const parts = v.split(/\s+/);
        if (parts.length >= 2) {
          const byName = await prisma.student.findFirst({
            where: {
              first_name: { contains: parts[0] },
              last_name: { contains: parts[parts.length - 1] },
            },
          });
          if (byName) return byName.id;
        }
        return value;
      }
      default:
        return value;
    }
  } catch {
    return value;
  }
}

// ── Nettoyage / typage d'une ligne ────────────────────────────────────────
function cleanRow(entityName, raw) {
  const row = {};
  const numFields = NUMERIC_FIELDS[entityName] || [];
  for (const [k, v] of Object.entries(raw)) {
    if (v === '' || v === null || v === undefined) continue; // ignore vide → défauts Prisma
    if (numFields.includes(k)) {
      const n = parseFloat(String(v).replace(',', '.'));
      if (!isNaN(n)) row[k] = n;
    } else {
      row[k] = String(v).trim();
    }
  }
  return row;
}

// ── Vérification doublon ──────────────────────────────────────────────────
async function isDuplicate(entityName, row, prisma) {
  try {
    switch (entityName) {
      case 'Student':
        return !!(await prisma.student.findFirst({
          where: { first_name: row.first_name, last_name: row.last_name },
        }));
      case 'Teacher':
      case 'Staff':
        if (!row.email) return false;
        return !!(await prisma[IMPORT_CONFIG[entityName].model].findFirst({ where: { email: row.email } }));
      case 'Class':
        return !!(await prisma.class.findFirst({ where: { name: row.name } }));
      case 'Subject':
        return !!(await prisma.subject.findFirst({ where: { name: row.name } }));
      case 'Room':
        return !!(await prisma.room.findFirst({ where: { name: row.name } }));
      case 'Parent':
        if (!row.email) return false;
        return !!(await prisma.parent.findFirst({ where: { email: row.email } }));
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// ── Route principale ──────────────────────────────────────────────────────
router.post('/:entity', async (req, res) => {
  const { entity } = req.params;
  const config = IMPORT_CONFIG[entity];
  if (!config) {
    return res.status(400).json({ error: `Entité non supportée: ${entity}` });
  }

  const prisma = getPrisma();
  const model = prisma[config.model];
  const { rows = [], options = {} } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne à importer' });
  }
  if (rows.length > 2000) {
    return res.status(400).json({ error: 'Maximum 2000 lignes par import' });
  }

  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // ligne 1 = en-têtes
    try {
      let row = cleanRow(entity, rows[i]);

      // Résolution des champs *_id
      for (const field of ['class_id', 'subject_id', 'teacher_id', 'student_id']) {
        if (row[field]) row[field] = await resolveId(field, row[field], prisma);
      }

      // Validation des champs requis
      const missing = config.required.filter(f => !row[f]);
      if (missing.length > 0) {
        results.errors.push({ row: rowNum, message: `Champs requis manquants: ${missing.join(', ')}` });
        continue;
      }

      // Doublon ?
      if (options.skipDuplicates && await isDuplicate(entity, row, prisma)) {
        results.skipped++;
        continue;
      }

      await model.create({ data: row });
      results.created++;
    } catch (err) {
      // Friendly message for unique constraint violation
      const msg = err.message?.includes('Unique constraint')
        ? `Valeur dupliquée (contrainte unique violée)`
        : err.message;
      results.errors.push({ row: rowNum, message: msg });
    }
  }

  res.json(results);
});

module.exports = router;
