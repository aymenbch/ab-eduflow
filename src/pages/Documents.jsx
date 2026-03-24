import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileCheck, FileText, Receipt, BookOpen, Award,
  Download, Loader2, Search, ChevronRight, AlertCircle, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createPageUrl } from "@/utils";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { getSession } from "@/components/auth/appAuth";
import { generateAttestation } from "@/utils/pdf/generateAttestation";
import { generateReleve } from "@/utils/pdf/generateReleve";
import { generateAttestatFiscale } from "@/utils/pdf/generateAttestatFiscale";

// ── API helper ────────────────────────────────────────────────────────────────
function apiFetch(path, opts = {}) {
  const s = getSession();
  return fetch("/api" + path, {
    headers: {
      "Content-Type": "application/json",
      ...(s?.token ? { "X-Session-Token": s.token } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  }).then(r => r.json());
}

// ── Document type config ──────────────────────────────────────────────────────
const DOC_TYPES = [
  {
    id:          "attestation",
    title:       "Attestation d'inscription",
    description: "Certifie l'inscription de l'élève pour l'année scolaire en cours.",
    icon:        FileCheck,
    color:       "indigo",
    bg:          "bg-indigo-50",
    iconColor:   "text-indigo-600",
    border:      "border-indigo-200",
  },
  {
    id:          "fiscale",
    title:       "Attestation Fiscale",
    description: "Récapitulatif des frais de scolarité payés — utilisable pour déduction fiscale.",
    icon:        Receipt,
    color:       "emerald",
    bg:          "bg-emerald-50",
    iconColor:   "text-emerald-600",
    border:      "border-emerald-200",
  },
  {
    id:          "factures",
    title:       "Factures & Paiements",
    description: "Historique détaillé de toutes les factures de scolarité.",
    icon:        FileText,
    color:       "blue",
    bg:          "bg-blue-50",
    iconColor:   "text-blue-600",
    border:      "border-blue-200",
    hasDetail:   true,
  },
  {
    id:          "bulletin",
    title:       "Bulletin Scolaire",
    description: "Bulletin de notes trimestriel avec moyennes et appréciations.",
    icon:        Award,
    color:       "purple",
    bg:          "bg-purple-50",
    iconColor:   "text-purple-600",
    border:      "border-purple-200",
    isLink:      true,
  },
  {
    id:          "releve",
    title:       "Relevé de Notes",
    description: "Détail de toutes les évaluations par matière.",
    icon:        BookOpen,
    color:       "amber",
    bg:          "bg-amber-50",
    iconColor:   "text-amber-600",
    border:      "border-amber-200",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmount = (n) => Number(n || 0).toLocaleString("fr-DZ") + " DA";
const fmtDate   = (d) => { try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: fr }); } catch { return d || "—"; } };

export default function Documents() {
  const { isParent, isStudent, myChildren, myStudent, myStudentId } = useCurrentMember();

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedChildId, setSelectedChildId]   = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null); // admin
  const [studentSearch, setStudentSearch]       = useState("");
  const [generating, setGenerating]             = useState(null);
  const [expandedDoc, setExpandedDoc]           = useState(null); // 'factures'
  const [periodFilter, setPeriodFilter]         = useState("all");

  // Default child for parents
  useEffect(() => {
    if (isParent && myChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(myChildren[0].id);
    }
  }, [myChildren, isParent, selectedChildId]);

  // Student own id
  useEffect(() => {
    if (isStudent && myStudentId) setSelectedStudentId(myStudentId);
  }, [isStudent, myStudentId]);

  // Determine the active student based on role
  const activeStudentId = isParent ? selectedChildId
    : isStudent ? myStudentId
    : selectedStudentId;

  // ── School settings (logo, stamp, signature, footer) ──────────────────────
  const { data: schoolSettings = {} } = useQuery({
    queryKey: ["school_settings"],
    queryFn:  () => apiFetch("/functions/getSchoolSettings", { method: "POST", body: "{}" }),
    staleTime: 5 * 60 * 1000,
  });

  // ── Shared queries ─────────────────────────────────────────────────────────
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn:  () => base44.entities.Class.list(),
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["students_all"],
    queryFn:  () => base44.entities.Student.list(),
    enabled:  !isParent && !isStudent,
  });

  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school_years"],
    queryFn:  () => base44.entities.SchoolYear.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn:  () => base44.entities.Subject.list(),
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn:  () => base44.entities.Period.list(),
  });

  // Active student record
  const studentRecord = useMemo(() => {
    if (isParent)  return myChildren.find(c => c.id === selectedChildId);
    if (isStudent) return myStudent;
    return allStudents.find(s => s.id === selectedStudentId);
  }, [isParent, isStudent, myChildren, selectedChildId, myStudent, allStudents, selectedStudentId]);

  const activeClass = classes.find(c => c.id === studentRecord?.class_id);

  // Active school year
  const activeYear = useMemo(() => {
    const active = schoolYears.find(y => y.status === "active");
    return active || schoolYears[0] || null;
  }, [schoolYears]);

  // Exams for active class
  const { data: classExams = [] } = useQuery({
    queryKey: ["exams_class", activeClass?.id],
    queryFn:  () => base44.entities.Exam.filter({ class_id: activeClass?.id }),
    enabled:  !!activeClass?.id,
  });

  // Grades for active student
  const { data: studentGrades = [] } = useQuery({
    queryKey: ["grades_student", activeStudentId],
    queryFn:  () => base44.entities.Grade.filter({ student_id: activeStudentId }),
    enabled:  !!activeStudentId,
  });

  // Finance invoices
  const { data: invoiceData = null } = useQuery({
    queryKey: ["finv2_student", activeStudentId],
    queryFn:  () => apiFetch(`/finv2/student/${activeStudentId}`),
    enabled:  !!activeStudentId,
  });
  const invoices = invoiceData?.invoices || [];

  // Filtered exams by period
  const filteredExams = useMemo(() => {
    if (periodFilter === "all") return classExams;
    const p = periods.find(p => p.id === periodFilter);
    if (!p) return classExams.filter(e => e.trimester === periodFilter || e.period_id === periodFilter);
    return classExams.filter(e => e.period_id === p.id || e.trimester === p.name);
  }, [classExams, periodFilter, periods]);

  // Search filtered students (admin)
  const filteredStudents = useMemo(() => {
    if (!studentSearch) return allStudents.slice(0, 50);
    const q = studentSearch.toLowerCase();
    return allStudents.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      s.student_code?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allStudents, studentSearch]);

  // ── PDF generators ─────────────────────────────────────────────────────────
  const handleGenerate = async (docId) => {
    if (!studentRecord) return;
    setGenerating(docId);
    try {
      const yearName = activeYear?.name || "";
      const settings = schoolSettings || {};

      if (docId === "attestation") {
        await generateAttestation({
          student:    studentRecord,
          cls:        activeClass,
          schoolYear: yearName,
          settings,
        });
      }

      else if (docId === "fiscale") {
        await generateAttestatFiscale({
          student:    studentRecord,
          cls:        activeClass,
          schoolYear: yearName,
          invoices,
          settings,
        });
      }

      else if (docId === "releve") {
        const activeP = periodFilter !== "all" ? periods.find(p => p.id === periodFilter)?.name || periodFilter : null;
        await generateReleve({
          student:    studentRecord,
          cls:        activeClass,
          exams:      filteredExams,
          grades:     studentGrades,
          subjects,
          schoolYear: yearName,
          period:     activeP,
          settings,
        });
      }

      else if (docId === "factures") {
        setExpandedDoc(prev => prev === "factures" ? null : "factures");
      }

      else if (docId === "bulletin") {
        window.location.href = createPageUrl("Bulletins");
      }
    } finally {
      if (docId !== "factures") setGenerating(null);
      else setGenerating(null);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderDocCard = (dt) => {
    const Icon = dt.icon;
    const isGenerating = generating === dt.id;
    const isExpanded   = expandedDoc === dt.id;

    return (
      <Card key={dt.id} className={`border ${dt.border} shadow-sm overflow-hidden`}>
        <CardContent className="p-0">
          <div className="flex items-start gap-4 p-5">
            <div className={`w-12 h-12 rounded-xl ${dt.bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${dt.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{dt.title}</p>
              <p className="text-sm text-slate-500 mt-0.5">{dt.description}</p>
            </div>
            <Button
              size="sm"
              variant={isExpanded ? "default" : "outline"}
              disabled={isGenerating || !activeStudentId}
              onClick={() => handleGenerate(dt.id)}
              className="shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : dt.isLink ? (
                <><ExternalLink className="w-4 h-4 mr-1" />Ouvrir</>
              ) : dt.hasDetail ? (
                <><ChevronRight className={`w-4 h-4 mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />Voir</>
              ) : (
                <><Download className="w-4 h-4 mr-1" />Télécharger</>
              )}
            </Button>
          </div>

          {/* Expanded factures detail */}
          {dt.id === "factures" && isExpanded && (
            <div className="border-t border-slate-100 px-5 pb-5">
              {invoices.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">Aucune facture trouvée.</p>
              ) : (
                <div className="space-y-2 mt-3">
                  {invoices.map((inv) => {
                    const statusCfg = {
                      paid:     { label: "Réglée",   cls: "bg-green-100 text-green-800" },
                      partial:  { label: "Partiel",  cls: "bg-yellow-100 text-yellow-800" },
                      overdue:  { label: "En retard",cls: "bg-red-100 text-red-800" },
                      unpaid:   { label: "Impayée",  cls: "bg-red-100 text-red-800" },
                    };
                    const sc = statusCfg[inv.status] || statusCfg.unpaid;
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {inv.label || inv.school_year || "Facture"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              {inv.due_date ? fmtDate(inv.due_date) : "—"}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs font-medium text-slate-700">{fmtAmount(inv.net_amount)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-xs ${sc.cls}`}>{sc.label}</Badge>
                          <span className="text-sm font-semibold text-emerald-600">
                            {fmtAmount(inv.paid_amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Download all-in-one */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      generateAttestatFiscale({
                        student:    studentRecord,
                        cls:        activeClass,
                        schoolYear: activeYear?.name || "",
                        invoices,
                        schoolName: "Établissement",
                      });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le récapitulatif PDF
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Mes Documents"
        description="Téléchargez vos documents scolaires en autonomie"
      />

      <div className={`flex gap-6 items-start ${isParent && myChildren.length > 1 ? "" : ""}`}>

        {/* ── Left: child filter (parents only, multiple children) ─────────── */}
        {isParent && myChildren.length > 1 && (
          <div className="w-44 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Enfants</p>
              </div>
              <div className="divide-y divide-slate-100">
                {myChildren.map(child => {
                  const active = child.id === selectedChildId;
                  const cls    = classes.find(c => c.id === child.class_id);
                  return (
                    <button
                      key={child.id}
                      onClick={() => { setSelectedChildId(child.id); setExpandedDoc(null); }}
                      className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors
                        ${active ? "bg-indigo-50 border-l-4 border-indigo-500" : "hover:bg-slate-50 border-l-4 border-transparent"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0
                        ${active ? "bg-indigo-500" : "bg-slate-400"}`}>
                        {child.first_name?.[0]}{child.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? "text-indigo-700" : "text-slate-700"}`}>
                          {child.first_name} {child.last_name}
                        </p>
                        {cls && <p className="text-xs text-slate-400 truncate">{cls.name}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Admin: student search */}
          {!isParent && !isStudent && (
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher un élève..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={selectedStudentId || ""} onValueChange={v => { setSelectedStudentId(v); setExpandedDoc(null); }}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Sélectionner un élève" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} — {classes.find(c => c.id === s.class_id)?.name || "?"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active student info banner */}
          {studentRecord && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                {studentRecord.first_name?.[0]}{studentRecord.last_name?.[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{studentRecord.first_name} {studentRecord.last_name}</p>
                <p className="text-sm text-slate-500">
                  {activeClass?.name || "Classe inconnue"}
                  {activeYear && ` · ${activeYear.name}`}
                </p>
              </div>
            </div>
          )}

          {/* No student selected */}
          {!activeStudentId && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {isParent ? "Aucun enfant associé à votre compte." : "Sélectionnez un élève pour accéder aux documents."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Period filter for Relevé de notes */}
          {activeStudentId && periods.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Période :</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setPeriodFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                    ${periodFilter === "all" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Toute l'année
                </button>
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodFilter(p.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                      ${periodFilter === p.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Document cards */}
          {activeStudentId && (
            <div className="space-y-3">
              {DOC_TYPES.map(renderDocCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
