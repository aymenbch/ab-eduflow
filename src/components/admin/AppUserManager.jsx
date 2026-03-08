import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { hashPin } from "@/components/auth/appAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ROLES } from "@/components/roles/roles";
import {
  UserPlus, Search, MoreVertical, Edit, Trash2, Ban, RefreshCw, Key, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const MEMBER_TYPES = [
  { value: "Student", label: "Élève" },
  { value: "Teacher", label: "Enseignant" },
  { value: "Staff", label: "Personnel" },
  { value: "none", label: "Aucun (admin)" },
];

function AppUserFormModal({ open, onClose, onSaved, editUser }) {
  const isEdit = !!editUser;
  const [form, setForm] = useState(editUser ? {
    login: editUser.login,
    role: editUser.role,
    full_name: editUser.full_name || "",
    member_id: editUser.member_id || "",
    member_type: editUser.member_type || "none",
    pin: "",
  } : {
    login: "",
    role: "eleve",
    full_name: "",
    member_id: "",
    member_type: "Student",
    pin: "1234",
  });
  const [loading, setLoading] = useState(false);

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });

  const getMemberOptions = () => {
    if (form.member_type === "Student") return students.map(s => ({ id: s.id, label: `${s.first_name} ${s.last_name} (${s.student_code || s.id.slice(0, 6)})` }));
    if (form.member_type === "Teacher") return teachers.map(t => ({ id: t.id, label: `${t.first_name} ${t.last_name}` }));
    if (form.member_type === "Staff") return staff.map(s => ({ id: s.id, label: `${s.first_name} ${s.last_name}` }));
    return [];
  };

  // Auto-fill login when member selected (student → student_code, teacher/parent → email)
  const handleMemberChange = (memberId) => {
    setForm(f => {
      let autoLogin = f.login;
      let autoName = f.full_name;
      if (f.member_type === "Student") {
        const s = students.find(x => x.id === memberId);
        if (s) {
          autoLogin = s.student_code ? s.student_code.toLowerCase() : f.login;
          autoName = `${s.first_name} ${s.last_name}`;
        }
      } else if (f.member_type === "Teacher") {
        const t = teachers.find(x => x.id === memberId);
        if (t) { autoLogin = t.email ? t.email.toLowerCase() : f.login; autoName = `${t.first_name} ${t.last_name}`; }
      } else if (f.member_type === "Staff") {
        const s = staff.find(x => x.id === memberId);
        if (s) { autoLogin = s.email ? s.email.toLowerCase() : f.login; autoName = `${s.first_name} ${s.last_name}`; }
      }
      return { ...f, member_id: memberId, login: autoLogin, full_name: autoName };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login || !form.role) return;
    setLoading(true);
    const pinHash = form.pin ? await hashPin(form.pin) : null;
    const payload = {
      login: form.login.trim().toLowerCase(),
      role: form.role,
      full_name: form.full_name,
      member_id: form.member_id || "",
      member_type: form.member_type,
      status: "active",
      ...(pinHash && { pin_hash: pinHash, must_change_pin: !isEdit }),
    };
    if (isEdit) {
      await base44.functions.invoke("appUserAdmin", { action: "update", user_id: editUser.id, payload });
    } else {
      await base44.functions.invoke("appUserAdmin", { action: "create", payload });
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Type de membre</label>
              <Select value={form.member_type} onValueChange={v => setForm(f => ({ ...f, member_type: v, member_id: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Rôle EduGest</label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, r]) => (
                    <SelectItem key={key} value={key}>{r.icon} {r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.member_type !== "none" && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Lier à un membre</label>
              <Select value={form.member_id} onValueChange={handleMemberChange}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {getMemberOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">L'identifiant et le nom sont auto-remplis selon le membre</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nom complet</label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nom prénom" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Identifiant de connexion</label>
            <Input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} placeholder="N° étudiant, email ou téléphone" />
            <p className="text-xs text-slate-400 mt-1">
              Élève: numéro étudiant • Parent/Enseignant: email ou téléphone
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              {isEdit ? "Nouveau PIN (laisser vide pour ne pas changer)" : "PIN initial (l'utilisateur devra le changer)"}
            </label>
            <Input
              type="password"
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
              placeholder={isEdit ? "Laisser vide = inchangé" : "PIN temporaire (ex: 1234)"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AppUserManager() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: appUsers = [], isLoading } = useQuery({
    queryKey: ["app_users"],
    queryFn: async () => {
      const res = await base44.functions.invoke("appUserAdmin", { action: "list" });
      return res.data || [];
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
    setModalOpen(false);
    setEditUser(null);
  };

  const handleDelete = async (user) => {
    if (confirm(`Supprimer le compte de ${user.full_name || user.login} ?`)) {
      await base44.entities.AppUser.delete(user.id);
      queryClient.invalidateQueries({ queryKey: ["app_users"] });
    }
  };

  const handleToggleSuspend = async (user) => {
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    await base44.entities.AppUser.update(user.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
  };

  const handleResetPin = async (user) => {
    const defaultPin = await hashPin("1234");
    await base44.entities.AppUser.update(user.id, { pin_hash: defaultPin, must_change_pin: true });
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
    alert(`PIN réinitialisé à 1234 pour ${user.full_name || user.login}. L'utilisateur devra le changer à la prochaine connexion.`);
  };

  const filtered = appUsers.filter(u => {
    const matchSearch = !search ||
      u.login?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9 h-9" placeholder="Nom ou identifiant..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {Object.entries(ROLES).map(([key, r]) => (
                <SelectItem key={key} value={key}>{r.icon} {r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditUser(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <UserPlus className="w-4 h-4" /> Nouvel utilisateur
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">Aucun utilisateur trouvé</p>
          <p className="text-sm mt-1">Créez le premier compte utilisateur</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(user => {
            const role = ROLES[user.role];
            return (
              <Card key={user.id} className={`border-l-4 ${user.status === "suspended" ? "border-l-red-400 opacity-70" : "border-l-blue-400"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${role?.color || "from-slate-400 to-slate-600"} flex items-center justify-center text-xl`}>
                        {role?.icon || "👤"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{user.full_name || "—"}</p>
                        <p className="text-xs text-slate-500 font-mono">{user.login}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditUser(user); setModalOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPin(user)}>
                          <Key className="w-4 h-4 mr-2" /> Réinitialiser PIN (→1234)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleSuspend(user)}>
                          <Ban className="w-4 h-4 mr-2" />
                          {user.status === "suspended" ? "Réactiver" : "Suspendre"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(user)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge className={`text-xs ${user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {user.status === "active" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {user.status === "active" ? "Actif" : "Suspendu"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{role?.label || user.role}</Badge>
                    {user.must_change_pin && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        <Key className="w-3 h-3 mr-1" /> PIN à changer
                      </Badge>
                    )}
                    {user.member_type && user.member_type !== "none" && (
                      <Badge variant="outline" className="text-xs text-slate-400">{user.member_type}</Badge>
                    )}
                  </div>

                  {user.last_login && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      Dernière connexion : {new Date(user.last_login).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <AppUserFormModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditUser(null); }}
          onSaved={handleSaved}
          editUser={editUser}
        />
      )}
    </div>
  );
}