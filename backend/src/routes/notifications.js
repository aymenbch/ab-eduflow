/**
 * /api/notifications — Service de notifications SMS & Email
 * Tables auto-créées au démarrage (SQLite via Prisma raw)
 */
const { Router } = require('express');
const { getPrisma } = require('../db');

const router = Router();

// ── Auto-create tables ────────────────────────────────────────────────────────
async function ensureTables() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS NotifConfig (
      id           TEXT PRIMARY KEY,
      channel      TEXT NOT NULL UNIQUE,
      enabled      INTEGER NOT NULL DEFAULT 0,
      provider     TEXT NOT NULL DEFAULT 'smtp',
      config       TEXT NOT NULL DEFAULT '{}',
      updated_date TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS NotifRule (
      id                     TEXT PRIMARY KEY,
      event_type             TEXT NOT NULL UNIQUE,
      label                  TEXT NOT NULL,
      email_enabled          INTEGER NOT NULL DEFAULT 0,
      sms_enabled            INTEGER NOT NULL DEFAULT 0,
      email_subject_tpl      TEXT NOT NULL DEFAULT '',
      email_body_tpl         TEXT NOT NULL DEFAULT '',
      sms_tpl                TEXT NOT NULL DEFAULT '',
      updated_date           TEXT NOT NULL
    )`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS NotifLog (
      id                TEXT PRIMARY KEY,
      channel           TEXT NOT NULL,
      event_type        TEXT,
      recipient_name    TEXT,
      recipient_contact TEXT,
      student_name      TEXT,
      message_preview   TEXT,
      status            TEXT NOT NULL,
      error_msg         TEXT,
      sent_date         TEXT NOT NULL
    )`);

  // Seed default rules if empty
  const rows = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM NotifRule`);
  if (rows[0].n === 0) {
    const now = new Date().toISOString();
    const defaults = [
      {
        id: 'rule_absence', event_type: 'absence', label: 'Absence élève',
        email_subject_tpl: 'Absence de {{student_name}} – {{date}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nNous vous informons que votre enfant {{student_name}} a été marqué(e) {{status}} le {{date}} en classe {{class_name}}.\n\nCordialement,\nL'administration`,
        sms_tpl: `Bonjour {{parent_name}}, votre enfant {{student_name}} est {{status}} aujourd'hui ({{date}}) - {{class_name}}.`,
      },
      {
        id: 'rule_sanction', event_type: 'sanction', label: 'Sanction disciplinaire',
        email_subject_tpl: 'Sanction disciplinaire – {{student_name}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nUne sanction de type « {{sanction_type}} » a été prononcée pour votre enfant {{student_name}}.\nMotif : {{reason}}\nDate : {{date}}\n\nCordialement,\nL'administration`,
        sms_tpl: `Sanction pour {{student_name}} : {{sanction_type}}. Motif: {{reason}}. Contactez l'école pour plus d'infos.`,
      },
      {
        id: 'rule_payment', event_type: 'payment_overdue', label: 'Retard de paiement',
        email_subject_tpl: 'Rappel de paiement – {{label}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nNous vous rappelons qu'un paiement de {{amount}} DZD pour « {{label}} » concernant {{student_name}} est en retard depuis le {{due_date}}.\n\nMerci de vous rapprocher de l'administration.\n\nCordialement`,
        sms_tpl: `Rappel: paiement de {{amount}} DZD ({{label}}) pour {{student_name}} est en retard. Contactez l'administration.`,
      },
      {
        id: 'rule_bulletin', event_type: 'bulletin', label: 'Bulletin disponible',
        email_subject_tpl: 'Bulletin scolaire disponible – {{student_name}} – {{period}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nLe bulletin scolaire de {{student_name}} pour la période {{period}} est disponible.\nMoyenne générale : {{average}}/20\n\nVeuillez vous connecter à l'application ou contacter l'établissement.\n\nCordialement`,
        sms_tpl: `Bulletin de {{student_name}} ({{period}}) disponible. Moyenne: {{average}}/20. Connectez-vous à l'application.`,
      },
      {
        id: 'rule_note', event_type: 'note', label: 'Résultat d\'examen',
        email_subject_tpl: 'Note publiée – {{subject}} – {{student_name}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nLa note de {{student_name}} pour l'examen « {{exam_name}} » en {{subject}} vient d'être publiée.\nNote obtenue : {{score}}/{{max_score}}\n\nCordialement`,
        sms_tpl: `Note de {{student_name}} en {{subject}}: {{score}}/{{max_score}} ({{exam_name}}).`,
      },
      {
        id: 'rule_event', event_type: 'event', label: 'Événement scolaire',
        email_subject_tpl: 'Événement : {{event_title}}',
        email_body_tpl: `Bonjour {{parent_name}},\n\nNous vous informons d'un événement : {{event_title}}\nDate : {{event_date}}\nDescription : {{event_description}}\n\nCordialement`,
        sms_tpl: `Événement scolaire: {{event_title}} le {{event_date}}.`,
      },
    ];
    for (const r of defaults) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO NotifRule (id, event_type, label, email_enabled, sms_enabled, email_subject_tpl, email_body_tpl, sms_tpl, updated_date)
         VALUES (?,?,?,0,0,?,?,?,?)`,
        r.id, r.event_type, r.label,
        r.email_subject_tpl, r.email_body_tpl, r.sms_tpl, now
      );
    }
  }

  // Seed default configs if empty
  const cfgRows = await prisma.$queryRawUnsafe(`SELECT count(*) as n FROM NotifConfig`);
  if (cfgRows[0].n === 0) {
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO NotifConfig (id, channel, enabled, provider, config, updated_date) VALUES (?,?,0,?,?,?)`,
      'cfg_email', 'email', 'smtp',
      JSON.stringify({ host: '', port: 587, secure: false, user: '', pass: '', from_name: 'EduGest', from_email: '' }),
      now
    );
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO NotifConfig (id, channel, enabled, provider, config, updated_date) VALUES (?,?,0,?,?,?)`,
      'cfg_sms', 'sms', 'twilio',
      JSON.stringify({ account_sid: '', auth_token: '', from_number: '', api_url: '', api_key: '', sender_id: '' }),
      now
    );
  }
}
ensureTables().catch(err => console.error('[notifications] ensureTables error:', err));

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderTemplate(tpl, vars) {
  return Object.entries(vars).reduce((str, [k, v]) =>
    str.replaceAll(`{{${k}}}`, v ?? ''), tpl);
}

async function sendEmail(config, to, subject, body) {
  try {
    const nodemailer = require('nodemailer');
    let transporterConfig;
    if (config.provider === 'gmail') {
      transporterConfig = {
        service: 'gmail',
        auth: { user: config.user, pass: config.pass },
      };
    } else {
      transporterConfig = {
        host: config.host,
        port: parseInt(config.port) || 587,
        secure: !!config.secure,
        auth: { user: config.user, pass: config.pass },
      };
    }
    const transporter = nodemailer.createTransport(transporterConfig);
    await transporter.sendMail({
      from: `"${config.from_name || 'EduGest'}" <${config.from_email || config.user}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendSMS(config, to, message) {
  try {
    if (config.provider === 'twilio') {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: config.from_number, Body: message }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.message };
      return { success: true };
    } else if (config.provider === 'infobip') {
      const res = await fetch(`https://api.infobip.com/sms/2/text/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': `App ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ from: config.sender_id, destinations: [{ to }], text: message }]
        }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: JSON.stringify(data) };
      return { success: true };
    } else if (config.provider === 'custom') {
      // Generic HTTP POST with {to, message} body
      const res = await fetch(config.api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.api_key}` },
        body: JSON.stringify({ to, from: config.sender_id, message }),
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true };
    }
    return { success: false, error: 'Fournisseur SMS non reconnu' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/notifications/settings — get email & SMS config
router.get('/settings', async (req, res) => {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM NotifConfig`);
    const settings = {};
    for (const r of rows) {
      settings[r.channel] = { ...r, config: JSON.parse(r.config || '{}') };
    }
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/settings/:channel — update channel config
router.put('/settings/:channel', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { channel } = req.params;
    const { enabled, provider, config } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE NotifConfig SET enabled=?, provider=?, config=?, updated_date=? WHERE channel=?`,
      enabled ? 1 : 0, provider, JSON.stringify(config || {}), now, channel
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM NotifConfig WHERE channel=?`, channel);
    res.json({ ...row, config: JSON.parse(row.config || '{}') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notifications/rules — get all notification rules
router.get('/rules', async (req, res) => {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM NotifRule ORDER BY event_type`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/rules/:id — update a rule
router.put('/rules/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const { email_enabled, sms_enabled, email_subject_tpl, email_body_tpl, sms_tpl } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE NotifRule SET email_enabled=?, sms_enabled=?, email_subject_tpl=?, email_body_tpl=?, sms_tpl=?, updated_date=? WHERE id=?`,
      email_enabled ? 1 : 0, sms_enabled ? 1 : 0,
      email_subject_tpl || '', email_body_tpl || '', sms_tpl || '', now, id
    );
    const [row] = await prisma.$queryRawUnsafe(`SELECT * FROM NotifRule WHERE id=?`, id);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications/send — send notification(s)
router.post('/send', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { event_type, recipients, variables } = req.body;
    // recipients: [{name, email, phone, student_name}]
    // variables: {student_name, date, ...}

    if (!event_type || !recipients?.length) {
      return res.status(400).json({ error: 'event_type and recipients are required' });
    }

    const [rule] = await prisma.$queryRawUnsafe(`SELECT * FROM NotifRule WHERE event_type=?`, event_type);
    if (!rule) return res.status(404).json({ error: 'Règle de notification introuvable' });

    const cfgRows = await prisma.$queryRawUnsafe(`SELECT * FROM NotifConfig`);
    const cfgMap = {};
    for (const c of cfgRows) cfgMap[c.channel] = { ...c, config: JSON.parse(c.config || '{}') };

    const results = [];
    for (const recip of recipients) {
      const vars = { ...variables, parent_name: recip.name, ...recip.extra_vars };

      // ─ Email ─
      if (rule.email_enabled && cfgMap.email?.enabled && recip.email) {
        const subject = renderTemplate(rule.email_subject_tpl, vars);
        const body    = renderTemplate(rule.email_body_tpl,    vars);
        const result  = await sendEmail(cfgMap.email.config, recip.email, subject, body);
        const logId   = require('crypto').randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO NotifLog (id, channel, event_type, recipient_name, recipient_contact, student_name, message_preview, status, error_msg, sent_date)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          logId, 'email', event_type, recip.name, recip.email, recip.student_name || '',
          subject, result.success ? 'sent' : 'failed', result.error || null, new Date().toISOString()
        );
        results.push({ channel: 'email', recipient: recip.email, ...result });
      }

      // ─ SMS ─
      if (rule.sms_enabled && cfgMap.sms?.enabled && recip.phone) {
        const message = renderTemplate(rule.sms_tpl, vars);
        const result  = await sendSMS(cfgMap.sms.config, recip.phone, message);
        const logId   = require('crypto').randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO NotifLog (id, channel, event_type, recipient_name, recipient_contact, student_name, message_preview, status, error_msg, sent_date)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          logId, 'sms', event_type, recip.name, recip.phone, recip.student_name || '',
          message.slice(0, 100), result.success ? 'sent' : 'failed', result.error || null, new Date().toISOString()
        );
        results.push({ channel: 'sms', recipient: recip.phone, ...result });
      }

      // Simulation mode: if neither channel is enabled but called manually
      if (!rule.email_enabled && !rule.sms_enabled) {
        results.push({ channel: 'none', recipient: recip.name, success: false, error: 'Aucun canal activé pour cet événement' });
      }
    }

    res.json({ sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results });
  } catch (err) {
    console.error('[notifications] send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test — send a test notification
router.post('/test', async (req, res) => {
  try {
    const { channel, to } = req.body;
    if (!channel || !to) return res.status(400).json({ error: 'channel and to are required' });

    const prisma = getPrisma();
    const [cfg] = await prisma.$queryRawUnsafe(`SELECT * FROM NotifConfig WHERE channel=?`, channel);
    if (!cfg) return res.status(404).json({ error: 'Configuration introuvable' });

    const config = JSON.parse(cfg.config || '{}');
    let result;
    if (channel === 'email') {
      result = await sendEmail(config, to, 'Test EduGest – Notification Email', 'Ceci est un message de test envoyé depuis EduGest.\n\nSi vous recevez cet email, la configuration est correcte.');
    } else {
      result = await sendSMS(config, to, 'EduGest: Test SMS. Configuration correcte.');
    }

    // Log it
    const logId = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO NotifLog (id, channel, event_type, recipient_name, recipient_contact, student_name, message_preview, status, error_msg, sent_date) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      logId, channel, 'test', 'Test', to, '',
      `Test ${channel}`, result.success ? 'sent' : 'failed', result.error || null, new Date().toISOString()
    );

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notifications/log — get notification history
router.get('/log', async (req, res) => {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM NotifLog ORDER BY sent_date DESC LIMIT 200`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notifications/log — clear log
router.delete('/log', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(`DELETE FROM NotifLog`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
