import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { MoreHorizontal, Pencil, Trash2, FileSpreadsheet, Loader2, Lock, LockOpen, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useTeacherProfile } from "@/components/teachers/useTeacherProfile";
import { getSession } from "@/components/auth/appAuth";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { createPageUrl } from "@/utils";

const GRADING_SCALES = {
  "/20": "/20 (numérique)",
  "/100": "/100 (numérique)",
  letters: "Lettres A–F",
  competencies: "Compétences",
};

const EXAM_TYPES = {
  controle: "Contrôle",
  devoir: "Devoir",
  examen_final: "Examen final",
  oral: "Oral",
  tp: "TP",
};

/**
 * Dérive le trimestre legacy (T1/T2/T3) à partir de l'ordre d'une Period.
 * Utile pour conserver la compatibilité avec gradeUtils.
 */
function periodOrderToTrimester(order) {
  if (order === 1) return "T1";
  if (order === 2) return "T2";
  return "T3";
}

export default function Exams() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    class_id: "",
    teacher_id: "",
    date: "",
    type: "controle",
    max_score: 20,
    coefficient: 1,
    period_id: "",
    trimester: "",
    description: "",
    grading_scale: "/20",
  });

  const queryClient = useQueryClient();
  const { mySubjectIds, isTeacherRole } = useTeacherProfile();
  const { myTeacherId, isTeacher } = useCurrentMember();
  const session = getSession();
  const isAdmin = ["admin_systeme", "directeur_general", "directeur_primaire", "directeur_college", "directeur_lycee"].includes(session?.role);

  const { data: examsAll = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list("-date"),
  });

  const exams = isTeacherRole && mySubjectIds.length > 0
    ? examsAll.filter(e => mySubjectIds.includes(e.subject_id))
    : examsAll;

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  // Schedules de l'enseignant (pour filtrer les classes)
  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["schedules_teacher", myTeacherId],
    queryFn: () => base44.entities.Schedule.filter({ teacher_id: myTeacherId }),
    enabled: isTeacher && !!myTeacherId,
  });

  // Classes visibles : pour un enseignant, uniquement celles dans son emploi du temps
  const visibleClasses = useMemo(() => {
    if (!isTeacher || teacherSchedules.length === 0) return classes;
    const classIds = new Set(teacherSchedules.map(s => s.class_id));
    return classes.filter(c => classIds.has(c.id));
  }, [classes, isTeacherRole, teacherSchedules]);

  // Année scolaire active + ses périodes
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list(),
  });
  const activeYear = schoolYears.find(y => y.status === "active");

  const { data: periodsAll = [] } = useQuery({
    queryKey: ["periods", activeYear?.id],
    queryFn: () => base44.entities.Period.filter({ school_year_id: activeYear.id }),
    enabled: !!activeYear?.id,
  });
  const periods = [...periodsAll].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Tabs: dynamic if periods exist, legacy T1/T2/T3 otherwise
  const usePeriods = periods.length > 0;
  const legacyTrimesters = ["T1", "T2", "T3"];

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const periodMap = Object.fromEntries(periods.map((p) => [p.id, p]));

  // Filtrer les matières disponibles pour l'enseignant connecté
  const availableSubjects = isTeacherRole
    ? subjects.filter(s => mySubjectIds.includes(s.id))
    : subjects;

  const handleNew = () => {
    setSelectedExam(null);
    const defaultPeriod = periods[0] || null;
    setFormData({
      title: "",
      subject_id: "",
      class_id: "",
      teacher_id: "",
      date: new Date().toISOString().split("T")[0],
      type: "controle",
      max_score: 20,
      coefficient: 1,
      period_id: defaultPeriod?.id || "",
      trimester: defaultPeriod ? periodOrderToTrimester(defaultPeriod.order ?? 1) : "",
      description: "",
      grading_scale: "/20",
    });
    setFormOpen(true);
  };

  const handleEdit = (exam) => {
    setSelectedExam(exam);
    setFormData({
      title: exam.title || "",
      subject_id: exam.subject_id || "",
      class_id: exam.class_id || "",
      teacher_id: exam.teacher_id || "",
      date: exam.date || "",
      type: exam.type || "controle",
      max_score: exam.max_score || 20,
      coefficient: exam.coefficient || 1,
      period_id: exam.period_id || "",
      trimester: exam.trimester || "",
      description: exam.description || "",
      grading_scale: exam.grading_scale || "/20",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...formData,
      max_score: Number(formData.max_score),
      coefficient: Number(formData.coefficient),
    };

    if (selectedExam) {
      await base44.entities.Exam.update(selectedExam.id, data);
    } else {
      await base44.entities.Exam.create(data);
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["exams"] });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (examToDelete) {
      await base44.entities.Exam.delete(examToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  const handleToggleLock = async (exam) => {
    await base44.entities.Exam.update(exam.id, { locked: !exam.locked });
    queryClient.invalidateQueries({ queryKey: ["exams"] });
  };

  const handleMigrateExams = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await base44.functions.invoke("migrateExamsToPeriods", {});
      setMigrateResult(result);
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["periods"] });
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    } catch (err) {
      setMigrateResult({ error: err.message || "Erreur lors de la migration" });
    } finally {
      setMigrating(false);
    }
  };

  const typeColors = {
    controle: "bg-blue-100 text-blue-800",
    devoir: "bg-green-100 text-green-800",
    examen_final: "bg-purple-100 text-purple-800",
    oral: "bg-orange-100 text-orange-800",
    tp: "bg-cyan-100 text-cyan-800",
  };

  const columns = [
    {
      header: "Examen",
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{row.title}</p>
            {row.locked && (
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={typeColors[row.type]}>{EXAM_TYPES[row.type]}</Badge>
            {row.period_id && periodMap[row.period_id] && (
              <Badge variant="outline" className="border-indigo-300 text-indigo-600">
                {periodMap[row.period_id].name}
              </Badge>
            )}
            {!row.period_id && row.trimester && (
              <Badge variant="outline">{row.trimester}</Badge>
            )}
            {row.grading_scale && row.grading_scale !== "/20" && (
              <Badge variant="outline" className="border-slate-300 text-slate-500 text-[10px]">
                {row.grading_scale === "letters" ? "A–F" : row.grading_scale === "competencies" ? "Compétences" : row.grading_scale}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Matière",
      cell: (row) => {
        const subject = subjectMap[row.subject_id];
        return (
          <Badge
            variant="outline"
            style={{
              borderColor: subject?.color,
              color: subject?.color,
            }}
          >
            {subject?.name || "-"}
          </Badge>
        );
      },
    },
    {
      header: "Classe",
      cell: (row) => <span>{classMap[row.class_id]?.name || "-"}</span>,
    },
    {
      header: "Date",
      cell: (row) => (
        <span>
          {row.date ? format(new Date(row.date), "d MMM yyyy", { locale: fr }) : "-"}
        </span>
      ),
    },
    {
      header: "Barème",
      cell: (row) => (
        <span>
          /{row.max_score || 20} (coef. {row.coefficient || 1})
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={createPageUrl(`Grades?exam_id=${row.id}`)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Saisir les notes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(row)} disabled={row.locked && !isAdmin}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem
                onClick={() => handleToggleLock(row)}
                className={row.locked ? "text-green-700" : "text-amber-700"}
              >
                {row.locked ? (
                  <><LockOpen className="w-4 h-4 mr-2" />Déverrouiller</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" />Verrouiller</>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                setExamToDelete(row);
                setDeleteDialogOpen(true);
              }}
              disabled={row.locked && !isAdmin}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Examens & Notes"
        description={`${exams.length} examens planifiés`}
        action={handleNew}
        actionLabel="Nouvel examen"
      />

      {/* Bandeau de migration — visible uniquement pour les admins et quand il existe des examens legacy */}
      {isAdmin && !usePeriods && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">Migration disponible :</span> Liez vos examens existants (T1/T2/T3) à des périodes officielles pour activer le suivi par période.
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={handleMigrateExams}
            disabled={migrating}
          >
            {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {migrating ? "Migration..." : "Lancer la migration"}
          </Button>
        </div>
      )}

      {/* Résultat de la migration */}
      {migrateResult && (
        <div className={`mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${migrateResult.error ? "bg-red-50 border border-red-200 text-red-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
          {migrateResult.error ? (
            <span>❌ {migrateResult.error}</span>
          ) : (
            <span>
              ✅ Migration réussie — Année : <strong>{migrateResult.schoolYear}</strong> —{" "}
              {migrateResult.periodsCreated?.length > 0
                ? `${migrateResult.periodsCreated.length} période(s) créée(s) (${migrateResult.periodsCreated.join(", ")})`
                : "Périodes déjà existantes"} —{" "}
              <strong>{migrateResult.examsUpdated}</strong> examen(s) mis à jour.
            </span>
          )}
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setMigrateResult(null)}>✕</button>
        </div>
      )}

      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          {usePeriods
            ? periods.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "closed" && <span className="ml-1 text-[10px] opacity-50">✓</span>}
                </TabsTrigger>
              ))
            : legacyTrimesters.map((t) => (
                <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
              ))}
        </TabsList>

        <TabsContent value="all">
          <DataTable columns={columns} data={exams} isLoading={isLoading} />
        </TabsContent>
        {usePeriods
          ? periods.map((p) => (
              <TabsContent key={p.id} value={p.id}>
                <DataTable
                  columns={columns}
                  data={exams.filter((e) => e.period_id === p.id)}
                  isLoading={isLoading}
                />
              </TabsContent>
            ))
          : legacyTrimesters.map((t) => (
              <TabsContent key={t} value={t}>
                <DataTable
                  columns={columns}
                  data={exams.filter((e) => e.trimester === t)}
                  isLoading={isLoading}
                />
              </TabsContent>
            ))}
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedExam ? "Modifier l'examen" : "Nouvel examen"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Contrôle de mathématiques"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matière *</Label>
                <Select
                  value={formData.subject_id}
                  onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classe *</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Période</Label>
                {usePeriods ? (
                  <Select
                    value={formData.period_id}
                    onValueChange={(value) => {
                      const p = periods.find(x => x.id === value);
                      setFormData({
                        ...formData,
                        period_id: value,
                        trimester: p ? periodOrderToTrimester(p.order ?? 1) : "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une période" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={formData.trimester}
                    onValueChange={(value) => setFormData({ ...formData, trimester: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Trimestre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T1">Trimestre 1</SelectItem>
                      <SelectItem value="T2">Trimestre 2</SelectItem>
                      <SelectItem value="T3">Trimestre 3</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Échelle de notation</Label>
                <Select
                  value={formData.grading_scale}
                  onValueChange={(v) => {
                    const autoMax = v === "/100" ? 100 : v === "letters" ? 20 : v === "competencies" ? 3 : 20;
                    setFormData({ ...formData, grading_scale: v, max_score: autoMax });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRADING_SCALES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Barème (note max)</Label>
                <Input
                  type="number"
                  value={formData.max_score}
                  onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient</Label>
                <Input
                  type="number"
                  value={formData.coefficient}
                  onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedExam ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet examen et toutes ses notes ?
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