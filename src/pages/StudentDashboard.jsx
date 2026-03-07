import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BookOpen, TrendingUp, TrendingDown, Minus, Calendar, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function StudentDashboard() {
  const { myStudent, myStudentId, isStudent } = useCurrentMember();
  const [selectedTrimester, setSelectedTrimester] = useState("all");

  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ["grades_student", myStudentId],
    queryFn: () => base44.entities.Grade.filter({ student_id: myStudentId }),
    enabled: !!myStudentId,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance_student", myStudentId],
    queryFn: () => base44.entities.Attendance.filter({ student_id: myStudentId }),
    enabled: !!myStudentId,
  });

  const { data: homework = [] } = useQuery({
    queryKey: ["homework_student", myStudent?.class_id],
    queryFn: () => base44.entities.Homework.filter({ class_id: myStudent.class_id }),
    enabled: !!myStudent?.class_id,
  });

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const examMap = Object.fromEntries(exams.map(e => [e.id, e]));

  const myGrades = useMemo(() => {
    return grades.filter(g => !g.absent && g.score != null).map(g => ({
      ...g,
      exam: examMap[g.exam_id],
      subject: subjectMap[examMap[g.exam_id]?.subject_id],
    }));
  }, [grades, examMap, subjectMap]);

  const filteredGrades = useMemo(() =>
    selectedTrimester === "all"
      ? myGrades
      : myGrades.filter(g => g.exam?.trimester === selectedTrimester),
    [myGrades, selectedTrimester]
  );

  // Group by subject
  const bySubject = useMemo(() => {
    const groups = {};
    filteredGrades.forEach(g => {
      const sid = g.exam?.subject_id;
      if (!sid) return;
      if (!groups[sid]) groups[sid] = { subject: g.subject, grades: [] };
      groups[sid].grades.push(g);
    });
    return Object.values(groups).map(g => ({
      ...g,
      avg: g.grades.reduce((s, gr) => s + gr.score, 0) / g.grades.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [filteredGrades]);

  const overallAvg = bySubject.length
    ? bySubject.reduce((s, r) => s + r.avg, 0) / bySubject.length
    : null;

  const absences = attendance.filter(a => a.status === "absent").length;
  const lates = attendance.filter(a => a.status === "late").length;
  const presentRate = attendance.length
    ? ((attendance.filter(a => a.status === "present").length / attendance.length) * 100).toFixed(0)
    : 100;

  const upcomingHomework = homework
    .filter(h => h.due_date && new Date(h.due_date) >= new Date())
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  const avgColor = (v) => v >= 14 ? "text-green-600" : v >= 10 ? "text-blue-600" : "text-red-600";
  const trendIcon = (grades) => {
    if (grades.length < 2) return <Minus className="w-4 h-4 text-slate-400" />;
    const last = grades[grades.length - 1].score;
    const prev = grades[grades.length - 2].score;
    return last > prev
      ? <TrendingUp className="w-4 h-4 text-green-500" />
      : last < prev
      ? <TrendingDown className="w-4 h-4 text-red-500" />
      : <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (!isStudent) {
    return (
      <div className="text-center py-20 text-slate-400">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Cette page est réservée aux élèves connectés.</p>
      </div>
    );
  }

  if (!myStudent) {
    return (
      <div className="text-center py-20 text-slate-400">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
        <p className="font-medium text-slate-600">Aucun profil élève lié à votre compte.</p>
        <p className="text-sm mt-1">Contactez l'administration pour associer votre compte à votre dossier élève.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold">
            {myStudent.first_name?.[0]}{myStudent.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{myStudent.first_name} {myStudent.last_name}</h1>
            <p className="text-white/80 text-sm mt-0.5">🎒 Mon espace élève — Accès à mes données uniquement</p>
            {myStudent.student_code && (
              <Badge className="mt-1 bg-white/20 text-white border-white/30 text-xs">{myStudent.student_code}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${overallAvg ? avgColor(overallAvg) : "text-slate-400"}`}>
              {overallAvg ? overallAvg.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Moyenne générale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{presentRate}%</p>
            <p className="text-xs text-slate-500 mt-1">Présence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{absences}</p>
            <p className="text-xs text-slate-500 mt-1">Absences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{upcomingHomework.length}</p>
            <p className="text-xs text-slate-500 mt-1">Devoirs à venir</p>
          </CardContent>
        </Card>
      </div>

      {/* Notes par matière */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">📊 Mes notes</CardTitle>
          <Select value={selectedTrimester} onValueChange={setSelectedTrimester}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              <SelectItem value="T1">Trimestre 1</SelectItem>
              <SelectItem value="T2">Trimestre 2</SelectItem>
              <SelectItem value="T3">Trimestre 3</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingGrades ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
          ) : bySubject.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune note disponible pour cette période.</p>
          ) : (
            <div className="space-y-2">
              {bySubject.map(({ subject, avg, grades: sg }) => (
                <div key={subject?.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: subject?.color || "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{subject?.name || "Matière"}</p>
                    <p className="text-xs text-slate-400">{sg.length} note(s)</p>
                  </div>
                  {trendIcon(sg)}
                  <span className={`text-2xl font-bold ${avgColor(avg)}`}>{avg.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">/20</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Devoirs à venir */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📚 Mes prochains devoirs</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingHomework.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 text-sm py-4">
              <CheckCircle className="w-5 h-5" />
              Aucun devoir à venir — profitez-en !
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingHomework.map(hw => {
                const sub = subjectMap[hw.subject_id];
                return (
                  <div key={hw.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                    <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: sub?.color || "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">{hw.title}</p>
                      <p className="text-xs text-slate-400">{sub?.name}</p>
                    </div>
                    <div className="text-xs text-right">
                      <div className={`font-medium ${new Date(hw.due_date) < new Date(Date.now() + 86400000 * 2) ? "text-red-600" : "text-slate-600"}`}>
                        {format(new Date(hw.due_date), "d MMM", { locale: fr })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Présences récentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📅 Mes présences récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucune donnée de présence.</p>
          ) : (
            <div className="space-y-1.5">
              {[...attendance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">{format(new Date(a.date), "EEEE d MMM", { locale: fr })}</span>
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
    </div>
  );
}