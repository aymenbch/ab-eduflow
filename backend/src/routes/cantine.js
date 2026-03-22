/**
 * /api/cantine — Module Cantine Scolaire
 * Tables auto-créées : CantineMenu, CantineInscription, CantineReservation, CantineSuggestion
 */
const { Router } = require('express');
const { getPrisma } = require('../db');

const router = Router();

// ── Auto-create tables ─────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CantineMenu (
      id           TEXT PRIMARY KEY,
      date         TEXT NOT NULL,
      meal_period  TEXT NOT NULL DEFAULT 'midi',
      starter      TEXT,
      main_course  TEXT NOT NULL,
      garnish      TEXT,
      dessert      TEXT,
      dessert2     TEXT,
      notes        TEXT,
      published    INTEGER NOT NULL DEFAULT 0,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CantineInscription (
      id           TEXT PRIMARY KEY,
      student_id   TEXT NOT NULL,
      regime       TEXT NOT NULL DEFAULT 'complet',
      days_json    TEXT NOT NULL DEFAULT '["lundi","mardi","mercredi","jeudi","vendredi"]',
      start_date   TEXT,
      end_date     TEXT,
      notes        TEXT,
      active       INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CantineReservation (
      id           TEXT PRIMARY KEY,
      student_id   TEXT NOT NULL,
      menu_date    TEXT NOT NULL,
      meal_period  TEXT NOT NULL DEFAULT 'midi',
      status       TEXT NOT NULL DEFAULT 'pending',
      parent_note  TEXT,
      admin_note   TEXT,
      requested_by TEXT,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CantineSuggestion (
      id           TEXT PRIMARY KEY,
      student_id   TEXT NOT NULL,
      student_name TEXT,
      dish_name    TEXT NOT NULL,
      dish_type    TEXT NOT NULL DEFAULT 'plat',
      description  TEXT,
      votes        INTEGER NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'pending',
      admin_note   TEXT,
      created_date TEXT NOT NULL
    )`);
}

ensureTables().catch(console.error);

// ── Menus ─────────────────────────────────────────────────────────────────────

// GET /api/cantine/menus?from=YYYY-MM-DD&to=YYYY-MM-DD&published=1
router.get('/menus', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { from, to, published } = req.query;
    let sql = `SELECT * FROM CantineMenu WHERE 1=1`;
    const params = [];
    if (from)             { sql += ` AND date >= ?`;      params.push(from); }
    if (to)               { sql += ` AND date <= ?`;      params.push(to); }
    if (published !== undefined) { sql += ` AND published = ?`; params.push(published === '1' ? 1 : 0); }
    sql += ` ORDER BY date ASC, meal_period ASC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cantine/menus
router.post('/menus', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { date, meal_period = 'midi', starter, main_course, garnish, dessert, dessert2, notes, published = 0 } = req.body;
    if (!date || !main_course) return res.status(400).json({ error: 'date et plat principal requis' });
    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO CantineMenu (id,date,meal_period,starter,main_course,garnish,dessert,dessert2,notes,published,created_date,updated_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, date, meal_period, starter||null, main_course, garnish||null, dessert||null, dessert2||null, notes||null, published?1:0, now, now
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineMenu WHERE id=?`, id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cantine/menus/:id
router.put('/menus/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { starter, main_course, garnish, dessert, dessert2, notes, published } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE CantineMenu SET starter=?,main_course=?,garnish=?,dessert=?,dessert2=?,notes=?,published=?,updated_date=? WHERE id=?`,
      starter||null, main_course, garnish||null, dessert||null, dessert2||null, notes||null, published?1:0, now, req.params.id
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineMenu WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cantine/menus/:id
router.delete('/menus/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM CantineMenu WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Inscriptions ─────────────────────────────────────────────────────────────

// GET /api/cantine/inscriptions?active=1
router.get('/inscriptions', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { active } = req.query;
    let sql = `SELECT * FROM CantineInscription WHERE 1=1`;
    const params = [];
    if (active !== undefined) { sql += ` AND active=?`; params.push(active === '1' ? 1 : 0); }
    sql += ` ORDER BY created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cantine/inscriptions
router.post('/inscriptions', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { student_id, regime = 'complet', days_json, start_date, end_date, notes } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id requis' });
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM CantineInscription WHERE student_id=? AND active=1`, student_id
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Cet élève est déjà inscrit à la cantine' });
    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();
    const daysStr = days_json
      ? (typeof days_json === 'string' ? days_json : JSON.stringify(days_json))
      : JSON.stringify(['lundi','mardi','mercredi','jeudi','vendredi']);
    await prisma.$executeRawUnsafe(
      `INSERT INTO CantineInscription (id,student_id,regime,days_json,start_date,end_date,notes,active,created_date)
       VALUES (?,?,?,?,?,?,?,1,?)`,
      id, student_id, regime, daysStr, start_date||null, end_date||null, notes||null, now
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineInscription WHERE id=?`, id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cantine/inscriptions/:id
router.put('/inscriptions/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { regime, days_json, start_date, end_date, notes, active } = req.body;
    const fields = []; const params = [];
    if (regime     !== undefined) { fields.push('regime=?');     params.push(regime); }
    if (days_json  !== undefined) { fields.push('days_json=?');  params.push(typeof days_json === 'string' ? days_json : JSON.stringify(days_json)); }
    if (start_date !== undefined) { fields.push('start_date=?'); params.push(start_date||null); }
    if (end_date   !== undefined) { fields.push('end_date=?');   params.push(end_date||null); }
    if (notes      !== undefined) { fields.push('notes=?');      params.push(notes||null); }
    if (active     !== undefined) { fields.push('active=?');     params.push(active?1:0); }
    if (!fields.length) return res.status(400).json({ error: 'Aucun champ à modifier' });
    params.push(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE CantineInscription SET ${fields.join(',')} WHERE id=?`, ...params);
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineInscription WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cantine/inscriptions/:id (soft delete)
router.delete('/inscriptions/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`UPDATE CantineInscription SET active=0 WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reservations ─────────────────────────────────────────────────────────────

// GET /api/cantine/reservations?student_id=&status=&from=&to=
router.get('/reservations', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { student_id, status, from, to } = req.query;
    let sql = `SELECT * FROM CantineReservation WHERE 1=1`;
    const params = [];
    if (student_id) { sql += ` AND student_id=?`; params.push(student_id); }
    if (status)     { sql += ` AND status=?`;     params.push(status); }
    if (from)       { sql += ` AND menu_date>=?`; params.push(from); }
    if (to)         { sql += ` AND menu_date<=?`; params.push(to); }
    sql += ` ORDER BY menu_date ASC, created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cantine/reservations — 48h advance required
router.post('/reservations', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { student_id, menu_date, meal_period = 'midi', parent_note, requested_by } = req.body;
    if (!student_id || !menu_date) return res.status(400).json({ error: 'student_id et menu_date requis' });

    // 48h advance check
    const reservDate = new Date(menu_date + 'T00:00:00');
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + 48);
    if (reservDate < minDate) {
      return res.status(400).json({ error: 'La réservation doit être faite au minimum 48h à l\'avance' });
    }

    // Duplicate check
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM CantineReservation WHERE student_id=? AND menu_date=? AND meal_period=? AND status!='cancelled'`,
      student_id, menu_date, meal_period
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Une réservation existe déjà pour cette date' });

    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO CantineReservation (id,student_id,menu_date,meal_period,status,parent_note,requested_by,created_date,updated_date)
       VALUES (?,?,?,?,'pending',?,?,?,?)`,
      id, student_id, menu_date, meal_period, parent_note||null, requested_by||null, now, now
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineReservation WHERE id=?`, id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cantine/reservations/:id (approve / reject / cancel)
router.put('/reservations/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { status, admin_note } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE CantineReservation SET status=?,admin_note=?,updated_date=? WHERE id=?`,
      status, admin_note||null, now, req.params.id
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineReservation WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Suggestions ───────────────────────────────────────────────────────────────

// GET /api/cantine/suggestions?status=pending
router.get('/suggestions', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    let sql = `SELECT * FROM CantineSuggestion WHERE 1=1`;
    const params = [];
    if (status) { sql += ` AND status=?`; params.push(status); }
    sql += ` ORDER BY votes DESC, created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cantine/suggestions
router.post('/suggestions', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { student_id, student_name, dish_name, dish_type = 'plat', description } = req.body;
    if (!student_id || !dish_name) return res.status(400).json({ error: 'student_id et dish_name requis' });
    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO CantineSuggestion (id,student_id,student_name,dish_name,dish_type,description,votes,status,created_date)
       VALUES (?,?,?,?,?,?,0,'pending',?)`,
      id, student_id, student_name||null, dish_name, dish_type, description||null, now
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineSuggestion WHERE id=?`, id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cantine/suggestions/:id/vote
router.post('/suggestions/:id/vote', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`UPDATE CantineSuggestion SET votes=votes+1 WHERE id=?`, req.params.id);
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineSuggestion WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cantine/suggestions/:id (admin status update)
router.put('/suggestions/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { status, admin_note } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE CantineSuggestion SET status=?,admin_note=? WHERE id=?`,
      status, admin_note||null, req.params.id
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM CantineSuggestion WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cantine/suggestions/:id
router.delete('/suggestions/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM CantineSuggestion WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const prisma = getPrisma();
    const today = new Date().toISOString().split('T')[0];
    const [ins]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM CantineInscription WHERE active=1`);
    const [pend] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM CantineReservation WHERE status='pending'`);
    const [todR] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM CantineReservation WHERE menu_date=? AND status='approved'`, today);
    const [sug]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM CantineSuggestion WHERE status='pending'`);
    res.json({
      inscriptions:       Number(ins.n),
      pendingReservations: Number(pend.n),
      todayMeals:          Number(todR.n),
      pendingSuggestions:  Number(sug.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
