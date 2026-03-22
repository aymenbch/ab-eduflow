import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, XCircle, Clock, Star, Send, Users, BookOpen,
  Bell, Loader2, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "present",  label: "Présent", icon: CheckCircle, color: "text-green-500",  bg: "bg-green-50 border-green-200"   },
  { value: "absent",   label: "Absent",  icon: XCircle,     color: "text-red-500",    bg: "bg-red-50 border-red-200"       },
  { value: "late",     label: "Retard",  icon: Clock,       color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  { value: "excused",  label: "Excusé",  icon: CheckCircle, color: "text-blue-500",   bg: "bg-blue-50 border-blue-200"     },
];

const WEEK_DAYS  = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAY_ABBR   = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS     = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function dateToWeekDay(dateStr) {
  const dow = new Date(dateStr + "T00:00:00").getDay(); // 0 = Dimanche
  if (dow === 0) return null;
  return WEEK_DAYS[dow - 1];
}

export default function MobileSaisie() {
  const [activeTab, setActiveTab]           = useState("attendance");
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass]   = useState("");
  const [selectedSeance, setSelectedSeance] = useState(null);
  const [selectedExam, setSelectedExam]     = useState("");
  const [attendanceData, setAttendanceData] = useState({});
  const [gradeData, setGradeData]           = useState({});
  const [notifyParents, setNotifyParents]   = useState(true);
  const [saving, setSaving]                 = useState(false);
  const queryClient = useQueryClient();

  const selectedDayName = useMemo(() => dateToWeekDay(selectedDate), [selectedDate]);

  const { currentRole, myTeacherId, isTeacher } = useCurrentMember();

  /* ── Queries ── */
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn:  () => base44.entities.Class.list(),
  });

  // Schedules de l'enseignant connecté (pour filtrer classes et séances)
  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["schedules_teacher", myTeacherId],
    queryFn:  () => myTeacherId
      ? base44.entities.Schedule.filter({ teacher_id: myTeacherId })
      : [],
    enabled: isTeacher && !!myTeacherId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClass],
    queryFn:  () => selectedClass
      ? base44.entities.Student.filter({ class_id: selectedClass, status: "active" })
      : [],
    enabled: !!selectedClass,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams", selectedClass],
    queryFn:  () => selectedClass
      ? base44.entities.Exam.filter({ class_id: selectedClass })
      : [],
    enabled: !!selectedClass,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects_all"],
    queryFn:  () => base44.entities.Subject.list(),
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn:  () => base44.entities.Period.list(),
  });

  // Pour les rôles non-enseignant : tous les créneaux de la classe sélectionnée
  const { data: allClassSchedules = [] } = useQuery({
    queryKey: ["schedules_class", selectedClass],
    queryFn:  () => selectedClass
      ? base44.entities.Schedule.filter({ class_id: selectedClass })
      : [],
    enabled: !isTeacher && !!selectedClass,
  });

  /* ── Derived data ── */
  const periodMap  = useMemo(() => Object.fromEntries(periods.map(p  => [p.id,  p])),  [periods]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);

  // Classes visibles : pour un enseignant, seulement celles où il a des créneaux
  const visibleClasses = useMemo(() => {
    if (!isTeacher || teacherSchedules.length === 0) return classes;
    const classIds = new Set(teacherSchedules.map(s => s.class_id));
    return classes.filter(c => classIds.has(c.id));
  }, [classes, isTeacher, teacherSchedules]);

  // Séances du jour : pour enseignant → ses créneaux filtrés, pour admin → tous les créneaux de la classe
  const daySeances = useMemo(() => {
    if (!selectedDayName || !selectedClass) return [];
    const source = isTeacher ? teacherSchedules : allClassSchedules;
    return source
      .filter(s => s.class_id === selectedClass && String(s.day_of_week) === selectedDayName)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [isTeacher, teacherSchedules, allClassSchedules, selectedClass, selectedDayName]);

  // Examens filtrés par matière de la séance (si une séance est sélectionnée)
  const filteredExams = useMemo(() => {
    if (!selectedSeance?.subject_id) return exams;
    return exams.filter(e => e.subject_id === selectedSeance.subject_id);
  }, [exams, selectedSeance]);

  const selectedExamObj = filteredExams.find(e => e.id === selectedExam);
  const selectedSubject = subjects.find(s => s.id === selectedExamObj?.subject_id);

  // Bloc date pour le mini-calendrier dans le header
  const selDateObj  = new Date(selectedDate + "T00:00:00");
  const headerDay   = DAY_ABBR[selDateObj.getDay()];
  const headerNum   = selDateObj.getDate();
  const headerMonth = MONTHS[selDateObj.getMonth()];
  const headerYear  = selDateObj.getFullYear();
  const isToday     = selectedDate === new Date().toISOString().split("T")[0];

  /* ── Handlers ── */
  const handleClassChange = (val) => {
    setSelectedClass(val);
    setSelectedSeance(null);
    setSelectedExam("");
    setAttendanceData({});
    setGradeData({});
  };

  const handleDateChange = (val) => {
    setSelectedDate(val);
    setSelectedSeance(null);
    setAttendanceData({});
  };

  const handleSeanceSelect = (seance) => {
    setSelectedSeance(prev => prev?.id === seance.id ? null : seance);
    setSelectedExam("");
  };

  const handleAttendanceChange = (studentId, status) =>
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));

  const handleGradeChange = (studentId, value) =>
    setGradeData(prev => ({ ...prev, [studentId]: value }));

  const handleSaveAttendance = async () => {
    setSaving(true);
    const seanceLabel = selectedSeance
      ? `${subjectMap[selectedSeance.subject_id]?.name ?? "Séance"} ${selectedSeance.start_time}–${selectedSeance.end_time}`
      : undefined;

    const records = students
      .filter(s => attendanceData[s.id])
      .map(s => ({
        student_id: s.id,
        class_id:   selectedClass,
        date:       selectedDate,
        status:     attendanceData[s.id],
        justified:  attendanceData[s.id] === "excused",
        ...(seanceLabel ? { comment: seanceLabel } : {}),
      }));

    if (records.length === 0) {
      toast.error("Veuillez saisir au moins une présence");
      setSaving(false);
      return;
    }

    await base44.entities.Attendance.bulkCreate(records);

    if (notifyParents) {
      const toNotify = students.filter(
        s => attendanceData[s.id] === "absent" || attendanceData[s.id] === "late"
      );
      for (const student of toNotify) {
        if (student.parent_email) {
          try {
            await base44.integrations.Core.SendEmail({
              to:      student.parent_email,
              subject: `[EduGest] ${attendanceData[student.id] === "absent" ? "Absence" : "Retard"} de ${student.first_name} ${student.last_name}`,
              body:    `Bonjour ${student.parent_name || ""},\n\nNous vous informons que votre enfant ${student.first_name} ${student.last_name} a été enregistré(e) comme "${attendanceData[student.id] === "absent" ? "absent(e)" : "en retard"}" le ${selectedDate}.\n\nSi cette absence est justifiée, merci de contacter l'établissement.\n\nCordialement,\nEduGest`,
            });
          } catch (e) {}
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    toast.success(`${records.length} présences enregistrées${notifyParents ? " + parents notifiés" : ""}`);
    setAttendanceData({});
    setSaving(false);
  };

  const handleSaveGrades = async () => {
    if (!selectedExam) { toast.error("Veuillez sélectionner un examen"); return; }
    setSaving(true);
    const records = students
      .filter(s => gradeData[s.id] !== undefined && gradeData[s.id] !== "")
      .map(s => ({ student_id: s.id, exam_id: selectedExam, score: parseFloat(gradeData[s.id]) }));

    if (records.length === 0) {
      toast.error("Veuillez saisir au moins une note");
      setSaving(false);
      return;
    }

    await base44.entities.Grade.bulkCreate(records);
    queryClient.invalidateQueries({ queryKey: ["grades"] });
    toast.success(`${records.length} notes enregistrées !`);
    setGradeData({});
    setSaving(false);
  };

  const allMarked   = students.length > 0 && students.every(s => attendanceData[s.id]);
  const markedCount = Object.keys(attendanceData).length;

  /* ── Render ── */
  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📱</span>
            <div>
              <h1 className="text-xl font-bold">Saisie Rapide</h1>
              <p className="text-white/75 text-sm">Interface enseignant mobile</p>
            </div>
          </div>
          <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-center min-w-[60px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">{headerDay}</span>
            <span className="text-3xl font-extrabold leading-none text-white">{headerNum}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{headerMonth}</span>
            <span className="text-[10px] text-white/60 mt-0.5">{headerYear}</span>
          </div>
        </div>
      </div>

      {/* ── Date + Classe ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Date */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              Date
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full"
            />
            {!isToday && (
              <button
                className="text-xs text-green-600 mt-1 underline"
                onClick={() => handleDateChange(new Date().toISOString().split("T")[0])}
              >
                Revenir à aujourd'hui
              </button>
            )}
          </div>

          {/* Classe */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              Classe
            </label>
            <Select value={selectedClass} onValueChange={handleClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe..." />
              </SelectTrigger>
              <SelectContent>
                {visibleClasses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Séances du jour ── */}
      {selectedClass && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                Séance du cours
              </label>
              {selectedDayName && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {selectedDayName}
                </span>
              )}
            </div>

            {!selectedDayName ? (
              <p className="text-sm text-slate-400 text-center py-3">Pas de cours le dimanche</p>
            ) : daySeances.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-3">
                Aucun cours dans l'emploi du temps pour ce jour
              </p>
            ) : (
              <div className="space-y-2">
                {daySeances.map(seance => {
                  const subj       = subjectMap[seance.subject_id];
                  const isSelected = selectedSeance?.id === seance.id;
                  return (
                    <button
                      key={seance.id}
                      onClick={() => handleSeanceSelect(seance)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-green-50 border-green-400 ring-1 ring-green-300"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {/* Créneau horaire */}
                      <div className={`w-14 flex flex-col items-center justify-center rounded-lg py-2 flex-shrink-0 ${
                        isSelected ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <span className="text-[11px] font-bold leading-none">{seance.start_time}</span>
                        <span className={`text-[9px] my-0.5 ${isSelected ? "text-green-200" : "text-slate-300"}`}>▼</span>
                        <span className="text-[11px] font-bold leading-none">{seance.end_time}</span>
                      </div>

                      {/* Infos matière */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${
                          isSelected ? "text-green-800" : "text-slate-700"
                        }`}>
                          {subj?.name ?? "Matière non définie"}
                        </p>
                        {seance.room && (
                          <p className="text-xs text-slate-400 mt-0.5">Salle {seance.room}</p>
                        )}
                      </div>

                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSeance && (
              <button
                className="text-xs text-slate-400 mt-2 underline w-full text-center"
                onClick={() => { setSelectedSeance(null); setSelectedExam(""); }}
              >
                Désélectionner la séance
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs Présences / Notes ── */}
      {selectedClass && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />Présences
            </TabsTrigger>
            <TabsTrigger value="grades" className="flex items-center gap-1.5">
              <Star className="w-4 h-4" />Notes
            </TabsTrigger>
          </TabsList>

          {/* ─── PRÉSENCES ─── */}
          <TabsContent value="attendance" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{markedCount}/{students.length} élèves saisis</span>
                  {allMarked && <Badge className="bg-green-100 text-green-700">✓ Complet</Badge>}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: students.length > 0 ? `${(markedCount / students.length) * 100}%` : "0%" }}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => {
                const all = {};
                students.forEach(s => (all[s.id] = "present"));
                setAttendanceData(all);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />Tous présents
            </Button>

            <div className="space-y-2">
              {students.map(student => {
                const currentStatus = attendanceData[student.id];
                return (
                  <Card key={student.id} className={currentStatus ? "ring-1 ring-slate-300" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">{student.first_name} {student.last_name}</p>
                          <p className="text-xs text-slate-500">{student.student_code}</p>
                        </div>
                        {currentStatus && (
                          <Badge className={
                            currentStatus === "present" ? "bg-green-100 text-green-700"   :
                            currentStatus === "absent"  ? "bg-red-100 text-red-700"       :
                            currentStatus === "late"    ? "bg-orange-100 text-orange-700" :
                                                         "bg-blue-100 text-blue-700"
                          }>
                            {STATUS_OPTIONS.find(s => s.value === currentStatus)?.label}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {STATUS_OPTIONS.map(opt => {
                          const Icon       = opt.icon;
                          const isSelected = currentStatus === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleAttendanceChange(student.id, opt.value)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                                isSelected ? opt.bg + " scale-95 shadow-inner" : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${isSelected ? opt.color : "text-slate-400"}`} />
                              <span className={isSelected ? opt.color : "text-slate-500"}>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Notifier les parents</p>
                    <p className="text-xs text-slate-500">Email auto pour absents/retards</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifyParents(!notifyParents)}
                  className={`w-12 h-6 rounded-full transition-colors ${notifyParents ? "bg-green-500" : "bg-slate-300"}`}
                >
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    notifyParents ? "translate-x-6" : "translate-x-0"
                  }`} />
                </button>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-semibold"
              onClick={handleSaveAttendance}
              disabled={saving || markedCount === 0}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
              Enregistrer {markedCount > 0 ? `(${markedCount})` : ""}
            </Button>
          </TabsContent>

          {/* ─── NOTES ─── */}
          <TabsContent value="grades" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  Examen / Contrôle
                  {selectedSeance?.subject_id && (
                    <span className="ml-1 text-xs text-indigo-500 font-normal">
                      · filtré : {subjectMap[selectedSeance.subject_id]?.name}
                    </span>
                  )}
                </label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un examen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredExams.length === 0
                      ? <SelectItem value="_none" disabled>Aucun examen pour cette matière</SelectItem>
                      : filteredExams.map(e => {
                          const subj        = subjects.find(s => s.id === e.subject_id);
                          const periodLabel = e.period_id && periodMap[e.period_id]
                            ? periodMap[e.period_id].name
                            : e.trimester ?? null;
                          return (
                            <SelectItem key={e.id} value={e.id}>
                              {subj ? `${subj.name} — ` : ""}{e.title}{periodLabel ? ` (${periodLabel})` : ""}
                            </SelectItem>
                          );
                        })
                    }
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedExamObj && (
              <div className={`flex items-stretch gap-3 rounded-xl p-3 border ${
                selectedSubject ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"
              }`}>
                <div className={`w-14 flex flex-col items-center justify-center rounded-xl text-white flex-shrink-0 ${
                  selectedSubject ? "bg-indigo-600" : "bg-slate-500"
                }`}>
                  <BookOpen className="w-5 h-5 mb-1" />
                  {selectedExamObj.max_score && (
                    <span className="text-[11px] font-bold leading-none">/{selectedExamObj.max_score}</span>
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className={`text-base font-bold leading-tight truncate ${
                    selectedSubject ? "text-indigo-800" : "text-slate-700"
                  }`}>
                    {selectedSubject?.name ?? "Matière non définie"}
                  </p>
                  <p className="text-sm text-slate-600 font-medium truncate">{selectedExamObj.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(selectedExamObj.period_id || selectedExamObj.trimester) && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                        {selectedExamObj.period_id && periodMap[selectedExamObj.period_id]
                          ? periodMap[selectedExamObj.period_id].name
                          : selectedExamObj.trimester}
                      </span>
                    )}
                    {selectedExamObj.date && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />{selectedExamObj.date}
                      </span>
                    )}
                    {selectedExamObj.coefficient && (
                      <span className="text-xs text-slate-400">coeff. {selectedExamObj.coefficient}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedExam && (
              <>
                <div className="space-y-2">
                  {students.map(student => (
                    <Card key={student.id}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{student.first_name} {student.last_name}</p>
                          <p className="text-xs text-slate-500">{student.student_code}</p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="/20"
                          value={gradeData[student.id] ?? ""}
                          onChange={e => handleGradeChange(student.id, e.target.value)}
                          className="text-center font-bold text-lg w-20"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-base font-semibold"
                  onClick={handleSaveGrades}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                  Enregistrer les notes
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
