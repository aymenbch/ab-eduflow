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
  ChevronRight, Sparkles, Shield, Award, Loader2, CalendarCheck, ChevronDown
} from "lucide-react";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TABS = [
  { id: "notes", label: "📊 Notes", icon: TrendingUp },
  { id: "comportement", label: "🛡️ Comportement", icon: Shield },
  { id: "notifications", label: "🔔 Notifications", icon: Bell },
  { id: "chat", label: "💬 Chat", icon: MessageCircle },
  { id: "rdv", label: "📅 Rendez-vous", icon: Calendar },
];

export default function EspaceParent() {
  const [activeTab, setActiveTab] = useState("notes");
  const [selectedChildId, setSelectedChildId] = useState(null);

  const { myChildren, isParent, userEmail } = useCurrentMember();

  const { data: allStudents = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.Attendance.list() });
  const { data: sanctions = [] } = useQuery({ queryKey: ["sanctions"], queryFn: () => base44.entities.Sanction.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: messages = [] } = useQuery({ queryKey: ["messages"], queryFn: () => base44.entities.Message.list() });

  // Determine which students to show: if connected as parent, filter to own children
  const students = isParent && myChildren.length > 0 ? myChildren : allStudents;

  // Auto-select first child
  React.useEffect(() => {
    if (students.length > 0 && !selectedChildId) {
      setSelectedChildId(students[0].id);
    }
  }, [students]);

  // The selected child
  const child = students.find(s => s.id === selectedChildId) || students[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="text-4xl">👨‍👩‍👧</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Espace Parents</h1>
                <Badge className="bg-white/20 text-white border-white/30 text-xs">✨ Premium</Badge>
              </div>
              <p className="text-white/80 text-sm mt-0.5">
                Suivi complet de{" "}
                <span className="font-semibold text-white">
                  {child ? `${child.first_name} ${child.last_name}` : "votre enfant"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Child selector (for parents with multiple children) */}
            {students.length > 1 && (
              <Select value={selectedChildId || ""} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-48 bg-white/20 border-white/30 text-white text-sm h-8">
                  <SelectValue placeholder="Choisir un enfant" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1 text-green-300 text-xs">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Connecté
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                : "bg-white text-slate-600 hover:bg-amber-50 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
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
        <RdvTab teachers={teachers} />
      )}
    </div>
  );
}

// ─── NOTES TAB ───────────────────────────────────────────────
function NotesTab({ child, grades, exams, subjects }) {
  const [selectedTrimester, setSelectedTrimester] = useState("all");

  const childGrades = useMemo(() => {
    if (!child) return [];
    return grades.filter(g => g.student_id === child.id && !g.absent && g.score != null);
  }, [child, grades]);

  const bySubject = useMemo(() => {
    return subjects.map(sub => {
      const subExams = exams.filter(e => e.subject_id === sub.id &&
        (selectedTrimester === "all" || e.trimester === selectedTrimester));
      const subGrades = childGrades.filter(g => subExams.map(e => e.id).includes(g.exam_id));
      if (!subGrades.length) return null;
      const avg = subGrades.reduce((a, b) => a + b.score, 0) / subGrades.length;
      const lastGrade = subGrades[subGrades.length - 1];
      const prevGrade = subGrades[subGrades.length - 2];
      const trend = prevGrade ? (lastGrade.score > prevGrade.score ? "up" : lastGrade.score < prevGrade.score ? "down" : "stable") : "stable";
      return { sub, avg, lastScore: lastGrade?.score, trend, count: subGrades.length };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [subjects, exams, childGrades, selectedTrimester]);

  const overall = bySubject.length
    ? bySubject.reduce((s, r) => s + r.avg, 0) / bySubject.length
    : null;

  const trendIcon = (t) => t === "up"
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : t === "down"
    ? <TrendingDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-4 h-4 text-slate-400" />;

  const avgColor = (v) => v >= 14 ? "text-green-600" : v >= 10 ? "text-blue-600" : "text-red-600";

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Moyenne générale</p>
            <p className={`text-4xl font-bold ${overall ? avgColor(overall) : "text-slate-400"}`}>
              {overall ? overall.toFixed(2) : "—"}
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
                <span className={`text-2xl font-bold ${avgColor(avg)}`}>{avg.toFixed(1)}</span>
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
function RdvTab({ teachers }) {
  const [form, setForm] = useState({ teacher_id: "", date: "", time: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rdvList, setRdvList] = useState([]);

  const TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];

  const REASONS = [
    "Suivi des résultats scolaires",
    "Difficultés dans la matière",
    "Comportement en classe",
    "Projet d'orientation",
    "Félicitations / Encouragements",
    "Autre sujet",
  ];

  const selectedTeacher = teachers.find(t => t.id === form.teacher_id);

  const handleSubmit = async () => {
    if (!form.teacher_id || !form.date || !form.time || !form.reason) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 900)); // Simulate async
    setRdvList(prev => [...prev, {
      id: Date.now(),
      teacher: selectedTeacher,
      date: form.date,
      time: form.time,
      reason: form.reason,
      status: "confirmé"
    }]);
    setForm({ teacher_id: "", date: "", time: "", reason: "" });
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Prendre un rendez-vous</h3>

      {submitted && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CalendarCheck className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">Rendez-vous confirmé !</p>
            <p className="text-xs">Un email de confirmation sera envoyé automatiquement.</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Enseignant</label>
            <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un enseignant..." />
              </SelectTrigger>
              <SelectContent>
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Date</label>
              <Input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Horaire</label>
              <Select value={form.time} onValueChange={v => setForm(f => ({ ...f, time: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Motif</label>
            <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un motif..." />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!form.teacher_id || !form.date || !form.time || !form.reason || submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
            Confirmer le rendez-vous
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming RDVs */}
      {rdvList.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Mes rendez-vous</h4>
          {rdvList.map(rdv => (
            <Card key={rdv.id} className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{rdv.teacher?.first_name} {rdv.teacher?.last_name}</p>
                  <p className="text-xs text-slate-500">{new Date(rdv.date).toLocaleDateString("fr-FR")} à {rdv.time}</p>
                  <p className="text-xs text-amber-700">{rdv.reason}</p>
                </div>
                <Badge className="bg-green-100 text-green-700">✓ {rdv.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}