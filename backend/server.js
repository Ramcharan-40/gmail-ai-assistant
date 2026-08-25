require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production' && !(process.env.FRONTEND_URL || '').includes('localhost');

const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');

// Ensure data dir exists for SQLite sessions
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─── Trust Reverse Proxy (Required for Render & HTTPS Cookies) ──
app.set('trust proxy', 1);

// ─── Security Headers ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'http:'],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL,
].filter(Boolean).map(url => url.replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const cleanedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(cleanedOrigin) || !isProd) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ─── Session Management (Persistent SQLite Store) ─────────────
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: dataDir,
    concurrentDB: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd, // true requires HTTPS (Render provides HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProd ? 'none' : 'lax', // 'none' required for cross-domain cookies (Vercel frontend + Render backend)
  },
}));

// ─── Static files (fallback if frontend served together) ──────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/emails', gmailRoutes);
app.use('/api/ai', aiRoutes);

// ─── Health check (Used by Render for zero-downtime health check)
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Legal & Static Page Routes ───────────────────────────────
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'terms.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

// ─── Catch-all: serve index.html for local standalone runs ────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Gmail AI Assistant running at http://localhost:${PORT}`);
  console.log(`📧 Connect your Gmail account to get started\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the other process and restart.`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown — lets nodemon / host restart cleanly
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
