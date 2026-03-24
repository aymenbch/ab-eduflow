/**
 * /api/tarifs — Grille Tarifaire (Inscription, Scolarité, Cantine, Transport, Activités)
 *
 * Tables : TarifConfig, TarifRemise, TarifZone
 */
const { Router } = require('express');
const { getPrisma } = require('../db');
const crypto = require('crypto');

const router = Router();
const uid = () => crypto.randomUUID();

// ── Tables ────────────────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TarifConfig (
      id               TEXT PRIMARY KEY,
      fee_type         TEXT NOT NULL,
      label            TEXT NOT NULL,
      niveau           TEXT,
      transport_zone   TEXT,
      activite_name    TEXT,
      amount           REAL NOT NULL DEFAULT 0,
      billing_period   TEXT DEFAULT 'annuel',
      school_year      TEXT,
      currency         TEXT DEFAULT 'DA',
      is_active        INTEGER DEFAULT 1,
      notes            TEXT,
      sort_order       INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TarifRemise (
      id               TEXT PRIMARY KEY,
      label            TEXT NOT NULL,
      condition_type   TEXT NOT NULL DEFAULT 'fratrie',
      condition_value  TEXT,
      discount_mode    TEXT NOT NULL DEFAULT 'pourcentage',
      discount_value   REAL NOT NULL DEFAULT 0,
      applies_to       TEXT DEFAULT 'all',
      school_year      TEXT,
      is_active        INTEGER DEFAULT 1,
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TarifZone (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      code       TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active  INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_tarif_type    ON TarifConfig(fee_type)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_tarif_year    ON TarifConfig(school_year)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_remise_year   ON TarifRemise(school_year)`).catch(() => {});

  // Seed default zones if table is empty
  const zoneCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM TarifZone`);
  if (Number(zoneCount[0]?.cnt) === 0) {
    const defaults = [
      ['Zone 1 – Centre-ville', 'Z1'],
      ['Zone 2 – Nord',          'Z2'],
      ['Zone 3 – Sud',           'Z3'],
      ['Zone 4 – Est',           'Z4'],
      ['Zone 5 – Ouest',         'Z5'],
      ['Zone 6 – Périphérie',    'Z6'],
    ];
    for (let i = 0; i < defaults.length; i++) {
      const [label, code] = defaults[i];
      await prisma.$executeRawUnsafe(
        `INSERT INTO TarifZone(id,label,code,sort_order) VALUES(?,?,?,?)`,
        uid(), label, code, i
      );
    }
  }
}

let tablesReady = false;
router.use(async (req, res, next) => {
  if (!tablesReady) { await ensureTables(); tablesReady = true; }
  next();
});

// ── TarifConfig — CRUD ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year, fee_type, active } = req.query;
    let sql = 'SELECT * FROM TarifConfig WHERE 1=1';
    const p = [];
    if (school_year) { sql += ' AND school_year=?'; p.push(school_year); }
    if (fee_type)    { sql += ' AND fee_type=?';    p.push(fee_type); }
    if (active === '1') { sql += ' AND is_active=1'; }
    sql += ' ORDER BY fee_type, sort_order, niveau, transport_zone, label';
    const rows = await prisma.$queryRawUnsafe(sql, ...p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const prisma = getPrisma();
  try {
    const {
      fee_type, label, niveau, transport_zone, activite_name,
      amount, billing_period, school_year, currency, notes, sort_order,
    } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO TarifConfig(id,fee_type,label,niveau,transport_zone,activite_name,amount,billing_period,school_year,currency,notes,sort_order)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, fee_type, label,
      niveau || null, transport_zone || null, activite_name || null,
      Number(amount) || 0, billing_period || 'annuel',
      school_year || null, currency || 'DA',
      notes || null, sort_order || 0
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const {
      fee_type, label, niveau, transport_zone, activite_name,
      amount, billing_period, school_year, currency, notes, sort_order, is_active,
    } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE TarifConfig SET
        fee_type=?, label=?, niveau=?, transport_zone=?, activite_name=?,
        amount=?, billing_period=?, school_year=?, currency=?, notes=?,
        sort_order=?, is_active=?, updated_at=datetime('now')
       WHERE id=?`,
      fee_type, label,
      niveau || null, transport_zone || null, activite_name || null,
      Number(amount) || 0, billing_period || 'annuel',
      school_year || null, currency || 'DA',
      notes || null, sort_order || 0,
      is_active != null ? (is_active ? 1 : 0) : 1,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    // Soft delete by default
    const { hard } = req.query;
    if (hard === '1') {
      await prisma.$executeRawUnsafe(`DELETE FROM TarifConfig WHERE id=?`, req.params.id);
    } else {
      await prisma.$executeRawUnsafe(`UPDATE TarifConfig SET is_active=0, updated_at=datetime('now') WHERE id=?`, req.params.id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Summary KPIs ──────────────────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    const filter = school_year ? `WHERE school_year='${school_year.replace(/'/g,"''")}' AND is_active=1` : 'WHERE is_active=1';

    const byType = await prisma.$queryRawUnsafe(`
      SELECT fee_type, COUNT(*) as cnt, SUM(amount) as total
      FROM TarifConfig ${filter}
      GROUP BY fee_type
    `);

    const remiseCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM TarifRemise WHERE is_active=1
      ${school_year ? `AND school_year='${school_year.replace(/'/g,"''")}' OR school_year IS NULL` : ''}
    `);

    const transportZones = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT transport_zone) as cnt FROM TarifConfig
      WHERE fee_type='transport' AND is_active=1
      ${school_year ? `AND school_year='${school_year.replace(/'/g,"''")}' ` : ''}
    `);

    res.json({
      by_type: byType.map(r => ({ ...r, cnt: Number(r.cnt), total: Number(r.total || 0) })),
      remise_count: Number(remiseCount[0]?.cnt || 0),
      transport_zones: Number(transportZones[0]?.cnt || 0),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Duplicate a school year's config to another year
router.post('/duplicate', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { from_year, to_year } = req.body;
    if (!from_year || !to_year) return res.status(400).json({ error: 'from_year and to_year required' });

    const source = await prisma.$queryRawUnsafe(`SELECT * FROM TarifConfig WHERE school_year=? AND is_active=1`, from_year);
    let count = 0;
    for (const r of source) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO TarifConfig(id,fee_type,label,niveau,transport_zone,activite_name,amount,billing_period,school_year,currency,notes,sort_order)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        uid(), r.fee_type, r.label, r.niveau, r.transport_zone, r.activite_name,
        r.amount, r.billing_period, to_year, r.currency, r.notes, r.sort_order
      );
      count++;
    }

    // Duplicate remises too
    const remises = await prisma.$queryRawUnsafe(`SELECT * FROM TarifRemise WHERE school_year=? AND is_active=1`, from_year);
    for (const r of remises) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO TarifRemise(id,label,condition_type,condition_value,discount_mode,discount_value,applies_to,school_year,notes)
         VALUES(?,?,?,?,?,?,?,?,?)`,
        uid(), r.label, r.condition_type, r.condition_value,
        r.discount_mode, r.discount_value, r.applies_to, to_year, r.notes
      );
    }

    res.json({ ok: true, count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TarifRemise — CRUD ────────────────────────────────────────────────────────

router.get('/remises', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    let sql = `SELECT * FROM TarifRemise WHERE is_active=1`;
    const p = [];
    if (school_year) { sql += ` AND (school_year=? OR school_year IS NULL)`; p.push(school_year); }
    sql += ' ORDER BY condition_type, label';
    const rows = await prisma.$queryRawUnsafe(sql, ...p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/remises', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { label, condition_type, condition_value, discount_mode, discount_value, applies_to, school_year, notes } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO TarifRemise(id,label,condition_type,condition_value,discount_mode,discount_value,applies_to,school_year,notes)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      id, label, condition_type || 'fratrie', condition_value || null,
      discount_mode || 'pourcentage', Number(discount_value) || 0,
      applies_to || 'all', school_year || null, notes || null
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/remises/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { label, condition_type, condition_value, discount_mode, discount_value, applies_to, school_year, notes, is_active } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE TarifRemise SET label=?,condition_type=?,condition_value=?,discount_mode=?,discount_value=?,applies_to=?,school_year=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?`,
      label, condition_type || 'fratrie', condition_value || null,
      discount_mode || 'pourcentage', Number(discount_value) || 0,
      applies_to || 'all', school_year || null, notes || null,
      is_active != null ? (is_active ? 1 : 0) : 1,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/remises/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`UPDATE TarifRemise SET is_active=0 WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TarifZone — CRUD ─────────────────────────────────────────────────────────

router.get('/zones', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM TarifZone WHERE is_active=1 ORDER BY sort_order, label`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/zones', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { label, code, sort_order } = req.body;
    if (!label) return res.status(400).json({ error: 'label requis' });
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO TarifZone(id,label,code,sort_order) VALUES(?,?,?,?)`,
      id, label, code || null, sort_order || 0
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/zones/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { label, code, sort_order } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE TarifZone SET label=?,code=?,sort_order=? WHERE id=?`,
      label, code || null, sort_order || 0, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/zones/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`UPDATE TarifZone SET is_active=0 WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
