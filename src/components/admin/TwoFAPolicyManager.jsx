import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldOff, Loader2, AlertCircle, CheckCircle2, Save } from "lucide-react";

/* ── Rôles pouvant être soumis à la politique 2FA ── */
const ROLE_LABELS = {
  admin_systeme:       { label: "Administrateur Système",  icon: "🔐", desc: "Accès complet à la gestion du système" },
  directeur_general:   { label: "Directeur Général",        icon: "🏫", desc: "Direction générale de l'établissement" },
  directeur_primaire:  { label: "Directeur Primaire",       icon: "📚", desc: "Direction du cycle primaire" },
  directeur_college:   { label: "Directeur Collège",        icon: "📚", desc: "Direction du collège" },
  directeur_lycee:     { label: "Directeur Lycée",          icon: "📚", desc: "Direction du lycée" },
  cpe:                 { label: "CPE / Censeur",            icon: "👁", desc: "Conseiller principal d'éducation" },
  enseignant:          { label: "Enseignant",               icon: "👨‍🏫", desc: "Corps enseignant" },
  secretaire:          { label: "Secrétaire",               icon: "📋", desc: "Secrétariat et administration" },
  comptable:           { label: "Comptable",                icon: "💰", desc: "Gestion financière" },
  parent:              { label: "Parent",                   icon: "👨‍👩‍👧", desc: "Parents des élèves" },
  eleve:               { label: "Élève",                   icon: "🎒", desc: "Élèves de l'établissement" },
};

function getAuthHeaders() {
  try {
    const session = JSON.parse(localStorage.getItem("edugest_session") || "null");
    const headers = { "Content-Type": "application/json" };
    if (session?.token) headers["X-Session-Token"] = session.token;
    if (session?.id)    headers["X-User-Id"]       = session.id;
    return headers;
  } catch {
    return { "Content-Type": "application/json" };
  }
}

async function callFn(name, payload) {
  const res = await fetch(`/api/functions/${name}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default function TwoFAPolicyManager() {
  const [policies, setPolicies]   = useState({});
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [msg,      setMsg]        = useState({ type: "", text: "" });
  const [dirty,    setDirty]      = useState(false);

  /* ── Chargement de la politique actuelle ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await callFn("get2FAPolicy", {});
      if (!data.error) setPolicies(data.policies || {});
      setLoading(false);
    })();
  }, []);

  const toggleRole = (role) => {
    setPolicies(prev => ({ ...prev, [role]: !prev[role] }));
    setDirty(true);
    setMsg({ type: "", text: "" });
  };

  const selectAll = () => {
    const allOn = {};
    for (const role of Object.keys(ROLE_LABELS)) allOn[role] = true;
    setPolicies(allOn);
    setDirty(true);
    setMsg({ type: "", text: "" });
  };

  const selectNone = () => {
    const allOff = {};
    for (const role of Object.keys(ROLE_LABELS)) allOff[role] = false;
    setPolicies(allOff);
    setDirty(true);
    setMsg({ type: "", text: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg({ type: "", text: "" });
    const data = await callFn("update2FAPolicy", { policies });
    setSaving(false);
    if (data.error) {
      setMsg({ type: "error", text: data.error });
    } else {
      setDirty(false);
      setMsg({ type: "success", text: "Politique 2FA enregistrée. Les changements prendront effet à la prochaine connexion des utilisateurs concernés." });
    }
  };

  const mandatoryCount = Object.values(policies).filter(Boolean).length;
  const totalCount     = Object.keys(ROLE_LABELS).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Résumé ── */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {mandatoryCount === 0
                ? "2FA non obligatoire pour aucun rôle"
                : mandatoryCount === totalCount
                ? "2FA obligatoire pour tous les rôles"
                : `2FA obligatoire pour ${mandatoryCount} / ${totalCount} rôles`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Les utilisateurs des rôles sélectionnés devront configurer la 2FA à leur prochaine connexion si elle n'est pas encore activée.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={selectAll}  className="text-xs">Tout activer</Button>
          <Button variant="outline" size="sm" onClick={selectNone} className="text-xs">Tout désactiver</Button>
        </div>
      </div>

      {/* ── Liste des rôles ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration par rôle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(ROLE_LABELS).map(([role, { label, icon, desc }]) => {
            const isOn = !!policies[role];
            return (
              <div
                key={role}
                onClick={() => toggleRole(role)}
                className={`flex items-center gap-4 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                  isOn
                    ? "bg-blue-50 border-blue-300 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {/* Toggle */}
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  isOn ? "bg-blue-600" : "bg-slate-300"
                }`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    isOn ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </div>

                {/* Icône + texte */}
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${isOn ? "text-blue-900" : "text-slate-700"}`}>
                    {label}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{desc}</p>
                </div>

                {/* Badge statut */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  isOn
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {isOn ? "Obligatoire" : "Optionnel"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Message feedback ── */}
      {msg.text && (
        <div className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${
          msg.type === "error"
            ? "text-red-600 bg-red-50 border-red-200"
            : "text-green-700 bg-green-50 border-green-200"
        }`}>
          {msg.type === "error"
            ? <AlertCircle  className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          }
          {msg.text}
        </div>
      )}

      {/* ── Bouton sauvegarder ── */}
      <Button
        onClick={handleSave}
        disabled={saving || !dirty}
        className="w-full bg-blue-600 hover:bg-blue-700 h-11"
      >
        {saving
          ? <Loader2    className="w-4 h-4 animate-spin mr-2" />
          : <Save       className="w-4 h-4 mr-2" />
        }
        {dirty ? "Enregistrer la politique 2FA" : "Aucune modification en attente"}
      </Button>

      {/* ── Note d'information ── */}
      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
        <p>ℹ️ <strong>Comment ça fonctionne :</strong></p>
        <p>• Si un rôle est marqué <strong>Obligatoire</strong>, les utilisateurs qui n'ont pas encore activé la 2FA seront forcés de la configurer dès leur prochaine connexion.</p>
        <p>• Les utilisateurs qui ont déjà la 2FA activée ne seront pas affectés par ce changement.</p>
        <p>• La 2FA est disponible pour <strong>tous les profils</strong>, y compris les parents et les élèves.</p>
      </div>
    </div>
  );
}
