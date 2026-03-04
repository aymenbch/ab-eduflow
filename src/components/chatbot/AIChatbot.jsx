import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle, X, Send, Loader2, Sparkles, ChevronDown, Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ─── Mode definitions ──────────────────────────────────────────────────────────
const CHAT_MODES = {
  eleve: {
    label: "Aide aux devoirs",
    emoji: "🎒",
    color: "from-pink-500 to-pink-700",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-200",
    accentText: "text-pink-700",
  },
  parent: {
    label: "Suivi de mon enfant",
    emoji: "👨‍👩‍👧",
    color: "from-amber-500 to-amber-700",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    accentText: "text-amber-700",
  },
  direction: {
    label: "Analyse & Pilotage",
    emoji: "👑",
    color: "from-slate-700 to-slate-900",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    accentText: "text-slate-700",
  },
  admin: {
    label: "Assistant Administratif",
    emoji: "📋",
    color: "from-cyan-600 to-cyan-800",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    accentText: "text-cyan-700",
  },
  enseignant: {
    label: "Assistant Enseignant",
    emoji: "📚",
    color: "from-green-600 to-green-800",
    bgLight: "bg-green-50",
    borderColor: "border-green-200",
    accentText: "text-green-700",
  },
};

const ROLE_TO_MODE = {
  eleve: "eleve",
  parent: "parent",
  directeur_general: "direction",
  directeur_primaire: "direction",
  directeur_college: "direction",
  directeur_lycee: "direction",
  cpe: "admin",
  enseignant: "enseignant",
  secretaire: "admin",
  comptable: "admin",
};

// ─── Build personalized context string from real data ─────────────────────────
function buildContext(mode, { students, classes, exams, grades, attendance, subjects, sanctions, homeworks, events, payments, schedules, schoolYears }) {
  const today = new Date().toISOString().split("T")[0];
  const lines = [`Date du jour: ${today}\n`];

  if (mode === "parent") {
    // In demo mode, show first 3 active students as "children"
    const children = students.filter(s => s.status === "active").slice(0, 3);
    if (children.length === 0) {
      lines.push("Aucun élève trouvé pour ce parent.");
    } else {
      lines.push("=== VOS ENFANTS ===");
      children.forEach(child => {
        const cls = classes.find(c => c.id === child.class_id);
        const childExams = exams.filter(e => e.class_id === child.class_id)
          .sort((a, b) => a.date?.localeCompare(b.date));
        const nextExams = childExams.filter(e => e.date >= today).slice(0, 5);
        const childGrades = grades.filter(g => g.student_id === child.id && !g.absent && g.score != null);
        const avg = childGrades.length ? (childGrades.reduce((a, b) => a + b.score, 0) / childGrades.length).toFixed(2) : "Non disponible";
        const childAtt = attendance.filter(a => a.student_id === child.id);
        const absences = childAtt.filter(a => a.status === "absent").length;
        const childSanctions = sanctions.filter(s => s.student_id === child.id && !s.resolved);
        const childHw = homeworks.filter(h => h.class_id === child.class_id && h.due_date >= today)
          .sort((a, b) => a.due_date?.localeCompare(b.due_date)).slice(0, 5);

        lines.push(`\nEnfant: ${child.first_name} ${child.last_name} (${child.gender === "M" ? "Garçon" : "Fille"})`);
        lines.push(`Classe: ${cls?.name || "Inconnue"} | Niveau: ${cls?.level || "—"} | Année scolaire: ${cls?.school_year || "—"}`);
        lines.push(`Moyenne générale: ${avg}/20`);
        lines.push(`Absences: ${absences} | Retards: ${childAtt.filter(a => a.status === "late").length}`);
        lines.push(`Sanctions actives: ${childSanctions.length}`);

        if (nextExams.length > 0) {
          lines.push(`Prochains examens/contrôles:`);
          nextExams.forEach(e => {
            const sub = subjects.find(s => s.id === e.subject_id);
            lines.push(`  - ${e.date} | ${sub?.name || "?"} | ${e.title} (${e.type}, Coeff ${e.coefficient || 1}) | Trimestre: ${e.trimester || "?"}`);
          });
        } else {
          lines.push("Aucun examen prévu prochainement.");
        }

        if (childHw.length > 0) {
          lines.push(`Devoirs à rendre:`);
          childHw.forEach(h => {
            const sub = subjects.find(s => s.id === h.subject_id);
            lines.push(`  - ${h.due_date} | ${sub?.name || "?"} | ${h.title}`);
          });
        }

        if (childGrades.length > 0) {
          lines.push(`Dernières notes (5 dernières):`);
          childGrades.slice(-5).forEach(g => {
            const exam = exams.find(e => e.id === g.exam_id);
            const sub = subjects.find(s => s.id === exam?.subject_id);
            lines.push(`  - ${sub?.name || "?"}: ${g.score}/20${g.comment ? " — " + g.comment : ""}`);
          });
        }
      });
    }
  }

  if (mode === "eleve") {
    // Show one demo student's data
    const student = students.find(s => s.status === "active");
    if (student) {
      const cls = classes.find(c => c.id === student.class_id);
      const myGrades = grades.filter(g => g.student_id === student.id && !g.absent && g.score != null);
      const avg = myGrades.length ? (myGrades.reduce((a, b) => a + b.score, 0) / myGrades.length).toFixed(2) : "—";
      const nextExams = exams.filter(e => e.class_id === student.class_id && e.date >= today)
        .sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 5);
      const myHw = homeworks.filter(h => h.class_id === student.class_id && h.due_date >= today)
        .sort((a, b) => a.due_date?.localeCompare(b.due_date)).slice(0, 5);

      lines.push(`=== MON PROFIL ÉLÈVE ===`);
      lines.push(`Nom: ${student.first_name} ${student.last_name}`);
      lines.push(`Classe: ${cls?.name || "?"} | Niveau: ${cls?.level || "?"} | Année: ${cls?.school_year || "?"}`);
      lines.push(`Moyenne générale: ${avg}/20`);

      if (nextExams.length > 0) {
        lines.push(`Prochains examens:`);
        nextExams.forEach(e => {
          const sub = subjects.find(s => s.id === e.subject_id);
          lines.push(`  - ${e.date} | ${sub?.name || "?"} | ${e.title} (${e.type})`);
        });
      }

      if (myHw.length > 0) {
        lines.push(`Devoirs à rendre:`);
        myHw.forEach(h => {
          const sub = subjects.find(s => s.id === h.subject_id);
          lines.push(`  - ${h.due_date} | ${sub?.name || "?"} | ${h.title} — Priorité: ${h.priority}`);
        });
      }

      if (myGrades.length > 0) {
        lines.push(`Mes dernières notes:`);
        myGrades.slice(-8).forEach(g => {
          const exam = exams.find(e => e.id === g.exam_id);
          const sub = subjects.find(s => s.id === exam?.subject_id);
          lines.push(`  - ${sub?.name || "?"}: ${g.score}/20${g.comment ? " — " + g.comment : ""}`);
        });
      }

      // Schedule today
      const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const todayDay = days[new Date().getDay()];
      const todaySchedule = schedules.filter(s => s.class_id === student.class_id && s.day_of_week === todayDay);
      if (todaySchedule.length > 0) {
        lines.push(`Emploi du temps aujourd'hui (${todayDay}):`);
        todaySchedule.sort((a, b) => a.start_time?.localeCompare(b.start_time)).forEach(s => {
          const sub = subjects.find(su => su.id === s.subject_id);
          lines.push(`  - ${s.start_time}-${s.end_time} | ${sub?.name || "?"} | Salle: ${s.room || "?"}`);
        });
      }
    }
  }

  if (mode === "direction") {
    const activeStudents = students.filter(s => s.status === "active");
    const allGrades = grades.filter(g => !g.absent && g.score != null);
    const globalAvg = allGrades.length ? (allGrades.reduce((a, b) => a + b.score, 0) / allGrades.length).toFixed(2) : "—";
    const successRate = allGrades.length ? ((allGrades.filter(g => g.score >= 10).length / allGrades.length) * 100).toFixed(1) : "—";
    const allAtt = attendance;
    const absRate = allAtt.length ? ((allAtt.filter(a => a.status === "absent").length / allAtt.length) * 100).toFixed(1) : "—";
    const activeSanctions = sanctions.filter(s => !s.resolved).length;

    lines.push(`=== TABLEAU DE BORD DIRECTION ===`);
    lines.push(`Élèves actifs: ${activeStudents.length}`);
    lines.push(`Classes: ${classes.length}`);
    lines.push(`Matières: ${subjects.length}`);
    lines.push(`Moyenne générale établissement: ${globalAvg}/20`);
    lines.push(`Taux de réussite (≥10): ${successRate}%`);
    lines.push(`Taux d'absentéisme: ${absRate}%`);
    lines.push(`Sanctions actives: ${activeSanctions}`);

    // Performance by class
    if (classes.length > 0) {
      lines.push(`\nPerformance par classe (top 10):`);
      classes.slice(0, 10).forEach(cls => {
        const clsStudents = activeStudents.filter(s => s.class_id === cls.id).map(s => s.id);
        const clsExams = exams.filter(e => e.class_id === cls.id).map(e => e.id);
        const clsGrades = grades.filter(g => clsStudents.includes(g.student_id) && clsExams.includes(g.exam_id) && !g.absent && g.score != null);
        const avg = clsGrades.length ? (clsGrades.reduce((a, b) => a + b.score, 0) / clsGrades.length).toFixed(1) : "—";
        lines.push(`  - ${cls.name} (${cls.level}, ${cls.school_year}): ${clsStudents.length} élèves | Moy: ${avg}/20`);
      });
    }

    // Upcoming exams
    const upcoming = exams.filter(e => e.date >= today).sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 5);
    if (upcoming.length > 0) {
      lines.push(`\nProchains examens:`);
      upcoming.forEach(e => {
        const sub = subjects.find(s => s.id === e.subject_id);
        const cls = classes.find(c => c.id === e.class_id);
        lines.push(`  - ${e.date} | ${sub?.name || "?"} | ${cls?.name || "?"} | ${e.title}`);
      });
    }

    // At-risk students
    const atRisk = activeStudents.filter(s => {
      const sg = grades.filter(g => g.student_id === s.id && !g.absent && g.score != null);
      if (sg.length < 2) return false;
      const avg = sg.reduce((a, b) => a + b.score, 0) / sg.length;
      return avg < 8;
    });
    lines.push(`\nÉlèves en difficulté scolaire (moy < 8): ${atRisk.length}`);
  }

  if (mode === "enseignant") {
    // Show all classes, upcoming exams, pending homeworks
    lines.push(`=== DONNÉES ENSEIGNANT ===`);
    lines.push(`Classes enregistrées: ${classes.length}`);
    lines.push(`Matières: ${subjects.map(s => s.name).join(", ")}`);

    const upcoming = exams.filter(e => e.date >= today).sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 8);
    if (upcoming.length > 0) {
      lines.push(`\nProchains examens:`);
      upcoming.forEach(e => {
        const sub = subjects.find(s => s.id === e.subject_id);
        const cls = classes.find(c => c.id === e.class_id);
        lines.push(`  - ${e.date} | ${sub?.name || "?"} | ${cls?.name || "?"} | ${e.title} (${e.trimester || "—"})`);
      });
    }

    const pendingHw = homeworks.filter(h => h.due_date >= today).sort((a, b) => a.due_date?.localeCompare(b.due_date)).slice(0, 8);
    if (pendingHw.length > 0) {
      lines.push(`\nDevoirs à venir:`);
      pendingHw.forEach(h => {
        const sub = subjects.find(s => s.id === h.subject_id);
        const cls = classes.find(c => c.id === h.class_id);
        lines.push(`  - ${h.due_date} | ${sub?.name || "?"} | ${cls?.name || "?"} | ${h.title}`);
      });
    }

    // Recent grades to grade
    lines.push(`\nTotal notes saisies: ${grades.length}`);
    const activeSanctions = sanctions.filter(s => !s.resolved).length;
    lines.push(`Sanctions actives établissement: ${activeSanctions}`);
  }

  if (mode === "admin") {
    lines.push(`=== DONNÉES ADMINISTRATIVES ===`);
    lines.push(`Élèves actifs: ${students.filter(s => s.status === "active").length}`);
    lines.push(`Classes: ${classes.length}`);
    lines.push(`Années scolaires: ${schoolYears.map(sy => `${sy.name} (${sy.status})`).join(", ")}`);

    // Upcoming events
    const upcomingEvents = events.filter(e => e.date >= today).sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 8);
    if (upcomingEvents.length > 0) {
      lines.push(`\nÉvénements à venir:`);
      upcomingEvents.forEach(e => {
        lines.push(`  - ${e.date} ${e.start_time ? e.start_time : ""} | ${e.title} (${e.type}) | Public: ${e.target_audience || "tous"}`);
      });
    }

    // Upcoming exams
    const upcoming = exams.filter(e => e.date >= today).sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 8);
    if (upcoming.length > 0) {
      lines.push(`\nProchains examens/contrôles:`);
      upcoming.forEach(e => {
        const sub = subjects.find(s => s.id === e.subject_id);
        const cls = classes.find(c => c.id === e.class_id);
        lines.push(`  - ${e.date} | ${sub?.name || "?"} | ${cls?.name || "?"} | ${e.title} (${e.trimester || "—"})`);
      });
    }

    // Financial summary
    const overdue = payments.filter(p => p.status === "overdue").length;
    const pending = payments.filter(p => p.status === "pending").length;
    lines.push(`\nFinances: ${overdue} paiements en retard, ${pending} en attente`);

    const activeSanctions = sanctions.filter(s => !s.resolved).length;
    lines.push(`Sanctions actives: ${activeSanctions}`);
  }

  return lines.join("\n");
}

// ─── Suggestions by mode ───────────────────────────────────────────────────────
const SUGGESTIONS = {
  eleve: ["Quels sont mes prochains examens ?", "Quels devoirs dois-je rendre ?", "Explique-moi les équations du 2nd degré", "Mon emploi du temps d'aujourd'hui ?"],
  parent: ["Quand sont les prochains examens de mon enfant ?", "Quelles sont les dernières notes ?", "Y a-t-il des devoirs à rendre cette semaine ?", "Combien d'absences mon enfant a-t-il ?"],
  direction: ["Quelle est la moyenne générale de l'établissement ?", "Combien d'élèves sont en difficulté ?", "Quels sont les prochains examens ?", "Comment réduire l'absentéisme ?"],
  enseignant: ["Quels examens sont prévus cette semaine ?", "Quels devoirs sont à rendre prochainement ?", "Comment améliorer l'engagement des élèves ?", "Combien de notes ont été saisies ?"],
  admin: ["Quels sont les prochains événements ?", "Y a-t-il des paiements en retard ?", "Quels examens sont prévus ?", "Rédige une convocation de conseil de classe"],
};

// ─── System prompts ────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  eleve: "Tu es un assistant scolaire bienveillant pour un élève. Utilise les données réelles de son profil fournies dans le contexte pour répondre précisément à ses questions (notes, examens, devoirs, planning). Pour les questions pédagogiques, explique de façon claire et pédagogique. Réponds toujours en français.",
  parent: "Tu es un conseiller pédagogique bienveillant pour les parents. Utilise les données réelles des enfants fournies dans le contexte (notes, examens, absences, devoirs) pour répondre avec précision. Sois rassurant et constructif. Réponds toujours en français.",
  direction: "Tu es un conseiller stratégique pour la direction d'un établissement scolaire. Utilise les données réelles de l'établissement fournies dans le contexte pour analyser et donner des recommandations précises et factuelles. Réponds toujours en français de façon professionnelle.",
  enseignant: "Tu es un assistant pédagogique pour un enseignant. Utilise les données réelles (examens, devoirs, élèves, classes) fournies dans le contexte pour répondre avec précision. Donne aussi des conseils pédagogiques pratiques. Réponds toujours en français.",
  admin: "Tu es un assistant administratif expert pour un établissement scolaire. Utilise les données réelles (événements, examens, planning, finances) fournies dans le contexte pour répondre avec précision. Aide aussi à la rédaction de documents officiels. Réponds toujours en français.",
};

// ─── Bubble ───────────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm",
        isUser ? "bg-slate-800 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
      )}>
        {isUser ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-1 ml-3 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 ml-3 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children }) => <code className="bg-slate-100 px-1 rounded text-xs">{children}</code>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AIChatbot() {
  const role = localStorage.getItem("edugest_role") || "secretaire";
  const defaultMode = ROLE_TO_MODE[role] || "admin";

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(defaultMode);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const modeConfig = CHAT_MODES[mode];

  // ── Fetch all entity data ──────────────────────────────────────────────────
  const { data: students = [] } = useQuery({ queryKey: ["chatbot_students"], queryFn: () => base44.entities.Student.list(), enabled: open });
  const { data: classes = [] } = useQuery({ queryKey: ["chatbot_classes"], queryFn: () => base44.entities.Class.list(), enabled: open });
  const { data: exams = [] } = useQuery({ queryKey: ["chatbot_exams"], queryFn: () => base44.entities.Exam.list(), enabled: open });
  const { data: grades = [] } = useQuery({ queryKey: ["chatbot_grades"], queryFn: () => base44.entities.Grade.list(), enabled: open });
  const { data: subjects = [] } = useQuery({ queryKey: ["chatbot_subjects"], queryFn: () => base44.entities.Subject.list(), enabled: open });
  const { data: attendance = [] } = useQuery({ queryKey: ["chatbot_attendance"], queryFn: () => base44.entities.Attendance.list(), enabled: open });
  const { data: sanctions = [] } = useQuery({ queryKey: ["chatbot_sanctions"], queryFn: () => base44.entities.Sanction.list(), enabled: open });
  const { data: homeworks = [] } = useQuery({ queryKey: ["chatbot_homeworks"], queryFn: () => base44.entities.Homework.list(), enabled: open });
  const { data: events = [] } = useQuery({ queryKey: ["chatbot_events"], queryFn: () => base44.entities.Event.list(), enabled: open });
  const { data: payments = [] } = useQuery({ queryKey: ["chatbot_payments"], queryFn: () => base44.entities.Payment.list(), enabled: open });
  const { data: schedules = [] } = useQuery({ queryKey: ["chatbot_schedules"], queryFn: () => base44.entities.Schedule.list(), enabled: open });
  const { data: schoolYears = [] } = useQuery({ queryKey: ["chatbot_schoolyears"], queryFn: () => base44.entities.SchoolYear.list(), enabled: open });

  const contextData = useMemo(() => ({ students, classes, exams, grades, subjects, attendance, sanctions, homeworks, events, payments, schedules, schoolYears }),
    [students, classes, exams, grades, subjects, attendance, sanctions, homeworks, events, payments, schedules, schoolYears]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleModeChange = (m) => { setMode(m); setMessages([]); setShowModeSelector(false); };

  const sendMessage = async (content) => {
    if (!content.trim() || loading) return;
    const userMsg = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const context = buildContext(mode, contextData);
    const history = newMessages.slice(-8).map(m => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`).join("\n\n");

    const prompt = `${SYSTEM_PROMPTS[mode]}

=== DONNÉES RÉELLES DE L'ÉTABLISSEMENT ===
${context}

=== HISTORIQUE DE LA CONVERSATION ===
${history}

Réponds à la dernière question de l'utilisateur en te basant sur les données réelles ci-dessus. Si une information précise est disponible dans les données, utilise-la. Sois direct et précis.`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { role: "assistant", content: response }]);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-500/40 flex items-center justify-center text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-200 bg-white" style={{ height: "580px" }}>

          {/* Header */}
          <div className={`bg-gradient-to-r ${modeConfig.color} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-xl">{modeConfig.emoji}</div>
              <div>
                <p className="font-semibold text-white text-sm">Assistant IA EduGest</p>
                <button onClick={() => setShowModeSelector(!showModeSelector)} className="flex items-center gap-1 text-white/70 text-xs hover:text-white transition-colors">
                  {modeConfig.label}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showModeSelector && "rotate-180")} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white/60" />
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Mode selector */}
          {showModeSelector && (
            <div className="flex-shrink-0 border-b border-slate-100 bg-white p-2 grid grid-cols-2 gap-1 z-10">
              {Object.entries(CHAT_MODES).map(([key, cfg]) => (
                <button key={key} onClick={() => handleModeChange(key)}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-medium transition-all text-left",
                    mode === key ? `${cfg.bgLight} ${cfg.accentText} border ${cfg.borderColor}` : "hover:bg-slate-50 text-slate-600")}>
                  <span className="text-base">{cfg.emoji}</span><span>{cfg.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center pt-2">
                <div className={`inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br ${modeConfig.color} items-center justify-center text-xl mb-2`}>{modeConfig.emoji}</div>
                <p className="font-semibold text-slate-700 text-sm mb-0.5">{modeConfig.label}</p>
                <p className="text-slate-400 text-xs mb-4">Je consulte vos données en temps réel pour répondre avec précision</p>
                <div className="space-y-2">
                  {(SUGGESTIONS[mode] || []).map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className={cn("w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm", modeConfig.bgLight, modeConfig.borderColor, modeConfig.accentText)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-slate-100 bg-white">
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs text-slate-400 hover:text-slate-600 mb-2 block ml-auto">Effacer</button>
            )}
            <div className="flex gap-2">
              <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Votre question..." className="flex-1 text-sm h-10 rounded-xl border-slate-200" disabled={loading} />
              <Button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                className={cn("h-10 w-10 p-0 rounded-xl bg-gradient-to-br", modeConfig.color, "text-white flex-shrink-0 hover:opacity-90")}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}