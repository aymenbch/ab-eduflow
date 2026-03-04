import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Search, MoreVertical, Edit, Trash2, UserPlus,
  ShieldCheck, Ban, Mail, Lock, Settings, CheckCircle2,
  Clock, XCircle, LayoutGrid, List, Send, Loader2
} from "lucide-react";
import { ROLES, PAGE_LABELS } from "@/components/roles/roles";
import InviteUserModal from "@/components/admin/InviteUserModal";
import SystemConfigSection from "@/components/admin/SystemConfigSection";

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700 border-green-200",
  invited: "bg-amber-100 text-amber-700 border-amber-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_ICONS = {
  active: CheckCircle2,
  invited: Clock,
  suspended: XCircle,
};
const STATUS_LABELS = { active: "Actif", invited: "Invité", suspended: "Suspendu" };

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

// ─── User Card (grid view) ─────────────────────────────────────────────────────
function UserCard({ profile, onEdit, onToggleSuspend, onDelete, onResendInvite, resending }) {
  const role = ROLES[profile.edugest_role];
  const pages = profile.use_custom_pages ? (profile.custom_pages || []) : (role?.pages || []);
  const StatusIcon = STATUS_ICONS[profile.status] || CheckCircle2;

  return (
    <Card className={`border-l-4 transition-all hover:shadow-md ${profile.status === "suspended" ? "opacity-70 border-l-red-400" : profile.edugest_role === "admin_systeme" ? "border-l-rose-500" : "border-l-blue-400"}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role?.color || "from-slate-400 to-slate-600"} flex items-center justify-center text-2xl shadow-sm`}>
              {role?.icon || "👤"}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{profile.full_name || "—"}</p>
              <p className="text-xs text-slate-500 truncate max-w-[160px]">{profile.email}</p>
              {profile.invited_at && (
                <p className="text-[10px] text-slate-400 mt-0.5">Invité le {profile.invited_at}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(profile)}>
                <Edit className="w-4 h-4 mr-2" /> Modifier profil & modules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleSuspend(profile)}>
                <Ban className="w-4 h-4 mr-2" />
                {profile.status === "suspended" ? "Réactiver" : "Suspendre"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(profile)}>
                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status + role badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[profile.status] || "bg-slate-100 text-slate-600"}`}>
            <StatusIcon className="w-3 h-3" />
            {STATUS_LABELS[profile.status] || profile.status}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium bg-gradient-to-r ${role?.color || "from-slate-400 to-slate-600"}`}>
            {role?.icon} {role?.label || profile.edugest_role}
          </span>
          {profile.use_custom_pages && (
            <Badge variant="outline" className="text-[10px] h-5">Modules personnalisés</Badge>
          )}
        </div>

        {/* Modules */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Modules ({pages.length})</p>
          <div className="flex flex-wrap gap-1">
            {pages.slice(0, 5).map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                {PAGE_LABELS[p] || p}
              </span>
            ))}
            {pages.length > 5 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">
                +{pages.length - 5}
              </span>
            )}
          </div>
        </div>

        {profile.notes && (
          <p className="text-xs text-slate-400 mt-2 italic border-t pt-2 truncate">{profile.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── User Row (list view) ──────────────────────────────────────────────────────
function UserRow({ profile, onEdit, onToggleSuspend, onDelete, onResendInvite, resending }) {
  const role = ROLES[profile.edugest_role];
  const pages = profile.use_custom_pages ? (profile.custom_pages || []) : (role?.pages || []);
  const StatusIcon = STATUS_ICONS[profile.status] || CheckCircle2;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${role?.color || "from-slate-400 to-slate-600"} flex items-center justify-center text-lg flex-shrink-0`}>
            {role?.icon || "👤"}
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">{profile.full_name || "—"}</p>
            <p className="text-xs text-slate-400">{profile.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${role?.color ? `bg-gradient-to-r ${role.color} text-white border-transparent` : "bg-slate-100 text-slate-600"}`}>
          {role?.icon} {role?.label || profile.edugest_role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${STATUS_COLORS[profile.status] || "bg-slate-100"}`}>
          <StatusIcon className="w-3 h-3" />
          {STATUS_LABELS[profile.status] || profile.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">{pages.length} modules</span>
          {profile.use_custom_pages && (
            <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5 ml-1">perso</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{profile.invited_at || "—"}</td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(profile)}>
              <Edit className="w-4 h-4 mr-2" /> Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleSuspend(profile)}>
              <Ban className="w-4 h-4 mr-2" />
              {profile.status === "suspended" ? "Réactiver" : "Suspendre"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(profile)}>
              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Administration() {
  const currentRole = localStorage.getItem("edugest_role");
  if (currentRole !== "admin_systeme") return <AccessDenied />;

  const [modalOpen, setModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [deleteProfile, setDeleteProfile] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["user_profiles"],
    queryFn: () => base44.entities.UserProfile.list("-created_date"),
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["user_profiles"] });
    setModalOpen(false);
    setEditProfile(null);
  };

  const handleEdit = (profile) => { setEditProfile(profile); setModalOpen(true); };
  const handleDelete = async () => {
    if (deleteProfile) {
      await base44.entities.UserProfile.delete(deleteProfile.id);
      queryClient.invalidateQueries({ queryKey: ["user_profiles"] });
      setDeleteProfile(null);
    }
  };
  const handleToggleSuspend = async (profile) => {
    const newStatus = profile.status === "suspended" ? "active" : "suspended";
    await base44.entities.UserProfile.update(profile.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["user_profiles"] });
  };

  const handleResendInvite = async (profile) => {
    setResendingId(profile.id);
    try {
      await base44.users.inviteUser(profile.email, "user");
    } catch (e) {
      // ignore — user may already exist
    }
    setResendingId(null);
  };

  const filtered = profiles.filter(p => {
    const matchSearch = !search ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || p.edugest_role === filterRole;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // Stats
  const activeCount = profiles.filter(p => p.status === "active").length;
  const invitedCount = profiles.filter(p => p.status === "invited").length;
  const suspendedCount = profiles.filter(p => p.status === "suspended").length;

  // Role distribution
  const roleStats = Object.entries(
    profiles.reduce((acc, p) => { acc[p.edugest_role] = (acc[p.edugest_role] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

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
          <Button
            onClick={() => { setEditProfile(null); setModalOpen(true); }}
            className="bg-white text-red-700 hover:bg-red-50 font-semibold gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configuration système
          </TabsTrigger>
        </TabsList>

        {/* ── ONGLET UTILISATEURS ── */}
        <TabsContent value="users" className="mt-6 space-y-6">

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{activeCount}</p>
                  <p className="text-xs text-green-600">Actifs</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-700">{invitedCount}</p>
                  <p className="text-xs text-amber-600">En attente</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-3">
                <Ban className="w-8 h-8 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{suspendedCount}</p>
                  <p className="text-xs text-red-600">Suspendus</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-slate-700">{profiles.length}</p>
                  <p className="text-xs text-slate-500">Total utilisateurs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Répartition par rôle */}
          {roleStats.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">Répartition par rôle</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {roleStats.map(([key, count]) => {
                  const r = ROLES[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterRole(filterRole === key ? "all" : key)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${filterRole === key ? `bg-gradient-to-r ${r?.color || "from-slate-400 to-slate-600"} text-white border-transparent shadow` : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <span>{r?.icon}</span>
                      <span>{r?.label || key}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filterRole === key ? "bg-white/30 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Toolbar : search + filters + view toggle */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 h-9"
                placeholder="Nom ou email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">✅ Actifs</SelectItem>
                <SelectItem value="invited">⏳ Invités</SelectItem>
                <SelectItem value="suspended">🚫 Suspendus</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {Object.entries(ROLES).map(([key, r]) => (
                  <SelectItem key={key} value={key}>{r.icon} {r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden ml-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results count */}
          {!isLoading && (
            <p className="text-xs text-slate-400">
              {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
              {filtered.length !== profiles.length && ` sur ${profiles.length}`}
            </p>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Aucun utilisateur trouvé</p>
              <p className="text-slate-400 text-sm mb-4">Ajustez vos filtres ou invitez un nouvel utilisateur</p>
              <Button onClick={() => { setEditProfile(null); setModalOpen(true); }}>
                <UserPlus className="w-4 h-4 mr-2" /> Inviter un utilisateur
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(profile => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  onEdit={handleEdit}
                  onToggleSuspend={handleToggleSuspend}
                  onDelete={setDeleteProfile}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Utilisateur</th>
                      <th className="px-4 py-3 text-left">Rôle</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3 text-left">Modules</th>
                      <th className="px-4 py-3 text-left">Invité le</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(profile => (
                      <UserRow
                        key={profile.id}
                        profile={profile}
                        onEdit={handleEdit}
                        onToggleSuspend={handleToggleSuspend}
                        onDelete={setDeleteProfile}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── ONGLET CONFIG ── */}
        <TabsContent value="config" className="mt-6">
          <SystemConfigSection />
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {modalOpen && (
        <InviteUserModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditProfile(null); }}
          onSaved={handleSaved}
          profile={editProfile}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteProfile} onOpenChange={() => setDeleteProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'accès de <strong>{deleteProfile?.email}</strong> sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}