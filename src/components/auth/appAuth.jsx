/**
 * EduGest internal auth system (Option B)
 * Session stored in localStorage, PIN hashed with simple SHA-256
 */

const SESSION_KEY = "edugest_session";

/** Simple SHA-256 hash of a string */
export async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(String(pin));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Save session to localStorage */
export function saveSession(appUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: appUser.id,
    login: appUser.login,
    full_name: appUser.full_name,
    role: appUser.role,
    member_id: appUser.member_id,
    member_type: appUser.member_type,
    must_change_pin: appUser.must_change_pin,
    ts: Date.now(),
  }));
  // Keep legacy role key for layout compatibility
  localStorage.setItem("edugest_role", appUser.role);
}

/** Get current session */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear session */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("edugest_role");
}

/** Is logged in? */
export function isLoggedIn() {
  return !!getSession();
}