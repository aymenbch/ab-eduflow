require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Run DB migrations for manually-added columns (outside Prisma schema)
async function runMigrations() {
  const { getPrisma } = require('./db');
  const prisma = getPrisma();

  // ── Colonnes ajoutées manuellement (hors schéma Prisma) ─────────────────
  const cols = [
    `ALTER TABLE Promotion ADD COLUMN average_grade REAL`,
    `ALTER TABLE Promotion ADD COLUMN decided_by TEXT`,
    `ALTER TABLE Promotion ADD COLUMN notes TEXT`,
    `ALTER TABLE SchoolYear ADD COLUMN passing_grade REAL DEFAULT 10`,
    `ALTER TABLE AppUser ADD COLUMN two_fa_secret TEXT`,
    `ALTER TABLE AppUser ADD COLUMN two_fa_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE AppUser ADD COLUMN admin_pattern_hash TEXT`,
    `ALTER TABLE AppUser ADD COLUMN admin_pin_hash TEXT`,
  ];
  for (const sql of cols) {
    try { await prisma.$executeRawUnsafe(sql); } catch {} // ignore "duplicate column" errors
  }

  // ── Table TwoFAPolicy (politique 2FA par rôle) ──────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TwoFAPolicy (
      role      TEXT PRIMARY KEY,
      mandatory INTEGER DEFAULT 0
    )
  `).catch(() => {});

  // ── Table AppSettings (paramètres globaux de l'application) ─────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AppSettings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `).catch(() => {});

  // ── Index de performance ─────────────────────────────────────────────────
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_student_class_id   ON Student(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_student_status     ON Student(status)`,
    `CREATE INDEX IF NOT EXISTS idx_grade_student_id   ON Grade(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_grade_exam_id      ON Grade(exam_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gradehistory_student ON GradeHistory(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_class_id      ON Exam(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_subject_id    ON Exam(subject_id)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_teacher_id    ON Exam(teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_schedule_class_id  ON Schedule(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_schedule_teacher   ON Schedule(teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_schedule_day       ON Schedule(day_of_week)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_student ON Attendance(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_class   ON Attendance(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_date    ON Attendance(date)`,
    `CREATE INDEX IF NOT EXISTS idx_sanction_class_id  ON Sanction(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sanction_student   ON Sanction(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_student    ON Payment(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_litigation_student ON Litigation(student_id)`,
  ];
  for (const sql of indexes) {
    try { await prisma.$executeRawUnsafe(sql); } catch (e) {
      console.warn('[migrations] index skipped:', e.message);
    }
  }
}

const entityRoutes = require('./routes/entities');
const functionRoutes = require('./routes/functions');
const importRoutes = require('./routes/import');
const aiRoutes = require('./routes/ai');
const ticketRoutes = require('./routes/tickets');
const notificationRoutes = require('./routes/notifications');
const cantineRoutes = require('./routes/cantine');
const absenceRoutes = require('./routes/absences');
const rhRoutes = require('./routes/rh');
const financeV2Routes = require('./routes/financeV2');
const { loadUser, requireAuth } = require('./authUtils');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Sécurité : headers HTTP ──────────────────────────────────────────────────
app.use(helmet({
  // contentSecurityPolicy désactivé : le backend est une pure API JSON,
  // pas de rendu HTML — pas besoin de CSP côté API.
  contentSecurityPolicy: false,
}));

// ── Rate limiting : authentification ────────────────────────────────────────
// Max 20 tentatives de login par IP sur 15 minutes — bloque le brute force PIN.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

// ── Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (uploads)
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// File upload endpoint
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

// Types MIME autorisés — bloque les exécutables, scripts et archives malveillants
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/upload', loadUser, requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ file_url: fileUrl, filename: req.file.filename, originalname: req.file.originalname });
});

// API routes
// Rate limiter sur le login uniquement (avant le routeur functions)
app.post('/api/functions/appLogin', loginRateLimiter);
app.use('/api/entities', entityRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cantine', cantineRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/rh', rhRoutes);
app.use('/api/finv2', financeV2Routes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

// Error handler
app.use((err, req, res, next) => {
  // Log complet côté serveur, message générique côté client
  console.error('[error]', err.message, err.stack);
  // Erreur multer (type MIME non autorisé) — message explicite mais sans détails internes
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (max 50 Mo).' });
  }
  if (err.message?.startsWith('Type de fichier non autorisé')) {
    return res.status(415).json({ error: err.message });
  }
  res.status(500).json({ error: 'Une erreur interne est survenue.' });
});

runMigrations().catch(console.error);

app.listen(PORT, () => {
  console.log(`\n🚀 EduGest backend running at http://localhost:${PORT}`);
  console.log(`   Entities API : http://localhost:${PORT}/api/entities/{EntityName}`);
  console.log(`   Functions    : http://localhost:${PORT}/api/functions/{fnName}`);
  console.log(`   Uploads      : http://localhost:${PORT}/uploads/\n`);
});
