import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, ShieldCheck, Lock, Settings,
} from "lucide-react";

import SystemConfigSection from "@/components/admin/SystemConfigSection";
import AppUserManager from "@/components/admin/AppUserManager";
import RolePermissionsManager from "@/components/admin/RolePermissionsManager";

// ─── Access Guard ──────────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <Lock className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Accès restreint</h2>
      <p className="text-slate-500 max-w-sm">
        Cette page est réservée à l'<strong>Administrateur Système</strong>.
      </p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Administration() {
  const currentRole = (() => {
    try { return JSON.parse(localStorage.getItem("edugest_session"))?.role; } catch {}
    return localStorage.getItem("edugest_role");
  })();

  if (currentRole !== "admin_systeme") return <AccessDenied />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🔐</div>
            <div>
              <h1 className="text-2xl font-bold">Administration Système</h1>
              <p className="text-white/70 text-sm">Gestion des utilisateurs, rôles, modules et configuration</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="app_users">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="app_users" className="flex items-center gap-2">
            <Lock className="w-4 h-4" /> Comptes &amp; Accès
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Rôles &amp; Permissions
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configuration
          </TabsTrigger>
        </TabsList>

        {/* ── ONGLET COMPTES INTERNES ── */}
        <TabsContent value="app_users" className="mt-6">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <strong>🔐 Comptes de connexion EduGest</strong> — Créez les comptes avec identifiant + PIN pour chaque membre (élève, parent, enseignant). Les élèves se connectent avec leur numéro étudiant, les autres avec leur email ou téléphone.
            <br />
            <a href={`${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}appLogin`} target="_blank" className="underline text-blue-600 mt-1 inline-block">
              → Accéder à la page de connexion
            </a>
          </div>
          <AppUserManager />
        </TabsContent>

        {/* ── ONGLET RÔLES & PERMISSIONS ── */}
        <TabsContent value="roles" className="mt-6">
          <RolePermissionsManager />
        </TabsContent>

        {/* ── ONGLET CONFIG ── */}
        <TabsContent value="config" className="mt-6">
          <SystemConfigSection />
        </TabsContent>
      </Tabs>

    </div>
  );
}