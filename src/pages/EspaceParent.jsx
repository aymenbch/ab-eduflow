import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, Minus, Bell, MessageCircle, Calendar,
  AlertTriangle, CheckCircle, BookOpen, Clock, Send, Star, User,
  ChevronRight, Sparkles, Shield, Award, Loader2, CalendarCheck, ChevronDown,
  DollarSign, Download, Receipt
} from "lucide-react";
import { generateReceipt } from "@/utils/pdf/generateReceipt";
import { getSession } from "@/components/auth/appAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const FIN_API = "http://localhost:3001/api/finv2";
function finFetch(path) {
  const s = getSession();
  const headers = { "Content-Type": "application/json" };
  if (s?.token) headers["X-Session-Token"] = s.token;
  return fetch(`${FIN_API}${path}`, { headers }).then(r => r.json());
}

const STATUS_FIN = {
  paid:    { label: "Payé",      color: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Partiel",   color: "bg-amber-100 text-amber-800" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-800" },
  unpaid:  { label: "Impayé",    color: "bg-slate-100 text-slate-600" },
};

const PAYMENT_METHODS_FR = { cash: "Espèces", cheque: "Chèque", virement: "Virement", carte: "Carte" };
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { subjectAveragesForStudent, studentWeightedAvg, avgColorClass } from "@/utils/gradeUtils";

const TABS = [
  { id: "notes", label: "📊 Notes", icon: TrendingUp },
  { id: "comportement", label: "🛡️ Comportement", icon: Shield },
  { id: "notifications", label: "🔔 Notifications", icon: Bell },
  { id: "chat", label: "💬 Chat", icon: MessageCircle },
  { id: "rdv", label: "📅 Rendez-vous", icon: Calendar },
  { id: "factures", label: "💰 Factures", icon: DollarSign },
];

// ─── Couleurs par index d'enfant ─────────────────────────────
const CHILD_COLORS = [
  { bg: "from-amber-500 to-orange-500",   avatar: "bg-amber-500",   ring: "ring-amber-400",  text: "text-amber-600",  light: "bg-amber-50 border-amber-300"  },
  { bg: "from-blue-500 to-indigo-500",    avatar: "bg-blue-500",    ring: "ring-blue-400",   text: "text-blue-600",   light: "bg-blue-50 border-blue-300"    },
  { bg: "from-emerald-500 to-green-500",  avatar: "bg-emerald-500", ring: "ring-emerald-400",text: "text-emerald-600",light: "bg-emerald-50 border-emerald-300"},
  { bg: "from-purple-500 to-violet-500",  avatar: "bg-purple-500",  ring: "ring-purple-400", text: "text-purple-600", light: "bg-purple-50 border-purple-300" },
  { bg: "from-rose-500 to-pink-500",      avatar: "bg-rose-500",    ring: "ring-rose-400",   text: "text-rose-600",   light: "bg-rose-50 border-rose-300"    },
];

export default function EspaceParent() {
  const [activeTab, setActiveTab] = useState("notes");
  const [selectedChildId, setSelectedChildId] = useState(null);

  const { myChildren, isParent, userEmail } = useCurrentMember();

  const { data: allStudents = [] } = useQuery({ queryKey: ["students"],   queryFn: () => base44.entities.Student.list() });
  const { data: grades     = [] } = useQuery({ queryKey: ["grades"],     queryFn: () => base44.entities.Grade.list() });
  const { data: exams      = [] } = useQuery({ queryKey: ["exams"],      queryFn: () => base44.entities.Exam.list() });
  const { data: subjects   = [] } = useQuery({ queryKey: ["subjects"],   queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions  = [] } = useQuery({ queryKey: ["sanctions"],  queryFn: () => base44.entities.Sanction.list() });
  const { data: teachers   = [] } = useQuery({ queryKey: ["teachers"],   queryFn: () => base44.entities.Teacher.list() });
  const { data: messages   = [] } = useQuery({ queryKey: ["messages"],   queryFn: () => base44.entities.Message.list() });
  const { data: classes    = [] } = useQuery({ queryKey: ["classes"],    queryFn: () => base44.entities.Class.list() });

  // Enfants disponibles : propres enfants si parent connecté, sinon tous les élèves
  const students = useMemo(
    () => (isParent && myChildren.length > 0 ? myChildren : allStudents),
    [isParent, myChildren, allStudents]
  );

  // Auto-sélection du premier enfant
  React.useEffect(() => {
    if (students.length > 0 && !selectedChildId) {
      setSelectedChildId(students[0].id);
    }
  }, [students, selectedChildId]);

  // Enfant actif
  const child      = students.find(s => s.id === selectedChildId) || students[0];
  const childIndex = students.findIndex(s => s.id === child?.id);
  const childColor = CHILD_COLORS[Math.max(0, childIndex) % CHILD_COLORS.length];

  // Factures de l'enfant actif
  const { data: childInvoices = [] } = useQuery({
    queryKey: ["fin_student_invoices", child?.id],
    queryFn: () => finFetch(`/student/${child.id}`),
    enabled: !!child?.id && activeTab === "factures",
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Bandeau header ──────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-r ${childColor.bg} rounded-2xl p-5 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar de l'enfant sélectionné */}
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold flex-shrink-0 ring-2 ring-white/40">
              {child ? child.first_name?.[0]?.toUpperCase() : "👨‍👩‍👧"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold leading-tight">
                  {child ? `${child.first_name} ${child.last_name}` : "Espace Parents"}
                </h1>
                {students.length > 1 && (
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                    {childIndex + 1}/{students.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {child?.class_id && classes.find(c => c.id === child.class_id) && (
                  <span className="text-white/90 text-sm font-medium">
                    {classes.find(c => c.id === child.class_id)?.name}
                  </span>
                )}
                {child?.level && (
                  <span className="text-white/70 text-xs">· {child.level}</span>
                )}
                {child?.student_code && (
                  <span className="text-white/60 text-xs">· N° {child.student_code}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-white/70 text-xs flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
            Connecté
          </div>
        </div>
      </div>

      {/* ── Sélecteur d'enfants ─────────────────────────────────────────────── */}
      {students.length > 0 && (
        <ChildSwitcher
          students={students}
          selectedId={child?.id}
          onSelect={setSelectedChildId}
          classes={classes}
          grades={grades}
          exams={exams}
          subjects={subjects}
          attendance={attendance}
        />
      )}

      {/* ── Onglets ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? `${childColor.avatar} text-white shadow-lg`
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <NotesTab child={child} grades={grades} exams={exams} subjects={subjects} />
      )}
      {activeTab === "comportement" && (
        <ComportementTab child={child} attendance={attendance} sanctions={sanctions} />
      )}
      {activeTab === "notifications" && (
        <NotificationsTab child={child} grades={grades} exams={exams} attendance={attendance} sanctions={sanctions} subjects={subjects} />
      )}
      {activeTab === "chat" && (
        <ChatTab child={child} teachers={teachers} messages={messages} />
      )}
      {activeTab === "rdv" && (
        <RdvTab teachers={teachers} child={child} />
      )}
      {activeTab === "factures" && (
        <FacturesTab invoices={childInvoices} child={child} />
      )}
    </div>
  );
}

// ─── Calcul des stats rapides pour tous les enfants ──────────
// Fonction PURE — pas un hook — appelable dans un .map() sans problème.
function computeChildStats(studentId, grades, exams, subjects, attendance) {
  const overall    = studentWeightedAvg(studentId, grades, exams, subjects);
  const stuAtt     = attendance.filter(a => a.student_id === studentId);
  const absences   = stuAtt.filter(a => a.status === "absent").length;
  const presenceRate = stuAtt.length > 0
    ? Math.round((stuAtt.filter(a => a.status === "present").length / stuAtt.length) * 100)
    : 0;
  return { overall, absences, presenceRate };
}

// ─── SÉLECTEUR D'ENFANTS ──────────────────────────────────────
function ChildSwitcher({ students, selectedId, onSelect, classes, grades, exams, subjects, attendance }) {
  // Pre-calculer les stats pour tous les enfants (un seul useMemo au niveau du composant)
  const allStats = useMemo(
    () => Object.fromEntries(
      students.map(s => [s.id, computeChildStats(s.id, grades, exams, subjects, attendance)])
    ),
    [students, grades, exams, subjects, attendance]
  );

  return (
    <div className={`${students.length > 1 ? "flex gap-3 overflow-x-auto pb-1" : ""}`}>
      {students.map((s, idx) => {
        const isSelected = s.id === selectedId;
        const color      = CHILD_COLORS[idx % CHILD_COLORS.length];
        const cls        = classes.find(c => c.id === s.class_id);
        const stats      = allStats[s.id] || { overall: null, absences: 0, presenceRate: 0 };

        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex-shrink-0 rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
              students.length === 1 ? "w-full" : "min-w-[13rem] max-w-[14rem]"
            } ${
              isSelected
                ? `${color.light} ${color.ring} ring-2 shadow-md`
                : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar initiales */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                isSelected ? color.avatar : "bg-slate-300"
              }`}>
                {s.first_name?.[0]?.toUpperCase()}{s.last_name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className={`font-semibold text-sm truncate ${isSelected ? color.text : "text-slate-700"}`}>
                  {s.first_name} {s.last_name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {cls?.name || "Classe ?"}
                  {s.level ? ` · ${s.level}` : ""}
                </p>
              </div>
            </div>

            {/* Mini-stats : moyenne + absences */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-2 text-center ${isSelected ? "bg-white/70" : "bg-slate-50"}`}>
                <p className={`text-lg font-bold leading-none ${
                  stats.overall !== null
                    ? stats.overall >= 14 ? "text-green-600"
                    : stats.overall >= 10 ? "text-blue-600"
                    : "text-red-600"
                  : "text-slate-300"
                }`}>
                  {stats.overall !== null ? stats.overall.toFixed(1) : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Moy. /20</p>
              </div>
              <div className={`rounded-lg p-2 text-center ${isSelected ? "bg-white/70" : "bg-slate-50"}`}>
                <p className={`text-lg font-bold leading-none ${
                  stats.absences === 0 ? "text-green-600"
                  : stats.absences <= 3 ? "text-orange-500"
                  : "text-red-600"
                }`}>
                  {stats.absences}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Absences</p>
              </div>
            </div>

            {/* Indicateur de sélection */}
            {isSelected && students.length > 1 && (
              <p className={`mt-2 text-center text-[10px] font-semibold ${color.text}`}>
                ✓ Suivi actif
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── NOTES TAB ───────────────────────────────────────────────
function NotesTab({ child, grades, exams, subjects }) {
  const [selectedTrimester, setSelectedTrimester] = useState("all");

  // ── Moyennes via gradeUtils (cohérent avec le reste de l'app) ──────────────
  const bySubjectRaw = useMemo(() => {
    if (!child) return [];
    return subjectAveragesForStudent(child.id, grades, exams, subjects, { trimester: selectedTrimester });
  }, [child, grades, exams, subjects, selectedTrimester]);

  // Adapter au format utilisé dans le rendu : { sub, avg, lastScore, trend, count }
  const bySubject = useMemo(() =>
    bySubjectRaw
      .map(r => ({ sub: r.subject, avg: r.avg, lastScore: r.lastScore, trend: r.trend, count: r.count }))
      .sort((a, b) => b.avg - a.avg),
    [bySubjectRaw]
  );

  // Moyenne générale pondérée (cohérente avec le bulletin)
  const overall = useMemo(() => {
    if (!child) return null;
    return studentWeightedAvg(child.id, grades, exams, subjects, { trimester: selectedTrimester });
  }, [child, grades, exams, subjects, selectedTrimester]);

  const trendIcon = (t) => t === "up"
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : t === "down"
    ? <TrendingDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-4 h-4 text-slate-400" />;

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Moyenne générale</p>
            <p className={`text-4xl font-bold ${overall != null ? avgColorClass(overall) : "text-slate-400"}`}>
              {overall != null ? overall.toFixed(2) : "—"}
            </p>
            <p className="text-xs text-slate-400">/20</p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="p-5 flex items-center gap-4">
            <Select value={selectedTrimester} onValueChange={setSelectedTrimester}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute l'année</SelectItem>
                <SelectItem value="T1">Trimestre 1</SelectItem>
                <SelectItem value="T2">Trimestre 2</SelectItem>
                <SelectItem value="T3">Trimestre 3</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-4 text-sm text-slate-600">
              <span><strong className="text-green-600">{bySubject.filter(r => r.avg >= 10).length}</strong> matières ≥ 10</span>
              <span><strong className="text-red-600">{bySubject.filter(r => r.avg < 10).length}</strong> matières &lt; 10</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject list */}
      <div className="space-y-2">
        {bySubject.map(({ sub, avg, lastScore, trend, count }) => (
          <Card key={sub.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div
                className="w-3 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: sub.color || "#94a3b8" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900">{sub.name}</p>
                <p className="text-xs text-slate-400">{count} note(s)</p>
              </div>
              {trendIcon(trend)}
              <div className="text-right">
                <span className={`text-2xl font-bold ${avgColorClass(avg)}`}>{avg.toFixed(1)}</span>
                <span className="text-xs text-slate-400">/20</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${avg >= 10 ? "bg-green-400" : "bg-red-400"}`} />
            </CardContent>
          </Card>
        ))}
        {!bySubject.length && (
          <div className="text-center py-12 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Aucune note disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPORTEMENT TAB ────────────────────────────────────────
function ComportementTab({ child, attendance, sanctions }) {
  const childAtt = useMemo(() =>
    child ? attendance.filter(a => a.student_id === child.id) : [],
    [child, attendance]
  );
  const childSanctions = useMemo(() =>
    child ? sanctions.filter(s => s.student_id === child.id) : [],
    [child, sanctions]
  );

  const absences = childAtt.filter(a => a.status === "absent").length;
  const lates = childAtt.filter(a => a.status === "late").length;
  const excused = childAtt.filter(a => a.status === "excused").length;
  const presentRate = childAtt.length
    ? ((childAtt.filter(a => a.status === "present").length / childAtt.length) * 100).toFixed(0)
    : 100;

  const behaviorScore = Math.max(0, 100 - absences * 3 - lates * 1 - childSanctions.filter(s => !s.resolved).length * 10);
  const scoreColor = behaviorScore >= 80 ? "text-green-600" : behaviorScore >= 60 ? "text-amber-600" : "text-red-600";
  const scoreLabel = behaviorScore >= 80 ? "Très bon" : behaviorScore >= 60 ? "Correct" : "À améliorer";

  const SANCTION_LABELS = {
    warning: "Avertissement", detention: "Retenue", suspension: "Exclusion",
    expulsion: "Expulsion", other: "Autre"
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{presentRate}%</p>
            <p className="text-xs text-green-600 mt-1">Taux de présence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{absences}</p>
            <p className="text-xs text-slate-500 mt-1">Absences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{lates}</p>
            <p className="text-xs text-slate-500 mt-1">Retards</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${scoreColor}`}>{behaviorScore}</p>
            <p className="text-xs text-slate-500 mt-1">Score comportement</p>
            <p className={`text-xs font-medium ${scoreColor}`}>{scoreLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent attendance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dernières présences</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {childAtt.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucune donnée de présence</p>
          ) : (
            <div className="space-y-2">
              {[...childAtt].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{new Date(a.date).toLocaleDateString("fr-FR")}</span>
                  <span className="text-slate-400 text-xs">{a.period || ""}</span>
                  <Badge className={
                    a.status === "present" ? "bg-green-100 text-green-700" :
                    a.status === "absent" ? "bg-red-100 text-red-700" :
                    a.status === "late" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }>
                    {a.status === "present" ? "Présent" : a.status === "absent" ? "Absent" : a.status === "late" ? "Retard" : "Excusé"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sanctions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sanctions & Disciplinaire</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {childSanctions.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 text-sm py-2">
              <CheckCircle className="w-5 h-5" />
              Aucune sanction — excellent comportement !
            </div>
          ) : (
            <div className="space-y-3">
              {childSanctions.map(s => (
                <div key={s.id} className={`flex items-start justify-between p-3 rounded-lg ${s.resolved ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                  <div>
                    <p className="text-sm font-medium">{SANCTION_LABELS[s.type] || s.type}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.reason}</p>
                    <p className="text-xs text-slate-400">{new Date(s.date).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <Badge className={s.resolved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {s.resolved ? "Résolue" : "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── NOTIFICATIONS TAB ───────────────────────────────────────
function NotificationsTab({ child, grades, exams, attendance, sanctions, subjects }) {
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const notifications = useMemo(() => {
    if (!child) return [];
    const notifs = [];
    const childGrades = grades.filter(g => g.student_id === child.id && !g.absent && g.score != null);
    const recent = [...childGrades].sort((a, b) => {
      const ea = exams.find(e => e.id === a.exam_id);
      const eb = exams.find(e => e.id === b.exam_id);
      return new Date(eb?.date || 0) - new Date(ea?.date || 0);
    }).slice(0, 5);

    recent.forEach(g => {
      const exam = exams.find(e => e.id === g.exam_id);
      const subject = subjects.find(s => s.id === exam?.subject_id);
      if (g.score < 10) {
        notifs.push({ type: "warning", icon: "⚠️", title: `Note faible en ${subject?.name || "Matière"}`, desc: `${g.score}/20 — en dessous de la moyenne`, time: exam?.date ? new Date(exam.date).toLocaleDateString("fr-FR") : "" });
      } else if (g.score >= 16) {
        notifs.push({ type: "success", icon: "🌟", title: `Excellente note en ${subject?.name || "Matière"}`, desc: `${g.score}/20 — Félicitations !`, time: exam?.date ? new Date(exam.date).toLocaleDateString("fr-FR") : "" });
      } else {
        notifs.push({ type: "info", icon: "📊", title: `Nouvelle note en ${subject?.name || "Matière"}`, desc: `${g.score}/20`, time: exam?.date ? new Date(exam.date).toLocaleDateString("fr-FR") : "" });
      }
    });

    const recentAbsences = attendance.filter(a => a.student_id === child.id && a.status === "absent").length;
    if (recentAbsences > 3) notifs.push({ type: "warning", icon: "🔴", title: "Absentéisme important", desc: `${recentAbsences} absences enregistrées`, time: "Ce trimestre" });

    const activeSanctions = sanctions.filter(s => s.student_id === child.id && !s.resolved).length;
    if (activeSanctions > 0) notifs.push({ type: "alert", icon: "⚡", title: "Sanction en cours", desc: `${activeSanctions} sanction(s) non résolue(s)`, time: "En cours" });

    if (!notifs.length) notifs.push({ type: "success", icon: "✅", title: "Tout va bien !", desc: "Aucune alerte particulière", time: "Aujourd'hui" });
    return notifs;
  }, [child, grades, exams, attendance, sanctions, subjects]);

  const handleAIInsights = async () => {
    if (!child) return;
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un conseiller pédagogique bienveillant. L'élève ${child.first_name} ${child.last_name} a ces informations:
- Alertes: ${JSON.stringify(notifications.map(n => n.title))}
Donne un message personnalisé aux parents avec 3-4 conseils pratiques pour soutenir leur enfant. Sois chaleureux et positif.`,
      response_json_schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          conseils: { type: "array", items: { type: "string" } }
        }
      }
    });
    setAiInsights(result);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Notifications intelligentes</h3>
        <Button onClick={handleAIInsights} disabled={loading} size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Analyse IA
        </Button>
      </div>

      {aiInsights && (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-slate-700">{aiInsights.message}</p>
            <ul className="space-y-1.5">
              {aiInsights.conseils?.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-violet-500 mt-0.5">💡</span>{c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notifications.map((n, i) => (
          <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${
            n.type === "warning" || n.type === "alert" ? "bg-red-50 border-red-200" :
            n.type === "success" ? "bg-green-50 border-green-200" :
            "bg-blue-50 border-blue-200"
          }`}>
            <span className="text-2xl">{n.icon}</span>
            <div className="flex-1">
              <p className="font-medium text-sm text-slate-900">{n.title}</p>
              <p className="text-xs text-slate-600">{n.desc}</p>
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CHAT TAB ────────────────────────────────────────────────
function ChatTab({ child, teachers, messages }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [localMessages, setLocalMessages] = useState([]);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);

  const createMessage = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });

  const conversation = useMemo(() => {
    if (!selectedTeacher) return [];
    return messages
      .filter(m =>
        (m.sender_id === selectedTeacher.id || m.recipient_id === selectedTeacher.id) &&
        (m.student_id === child?.id)
      )
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  }, [messages, selectedTeacher, child]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedTeacher || !child) return;
    await createMessage.mutateAsync({
      sender_type: "parent",
      sender_name: `Parent de ${child.first_name}`,
      recipient_type: "teacher",
      recipient_id: selectedTeacher.id,
      student_id: child.id,
      subject: `Message concernant ${child.first_name} ${child.last_name}`,
      content: newMessage.trim(),
      priority: "normal",
    });
    setNewMessage("");
  };

  return (
    <div className="space-y-4">
      {!selectedTeacher ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800">Choisir un enseignant</h3>
          {teachers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Aucun enseignant disponible</p>
          )}
          {teachers.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTeacher(t)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-sm">
                {t.first_name?.[0]}{t.last_name?.[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{t.first_name} {t.last_name}</p>
                <p className="text-xs text-slate-500">{t.email}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ height: "500px" }}>
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
            <button onClick={() => setSelectedTeacher(null)} className="text-slate-400 hover:text-slate-600">←</button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white text-sm font-bold">
              {selectedTeacher.first_name?.[0]}{selectedTeacher.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-sm">{selectedTeacher.first_name} {selectedTeacher.last_name}</p>
              <p className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span> Disponible</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {conversation.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Commencez la conversation
              </div>
            )}
            {conversation.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === "parent" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                  msg.sender_type === "parent"
                    ? "bg-amber-500 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-900 rounded-bl-sm"
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.sender_type === "parent" ? "text-amber-200" : "text-slate-400"}`}>
                    {msg.created_date ? new Date(msg.created_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 pt-3 border-t border-slate-200">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              onKeyDown={e => e.key === "Enter" && handleSend()}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!newMessage.trim()} className="bg-amber-500 hover:bg-amber-600">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RDV TAB ─────────────────────────────────────────────────
function RdvTab({ teachers, child }) {
  const queryClient = useQueryClient();
  const { userEmail, myChildren } = useCurrentMember();

  const EMPTY_FORM = { teacher_id: "", date: "", time: "", reason: "", notes: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [successMsg, setSuccessMsg] = useState("");

  const TIMES = [
    "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00",
  ];

  const REASONS = [
    "Suivi des résultats scolaires",
    "Difficultés dans la matière",
    "Comportement en classe",
    "Projet d'orientation",
    "Félicitations / Encouragements",
    "Demande d'information générale",
    "Autre sujet",
  ];

  const STATUS_CONFIG = {
    pending:   { label: "En attente",  cls: "bg-amber-100 text-amber-800"  },
    confirmed: { label: "Confirmé",    cls: "bg-green-100 text-green-700"  },
    cancelled: { label: "Annulé",      cls: "bg-slate-100 text-slate-500"  },
    done:      { label: "Effectué",    cls: "bg-blue-100  text-blue-700"   },
  };

  // ── Chargement des RDV depuis la BDD ──────────────────────────────────────
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["parentAppointments"],
    queryFn: () => base44.entities.ParentAppointment.list("-created_date"),
  });

  // ── Création ──────────────────────────────────────────────────────────────
  const createRdv = useMutation({
    mutationFn: (data) => base44.entities.ParentAppointment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentAppointments"] });
      setForm(EMPTY_FORM);
      setSuccessMsg("Rendez-vous enregistré et en attente de confirmation !");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
  });

  // ── Annulation ────────────────────────────────────────────────────────────
  const cancelRdv = useMutation({
    mutationFn: (id) => base44.entities.ParentAppointment.update(id, { status: "cancelled" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["parentAppointments"] }),
  });

  const selectedTeacher = teachers.find(t => t.id === form.teacher_id);
  const canSubmit = form.teacher_id && form.date && form.time && form.reason && !createRdv.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createRdv.mutate({
      parent_id:    null,          // sera rempli côté serveur si auth parent
      parent_name:  userEmail || "Parent",
      student_id:   child?.id || null,
      teacher_id:   form.teacher_id,
      teacher_name: `${selectedTeacher?.first_name || ""} ${selectedTeacher?.last_name || ""}`.trim(),
      date:         form.date,
      time:         form.time,
      reason:       form.reason,
      notes:        form.notes || null,
      status:       "pending",
    });
  };

  // Trier : à venir d'abord, ensuite passés
  const sortedRdvs = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}`);
      const db = new Date(`${b.date}T${b.time}`);
      const now = new Date();
      const aFuture = da >= now;
      const bFuture = db >= now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? da - db : db - da; // futurs ASC, passés DESC
    });
  }, [appointments]);

  const upcoming = sortedRdvs.filter(r => {
    const d = new Date(`${r.date}T${r.time}`);
    return d >= new Date() && r.status !== "cancelled";
  });
  const past = sortedRdvs.filter(r => {
    const d = new Date(`${r.date}T${r.time}`);
    return d < new Date() || r.status === "cancelled";
  });

  return (
    <div className="space-y-5">
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Prendre un rendez-vous</h3>
        {upcoming.length > 0 && (
          <Badge className="bg-amber-100 text-amber-800">
            {upcoming.length} RDV à venir
          </Badge>
        )}
      </div>

      {/* ── Succès ── */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CalendarCheck className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Rendez-vous enregistré !</p>
            <p className="text-xs">{successMsg}</p>
          </div>
        </div>
      )}

      {/* ── Erreur ── */}
      {createRdv.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Erreur : {createRdv.error?.message || "Impossible d'enregistrer le rendez-vous."}
        </div>
      )}

      {/* ── Formulaire ── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Enseignant */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Enseignant <span className="text-red-500">*</span>
            </label>
            <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un enseignant…" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                    {t.email ? ` — ${t.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Horaire <span className="text-red-500">*</span>
              </label>
              <Select value={form.time} onValueChange={v => setForm(f => ({ ...f, time: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motif */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Motif <span className="text-red-500">*</span>
            </label>
            <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un motif…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Notes optionnelles */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Message / précisions <span className="text-xs text-slate-400">(optionnel)</span>
            </label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Décrivez brièvement votre demande…"
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-amber-500 hover:bg-amber-600 gap-2"
          >
            {createRdv.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CalendarCheck className="w-4 h-4" />
            }
            Demander le rendez-vous
          </Button>
        </CardContent>
      </Card>

      {/* ── Rendez-vous à venir ── */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-500" />
                Rendez-vous à venir ({upcoming.length})
              </h4>
              {upcoming.map(rdv => {
                const cfg = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.pending;
                const dateStr = (() => {
                  try {
                    return new Date(rdv.date + "T00:00:00").toLocaleDateString("fr-FR", {
                      weekday: "short", day: "numeric", month: "long",
                    });
                  } catch { return rdv.date; }
                })();
                return (
                  <Card key={rdv.id} className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                    <CardContent className="p-4 flex items-center gap-4">
                      {/* Mini calendrier */}
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-amber-500 rounded-xl text-white flex-shrink-0">
                        <span className="text-[10px] font-semibold uppercase leading-none opacity-80 mt-1">
                          {new Date(rdv.date + "T00:00:00").toLocaleDateString("fr-FR", { month: "short" })}
                        </span>
                        <span className="text-xl font-bold leading-tight">
                          {new Date(rdv.date + "T00:00:00").getDate()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900">
                          {rdv.teacher_name || "Enseignant"}
                        </p>
                        <p className="text-xs text-slate-500">{dateStr} à {rdv.time}</p>
                        <p className="text-xs text-amber-700 mt-0.5 truncate">{rdv.reason}</p>
                        {rdv.notes && (
                          <p className="text-xs text-slate-400 mt-0.5 italic truncate">"{rdv.notes}"</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge className={cfg.cls}>{cfg.label}</Badge>
                        {rdv.status === "pending" && (
                          <button
                            onClick={() => cancelRdv.mutate(rdv.id)}
                            disabled={cancelRdv.isPending}
                            className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2 transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Historique ── */}
          {past.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-slate-500 flex items-center gap-2 select-none list-none py-1">
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                Historique ({past.length})
              </summary>
              <div className="space-y-2 mt-2">
                {past.map(rdv => {
                  const cfg = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.done;
                  return (
                    <Card key={rdv.id} className="opacity-70 border-slate-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">{rdv.teacher_name || "Enseignant"}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(rdv.date + "T00:00:00").toLocaleDateString("fr-FR")} à {rdv.time} — {rdv.reason}
                          </p>
                        </div>
                        <Badge className={`${cfg.cls} text-xs`}>{cfg.label}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </details>
          )}

          {appointments.length === 0 && !successMsg && (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun rendez-vous pour le moment</p>
              <p className="text-xs mt-1">Remplissez le formulaire ci-dessus pour en prendre un</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── FACTURES TAB ─────────────────────────────────────────────────────────────
function FacturesTab({ invoices, child }) {
  const fmtDA = n => Number(n || 0).toLocaleString("fr-DZ") + " DA";

  const totalNet       = invoices.reduce((s, i) => s + (Number(i.net_amount)  || 0), 0);
  const totalPaid      = invoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);
  const totalBalance   = invoices.reduce((s, i) => s + (Number(i.balance)     || 0), 0);
  const globalPct      = totalNet > 0 ? Math.min(100, Math.round((totalPaid / totalNet) * 100)) : 0;

  const handleDownload = (tx, invoice) => {
    generateReceipt({ transaction: tx, invoice, student: child, schoolName: "EduGest" });
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucune facture pour cet élève</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 text-white">
          <p className="text-sm opacity-80 mb-1">Situation financière de {child?.first_name}</p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold">{fmtDA(totalBalance)}</p>
              <p className="text-sm opacity-70 mt-0.5">reste à payer</p>
            </div>
            <div className="text-right text-sm opacity-80">
              <p>{fmtDA(totalPaid)} payé</p>
              <p>{fmtDA(totalNet)} total</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span>Progression</span>
              <span className="font-semibold">{globalPct}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${globalPct >= 100 ? "bg-emerald-400" : globalPct > 0 ? "bg-amber-400" : "bg-white/40"}`}
                style={{ width: `${globalPct}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Per-invoice cards */}
      {invoices.map(inv => {
        const st  = STATUS_FIN[inv.status] || STATUS_FIN.unpaid;
        const pct = inv.net_amount > 0 ? Math.min(100, Math.round(((inv.paid_amount || 0) / inv.net_amount) * 100)) : 0;

        return (
          <Card key={inv.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{inv.label || `Scolarité ${inv.school_year}`}</p>
                  <p className="text-xs text-slate-400">{inv.school_year}</p>
                </div>
                <Badge className={`${st.color} text-xs flex-shrink-0`}>{st.label}</Badge>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{fmtDA(inv.paid_amount)} payé</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Reste : {fmtDA(inv.balance)}</span>
                  <span>Total : {fmtDA(inv.net_amount)}</span>
                </div>
              </div>

              {/* Detail items */}
              {inv.items?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-indigo-600 font-medium py-1">
                    Voir le détail ({inv.items.length} ligne{inv.items.length > 1 ? "s" : ""})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {inv.items.map(it => (
                      <div key={it.id} className="flex justify-between text-slate-600 py-0.5">
                        <span>{it.label}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</span>
                        <span className="font-mono">{fmtDA(Number(it.amount) * Number(it.quantity))}</span>
                      </div>
                    ))}
                    {Number(inv.discount_amount) > 0 && (
                      <div className="flex justify-between text-emerald-600 pt-1 border-t">
                        <span>Remise</span>
                        <span className="font-mono">− {fmtDA(inv.discount_amount)}</span>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Payment history with PDF download */}
              {inv.transactions?.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paiements effectués</p>
                  {inv.transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800">{fmtDA(tx.amount)}</p>
                          <p className="text-[11px] text-slate-500">
                            {PAYMENT_METHODS_FR[tx.payment_method] || tx.payment_method}
                            {tx.reference ? ` · ${tx.reference}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {tx.payment_date ? format(new Date(tx.payment_date + "T12:00:00"), "d MMM yy", { locale: fr }) : ""}
                        </span>
                        <button
                          onClick={() => handleDownload(tx, inv)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-medium transition-colors"
                          title="Télécharger le reçu PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Reçu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}