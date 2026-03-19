import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Save,
  Loader2,
  Lock,
  LockOpen,
  History,
  Upload,
  AlertTriangle,
  CheckCircle,
  UserX,
  MinusCircle,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Grading scale definitions (RG-NOTE-01) ──────────────────────────────────
const GRADING_SCALES = {
  "/20": {
    type: "numeric",
    min: 0,
    max: 20,
    step: 0.25,
    label: "/20",
    validate: (v) => v >= 0 && v <= 20,
  },
  "/100": {
    type: "numeric",
    min: 0,
    max: 100,
    step: 0.5,
    label: "/100",
    validate: (v) => v >= 0 && v <= 100,
  },
  letters: {
    type: "select",
    label: "Lettres A–F",
    options: [
      { value: 20, label: "A — Excellent" },
      { value: 16, label: "B — Bien" },
      { value: 12, label: "C — Assez bien" },
      { value: 8, label: "D — Passable" },
      { value: 4, label: "E — Insuffisant" },
      { value: 0, label: "F — Très insuffisant" },
    ],
    scoreToLabel: (score) => {
      if (score >= 18) return "A";
      if (score >= 14) return "B";
      if (score >= 10) return "C";
      if (score >= 6) return "D";
      if (score >= 2) return "E";
      return "F";
    },
  },
  competencies: {
    type: "select",
    label: "Compétences",
    options: [
      { value: 3, label: "Acquis" },
      { value: 2, label: "En cours d'acquisition" },
      { value: 1, label: "Non acquis" },
    ],
    scoreToLabel: (score) => {
      if (score >= 3) return "Acquis";
      if (score >= 2) return "En cours";
      return "Non acquis";
    },
  },
};

// ─── Status definitions (RG-NOTE-03) ─────────────────────────────────────────
const GRADE_STATUSES = [
  { value: "present", label: "Note", icon: null },
  { value: "absent", label: "Absent", icon: UserX },
  { value: "dispense", label: "Dispensé", icon: MinusCircle },
];

// ─── Roles allowed to create/edit grades ─────────────────────────────────────
const ADMIN_ROLES = [
  "admin_systeme",
  "directeur_general",
  "directeur_primaire",
  "directeur_college",
  "directeur_lycee",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split(",");
      return {
        code: parts[0]?.trim() ?? "",
        score: parts[1]?.trim() ?? "",
        comment: parts[2]?.trim() ?? "",
      };
    })
    .filter((r) => r.code);
}

// ─── History Dialog component ─────────────────────────────────────────────────
function HistoryDialog({ open, onClose, history, studentName, scale }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Historique — {studentName}
          </DialogTitle>
        </DialogHeader>
        {history.length === 0 ? (
          <p className="text-slate-500 py-4 text-center">Aucune modification enregistrée</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="border rounded-lg p-3 bg-slate-50 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700">{h.changer_name || "—"}</span>
                  <span className="text-slate-400 text-xs">
                    {h.changed_at
                      ? format(new Date(h.changed_at), "d MMM yyyy HH:mm", { locale: fr })
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="line-through text-red-500">
                    {h.old_status === "absent"
                      ? "Absent"
                      : h.old_status === "dispense"
                      ? "Dispensé"
                      : h.old_score !== null
                      ? `${h.old_score} ${scale?.label ?? ""}`
                      : "—"}
                  </span>
                  <span>→</span>
                  <span className="text-green-600 font-medium">
                    {h.new_status === "absent"
                      ? "Absent"
                      : h.new_status === "dispense"
                      ? "Dispensé"
                      : h.new_score !== null
                      ? `${h.new_score} ${scale?.label ?? ""}`
                      : "—"}
                  </span>
                </div>
                <p className="mt-1 text-indigo-700 italic">"{h.reason}"</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV Import Dialog (RG-NOTE-07) ──────────────────────────────────────────
function CSVImportDialog({ open, onClose, onApply, students, scale }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState([]);
  const [parsed, setParsed] = useState(false);
  const fileRef = useRef(null);

  const studentCodeMap = Object.fromEntries(
    students.map((s) => [s.student_code, s])
  );

  const handleParse = () => {
    const rows = parseCSV(csvText);
    const result = rows.map((r) => {
      const student = studentCodeMap[r.code];
      const score = parseFloat(r.score);
      const valid =
        student &&
        !isNaN(score) &&
        (scale.type !== "numeric" ||
          (score >= scale.min && score <= scale.max));
      return { ...r, student, score: isNaN(score) ? null : score, valid };
    });
    setPreview(result);
    setParsed(true);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const validCount = preview.filter((r) => r.valid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCsvText("");
          setPreview([]);
          setParsed(false);
        }
        onClose(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Import CSV des notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Format attendu :</p>
            <code className="block bg-white border rounded px-2 py-1 text-xs font-mono">
              code_élève,note,commentaire(optionnel)
            </code>
            <p className="mt-1 text-blue-600">
              Barème : {scale.label}{scale.type === "numeric" ? ` (${scale.min}–${scale.max})` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Charger un fichier
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <Textarea
            placeholder={"EL-2024-0001,15,Bon travail\nEL-2024-0002,12\nEL-2024-0003,18,Excellent"}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setParsed(false);
            }}
            rows={6}
            className="font-mono text-sm"
          />

          <Button onClick={handleParse} disabled={!csvText.trim()} className="w-full" variant="outline">
            Analyser le fichier
          </Button>

          {parsed && preview.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3">Code</th>
                    <th className="text-left py-2 px-3">Élève</th>
                    <th className="text-center py-2 px-3">Note</th>
                    <th className="text-left py-2 px-3">Commentaire</th>
                    <th className="text-center py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className={r.valid ? "bg-green-50" : "bg-red-50"}>
                      <td className="py-1.5 px-3 font-mono text-xs">{r.code}</td>
                      <td className="py-1.5 px-3">
                        {r.student
                          ? `${r.student.first_name} ${r.student.last_name}`
                          : <span className="text-red-500">Élève introuvable</span>}
                      </td>
                      <td className="py-1.5 px-3 text-center font-medium">
                        {r.score !== null ? r.score : "—"}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 text-xs">{r.comment || "—"}</td>
                      <td className="py-1.5 px-3 text-center">
                        {r.valid ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parsed && (
            <p className="text-sm text-slate-600">
              {validCount}/{preview.length} lignes valides
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => onApply(preview)}
            disabled={!parsed || validCount === 0}
          >
            Importer {validCount > 0 ? `(${validCount} notes)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Grades page ─────────────────────────────────────────────────────────
export default function Grades() {
  const urlParams = new URLSearchParams(window.location.search);
  const examId = urlParams.get("exam_id");
  const session = getSession();

  const [grades, setGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dialogs
  const [historyDialog, setHistoryDialog] = useState({ open: false, studentId: null });
  const [csvDialog, setCsvDialog] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  const queryClient = useQueryClient();

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const exams = await base44.entities.Exam.filter({ id: examId });
      return exams[0] ?? null;
    },
    enabled: !!examId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", exam?.class_id],
    queryFn: () => base44.entities.Student.filter({ class_id: exam.class_id, status: "active" }),
    enabled: !!exam?.class_id,
  });

  const { data: existingGrades = [] } = useQuery({
    queryKey: ["grades", examId],
    queryFn: () => base44.entities.Grade.filter({ exam_id: examId }),
    enabled: !!examId,
  });

  const { data: gradeHistories = [] } = useQuery({
    queryKey: ["gradeHistories", examId],
    queryFn: () => base44.entities.GradeHistory.filter({ exam_id: examId }),
    enabled: !!examId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

  // ── Access control ─────────────────────────────────────────────────────────
  const isAdmin = ADMIN_ROLES.includes(session?.role);
  const isTeacher = session?.role === "enseignant";
  // RG-NOTE-05: only the subject teacher (or admins) can edit
  const isExamTeacher = isTeacher && session?.member_id === exam?.teacher_id;
  const canEdit = !exam?.locked && (isAdmin || isExamTeacher);
  const canLock = isAdmin; // Only admins/directors can lock (RG-NOTE-06)

  // ── Grading scale ──────────────────────────────────────────────────────────
  const scaleKey = exam?.grading_scale || "/20";
  const scale = GRADING_SCALES[scaleKey] ?? GRADING_SCALES["/20"];

  // ── Initialise local state from DB ─────────────────────────────────────────
  useEffect(() => {
    if (!existingGrades.length) return;
    const map = {};
    existingGrades.forEach((g) => {
      map[g.student_id] = {
        id: g.id,
        score: g.score ?? "",
        comment: g.comment ?? "",
        status: g.grade_status ?? (g.absent ? "absent" : "present"),
        // modification tracking
        isModified: false,
        reason: "",
        originalScore: g.score ?? "",
        originalStatus: g.grade_status ?? (g.absent ? "absent" : "present"),
      };
    });
    setGrades(map);
  }, [existingGrades]);

  // ── Grade change handler ────────────────────────────────────────────────────
  const handleChange = (studentId, field, value) => {
    if (!canEdit) return;
    setGrades((prev) => {
      const current = prev[studentId] ?? { score: "", comment: "", status: "present", isModified: false, reason: "", originalScore: "", originalStatus: "present" };
      const hasExisting = !!current.id;
      const hadData =
        current.originalScore !== "" ||
        current.originalStatus !== "present";

      const updated = { ...current, [field]: value };

      // Mark as modified if changing an existing grade that had data (RG-NOTE-04)
      if (hasExisting && hadData) {
        updated.isModified = true;
      }

      return { ...prev, [studentId]: updated };
    });
  };

  // ── Validation (RG-NOTE-02) ────────────────────────────────────────────────
  const validateScore = (score, status) => {
    if (status !== "present") return true;
    if (score === "" || score === null || score === undefined) return true;
    const num = parseFloat(score);
    if (isNaN(num)) return false;
    if (scale.type === "numeric") {
      return num >= scale.min && num <= scale.max;
    }
    return true;
  };

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError("");
    setSaveSuccess(false);

    // RG-NOTE-04: require reason for all modified grades
    const missingReason = Object.entries(grades).filter(
      ([, g]) => g.isModified && !g.reason?.trim()
    );
    if (missingReason.length > 0) {
      setSaveError(
        `Veuillez renseigner la raison de modification pour ${missingReason.length} note(s) modifiée(s).`
      );
      return;
    }

    // RG-NOTE-02: validate all scores
    const invalidScores = students.filter((s) => {
      const g = grades[s.id];
      if (!g) return false;
      return !validateScore(g.score, g.status);
    });
    if (invalidScores.length > 0) {
      setSaveError(
        `Note(s) hors barème (${scale.label}). Corrigez avant d'enregistrer.`
      );
      return;
    }

    setSaving(true);
    try {
      for (const student of students) {
        const gradeData = grades[student.id];
        if (!gradeData) continue;

        const isAbsent = gradeData.status === "absent";
        const isDispense = gradeData.status === "dispense";

        let scoreToSave = null;
        if (!isAbsent && !isDispense && gradeData.score !== "" && gradeData.score !== null) {
          scoreToSave = parseFloat(gradeData.score);
          if (isNaN(scoreToSave)) scoreToSave = null;
        }

        const data = {
          student_id: student.id,
          exam_id: examId,
          score: scoreToSave,
          comment: gradeData.comment ?? "",
          absent: isAbsent,
          grade_status: gradeData.status ?? "present",
        };

        const existing = existingGrades.find((g) => g.student_id === student.id);

        // Skip rows with no data entered
        const hasData = scoreToSave !== null || isAbsent || isDispense;

        if (existing) {
          await base44.entities.Grade.update(existing.id, data);

          // RG-NOTE-04: audit trail for modifications
          if (gradeData.isModified && gradeData.reason?.trim()) {
            await base44.entities.GradeHistory.create({
              grade_id: existing.id,
              student_id: student.id,
              exam_id: examId,
              old_score: gradeData.originalScore !== "" ? parseFloat(gradeData.originalScore) : null,
              new_score: scoreToSave,
              old_status: gradeData.originalStatus ?? "present",
              new_status: gradeData.status ?? "present",
              reason: gradeData.reason.trim(),
              changed_by: session?.id ?? null,
              changer_name: session?.full_name ?? null,
            });
          }
        } else if (hasData) {
          await base44.entities.Grade.create(data);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["grades", examId] });
      await queryClient.invalidateQueries({ queryKey: ["gradeHistories", examId] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError("Erreur lors de la sauvegarde : " + err.message);
    }
    setSaving(false);
  };

  // ── Lock/Unlock exam (RG-NOTE-06) ──────────────────────────────────────────
  const handleToggleLock = async () => {
    if (!exam) return;
    await base44.entities.Exam.update(exam.id, { locked: !exam.locked });
    queryClient.invalidateQueries({ queryKey: ["exam", examId] });
    setLockConfirmOpen(false);
  };

  // ── CSV import apply (RG-NOTE-07) ──────────────────────────────────────────
  const handleCSVApply = (preview) => {
    const validRows = preview.filter((r) => r.valid && r.student);
    setGrades((prev) => {
      const next = { ...prev };
      for (const row of validRows) {
        const sid = row.student.id;
        const current = next[sid] ?? { score: "", comment: "", status: "present", isModified: false, reason: "", originalScore: "", originalStatus: "present" };
        const hasExisting = !!current.id;
        const hadData = current.originalScore !== "" || current.originalStatus !== "present";
        next[sid] = {
          ...current,
          score: row.score,
          comment: row.comment || current.comment,
          status: "present",
          isModified: hasExisting && hadData,
        };
      }
      return next;
    });
    setCsvDialog(false);
  };

  // ── Statistics ─────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const all = students.map((s) => grades[s.id]);
    const scored = all.filter((g) => g && g.status === "present" && g.score !== "" && g.score !== null);
    const scores = scored.map((g) => parseFloat(g.score)).filter((n) => !isNaN(n));
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const absentCount = all.filter((g) => g?.status === "absent").length;
    const dispenseCount = all.filter((g) => g?.status === "dispense").length;
    const max = scores.length > 0 ? Math.max(...scores) : null;
    const min = scores.length > 0 ? Math.min(...scores) : null;
    return { avg, absentCount, dispenseCount, filled: scores.length, max, min };
  }, [students, grades]);

  // ── History per student ────────────────────────────────────────────────────
  const studentHistoryMap = React.useMemo(() => {
    const map = {};
    gradeHistories.forEach((h) => {
      if (!map[h.student_id]) map[h.student_id] = [];
      map[h.student_id].push(h);
    });
    return map;
  }, [gradeHistories]);

  const sortedStudents = [...students].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  );

  if (!examId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Aucun examen sélectionné</p>
        <Link to={createPageUrl("Exams")}>
          <Button className="mt-4">Voir les examens</Button>
        </Link>
      </div>
    );
  }

  const subject = exam ? subjectMap[exam.subject_id] : null;
  const klass = exam ? classMap[exam.class_id] : null;

  const historyStudent = historyDialog.studentId
    ? students.find((s) => s.id === historyDialog.studentId)
    : null;

  return (
    <TooltipProvider>
      <div>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Link to={createPageUrl("Exams")}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{exam?.title || "Chargement..."}</h1>
              {exam?.locked && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                  <Lock className="w-3 h-3" />
                  Verrouillé
                </Badge>
              )}
            </div>
            {exam && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {subject && (
                  <Badge variant="outline" style={{ borderColor: subject.color, color: subject.color }}>
                    {subject.name}
                  </Badge>
                )}
                {klass && <Badge variant="outline">{klass.name}</Badge>}
                <Badge variant="outline" className="font-mono">
                  Barème : {scale.label}
                </Badge>
                {exam.coefficient && (
                  <span className="text-slate-500 text-sm">Coef. {exam.coefficient}</span>
                )}
                {exam.date && (
                  <span className="text-slate-500 text-sm">
                    {format(new Date(exam.date), "d MMM yyyy", { locale: fr })}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* RG-NOTE-07: CSV import */}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setCsvDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            )}

            {/* RG-NOTE-06: Lock/Unlock */}
            {canLock && exam && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLockConfirmOpen(true)}
                className={exam.locked ? "text-green-700 border-green-300" : "text-amber-700 border-amber-300"}
              >
                {exam.locked ? (
                  <><LockOpen className="w-4 h-4 mr-2" />Déverrouiller</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" />Verrouiller</>
                )}
              </Button>
            )}

            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Enregistrer
              </Button>
            )}
          </div>
        </div>

        {/* ── Access banners ───────────────────────────────────────────────── */}
        {exam?.locked && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-sm">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Notes verrouillées après validation du conseil de classe. Seul un administrateur peut déverrouiller.
            </span>
          </div>
        )}
        {!exam?.locked && isTeacher && !isExamTeacher && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2 text-blue-800 text-sm">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              Consultation uniquement — seul l'enseignant responsable de cet examen peut saisir des notes.
            </span>
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Moyenne</p>
              <p className="text-xl font-bold">
                {stats.filled > 0
                  ? scale.type === "numeric"
                    ? stats.avg.toFixed(2)
                    : scale.scoreToLabel?.(stats.avg) ?? stats.avg.toFixed(1)
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Saisies</p>
              <p className="text-xl font-bold">
                {stats.filled}/{students.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Absents</p>
              <p className="text-xl font-bold text-orange-600">{stats.absentCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Dispensés</p>
              <p className="text-xl font-bold text-slate-500">{stats.dispenseCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Max / Min</p>
              <p className="text-xl font-bold">
                {stats.max !== null ? `${stats.max} / ${stats.min}` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Alerts ───────────────────────────────────────────────────────── */}
        {saveError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Notes enregistrées avec succès.
          </div>
        )}

        {/* ── Grade table ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Saisie des notes</span>
              <span className="text-sm font-normal text-slate-500">
                {sortedStudents.length} élève{sortedStudents.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
                    <th className="text-left py-3 px-4">#</th>
                    <th className="text-left py-3 px-4">Élève</th>
                    <th className="text-center py-3 px-4 w-40">
                      Note ({scale.label})
                    </th>
                    <th className="text-center py-3 px-4 w-36">Statut</th>
                    <th className="text-left py-3 px-4">Commentaire</th>
                    {canEdit && <th className="text-center py-3 px-4 w-48">Raison modif.</th>}
                    <th className="text-center py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, idx) => {
                    const gradeData = grades[student.id] ?? {
                      score: "",
                      comment: "",
                      status: "present",
                      isModified: false,
                      reason: "",
                    };
                    const isAbsentOrDispense =
                      gradeData.status === "absent" || gradeData.status === "dispense";
                    const hasHistory = (studentHistoryMap[student.id]?.length ?? 0) > 0;

                    // Score validation feedback
                    const scoreNum = parseFloat(gradeData.score);
                    const scoreInvalid =
                      !isAbsentOrDispense &&
                      gradeData.score !== "" &&
                      gradeData.score !== null &&
                      !isNaN(scoreNum) &&
                      scale.type === "numeric" &&
                      (scoreNum < scale.min || scoreNum > scale.max);

                    const rowModified = gradeData.isModified;

                    return (
                      <tr
                        key={student.id}
                        className={`border-b transition-colors ${
                          rowModified
                            ? "bg-yellow-50 hover:bg-yellow-100"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {/* # */}
                        <td className="py-3 px-4 text-slate-400 text-sm">{idx + 1}</td>

                        {/* Student */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {student.first_name?.[0]}
                              {student.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm leading-tight">
                                {student.last_name} {student.first_name}
                              </p>
                              <p className="text-xs text-slate-400">{student.student_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Score — RG-NOTE-01 & RG-NOTE-02 */}
                        <td className="py-3 px-4 text-center">
                          {isAbsentOrDispense ? (
                            <span className="text-slate-400 text-sm">—</span>
                          ) : scale.type === "numeric" ? (
                            <div className="relative">
                              <Input
                                type="number"
                                min={scale.min}
                                max={scale.max}
                                step={scale.step}
                                value={gradeData.score ?? ""}
                                onChange={(e) => handleChange(student.id, "score", e.target.value)}
                                disabled={!canEdit}
                                className={`w-24 mx-auto text-center ${
                                  scoreInvalid ? "border-red-400 focus-visible:ring-red-400" : ""
                                }`}
                                placeholder="—"
                              />
                              {scoreInvalid && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 absolute -right-1 -top-1" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Valeur hors barème ({scale.min}–{scale.max})
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <Select
                              value={gradeData.score !== "" && gradeData.score !== null ? String(gradeData.score) : ""}
                              onValueChange={(v) => handleChange(student.id, "score", v)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="w-40 mx-auto">
                                <SelectValue placeholder="Choisir" />
                              </SelectTrigger>
                              <SelectContent>
                                {scale.options.map((opt) => (
                                  <SelectItem key={opt.value} value={String(opt.value)}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>

                        {/* Status — RG-NOTE-03 */}
                        <td className="py-3 px-4 text-center">
                          <Select
                            value={gradeData.status ?? "present"}
                            onValueChange={(v) => handleChange(student.id, "status", v)}
                            disabled={!canEdit}
                          >
                            <SelectTrigger className="w-32 mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADE_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Comment */}
                        <td className="py-3 px-4">
                          <Input
                            value={gradeData.comment ?? ""}
                            onChange={(e) => handleChange(student.id, "comment", e.target.value)}
                            placeholder="Commentaire…"
                            disabled={!canEdit}
                            className="text-sm"
                          />
                        </td>

                        {/* Modification reason — RG-NOTE-04 */}
                        {canEdit && (
                          <td className="py-3 px-4">
                            {rowModified ? (
                              <div className="relative">
                                <Input
                                  value={gradeData.reason ?? ""}
                                  onChange={(e) =>
                                    setGrades((prev) => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], reason: e.target.value },
                                    }))
                                  }
                                  placeholder="Raison obligatoire *"
                                  className={`text-sm ${
                                    !gradeData.reason?.trim()
                                      ? "border-yellow-400 focus-visible:ring-yellow-400"
                                      : "border-green-400"
                                  }`}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        )}

                        {/* History button */}
                        <td className="py-3 px-4 text-center">
                          {hasHistory && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 text-indigo-500"
                                  onClick={() =>
                                    setHistoryDialog({ open: true, studentId: student.id })
                                  }
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir l'historique des modifications</TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedStudents.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p>Aucun élève actif dans cette classe</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Bottom save bar ───────────────────────────────────────────────── */}
        {canEdit && sortedStudents.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer toutes les notes
            </Button>
          </div>
        )}

        {/* ── Lock confirmation dialog ──────────────────────────────────────── */}
        <Dialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {exam?.locked ? (
                  <><LockOpen className="w-5 h-5 text-green-600" />Déverrouiller les notes ?</>
                ) : (
                  <><Lock className="w-5 h-5 text-amber-600" />Verrouiller les notes ?</>
                )}
              </DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 text-sm">
              {exam?.locked
                ? "Les notes pourront à nouveau être modifiées par l'enseignant responsable."
                : "Plus aucune modification ne sera possible sans déverrouillage administrateur. Cette action correspond à la validation par le conseil de classe."}
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setLockConfirmOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleToggleLock}
                className={exam?.locked ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}
              >
                {exam?.locked ? "Déverrouiller" : "Verrouiller"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── History dialog ────────────────────────────────────────────────── */}
        <HistoryDialog
          open={historyDialog.open}
          onClose={() => setHistoryDialog({ open: false, studentId: null })}
          history={studentHistoryMap[historyDialog.studentId] ?? []}
          studentName={
            historyStudent
              ? `${historyStudent.last_name} ${historyStudent.first_name}`
              : ""
          }
          scale={scale}
        />

        {/* ── CSV Import dialog (RG-NOTE-07) ────────────────────────────────── */}
        <CSVImportDialog
          open={csvDialog}
          onClose={(v) => setCsvDialog(v)}
          onApply={handleCSVApply}
          students={students}
          scale={scale}
        />
      </div>
    </TooltipProvider>
  );
}
