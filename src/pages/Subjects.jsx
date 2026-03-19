import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import SubjectForm from "@/components/forms/SubjectForm";
import {
  BookOpen, Plus, Pencil, Trash2, Search, Users, Clock,
  BarChart2, GraduationCap, Layers, Archive, AlertTriangle,
  FlaskConical, EyeOff,
} from "lucide-react";

// ── Catégories ───────────────────────────────────────────────────────────────
export const SUBJECT_CATEGORIES = [
  { value: "general",     label: "Général",          icon: "📚", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "science",     label: "Sciences",          icon: "🔬", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "literature",  label: "Littérature/Langues", icon: "📖", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "math",        label: "Mathématiques",     icon: "📐", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "arts",        label: "Arts",              icon: "🎨", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "sport",       label: "Sport / EPS",       icon: "⚽", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "technology",  label: "Technologie",       icon: "💻", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "social",      label: "Sciences Sociales", icon: "🌍", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "optional",    label: "Optionnel",         icon: "✨", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export function getCategoryConfig(val) {
  return SUBJECT_CATEGORIES.find((c) => c.value === val) || SUBJECT_CATEGORIES[0];
}

// ── Niveaux scolaires disponibles ────────────────────────────────────────────
const LEVELS = [
  "CP","CE1","CE2","CM1","CM2",
  "6ème","5ème","4ème","3ème",
  "2nde","1ère","Terminale",
  "Tous niveaux",
];

// ── Carte matière ─────────────────────────────────────────────────────────────
function SubjectCard({ subject, teacherCount, examCount, onEdit, onDelete }) {
  const cat = getCategoryConfig(subject.category);
  const color = subject.color || "#3B82F6";
  const isInactive = subject.status === "inactive";

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow group ${isInactive ? "opacity-60" : ""}`}>
      {/* Bande couleur */}
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icône catégorie */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${color}22` }}
            >
              {cat.icon}
            </div>
            <div className="flex-1 min-w-0">
              {/* Ligne 1 : code + catégorie */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {subject.code && (
                  <span
                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {subject.code}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
                  {cat.label}
                </span>
              </div>
              {/* Nom */}
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 leading-tight truncate">{subject.name}</h3>
                {isInactive && (
                  <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                    Archivée
                  </span>
                )}
                {subject.is_evaluable === false && (
                  <span className="flex-shrink-0 text-xs bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                    <EyeOff className="w-2.5 h-2.5" /> Non éval.
                  </span>
                )}
              </div>
              {/* Niveau */}
              {subject.level && (
                <p className="text-xs text-slate-400 mt-0.5">
                  <GraduationCap className="w-3 h-3 inline mr-1" />
                  {subject.level}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(subject)}>
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDelete(subject)}>
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 pt-3 border-t flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-700" style={{ fontSize: "9px" }}>
              {subject.coefficient || 1}
            </div>
            Coef.
          </span>
          {subject.weekly_hours > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {subject.weekly_hours}h/sem
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {teacherCount} prof{teacherCount > 1 ? "s" : ""}
          </span>
          {examCount > 0 && (
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" />
              {examCount} exam{examCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {subject.description && (
          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{subject.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Vue liste (tableau) ───────────────────────────────────────────────────────
function SubjectRow({ subject, teacherCount, examCount, onEdit, onDelete }) {
  const cat = getCategoryConfig(subject.category);
  const color = subject.color || "#3B82F6";
  return (
    <tr className="border-b hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div>
            <span className="font-medium text-slate-900">{subject.name}</span>
            {subject.description && (
              <p className="text-xs text-slate-400 truncate max-w-xs">{subject.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {subject.code && (
          <span className="text-xs font-mono font-bold px-2 py-1 rounded" style={{ backgroundColor: `${color}22`, color }}>
            {subject.code}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
          {cat.icon} {cat.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{subject.level || "—"}</td>
      <td className="px-4 py-3 text-center">
        <span className="font-bold text-slate-700">{subject.coefficient || 1}</span>
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-500">
        {subject.weekly_hours ? `${subject.weekly_hours}h` : "—"}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-500">{teacherCount}</td>
      <td className="px-4 py-3 text-center text-sm text-slate-500">{examCount}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(subject)}>
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDelete(subject)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Subjects() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list" | "byLevel"
  const [archiveInfo, setArchiveInfo] = useState(null); // { subject, linkedCounts }

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list(),
  });

  // Helpers
  const getTeacherCount = (id) => teachers.filter((t) => {
    const ids = Array.isArray(t.subject_ids) ? t.subject_ids : (() => { try { return JSON.parse(t.subject_ids || "[]"); } catch { return []; } })();
    return ids.includes(id);
  }).length;

  const getExamCount = (id) => exams.filter((e) => e.subject_id === id).length;

  // Niveaux distincts présents dans les matières
  const availableLevels = useMemo(() => {
    const set = new Set(subjects.map((s) => s.level).filter(Boolean));
    return [...set].sort();
  }, [subjects]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subjects.filter((s) => {
      const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
      const matchLevel = filterLevel === "all" || s.level === filterLevel;
      const matchCat = filterCategory === "all" || s.category === filterCategory;
      const matchStatus = showInactive ? true : s.status !== "inactive";
      return matchSearch && matchLevel && matchCat && matchStatus;
    });
  }, [subjects, search, filterLevel, filterCategory, showInactive]);

  // Groupement par niveau
  const byLevel = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      const key = s.level || "Sans niveau";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => {
      const ia = LEVELS.indexOf(a);
      const ib = LEVELS.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [filtered]);

  // Stats globales (sur les actives seulement)
  const stats = useMemo(() => {
    const active = subjects.filter((s) => s.status !== "inactive");
    const totalCoeff = active.reduce((s, m) => s + (m.coefficient || 1), 0);
    const totalHours = active.reduce((s, m) => s + (m.weekly_hours || 0), 0);
    return {
      total:      active.length,
      inactive:   subjects.filter((s) => s.status === "inactive").length,
      avgCoeff:   active.length ? (totalCoeff / active.length).toFixed(1) : 0,
      totalHours: totalHours.toFixed(1),
      withTeacher:active.filter((s) => getTeacherCount(s.id) > 0).length,
      nonEval:    active.filter((s) => s.is_evaluable === false).length,
    };
  }, [subjects, teachers]);

  const handleEdit = (s) => { setSelectedSubject(s); setFormOpen(true); };
  const handleNew  = () => { setSelectedSubject(null); setFormOpen(true); };
  // RG-MAT-03 : tentative de suppression — peut se transformer en archivage
  const handleDelete = async () => {
    try {
      await base44.entities.Subject.delete(deleteTarget.id);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setDeleteTarget(null);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.can_archive) {
        // La matière est liée — proposer l'archivage
        setArchiveInfo({ subject: deleteTarget, linkedCounts: data.linked_counts });
        setDeleteTarget(null);
      } else {
        alert(data?.error || err?.message || "Erreur lors de la suppression.");
        setDeleteTarget(null);
      }
    }
  };

  const handleArchive = async () => {
    if (!archiveInfo) return;
    await base44.entities.Subject.update(archiveInfo.subject.id, { status: "inactive" });
    qc.invalidateQueries({ queryKey: ["subjects"] });
    setArchiveInfo(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">📚</div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Gestion des Matières</h1>
              <p className="text-white/80">
                {stats.total} matière{stats.total !== 1 ? "s" : ""} · {stats.totalHours}h/semaine au total
              </p>
            </div>
          </div>
          <Button onClick={handleNew} className="bg-white text-violet-700 hover:bg-violet-50 font-semibold">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle matière
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total matières",   value: stats.total,     icon: BookOpen,      color: "border-l-violet-500", iconColor: "text-violet-500" },
          { label: "Coeff. moyen",     value: stats.avgCoeff,  icon: BarChart2,     color: "border-l-indigo-500", iconColor: "text-indigo-500" },
          { label: "Heures / semaine", value: `${stats.totalHours}h`, icon: Clock, color: "border-l-blue-500",   iconColor: "text-blue-500" },
          { label: "Avec enseignant",  value: stats.withTeacher, icon: Users,       color: "border-l-green-500", iconColor: "text-green-500" },
        ].map((s) => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
              <s.icon className={`w-8 h-8 ${s.iconColor}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres + toggle vue */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Rechercher par nom ou code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {SUBJECT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tous niveaux" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous niveaux</SelectItem>
                {availableLevels.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Toggle archivées */}
            {stats.inactive > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-medium transition-colors flex-shrink-0 ${
                  showInactive
                    ? "bg-amber-100 border-amber-300 text-amber-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archivées ({stats.inactive})
              </button>
            )}

            {/* Toggle vue */}
            <div className="flex rounded-lg border overflow-hidden flex-shrink-0">
              {[
                { key: "grid",    icon: "⊞", title: "Grille" },
                { key: "list",    icon: "☰", title: "Liste" },
                { key: "byLevel", icon: "⋮", title: "Par niveau" },
              ].map((v) => (
                <button
                  key={v.key}
                  title={v.title}
                  onClick={() => setViewMode(v.key)}
                  className={`w-9 h-9 flex items-center justify-center text-sm border-r last:border-r-0 transition-colors ${
                    viewMode === v.key
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {v.icon}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-36 bg-slate-100 rounded" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">
              {subjects.length === 0 ? "Aucune matière créée" : "Aucune matière ne correspond aux filtres"}
            </p>
            {subjects.length === 0 && (
              <Button className="mt-4" onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" /> Créer une matière
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <>
          <p className="text-sm text-slate-500">
            {filtered.length} matière{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== subjects.length && ` sur ${subjects.length}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((s) => (
              <SubjectCard
                key={s.id}
                subject={s}
                teacherCount={getTeacherCount(s.id)}
                examCount={getExamCount(s.id)}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </>
      ) : viewMode === "list" ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Matière</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3 text-left">Niveau</th>
                  <th className="px-4 py-3 text-center">Coef.</th>
                  <th className="px-4 py-3 text-center">H/sem</th>
                  <th className="px-4 py-3 text-center">Profs</th>
                  <th className="px-4 py-3 text-center">Examens</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SubjectRow
                    key={s.id}
                    subject={s}
                    teacherCount={getTeacherCount(s.id)}
                    examCount={getExamCount(s.id)}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Vue par niveau */
        <div className="space-y-6">
          {byLevel.map(([level, subs]) => (
            <div key={level}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full">
                  <GraduationCap className="w-4 h-4" />
                  <span className="font-semibold text-sm">{level}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {subs.length} matière{subs.length !== 1 ? "s" : ""} · {subs.reduce((s, m) => s + (m.weekly_hours || 0), 0).toFixed(1)}h/sem
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subs.map((s) => (
                  <SubjectCard
                    key={s.id}
                    subject={s}
                    teacherCount={getTeacherCount(s.id)}
                    examCount={getExamCount(s.id)}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panneau de synthèse par catégorie */}
      {subjects.length > 0 && <CategorySummary subjects={subjects} />}

      {/* Form */}
      <SubjectForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedSubject(null); }}
        subject={selectedSubject}
        onSave={() => qc.invalidateQueries({ queryKey: ["subjects"] })}
      />

      {/* Suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la matière ?</AlertDialogTitle>
            <AlertDialogDescription>
              La matière <strong>{deleteTarget?.name}</strong> sera supprimée définitivement.
              Si elle est liée à des examens ou devoirs, le système proposera l'archivage à la place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogue archivage forcé — RG-MAT-03 */}
      <AlertDialog open={!!archiveInfo} onOpenChange={() => setArchiveInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Suppression impossible — Archivage requis
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  La matière <strong>{archiveInfo?.subject?.name}</strong> ne peut pas être supprimée
                  car elle est utilisée dans l'historique pédagogique :
                </p>
                {archiveInfo?.linkedCounts && (
                  <ul className="list-disc list-inside text-slate-600 bg-slate-50 rounded-lg p-3 space-y-1">
                    {archiveInfo.linkedCounts.examCount     > 0 && <li>{archiveInfo.linkedCounts.examCount} examen(s)</li>}
                    {archiveInfo.linkedCounts.homeworkCount > 0 && <li>{archiveInfo.linkedCounts.homeworkCount} devoir(s)</li>}
                    {archiveInfo.linkedCounts.scheduleCount > 0 && <li>{archiveInfo.linkedCounts.scheduleCount} créneau(x) d'emploi du temps</li>}
                    {archiveInfo.linkedCounts.resourceCount > 0 && <li>{archiveInfo.linkedCounts.resourceCount} ressource(s) pédagogique(s)</li>}
                  </ul>
                )}
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <strong>RG-MAT-03 :</strong> L'archivage logique est la seule option autorisée.
                  La matière sera masquée des listes de sélection, mais toutes les données historiques
                  (notes, bulletins, examens passés) resteront intactes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleArchive}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archiver la matière
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Synthèse par catégorie ────────────────────────────────────────────────────
function CategorySummary({ subjects }) {
  const byCat = useMemo(() => {
    const map = {};
    for (const s of subjects) {
      const key = s.category || "general";
      if (!map[key]) map[key] = { count: 0, totalCoeff: 0, totalHours: 0 };
      map[key].count++;
      map[key].totalCoeff += s.coefficient || 1;
      map[key].totalHours += s.weekly_hours || 0;
    }
    return Object.entries(map)
      .map(([key, v]) => ({ ...getCategoryConfig(key), ...v, avgCoeff: (v.totalCoeff / v.count).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
  }, [subjects]);

  if (byCat.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600" />
          Répartition par catégorie
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {byCat.map((c) => (
            <div key={c.value} className="p-3 rounded-lg border bg-slate-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{c.icon}</span>
                <span className="text-sm font-medium text-slate-700 truncate">{c.label}</span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                <p><span className="font-semibold text-slate-700">{c.count}</span> matière{c.count !== 1 ? "s" : ""}</p>
                {c.totalHours > 0 && <p>{c.totalHours.toFixed(1)}h/sem</p>}
                <p>Coef. moy. {c.avgCoeff}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
