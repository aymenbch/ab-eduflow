import React, { useState, useEffect } from "react";
import { hashPin, saveSession, getSession } from "@/components/auth/appAuth";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, School, Lock, User, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

/* ── Règles de complexité ─────────────────────────────── */
const COMPLEXITY_RULES = [
  { id: "length",    label: `Au moins ${MIN_PASSWORD_LENGTH} caractères`,    test: (v) => v.length >= MIN_PASSWORD_LENGTH },
  { id: "upper",     label: "Au moins une lettre majuscule (A-Z)",            test: (v) => /[A-Z]/.test(v) },
  { id: "lower",     label: "Au moins une lettre minuscule (a-z)",            test: (v) => /[a-z]/.test(v) },
  { id: "digit",     label: "Au moins un chiffre (0-9)",                      test: (v) => /[0-9]/.test(v) },
  { id: "special",   label: "Au moins un caractère spécial (!@#$%…)",         test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

function checkRules(pwd) {
  return COMPLEXITY_RULES.map((r) => ({ ...r, passed: r.test(pwd) }));
}

function allRulesPassed(pwd) {
  return COMPLEXITY_RULES.every((r) => r.test(pwd));
}

/* ── Composant liste des règles ───────────────────────── */
function PasswordRules({ password, show }) {
  if (!show) return null;
  const rules = checkRules(password);
  return (
    <ul className="mt-2 space-y-1 text-xs rounded-lg border p-3 bg-slate-50">
      {rules.map((r) => (
        <li key={r.id} className={`flex items-center gap-2 font-medium transition-colors duration-200 ${
          r.passed ? "text-green-600" : "text-red-500"
        }`}>
          {r.passed
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            : <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />
          }
          {r.label}
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function AppLogin() {
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Changement de mot de passe ── */
  const [mustChangePin, setMustChangePin] = useState(false);
  const [newPin, setNewPin]           = useState("");
  const [confirmPin, setConfirmPin]   = useState("");
  const [showNewPin, setShowNewPin]   = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [newPinTouched, setNewPinTouched]   = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    const session = getSession();
    if (session) window.location.href = createPageUrl("Dashboard");
  }, []);

  const callFunction = async (fnName, payload) => {
    const res = await fetch(`/api/functions/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  /* ── Connexion ───────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!login.trim() || !pin.trim()) {
      setError("Veuillez renseigner votre identifiant et votre mot de passe.");
      return;
    }
    if (pin.trim().length < MIN_PASSWORD_LENGTH) {
      setError("Identifiants incorrects ou compte inactif.");
      return;
    }
    setLoading(true);
    setError("");
    const pinHash = await hashPin(pin.trim());
    const data = await callFunction("appLogin", {
      login: login.trim().toLowerCase(),
      pin_hash: pinHash,
    });
    if (data.error) {
      // Message spécifique selon le type d'erreur
      if (data.locked) {
        setError(data.error); // afficher le message de verrouillage tel quel
      } else {
        setError("Identifiants incorrects ou compte inactif.");
      }
      setLoading(false);
      return;
    }
    if (data.must_change_pin) {
      setPendingUser(data);
      setMustChangePin(true);
    } else {
      saveSession(data);
      window.location.href = createPageUrl("Dashboard");
    }
    setLoading(false);
  };

  /* ── Validation complexité ───────────────────────────── */
  const newPinValid    = allRulesPassed(newPin);
  const passwordsMatch = newPin.length > 0 && newPin === confirmPin;
  const canSubmit      = newPinValid && passwordsMatch;

  /* ── Changement de mot de passe ─────────────────────── */
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!newPinValid) {
      setError("Le mot de passe ne respecte pas toutes les règles requises.");
      return;
    }
    if (!passwordsMatch) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    const newHash = await hashPin(newPin);
    const data = await callFunction("appUpdatePin", {
      user_id:      pendingUser.id,
      new_pin_hash: newHash,
    });
    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    // data contient déjà must_change_pin:false et last_login mis à jour
    saveSession({ ...pendingUser, pin_hash: newHash, must_change_pin: false });
    window.location.href = createPageUrl("Dashboard");
    setLoading(false);
  };

  /* ════════════════════════════════════════════════════════
     VUE : Changement de mot de passe obligatoire
  ════════════════════════════════════════════════════════ */
  if (mustChangePin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8">
            {/* En-tête */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Changement de mot de passe requis</h2>
              <p className="text-sm text-slate-500 mt-1">
                Bonjour <strong>{pendingUser?.full_name}</strong>, vous devez définir un nouveau mot de passe
                avant d'accéder à l'application.
              </p>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              {/* Nouveau mot de passe */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showNewPin ? "text" : "password"}
                    placeholder="Choisissez un mot de passe sécurisé"
                    value={newPin}
                    onChange={e => { setNewPin(e.target.value); setNewPinTouched(true); }}
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Règles de complexité (affichées dès le 1er caractère) */}
                <PasswordRules password={newPin} show={newPinTouched} />
              </div>

              {/* Confirmer le mot de passe */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showConfirmPin ? "text" : "password"}
                    placeholder="Répétez le mot de passe"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Indicateur de correspondance */}
                {confirmPin.length > 0 && (
                  <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium transition-colors duration-200 ${
                    passwordsMatch ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordsMatch
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Les mots de passe correspondent</>
                      : <><XCircle      className="w-3.5 h-3.5" /> Les mots de passe ne correspondent pas</>
                    }
                  </div>
                )}
              </div>

              {/* Erreur générale */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Bouton — désactivé tant que les règles ne sont pas toutes respectées */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base"
                disabled={loading || !canSubmit}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmer et accéder
              </Button>

              {/* Indicateur de progression global */}
              {newPinTouched && (
                <p className="text-center text-xs text-slate-400">
                  {checkRules(newPin).filter(r => r.passed).length} / {COMPLEXITY_RULES.length} règles respectées
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Connexion normale
  ════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">EduGest</h1>
          <p className="text-blue-200 text-sm mt-1">Plateforme de gestion scolaire</p>
        </div>

        <Card className="shadow-2xl">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Connexion</h2>
            <p className="text-sm text-slate-500 mb-6">Entrez votre identifiant et votre mot de passe</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Identifiant</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="N° étudiant, email ou téléphone"
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    className="pl-9"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showPin ? "text" : "password"}
                    placeholder="Votre mot de passe (min. 8 caractères)"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Se connecter
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
              <p>🎒 <strong>Élève</strong> : numéro étudiant + mot de passe</p>
              <p>👨‍👩‍👧 <strong>Parent</strong> : email ou téléphone + mot de passe</p>
              <p>📚 <strong>Enseignant</strong> : email ou téléphone + mot de passe</p>
              <p className="text-[10px] text-slate-400 pt-1">Contactez l'administration si vous avez oublié votre mot de passe.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
