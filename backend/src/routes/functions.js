const { Router } = require('express');
const crypto = require('crypto');
const { getPrisma } = require('../db');

const router = Router();

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/** Generate a random provisional password: 3 uppercase + 3 digits, e.g. "TKX849" */
function generateProvisionalPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

// POST /api/functions/appLogin
router.post('/appLogin', async (req, res) => {
  const prisma = getPrisma();
  const { login, pin_hash } = req.body;

  if (!login || !pin_hash) {
    return res.status(400).json({ error: 'login and pin_hash are required' });
  }

  try {
    const user = await prisma.appUser.findFirst({
      where: { login: login.toLowerCase() },
    });

    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Compte suspendu. Contactez l\'administration.' });
    if (user.pin_hash !== pin_hash) return res.status(401).json({ error: 'Identifiants incorrects' });

    await prisma.appUser.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    const { pin_hash: _, ...safeUser } = user;
    res.json({ ...safeUser, must_change_pin: user.must_change_pin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appUpdatePin
router.post('/appUpdatePin', async (req, res) => {
  const prisma = getPrisma();
  const { user_id, current_pin_hash, new_pin_hash } = req.body;

  if (!user_id || !new_pin_hash) {
    return res.status(400).json({ error: 'user_id and new_pin_hash are required' });
  }

  try {
    const user = await prisma.appUser.findUnique({ where: { id: user_id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (current_pin_hash && user.pin_hash !== current_pin_hash) {
      return res.status(401).json({ error: 'PIN actuel incorrect' });
    }

    const updated = await prisma.appUser.update({
      where: { id: user_id },
      data: { pin_hash: new_pin_hash, must_change_pin: false },
    });

    const { pin_hash: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/appUserAdmin
router.post('/appUserAdmin', async (req, res) => {
  const prisma = getPrisma();

  // Support both flat payload and nested { action, payload: {...} }
  const body = req.body || {};
  const action = body.action;
  const data = { ...body, ...(body.payload || {}) };
  const { id, login, pin, pin_hash, full_name, role, member_type, member_id, status, must_change_pin } = data;

  try {
    switch (action) {
      case 'list': {
        const users = await prisma.appUser.findMany({ orderBy: { created_date: 'desc' } });
        return res.json(users.map(({ pin_hash: _, ...u }) => u));
      }

      case 'create': {
        if (!login || !role) return res.status(400).json({ error: 'login et rôle sont requis' });
        // Check uniqueness
        const existing = await prisma.appUser.findFirst({ where: { login: login.toLowerCase() } });
        if (existing) return res.status(409).json({ error: `L'identifiant "${login}" est déjà utilisé` });

        const provisionalPassword = generateProvisionalPassword();
        const hash = pin_hash || (pin ? sha256(pin) : sha256(provisionalPassword));
        const isProvisional = !pin_hash && !pin; // auto-generated password

        const user = await prisma.appUser.create({
          data: {
            login: login.toLowerCase(),
            pin_hash: hash,
            full_name: full_name || '',
            role,
            member_type: member_type || 'none',
            member_id: member_id || null,
            status: status || 'active',
            must_change_pin: must_change_pin ?? isProvisional,
          },
        });
        const { pin_hash: _, ...safeUser } = user;
        return res.status(201).json({
          ...safeUser,
          ...(isProvisional && { provisional_password: provisionalPassword }),
        });
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
        const { pin_hash: _, ...safeUser } = user;
        return res.json(safeUser);
      }

      case 'delete': {
        if (!id) return res.status(400).json({ error: 'id requis' });
        await prisma.appUser.delete({ where: { id } });
        return res.json({ success: true });
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

module.exports = router;
