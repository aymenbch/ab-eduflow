require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const entityRoutes = require('./routes/entities');
const functionRoutes = require('./routes/functions');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ file_url: fileUrl, filename: req.file.filename, originalname: req.file.originalname });
});

// API routes
app.use('/api/entities', entityRoutes);
app.use('/api/functions', functionRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 EduGest backend running at http://localhost:${PORT}`);
  console.log(`   Entities API : http://localhost:${PORT}/api/entities/{EntityName}`);
  console.log(`   Functions    : http://localhost:${PORT}/api/functions/{fnName}`);
  console.log(`   Uploads      : http://localhost:${PORT}/uploads/\n`);
});
