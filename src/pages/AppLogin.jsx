import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { hashPin, saveSession, getSession } from "@/components/auth/appAuth";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, School, Lock, User, Loader2, AlertCircle } from "lucide-react";

export default function AppLogin() {
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mustChangePin, setMustChangePin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pendingUser, setPendingUser] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    const session = getSession();
    if (session) {
      window.location.href = createPageUrl("Dashboard");
    }
  }, []);

  const callFunction = async (fnName, payload) => {
    const appId = import.meta.env.VITE_APP_ID || window.__APP_ID__;
    const res = await fetch(`/api/functions/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!login.trim() || !pin.trim()) {
      setError("Veuillez renseigner votre identifiant et votre PIN.");
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
      setError(data.error);
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

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (newPin.length < 4) { setError("Le PIN doit contenir au moins 4 chiffres."); return; }
    if (newPin !== confirmPin) { setError("Les PINs ne correspondent pas."); return; }
    setLoading(true);
    setError("");
    const pinHash = await hashPin(newPin);
    await base44.functions.invoke("appUpdatePin", { user_id: pendingUser.id, pin_hash: pinHash });
    const updatedUser = { ...pendingUser, pin_hash: pinHash, must_change_pin: false };
    saveSession(updatedUser);
    window.location.href = createPageUrl("Dashboard");
    setLoading(false);
  };

  if (mustChangePin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Changement de PIN requis</h2>
              <p className="text-sm text-slate-500 mt-1">
                Bonjour <strong>{pendingUser?.full_name}</strong>, définissez votre nouveau PIN.
              </p>
            </div>
            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nouveau PIN (min. 4 chiffres)</label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Confirmer le PIN</label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmer et accéder
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <p className="text-sm text-slate-500 mb-6">Entrez votre identifiant et votre PIN</p>

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
                <label className="text-sm font-medium text-slate-700 block mb-1">PIN</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showPin ? "text" : "password"}
                    placeholder="Votre PIN"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="pl-9 pr-10 text-center tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              <p>🎒 <strong>Élève</strong> : numéro étudiant + PIN</p>
              <p>👨‍👩‍👧 <strong>Parent</strong> : email ou téléphone + PIN</p>
              <p>📚 <strong>Enseignant</strong> : email ou téléphone + PIN</p>
              <p className="text-[10px] text-slate-400 pt-1">Contactez l'administration si vous avez perdu votre PIN.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}