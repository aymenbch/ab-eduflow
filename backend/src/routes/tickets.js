const { Router } = require('express');
const crypto = require('crypto');
const { getPrisma } = require('../db');
const { loadUser, requireAuth } = require('../authUtils');

const router = Router();

// ── Create table on startup ────────────────────────────────────────────────────
async function ensureTable() {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Ticket (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      type             TEXT NOT NULL,
      description      TEXT DEFAULT '',
      priority         TEXT DEFAULT 'normale',
      status           TEXT DEFAULT 'nouveau',
      requester_id     TEXT DEFAULT '',
      requester_name   TEXT DEFAULT '',
      requester_role   TEXT DEFAULT '',
      assigned_to_id   TEXT DEFAULT '',
      assigned_to_name TEXT DEFAULT '',
      assigned_to_role TEXT DEFAULT '',
      comments         TEXT DEFAULT '[]',
      resolution_note  TEXT DEFAULT '',
      created_date     TEXT DEFAULT (datetime('now')),
      updated_date     TEXT DEFAULT (datetime('now'))
    )
  `);
}
ensureTable().catch(e => console.error('[tickets] ensureTable error:', e.message));

// ── Auth middleware ────────────────────────────────────────────────────────────
router.use(loadUser, requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTicket(t) {
  if (!t) return null;
  return {
    ...t,
    comments: (() => { try { return JSON.parse(t.comments || '[]'); } catch { return []; } })(),
  };
}

// ── GET / — list all tickets ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM Ticket ORDER BY
        CASE status WHEN 'nouveau' THEN 0 WHEN 'en_cours' THEN 1 WHEN 'résolu' THEN 2 ELSE 3 END,
        CASE priority WHEN 'urgente' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END,
        created_date DESC`
    );
    res.json(rows.map(parseTicket));
  } catch (e) {
    console.error('[tickets GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST / — create ticket ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = crypto.randomUUID();
    const {
      title, type, description = '', priority = 'normale',
      requester_id = '', requester_name = '', requester_role = '',
      assigned_to_id = '', assigned_to_name = '', assigned_to_role = '',
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!type?.trim())  return res.status(400).json({ error: 'type is required' });

    await prisma.$executeRawUnsafe(
      `INSERT INTO Ticket
        (id, title, type, description, priority, status,
         requester_id, requester_name, requester_role,
         assigned_to_id, assigned_to_name, assigned_to_role,
         comments, resolution_note, created_date, updated_date)
       VALUES (?,?,?,?,?,'nouveau',?,?,?,?,?,?,'[]','',datetime('now'),datetime('now'))`,
      id, title.trim(), type, description, priority,
      requester_id, requester_name, requester_role,
      assigned_to_id, assigned_to_name, assigned_to_role
    );

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Ticket WHERE id = ?`, id);
    res.json(parseTicket(rows[0]));
  } catch (e) {
    console.error('[tickets POST /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /:id — update ticket ──────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const allowed = ['status', 'resolution_note', 'assigned_to_id', 'assigned_to_name',
                     'assigned_to_role', 'priority', 'title', 'description'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`updated_date = datetime('now')`);
    params.push(id);
    await prisma.$executeRawUnsafe(
      `UPDATE Ticket SET ${fields.join(', ')} WHERE id = ?`, ...params
    );
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Ticket WHERE id = ?`, id);
    res.json(parseTicket(rows[0]));
  } catch (e) {
    console.error('[tickets PUT /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /:id/comment — add comment ──────────────────────────────────────────
router.post('/:id/comment', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const { author, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Ticket WHERE id = ?`, id);
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found' });

    const comments = JSON.parse(rows[0].comments || '[]');
    comments.push({ id: crypto.randomUUID(), author, text: text.trim(), date: new Date().toISOString() });

    await prisma.$executeRawUnsafe(
      `UPDATE Ticket SET comments = ?, updated_date = datetime('now') WHERE id = ?`,
      JSON.stringify(comments), id
    );
    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM Ticket WHERE id = ?`, id);
    res.json(parseTicket(updated[0]));
  } catch (e) {
    console.error('[tickets POST /:id/comment]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /:id — delete ticket ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM Ticket WHERE id = ?`, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[tickets DELETE /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
