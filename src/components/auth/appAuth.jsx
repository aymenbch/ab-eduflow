/**
 * EduGest — Gestion de session (localStorage)
 *
 * Règles :
 *  - Session stockée dans localStorage (clé : "edugest_session")
 *  - Contient : id, login, full_name, role, member_id, member_type
 *  - Pas d'expiration automatique → session permanente jusqu'à déconnexion manuelle
 *  - La déconnexion efface la session et renvoie vers /AppLogin
 *  - Le mot de passe est haché en SHA-256 côté client avant tout envoi au serveur
 */

const SESSION_KEY = "edugest_session";

/* ── SHA-256 (côté client) ─────────────────────────── */
export async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(String(pin));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── Sauvegarder la session ────────────────────────── */
export function saveSession(appUser) {
  const session = {
    id:             appUser.id,
    login:          appUser.login,
    full_name:      appUser.full_name,
    role:           appUser.role,
    member_id:      appUser.member_id    ?? null,
    member_type:    appUser.member_type  ?? "none",
    // Champ fonctionnel (flux de changement de mot de passe obligatoire)
    must_change_pin: appUser.must_change_pin ?? false,
    // Token HMAC signé côté serveur — envoyé dans X-Session-Token à chaque requête
    // Permet au backend de vérifier que le userId n'a pas été forgé côté client
    token:          appUser.token ?? null,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Clé legacy pour la compatibilité du Layout
  localStorage.setItem("edugest_role", appUser.role);
}

/* ── Lire la session ────────────────────────────────── */
// Aucune vérification d'expiration : la session est permanente
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ── Effacer la session (déconnexion) ───────────────── */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("edugest_role");
}

/* ── Vérifier si connecté ───────────────────────────── */
export function isLoggedIn() {
  return !!getSession();
}
