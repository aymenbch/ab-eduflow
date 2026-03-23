/**
 * /api/finv2 — Module Finance & Scolarité
 *
 * Tables : FinFeeStructure, FinInvoice, FinInvoiceItem, FinPaymentPlan, FinTransaction
 * Logique : balance = total_amount - discount - SUM(transactions)
 *           status  = paid | partial | overdue | unpaid
 */
const { Router } = require('express');
const { getPrisma } = require('../db');
const crypto = require('crypto');

const router = Router();
const uid = () => crypto.randomUUID();

// ── Table creation ────────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FinFeeStructure (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      fee_type    TEXT NOT NULL DEFAULT 'scolarite',
      amount      REAL NOT NULL DEFAULT 0,
      frequency   TEXT NOT NULL DEFAULT 'annual',
      school_year TEXT NOT NULL,
      description TEXT,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FinInvoice (
      id              TEXT PRIMARY KEY,
      student_id      TEXT NOT NULL,
      school_year     TEXT NOT NULL,
      label           TEXT,
      total_amount    REAL NOT NULL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_reason TEXT,
      notes           TEXT,
      status          TEXT DEFAULT 'unpaid',
      created_at      TEXT DEFAULT (datetime('now')),
      created_by      TEXT
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FinInvoiceItem (
      id                TEXT PRIMARY KEY,
      invoice_id        TEXT NOT NULL,
      fee_structure_id  TEXT,
      label             TEXT NOT NULL,
      amount            REAL NOT NULL DEFAULT 0,
      quantity          INTEGER DEFAULT 1
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FinPaymentPlan (
      id              TEXT PRIMARY KEY,
      invoice_id      TEXT NOT NULL,
      tranche_number  INTEGER NOT NULL,
      due_date        TEXT NOT NULL,
      amount_due      REAL NOT NULL DEFAULT 0,
      status          TEXT DEFAULT 'pending',
      paid_at         TEXT
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FinTransaction (
      id              TEXT PRIMARY KEY,
      invoice_id      TEXT NOT NULL,
      amount          REAL NOT NULL DEFAULT 0,
      payment_date    TEXT NOT NULL,
      payment_method  TEXT DEFAULT 'cash',
      reference       TEXT,
      notes           TEXT,
      recorded_by     TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )`);

  // Indexes
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fin_invoice_student ON FinInvoice(student_id)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fin_invoice_year ON FinInvoice(school_year)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fin_tx_invoice ON FinTransaction(invoice_id)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fin_item_invoice ON FinInvoiceItem(invoice_id)`).catch(() => {});
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fin_plan_invoice ON FinPaymentPlan(invoice_id)`).catch(() => {});
}

let tablesReady = false;
router.use(async (req, res, next) => {
  if (!tablesReady) { await ensureTables(); tablesReady = true; }
  next();
});

// ── Helper: enrich invoices with balance + computed status ───────────────────
async function enrichInvoices(prisma, invoices) {
  if (!invoices.length) return [];
  const ids = invoices.map(i => `'${i.id.replace(/'/g, "''")}'`).join(',');

  const txSums = await prisma.$queryRawUnsafe(
    `SELECT invoice_id, COALESCE(SUM(amount),0) AS paid FROM FinTransaction WHERE invoice_id IN (${ids}) GROUP BY invoice_id`
  );
  const paidMap = Object.fromEntries(txSums.map(t => [t.invoice_id, Number(t.paid || 0)]));

  const today = new Date().toISOString().split('T')[0];
  const overduePlans = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT invoice_id FROM FinPaymentPlan WHERE invoice_id IN (${ids}) AND due_date < ? AND status = 'pending'`,
    today
  );
  const overdueSet = new Set(overduePlans.map(p => p.invoice_id));

  return invoices.map(inv => {
    const total    = Number(inv.total_amount || 0);
    const discount = Number(inv.discount_amount || 0);
    const net      = Math.max(0, total - discount);
    const paid     = paidMap[inv.id] || 0;
    const balance  = Math.max(0, net - paid);

    let status;
    if (balance === 0 && net > 0)                    status = 'paid';
    else if (paid > 0 && balance > 0)                status = 'partial';
    else if (balance > 0 && overdueSet.has(inv.id))  status = 'overdue';
    else                                              status = 'unpaid';

    return { ...inv, paid_amount: paid, balance, net_amount: net, status };
  });
}

// ── FeeStructures ─────────────────────────────────────────────────────────────

router.get('/fee-structures', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    let sql = 'SELECT * FROM FinFeeStructure WHERE is_active = 1';
    const params = [];
    if (school_year) { sql += ' AND school_year = ?'; params.push(school_year); }
    sql += ' ORDER BY fee_type, name';
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fee-structures', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { name, fee_type, amount, frequency, school_year, description } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO FinFeeStructure(id,name,fee_type,amount,frequency,school_year,description) VALUES(?,?,?,?,?,?,?)`,
      id, name, fee_type || 'scolarite', Number(amount) || 0, frequency || 'annual', school_year, description || null
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/fee-structures/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { name, fee_type, amount, frequency, school_year, description, is_active } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE FinFeeStructure SET name=?,fee_type=?,amount=?,frequency=?,school_year=?,description=?,is_active=? WHERE id=?`,
      name, fee_type, Number(amount) || 0, frequency, school_year, description || null,
      is_active !== false ? 1 : 0, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/fee-structures/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM FinFeeStructure WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Invoices ──────────────────────────────────────────────────────────────────

router.get('/invoices', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year, student_id, status } = req.query;
    let sql = 'SELECT * FROM FinInvoice WHERE 1=1';
    const params = [];
    if (school_year)  { sql += ' AND school_year = ?'; params.push(school_year); }
    if (student_id)   { sql += ' AND student_id = ?';  params.push(student_id); }
    sql += ' ORDER BY created_at DESC';
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const enriched = await enrichInvoices(prisma, rows);
    res.json(status ? enriched.filter(i => i.status === status) : enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/invoices/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM FinInvoice WHERE id=?`, req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [inv] = await enrichInvoices(prisma, rows);
    const items        = await prisma.$queryRawUnsafe(`SELECT * FROM FinInvoiceItem WHERE invoice_id=?`, req.params.id);
    const payment_plan = await prisma.$queryRawUnsafe(`SELECT * FROM FinPaymentPlan WHERE invoice_id=? ORDER BY tranche_number`, req.params.id);
    const transactions = await prisma.$queryRawUnsafe(`SELECT * FROM FinTransaction WHERE invoice_id=? ORDER BY payment_date DESC`, req.params.id);
    res.json({ ...inv, items, payment_plan, transactions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/invoices', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { student_id, school_year, label, items = [], discount_amount, discount_reason, notes, created_by, payment_plan = [] } = req.body;
    const total = items.reduce((s, it) => s + (Number(it.amount) || 0) * (Number(it.quantity) || 1), 0);
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO FinInvoice(id,student_id,school_year,label,total_amount,discount_amount,discount_reason,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)`,
      id, student_id, school_year, label || null, total, Number(discount_amount) || 0, discount_reason || null, notes || null, created_by || null
    );
    for (const it of items) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO FinInvoiceItem(id,invoice_id,fee_structure_id,label,amount,quantity) VALUES(?,?,?,?,?,?)`,
        uid(), id, it.fee_structure_id || null, it.label, Number(it.amount) || 0, Number(it.quantity) || 1
      );
    }
    for (const p of payment_plan) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO FinPaymentPlan(id,invoice_id,tranche_number,due_date,amount_due) VALUES(?,?,?,?,?)`,
        uid(), id, Number(p.tranche_number) || 1, p.due_date, Number(p.amount_due) || 0
      );
    }
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/invoices/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { label, discount_amount, discount_reason, notes } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE FinInvoice SET label=?,discount_amount=?,discount_reason=?,notes=? WHERE id=?`,
      label || null, Number(discount_amount) || 0, discount_reason || null, notes || null, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/invoices/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM FinTransaction  WHERE invoice_id=?`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM FinPaymentPlan  WHERE invoice_id=?`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM FinInvoiceItem  WHERE invoice_id=?`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM FinInvoice       WHERE id=?`,         req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk generation: one invoice per student based on active fee structures
router.post('/invoices/generate-bulk', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year, student_ids = [], fee_structure_ids, created_by } = req.body;

    let fsSql = 'SELECT * FROM FinFeeStructure WHERE is_active=1 AND school_year=?';
    const fsParams = [school_year];
    if (fee_structure_ids?.length) {
      fsSql += ` AND id IN (${fee_structure_ids.map(() => '?').join(',')})`;
      fsParams.push(...fee_structure_ids);
    }
    const feeStructures = await prisma.$queryRawUnsafe(fsSql, ...fsParams);

    if (!feeStructures.length) {
      return res.json({ created: 0, skipped: 0, message: 'Aucun frais actif pour cette année scolaire.' });
    }

    let created = 0, skipped = 0;
    for (const sid of student_ids) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM FinInvoice WHERE student_id=? AND school_year=?`, sid, school_year
      );
      if (existing.length) { skipped++; continue; }

      const items = feeStructures.map(fs => ({ fee_structure_id: fs.id, label: fs.name, amount: Number(fs.amount), quantity: 1 }));
      const total = items.reduce((s, it) => s + it.amount, 0);
      const id = uid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO FinInvoice(id,student_id,school_year,label,total_amount,created_by) VALUES(?,?,?,?,?,?)`,
        id, sid, school_year, `Scolarité ${school_year}`, total, created_by || null
      );
      for (const it of items) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO FinInvoiceItem(id,invoice_id,fee_structure_id,label,amount,quantity) VALUES(?,?,?,?,?,?)`,
          uid(), id, it.fee_structure_id, it.label, it.amount, 1
        );
      }
      created++;
    }
    res.json({ created, skipped, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transactions ──────────────────────────────────────────────────────────────

router.post('/transactions', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { invoice_id, amount, payment_date, payment_method, reference, notes, recorded_by } = req.body;
    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO FinTransaction(id,invoice_id,amount,payment_date,payment_method,reference,notes,recorded_by) VALUES(?,?,?,?,?,?,?,?)`,
      id, invoice_id, Number(amount) || 0, payment_date, payment_method || 'cash',
      reference || null, notes || null, recorded_by || null
    );
    // Update invoice status
    const invRows = await prisma.$queryRawUnsafe(`SELECT * FROM FinInvoice WHERE id=?`, invoice_id);
    if (invRows.length) {
      const [enriched] = await enrichInvoices(prisma, invRows);
      await prisma.$executeRawUnsafe(`UPDATE FinInvoice SET status=? WHERE id=?`, enriched.status, invoice_id);
    }
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/transactions/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const txRows = await prisma.$queryRawUnsafe(`SELECT invoice_id FROM FinTransaction WHERE id=?`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM FinTransaction WHERE id=?`, req.params.id);
    if (txRows.length) {
      const invRows = await prisma.$queryRawUnsafe(`SELECT * FROM FinInvoice WHERE id=?`, txRows[0].invoice_id);
      if (invRows.length) {
        const [enriched] = await enrichInvoices(prisma, invRows);
        await prisma.$executeRawUnsafe(`UPDATE FinInvoice SET status=? WHERE id=?`, enriched.status, txRows[0].invoice_id);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Payment Plans ─────────────────────────────────────────────────────────────

router.post('/payment-plans', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { invoice_id, tranches = [] } = req.body;
    await prisma.$executeRawUnsafe(`DELETE FROM FinPaymentPlan WHERE invoice_id=?`, invoice_id);
    for (const t of tranches) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO FinPaymentPlan(id,invoice_id,tranche_number,due_date,amount_due) VALUES(?,?,?,?,?)`,
        uid(), invoice_id, Number(t.tranche_number) || 1, t.due_date, Number(t.amount_due) || 0
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Student view (for parent portal) ─────────────────────────────────────────

router.get('/student/:student_id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    let sql = `SELECT * FROM FinInvoice WHERE student_id=?`;
    const params = [req.params.student_id];
    if (school_year) { sql += ' AND school_year=?'; params.push(school_year); }
    sql += ' ORDER BY created_at DESC';
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const enriched = await enrichInvoices(prisma, rows);

    const result = [];
    for (const inv of enriched) {
      const [items, payment_plan, transactions] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT * FROM FinInvoiceItem WHERE invoice_id=?`, inv.id),
        prisma.$queryRawUnsafe(`SELECT * FROM FinPaymentPlan WHERE invoice_id=? ORDER BY tranche_number`, inv.id),
        prisma.$queryRawUnsafe(`SELECT * FROM FinTransaction WHERE invoice_id=? ORDER BY payment_date DESC`, inv.id),
      ]);
      result.push({ ...inv, items, payment_plan, transactions });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { school_year } = req.query;
    const filter = school_year ? `WHERE school_year='${school_year.replace(/'/g, "''")}'` : '';

    const totals = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount),0) as total_gross,
        COALESCE(SUM(discount_amount),0) as total_discounts
      FROM FinInvoice ${filter}`
    );

    const invoices = await prisma.$queryRawUnsafe(`SELECT * FROM FinInvoice ${filter}`);
    const enriched = await enrichInvoices(prisma, invoices);

    const totalCollected = enriched.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const totalBalance   = enriched.reduce((s, i) => s + (i.balance    || 0), 0);
    const totalNet       = enriched.reduce((s, i) => s + (i.net_amount  || 0), 0);
    const byStatus       = enriched.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});
    const collectionRate = totalNet > 0 ? +((totalCollected / totalNet) * 100).toFixed(1) : 0;

    // This month collections
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthTx = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(amount),0) as total FROM FinTransaction WHERE payment_date LIKE ?`, `${thisMonth}%`
    );

    res.json({
      total_invoices: Number(totals[0]?.total_invoices || 0),
      total_expected: totalNet,
      total_collected: totalCollected,
      total_balance: totalBalance,
      collection_rate: collectionRate,
      month_collected: Number(monthTx[0]?.total || 0),
      by_status: byStatus,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
