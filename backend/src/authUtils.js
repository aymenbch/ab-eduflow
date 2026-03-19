/**
 * authUtils.js — Utilitaires d'authentification partagés
 *
 * - signSession(userId)   : génère un token HMAC signé avec timestamp (expiration 24h)
 * - verifySession(token)  : vérifie la signature ET l'expiration, retourne userId ou null
 * - loadUser              : middleware Express — charge l'utilisateur depuis le token
 * - requireAuth           : middleware Express — rejette les requêtes non authentifiées (401)
 * - requireRole(...roles) : middleware Express — rejette les mauvais rôles (403)
 *
 * Format du token : `{userId}:{issuedAt}.{hmac_hex}`
 *   - userId    : UUID de l'utilisateur
 *   - issuedAt  : timestamp Unix en secondes (horodatage d'émission)
 *   - hmac_hex  : HMAC-SHA256(userId + ':' + issuedAt, SESSION_SECRET)
 *
 * Expiration : TOKEN_TTL_SECONDS (défaut 24 h)
 * Révocation : impossible sans store serveur, mais le token expire automatiquement.
 */

const crypto = require('crypto');
const { getPrisma } = require('./db');

// ── Configuration ───────────────────────────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '86400', 10); // 24h par défaut

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[authUtils] ⚠️  SESSION_SECRET non défini dans .env — utilisation du secret par défaut (NON SÉCURISÉ EN PRODUCTION).'
  );
}

// ── Génération du token ─────────────────────────────────────────────────────

/**
 * Signe un userId et retourne un token opaque valide pour TOKEN_TTL_SECONDS secondes.
 * Format : `{userId}:{issuedAt}.{hmac_hex}`
 * @param {string} userId
 * @returns {string}
 */
function signSession(userId) {
  const issuedAt = Math.floor(Date.now() / 1000); // timestamp Unix (secondes)
  const payload  = `${userId}:${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

// ── Vérification du token ───────────────────────────────────────────────────

/**
 * Vérifie la signature et l'expiration d'un token de session.
 * @param {string} token
 * @returns {string|null} userId si valide et non expiré, null sinon
 */
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    // Format attendu : `{userId}:{issuedAt}.{hmac_hex}`
    const lastDot = token.lastIndexOf('.');
    if (lastDot <= 0) return null;

    const payload  = token.substring(0, lastDot);   // "{userId}:{issuedAt}"
    const sig      = token.substring(lastDot + 1);  // hmac_hex

    // Vérification HMAC en temps constant (anti-timing attack)
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;

    // Extraction userId et timestamp
    const colonIdx = payload.lastIndexOf(':');
    if (colonIdx <= 0) return null;

    const userId   = payload.substring(0, colonIdx);
    const issuedAt = parseInt(payload.substring(colonIdx + 1), 10);
    if (!userId || isNaN(issuedAt)) return null;

    // Vérification d'expiration
    const now = Math.floor(Date.now() / 1000);
    if (now - issuedAt > TOKEN_TTL_SECONDS) return null; // token expiré

    return userId;
  } catch {
    return null;
  }
}

// ── Middleware : charger l'utilisateur ──────────────────────────────────────

/**
 * Charge l'utilisateur authentifié depuis :
 *  1. X-Session-Token (token HMAC signé avec expiration — préféré)
 *  2. X-User-Id (legacy, non signé — accepté en fallback pour compatibilité)
 *
 * Définit req.user (objet AppUser ou null) et req.educationSystem.
 */
async function loadUser(req, res, next) {
  req.educationSystem = req.headers['x-education-system'] || 'francais';

  let userId = null;
  const token = req.headers['x-session-token'];

  if (token) {
    // ─ Chemin sécurisé : token HMAC signé + expiration ──────────────────
    userId = verifySession(token);
    if (!userId) {
      // Token présent mais invalide/expiré → refus sans fallback
      req.user = null;
      return next();
    }
  } else {
    // ─ Fallback legacy : X-User-Id non signé (déprécié) ─────────────────
    // Accepté uniquement pour les sessions créées avant l'introduction des tokens.
    // À supprimer lors de la prochaine migration majeure.
    userId = req.headers['x-user-id'] || null;
  }

  if (!userId) {
    req.user = null;
    return next();
  }

  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
      SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    req.user = rows[0] || null;
  } catch {
    req.user = null;
  }

  next();
}

// ── Middleware : exiger une authentification ────────────────────────────────

/**
 * Rejette les requêtes sans utilisateur authentifié (HTTP 401).
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
  }
  next();
}

// ── Middleware : exiger un rôle précis ──────────────────────────────────────

/**
 * Retourne un middleware qui rejette les utilisateurs dont le rôle
 * ne figure pas dans la liste fournie (HTTP 403).
 *
 * Usage : router.post('/route', requireRole('admin_systeme', 'admin'), handler)
 *
 * @param {...string} roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Accès refusé. Rôle(s) requis : ${roles.join(', ')}. Votre rôle : ${req.user.role}.`,
      });
    }
    next();
  };
}

module.exports = { signSession, verifySession, loadUser, requireAuth, requireRole };
