import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Copy, Pencil, Trash2, ExternalLink, Loader2, Plus, RefreshCw, Link2, Users, Calendar, Clock, CheckCircle2, Search, UserCheck, X } from "lucide-react";
import { format, isToday, isFuture, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────
const PROVIDERS = {
  jitsi:       { label: "Jitsi Meet",  icon: "🎥", color: "bg-blue-100 text-blue-800 border-blue-200",    note: "Gratuit · sans compte · fonctionne directement" },
  google_meet: { label: "Google Meet", icon: "📹", color: "bg-green-100 text-green-800 border-green-200", note: "Lien généré automatiquement" },
};

const CONTEXTS = {
  cours:           { label: "Cours à distance",      icon: "📖", participantType: "students",  requireClass: true  },
  reunion_parents: { label: "Réunion parents-profs",  icon: "👨‍👩‍👧", participantType: "parents",   requireClass: true  },
  conseil_classe:  { label: "Conseil de classe",      icon: "🏫", participantType: "teachers",  requireClass: true  },
  soutien:         { label: "Soutien scolaire",        icon: "🎯", participantType: "students",  requireClass: false },
  reunion_staff:   { label: "Réunion du personnel",    icon: "👔", participantType: "staff",     requireClass: false },
};

const DURATIONS = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 45,  label: "45 min" },
  { value: 60,  label: "1 heure" },
  { value: 90,  label: "1h30" },
  { value: 120, label: "2 heures" },
  { value: 180, label: "3 heures" },
];

const STATUS_CONFIG = {
  scheduled: { label: "Planifiée", color: "bg-amber-100 text-amber-800",  dot: "bg-amber-400" },
  active:    { label: "En cours",  color: "bg-green-100 text-green-800",  dot: "bg-green-500 animate-pulse" },
  ended:     { label: "Terminée",  color: "bg-slate-100 text-slate-500",  dot: "bg-slate-400" },
};

const CAN_MANAGE_ROLES = [
  "admin_systeme", "directeur_general", "directeur_primaire",
  "directeur_college", "directeur_lycee", "cpe", "secretaire", "enseignant",
];

const TABS = [
  { key: "all",      label: "Toutes" },
  { key: "upcoming", label: "À venir" },
  { key: "active",   label: "En cours" },
  { key: "ended",    label: "Passées" },
];

const EMPTY_FORM = {
  title: "", provider: "jitsi", meeting_url: "", meeting_id: "",
  password: "", class_id: "", context: "cours", host_name: "",
  scheduled_at: "", duration: 60, status: "scheduled",
  school_year: "", description: "", participants: [],
};

// ─── Participant Selector Component ──────────────────────────────────────────
function ParticipantSelector({ context, classId, value = [], onChange, creatorId, creatorEntry }) {
  const [search, setSearch] = useState("");
  const ctxCfg = CONTEXTS[context] || CONTEXTS.cours;
  const ptype  = ctxCfg.participantType;

  // Load candidates based on context
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["psel_students", classId],
    queryFn: () => base44.entities.Student.list({ class_id: classId }),
    enabled: (ptype === "students") && !!classId,
  });

  const { data: allStudentsForClass = [] } = useQuery({
    queryKey: ["psel_students_nofilter", classId],
    queryFn: () => base44.entities.Student.list({ class_id: classId }),
    enabled: (ptype === "parents") && !!classId,
  });

  const { data: guardians = [] } = useQuery({
    queryKey: ["psel_guardians", classId],
    queryFn: () => base44.entities.StudentGuardian.list(),
    enabled: ptype === "parents",
  });

  const { data: allParents = [] } = useQuery({
    queryKey: ["psel_parents"],
    queryFn: () => base44.entities.Parent.list(),
    enabled: ptype === "parents",
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["psel_schedules", classId],
    queryFn: () => base44.entities.Schedule.list({ class_id: classId }),
    enabled: ptype === "teachers" && !!classId,
  });

  const { data: allTeachers = [] } = useQuery({
    queryKey: ["psel_teachers"],
    queryFn: () => base44.entities.Teacher.list(),
    enabled: ptype === "teachers",
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ["psel_staff"],
    queryFn: () => base44.entities.Staff.list(),
    enabled: ptype === "staff",
  });

  // Build candidate list
  const candidates = useMemo(() => {
    if (ptype === "students") {
      return students.map(s => ({
        id: s.id, name: `${s.first_name} ${s.last_name}`, type: "eleve",
        subtitle: s.student_code || "",
      }));
    }
    if (ptype === "parents") {
      // Get student IDs in this class, then their guardian parent IDs
      const studentIdsInClass = allStudentsForClass.map(s => s.id);
      const parentIdsInClass = new Set(
        guardians.filter(g => studentIdsInClass.includes(g.student_id)).map(g => g.parent_id)
      );
      return allParents
        .filter(p => parentIdsInClass.has(p.id))
        .map(p => ({
          id: p.id, name: `${p.first_name} ${p.last_name}`, type: "parent",
          subtitle: p.email || p.phone || "",
        }));
    }
    if (ptype === "teachers") {
      const teacherIds = [...new Set(schedules.map(s => s.teacher_id).filter(Boolean))];
      return allTeachers
        .filter(t => classId ? teacherIds.includes(t.id) : true)
        .map(t => ({
          id: t.id, name: `${t.first_name} ${t.last_name}`, type: "enseignant",
          subtitle: t.employee_code || "",
        }));
    }
    if (ptype === "staff") {
      return allStaff.map(s => ({
        id: s.id, name: `${s.first_name} ${s.last_name}`, type: "staff",
        subtitle: s.role || "",
      }));
    }
    return [];
  }, [ptype, students, allStudentsForClass, guardians, allParents, schedules, allTeachers, allStaff, classId]);

  const filtered = candidates.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const selectedIds = new Set((value || []).map(p => p.id));
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));

  const toggle = (candidate) => {
    // Le créateur/organisateur ne peut pas être retiré
    if (candidate.id === creatorId) return;
    const isSelected = selectedIds.has(candidate.id);
    if (isSelected) {
      onChange((value || []).filter(p => p.id !== candidate.id));
    } else {
      onChange([...(value || []), { id: candidate.id, name: candidate.name, type: candidate.type }]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      // Deselect filtered candidates
      const filteredIds = new Set(filtered.map(c => c.id));
      onChange((value || []).filter(p => !filteredIds.has(p.id)));
    } else {
      // Select all filtered (add missing ones)
      const toAdd = filtered.filter(c => !selectedIds.has(c.id))
        .map(c => ({ id: c.id, name: c.name, type: c.type }));
      onChange([...(value || []), ...toAdd]);
    }
  };

  const typeIcon = { eleve: "🎒", parent: "👨‍👩‍👧", enseignant: "📚", staff: "👔" };
  const typeBg   = { eleve: "bg-pink-100 text-pink-700", parent: "bg-amber-100 text-amber-700", enseignant: "bg-green-100 text-green-700", staff: "bg-cyan-100 text-cyan-700" };
  const isLoading = loadingStudents;

  const requireClass = ctxCfg.requireClass && !classId;

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Participants <span className="text-xs text-slate-400">({(value || []).length} sélectionné{(value || []).length > 1 ? "s" : ""})</span>
          </span>
        </div>
        {candidates.length > 0 && (
          <button type="button" onClick={toggleAll} className="text-xs text-blue-600 hover:underline font-medium">
            {allSelected ? "Tout désélectionner" : `Tout sélectionner (${filtered.length})`}
          </button>
        )}
      </div>

      {requireClass ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Sélectionnez d'abord une classe pour charger les participants
        </div>
      ) : isLoading ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          Aucun participant disponible pour ce contexte
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Row épinglée : organisateur (toujours en premier, non-supprimable) */}
          {creatorEntry && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 border-b select-none">
              <Checkbox checked={true} disabled className="opacity-80" />
              <span className="text-lg">
                { { admin_systeme:"🔐", directeur_general:"👑", directeur_college:"🎓", directeur_lycee:"🏛️",
                    directeur_primaire:"🏫", cpe:"👮", secretaire:"📋", comptable:"💼",
                    enseignant:"📚", eleve:"🎒", parent:"👨‍👩‍👧" }[creatorEntry.type] || "👤" }
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-800 truncate">{creatorEntry.name}</p>
                <p className="text-xs text-blue-500">Organisateur · vous</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">⭐ Org.</span>
            </div>
          )}

          {/* List */}
          <ScrollArea className="max-h-48">
            <div className="divide-y">
              {/* Exclure le créateur de la liste (déjà épinglé au-dessus) */}
              {filtered.filter(c => c.id !== creatorId).map(candidate => {
                const checked = selectedIds.has(candidate.id);
                const isOrganizer = false; // le créateur est hors liste désormais
                return (
                  <label
                    key={candidate.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${checked ? "bg-blue-50/40" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(candidate)}
                    />
                    <span className="text-lg">{typeIcon[candidate.type] || "👤"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{candidate.name}</p>
                      {candidate.subtitle && (
                        <p className="text-xs text-slate-400 truncate">{candidate.subtitle}</p>
                      )}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${typeBg[candidate.type] || "bg-slate-100"}`}>
                      {candidate.type}
                    </span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">Aucun résultat</p>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Selected chips */}
      {(value || []).length > 0 && (
        <div className="px-3 py-2 bg-blue-50 border-t flex flex-wrap gap-1.5">
          {(value || []).slice(0, 6).map(p => {
            const isOrganizer = p.organizer || p.id === creatorId;
            return (
              <span key={p.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                isOrganizer ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"
              }`}>
                {isOrganizer && <span className="text-[10px]">⭐</span>}
                {p.name}
                {isOrganizer
                  ? <span className="opacity-70 text-[10px] ml-0.5">Org.</span>
                  : <button type="button" onClick={() => toggle(p)} className="text-slate-400 hover:text-red-500 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                }
              </span>
            );
          })}
          {(value || []).length > 6 && (
            <span className="text-xs text-slate-500 self-center">+{(value || []).length - 6} autres</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Visio() {
  const [activeTab, setActiveTab]         = useState("all");
  const [providerFilter, setProviderFilter] = useState(null);
  const [classFilter, setClassFilter]     = useState(null);
  const [formOpen, setFormOpen]           = useState(false);
  const [selected, setSelected]           = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [saving, setSaving]               = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [formData, setFormData]           = useState({ ...EMPTY_FORM });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const session = getSession();
  const currentRole = session?.role || "";
  const canManage = CAN_MANAGE_ROLES.includes(currentRole);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["VisioSession"],
    queryFn: () => base44.entities.VisioSession.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes_all"],
    queryFn: () => base44.entities.Class.list(),
  });

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = sessions.filter(s => {
    if (activeTab === "upcoming") {
      if (s.status === "ended") return false;
      if (s.scheduled_at) {
        try { return isFuture(parseISO(s.scheduled_at)); } catch { return true; }
      }
    }
    if (activeTab === "active") return s.status === "active";
    if (activeTab === "ended")  return s.status === "ended";
    return true;
  })
  .filter(s => !providerFilter || s.provider === providerFilter)
  .filter(s => !classFilter    || s.class_id === classFilter)
  // Ordre croissant : sessions les plus proches en premier
  .sort((a, b) => {
    if (!a.scheduled_at && !b.scheduled_at) return 0;
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    try { return parseISO(a.scheduled_at) - parseISO(b.scheduled_at); }
    catch { return 0; }
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const statsUpcoming = sessions.filter(s => s.status === "scheduled").length;
  const statsActive   = sessions.filter(s => s.status === "active").length;
  const statsToday    = sessions.filter(s => {
    if (!s.scheduled_at) return false;
    try { return isToday(parseISO(s.scheduled_at)); } catch { return false; }
  }).length;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const handleGenerateLink = async (provider = formData.provider) => {
    if (!PROVIDERS[provider]) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/entities/VisioSession/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      setFormData(prev => ({ ...prev, meeting_url: data.url || "", meeting_id: data.id || "" }));
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer le lien", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleProviderChange = async (provider) => {
    setFormData(prev => ({ ...prev, provider, meeting_url: "", meeting_id: "" }));
    setTimeout(() => handleGenerateLink(provider), 50);
  };

  // Entrée organisateur (AppUser.id — toujours présent, même pour admin/directeur)
  const creatorEntry = session?.id
    ? { id: session.id, name: session.full_name || session.login || "Moi", type: currentRole, organizer: true }
    : null;

  const handleContextChange = (ctx) => {
    // Reset participants MAIS conserver l'organisateur
    setFormData(prev => ({
      ...prev, context: ctx, class_id: "",
      participants: creatorEntry ? [creatorEntry] : [],
    }));
  };

  const handleNew = () => {
    setSelected(null);
    setFormData({ ...EMPTY_FORM, participants: creatorEntry ? [creatorEntry] : [] });
    setFormOpen(true);
    setTimeout(() => handleGenerateLink("jitsi"), 100);
  };

  const handleEdit = (s) => {
    setSelected(s);
    const participants = Array.isArray(s.participants) ? s.participants
      : (typeof s.participants === "string" ? (() => { try { return JSON.parse(s.participants); } catch { return []; } })() : []);
    setFormData({ ...EMPTY_FORM, ...s, participants });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      toast({ title: "Champ requis", description: "Le titre est obligatoire", variant: "destructive" });
      return;
    }
    if (!formData.meeting_url?.trim()) {
      toast({ title: "Lien manquant", description: "Générez ou saisissez un lien de réunion", variant: "destructive" });
      return;
    }
    const ctxCfg = CONTEXTS[formData.context];
    if (ctxCfg?.requireClass && !formData.class_id) {
      toast({ title: "Classe requise", description: `Sélectionnez une classe pour le contexte « ${ctxCfg.label} »`, variant: "destructive" });
      return;
    }
    // Au moins 1 participant autre que l'organisateur
    const otherParticipants = (formData.participants || []).filter(p => !p.organizer && p.id !== session?.id);
    if (!otherParticipants.length && !formData.participants?.length) {
      toast({ title: "Participants requis", description: "Sélectionnez au moins un participant en plus de vous", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        duration: parseInt(formData.duration) || 60,
        host_name: formData.host_name || session?.full_name || "",
        hosted_by: session?.member_id || "",
        participants: JSON.stringify(formData.participants || []),
      };
      if (selected) {
        await base44.entities.VisioSession.update(selected.id, payload);
        toast({ title: "Session modifiée ✅" });
      } else {
        await base44.entities.VisioSession.create(payload);
        toast({ title: "Session créée ✅", description: `${formData.participants.length} participant(s) invité(s)` });
      }
      queryClient.invalidateQueries({ queryKey: ["VisioSession"] });
      setFormOpen(false);
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.VisioSession.delete(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["VisioSession"] });
    setDeleteTarget(null);
    toast({ title: "Session supprimée" });
  };

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Lien copié ✅", description: "Collez-le dans un email ou un message." })
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-7 h-7 text-blue-600" />
            Visioconférence
          </h1>
          <p className="text-slate-500 mt-1">Organisez et rejoignez vos sessions de visioconférence</p>
        </div>
        {canManage && (
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle session
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",       value: sessions.length,  icon: Video,        color: "text-blue-600",   bg: "bg-blue-50" },
          { label: "Planifiées",  value: statsUpcoming,    icon: Calendar,      color: "text-amber-600",  bg: "bg-amber-50" },
          { label: "En cours",    value: statsActive,      icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50" },
          { label: "Aujourd'hui", value: statsToday,       icon: Clock,         color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tabs */}
        <div className="flex rounded-lg border overflow-hidden">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Provider pills */}
        <div className="flex gap-2">
          <button onClick={() => setProviderFilter(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !providerFilter ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}>
            Tous
          </button>
          {Object.entries(PROVIDERS).map(([key, p]) => (
            <button key={key} onClick={() => setProviderFilter(providerFilter === key ? null : key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                providerFilter === key ? `${p.color} border-current` : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Class filter */}
        {classes.length > 0 && (
          <Select value={classFilter || "all"} onValueChange={v => setClassFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sessions grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucune session trouvée</p>
          <p className="text-sm mt-1">
            {canManage ? "Cliquez sur « Nouvelle session » pour en créer une." : "Aucune session planifiée pour le moment."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <SessionCard key={s.id} session={s} classes={classes}
              canManage={canManage} onEdit={handleEdit}
              onDelete={setDeleteTarget} onCopy={handleCopy} />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              {selected ? "Modifier la session" : "Nouvelle session visio"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">

            {/* Provider */}
            <div>
              <Label className="mb-2 block">Plateforme</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(PROVIDERS).map(([key, p]) => (
                  <button key={key} type="button" onClick={() => handleProviderChange(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.provider === key
                        ? `border-blue-500 ${p.color}`
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}>
                    <div className="text-2xl mb-1">{p.icon}</div>
                    <div className="font-semibold text-sm">{p.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title">Titre de la session *</Label>
              <Input id="title" value={formData.title}
                onChange={e => set("title", e.target.value)}
                placeholder="Ex : Cours de Mathématiques — 3ème A"
                className="mt-1" required />
            </div>

            {/* Context + Class */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contexte *</Label>
                <Select value={formData.context} onValueChange={handleContextChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTEXTS).map(([key, c]) => (
                      <SelectItem key={key} value={key}>{c.icon} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Classe {CONTEXTS[formData.context]?.requireClass ? "*" : "(optionnel)"}
                </Label>
                <Select value={formData.class_id || "none"}
                  onValueChange={v => setFormData(prev => ({ ...prev, class_id: v === "none" ? "" : v, participants: [] }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                  <SelectContent>
                    {!CONTEXTS[formData.context]?.requireClass && <SelectItem value="none">— Toutes les classes —</SelectItem>}
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Participants — obligatoire */}
            <div>
              <Label className="mb-2 block">
                Participants *
                <span className="text-xs font-normal text-slate-400 ml-2">
                  {CONTEXTS[formData.context]?.icon} {
                    formData.context === "cours" ? "Élèves de la classe" :
                    formData.context === "reunion_parents" ? "Parents des élèves" :
                    formData.context === "conseil_classe" ? "Enseignants de la classe" :
                    formData.context === "soutien" ? "Élèves concernés" :
                    "Membres du personnel"
                  }
                </span>
              </Label>
              <ParticipantSelector
                context={formData.context}
                classId={formData.class_id}
                value={formData.participants}
                onChange={v => set("participants", v)}
                creatorId={session?.id}
                creatorEntry={creatorEntry}
              />
            </div>

            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduled_at">Date et heure *</Label>
                <Input id="scheduled_at" type="datetime-local"
                  value={formData.scheduled_at || ""}
                  onChange={e => set("scheduled_at", e.target.value)}
                  className="mt-1" />
              </div>
              <div>
                <Label>Durée</Label>
                <Select value={String(formData.duration)} onValueChange={v => set("duration", parseInt(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Meeting URL */}
            <div>
              <Label className="flex items-center justify-between">
                <span>Lien de la réunion *</span>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => handleGenerateLink(formData.provider)}
                  disabled={generating} className="h-7 text-xs gap-1">
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regénérer
                </Button>
              </Label>
              <div className="mt-1 flex gap-2">
                <Input value={formData.meeting_url || ""}
                  onChange={e => set("meeting_url", e.target.value)}
                  placeholder={generating ? "Génération en cours…" : "https://meet.jit.si/…"}
                  className="flex-1 font-mono text-sm" />
                {formData.meeting_url && (
                  <Button type="button" variant="outline" size="icon" onClick={() => handleCopy(formData.meeting_url)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{PROVIDERS[formData.provider]?.note}</p>
            </div>

            {/* Password + Host + Status */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" value={formData.password || ""}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Optionnel" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="host_name">Animateur</Label>
                <Input id="host_name" value={formData.host_name || ""}
                  onChange={e => set("host_name", e.target.value)}
                  placeholder="Nom de l'hôte" className="mt-1" />
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={formData.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">📅 Planifiée</SelectItem>
                    <SelectItem value="active">🟢 En cours</SelectItem>
                    <SelectItem value="ended">✅ Terminée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description / Instructions</Label>
              <Textarea id="description" value={formData.description || ""}
                onChange={e => set("description", e.target.value)}
                placeholder="Objectifs, documents à préparer, instructions de connexion…"
                rows={2} className="mt-1" />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                {selected ? "Enregistrer" : "Créer la session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
            <AlertDialogDescription>
              La session <strong>"{deleteTarget?.title}"</strong> sera supprimée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, classes, canManage, onEdit, onDelete, onCopy }) {
  const cls = classes.find(c => c.id === session.class_id);
  const provider  = PROVIDERS[session.provider] || PROVIDERS.jitsi;
  const context   = CONTEXTS[session.context]   || CONTEXTS.cours;
  const statusCfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.scheduled;

  const participants = useMemo(() => {
    if (Array.isArray(session.participants)) return session.participants;
    if (typeof session.participants === "string") {
      try { return JSON.parse(session.participants); } catch { return []; }
    }
    return [];
  }, [session.participants]);

  let dateLabel = "", timeLabel = "";
  if (session.scheduled_at) {
    try {
      const d = parseISO(session.scheduled_at);
      dateLabel = format(d, "EEEE d MMMM yyyy", { locale: fr });
      timeLabel = format(d, "HH:mm", { locale: fr });
    } catch {}
  }

  const isToday_ = session.scheduled_at
    ? (() => { try { return isToday(parseISO(session.scheduled_at)); } catch { return false; } })()
    : false;

  return (
    <Card className={`transition-all hover:shadow-md ${session.status === "ended" ? "opacity-65" : ""}`}>
      <CardContent className="p-5">
        {/* Badges top */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${provider.color}`}>
            <span>{provider.icon}</span>{provider.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-slate-800 mb-1 leading-snug">{session.title}</h3>

        {/* Date + heure — bloc mini-calendrier */}
        {session.scheduled_at && (() => {
          try {
            const d = parseISO(session.scheduled_at);
            const dayNum   = format(d, "d");
            const monthStr = format(d, "MMM", { locale: fr });
            const dayName  = format(d, "EEEE", { locale: fr });
            const time     = format(d, "HH:mm");
            const durLabel = DURATIONS.find(x => x.value === session.duration)?.label || `${session.duration} min`;
            return (
              <div className={`flex items-stretch gap-3 rounded-xl px-3 py-2.5 mb-3 ${
                isToday_
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-slate-50 border border-slate-200"
              }`}>
                {/* Carré jour */}
                <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white flex-shrink-0 ${
                  isToday_ ? "bg-blue-600" : "bg-slate-600"
                }`}>
                  <span className="text-[10px] font-semibold uppercase leading-none opacity-80 mt-1">
                    {monthStr}
                  </span>
                  <span className="text-xl font-bold leading-tight">{dayNum}</span>
                </div>
                {/* Détails */}
                <div className="flex flex-col justify-center min-w-0">
                  <p className={`text-[11px] font-medium capitalize truncate ${isToday_ ? "text-blue-500" : "text-slate-400"}`}>
                    {isToday_ ? "Aujourd'hui" : dayName}
                  </p>
                  <p className={`text-lg font-bold leading-none ${isToday_ ? "text-blue-700" : "text-slate-700"}`}>
                    {time}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                    {durLabel}{session.host_name ? ` · ${session.host_name}` : ""}
                  </p>
                </div>
              </div>
            );
          } catch { return null; }
        })()}

        {/* Contexte + classe */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 mb-3">
          <span>{context.icon} {context.label}</span>
          {cls && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{cls.name}</span>}
        </div>

        {/* Participants count */}
        {participants.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <UserCheck className="w-4 h-4 text-blue-500" />
            <span className="text-blue-600 font-medium">{participants.length} participant{participants.length > 1 ? "s" : ""}</span>
            <span className="text-xs text-slate-400 truncate">
              {participants.slice(0, 3).map(p => p.name).join(", ")}{participants.length > 3 ? `…` : ""}
            </span>
          </div>
        )}

        {/* Password */}
        {session.password && (
          <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-3 font-mono">
            🔑 Code : {session.password}
          </div>
        )}

        {/* Description */}
        {session.description && (
          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{session.description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {session.meeting_url ? (
            <Button size="sm" asChild className="gap-1.5 flex-1">
              <a href={session.meeting_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Rejoindre
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled className="flex-1 gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Pas de lien
            </Button>
          )}
          {session.meeting_url && (
            <Button size="sm" variant="outline" onClick={() => onCopy(session.meeting_url)} title="Copier le lien">
              <Copy className="w-3.5 h-3.5" />
            </Button>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => onEdit(session)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => onDelete(session)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
