/**
 * /api/rh — Module Ressources Humaines
 *
 * Tables : EmployeeContract, LeaveRequest, WorkTimeEntry, Payslip
 * Synchronisation avec Schedule et AbsenceImpact à l'approbation des congés.
 */
const { Router } = require('express');
const { getPrisma } = require('../db');
const crypto = require('crypto');

const router = Router();

// ── Création des tables ──────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS EmployeeContract (
      id            TEXT PRIMARY KEY,
      employee_id   TEXT NOT NULL,
      employee_type TEXT NOT NULL DEFAULT 'teacher',
      contract_type TEXT NOT NULL DEFAULT 'cdi',
      hourly_rate   REAL NOT NULL DEFAULT 0,
      monthly_base  REAL NOT NULL DEFAULT 0,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      position      TEXT,
      department    TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      notes         TEXT,
      created_date  TEXT NOT NULL,
      updated_date  TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS LeaveRequest (
      id             TEXT PRIMARY KEY,
      employee_id    TEXT NOT NULL,
      employee_type  TEXT NOT NULL DEFAULT 'teacher',
      leave_type     TEXT NOT NULL DEFAULT 'conge_annuel',
      start_date     TEXT NOT NULL,
      end_date       TEXT NOT NULL,
      days_count     INTEGER NOT NULL DEFAULT 1,
      reason         TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      requested_by   TEXT,
      approved_by    TEXT,
      approved_at    TEXT,
      rejection_note TEXT,
      affects_schedule INTEGER NOT NULL DEFAULT 1,
      created_date   TEXT NOT NULL,
      updated_date   TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS WorkTimeEntry (
      id            TEXT PRIMARY KEY,
      employee_id   TEXT NOT NULL,
      employee_type TEXT NOT NULL DEFAULT 'teacher',
      entry_type    TEXT NOT NULL,
      date          TEXT NOT NULL,
      hours         REAL NOT NULL DEFAULT 0,
      source        TEXT,
      source_id     TEXT,
      note          TEXT,
      created_by    TEXT,
      created_date  TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Payslip (
      id              TEXT PRIMARY KEY,
      employee_id     TEXT NOT NULL,
      employee_type   TEXT NOT NULL DEFAULT 'teacher',
      contract_id     TEXT NOT NULL,
      period_month    TEXT NOT NULL,
      scheduled_hours REAL NOT NULL DEFAULT 0,
      absent_hours    REAL NOT NULL DEFAULT 0,
      overtime_hours  REAL NOT NULL DEFAULT 0,
      effective_hours REAL NOT NULL DEFAULT 0,
      hourly_rate     REAL NOT NULL DEFAULT 0,
      monthly_base    REAL NOT NULL DEFAULT 0,
      gross_salary    REAL NOT NULL DEFAULT 0,
      deductions      REAL NOT NULL DEFAULT 0,
      net_salary      REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'draft',
      notes           TEXT,
      generated_by    TEXT,
      generated_at    TEXT,
      validated_by    TEXT,
      validated_at    TEXT,
      created_date    TEXT NOT NULL,
      updated_date    TEXT NOT NULL
    )`);

  // Index de performance
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_contract_employee ON EmployeeContract(employee_id, employee_type)`,
    `CREATE INDEX IF NOT EXISTS idx_leave_employee    ON LeaveRequest(employee_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_leave_dates       ON LeaveRequest(start_date, end_date)`,
    `CREATE INDEX IF NOT EXISTS idx_worktime_employee ON WorkTimeEntry(employee_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_payslip_period    ON Payslip(period_month, status)`,
  ];
  for (const sql of indexes) {
    try { await prisma.$executeRawUnsafe(sql); } catch {}
  }
}

ensureTables().catch(console.error);

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }
function uid()  { return crypto.randomUUID(); }

function dateRange(startStr, endStr) {
  const dates = [];
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function toDayOfWeek(dateStr) {
  const jsDay = new Date(dateStr + 'T12:00:00').getDay();
  if (jsDay === 0) return null;
  return jsDay - 1; // Mon=0 … Sat=5
}

function countWorkDays(startStr, endStr) {
  return dateRange(startStr, endStr).filter(d => toDayOfWeek(d) !== null).length;
}

// ════════════════════════════════════════════════════════════════════════════
// CONTRATS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/rh/contracts
router.get('/contracts', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type, status } = req.query;
    let sql = `SELECT * FROM EmployeeContract WHERE 1=1`;
    const params = [];
    if (employee_id)   { sql += ` AND employee_id=?`;   params.push(employee_id); }
    if (employee_type) { sql += ` AND employee_type=?`;  params.push(employee_type); }
    if (status)        { sql += ` AND status=?`;         params.push(status); }
    sql += ` ORDER BY created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rh/contracts/stats
router.get('/contracts/stats', async (req, res) => {
  try {
    const prisma = getPrisma();
    const today = new Date().toISOString().split('T')[0];
    const in60  = new Date(Date.now() + 60 * 864e5).toISOString().split('T')[0];
    const [total]    = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active'`);
    const [cdi]      = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active' AND contract_type='cdi'`);
    const [cdd]      = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active' AND contract_type='cdd'`);
    const [vac]      = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active' AND contract_type='vacataire'`);
    const [expiring] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active' AND end_date IS NOT NULL AND end_date<=? AND end_date>=?`, in60, today);
    res.json({
      total:    Number(total.n),
      cdi:      Number(cdi.n),
      cdd:      Number(cdd.n),
      vacataire:Number(vac.n),
      expiring: Number(expiring.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rh/contracts
router.post('/contracts', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type = 'teacher', contract_type = 'cdi',
            hourly_rate = 0, monthly_base = 0, start_date, end_date,
            position, department, notes } = req.body;
    if (!employee_id || !start_date) return res.status(400).json({ error: 'employee_id et start_date requis' });
    const id = uid(); const t = now();
    await prisma.$executeRawUnsafe(
      `INSERT INTO EmployeeContract (id,employee_id,employee_type,contract_type,hourly_rate,monthly_base,start_date,end_date,position,department,status,notes,created_date,updated_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,'active',?,?,?)`,
      id, employee_id, employee_type, contract_type, hourly_rate, monthly_base,
      start_date, end_date || null, position || null, department || null, notes || null, t, t
    );
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/contracts/:id
router.put('/contracts/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { contract_type, hourly_rate, monthly_base, start_date, end_date,
            position, department, status, notes } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE EmployeeContract SET contract_type=?,hourly_rate=?,monthly_base=?,start_date=?,end_date=?,position=?,department=?,status=?,notes=?,updated_date=? WHERE id=?`,
      contract_type, hourly_rate, monthly_base, start_date, end_date || null,
      position || null, department || null, status, notes || null, now(), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rh/contracts/:id
router.delete('/contracts/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM EmployeeContract WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// CONGÉS & ABSENCES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/rh/leaves
router.get('/leaves', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type, status, from, to } = req.query;
    let sql = `SELECT * FROM LeaveRequest WHERE 1=1`;
    const params = [];
    if (employee_id)   { sql += ` AND employee_id=?`;   params.push(employee_id); }
    if (employee_type) { sql += ` AND employee_type=?`;  params.push(employee_type); }
    if (status)        { sql += ` AND status=?`;         params.push(status); }
    if (from)          { sql += ` AND end_date>=?`;      params.push(from); }
    if (to)            { sql += ` AND start_date<=?`;    params.push(to); }
    sql += ` ORDER BY created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rh/leaves/stats
router.get('/leaves/stats', async (req, res) => {
  try {
    const prisma = getPrisma();
    const month = new Date().toISOString().slice(0, 7);
    const [pending]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM LeaveRequest WHERE status='pending'`);
    const [approved] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM LeaveRequest WHERE status='approved' AND substr(start_date,1,7)=?`, month);
    const [days]     = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(days_count),0) as n FROM LeaveRequest WHERE status='approved' AND substr(start_date,1,7)=?`, month);
    res.json({
      pending:       Number(pending.n),
      approvedMonth: Number(approved.n),
      daysThisMonth: Number(days.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rh/leaves
router.post('/leaves', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type = 'teacher', leave_type = 'conge_annuel',
            start_date, end_date, reason, requested_by, affects_schedule = true } = req.body;
    if (!employee_id || !start_date || !end_date) return res.status(400).json({ error: 'Champs obligatoires manquants' });
    const days_count = countWorkDays(start_date, end_date);
    const id = uid(); const t = now();
    await prisma.$executeRawUnsafe(
      `INSERT INTO LeaveRequest (id,employee_id,employee_type,leave_type,start_date,end_date,days_count,reason,status,requested_by,affects_schedule,created_date,updated_date)
       VALUES (?,?,?,?,?,?,?,?,'pending',?,?,?,?)`,
      id, employee_id, employee_type, leave_type, start_date, end_date,
      days_count, reason || null, requested_by || null,
      affects_schedule ? 1 : 0, t, t
    );
    res.json({ id, days_count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/leaves/:id/approve  — approuve et synchronise l'emploi du temps
router.put('/leaves/:id/approve', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { approved_by } = req.body;
    const t = now();

    const [leave] = await prisma.$queryRawUnsafe(`SELECT * FROM LeaveRequest WHERE id=?`, req.params.id);
    if (!leave) return res.status(404).json({ error: 'Congé introuvable' });

    await prisma.$executeRawUnsafe(
      `UPDATE LeaveRequest SET status='approved',approved_by=?,approved_at=?,updated_date=? WHERE id=?`,
      approved_by || null, t, t, req.params.id
    );

    // Synchronisation emploi du temps (enseignants uniquement)
    let impactCount = 0;
    if (leave.employee_type === 'teacher' && Number(leave.affects_schedule) === 1) {
      let schedules = [];
      try { schedules = await prisma.schedule.findMany({ where: { teacher_id: leave.employee_id } }); } catch {}

      const dates = dateRange(leave.start_date, leave.end_date);
      for (const dateStr of dates) {
        const dow = toDayOfWeek(dateStr);
        if (dow === null) continue;
        const matching = schedules.filter(s => Number(s.day_of_week) === dow);
        for (const s of matching) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO AbsenceImpact (id,absence_id,schedule_id,teacher_id,class_id,subject_id,affected_date,day_of_week,time_start,time_end,room,action,created_date)
             VALUES (?,?,?,?,?,?,?,?,?,?,'conge (RH)','cancelled',?)`,
            uid(), req.params.id, s.id, leave.employee_id,
            s.class_id || null, s.subject_id || null,
            dateStr, dow, s.start_time || null, s.end_time || null,
            s.room_id || s.room || null, t
          ).catch(() => {});
          impactCount++;
        }
      }
    }

    res.json({ ok: true, impactCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/leaves/:id/reject
router.put('/leaves/:id/reject', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { rejection_note, approved_by } = req.body;
    await prisma.$executeRawUnsafe(
      `UPDATE LeaveRequest SET status='rejected',rejection_note=?,approved_by=?,updated_date=? WHERE id=?`,
      rejection_note || null, approved_by || null, now(), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/leaves/:id/cancel
router.put('/leaves/:id/cancel', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(
      `UPDATE LeaveRequest SET status='cancelled',updated_date=? WHERE id=? AND status='pending'`,
      now(), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// TEMPS DE TRAVAIL
// ════════════════════════════════════════════════════════════════════════════

// GET /api/rh/worktime
router.get('/worktime', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, month } = req.query; // month = YYYY-MM
    let sql = `SELECT * FROM WorkTimeEntry WHERE 1=1`;
    const params = [];
    if (employee_id) { sql += ` AND employee_id=?`; params.push(employee_id); }
    if (month)       { sql += ` AND substr(date,1,7)=?`; params.push(month); }
    sql += ` ORDER BY date ASC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rh/worktime/summary/:employee_id
router.get('/worktime/summary/:employee_id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { month } = req.query;
    const eid = req.params.employee_id;
    const mFilter = month ? ` AND substr(date,1,7)='${month}'` : '';
    const [sched] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE employee_id=? AND entry_type='scheduled'${mFilter}`, eid);
    const [abs]   = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE employee_id=? AND entry_type='absent'${mFilter}`, eid);
    const [over]  = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE employee_id=? AND entry_type='overtime'${mFilter}`, eid);
    const scheduled = Number(sched.h); const absent = Number(abs.h); const overtime = Number(over.h);
    res.json({ scheduled, absent, overtime, effective: scheduled - absent + overtime });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rh/worktime — saisie manuelle (heures supp, récupération)
router.post('/worktime', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type = 'teacher', entry_type, date, hours, note, created_by } = req.body;
    if (!employee_id || !entry_type || !date || hours == null) return res.status(400).json({ error: 'Champs obligatoires manquants' });
    const id = uid(); const t = now();
    await prisma.$executeRawUnsafe(
      `INSERT INTO WorkTimeEntry (id,employee_id,employee_type,entry_type,date,hours,source,note,created_by,created_date) VALUES (?,?,?,?,?,?,'manual',?,?,?)`,
      id, employee_id, employee_type, entry_type, date, hours, note || null, created_by || null, t
    );
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rh/worktime/sync-month — génère les entrées planifiées + absences à partir de l'EDT
router.post('/worktime/sync-month', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type = 'teacher', period_month } = req.body; // YYYY-MM
    if (!employee_id || !period_month) return res.status(400).json({ error: 'employee_id et period_month requis' });

    // Supprimer les entrées auto (scheduled + absent) existantes pour ce mois
    await prisma.$executeRawUnsafe(
      `DELETE FROM WorkTimeEntry WHERE employee_id=? AND substr(date,1,7)=? AND source != 'manual'`,
      employee_id, period_month
    );

    const [year, mon] = period_month.split('-').map(Number);
    const firstDay = new Date(year, mon - 1, 1);
    const lastDay  = new Date(year, mon, 0);
    const start = firstDay.toISOString().split('T')[0];
    const end   = lastDay.toISOString().split('T')[0];
    const dates = dateRange(start, end);

    // Récupérer schedules de l'employé
    let schedules = [];
    if (employee_type === 'teacher') {
      try { schedules = await prisma.schedule.findMany({ where: { teacher_id: employee_id } }); } catch {}
    }

    // Récupérer congés approuvés sur ce mois
    const leaves = await prisma.$queryRawUnsafe(
      `SELECT * FROM LeaveRequest WHERE employee_id=? AND status='approved' AND start_date<=? AND end_date>=?`,
      employee_id, end, start
    );
    const absentDates = new Set();
    for (const l of leaves) {
      for (const d of dateRange(l.start_date, l.end_date)) { absentDates.add(d); }
    }

    let scheduledCount = 0; let absentCount = 0;
    const t = now();

    for (const dateStr of dates) {
      const dow = toDayOfWeek(dateStr);
      if (dow === null) continue;
      const daySchedules = schedules.filter(s => Number(s.day_of_week) === dow);
      for (const s of daySchedules) {
        // Calculer durée du créneau en heures
        let hours = 1;
        if (s.start_time && s.end_time) {
          const [sh, sm] = s.start_time.split(':').map(Number);
          const [eh, em] = s.end_time.split(':').map(Number);
          hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
        }
        if (absentDates.has(dateStr)) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO WorkTimeEntry (id,employee_id,employee_type,entry_type,date,hours,source,source_id,created_date) VALUES (?,?,?,'absent',?,?,'leave',?,?)`,
            uid(), employee_id, employee_type, dateStr, hours, null, t
          );
          absentCount++;
        } else {
          await prisma.$executeRawUnsafe(
            `INSERT INTO WorkTimeEntry (id,employee_id,employee_type,entry_type,date,hours,source,source_id,created_date) VALUES (?,?,?,'scheduled',?,?,'schedule',?,?)`,
            uid(), employee_id, employee_type, dateStr, hours, s.id, t
          );
          scheduledCount++;
        }
      }
    }

    res.json({ ok: true, scheduled: scheduledCount, absent: absentCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rh/worktime/:id
router.delete('/worktime/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM WorkTimeEntry WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// PAIE
// ════════════════════════════════════════════════════════════════════════════

// GET /api/rh/payslips
router.get('/payslips', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { period_month, status, employee_id } = req.query;
    let sql = `SELECT * FROM Payslip WHERE 1=1`;
    const params = [];
    if (period_month) { sql += ` AND period_month=?`; params.push(period_month); }
    if (status)       { sql += ` AND status=?`;       params.push(status); }
    if (employee_id)  { sql += ` AND employee_id=?`;  params.push(employee_id); }
    sql += ` ORDER BY created_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rh/payslips/kpi
router.get('/payslips/kpi', async (req, res) => {
  try {
    const prisma = getPrisma();
    const month = new Date().toISOString().slice(0, 7);
    const [masse]  = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(net_salary),0) as s FROM Payslip WHERE period_month=? AND status IN ('validated','paid')`, month);
    const [draft]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM Payslip WHERE period_month=? AND status='draft'`, month);
    const [validated] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM Payslip WHERE period_month=? AND status='validated'`, month);
    const [paid]   = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM Payslip WHERE period_month=? AND status='paid'`, month);
    res.json({
      masse_salariale: Number(masse.s),
      draft:     Number(draft.n),
      validated: Number(validated.n),
      paid:      Number(paid.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rh/payslips/generate — génère ou recalcule la fiche de paie d'un employé
router.post('/payslips/generate', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { employee_id, employee_type = 'teacher', period_month, generated_by } = req.body;
    if (!employee_id || !period_month) return res.status(400).json({ error: 'employee_id et period_month requis' });

    // Trouver le contrat actif
    const [contract] = await prisma.$queryRawUnsafe(
      `SELECT * FROM EmployeeContract WHERE employee_id=? AND employee_type=? AND status='active' ORDER BY start_date DESC LIMIT 1`,
      employee_id, employee_type
    );
    if (!contract) return res.status(400).json({ error: 'Aucun contrat actif pour cet employé' });

    // Synchroniser les heures du mois
    const [year, mon] = period_month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).toISOString().split('T')[0];
    const firstDay = `${period_month}-01`;
    let schedules = [];
    if (employee_type === 'teacher') {
      try { schedules = await prisma.schedule.findMany({ where: { teacher_id: employee_id } }); } catch {}
    }
    const leaves = await prisma.$queryRawUnsafe(
      `SELECT * FROM LeaveRequest WHERE employee_id=? AND status='approved' AND start_date<=? AND end_date>=?`,
      employee_id, lastDay, firstDay
    );
    const absentDates = new Set();
    for (const l of leaves) { for (const d of dateRange(l.start_date, l.end_date)) absentDates.add(d); }

    const dates = dateRange(firstDay, lastDay);
    let scheduled_hours = 0; let absent_hours = 0;
    for (const dateStr of dates) {
      const dow = toDayOfWeek(dateStr);
      if (dow === null) continue;
      const daySchedules = schedules.filter(s => Number(s.day_of_week) === dow);
      for (const s of daySchedules) {
        let h = 1;
        if (s.start_time && s.end_time) {
          const [sh, sm] = s.start_time.split(':').map(Number);
          const [eh, em] = s.end_time.split(':').map(Number);
          h = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
        }
        if (absentDates.has(dateStr)) absent_hours += h;
        else scheduled_hours += h;
      }
    }

    // Heures supplémentaires saisies manuellement
    const [over] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE employee_id=? AND entry_type='overtime' AND substr(date,1,7)=?`,
      employee_id, period_month
    );
    const overtime_hours  = Number(over.h);
    const effective_hours = Math.max(0, scheduled_hours - absent_hours + overtime_hours);
    const hourly_rate     = Number(contract.hourly_rate);
    const monthly_base    = Number(contract.monthly_base);
    const gross_salary    = effective_hours * hourly_rate + monthly_base;
    const deductions      = 0;
    const net_salary      = gross_salary - deductions;
    const t = now();

    // Upsert : si brouillon existant, on le recalcule
    const [existing] = await prisma.$queryRawUnsafe(
      `SELECT id FROM Payslip WHERE employee_id=? AND period_month=? AND status='draft'`,
      employee_id, period_month
    );
    if (existing) {
      await prisma.$executeRawUnsafe(
        `UPDATE Payslip SET scheduled_hours=?,absent_hours=?,overtime_hours=?,effective_hours=?,hourly_rate=?,monthly_base=?,gross_salary=?,deductions=?,net_salary=?,generated_by=?,generated_at=?,updated_date=? WHERE id=?`,
        scheduled_hours, absent_hours, overtime_hours, effective_hours,
        hourly_rate, monthly_base, gross_salary, deductions, net_salary,
        generated_by || null, t, t, existing.id
      );
      return res.json({ id: existing.id, recalculated: true, scheduled_hours, absent_hours, overtime_hours, effective_hours, gross_salary, net_salary });
    }

    const id = uid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO Payslip (id,employee_id,employee_type,contract_id,period_month,scheduled_hours,absent_hours,overtime_hours,effective_hours,hourly_rate,monthly_base,gross_salary,deductions,net_salary,status,generated_by,generated_at,created_date,updated_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?)`,
      id, employee_id, employee_type, contract.id, period_month,
      scheduled_hours, absent_hours, overtime_hours, effective_hours,
      hourly_rate, monthly_base, gross_salary, deductions, net_salary,
      generated_by || null, t, t, t
    );
    res.json({ id, scheduled_hours, absent_hours, overtime_hours, effective_hours, gross_salary, net_salary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/payslips/:id/validate
router.put('/payslips/:id/validate', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { validated_by } = req.body;
    const t = now();
    await prisma.$executeRawUnsafe(
      `UPDATE Payslip SET status='validated',validated_by=?,validated_at=?,updated_date=? WHERE id=?`,
      validated_by || null, t, t, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rh/payslips/:id/mark-paid
router.put('/payslips/:id/mark-paid', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(
      `UPDATE Payslip SET status='paid',updated_date=? WHERE id=?`, now(), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rh/payslips/:id (brouillon uniquement)
router.delete('/payslips/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM Payslip WHERE id=? AND status='draft'`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD KPI
// ════════════════════════════════════════════════════════════════════════════

// GET /api/rh/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const prisma = getPrisma();
    const month = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().split('T')[0];
    const in60  = new Date(Date.now() + 60 * 864e5).toISOString().split('T')[0];

    const [pending]    = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM LeaveRequest WHERE status='pending'`);
    const [daysAbs]    = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(days_count),0) as n FROM LeaveRequest WHERE status='approved' AND substr(start_date,1,7)=?`, month);
    const [masse]      = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(net_salary),0) as s FROM Payslip WHERE period_month=? AND status IN ('validated','paid')`, month);
    const [overtime]   = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE entry_type='overtime' AND substr(date,1,7)=?`, month);
    const [schedHours] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(hours),0) as h FROM WorkTimeEntry WHERE entry_type='scheduled' AND substr(date,1,7)=?`, month);
    const [expiring]   = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active' AND end_date IS NOT NULL AND end_date<=? AND end_date>=?`, in60, today);
    const [totalContr] = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM EmployeeContract WHERE status='active'`);

    const scheduledH = Number(schedHours.h);
    const absentH    = Number(daysAbs.n) * 6; // estimation 6h/jour si pas de détail
    const absentRate = scheduledH > 0 ? Math.round((absentH / scheduledH) * 100) : 0;

    res.json({
      pending_leaves:    Number(pending.n),
      absent_days_month: Number(daysAbs.n),
      masse_salariale:   Number(masse.s),
      overtime_hours:    Number(overtime.h),
      absenteeism_rate:  absentRate,
      expiring_contracts:Number(expiring.n),
      total_contracts:   Number(totalContr.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
