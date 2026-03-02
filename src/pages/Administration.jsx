import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Search, MoreVertical, Edit, Trash2, UserPlus, ShieldCheck, Ban, Mail } from "lucide-react";
import { ROLES, PAGE_LABELS } from "@/components/roles/roles";
import InviteUserModal from "@/components/admin/InviteUserModal";

const STATUS_COLORS = {
  active: "bg-green-100 text-green-800",
  invited: "bg-yellow-100 text-yellow-800",
  suspended: "bg-red-100 text-red-800",
};

const STATUS_LABELS = {
  active: "Actif",
  invited: "Invité",
  suspended: "Suspendu",
};

export default function Administration() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [deleteProfile, setDeleteProfile] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

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

  const handleEdit = (profile) => {
    setEditProfile(profile);
    setModalOpen(true);
  };

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

  const filtered = profiles.filter(p => {
    const matchSearch = !search ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || p.edugest_role === filterRole;
    return matchSearch && matchRole;
  });

  const getEffectivePages = (profile) => {
    if (profile.use_custom_pages) return profile.custom_pages || [];
    return ROLES[profile.edugest_role]?.pages || [];
  };

  // Stats
  const activeCount = profiles.filter(p => p.status === "active").length;
  const invitedCount = profiles.filter(p => p.status === "invited").length;
  const suspendedCount = profiles.filter(p => p.status === "suspended").length;

  return (
    <div>
      <PageHeader
        title="Administration"
        description="Gestion des utilisateurs, rôles et accès aux modules"
        action={() => { setEditProfile(null); setModalOpen(true); }}
        actionLabel="Inviter un utilisateur"
        actionIcon={UserPlus}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-slate-500">Actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{invitedCount}</p>
              <p className="text-xs text-slate-500">Invitations en attente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{suspendedCount}</p>
              <p className="text-xs text-slate-500">Suspendus</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher par email ou nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {Object.entries(ROLES).map(([key, r]) => (
              <SelectItem key={key} value={key}>{r.icon} {r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun utilisateur trouvé</p>
          <p className="text-slate-400 text-sm mb-4">Invitez votre premier utilisateur pour commencer</p>
          <Button onClick={() => { setEditProfile(null); setModalOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Inviter un utilisateur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(profile => {
            const role = ROLES[profile.edugest_role];
            const pages = getEffectivePages(profile);
            return (
              <Card key={profile.id} className={`border-l-4 ${profile.status === "suspended" ? "opacity-60 border-l-red-400" : "border-l-blue-400"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${role?.color || "from-slate-400 to-slate-600"} flex items-center justify-center text-xl`}>
                        {role?.icon || "👤"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{profile.full_name || "—"}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[160px]">{profile.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(profile)}>
                          <Edit className="w-4 h-4 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleSuspend(profile)}>
                          <Ban className="w-4 h-4 mr-2" />
                          {profile.status === "suspended" ? "Réactiver" : "Suspendre"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteProfile(profile)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={STATUS_COLORS[profile.status] || "bg-slate-100"}>
                      {STATUS_LABELS[profile.status] || profile.status}
                    </Badge>
                    <Badge className={`bg-gradient-to-r text-white text-xs ${role?.color || "from-slate-400 to-slate-600"}`}>
                      {role?.label || profile.edugest_role}
                    </Badge>
                    {profile.use_custom_pages && (
                      <Badge variant="outline" className="text-xs">Personnalisé</Badge>
                    )}
                  </div>

                  {/* Module access chips */}
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">Accès aux modules ({pages.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {pages.slice(0, 6).map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {PAGE_LABELS[p] || p}
                        </span>
                      ))}
                      {pages.length > 6 && (
                        <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">
                          +{pages.length - 6}
                        </span>
                      )}
                    </div>
                  </div>

                  {profile.notes && (
                    <p className="text-xs text-slate-400 mt-2 italic border-t pt-2">{profile.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal invite/edit */}
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
              L'accès de <strong>{deleteProfile?.email}</strong> sera supprimé. Cette action est irréversible.
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