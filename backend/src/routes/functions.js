const { Router } = require('express');
const crypto = require('crypto');
const { getPrisma } = require('../db');
const { loadUser, requireAuth, requireRole, signSession, sign2FAToken, verify2FAToken } = require('../authUtils');

// 2FA — TOTP (speakeasy) + QR Code (qrcode)
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Aucun rôle exempté — la 2FA est disponible pour tous les profils
const ROLES_WITHOUT_2FA = [];

const router = Router();

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/** Generate a random provisional password: 4 uppercase + 4 digits = 8 chars, e.g. "TKXY8492" */
function generateProvisionalPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

// POST /api/functions/appLogin
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

router.post('/appLogin', async (req, res) => {
  const prisma = getPrisma();
  const { login, pin_hash } = req.body;

  if (!login || !pin_hash) {
    return res.status(400).json({ error: 'login and pin_hash are required' });
  }

  try {
    // Utiliser $queryRaw pour inclure les colonnes ajoutées manuellement (failed_attempts, locked_until)
    const rows = await prisma.$queryRaw`
      SELECT * FROM AppUser WHERE login = ${login.toLowerCase()} LIMIT 1`;
    const user = rows[0] || null;

    if (!user) return res.status(401).json({ error: 'Identifiants incorrects ou compte inactif.' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Compte suspendu. Contactez l\'administration.' });

    // Vérifier si le compte est verrouillé
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remainingMins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: `Compte temporairement verrouillé. Réessayez dans ${remainingMins} minute(s) ou contactez l'administration.`,
        locked: true,
      });
    }

    if (user.pin_hash !== pin_hash) {
      // Incrémenter le compteur d'échecs
      const newAttempts = (user.failed_attempts || 0) + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
      const lockUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null;

      await prisma.$executeRaw`
        UPDATE AppUser
        SET failed_attempts = ${newAttempts},
            locked_until = ${lockUntil}
        WHERE id = ${user.id}`;

      if (shouldLock) {
        return res.status(423).json({
          error: `Compte verrouillé après ${MAX_LOGIN_ATTEMPTS} tentatives échouées. Contactez l'administration pour déverrouiller.`,
          locked: true,
        });
      }

      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      return res.status(401).json({
        error: `Identifiants incorrects ou compte inactif.`,
        attempts_remaining: remaining,
      });
    }

    // Succès : réinitialiser le compteur et mettre à jour last_login
    await prisma.$executeRaw`
      UPDATE AppUser
      SET failed_attempts = 0, locked_until = NULL, last_login = ${new Date().toISOString()}
      WHERE id = ${user.id}`;

    const { pin_hash: _, ...safeUser } = user;

    // ── Sécurité avancée admin (pattern + PIN dynamique) ─────────────────────
    if (user.role === 'admin_systeme') {
      const temp_token = sign2FAToken(user.id);
      if (user.admin_pattern_hash && user.admin_pin_hash) {
        // Setup done → require verification
        return res.json({ requires_admin_security: true, step: 'pattern', temp_token, full_name: user.full_name, role: user.role });
      } else {
        // Setup not done → force setup
        return res.json({ requires_admin_setup: true, temp_token, full_name: user.full_name, role: user.role });
      }
    }

    // ── 2FA : vérifier la politique par rôle ─────────────────────────────
    if (!ROLES_WITHOUT_2FA.includes(user.role)) {
      const policyRows = await prisma.$queryRaw`
        SELECT mandatory FROM TwoFAPolicy WHERE role = ${user.role} LIMIT 1`;
      const isMandatory = policyRows[0]?.mandatory === 1 || policyRows[0]?.mandatory === true;

      if (user.two_fa_enabled) {
        // Utilisateur a la 2FA activée → vérification TOTP requise
        const temp_token = sign2FAToken(user.id);
        return res.json({ requires_2fa: true, temp_token, full_name: user.full_name, role: user.role });
      } else if (isMandatory) {
        // 2FA obligatoire mais non configurée → forcer la configuration
        const temp_token = sign2FAToken(user.id);
        return res.json({ requires_2fa_setup: true, temp_token, full_name: user.full_name, role: user.role });
      }
    }

    // Inclure un token HMAC signé côté serveur — le client le renverra dans X-Session-Token
    const token = signSession(user.id);
    res.json({ ...safeUser, must_change_pin: user.must_change_pin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appUpdatePin
// Deux cas d'usage :
//   1. Changement volontaire : must_change_pin = false, current_pin_hash OBLIGATOIRE
//   2. Premier login (must_change_pin = true) : current_pin_hash OBLIGATOIRE aussi
// Dans tous les cas, current_pin_hash est requis pour prévenir la réinitialisation
// forcée par quiconque connaissant seulement le user_id.
//
// Sécurité anti-IDOR : l'utilisateur connecté ne peut modifier que son propre PIN.
// Exception : admin_systeme et admin peuvent modifier le PIN de n'importe quel compte.
router.post('/appUpdatePin', async (req, res) => {
  const prisma = getPrisma();
  const { user_id, current_pin_hash, new_pin_hash } = req.body;

  if (!user_id || !new_pin_hash) {
    return res.status(400).json({ error: 'user_id et new_pin_hash sont requis.' });
  }
  if (!current_pin_hash) {
    return res.status(400).json({ error: 'current_pin_hash est requis pour changer le PIN.' });
  }

  // ── Anti-IDOR : vérifier que l'appelant modifie son propre compte ──────────
  // Cas autorisés :
  //   1. Admin → peut modifier n'importe quel compte
  //   2. Utilisateur authentifié → uniquement son propre compte
  //   3. Non authentifié (req.user absent) → premier login "must_change_pin",
  //      sécurisé par la vérification de current_pin_hash ci-dessous
  const callerIsAdmin = req.user && ['admin_systeme', 'admin'].includes(req.user.role);
  if (req.user && !callerIsAdmin && req.user.id !== user_id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre PIN.' });
  }

  try {
    const user = await prisma.appUser.findUnique({ where: { id: user_id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (user.pin_hash !== current_pin_hash) {
      return res.status(401).json({ error: 'PIN actuel incorrect.' });
    }

    const updated = await prisma.appUser.update({
      where: { id: user_id },
      data: { pin_hash: new_pin_hash, must_change_pin: false },
    });

    const { pin_hash: _, ...safeUser } = updated;
    const token = signSession(updated.id);
    res.json({ ...safeUser, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du changement de PIN.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ROUTES 2FA (publiques — pas besoin d'être connecté)
// ════════════════════════════════════════════════════════════════════════════

// Tous les rôles peuvent être soumis à la politique 2FA
const ALL_2FA_ELIGIBLE_ROLES = [
  'admin_systeme', 'directeur_general', 'directeur_primaire',
  'directeur_college', 'directeur_lycee', 'cpe',
  'enseignant', 'secretaire', 'comptable',
  'parent', 'eleve',
];

// POST /api/functions/get2FAPolicy
// Retourne la politique 2FA pour tous les rôles (public)
router.post('/get2FAPolicy', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRaw`SELECT role, mandatory FROM TwoFAPolicy`;
    const policies = {};
    // Initialiser tous les rôles à false
    for (const role of ALL_2FA_ELIGIBLE_ROLES) policies[role] = false;
    // Surcharger avec les valeurs en DB
    for (const row of rows) {
      if (ALL_2FA_ELIGIBLE_ROLES.includes(row.role)) {
        policies[row.role] = row.mandatory === 1 || row.mandatory === true;
      }
    }
    res.json({ policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/setupForced2FA
// Génère un secret TOTP pour l'utilisateur identifié par temp_token (setup forcé à la connexion)
router.post('/setupForced2FA', async (req, res) => {
  const prisma = getPrisma();
  const { temp_token } = req.body;
  if (!temp_token) return res.status(400).json({ error: 'temp_token requis.' });

  const userId = verify2FAToken(temp_token);
  if (!userId) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const secretObj = speakeasy.generateSecret({ length: 20 });
    const secret = secretObj.base32;
    const otpauthUrl = speakeasy.otpauthURL({ secret, label: encodeURIComponent(user.login), issuer: 'EduGest', encoding: 'base32' });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: { dark: '#1e40af', light: '#ffffff' },
    });

    // Stocker le secret temporairement
    await prisma.$executeRaw`UPDATE AppUser SET two_fa_secret = ${secret} WHERE id = ${userId}`;

    res.json({ secret, qrDataUrl, full_name: user.full_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/confirmForced2FA
// Confirme le code TOTP lors du setup forcé, active la 2FA et émet la vraie session
router.post('/confirmForced2FA', async (req, res) => {
  const prisma = getPrisma();
  const { temp_token, code } = req.body;
  if (!temp_token || !code) return res.status(400).json({ error: 'temp_token et code requis.' });

  const userId = verify2FAToken(temp_token);
  if (!userId) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0];
    if (!user || !user.two_fa_secret) {
      return res.status(400).json({ error: 'Lancez d\'abord la configuration 2FA.' });
    }

    const isValid = speakeasy.totp.verify({ secret: user.two_fa_secret, encoding: 'base32', token: String(code).replace(/\s/g, ''), window: 1 });
    if (!isValid) {
      return res.status(401).json({ error: 'Code incorrect. Vérifiez votre application d\'authentification.' });
    }

    // Activer la 2FA
    await prisma.$executeRaw`UPDATE AppUser SET two_fa_enabled = 1 WHERE id = ${userId}`;

    // Émettre la vraie session
    const { pin_hash: _, ...safeUser } = user;
    const token = signSession(userId);
    res.json({ ...safeUser, two_fa_enabled: 1, must_change_pin: user.must_change_pin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/verify2FALogin
// Étape 2 du login : vérifier le code TOTP avec le temp_token reçu à l'étape 1
router.post('/verify2FALogin', async (req, res) => {
  const prisma = getPrisma();
  const { temp_token, code } = req.body;

  if (!temp_token || !code) {
    return res.status(400).json({ error: 'temp_token et code sont requis.' });
  }

  const userId = verify2FAToken(temp_token);
  if (!userId) {
    return res.status(401).json({ error: 'Session 2FA expirée ou invalide. Veuillez vous reconnecter.' });
  }

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0] || null;
    if (!user || !user.two_fa_secret) {
      return res.status(401).json({ error: 'Utilisateur introuvable ou 2FA non configurée.' });
    }

    // Vérifier le code TOTP (fenêtre de tolérance : ±1 période de 30s)
    const isValid = speakeasy.totp.verify({ secret: user.two_fa_secret, encoding: 'base32', token: String(code).replace(/\s/g, ''), window: 1 });
    if (!isValid) {
      return res.status(401).json({ error: 'Code d\'authentification incorrect.' });
    }

    // Code correct → émettre la vraie session
    const { pin_hash: _, ...safeUser } = user;
    const token = signSession(user.id);
    res.json({ ...safeUser, must_change_pin: user.must_change_pin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/getSchoolSettings — public (login page uses this)
router.post('/getSchoolSettings', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRaw`SELECT key, value FROM AppSettings WHERE key IN ('school_logo', 'school_name')`;
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/verifyAdminPattern
router.post('/verifyAdminPattern', async (req, res) => {
  const prisma = getPrisma();
  const { temp_token, pattern_hash } = req.body;
  if (!temp_token || !pattern_hash) return res.status(400).json({ error: 'Données manquantes.' });

  const userId = verify2FAToken(temp_token);
  if (!userId) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0];
    if (!user || user.admin_pattern_hash !== pattern_hash) {
      return res.status(401).json({ error: 'Schéma incorrect. Réessayez.' });
    }
    // Issue step2 token for PIN step
    const step2_token = sign2FAToken(userId);
    res.json({ ok: true, step2_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/verifyAdminPin
router.post('/verifyAdminPin', async (req, res) => {
  const prisma = getPrisma();
  const { step2_token, pin_hash } = req.body;
  if (!step2_token || !pin_hash) return res.status(400).json({ error: 'Données manquantes.' });

  const userId = verify2FAToken(step2_token);
  if (!userId) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0];
    if (!user || user.admin_pin_hash !== pin_hash) {
      return res.status(401).json({ error: 'Code PIN incorrect.' });
    }

    // Check if 2FA is also required
    const { pin_hash: _, ...safeUser } = user;
    if (user.two_fa_enabled) {
      const temp_token = sign2FAToken(userId);
      return res.json({ requires_2fa: true, temp_token, full_name: user.full_name, role: user.role });
    }

    const token = signSession(userId);
    res.json({ ...safeUser, must_change_pin: user.must_change_pin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/setupAdminSecurityStep — setup pattern+PIN using temp_token (not yet authenticated)
router.post('/setupAdminSecurityStep', async (req, res) => {
  const prisma = getPrisma();
  const { temp_token, pattern_hash, pin_hash } = req.body;
  if (!temp_token || !pattern_hash || !pin_hash) return res.status(400).json({ error: 'Données manquantes.' });

  const userId = verify2FAToken(temp_token);
  if (!userId) return res.status(401).json({ error: 'Session expirée.' });

  try {
    const rows = await prisma.$queryRaw`SELECT * FROM AppUser WHERE id = ${userId} LIMIT 1`;
    const user = rows[0];
    if (!user || user.role !== 'admin_systeme') return res.status(403).json({ error: 'Accès refusé.' });

    await prisma.$executeRaw`UPDATE AppUser SET admin_pattern_hash = ${pattern_hash}, admin_pin_hash = ${pin_hash} WHERE id = ${userId}`;

    // Issue real session
    const { pin_hash: _, ...safeUser } = user;
    const token = signSession(userId);
    res.json({ ...safeUser, admin_pattern_hash: pattern_hash, admin_pin_hash: pin_hash, must_change_pin: user.must_change_pin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Middlewares d'authentification ────────────────────────────────────────
// Toutes les routes déclarées APRÈS ce bloc requièrent une authentification valide.
router.use(loadUser);
router.use(requireAuth);

// POST /api/functions/updateAdminSecurity — update pattern+PIN when already logged in
router.post('/updateAdminSecurity', requireRole('admin_systeme'), async (req, res) => {
  const prisma = getPrisma();
  const { pattern_hash, pin_hash, current_pin_hash } = req.body;
  if (!pattern_hash || !pin_hash || !current_pin_hash) return res.status(400).json({ error: 'Données manquantes.' });

  const user = req.user;
  if (user.pin_hash !== current_pin_hash) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

  try {
    await prisma.$executeRaw`UPDATE AppUser SET admin_pattern_hash = ${pattern_hash}, admin_pin_hash = ${pin_hash} WHERE id = ${user.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/disableAdminSecurity
router.post('/disableAdminSecurity', requireRole('admin_systeme'), async (req, res) => {
  const prisma = getPrisma();
  const { current_pin_hash } = req.body;
  if (!current_pin_hash) return res.status(400).json({ error: 'Mot de passe requis.' });

  const user = req.user;
  if (user.pin_hash !== current_pin_hash) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

  try {
    await prisma.$executeRawUnsafe(`UPDATE AppUser SET admin_pattern_hash = NULL, admin_pin_hash = NULL WHERE id = '${user.id}'`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/updateSchoolSettings — admin only
router.post('/updateSchoolSettings', requireRole('admin_systeme', 'admin'), async (req, res) => {
  const prisma = getPrisma();
  const { school_logo, school_name } = req.body;
  try {
    if (school_logo !== undefined) {
      await prisma.$executeRaw`INSERT INTO AppSettings (key, value) VALUES ('school_logo', ${school_logo}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
    }
    if (school_name !== undefined) {
      await prisma.$executeRaw`INSERT INTO AppSettings (key, value) VALUES ('school_name', ${school_name}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appUserAdmin
router.post('/appUserAdmin', requireRole('admin_systeme', 'admin'), async (req, res) => {
  const prisma = getPrisma();

  // Support both flat payload and nested { action, payload: {...} }
  const body = req.body || {};
  const action = body.action;
  const data = { ...body, ...(body.payload || {}) };
  const { id, login, pin, pin_hash, full_name, role, member_type, member_id, status, must_change_pin, assigned_cycles } = data;

  try {
    switch (action) {
      case 'list': {
        // $queryRaw pour inclure les colonnes ajoutées manuellement (failed_attempts, locked_until)
        const users = await prisma.$queryRaw`SELECT * FROM AppUser ORDER BY created_date DESC`;
        return res.json(users.map(({ pin_hash: _, ...u }) => u));
      }

      case 'create': {
        if (!login || !role) return res.status(400).json({ error: 'login et rôle sont requis' });

        // Vérifier unicité du login
        const existing = await prisma.appUser.findFirst({ where: { login: login.toLowerCase() } });
        if (existing) return res.status(409).json({ error: `L'identifiant "${login}" est déjà utilisé` });

        // Règle : un membre ne peut avoir qu'un seul rôle actif
        if (member_id) {
          const existingMember = await prisma.appUser.findFirst({
            where: { member_id, status: 'active' },
          });
          if (existingMember) {
            return res.status(409).json({
              error: `Ce membre a déjà un compte actif (identifiant : ${existingMember.login}). Modifiez le compte existant ou désactivez-le d'abord.`,
              existing_account: { id: existingMember.id, login: existingMember.login, role: existingMember.role },
            });
          }
        }

        // Always auto-generate a provisional password (admin-set pin_hash is ignored at creation)
        const provisionalPassword = generateProvisionalPassword();
        const hash = sha256(provisionalPassword);

        const user = await prisma.appUser.create({
          data: {
            login: login.toLowerCase(),
            pin_hash: hash,
            full_name: full_name || '',
            role,
            member_type: member_type || 'none',
            member_id: member_id || null,
            status: status || 'active',
            must_change_pin: true, // toujours vrai à la création
          },
        });
        const { pin_hash: _, ...safeUser } = user;
        // Always return the provisional password so admin can communicate it
        return res.status(201).json({ ...safeUser, provisional_password: provisionalPassword });
      }

      case 'update': {
        if (!id) return res.status(400).json({ error: 'id requis' });
        const updateData = {};
        if (login !== undefined) updateData.login = login.toLowerCase();
        if (pin_hash) updateData.pin_hash = pin_hash;
        if (pin) updateData.pin_hash = sha256(pin);
        if (full_name !== undefined) updateData.full_name = full_name;
        if (role) updateData.role = role;
        if (member_type !== undefined) updateData.member_type = member_type;
        if (member_id !== undefined) updateData.member_id = member_id;
        if (status) updateData.status = status;
        if (must_change_pin !== undefined) updateData.must_change_pin = must_change_pin;

        const user = await prisma.appUser.update({ where: { id }, data: updateData });

        // assigned_cycles est hors schema Prisma → mise à jour via raw SQL si fourni
        if (assigned_cycles !== undefined) {
          const cyclesVal = Array.isArray(assigned_cycles) ? JSON.stringify(assigned_cycles) : (assigned_cycles || null);
          await prisma.$executeRaw`UPDATE AppUser SET assigned_cycles = ${cyclesVal} WHERE id = ${id}`;
        }
        const { pin_hash: _, ...safeUser } = user;
        return res.json(safeUser);
      }

      case 'delete': {
        if (!id) return res.status(400).json({ error: 'id requis' });
        await prisma.appUser.delete({ where: { id } });
        return res.json({ success: true });
      }

      case 'unlock': {
        if (!id) return res.status(400).json({ error: 'id requis' });
        await prisma.$executeRaw`
          UPDATE AppUser SET failed_attempts = 0, locked_until = NULL WHERE id = ${id}`;
        return res.json({ success: true, message: 'Compte déverrouillé.' });
      }

      case 'reset_pin': {
        if (!id) return res.status(400).json({ error: 'id requis' });
        const provisionalPassword = generateProvisionalPassword();
        const user = await prisma.appUser.update({
          where: { id },
          data: { pin_hash: sha256(provisionalPassword), must_change_pin: true },
        });
        const { pin_hash: _, ...safeUser } = user;
        // Return the provisional password so the frontend can show it
        return res.json({ ...safeUser, provisional_password: provisionalPassword });
      }

      default:
        return res.status(400).json({ error: `Action inconnue : ${action}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appCheckLogin
// Vérifie si un login est disponible avant création
router.post('/appCheckLogin', async (req, res) => {
  const prisma = getPrisma();
  const { login, exclude_id } = req.body;
  if (!login) return res.status(400).json({ error: 'login requis' });

  try {
    const existing = await prisma.appUser.findFirst({
      where: { login: login.toLowerCase() },
    });
    // Si c'est une modification, ignorer l'utilisateur en cours d'édition
    const taken = existing && existing.id !== exclude_id;
    res.json({ available: !taken, login: login.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appCheckMember
// Vérifie si un membre (member_id) a déjà un compte AppUser actif
router.post('/appCheckMember', async (req, res) => {
  const prisma = getPrisma();
  const { member_id, exclude_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id requis' });

  try {
    const existing = await prisma.appUser.findFirst({
      where: { member_id, status: 'active' },
    });
    // Exclure le compte en cours d'édition
    if (existing && existing.id !== exclude_id) {
      const { pin_hash: _, ...safe } = existing;
      return res.json({ has_account: true, account: safe });
    }
    res.json({ has_account: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appGetProfile
router.post('/appGetProfile', async (req, res) => {
  const prisma = getPrisma();
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });

  try {
    const rows = await prisma.$queryRaw`
      SELECT id, login, full_name, role, member_type, status, email, phone, address, photo, assigned_cycles, last_login, created_date
      FROM AppUser WHERE id = ${user_id}
    `;
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appUpdateProfile
router.post('/appUpdateProfile', async (req, res) => {
  const prisma = getPrisma();
  const { user_id, email, phone, address, photo, assigned_cycles, current_pin_hash, new_pin_hash } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });

  try {
    const user = await prisma.appUser.findUnique({ where: { id: user_id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Si changement de mot de passe demandé : vérifier l'actuel
    if (new_pin_hash) {
      if (!current_pin_hash) return res.status(400).json({ error: 'Le mot de passe actuel est requis' });
      if (user.pin_hash !== current_pin_hash) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Mise à jour des champs profil via raw SQL (colonnes ajoutées manuellement)
    const emailVal         = email           !== undefined ? email           : null;
    const phoneVal         = phone           !== undefined ? phone           : null;
    const addressVal       = address         !== undefined ? address         : null;
    const photoVal         = photo           !== undefined ? photo           : null;
    const assignedCyclesVal= assigned_cycles !== undefined
      ? (Array.isArray(assigned_cycles) ? JSON.stringify(assigned_cycles) : assigned_cycles)
      : null;

    await prisma.$executeRaw`
      UPDATE AppUser
      SET email           = COALESCE(${emailVal},          email),
          phone           = COALESCE(${phoneVal},          phone),
          address         = COALESCE(${addressVal},        address),
          photo           = COALESCE(${photoVal},          photo),
          assigned_cycles = COALESCE(${assignedCyclesVal}, assigned_cycles)
      WHERE id = ${user_id}
    `;

    // Changement de mot de passe
    if (new_pin_hash) {
      await prisma.appUser.update({
        where: { id: user_id },
        data: { pin_hash: new_pin_hash },
      });
    }

    // Retourner le profil mis à jour
    const rows = await prisma.$queryRaw`
      SELECT id, login, full_name, role, member_type, status, email, phone, address, photo, assigned_cycles, last_login, created_date
      FROM AppUser WHERE id = ${user_id}
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appClearProfileField
// Permet de vider un champ nullable (email, phone, address, photo)
router.post('/appClearProfileField', async (req, res) => {
  const prisma = getPrisma();
  const { user_id, field } = req.body;
  const allowed = ['email', 'phone', 'address', 'photo'];
  if (!user_id || !field || !allowed.includes(field)) {
    return res.status(400).json({ error: 'user_id et field (email|phone|address|photo) requis' });
  }
  try {
    if (field === 'email')   await prisma.$executeRaw`UPDATE AppUser SET email   = NULL WHERE id = ${user_id}`;
    if (field === 'phone')   await prisma.$executeRaw`UPDATE AppUser SET phone   = NULL WHERE id = ${user_id}`;
    if (field === 'address') await prisma.$executeRaw`UPDATE AppUser SET address = NULL WHERE id = ${user_id}`;
    if (field === 'photo')   await prisma.$executeRaw`UPDATE AppUser SET photo   = NULL WHERE id = ${user_id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/computePromotions
// Calcule les moyennes pondérées des élèves d'une classe et propose des décisions de passage
router.post('/computePromotions', async (req, res) => {
  const prisma = getPrisma();
  const { class_id, passing_grade = 10 } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id requis' });

  try {
    // 1. Élèves actifs de la classe
    const students = await prisma.student.findMany({
      where: { class_id, status: 'active' },
    });

    // 2. Examens de la classe (avec coefficient)
    const exams = await prisma.exam.findMany({ where: { class_id } });
    const examMap = Object.fromEntries(exams.map(e => [e.id, e]));

    // 3. Notes des élèves
    const studentIds = students.map(s => s.id);
    const grades = studentIds.length
      ? await prisma.grade.findMany({ where: { student_id: { in: studentIds } } })
      : [];

    // 4. Historique des promotions (pour détecter les redoublements répétés)
    let allPromotions = [];
    if (studentIds.length > 0) {
      allPromotions = await prisma.promotion.findMany({
        where: { student_id: { in: studentIds }, status: 'repeating' },
      });
    }

    // 5. Calculer moyenne pondérée par élève
    const results = students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      let totalWeighted = 0;
      let totalCoeff = 0;

      for (const grade of studentGrades) {
        if (grade.absent || grade.score === null || grade.score === undefined) continue;
        const exam = examMap[grade.exam_id];
        if (!exam) continue;
        const coeff = exam.coefficient || 1;
        totalWeighted += grade.score * coeff;
        totalCoeff += coeff;
      }

      const average = totalCoeff > 0 ? +(totalWeighted / totalCoeff).toFixed(2) : null;
      const repeatCount = allPromotions.filter(p => p.student_id === student.id).length;

      let proposed;
      if (average === null) {
        proposed = 'pending';
      } else if (average >= passing_grade) {
        proposed = 'promoted';
      } else {
        proposed = 'repeating';
      }

      return {
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_code: student.student_code,
        average,
        proposed_decision: proposed,
        repeat_count: repeatCount,
      };
    });

    res.json({ results, passing_grade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/getSchoolYears
// Retourne les années scolaires avec les colonnes ajoutées manuellement (passing_grade)
router.post('/getSchoolYears', async (req, res) => {
  const prisma = getPrisma();
  try {
    const years = await prisma.$queryRaw`SELECT * FROM SchoolYear ORDER BY created_date DESC`;
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/updateSchoolYearConfig
// Met à jour la note de passage d'une année scolaire
router.post('/updateSchoolYearConfig', async (req, res) => {
  const prisma = getPrisma();
  const { school_year_id, passing_grade } = req.body;
  if (!school_year_id) return res.status(400).json({ error: 'school_year_id requis' });
  try {
    const grade = parseFloat(passing_grade) || 10;
    await prisma.$executeRaw`UPDATE SchoolYear SET passing_grade = ${grade} WHERE id = ${school_year_id}`;
    res.json({ success: true, passing_grade: grade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/migrateExamsToPeriods
// Migration unique : lie les anciens examens (trimester=T1/T2/T3) à des Period réels.
// Réservé aux admins.
router.post('/migrateExamsToPeriods', requireRole('admin_systeme', 'admin'), async (req, res) => {
  const prisma = getPrisma();
  try {
    // 1. Trouver ou créer l'année scolaire active
    let schoolYear = await prisma.schoolYear.findFirst({ where: { status: 'active' } });
    if (!schoolYear) {
      const now = new Date();
      const yearName = `${now.getFullYear()}-${now.getFullYear() + 1}`;
      schoolYear = await prisma.schoolYear.create({
        data: { name: yearName, status: 'active' },
      });
    }

    // 2. Créer/trouver les Period pour T1, T2, T3
    const TRIMESTER_DEFS = [
      { trimester: 'T1', name: 'Trimestre 1', order: 1 },
      { trimester: 'T2', name: 'Trimestre 2', order: 2 },
      { trimester: 'T3', name: 'Trimestre 3', order: 3 },
    ];

    const periodMap = {}; // trimester → period.id
    const createdPeriods = [];
    for (const def of TRIMESTER_DEFS) {
      let period = await prisma.period.findFirst({
        where: { school_year_id: schoolYear.id, order: def.order },
      });
      if (!period) {
        period = await prisma.period.create({
          data: {
            school_year_id: schoolYear.id,
            name: def.name,
            type: 'trimestre',
            order: def.order,
            status: 'open',
          },
        });
        createdPeriods.push(def.trimester);
      }
      periodMap[def.trimester] = period.id;
    }

    // 3. Mettre à jour les examens sans period_id
    let updated = 0;
    for (const [trimester, periodId] of Object.entries(periodMap)) {
      // Cas period_id IS NULL
      const r1 = await prisma.exam.updateMany({
        where: { trimester, period_id: null },
        data: { period_id: periodId },
      });
      // Cas period_id vide string (SQLite stocke '' comme valeur valide)
      const r2 = await prisma.exam.updateMany({
        where: { trimester, period_id: '' },
        data: { period_id: periodId },
      });
      updated += r1.count + r2.count;
    }

    res.json({
      success: true,
      schoolYear: schoolYear.name,
      periodsCreated: createdPeriods,
      examsUpdated: updated,
      periodMap,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Schedule conflict checker ──────────────────────────────────────────────
//
// Rules:
//   RG-EDT-01 — Teacher already booked in this time slot (blocking)
//   RG-EDT-02 — Class already has a course in this time slot (blocking)
//   RG-EDT-03 — Room already occupied in this time slot (blocking)
//   RG-EDT-04 — Room capacity insufficient for the class (blocking)
//   RG-MAT-04 — Teacher not accredited for the subject (warning)
//   RG-EDT-06 — Room type / subject category mismatch (warning)
//
router.post('/checkScheduleConflicts', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { formData = {}, editingId = null } = req.body;
    const { class_id, subject_id, teacher_id, room_id, day_of_week, start_time, end_time } = formData;
    const errors   = [];
    const warnings = [];

    if (!day_of_week || !start_time || !end_time) {
      return res.json({ errors, warnings });
    }

    if (start_time >= end_time) {
      errors.push("L'heure de fin doit être postérieure à l'heure de début.");
      return res.json({ errors, warnings });
    }

    // 1. Fetch all schedules on the same day of week (excluding the slot being edited)
    const sameDaySchedules = await prisma.schedule.findMany({
      where: {
        day_of_week,
        ...(editingId ? { id: { not: editingId } } : {}),
      },
    });

    // 2. Keep only overlapping slots (s.start < end AND s.end > start)
    const overlapping = sameDaySchedules.filter(
      s => s.start_time < end_time && s.end_time > start_time
    );

    // 3. Collect all entity IDs needed for rich error messages, then batch-fetch
    const teacherIdsNeeded = [...new Set([
      ...overlapping.map(s => s.teacher_id),
      teacher_id,
    ].filter(Boolean))];
    const classIdsNeeded = [...new Set([
      ...overlapping.map(s => s.class_id),
      class_id,
    ].filter(Boolean))];
    const subjectIdsNeeded = [...new Set([
      ...overlapping.map(s => s.subject_id),
      subject_id,
    ].filter(Boolean))];
    const roomIdsNeeded = [...new Set([
      ...overlapping.map(s => s.room_id),
      room_id,
    ].filter(Boolean))];

    const [teachers, classes, subjects, rooms] = await Promise.all([
      teacherIdsNeeded.length ? prisma.teacher.findMany({ where: { id: { in: teacherIdsNeeded } } }) : [],
      classIdsNeeded.length   ? prisma.class.findMany({ where: { id: { in: classIdsNeeded } } }) : [],
      subjectIdsNeeded.length ? prisma.subject.findMany({ where: { id: { in: subjectIdsNeeded } } }) : [],
      roomIdsNeeded.length    ? prisma.room.findMany({ where: { id: { in: roomIdsNeeded } } }) : [],
    ]);

    const tMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const cMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const sMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const rMap = Object.fromEntries(rooms.map(r => [r.id, r]));

    // ── Blocking errors ──────────────────────────────────────────────────────

    // RG-EDT-01 : enseignant déjà occupé
    if (teacher_id) {
      const conflict = overlapping.find(s => s.teacher_id === teacher_id);
      if (conflict) {
        const t  = tMap[teacher_id];
        const cl = cMap[conflict.class_id];
        errors.push(
          `RG-EDT-01 : ${t?.first_name ?? ''} ${t?.last_name ?? ''} est déjà en cours` +
          ` (${cl?.name ?? ''}) de ${conflict.start_time} à ${conflict.end_time}`
        );
      }
    }

    // RG-EDT-02 : classe déjà en cours
    if (class_id) {
      const conflict = overlapping.find(s => s.class_id === class_id);
      if (conflict) {
        const sub = sMap[conflict.subject_id];
        errors.push(
          `RG-EDT-02 : Cette classe a déjà ${sub?.name ?? 'un cours'}` +
          ` de ${conflict.start_time} à ${conflict.end_time}`
        );
      }
    }

    // RG-EDT-03 : salle déjà occupée
    if (room_id) {
      const conflict = overlapping.find(s => s.room_id === room_id);
      if (conflict) {
        const r = rMap[room_id];
        errors.push(
          `RG-EDT-03 : La salle "${r?.name ?? ''}" est déjà occupée` +
          ` de ${conflict.start_time} à ${conflict.end_time}`
        );
      }
    }

    // RG-EDT-04 : capacité salle insuffisante pour la classe
    if (room_id && class_id) {
      const room = rMap[room_id];
      const cls  = cMap[class_id];
      if (room?.capacity && cls?.capacity && cls.capacity > room.capacity) {
        errors.push(
          `RG-EDT-04 : La salle "${room.name}" (${room.capacity} places)` +
          ` est insuffisante pour la classe (${cls.capacity} élèves)`
        );
      }
    }

    // ── Soft warnings ────────────────────────────────────────────────────────

    // RG-MAT-04 : enseignant non accrédité pour la matière
    if (teacher_id && subject_id) {
      const t = tMap[teacher_id];
      if (t) {
        let sids = [];
        try { sids = JSON.parse(t.subject_ids || '[]'); } catch {}
        if (sids.length > 0 && !sids.includes(subject_id)) {
          warnings.push(
            `RG-MAT-04 : ${t.first_name} ${t.last_name} n'est pas accrédité(e) pour cette matière`
          );
        }
      }
    }

    // RG-EDT-06 : adéquation salle / catégorie de matière
    if (room_id && subject_id) {
      const room    = rMap[room_id];
      const subject = sMap[subject_id];
      if (room && subject) {
        if (subject.category === 'sciences' && room.type === 'classroom') {
          warnings.push(`RG-EDT-06 : La matière "${subject.name}" (sciences) devrait être dans un laboratoire`);
        } else if (subject.category === 'informatique' && room.type !== 'lab_info') {
          warnings.push(`RG-EDT-06 : La matière "${subject.name}" devrait être dans une salle informatique`);
        } else if (subject.category === 'sports' && !['gym', 'sports_field'].includes(room.type)) {
          warnings.push(`RG-EDT-06 : La matière "${subject.name}" (EPS) devrait être dans un espace sportif`);
        }
      }
    }

    res.json({ errors, warnings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/bulkUpdateScheduleStatus
// Met à jour le statut (publie / brouillon) d'une liste de créneaux en une seule requête.
// Remplace le pattern N×update individuel côté client.
router.post('/bulkUpdateScheduleStatus', async (req, res) => {
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '`ids` doit être un tableau non vide.' });
  }
  if (!['publie', 'brouillon'].includes(status)) {
    return res.status(400).json({ error: '`status` doit être "publie" ou "brouillon".' });
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.schedule.updateMany({
      where: { id: { in: ids } },
      data:  { status },
    });
    res.json({ success: true, updated: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ROUTES 2FA (authentifiées — session requise)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/functions/update2FAPolicy
// Admin : met à jour la politique 2FA (obligatoire ou non) pour un ou plusieurs rôles
router.post('/update2FAPolicy', requireRole('admin_systeme', 'admin'), async (req, res) => {
  const prisma = getPrisma();
  const { policies } = req.body; // { admin_systeme: true, enseignant: false, ... }
  if (!policies || typeof policies !== 'object') {
    return res.status(400).json({ error: 'policies (objet role→boolean) requis.' });
  }
  try {
    for (const [role, mandatory] of Object.entries(policies)) {
      if (!ALL_2FA_ELIGIBLE_ROLES.includes(role)) continue;
      const mandatoryInt = mandatory ? 1 : 0;
      // UPSERT : INSERT OR REPLACE
      await prisma.$executeRaw`
        INSERT INTO TwoFAPolicy (role, mandatory) VALUES (${role}, ${mandatoryInt})
        ON CONFLICT(role) DO UPDATE SET mandatory = ${mandatoryInt}`;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/get2FAStatus
// Retourne l'état 2FA de l'utilisateur connecté
router.post('/get2FAStatus', async (req, res) => {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRaw`
      SELECT two_fa_enabled FROM AppUser WHERE id = ${req.user.id} LIMIT 1`;
    const row = rows[0];
    res.json({
      two_fa_enabled: row?.two_fa_enabled === 1 || row?.two_fa_enabled === true,
      role_exempt: ROLES_WITHOUT_2FA.includes(req.user.role),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/setup2FA
// Génère un secret TOTP et renvoie l'URI otpauth + QR code (dataURL PNG)
// L'utilisateur doit ensuite confirmer avec un code valide via confirm2FA
router.post('/setup2FA', async (req, res) => {
  const prisma = getPrisma();
  // Les rôles exemptés ne peuvent pas configurer la 2FA
  if (ROLES_WITHOUT_2FA.includes(req.user.role)) {
    return res.status(403).json({ error: 'La 2FA n\'est pas disponible pour votre profil.' });
  }

  const secretObj = speakeasy.generateSecret({ length: 20 });
  const secret = secretObj.base32;
  const otpauthUrl = speakeasy.otpauthURL({ secret, label: encodeURIComponent(req.user.login), issuer: 'EduGest', encoding: 'base32' });

  try {
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: { dark: '#1e40af', light: '#ffffff' },
    });

    // Stocker le secret temporairement (sera activé à la confirmation)
    await prisma.$executeRaw`
      UPDATE AppUser SET two_fa_secret = ${secret} WHERE id = ${req.user.id}`;

    res.json({ secret, qrDataUrl, otpauthUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/confirm2FA
// Vérifie le code TOTP et active définitivement la 2FA
router.post('/confirm2FA', async (req, res) => {
  const prisma = getPrisma();
  if (ROLES_WITHOUT_2FA.includes(req.user.role)) {
    return res.status(403).json({ error: 'La 2FA n\'est pas disponible pour votre profil.' });
  }

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code requis.' });

  try {
    const rows = await prisma.$queryRaw`
      SELECT two_fa_secret FROM AppUser WHERE id = ${req.user.id} LIMIT 1`;
    const secret = rows[0]?.two_fa_secret;
    if (!secret) return res.status(400).json({ error: 'Lancez d\'abord la configuration 2FA.' });

    const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(code).replace(/\s/g, ''), window: 1 });
    if (!isValid) {
      return res.status(401).json({ error: 'Code incorrect. Vérifiez votre application d\'authentification.' });
    }

    // Activer la 2FA
    await prisma.$executeRaw`
      UPDATE AppUser SET two_fa_enabled = 1 WHERE id = ${req.user.id}`;

    res.json({ success: true, message: 'Authentification à deux facteurs activée avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/disable2FA
// Désactive la 2FA après vérification du mot de passe actuel
router.post('/disable2FA', async (req, res) => {
  const prisma = getPrisma();
  const { pin_hash } = req.body;
  if (!pin_hash) return res.status(400).json({ error: 'pin_hash requis pour désactiver la 2FA.' });

  try {
    const rows = await prisma.$queryRaw`SELECT pin_hash FROM AppUser WHERE id = ${req.user.id} LIMIT 1`;
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    if (user.pin_hash !== pin_hash) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    await prisma.$executeRaw`
      UPDATE AppUser SET two_fa_enabled = 0, two_fa_secret = NULL WHERE id = ${req.user.id}`;

    res.json({ success: true, message: 'Authentification à deux facteurs désactivée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
