import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { hashPin } from "@/components/auth/appAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ROLES } from "@/components/roles/roles";
import {
  UserPlus, Search, MoreVertical, Edit, Trash2, Ban, Key, Loader2,
  CheckCircle2, XCircle, Copy, Printer, ShieldCheck,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const MEMBER_TYPES = [
  { value: "Student", label: "Élève" },
  { value: "Teacher", label: "Enseignant" },
  { value: "Staff", label: "Personnel" },
  { value: "none", label: "Aucun (admin)" },
];

/* ─── Credentials display modal ────────────────────────────────────────── */

function CredentialsModal({ open, onClose, credentials }) {
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  if (!credentials) return null;

  const copy = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=520,height=420');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Accès EduGest — ${credentials.full_name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:36px;color:#0f172a;}
      .title{text-align:center;color:#2563eb;font-size:20px;font-weight:700;margin-bottom:4px;}
      .sub{text-align:center;font-size:13px;color:#64748b;margin-bottom:24px;}
      .lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
      .val{font-family:monospace;font-size:24px;font-weight:800;color:#2563eb;letter-spacing:3px;margin-bottom:20px;}
      .note{font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:8px;}
      @media print{button{display:none!important;}}
    </style></head><body>
    <div class="title">EduGest — Fiche d'accès</div>
    <div class="sub">${credentials.typeLabel} : ${credentials.full_name}</div>
    <div class="lbl">Identifiant de connexion</div>
    <div class="val">${credentials.login}</div>
    <div class="lbl">Mot de passe provisoire</div>
    <div class="val">${credentials.provisional_password}</div>
    ${credentials.notify_email ? `<p style="font-size:13px;color:#475569;">📧 À remettre à : <strong>${credentials.notify_email}</strong></p>` : ''}
    <div class="note">⚠️ Ce mot de passe est provisoire et devra être modifié à la première connexion.</div>
    <br><button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ Imprimer</button>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-base">{credentials.title || 'Accès compte'}</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">{credentials.typeLabel} — {credentials.full_name}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          {/* Login */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Identifiant de connexion</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                {credentials.login}
              </code>
              <Button
                size="sm" variant="outline"
                className={copiedLogin ? "text-green-600 border-green-300" : ""}
                onClick={() => copy(credentials.login, setCopiedLogin)}
              >
                {copiedLogin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Mot de passe provisoire</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-2xl font-extrabold text-blue-600 tracking-[6px] bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                {credentials.provisional_password}
              </code>
              <Button
                size="sm" variant="outline"
                className={copiedPwd ? "text-green-600 border-green-300" : ""}
                onClick={() => copy(credentials.provisional_password, setCopiedPwd)}
              >
                {copiedPwd ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {credentials.notify_email && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>📧</span>
            <span>À communiquer à : <strong>{credentials.notify_email}</strong></span>
          </p>
        )}

        <p className="text-xs text-slate-400">
          Ce mot de passe est provisoire. L'utilisateur devra le modifier à la première connexion.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="gap-2 flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimer la fiche
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── User form modal ────────────────────────────────────────────────────── */

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
    pin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });

  const getMemberOptions = () => {
    if (form.member_type === "Student") return students.map(s => ({ id: s.id, label: `${s.first_name} ${s.last_name} (${s.student_code || s.id.slice(0, 6)})` }));
    if (form.member_type === "Teacher") return teachers.map(t => ({ id: t.id, label: `${t.first_name} ${t.last_name}` }));
    if (form.member_type === "Staff") return staff.map(s => ({ id: s.id, label: `${s.first_name} ${s.last_name}` }));
    return [];
  };

  const handleMemberChange = (memberId) => {
    setForm(f => {
      let autoLogin = f.login;
      let autoName = f.full_name;
      if (f.member_type === "Student") {
        const s = students.find(x => x.id === memberId);
        if (s) { autoLogin = s.student_code?.toLowerCase() || f.login; autoName = `${s.first_name} ${s.last_name}`; }
      } else if (f.member_type === "Teacher") {
        const t = teachers.find(x => x.id === memberId);
        if (t) { autoLogin = t.email?.toLowerCase() || f.login; autoName = `${t.first_name} ${t.last_name}`; }
      } else if (f.member_type === "Staff") {
        const s = staff.find(x => x.id === memberId);
        if (s) { autoLogin = s.email?.toLowerCase() || f.login; autoName = `${s.first_name} ${s.last_name}`; }
      }
      return { ...f, member_id: memberId, login: autoLogin, full_name: autoName };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login || !form.role) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        action: isEdit ? "update" : "create",
        ...(isEdit && { id: editUser.id }),
        login: form.login.trim().toLowerCase(),
        role: form.role,
        full_name: form.full_name,
        member_id: form.member_id || null,
        member_type: form.member_type,
        status: "active",
      };
      if (form.pin) {
        payload.pin_hash = await hashPin(form.pin);
        payload.must_change_pin = !isEdit;
      }
      await base44.functions.invoke("appUserAdmin", payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
            <p className="text-xs text-slate-400 mt-1">Élève : numéro étudiant • Enseignant/Parent : email</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              {isEdit ? "Nouveau PIN (laisser vide = inchangé)" : "PIN initial — laisser vide pour générer automatiquement"}
            </label>
            <Input
              type="password"
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
              placeholder={isEdit ? "Laisser vide = inchangé" : "Vide = mot de passe provisoire auto-généré"}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Enregistrer" : "Créer le compte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function AppUserManager() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [credModal, setCredModal] = useState(null); // { login, provisional_password, full_name, typeLabel, notify_email, title }
  const queryClient = useQueryClient();

  const { data: appUsers = [], isLoading } = useQuery({
    queryKey: ["app_users"],
    queryFn: () => base44.functions.invoke("appUserAdmin", { action: "list" }),
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
    setModalOpen(false);
    setEditUser(null);
  };

  const handleDelete = async (user) => {
    if (!confirm(`Supprimer le compte de ${user.full_name || user.login} ? Cette action est irréversible.`)) return;
    await base44.functions.invoke("appUserAdmin", { action: "delete", id: user.id });
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
  };

  const handleToggleSuspend = async (user) => {
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    await base44.functions.invoke("appUserAdmin", { action: "update", id: user.id, status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["app_users"] });
  };

  const handleResetPin = async (user) => {
    if (!confirm(`Réinitialiser le PIN de ${user.full_name || user.login} ?\nUn nouveau mot de passe provisoire sera généré.`)) return;
    const result = await base44.functions.invoke("appUserAdmin", { action: "reset_pin", id: user.id });
    queryClient.invalidateQueries({ queryKey: ["app_users"] });

    const roleLabels = { Student: 'Élève', Teacher: 'Enseignant', Staff: 'Personnel', none: 'Admin' };
    setCredModal({
      title: 'PIN réinitialisé',
      login: result.login,
      provisional_password: result.provisional_password,
      full_name: result.full_name || result.login,
      typeLabel: roleLabels[result.member_type] || result.role,
      notify_email: null,
    });
  };

  const filtered = appUsers.filter(u => {
    const matchSearch = !search ||
      u.login?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const stats = {
    total: appUsers.length,
    active: appUsers.filter(u => u.status === "active").length,
    pending: appUsers.filter(u => u.must_change_pin).length,
    suspended: appUsers.filter(u => u.status === "suspended").length,
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "bg-blue-50 text-blue-700" },
          { label: "Actifs", value: stats.active, color: "bg-green-50 text-green-700" },
          { label: "PIN à changer", value: stats.pending, color: "bg-amber-50 text-amber-700" },
          { label: "Suspendus", value: stats.suspended, color: "bg-red-50 text-red-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
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

      {/* Users grid */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(user => {
            const role = ROLES[user.role];
            const isPending = user.must_change_pin;
            const isSuspended = user.status === "suspended";
            return (
              <Card key={user.id} className={`border-l-4 transition-opacity ${isSuspended ? "border-l-red-400 opacity-60" : isPending ? "border-l-amber-400" : "border-l-blue-400"}`}>
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
                          <Key className="w-4 h-4 mr-2" /> Réinitialiser le PIN
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleSuspend(user)}>
                          <Ban className="w-4 h-4 mr-2" />
                          {isSuspended ? "Réactiver le compte" : "Suspendre le compte"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(user)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge className={`text-xs ${isSuspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {isSuspended ? <XCircle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {isSuspended ? "Suspendu" : "Actif"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{role?.label || user.role}</Badge>
                    {isPending && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        <Key className="w-3 h-3 mr-1" /> PIN à changer
                      </Badge>
                    )}
                  </div>

                  {user.last_login ? (
                    <p className="text-[10px] text-slate-400 mt-2">
                      Dernière connexion : {new Date(user.last_login).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-2">Jamais connecté</p>
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

      <CredentialsModal
        open={!!credModal}
        onClose={() => setCredModal(null)}
        credentials={credModal}
      />
    </div>
  );
}
