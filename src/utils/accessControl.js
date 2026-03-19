/**
 * Contrôle d'accès frontend — filtrage des niveaux et classes selon le rôle.
 * Coordonné avec applyAccessFilter() côté backend (entities.js).
 */
import { getCurrentSystemConfig } from '@/components/config/educationSystems';
import { getSession } from '@/components/auth/appAuth';

// Rôle → index de cycle dans config.cycles (0=primaire, 1=collège/moyen, 2=lycée)
const ROLE_CYCLE_INDEX = {
  directeur_primaire: 0,
  directeur_college:  1,
  directeur_lycee:    2,
};

/**
 * Retourne les indices de cycles effectifs pour l'utilisateur connecté.
 * - Directeur : tableau avec un seul index fixe
 * - CPE / Secrétaire : tableau d'indices depuis assigned_cycles
 * - Autres : null (pas de restriction)
 */
function getEffectiveCycleIndices(session) {
  if (!session) return null;
  const directorIdx = ROLE_CYCLE_INDEX[session.role];
  if (directorIdx !== undefined) return [directorIdx];

  if (session.role === 'cpe' || session.role === 'secretaire') {
    try {
      const cycles = session.assigned_cycles
        ? (Array.isArray(session.assigned_cycles) ? session.assigned_cycles : JSON.parse(session.assigned_cycles))
        : [];
      return cycles.length ? cycles : null;
    } catch { return null; }
  }
  return null;
}

/**
 * Retourne les niveaux accessibles à l'utilisateur connecté.
 * Admins et rôles non restreints → tous les niveaux.
 * Directeurs / CPE / Secrétaire → uniquement les niveaux de leur(s) cycle(s).
 */
export function getAccessibleLevels() {
  const session = getSession();
  if (!session) return [];

  const cycleIndices = getEffectiveCycleIndices(session);
  if (cycleIndices === null) {
    return getCurrentSystemConfig().allLevels;
  }

  const config = getCurrentSystemConfig();
  const levels = [];
  for (const idx of cycleIndices) {
    const cyc = config.cycles[idx];
    if (cyc) levels.push(...cyc.levels);
  }
  return levels.length ? levels : config.allLevels;
}

/**
 * Retourne true si l'utilisateur voit toutes les données (pas de restriction de cycle).
 */
export function hasFullAccess() {
  const session = getSession();
  if (!session) return false;
  return getEffectiveCycleIndices(session) === null;
}

/**
 * Retourne les noms des cycles accessibles (pour les filtres par type dans Affectation).
 * Ex: directeur_primaire → ["École Primaire"]
 */
export function getAccessibleCycleNames() {
  const session = getSession();
  if (!session) return [];

  const cycleIndices = getEffectiveCycleIndices(session);
  const config = getCurrentSystemConfig();

  if (cycleIndices === null) {
    return config.cycles.map(c => c.name);
  }

  return cycleIndices.map(idx => config.cycles[idx]?.name).filter(Boolean);
}

/**
 * Filtre une liste de classes selon les niveaux accessibles au rôle actuel.
 * (Renfort UI — le backend filtre déjà via X-User-Id)
 */
export function filterAccessibleClasses(classes = []) {
  if (hasFullAccess()) return classes;
  const levels = getAccessibleLevels();
  return classes.filter(c => !c.level || levels.includes(c.level));
}

/**
 * Retourne le code du système éducatif actuel (pour le header X-Education-System).
 */
export function getEducationSystemCode() {
  return localStorage.getItem('edugest_education_system') || 'francais';
}
