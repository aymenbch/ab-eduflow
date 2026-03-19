import React, { useState, useEffect, useRef } from "react";
import { hashPin, getSession, saveSession } from "@/components/auth/appAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
  CheckCircle2, XCircle, AlertCircle, Loader2, Camera, Save, X, BookOpen,
} from "lucide-react";
import { ROLES } from "@/components/roles/roles";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentSystemConfig } from "@/components/config/educationSystems";

/* ── Règles de complexité ─────────────────────────────── */
const MIN_PWD = 8;
const COMPLEXITY_RULES = [
  { id: "length",  label: `Au moins ${MIN_PWD} caractères`,            test: (v) => v.length >= MIN_PWD },
  { id: "upper",   label: "Au moins une lettre majuscule (A-Z)",       test: (v) => /[A-Z]/.test(v) },
  { id: "lower",   label: "Au moins une lettre minuscule (a-z)",       test: (v) => /[a-z]/.test(v) },
  { id: "digit",   label: "Au moins un chiffre (0-9)",                 test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "Au moins un caractère spécial (!@#$%…)",    test: (v) => /[^a-zA-Z0-9]/.test(v) },
];
const allPassed = (v) => COMPLEXITY_RULES.every((r) => r.test(v));

function PasswordRules({ password, show }) {
  if (!show || password.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs rounded-lg border p-3 bg-slate-50">
      {COMPLEXITY_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={`flex items-center gap-2 font-medium transition-colors duration-200 ${ok ? "text-green-600" : "text-red-500"}`}>
            {ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

/* ── callFunction helper ─────────────────────────────── */
async function callFn(name, payload) {
  const res = await fetch(`/api/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/* ═══════════════════════════════════════════════════════ */
export default function MonProfil() {
  const session = getSession();
  const roleConfig = session?.role ? ROLES[session.role] : null;
  const { toast } = useToast();

  /* ── État profil ── */
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [photo,   setPhoto]   = useState(null); // base64 data URL
  const [assignedCycles, setAssignedCycles] = useState([]); // array of cycle indices [0,1,2]
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError,  setProfileError]  = useState("");
  const fileInputRef = useRef(null);

  /* Cycles du système éducatif actuel */
  const systemCycles = getCurrentSystemConfig().cycles;
  const showCycleSelector = session?.role === 'cpe' || session?.role === 'secretaire';

  /* ── État mot de passe ── */
  const [currentPwd,    setCurrentPwd]    = useState("");
  const [newPwd,        setNewPwd]        = useState("");
  const [confirmPwd,    setConfirmPwd]    = useState("");
  const [showCurrent,   setShowCurrent]   = useState(false);
  const [showNew,       setShowNew]       = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [newPwdTouched, setNewPwdTouched] = useState(false);
  const [savingPwd,     setSavingPwd]     = useState(false);
  const [pwdError,      setPwdError]      = useState("");

  /* ── Chargement du profil ── */
  useEffect(() => {
    if (!session?.id) return;
    (async () => {
      setLoadingProfile(true);
      const data = await callFn("appGetProfile", { user_id: session.id });
      if (!data.error) {
        setProfile(data);
        setEmail(data.email   || "");
        setPhone(data.phone   || "");
        setAddress(data.address || "");
        setPhoto(data.photo   || null);
        try {
          setAssignedCycles(data.assigned_cycles ? JSON.parse(data.assigned_cycles) : []);
        } catch { setAssignedCycles([]); }
      }
      setLoadingProfile(false);
    })();
  }, []);

  /* ── Upload photo ── */
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("La photo ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setPhoto(null);
    await callFn("appClearProfileField", { user_id: session.id, field: "photo" });
    toast({ title: "Photo supprimée" });
  };

  /* ── Toggle cycle ── */
  const toggleCycle = (idx) => {
    setAssignedCycles(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  /* ── Sauvegarde profil ── */
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setSavingProfile(true);
    const payload = {
      user_id: session.id,
      email:   email.trim()   || null,
      phone:   phone.trim()   || null,
      address: address.trim() || null,
      photo:   photo          || null,
    };
    const data = await callFn("appUpdateProfile", payload);
    setSavingProfile(false);
    if (data.error) {
      setProfileError(data.error);
      return;
    }
    setProfile(data);
    toast({ title: "✅ Profil mis à jour", description: "Vos informations ont été enregistrées." });
  };

  /* ── Sauvegarde mot de passe ── */
  const newPwdValid   = allPassed(newPwd);
  const pwdsMatch     = newPwd.length > 0 && newPwd === confirmPwd;
  const canSavePwd    = currentPwd.length >= MIN_PWD && newPwdValid && pwdsMatch;

  const handleSavePwd = async (e) => {
    e.preventDefault();
    setPwdError("");
    if (!newPwdValid) { setPwdError("Le nouveau mot de passe ne respecte pas toutes les règles."); return; }
    if (!pwdsMatch)    { setPwdError("Les mots de passe ne correspondent pas."); return; }

    setSavingPwd(true);
    const currentHash = await hashPin(currentPwd);
    const newHash     = await hashPin(newPwd);
    const data = await callFn("appUpdateProfile", {
      user_id:          session.id,
      current_pin_hash: currentHash,
      new_pin_hash:     newHash,
    });
    setSavingPwd(false);
    if (data.error) { setPwdError(data.error); return; }

    // Réinitialiser les champs
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setNewPwdTouched(false);
    toast({ title: "✅ Mot de passe modifié", description: "Votre mot de passe a été mis à jour avec succès." });
  };

  /* ── Avatar initiales (fallback) ── */
  const initials = (profile?.full_name || session?.full_name || "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── En-tête profil ── */}
      <Card className="overflow-hidden">
        <div className={`h-24 bg-gradient-to-r ${roleConfig?.color || "from-blue-500 to-blue-700"}`} />
        <CardContent className="pt-0 pb-6 px-6">
          <div className="flex items-end gap-4 -mt-10">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <div className={`w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden
                bg-gradient-to-br ${roleConfig?.color || "from-blue-400 to-blue-600"}
                flex items-center justify-center`}>
                {photo
                  ? <img src={photo} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-bold text-white">{initials}</span>
                }
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100
                           transition-opacity flex items-center justify-center"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Infos */}
            <div className="pb-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {profile?.full_name || session?.full_name || "Utilisateur"}
              </h2>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                text-white bg-gradient-to-r ${roleConfig?.color || "from-blue-500 to-blue-600"} mt-1`}>
                <span>{roleConfig?.icon}</span>
                <span>{roleConfig?.label}</span>
              </div>
            </div>

            {/* Supprimer photo */}
            {photo && (
              <Button
                variant="ghost" size="sm"
                className="ml-auto text-slate-400 hover:text-red-500 text-xs"
                onClick={handleRemovePhoto}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Supprimer la photo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Onglets ── */}
      <Tabs defaultValue="profil">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profil">
            <User className="w-4 h-4 mr-2" /> Informations personnelles
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="w-4 h-4 mr-2" /> Mot de passe
          </TabsTrigger>
        </TabsList>

        {/* ═══ Onglet Profil ═══ */}
        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mes coordonnées</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">

                {/* Identifiant (lecture seule) */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Identifiant de connexion <span className="text-xs text-slate-400">(non modifiable)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input value={profile?.login || session?.login || ""} disabled className="pl-9 bg-slate-50 text-slate-400 cursor-not-allowed" />
                  </div>
                </div>

                {/* Nom complet (lecture seule) */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Nom complet <span className="text-xs text-slate-400">(modifiable par l'administration)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input value={profile?.full_name || session?.full_name || ""} disabled className="pl-9 bg-slate-50 text-slate-400 cursor-not-allowed" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Adresse e-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Téléphone */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Numéro de téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="tel"
                      placeholder="+213 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Adresse */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Adresse</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      placeholder="Votre adresse postale…"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm
                                 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none
                                 focus-visible:ring-1 focus-visible:ring-ring pl-9 resize-none"
                    />
                  </div>
                </div>

                {/* Cycles assignés — lecture seule pour CPE et Secrétaire */}
                {showCycleSelector && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      <BookOpen className="inline w-4 h-4 mr-1.5 text-slate-400" />
                      Cycles concernés par mon poste
                      <span className="ml-2 text-xs font-normal text-slate-400">(défini par l'administration)</span>
                    </label>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      {systemCycles.map((cycle, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            assignedCycles.includes(idx)
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white border-slate-300"
                          }`}>
                            {assignedCycles.includes(idx) && (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className={`text-sm ${assignedCycles.includes(idx) ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                            {cycle.name}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {cycle.levels.join(", ")}
                          </span>
                        </div>
                      ))}
                      {assignedCycles.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ Aucun cycle assigné — contactez l'administration.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo — upload direct depuis la carte d'en-tête, mais on peut aussi changer ici */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Photo de profil</label>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden border flex items-center justify-center
                      bg-gradient-to-br ${roleConfig?.color || "from-blue-400 to-blue-600"}`}>
                      {photo
                        ? <img src={photo} alt="preview" className="w-full h-full object-cover" />
                        : <span className="text-sm font-bold text-white">{initials}</span>
                      }
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        {photo ? "Changer" : "Choisir"}
                      </Button>
                      {photo && (
                        <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={() => setPhoto(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">JPG, PNG — max 2 Mo</p>
                  </div>
                </div>

                {/* Erreur */}
                {profileError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {profileError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer les modifications
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Onglet Mot de passe ═══ */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Changer mon mot de passe</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePwd} className="space-y-4">

                {/* Mot de passe actuel */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Mot de passe actuel</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type={showCurrent ? "text" : "password"}
                      placeholder="Votre mot de passe actuel"
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="pl-9 pr-10"
                      autoComplete="current-password"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nouveau mot de passe */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type={showNew ? "text" : "password"}
                      placeholder="Choisissez un mot de passe sécurisé"
                      value={newPwd}
                      onChange={e => { setNewPwd(e.target.value); setNewPwdTouched(true); }}
                      className="pl-9 pr-10"
                      autoComplete="new-password"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordRules password={newPwd} show={newPwdTouched} />
                </div>

                {/* Confirmer le nouveau mot de passe */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Répétez le nouveau mot de passe"
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      className="pl-9 pr-10"
                      autoComplete="new-password"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPwd.length > 0 && (
                    <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium transition-colors duration-200 ${pwdsMatch ? "text-green-600" : "text-red-500"}`}>
                      {pwdsMatch
                        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Les mots de passe correspondent</>
                        : <><XCircle      className="w-3.5 h-3.5" /> Les mots de passe ne correspondent pas</>
                      }
                    </div>
                  )}
                </div>

                {/* Compteur de règles */}
                {newPwdTouched && newPwd.length > 0 && (
                  <p className="text-xs text-slate-400 text-center">
                    {COMPLEXITY_RULES.filter(r => r.test(newPwd)).length} / {COMPLEXITY_RULES.length} règles respectées
                  </p>
                )}

                {/* Erreur */}
                {pwdError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {pwdError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={savingPwd || !canSavePwd}>
                  {savingPwd ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
