import React, { useState, useCallback } from "react";
import { ROLES, ALL_PAGES_BY_CATEGORY } from "@/components/roles/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, RotateCcw, Save, ShieldCheck, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "edugest_role_permissions";

// Pages that can never be removed from a role (safety locks)
const LOCKED_PAGES = {
  admin_systeme: ["Dashboard", "Administration"],
};
// Dashboard is always accessible to everyone
const ALWAYS_ON = ["Dashboard"];

function loadPermissions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return Object.fromEntries(
    Object.entries(ROLES).map(([k, v]) => [k, [...v.pages]])
  );
}

export default function RolePermissionsManager() {
  const [permissions, setPermissions] = useState(loadPermissions);
  const [selectedRole, setSelectedRole] = useState("directeur_general");
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const currentPages = permissions[selectedRole] || [];
  const locked = LOCKED_PAGES[selectedRole] || [];

  const handleToggle = useCallback((pageKey) => {
    if (ALWAYS_ON.includes(pageKey) || locked.includes(pageKey)) return;
    setPermissions((prev) => {
      const current = prev[selectedRole] || [];
      const updated = current.includes(pageKey)
        ? current.filter((p) => p !== pageKey)
        : [...current, pageKey];
      return { ...prev, [selectedRole]: updated };
    });
    setHasChanges(true);
    setSaved(false);
  }, [selectedRole, locked]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleResetRole = () => {
    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: [...ROLES[selectedRole].pages],
    }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleResetAll = () => {
    const defaults = Object.fromEntries(
      Object.entries(ROLES).map(([k, v]) => [k, [...v.pages]])
    );
    setPermissions(defaults);
    localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const totalPages = ALL_PAGES_BY_CATEGORY.flatMap((c) => c.pages).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Gestion des rôles &amp; permissions</h2>
          <p className="text-sm text-slate-500">
            Définissez les modules accessibles pour chaque rôle. Les changements s'appliquent immédiatement après enregistrement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleResetAll} className="gap-2 text-slate-600">
            <RotateCcw className="w-3.5 h-3.5" />
            Tout réinitialiser
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className={`gap-2 ${saved ? "bg-green-600 hover:bg-green-700" : ""}`}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {hasChanges && !saved && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Modifications non sauvegardées — cliquez sur "Enregistrer" pour appliquer.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Role selector */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sélectionner un rôle</p>
          {Object.entries(ROLES).map(([key, role]) => {
            const pageCount = (permissions[key] || []).length;
            const defaultCount = role.pages.length;
            const isModified = pageCount !== defaultCount ||
              !(permissions[key] || []).every((p) => role.pages.includes(p));
            return (
              <button
                key={key}
                onClick={() => setSelectedRole(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedRole === key
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center text-xl flex-shrink-0`}
                >
                  {role.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{role.label}</p>
                  <p className="text-xs text-slate-500">
                    {pageCount} module{pageCount > 1 ? "s" : ""}
                    {isModified && <span className="ml-1 text-amber-600">• modifié</span>}
                  </p>
                </div>
                {selectedRole === key && (
                  <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Module checkboxes for selected role */}
        <div className="lg:col-span-2 space-y-4">
          {/* Role header */}
          {(() => {
            const role = ROLES[selectedRole];
            const pageCount = currentPages.length;
            return (
              <div className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${role.color} text-white`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{role.icon}</span>
                  <div>
                    <p className="font-bold text-lg">{role.label}</p>
                    <p className="text-white/70 text-sm">{role.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{pageCount}</p>
                  <p className="text-white/70 text-xs">/ {totalPages} modules</p>
                </div>
              </div>
            );
          })()}

          {/* Reset this role */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Modules accessibles</p>
            <Button variant="ghost" size="sm" onClick={handleResetRole} className="gap-1.5 text-xs text-slate-500">
              <RotateCcw className="w-3 h-3" />
              Réinitialiser ce rôle
            </Button>
          </div>

          {/* Pages grouped by category */}
          <div className="space-y-3">
            {ALL_PAGES_BY_CATEGORY.map(({ category, icon, pages }) => {
              const checkedCount = pages.filter((p) => currentPages.includes(p.key)).length;
              return (
                <Card key={category} className="overflow-hidden">
                  <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <CardTitle className="text-sm font-semibold text-slate-700">{category}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {checkedCount}/{pages.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pages.map(({ key, label }) => {
                        const isChecked = currentPages.includes(key);
                        const isLocked = ALWAYS_ON.includes(key) || locked.includes(key);
                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                              isLocked
                                ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                                : isChecked
                                ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isChecked
                                  ? "bg-blue-500 border-blue-500"
                                  : "border-slate-300 bg-white"
                              }`}
                              onClick={() => handleToggle(key)}
                            >
                              {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <span
                              className={`text-sm font-medium ${isChecked ? "text-blue-800" : "text-slate-600"}`}
                              onClick={() => handleToggle(key)}
                            >
                              {label}
                            </span>
                            {isLocked && (
                              <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {ALWAYS_ON.includes(key) ? "Toujours" : "Verrouillé"}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick select all / none */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const allKeys = ALL_PAGES_BY_CATEGORY.flatMap((c) => c.pages.map((p) => p.key));
                setPermissions((prev) => ({ ...prev, [selectedRole]: allKeys }));
                setHasChanges(true);
                setSaved(false);
              }}
            >
              Tout sélectionner
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const mustHave = [...ALWAYS_ON, ...(LOCKED_PAGES[selectedRole] || [])];
                setPermissions((prev) => ({ ...prev, [selectedRole]: mustHave }));
                setHasChanges(true);
                setSaved(false);
              }}
            >
              Tout désélectionner
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
