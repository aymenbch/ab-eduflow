import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertTriangle, Plus, Trash2, Check, X, Loader2, Users, Clock,
  ChevronDown, ChevronUp, Calendar, CalendarX, RefreshCw,
  Bell, Mail, Smartphone, UserX, BookOpen, MapPin, CheckCircle2,
  XCircle, MoveRight,
} from "lucide-react";
import {
  format, parseISO, addDays, differenceInCalendarDays, eachDayOfInterval
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── API ────────────────────────────────────────────────────────────────────────
const API = "http://localhost:3001/api/absences";

function apiHeaders() {
  const s = getSession();
  const h = { "Content-Type": "application/json" };
  if (s?.token) h["X-Session-Token"] = s.token;
  if (s?.id)    h["X-User-Id"] = s.id;
  return h;
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(`${API}${url}`, { headers: apiHeaders(), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Scope helpers ──────────────────────────────────────────────────────────────
const PRIMAIRE_KWS = ["cp","ce1","ce2","cm1","cm2","ce","primaire","grande section","petite section","moyenne section","maternelle","préparatoire","gs","ms","ps","elem"];
const COLLEGE_KWS  = ["6ème","6","5ème","5","4ème","4","3ème","3","collège","college"];
const LYCEE_KWS    = ["2nde","seconde","1ère","première","terminale","lycée","lycee","bts","bac pro","cap"];

function matchesCycle(text, kws) {
  const t = (text || "").toLowerCase();
  return kws.some(k => t.includes(k));
}

function getTeacherCycles(teacher, schedules, classes) {
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const classIds = [...new Set(schedules.filter(s => s.teacher_id === teacher.id).map(s => s.class_id))];
  const levels = classIds.map(id => classMap[id]?.level || "").filter(Boolean);
  const cycles = new Set();
  levels.forEach(l => {
    if (matchesCycle(l, PRIMAIRE_KWS)) cycles.add("primaire");
    if (matchesCycle(l, COLLEGE_KWS))  cycles.add("college");
    if (matchesCycle(l, LYCEE_KWS))    cycles.add("lycee");
  });
  if (cycles.size === 0) cycles.add("all"); // teacher without classes → show everywhere
  return cycles;
}

const ROLE_SCOPE = {
  directeur_primaire: "primaire",
  directeur_college:  "college",
  directeur_lycee:    "lycee",
};

// ── Day-of-week helpers ────────────────────────────────────────────────────────
const DAYS_FR = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function getDayOfWeek(dateStr) {
  // JS: 0=Sun,1=Mon...6=Sat → schedule: 0=Lun,1=Mar,...5=Sam
  const jsDay = new Date(dateStr + "T12:00:00").getDay();
  if (jsDay === 0) return null;
  return jsDay - 1;
}

// ── Status badges ──────────────────────────────────────────────────────────────
function ActionBadge({ action }) {
  if (action === "rescheduled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
        <RefreshCw className="w-3 h-3" /> Reporté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <CalendarX className="w-3 h-3" /> Annulé
    </span>
  );
}

// ── Reschedule modal ───────────────────────────────────────────────────────────
function RescheduleModal({ open, onClose, impact, subjectMap, classMap, onSave }) {
  const [form, setForm] = useState({
    replacement_date: "", replacement_time: "", replacement_room: "", replacement_note: ""
  });
  const [saving, setSaving] = useState(false);

  const subject = subjectMap[impact?.subject_id];
  const cls     = classMap[impact?.class_id];

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(impact.id, { action: "rescheduled", ...form });
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-500" /> Reporter ce cours
          </DialogTitle>
        </DialogHeader>
        {impact && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 mb-2">
            <p className="font-semibold text-slate-800">{subject?.name || "Cours"}</p>
            <p className="text-slate-500">
              {impact.affected_date && format(parseISO(impact.affected_date), "EEEE d MMMM yyyy", { locale: fr })}
              {impact.time_start && ` • ${impact.time_start}–${impact.time_end}`}
            </p>
            {cls && <p className="text-slate-500">Classe : {cls.name}</p>}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nouvelle date *</Label>
            <Input type="date" value={form.replacement_date}
              onChange={e => setForm(f => ({ ...f, replacement_date: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heure</Label>
              <Input type="time" value={form.replacement_time}
                onChange={e => setForm(f => ({ ...f, replacement_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Salle</Label>
              <Input value={form.replacement_room} placeholder="Ex : B205"
                onChange={e => setForm(f => ({ ...f, replacement_room: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={2} value={form.replacement_note} placeholder="Informations supplémentaires..."
              onChange={e => setForm(f => ({ ...f, replacement_note: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600" disabled={saving || !form.replacement_date}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmer le report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── AbsenceCard ────────────────────────────────────────────────────────────────
function AbsenceCard({ absence, teacherMap, subjectMap, classMap, currentRole, myMemberId, onCancel, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedImpact, setSelectedImpact] = useState(null);
  const qc = useQueryClient();

  const { data: impacts = [], isLoading: loadingImpacts } = useQuery({
    queryKey: ["absence_impacts", absence.id],
    queryFn: () => apiFetch(`/${absence.id}/impacts`),
    enabled: expanded,
  });

  const reschedMut = useMutation({
    mutationFn: ({ impactId, data }) => apiFetch(`/impacts/${impactId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absence_impacts", absence.id] });
      qc.invalidateQueries({ queryKey: ["schedule-events"] });
      toast.success("Cours reporté avec succès");
    },
    onError: (e) => toast.error(e.message),
  });

  const teacher = teacherMap[absence.teacher_id];
  const start = parseISO(absence.start_date);
  const end   = parseISO(absence.end_date);
  const days  = differenceInCalendarDays(end, start) + 1;
  const isActive = absence.status === "active";
  const today = new Date().toISOString().split("T")[0];
  const isOngoing = absence.start_date <= today && today <= absence.end_date;

  // Scope check: enseignant can only see their own absences
  const isTeacher = currentRole === "enseignant";
  if (isTeacher && absence.teacher_id !== myMemberId) return null;

  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden transition-all",
      !isActive ? "border-slate-100 opacity-60" : isOngoing ? "border-orange-300 shadow-md" : "border-slate-200"
    )}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg",
            isOngoing ? "bg-orange-500" : isActive ? "bg-slate-600" : "bg-slate-300"
          )}>
            {teacher?.first_name?.[0]}{teacher?.last_name?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900">
                {teacher ? `${teacher.first_name} ${teacher.last_name}` : absence.teacher_id}
              </p>
              {isOngoing && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  🔴 En cours
                </span>
              )}
              {!isActive && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Annulée
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {format(start, "d MMM", { locale: fr })} → {format(end, "d MMM yyyy", { locale: fr })}
              <span className="text-slate-400">({days} jour{days > 1 ? "s" : ""})</span>
            </p>
            {absence.reason && (
              <p className="text-xs text-slate-400 italic mt-0.5">« {absence.reason} »</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isActive && onCancel && (
            <Button size="sm" variant="outline" className="h-8 text-slate-500 hover:text-red-600 gap-1"
              onClick={() => { if (window.confirm("Annuler cette absence ?")) onCancel(absence.id); }}>
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" className="h-8 text-slate-400 hover:text-red-500 px-2"
              onClick={() => { if (window.confirm("Supprimer définitivement ?")) onDelete(absence.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Séances
          </button>
        </div>
      </div>

      {/* Impacts list */}
      {expanded && (
        <div className="border-t bg-slate-50 p-4 space-y-2">
          {loadingImpacts ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
          ) : impacts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucune séance impactée trouvée</p>
          ) : (
            impacts.map(imp => {
              const subject = subjectMap[imp.subject_id];
              const cls     = classMap[imp.class_id];
              const isRescheduled = imp.action === "rescheduled";
              return (
                <div key={imp.id} className={cn(
                  "rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap",
                  isRescheduled ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-3">
                    <BookOpen className={cn("w-4 h-4 flex-shrink-0", isRescheduled ? "text-amber-500" : "text-red-400")} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-slate-800">
                          {format(parseISO(imp.affected_date), "EEEE d MMM", { locale: fr })}
                        </p>
                        {imp.time_start && (
                          <span className="text-xs text-slate-500 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> {imp.time_start}–{imp.time_end}
                          </span>
                        )}
                        {cls && <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{cls.name}</span>}
                        {subject && <span className="text-xs text-slate-600">{subject.name}</span>}
                      </div>
                      {isRescheduled && imp.replacement_date && (
                        <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                          <MoveRight className="w-3 h-3" />
                          Reporté au {format(parseISO(imp.replacement_date), "d MMM", { locale: fr })}
                          {imp.replacement_time && ` à ${imp.replacement_time}`}
                          {imp.replacement_room && ` — Salle ${imp.replacement_room}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionBadge action={imp.action} />
                    {isActive && !isRescheduled && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={() => { setSelectedImpact(imp); setRescheduleOpen(true); }}>
                        <RefreshCw className="w-3 h-3" /> Reporter
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedImpact && (
        <RescheduleModal
          open={rescheduleOpen}
          onClose={() => { setRescheduleOpen(false); setSelectedImpact(null); }}
          impact={selectedImpact}
          subjectMap={subjectMap}
          classMap={classMap}
          onSave={(impactId, data) => reschedMut.mutateAsync({ impactId, data })}
        />
      )}
    </div>
  );
}

// ── Declare form ───────────────────────────────────────────────────────────────
function DeclareAbsenceForm({ open, onClose, teachers, schedules, currentRole, myMemberId }) {
  const qc = useQueryClient();
  const isTeacher = currentRole === "enseignant";

  const [form, setForm] = useState({
    teacher_id: isTeacher ? myMemberId || "" : "",
    start_date: new Date().toISOString().split("T")[0],
    end_date:   new Date().toISOString().split("T")[0],
    reason: "",
    notify_email: false,
    notify_sms: false,
  });
  const [saving, setSaving] = useState(false);

  // Preview impacted sessions
  const preview = useMemo(() => {
    if (!form.teacher_id || !form.start_date || !form.end_date) return [];
    const teacherSchedules = schedules.filter(s => s.teacher_id === form.teacher_id);
    if (!teacherSchedules.length) return [];
    try {
      const dates = eachDayOfInterval({ start: parseISO(form.start_date), end: parseISO(form.end_date) });
      const impacts = [];
      for (const date of dates) {
        const dow = getDayOfWeek(date.toISOString().split("T")[0]);
        if (dow === null) continue;
        const matching = teacherSchedules.filter(s => Number(s.day_of_week) === dow);
        matching.forEach(s => impacts.push({ date: format(date, "EEEE d MMM", { locale: fr }), schedule: s }));
      }
      return impacts;
    } catch { return []; }
  }, [form.teacher_id, form.start_date, form.end_date, schedules]);

  const createMut = useMutation({
    mutationFn: (data) => apiFetch("/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["schedule-events"] });
      qc.invalidateQueries({ queryKey: ["absence_stats"] });
      toast.success(`Absence déclarée — ${res.impacts_count || 0} séance(s) marquée(s) annulée(s)`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.teacher_id) return;
    setSaving(true);
    const session = getSession();
    await createMut.mutateAsync({
      ...form,
      declared_by: session?.id || session?.login || "",
      declared_by_role: currentRole,
    });
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-orange-500" /> Déclarer une absence d'enseignant
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Teacher selector */}
          {isTeacher ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              En tant qu'enseignant, vous déclarez votre propre absence.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Enseignant *</Label>
              <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))} required>
                <SelectTrigger><SelectValue placeholder="Sélectionner un enseignant" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Du *</Label>
              <Input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Au *</Label>
              <Input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motif</Label>
            <Textarea rows={2} value={form.reason} placeholder="Maladie, formation, mission..."
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>

          {/* Preview of impacted sessions */}
          {preview.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
                <CalendarX className="w-4 h-4" /> {preview.length} séance(s) seront annulées
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-orange-100">
                    <span className="font-medium text-slate-700 capitalize">{p.date}</span>
                    <span className="text-slate-500">{p.schedule.start_time}–{p.schedule.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {form.teacher_id && preview.length === 0 && form.start_date <= form.end_date && (
            <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg text-center">
              Aucune séance planifiée pour cet enseignant sur cette période
            </div>
          )}

          {/* Notification options */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
              <Bell className="w-4 h-4" /> Notifications parents / élèves
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <Label className="text-sm cursor-pointer">Notifier par Email</Label>
              </div>
              <Switch checked={form.notify_email} onCheckedChange={v => setForm(f => ({ ...f, notify_email: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <Label className="text-sm cursor-pointer">Notifier par SMS</Label>
              </div>
              <Switch checked={form.notify_sms} onCheckedChange={v => setForm(f => ({ ...f, notify_sms: v }))} />
            </div>
            {(form.notify_email || form.notify_sms) && (
              <p className="text-xs text-blue-700 bg-white rounded p-2 border border-blue-100">
                Les parents des élèves concernés seront notifiés via le système de notification configuré dans Administration → Notifications.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600"
              disabled={saving || !form.teacher_id || !form.start_date || !form.end_date || createMut.isPending}>
              {(saving || createMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Déclarer l'absence
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────
function StatsBar() {
  const { data: stats = {} } = useQuery({
    queryKey: ["absence_stats"],
    queryFn: () => apiFetch("/stats"),
    refetchInterval: 60000,
  });
  const items = [
    { label: "Absences actives",   value: stats.active      ?? "–", icon: UserX,       color: "text-red-600 bg-red-100" },
    { label: "Absence(s) auj.",    value: stats.todayAbsent ?? "–", icon: CalendarX,   color: "text-orange-600 bg-orange-100" },
    { label: "Séances annulées",   value: stats.impacted    ?? "–", icon: XCircle,     color: "text-slate-600 bg-slate-100" },
    { label: "Cours reportés",     value: stats.rescheduled ?? "–", icon: RefreshCw,   color: "text-amber-600 bg-amber-100" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", item.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AbsencesEnseignants() {
  const session = getSession();
  const currentRole = session?.role || localStorage.getItem("edugest_role") || "";
  const myMemberId  = session?.member_id || null;
  const isTeacher   = currentRole === "enseignant";

  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [teacherFilter, setTeacherFilter] = useState("");

  // ── Data ──
  const { data: absences = [], isLoading } = useQuery({
    queryKey: ["absences", statusFilter],
    queryFn: () => apiFetch(`/?${statusFilter ? `status=${statusFilter}` : ""}`),
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => base44.entities.Schedule.list(),
  });

  // ── Maps ──
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const classMap   = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c])), [classes]);

  // ── Scope-filtered teachers ──
  const scopedTeachers = useMemo(() => {
    if (isTeacher) return teachers.filter(t => t.id === myMemberId);
    const scope = ROLE_SCOPE[currentRole];
    if (!scope) return teachers; // admin_systeme, directeur_general, cpe, secretaire
    return teachers.filter(t => {
      const cycles = getTeacherCycles(t, schedules, classes);
      return cycles.has(scope) || cycles.has("all");
    });
  }, [teachers, schedules, classes, currentRole, isTeacher, myMemberId]);

  // ── Filtered absences ──
  const filteredAbsences = useMemo(() => {
    let list = absences;
    if (isTeacher) list = list.filter(a => a.teacher_id === myMemberId);
    if (teacherFilter) list = list.filter(a => a.teacher_id === teacherFilter);
    return list;
  }, [absences, isTeacher, myMemberId, teacherFilter]);

  // ── Mutations ──
  const cancelMut = useMutation({
    mutationFn: (id) => apiFetch(`/${id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["absences"] }); qc.invalidateQueries({ queryKey: ["absence_stats"] }); qc.invalidateQueries({ queryKey: ["schedule-events"] }); toast.success("Absence annulée"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => apiFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["absences"] }); qc.invalidateQueries({ queryKey: ["absence_stats"] }); qc.invalidateQueries({ queryKey: ["schedule-events"] }); toast.success("Absence supprimée"); },
    onError: (e) => toast.error(e.message),
  });

  const canDeclare = [
    "admin_systeme","directeur_general","directeur_primaire","directeur_college",
    "directeur_lycee","cpe","secretaire","enseignant"
  ].includes(currentRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🤒</div>
            <div>
              <h1 className="text-2xl font-bold">Absences Enseignants</h1>
              <p className="text-white/80 text-sm">Gestion des absences, cours annulés et reports de séances</p>
            </div>
          </div>
          {canDeclare && (
            <Button onClick={() => setFormOpen(true)}
              className="gap-2 bg-white text-red-600 hover:bg-red-50 font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Déclarer une absence
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter */}
        <div className="flex gap-2">
          {[
            { value: "active",    label: "Actives" },
            { value: "cancelled", label: "Annulées" },
            { value: "",          label: "Toutes" },
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                statusFilter === f.value
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
              )}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Teacher filter (not for enseignant) */}
        {!isTeacher && scopedTeachers.length > 0 && (
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filtrer par enseignant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les enseignants</SelectItem>
              {scopedTeachers.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Absences list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
        </div>
      ) : filteredAbsences.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-slate-400">
          <UserX className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune absence déclarée</p>
          {canDeclare && (
            <Button onClick={() => setFormOpen(true)} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Déclarer une absence
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAbsences.map(absence => (
            <AbsenceCard
              key={absence.id}
              absence={absence}
              teacherMap={teacherMap}
              subjectMap={subjectMap}
              classMap={classMap}
              currentRole={currentRole}
              myMemberId={myMemberId}
              onCancel={canDeclare ? (id) => cancelMut.mutate(id) : null}
              onDelete={["admin_systeme","directeur_general"].includes(currentRole) ? (id) => deleteMut.mutate(id) : null}
            />
          ))}
        </div>
      )}

      {/* Declare form modal */}
      <DeclareAbsenceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teachers={scopedTeachers}
        schedules={schedules}
        currentRole={currentRole}
        myMemberId={myMemberId}
      />
    </div>
  );
}
