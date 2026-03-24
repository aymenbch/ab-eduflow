/**
 * /api/inscription — Module Inscription & Onboarding
 *
 * Tables : InscDossier, InscDocument, InscRdv, InscFamille, InscServices
 * Workflow: A_L_ETUDE → EN_EVALUATION → PROFIL_FAMILLE → SERVICES → PAIEMENT → INSCRIT
 */
const { Router } = require('express');
const { getPrisma } = require('../db');
const crypto = require('crypto');
const { autoCreateAppUser, autoCreateParentUser, generateStudentCode } = require('./entities');

const router = Router();
const uid = () => crypto.randomUUID();

// ── Tables ────────────────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS InscDossier (
      id                TEXT PRIMARY KEY,
      first_name        TEXT NOT NULL,
      last_name         TEXT NOT NULL,
      date_of_birth     TEXT,
      gender            TEXT DEFAULT 'M',
      nationality       TEXT DEFAULT 'Algérienne',
      niveau_souhaite   TEXT,
      classe_souhaitee  TEXT,
      school_year       TEXT,
      status            TEXT DEFAULT 'A_L_ETUDE',
      notes             TEXT,
      student_id        TEXT,
      created_by        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS InscDocument (
      id            TEXT PRIMARY KEY,
      dossier_id    TEXT NOT NULL,
      document_type TEXT DEFAULT 'autre',
      label         TEXT,
      file_url      TEXT NOT NULL,
      file_name     TEXT,
      uploaded_at   TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS InscRdv (
      id               TEXT PRIMARY KEY,
      dossier_id       TEXT NOT NULL UNIQUE,
      rdv_date         TEXT,
      rdv_time         TEXT,
      rdv_type         TEXT DEFAULT 'test_entree',
      note_evaluation  REAL,
      avis             TEXT DEFAULT 'en_attente',
      evaluateur       TEXT,
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS InscFamille (
      id                   TEXT PRIMARY KEY,
      dossier_id           TEXT NOT NULL,
      lien                 TEXT DEFAULT 'pere',
      first_name           TEXT NOT NULL,
      last_name            TEXT NOT NULL,
      phone                TEXT,
      phone_urgence        TEXT,
      email                TEXT,
      profession           TEXT,
      adresse              TEXT,
      is_contact_principal INTEGER DEFAULT 0
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS InscServices (
      id             TEXT PRIMARY KEY,
      dossier_id     TEXT NOT NULL UNIQUE,
      cantine        INTEGER DEFAULT 0,
      transport      INTEGER DEFAULT 0,
      transport_zone TEXT,
      activites      TEXT DEFAULT '[]',
      notes          TEXT,
      updated_at     TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_insc_dossier_status ON InscDossier(status)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_insc_doc_dossier ON InscDocument(dossier_id)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_insc_famille_dossier ON InscFamille(dossier_id)`).catch(() => {});

  // Migration: add tarif selection columns to InscServices if they don't exist
  const tarif_cols = [
    'inscription_tarif_id TEXT',
    'scolarite_tarif_id TEXT',
    'cantine_tarif_id TEXT',
    'transport_tarif_id TEXT',
    'activite_tarif_ids TEXT DEFAULT \'[]\'',
    'nb_fratrie INTEGER DEFAULT 0',
    'tarif_gross REAL DEFAULT 0',
    'tarif_remise REAL DEFAULT 0',
    'tarif_net REAL DEFAULT 0',
  ];
  for (const col of tarif_cols) {
    const colName = col.split(' ')[0];
    await prisma.$executeRawUnsafe(`ALTER TABLE InscServices ADD COLUMN ${col}`).catch(() => {});
  }
}

let tablesReady = false;
router.use(async (req, res, next) => {
  if (!tablesReady) { await ensureTables(); tablesReady = true; }
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_STEP = {
  A_L_ETUDE:      1,
  EN_EVALUATION:  2,
  PROFIL_FAMILLE: 3,
  SERVICES:       4,
  PAIEMENT:       5,
  INSCRIT:        5,
  REFUSE:         2,
};

async function enrichDossier(prisma, d) {
  const [docs, rdv, famille, services] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT * FROM InscDocument WHERE dossier_id=? ORDER BY uploaded_at`, d.id),
    prisma.$queryRawUnsafe(`SELECT * FROM InscRdv WHERE dossier_id=?`, d.id),
    prisma.$queryRawUnsafe(`SELECT * FROM InscFamille WHERE dossier_id=? ORDER BY is_contact_principal DESC`, d.id),
    prisma.$queryRawUnsafe(`SELECT * FROM InscServices WHERE dossier_id=?`, d.id),
  ]);
  const svc = services[0] || null;
  if (svc) {
    try { svc.activites = JSON.parse(svc.activites || '[]'); } catch { svc.activites = []; }
    try { svc.activite_tarif_ids = JSON.parse(svc.activite_tarif_ids || '[]'); } catch { svc.activite_tarif_ids = []; }
  }
  return { ...d, step: STATUS_STEP[d.status] || 1, documents: docs, rdv: rdv[0] || null, famille, services: svc };
}

// ── Dossiers ──────────────────────────────────────────────────────────────────

router.get('/dossiers', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year, status, search } = req.query;
    let sql = 'SELECT * FROM InscDossier WHERE 1=1';
    const params = [];
    if (school_year) { sql += ' AND school_year=?';  params.push(school_year); }
    if (status)      { sql += ' AND status=?';        params.push(status); }
    if (search)      { sql += ` AND (first_name LIKE ? OR last_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC';
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows.map(d => ({ ...d, step: STATUS_STEP[d.status] || 1 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dossiers/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM InscDossier WHERE id=?`, req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(await enrichDossier(prisma, rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dossiers', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { first_name, last_name, date_of_birth, gender, nationality, niveau_souhaite, classe_souhaitee, school_year, notes, created_by } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO InscDossier(id,first_name,last_name,date_of_birth,gender,nationality,niveau_souhaite,classe_souhaitee,school_year,notes,created_by,status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,'A_L_ETUDE')`,
      id, first_name, last_name, date_of_birth||null, gender||'M', nationality||'Algérienne',
      niveau_souhaite||null, classe_souhaitee||null, school_year||null, notes||null, created_by||null
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/dossiers/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { first_name, last_name, date_of_birth, gender, nationality, niveau_souhaite, classe_souhaitee, school_year, notes, status } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET first_name=?,last_name=?,date_of_birth=?,gender=?,nationality=?,
       niveau_souhaite=?,classe_souhaitee=?,school_year=?,notes=?,status=COALESCE(?,status),updated_at=datetime('now') WHERE id=?`,
      first_name, last_name, date_of_birth||null, gender||'M', nationality||'Algérienne',
      niveau_souhaite||null, classe_souhaitee||null, school_year||null, notes||null, status||null, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/dossiers/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const id = req.params.id;
    await prisma.$executeRawUnsafe(`DELETE FROM InscServices  WHERE dossier_id=?`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM InscFamille   WHERE dossier_id=?`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM InscRdv       WHERE dossier_id=?`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM InscDocument  WHERE dossier_id=?`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM InscDossier   WHERE id=?`,         id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Advance status
router.put('/dossiers/:id/status', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { status } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET status=?,updated_at=datetime('now') WHERE id=?`, status, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Documents ─────────────────────────────────────────────────────────────────

router.post('/documents', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { dossier_id, document_type, label, file_url, file_name } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO InscDocument(id,dossier_id,document_type,label,file_url,file_name) VALUES(?,?,?,?,?,?)`,
      id, dossier_id, document_type||'autre', label||null, file_url, file_name||null
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/documents/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM InscDocument WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RDV & Évaluation ──────────────────────────────────────────────────────────

router.post('/rdv', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { dossier_id, rdv_date, rdv_time, rdv_type, note_evaluation, avis, evaluateur, notes } = req.body;
    const existing = await prisma.$queryRawUnsafe(`SELECT id FROM InscRdv WHERE dossier_id=?`, dossier_id);
    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE InscRdv SET rdv_date=?,rdv_time=?,rdv_type=?,note_evaluation=?,avis=?,evaluateur=?,notes=?,updated_at=datetime('now') WHERE dossier_id=?`,
        rdv_date||null, rdv_time||null, rdv_type||'test_entree',
        note_evaluation != null ? Number(note_evaluation) : null,
        avis||'en_attente', evaluateur||null, notes||null, dossier_id
      );
      res.json({ id: existing[0].id, ok: true });
    } else {
      const id = uid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO InscRdv(id,dossier_id,rdv_date,rdv_time,rdv_type,note_evaluation,avis,evaluateur,notes) VALUES(?,?,?,?,?,?,?,?,?)`,
        id, dossier_id, rdv_date||null, rdv_time||null, rdv_type||'test_entree',
        note_evaluation != null ? Number(note_evaluation) : null,
        avis||'en_attente', evaluateur||null, notes||null
      );
      // Advance status to EN_EVALUATION
      await prisma.$executeRawUnsafe(
        `UPDATE InscDossier SET status='EN_EVALUATION',updated_at=datetime('now') WHERE id=? AND status='A_L_ETUDE'`, dossier_id
      );
      res.json({ id, ok: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Famille ───────────────────────────────────────────────────────────────────

router.post('/famille', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { dossier_id, lien, first_name, last_name, phone, phone_urgence, email, profession, adresse, is_contact_principal } = req.body;
    const id = uid();
    // Only one contact principal
    if (is_contact_principal) {
      await prisma.$executeRawUnsafe(`UPDATE InscFamille SET is_contact_principal=0 WHERE dossier_id=?`, dossier_id);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO InscFamille(id,dossier_id,lien,first_name,last_name,phone,phone_urgence,email,profession,adresse,is_contact_principal) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      id, dossier_id, lien||'pere', first_name, last_name, phone||null, phone_urgence||null,
      email||null, profession||null, adresse||null, is_contact_principal ? 1 : 0
    );
    // Advance status if at EN_EVALUATION
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET status='PROFIL_FAMILLE',updated_at=datetime('now') WHERE id=? AND status='EN_EVALUATION'`, dossier_id
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/famille/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { lien, first_name, last_name, phone, phone_urgence, email, profession, adresse, is_contact_principal, dossier_id } = req.body;
    if (is_contact_principal && dossier_id) {
      await prisma.$executeRawUnsafe(`UPDATE InscFamille SET is_contact_principal=0 WHERE dossier_id=?`, dossier_id);
    }
    await prisma.$executeRawUnsafe(
      `UPDATE InscFamille SET lien=?,first_name=?,last_name=?,phone=?,phone_urgence=?,email=?,profession=?,adresse=?,is_contact_principal=? WHERE id=?`,
      lien||'pere', first_name, last_name, phone||null, phone_urgence||null,
      email||null, profession||null, adresse||null, is_contact_principal ? 1 : 0, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/famille/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM InscFamille WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Services ──────────────────────────────────────────────────────────────────

router.post('/services', async (req, res) => {
  const prisma = getPrisma();
  try {
    const {
      dossier_id, cantine, transport, transport_zone, activites, notes,
      inscription_tarif_id, scolarite_tarif_id, cantine_tarif_id,
      transport_tarif_id, activite_tarif_ids,
      nb_fratrie, tarif_gross, tarif_remise, tarif_net,
    } = req.body;
    const activitesJson = JSON.stringify(activites || []);
    const activiteTarifIdsJson = JSON.stringify(activite_tarif_ids || []);
    const existing = await prisma.$queryRawUnsafe(`SELECT id FROM InscServices WHERE dossier_id=?`, dossier_id);
    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE InscServices SET
          cantine=?,transport=?,transport_zone=?,activites=?,notes=?,
          inscription_tarif_id=?,scolarite_tarif_id=?,cantine_tarif_id=?,
          transport_tarif_id=?,activite_tarif_ids=?,
          nb_fratrie=?,tarif_gross=?,tarif_remise=?,tarif_net=?,
          updated_at=datetime('now')
         WHERE dossier_id=?`,
        cantine ? 1 : 0, transport ? 1 : 0, transport_zone||null, activitesJson, notes||null,
        inscription_tarif_id||null, scolarite_tarif_id||null, cantine_tarif_id||null,
        transport_tarif_id||null, activiteTarifIdsJson,
        Number(nb_fratrie)||0, Number(tarif_gross)||0, Number(tarif_remise)||0, Number(tarif_net)||0,
        dossier_id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO InscServices(id,dossier_id,cantine,transport,transport_zone,activites,notes,
          inscription_tarif_id,scolarite_tarif_id,cantine_tarif_id,
          transport_tarif_id,activite_tarif_ids,nb_fratrie,tarif_gross,tarif_remise,tarif_net)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        uid(), dossier_id, cantine ? 1 : 0, transport ? 1 : 0, transport_zone||null, activitesJson, notes||null,
        inscription_tarif_id||null, scolarite_tarif_id||null, cantine_tarif_id||null,
        transport_tarif_id||null, activiteTarifIdsJson,
        Number(nb_fratrie)||0, Number(tarif_gross)||0, Number(tarif_remise)||0, Number(tarif_net)||0
      );
    }
    // Advance status
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET status='PAIEMENT',updated_at=datetime('now') WHERE id=? AND status IN ('PROFIL_FAMILLE','SERVICES')`, dossier_id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Validation finale → INSCRIT ───────────────────────────────────────────────
// Creates Student + AppUser, creates/links parent AppUsers, marks dossier INSCRIT
router.post('/valider/:id', async (req, res) => {
  const prisma = getPrisma();
  const dossierId = req.params.id;
  try {
    // 1. Load dossier
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM InscDossier WHERE id=?`, dossierId);
    if (!rows?.length) return res.status(404).json({ error: 'Dossier introuvable' });
    const d = rows[0];

    // 2. Find matching class: prefer specific class name, then level
    let classId = null;
    if (d.classe_souhaitee) {
      const cls = await prisma.class.findFirst({ where: { name: d.classe_souhaitee } });
      classId = cls?.id || null;
    }
    if (!classId && d.niveau_souhaite) {
      const cls = await prisma.class.findFirst({ where: { level: d.niveau_souhaite } });
      classId = cls?.id || null;
    }

    // 3. Create Student (or update existing if already created)
    let student = null;
    let studentAccount = null;

    if (d.student_id) {
      // Already created — ensure class_id is set
      student = await prisma.student.findUnique({ where: { id: d.student_id } });
      if (student && !student.class_id && classId) {
        student = await prisma.student.update({ where: { id: d.student_id }, data: { class_id: classId } });
      }
    } else {
      // Generate unique student_code
      let code;
      let attempts = 0;
      const year = new Date().getFullYear();
      do {
        const num = String(Math.floor(1000 + Math.random() * 9000));
        code = `EL-${year}-${num}`;
        const exists = await prisma.student.findFirst({ where: { student_code: code } });
        if (!exists) break;
      } while (++attempts < 10);

      student = await prisma.student.create({
        data: {
          first_name: d.first_name,
          last_name: d.last_name,
          date_of_birth: d.date_of_birth || null,
          gender: d.gender || 'M',
          class_id: classId,
          student_code: code,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active',
        },
      });

      // 4. Create AppUser for student
      studentAccount = await autoCreateAppUser('Student', student);
    }

    const studentId = student?.id || null;

    // 5. Mark dossier as INSCRIT
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET status='INSCRIT',student_id=?,updated_at=datetime('now') WHERE id=?`,
      studentId, dossierId
    );

    // 6. Create/link parent accounts from InscFamille
    const famille = await prisma.$queryRawUnsafe(
      `SELECT * FROM InscFamille WHERE dossier_id=?`, dossierId
    );
    const parentAccounts = [];

    for (const membre of famille) {
      if (!membre.email?.trim()) continue;
      const email = membre.email.toLowerCase().trim();

      // Upsert Parent record
      let parentRecord;
      try {
        parentRecord = await prisma.parent.upsert({
          where: { email },
          update: {},
          create: {
            first_name: membre.first_name || '',
            last_name: membre.last_name || '',
            email,
            phone: membre.phone || null,
            relation: membre.lien || null,
          },
        });
      } catch { continue; }

      // Link student ↔ parent
      if (studentId && parentRecord) {
        await prisma.studentGuardian.upsert({
          where: { student_parent_unique: { student_id: studentId, parent_id: parentRecord.id } },
          update: {},
          create: {
            student_id: studentId,
            parent_id: parentRecord.id,
            relation: membre.lien || 'tuteur',
            is_primary: membre.is_contact_principal ? true : false,
          },
        });
      }

      // Create AppUser if not already exists (autoCreateParentUser deduplicates by email/login)
      const acc = await autoCreateParentUser(parentRecord);
      const name = `${membre.first_name || ''} ${membre.last_name || ''}`.trim();
      if (acc) {
        parentAccounts.push({
          name,
          lien: membre.lien,
          login: acc.appUser.login,
          provisional_password: acc.provisionalPassword,
          already_exists: false,
        });
      } else {
        parentAccounts.push({
          name,
          lien: membre.lien,
          login: email,
          already_exists: true,
        });
      }
    }

    res.json({
      ok: true,
      student_id: studentId,
      accounts: {
        student: studentAccount ? {
          login: studentAccount.appUser.login,
          provisional_password: studentAccount.provisionalPassword,
          must_change_on_first_login: true,
        } : null,
        parents: parentAccounts,
      },
    });
  } catch (e) {
    console.error('valider error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Refuse
router.post('/refuser/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { motif } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE InscDossier SET status='REFUSE',notes=COALESCE(notes||' | Refus: '||?,'Refus: '||?),updated_at=datetime('now') WHERE id=?`,
      motif||'', motif||'', req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    const filter = school_year ? `WHERE school_year='${school_year.replace(/'/g,"''")}'` : '';
    const rows = await prisma.$queryRawUnsafe(`
      SELECT status, COUNT(*) as cnt FROM InscDossier ${filter} GROUP BY status
    `);
    const stats = Object.fromEntries(rows.map(r => [r.status, Number(r.cnt)]));
    stats.total = Object.values(stats).reduce((s, n) => s + n, 0);
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
