require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

const DEFAULT_PIN = '1234';
const PIN_HASH = sha256(DEFAULT_PIN);

const ACCOUNTS = [
  { login: 'admin',        full_name: 'Administrateur Système', role: 'admin_systeme',     member_type: 'none' },
  { login: 'directeur',    full_name: 'Directeur Général',      role: 'directeur_general', member_type: 'none' },
  { login: 'dir.primaire', full_name: 'Directeur Primaire',     role: 'directeur_primaire',member_type: 'none' },
  { login: 'dir.college',  full_name: 'Directeur Collège',      role: 'directeur_college', member_type: 'none' },
  { login: 'dir.lycee',    full_name: 'Directeur Lycée',        role: 'directeur_lycee',   member_type: 'none' },
  { login: 'cpe',          full_name: 'CPE',                    role: 'cpe',               member_type: 'Staff' },
  { login: 'enseignant',   full_name: 'Enseignant Démo',        role: 'enseignant',        member_type: 'Teacher' },
  { login: 'secretaire',   full_name: 'Secrétaire',             role: 'secretaire',        member_type: 'Staff' },
  { login: 'comptable',    full_name: 'Comptable',              role: 'comptable',         member_type: 'Staff' },
  { login: 'eleve',        full_name: 'Élève Démo',             role: 'eleve',             member_type: 'Student' },
  { login: 'parent',       full_name: 'Parent Démo',            role: 'parent',            member_type: 'none' },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  for (const account of ACCOUNTS) {
    const existing = await prisma.appUser.findFirst({ where: { login: account.login } });
    if (existing) {
      console.log(`  ⏭️  ${account.login} (${account.role}) — already exists, skipped`);
      continue;
    }

    await prisma.appUser.create({
      data: {
        login: account.login,
        pin_hash: PIN_HASH,
        full_name: account.full_name,
        role: account.role,
        member_type: account.member_type,
        status: 'active',
        must_change_pin: false,
      },
    });
    console.log(`  ✅ ${account.login} (${account.role})`);
  }

  console.log('\n📋 Comptes créés (PIN par défaut : 1234)\n');
  console.log('  Login          | Rôle');
  console.log('  ─────────────────────────────────────────');
  for (const a of ACCOUNTS) {
    console.log(`  ${a.login.padEnd(14)} | ${a.role}`);
  }
  console.log('');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
