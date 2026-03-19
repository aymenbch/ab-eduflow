import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession } from "@/components/auth/appAuth";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Users,
  BookOpen,
  BarChart2,
} from "lucide-react";

// ─── Computation helpers ──────────────────────────────────────────────────────

/**
 * Normalise une note vers /20 selon le barème de l'examen.
 * Règle 1 : Moyenne générale = somme(note × coeff) / somme(coeff)
 */
function normalizeScore(score, maxScore) {
  if (score === null || score === undefined) return null;
  const max = maxScore && maxScore > 0 ? maxScore : 20;
  return (score / max) * 20;
}

/**
 * Calcule la moyenne pondérée d'un élève sur une liste d'examens.
 * Ignore les absents, dispensés, et les notes manquantes.
 * Règle 1 + 2 : calcul pondéré, automatique.
 */
function computeStudentAvg(studentId, exams, gradeMap) {
  let weightedSum = 0;
  let totalCoeff = 0;

  for (const exam of exams) {
    // Ne calculer que les échelles numériques
    if (exam.grading_scale === "letters" || exam.grading_scale === "competencies") continue;

    const grade = gradeMap[`${studentId}|${exam.id}`];
    if (!grade) continue;
    if (grade.grade_status === "absent" || grade.grade_status === "dispense") continue;
    if (grade.score === null || grade.score === undefined) continue;

    const normalized = normalizeScore(grade.score, exam.max_score);
    if (normalized === null) continue;

    const coeff = exam.coefficient || 1;
    weightedSum += normalized * coeff;
    totalCoeff += coeff;
  }

  return totalCoeff > 0 ? weightedSum / totalCoeff : null;
}

/**
 * Calcule la moyenne par matière pour un élève.
 */
function computeStudentSubjectAvg(studentId, subjectExams, gradeMap) {
  return computeStudentAvg(studentId, subjectExams, gradeMap);
}

/**
 * Calcule le rang d'un élève dans sa classe (avec gestion des ex æquo).
 * Règle 3 : Rang calculé automatiquement.
 */
function computeRank(studentId, students, exams, gradeMap) {
  const myAvg = computeStudentAvg(studentId, exams, gradeMap);
  if (myAvg === null) return null;

  let betterCount = 0;
  for (const s of students) {
    if (s.id === studentId) continue;
    const avg = computeStudentAvg(s.id, exams, gradeMap);
    if (avg !== null && avg > myAvg + 0.001) betterCount++;
  }
  return betterCount + 1;
}

/**
 * Calcule les stats de classe pour une matière (min/max/moy).
 * Règle 4 : Contexte classe.
 */
function computeSubjectStats(students, subjectExams, gradeMap) {
  const avgs = students
    .map((s) => computeStudentSubjectAvg(s.id, subjectExams, gradeMap))
    .filter((a) => a !== null);

  if (avgs.length === 0) return null;
  return {
    min: Math.min(...avgs),
    max: Math.max(...avgs),
    avg: avgs.reduce((a, b) => a + b, 0) / avgs.length,
    count: avgs.length,
  };
}

/**
 * Calcule les stats globales de la classe.
 */
function computeClassStats(students, exams, gradeMap) {
  const avgs = students
    .map((s) => computeStudentAvg(s.id, exams, gradeMap))
    .filter((a) => a !== null);

  if (avgs.length === 0) return null;
  return {
    min: Math.min(...avgs),
    max: Math.max(...avgs),
    avg: avgs.reduce((a, b) => a + b, 0) / avgs.length,
    count: avgs.length,
  };
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function avgColor(avg, passing) {
  if (avg === null) return "text-slate-400";
  if (avg >= passing + 4) return "text-emerald-600 font-semibold";
  if (avg >= passing) return "text-blue-600 font-medium";
  if (avg >= passing - 3) return "text-orange-500 font-medium";
  return "text-red-600 font-semibold";
}

function avgBg(avg, passing) {
  if (avg === null) return "";
  if (avg >= passing + 4) return "bg-emerald-50";
  if (avg >= passing) return "bg-blue-50";
  if (avg >= passing - 3) return "bg-orange-50";
  return "bg-red-50";
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(2);
}

function rankSuffix(rank) {
  if (rank === 1) return "er";
  return "ème";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Moyennes() {
  const session = getSession();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("all"); // period id | "all" | "T1" | "T2" | "T3"

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list(),
  });
  const activeYear = schoolYears.find((y) => y.status === "active");
  const passingGrade = activeYear?.passing_grade ?? 10;

  const { data: periodsAll = [] } = useQuery({
    queryKey: ["periods", activeYear?.id],
    queryFn: () => base44.entities.Period.filter({ school_year_id: activeYear.id }),
    enabled: !!activeYear?.id,
  });
  const periods = [...periodsAll].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClassId],
    queryFn: () =>
      base44.entities.Student.filter({ class_id: selectedClassId, status: "active" }),
    enabled: !!selectedClassId,
  });

  const { data: allExams = [] } = useQuery({
    queryKey: ["exams-class", selectedClassId],
    queryFn: () => base44.entities.Exam.filter({ class_id: selectedClassId }),
    enabled: !!selectedClassId,
  });

  const { data: allGrades = [] } = useQuery({
    queryKey: ["grades-class", selectedClassId, allExams.length],
    queryFn: async () => {
      if (!allExams.length) return [];
      // Fetch grades for all exams of this class
      const examIds = allExams.map((e) => e.id);
      // Batch: fetch by exam_id for each exam (API handles filter)
      // Use Promise.all with chunks
      const CHUNK = 20;
      const results = [];
      for (let i = 0; i < examIds.length; i += CHUNK) {
        const chunk = examIds.slice(i, i + CHUNK);
        const gradePromises = chunk.map((eid) =>
          base44.entities.Grade.filter({ exam_id: eid })
        );
        const chunkResults = await Promise.all(gradePromises);
        chunkResults.forEach((r) => results.push(...r));
      }
      return results;
    },
    enabled: !!selectedClassId && allExams.length > 0,
  });

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const gradeMap = useMemo(() => {
    const map = {};
    allGrades.forEach((g) => {
      map[`${g.student_id}|${g.exam_id}`] = g;
    });
    return map;
  }, [allGrades]);

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects]
  );
  const classMap = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes]
  );

  // ── Filter exams by period (Règle 5) ──────────────────────────────────────
  const filteredExams = useMemo(() => {
    if (selectedPeriod === "all") return allExams;
    // Named period
    const period = periods.find((p) => p.id === selectedPeriod);
    if (period) return allExams.filter((e) => e.period_id === selectedPeriod);
    // Legacy trimester T1/T2/T3
    return allExams.filter((e) => e.trimester === selectedPeriod);
  }, [allExams, selectedPeriod, periods]);

  // ── Get unique subjects that have exams in filtered period ─────────────────
  const activeSubjectIds = useMemo(() => {
    const ids = new Set(filteredExams.map((e) => e.subject_id).filter(Boolean));
    return [...ids];
  }, [filteredExams]);

  const activeSubjects = useMemo(
    () =>
      activeSubjectIds
        .map((id) => subjectMap[id])
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeSubjectIds, subjectMap]
  );

  // ── Sort students alphabetically ───────────────────────────────────────────
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      ),
    [students]
  );

  // ── Per-subject exams lookup ───────────────────────────────────────────────
  const examsBySubject = useMemo(() => {
    const map = {};
    for (const subj of activeSubjects) {
      map[subj.id] = filteredExams.filter((e) => e.subject_id === subj.id);
    }
    return map;
  }, [activeSubjects, filteredExams]);

  // ── Compute per-student overall averages and ranks ─────────────────────────
  const studentStats = useMemo(() => {
    const stats = {};
    for (const s of sortedStudents) {
      const avg = computeStudentAvg(s.id, filteredExams, gradeMap);
      stats[s.id] = { avg };
    }
    // Rank (Règle 3)
    for (const s of sortedStudents) {
      const myAvg = stats[s.id].avg;
      if (myAvg === null) { stats[s.id].rank = null; continue; }
      let betterCount = 0;
      for (const other of sortedStudents) {
        if (other.id === s.id) continue;
        const otherAvg = stats[other.id].avg;
        if (otherAvg !== null && otherAvg > myAvg + 0.001) betterCount++;
      }
      stats[s.id].rank = betterCount + 1;
    }
    return stats;
  }, [sortedStudents, filteredExams, gradeMap]);

  // ── Per-subject class stats (Règle 4) ─────────────────────────────────────
  const subjectStats = useMemo(() => {
    const stats = {};
    for (const subj of activeSubjects) {
      stats[subj.id] = computeSubjectStats(
        sortedStudents,
        examsBySubject[subj.id] ?? [],
        gradeMap
      );
    }
    return stats;
  }, [activeSubjects, sortedStudents, examsBySubject, gradeMap]);

  // ── Overall class stats ────────────────────────────────────────────────────
  const classStats = useMemo(
    () => computeClassStats(sortedStudents, filteredExams, gradeMap),
    [sortedStudents, filteredExams, gradeMap]
  );

  // ── Alert count (Règle 6) ─────────────────────────────────────────────────
  const alertCount = useMemo(
    () =>
      sortedStudents.filter((s) => {
        const avg = studentStats[s.id]?.avg;
        return avg !== null && avg !== undefined && avg < passingGrade;
      }).length,
    [sortedStudents, studentStats, passingGrade]
  );

  const successRate =
    classStats && classStats.count > 0
      ? Math.round(
          (sortedStudents.filter((s) => {
            const avg = studentStats[s.id]?.avg;
            return avg !== null && avg >= passingGrade;
          }).length /
            classStats.count) *
            100
        )
      : null;

  // ── Build period tabs (Règle 5) ────────────────────────────────────────────
  const usePeriods = periods.length > 0;
  const periodTabs = usePeriods
    ? [{ id: "all", name: "Annuelle" }, ...periods.map((p) => ({ id: p.id, name: p.name }))]
    : [
        { id: "all", name: "Annuelle" },
        { id: "T1", name: "1er Trimestre" },
        { id: "T2", name: "2ème Trimestre" },
        { id: "T3", name: "3ème Trimestre" },
      ];

  const selectedClass = classMap[selectedClassId];

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          title="Calculs & Moyennes"
          description="Moyennes pondérées, rangs et statistiques de classe en temps réel"
        />

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="w-64">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une classe…" />
              </SelectTrigger>
              <SelectContent>
                {classes
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClassId && (
            <Tabs
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              className="flex-1 min-w-0"
            >
              <TabsList className="flex-wrap h-auto gap-1">
                {periodTabs.map((p) => (
                  <TabsTrigger key={p.id} value={p.id} className="text-sm">
                    {p.name}
                    {p.id === "all" && (
                      <span className="ml-1.5 text-[10px] opacity-60">★</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {!selectedClassId ? (
          <div className="text-center py-20 text-slate-400">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Sélectionnez une classe</p>
            <p className="text-sm mt-1">pour afficher les moyennes et statistiques</p>
          </div>
        ) : (
          <>
            {/* ── Stats cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-500" />
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Élèves</p>
                  </div>
                  <p className="text-2xl font-bold">{sortedStudents.length}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {classStats?.count ?? 0} avec notes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-indigo-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Moy. classe</p>
                  </div>
                  <p className={`text-2xl font-bold ${avgColor(classStats?.avg ?? null, passingGrade)}`}>
                    {fmt(classStats?.avg)}
                  </p>
                  {classStats && (
                    <p className="text-xs text-slate-400 mt-1">
                      Min {fmt(classStats.min)} · Max {fmt(classStats.max)}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Taux réussite</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {successRate !== null ? `${successRate}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Seuil : {passingGrade}/20
                  </p>
                </CardContent>
              </Card>

              {/* Règle 6 : Alerte */}
              <Card className={`border-l-4 ${alertCount > 0 ? "border-l-red-500" : "border-l-slate-200"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${alertCount > 0 ? "text-red-500" : "text-slate-300"}`} />
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Alertes</p>
                  </div>
                  <p className={`text-2xl font-bold ${alertCount > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {alertCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    élève{alertCount !== 1 ? "s" : ""} sous {passingGrade}/20
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Per-subject stats bar (Règle 4) ───────────────────────── */}
            {activeSubjects.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <div className="flex gap-3 pb-2 min-w-max">
                  {activeSubjects.map((subj) => {
                    const stats = subjectStats[subj.id];
                    return (
                      <div
                        key={subj.id}
                        className="rounded-lg border px-3 py-2 bg-white min-w-[120px] shrink-0"
                      >
                        <p
                          className="text-xs font-semibold truncate mb-1"
                          style={{ color: subj.color || "#3b82f6" }}
                        >
                          {subj.name}
                        </p>
                        {stats ? (
                          <div className="text-xs text-slate-600 space-y-0.5">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Moy</span>
                              <span className="font-semibold">{fmt(stats.avg)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Min</span>
                              <span className="text-red-500">{fmt(stats.min)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Max</span>
                              <span className="text-emerald-600">{fmt(stats.max)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">n</span>
                              <span>{stats.count}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Aucune note</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Main grades table ──────────────────────────────────────── */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    {/* Subject header row */}
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 w-8">#</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 min-w-[180px]">Élève</th>
                      {activeSubjects.map((subj) => (
                        <th
                          key={subj.id}
                          className="text-center py-3 px-3 font-medium min-w-[90px]"
                          style={{ color: subj.color || "#3b82f6" }}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs">{subj.name}</span>
                            {subj.coefficient && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                ×{subj.coefficient}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="text-center py-3 px-4 font-semibold text-slate-700 min-w-[100px] bg-slate-100">
                        Moy. générale
                      </th>
                      <th className="text-center py-3 px-3 font-medium text-slate-600 w-20">
                        Rang
                      </th>
                      <th className="text-center py-3 px-3 font-medium text-slate-600 w-20">
                        Alerte
                      </th>
                    </tr>

                    {/* Class stats row */}
                    {classStats && (
                      <tr className="border-b bg-indigo-50/50 text-xs text-slate-500">
                        <td className="py-2 px-4 text-indigo-500 font-medium" colSpan={2}>
                          Statistiques classe
                        </td>
                        {activeSubjects.map((subj) => {
                          const st = subjectStats[subj.id];
                          return (
                            <td key={subj.id} className="py-2 px-3 text-center">
                              {st ? (
                                <span className="font-semibold text-slate-700">{fmt(st.avg)}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-4 text-center bg-indigo-100/50">
                          <span className="font-bold text-indigo-700">{fmt(classStats.avg)}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">—</td>
                        <td className="py-2 px-3 text-center text-slate-400">—</td>
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {sortedStudents.map((student, idx) => {
                      const stats = studentStats[student.id];
                      const avg = stats?.avg ?? null;
                      const rank = stats?.rank ?? null;
                      const isAlert = avg !== null && avg < passingGrade; // Règle 6

                      return (
                        <tr
                          key={student.id}
                          className={`border-b transition-colors hover:bg-slate-50 ${
                            isAlert ? "bg-red-50/30" : ""
                          }`}
                        >
                          {/* # */}
                          <td className="py-3 px-4 text-slate-400">{idx + 1}</td>

                          {/* Student */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {student.first_name?.[0]}
                                {student.last_name?.[0]}
                              </div>
                              <div>
                                <p className="font-medium leading-tight text-sm">
                                  {student.last_name} {student.first_name}
                                </p>
                                <p className="text-xs text-slate-400">{student.student_code}</p>
                              </div>
                            </div>
                          </td>

                          {/* Per-subject averages */}
                          {activeSubjects.map((subj) => {
                            const subjExams = examsBySubject[subj.id] ?? [];
                            const subjAvg = computeStudentSubjectAvg(student.id, subjExams, gradeMap);
                            const subjStats = subjectStats[subj.id];

                            return (
                              <td key={subj.id} className="py-3 px-3 text-center">
                                {subjAvg !== null ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-sm cursor-default ${avgColor(subjAvg, passingGrade)} ${avgBg(subjAvg, passingGrade)}`}
                                      >
                                        {fmt(subjAvg)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">
                                        <p>{subj.name}</p>
                                        {subjStats && (
                                          <>
                                            <p>Moy. classe : {fmt(subjStats.avg)}</p>
                                            <p>Min : {fmt(subjStats.min)} · Max : {fmt(subjStats.max)}</p>
                                          </>
                                        )}
                                        <p className="mt-1 text-slate-300">{subjExams.length} examen{subjExams.length !== 1 ? "s" : ""}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Overall average (Règle 1 + 2) */}
                          <td className={`py-3 px-4 text-center bg-slate-50 ${avgBg(avg, passingGrade)}`}>
                            {avg !== null ? (
                              <span className={`text-base font-bold ${avgColor(avg, passingGrade)}`}>
                                {fmt(avg)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Rank (Règle 3) */}
                          <td className="py-3 px-3 text-center">
                            {rank !== null ? (
                              <span className={`text-sm font-semibold ${rank === 1 ? "text-amber-500" : "text-slate-600"}`}>
                                {rank === 1 && "🥇 "}
                                {rank}
                                <sup className="text-[10px]">{rankSuffix(rank)}</sup>
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Alert (Règle 6) */}
                          <td className="py-3 px-3 text-center">
                            {isAlert ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Moyenne {fmt(avg)} inférieure au seuil ({passingGrade}/20)
                                  </p>
                                  <p className="text-xs text-red-300 mt-0.5">
                                    Suivi personnalisé recommandé
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : avg !== null ? (
                              <div className="flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {sortedStudents.length === 0 && selectedClassId && (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Aucun élève actif dans cette classe</p>
                  </div>
                )}

                {filteredExams.length === 0 && selectedClassId && sortedStudents.length > 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Aucun examen pour cette période</p>
                  </div>
                )}
              </div>
            </Card>

            {/* ── Legend ────────────────────────────────────────────────── */}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="font-medium">Légende :</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                ≥ {passingGrade + 4}/20 — Excellent
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300" />
                ≥ {passingGrade}/20 — Acquis
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" />
                ≥ {passingGrade - 3}/20 — Fragile
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
                &lt; {passingGrade - 3}/20 — En difficulté
              </span>
              <span className="ml-auto text-slate-400 italic">
                Seuil de passage : {passingGrade}/20 · Toutes les moyennes sont ramenées sur /20
              </span>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
