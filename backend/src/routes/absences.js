/**
 * /api/absences — Gestion des absences d'enseignants
 *
 * Tables customs SQLite : TeacherAbsence, AbsenceImpact
 * Utilise prisma.schedule + prisma.scheduleEvent (entités base44)
 */
const { Router } = require('express');
const { getPrisma } = require('../db');

const router = Router();

// ── Auto-create tables ─────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TeacherAbsence (
      id               TEXT PRIMARY KEY,
      teacher_id       TEXT NOT NULL,
      start_date       TEXT NOT NULL,
      end_date         TEXT NOT NULL,
      reason           TEXT,
      declared_by      TEXT,
      declared_by_role TEXT,
      status           TEXT NOT NULL DEFAULT 'active',
      notify_email     INTEGER NOT NULL DEFAULT 0,
      notify_sms       INTEGER NOT NULL DEFAULT 0,
      notify_sent      INTEGER NOT NULL DEFAULT 0,
      created_date     TEXT NOT NULL,
      updated_date     TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AbsenceImpact (
      id                   TEXT PRIMARY KEY,
      absence_id           TEXT NOT NULL,
      schedule_id          TEXT NOT NULL,
      schedule_event_id    TEXT,
      teacher_id           TEXT NOT NULL,
      class_id             TEXT,
      subject_id           TEXT,
      affected_date        TEXT NOT NULL,
      day_of_week          INTEGER,
      time_start           TEXT,
      time_end             TEXT,
      room                 TEXT,
      action               TEXT NOT NULL DEFAULT 'cancelled',
      replacement_date     TEXT,
      replacement_time     TEXT,
      replacement_room     TEXT,
      replacement_note     TEXT,
      created_date         TEXT NOT NULL
    )`);
}

ensureTables().catch(console.error);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Enumerate dates between start_date and end_date (inclusive), YYYY-MM-DD strings */
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

/**
 * Map a YYYY-MM-DD date to Schedule day_of_week index:
 *   0 = Lundi, 1 = Mardi, 2 = Mercredi, 3 = Jeudi, 4 = Vendredi, 5 = Samedi
 * Returns null for Sunday (no classes).
 */
function toDayOfWeek(dateStr) {
  const jsDay = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun, 1=Mon...6=Sat
  if (jsDay === 0) return null; // Sunday — not in schedule
  return jsDay - 1; // Mon=0, Tue=1, ..., Sat=5
}

// ── GET /api/absences ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { teacher_id, status, from, to } = req.query;
    let sql = `SELECT * FROM TeacherAbsence WHERE 1=1`;
    const params = [];
    if (teacher_id) { sql += ` AND teacher_id=?`;  params.push(teacher_id); }
    if (status)     { sql += ` AND status=?`;       params.push(status); }
    if (from)       { sql += ` AND end_date>=?`;    params.push(from); }
    if (to)         { sql += ` AND start_date<=?`;  params.push(to); }
    sql += ` ORDER BY start_date DESC`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/absences/stats ────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const prisma = getPrisma();
    const today = new Date().toISOString().split('T')[0];
    const [active]   = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM TeacherAbsence WHERE status='active'`);
    const [today_]   = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM TeacherAbsence WHERE status='active' AND start_date<=? AND end_date>=?`, today, today);
    const [impacts]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM AbsenceImpact ai JOIN TeacherAbsence ta ON ta.id=ai.absence_id WHERE ta.status='active'`);
    const [reschdl]  = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM AbsenceImpact ai JOIN TeacherAbsence ta ON ta.id=ai.absence_id WHERE ta.status='active' AND ai.action='rescheduled'`);
    res.json({
      active:       Number(active.n),
      todayAbsent:  Number(today_.n),
      impacted:     Number(impacts.n),
      rescheduled:  Number(reschdl.n),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/absences/:id/impacts ─────────────────────────────────────────────
router.get('/:id/impacts', async (req, res) => {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM AbsenceImpact WHERE absence_id=? ORDER BY affected_date ASC, time_start ASC`,
      req.params.id
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/absences — créer une absence + auto-générer les impacts ──────────
router.post('/', async (req, res) => {
  try {
    const prisma = getPrisma();
    const {
      teacher_id, start_date, end_date, reason,
      declared_by, declared_by_role,
      notify_email = false, notify_sms = false,
    } = req.body;

    if (!teacher_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'teacher_id, start_date et end_date sont requis' });
    }
    if (start_date > end_date) {
      return res.status(400).json({ error: 'La date de début doit être avant la date de fin' });
    }

    const now = new Date().toISOString();
    const absenceId = require('crypto').randomUUID();

    // 1. Create TeacherAbsence
    await prisma.$executeRawUnsafe(
      `INSERT INTO TeacherAbsence
         (id,teacher_id,start_date,end_date,reason,declared_by,declared_by_role,status,notify_email,notify_sms,notify_sent,created_date,updated_date)
       VALUES (?,?,?,?,?,?,?,'active',?,?,0,?,?)`,
      absenceId, teacher_id, start_date, end_date, reason || null,
      declared_by || null, declared_by_role || null,
      notify_email ? 1 : 0, notify_sms ? 1 : 0, now, now
    );

    // 2. Fetch all schedule entries for this teacher
    let schedules = [];
    try {
      schedules = await prisma.schedule.findMany({ where: { teacher_id } });
    } catch {
      // If Prisma model name differs, ignore — frontend will handle it
    }

    // 3. Compute impacted sessions
    const dates = dateRange(start_date, end_date);
    const impacts = [];

    for (const dateStr of dates) {
      const dow = toDayOfWeek(dateStr);
      if (dow === null) continue; // skip Sunday

      const matching = schedules.filter(s => Number(s.day_of_week) === dow);
      for (const s of matching) {
        const impactId = require('crypto').randomUUID();
        impacts.push({
          id: impactId,
          absence_id: absenceId,
          schedule_id: s.id,
          teacher_id,
          class_id: s.class_id || null,
          subject_id: s.subject_id || null,
          affected_date: dateStr,
          day_of_week: dow,
          time_start: s.start_time || null,
          time_end: s.end_time || null,
          room: s.room_id || s.room || null,
        });
      }
    }

    // 4. Bulk-insert AbsenceImpact records
    for (const imp of impacts) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO AbsenceImpact
           (id,absence_id,schedule_id,teacher_id,class_id,subject_id,affected_date,day_of_week,time_start,time_end,room,action,created_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'cancelled',?)`,
        imp.id, imp.absence_id, imp.schedule_id,
        imp.teacher_id, imp.class_id, imp.subject_id,
        imp.affected_date, imp.day_of_week, imp.time_start, imp.time_end,
        imp.room, now
      );
    }

    // 5. Auto-create ScheduleEvent entries (prof_absent) via Prisma
    for (const imp of impacts) {
      try {
        const evt = await prisma.scheduleEvent.create({
          data: {
            schedule_id:  imp.schedule_id,
            class_id:     imp.class_id,
            subject_id:   imp.subject_id,
            teacher_id:   imp.teacher_id,
            day_of_week:  imp.day_of_week,
            start_time:   imp.time_start,
            end_time:     imp.time_end,
            event_type:   'prof_absent',
            event_date:   imp.affected_date,
            description:  reason ? `Absence enseignant : ${reason}` : 'Absence enseignant',
            declared_by:  declared_by_role || 'admin',
            status:       'active',
          },
        });
        // Store the schedule_event_id in AbsenceImpact
        await prisma.$executeRawUnsafe(
          `UPDATE AbsenceImpact SET schedule_event_id=? WHERE id=?`,
          evt.id, imp.id
        );
      } catch {
        // ScheduleEvent creation failed — not blocking
      }
    }

    // Return created absence + impacts count
    const [absence] = await prisma.$queryRawUnsafe(`SELECT * FROM TeacherAbsence WHERE id=?`, absenceId);
    res.json({ ...absence, impacts_count: impacts.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/absences/:id — modifier/annuler ───────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { status, reason, notify_email, notify_sms, notify_sent } = req.body;
    const fields = []; const params = [];

    if (status       !== undefined) { fields.push('status=?');       params.push(status); }
    if (reason       !== undefined) { fields.push('reason=?');       params.push(reason); }
    if (notify_email !== undefined) { fields.push('notify_email=?'); params.push(notify_email ? 1 : 0); }
    if (notify_sms   !== undefined) { fields.push('notify_sms=?');   params.push(notify_sms ? 1 : 0); }
    if (notify_sent  !== undefined) { fields.push('notify_sent=?');  params.push(notify_sent ? 1 : 0); }
    fields.push('updated_date=?'); params.push(new Date().toISOString());
    if (!fields.length) return res.status(400).json({ error: 'Aucun champ à modifier' });
    params.push(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE TeacherAbsence SET ${fields.join(',')} WHERE id=?`, ...params);

    // If cancelled → also deactivate all linked ScheduleEvents
    if (status === 'cancelled') {
      const impacts = await prisma.$queryRawUnsafe(
        `SELECT schedule_event_id FROM AbsenceImpact WHERE absence_id=?`, req.params.id
      );
      for (const imp of impacts) {
        if (imp.schedule_event_id) {
          try {
            await prisma.scheduleEvent.update({
              where: { id: imp.schedule_event_id },
              data: { status: 'cancelled' },
            });
          } catch {}
        }
      }
    }

    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM TeacherAbsence WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/absences/impacts/:id — reporter un cours ─────────────────────────
router.put('/impacts/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const {
      action, replacement_date, replacement_time, replacement_room, replacement_note
    } = req.body;

    await prisma.$executeRawUnsafe(
      `UPDATE AbsenceImpact
         SET action=?, replacement_date=?, replacement_time=?, replacement_room=?, replacement_note=?
       WHERE id=?`,
      action || 'rescheduled',
      replacement_date || null, replacement_time || null,
      replacement_room || null, replacement_note || null,
      req.params.id
    );

    // Sync the linked ScheduleEvent: change type to cours_reporte + add replacement info
    const [imp] = await prisma.$queryRawUnsafe(`SELECT * FROM AbsenceImpact WHERE id=?`, req.params.id);
    if (imp?.schedule_event_id) {
      try {
        const updateData = { event_type: 'cours_reporte' };
        if (replacement_date) updateData.replacement_date = replacement_date;
        if (replacement_time) updateData.replacement_time = replacement_time;
        if (replacement_room) updateData.replacement_room = replacement_room;
        if (replacement_note) updateData.description = replacement_note;
        await prisma.scheduleEvent.update({
          where: { id: imp.schedule_event_id },
          data: updateData,
        });
      } catch {}
    }

    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM AbsenceImpact WHERE id=?`, req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/absences/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    // Deactivate linked ScheduleEvents first
    const impacts = await prisma.$queryRawUnsafe(
      `SELECT schedule_event_id FROM AbsenceImpact WHERE absence_id=?`, req.params.id
    );
    for (const imp of impacts) {
      if (imp.schedule_event_id) {
        try {
          await prisma.scheduleEvent.update({
            where: { id: imp.schedule_event_id },
            data: { status: 'cancelled' },
          });
        } catch {}
      }
    }
    await prisma.$executeRawUnsafe(`DELETE FROM AbsenceImpact WHERE absence_id=?`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM TeacherAbsence WHERE id=?`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
