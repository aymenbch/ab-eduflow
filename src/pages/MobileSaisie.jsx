import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Send,
  Users,
  BookOpen,
  Bell,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "present", label: "Présent", icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 border-green-200" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-200" },
  { value: "late", label: "Retard", icon: Clock, color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  { value: "excused", label: "Excusé", icon: CheckCircle, color: "text-blue-500", bg: "bg-blue-50 border-blue-200" },
];

export default function MobileSaisie() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [attendanceData, setAttendanceData] = useState({});
  const [gradeData, setGradeData] = useState({});
  const [notifyParents, setNotifyParents] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClass],
    queryFn: () =>
      selectedClass
        ? base44.entities.Student.filter({ class_id: selectedClass, status: "active" })
        : [],
    enabled: !!selectedClass,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams", selectedClass],
    queryFn: () =>
      selectedClass
        ? base44.entities.Exam.filter({ class_id: selectedClass })
        : [],
    enabled: !!selectedClass,
  });

  const today = new Date().toISOString().split("T")[0];

  const handleAttendanceChange = (studentId, status) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleGradeChange = (studentId, value) => {
    setGradeData((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    const records = students
      .filter((s) => attendanceData[s.id])
      .map((s) => ({
        student_id: s.id,
        class_id: selectedClass,
        date: today,
        status: attendanceData[s.id],
        justified: attendanceData[s.id] === "excused",
      }));

    if (records.length === 0) {
      toast.error("Veuillez saisir au moins une présence");
      setSaving(false);
      return;
    }

    await base44.entities.Attendance.bulkCreate(records);

    // Notify parents of absent/late students
    if (notifyParents) {
      const toNotify = students.filter(
        (s) => attendanceData[s.id] === "absent" || attendanceData[s.id] === "late"
      );
      for (const student of toNotify) {
        if (student.parent_email) {
          try {
            await base44.integrations.Core.SendEmail({
              to: student.parent_email,
              subject: `[EduGest] ${attendanceData[student.id] === "absent" ? "Absence" : "Retard"} de ${student.first_name} ${student.last_name}`,
              body: `Bonjour ${student.parent_name || ""},\n\nNous vous informons que votre enfant ${student.first_name} ${student.last_name} a été enregistré(e) comme "${attendanceData[student.id] === "absent" ? "absent(e)" : "en retard"}" le ${today}.\n\nSi cette absence est justifiée, merci de contacter l'établissement.\n\nCordialement,\nEduGest`,
            });
          } catch (e) {
            console.log("Email error", e);
          }
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    toast.success(`${records.length} présences enregistrées${notifyParents ? " + parents notifiés" : ""}`);
    setAttendanceData({});
    setSaving(false);
  };

  const handleSaveGrades = async () => {
    if (!selectedExam) {
      toast.error("Veuillez sélectionner un examen");
      return;
    }
    setSaving(true);
    const records = students
      .filter((s) => gradeData[s.id] !== undefined && gradeData[s.id] !== "")
      .map((s) => ({
        student_id: s.id,
        exam_id: selectedExam,
        score: parseFloat(gradeData[s.id]),
      }));

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

  const allMarked = students.length > 0 && students.every((s) => attendanceData[s.id]);
  const markedCount = Object.keys(attendanceData).length;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📱</span>
          <div>
            <h1 className="text-xl font-bold">Saisie Rapide</h1>
            <p className="text-white/80 text-sm">Interface enseignant mobile</p>
          </div>
        </div>
        <p className="text-white/70 text-xs">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {/* Class selector */}
      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium text-slate-700 mb-2 block">Classe</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une classe..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClass && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Présences
            </TabsTrigger>
            <TabsTrigger value="grades" className="flex items-center gap-1.5">
              <Star className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-3 mt-4">
            {/* Progress bar */}
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

            {/* Quick all-present button */}
            <Button
              variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => {
                const all = {};
                students.forEach((s) => (all[s.id] = "present"));
                setAttendanceData(all);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Tous présents
            </Button>

            {/* Student list */}
            <div className="space-y-2">
              {students.map((student) => {
                const currentStatus = attendanceData[student.id];
                return (
                  <Card key={student.id} className={currentStatus ? "ring-1 ring-slate-300" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{student.student_code}</p>
                        </div>
                        {currentStatus && (
                          <Badge
                            className={
                              currentStatus === "present"
                                ? "bg-green-100 text-green-700"
                                : currentStatus === "absent"
                                ? "bg-red-100 text-red-700"
                                : currentStatus === "late"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }
                          >
                            {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
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
                              <span className={isSelected ? opt.color.replace("text-", "text-") : "text-slate-500"}>
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Notify toggle */}
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
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                      notifyParents ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-semibold"
              onClick={handleSaveAttendance}
              disabled={saving || markedCount === 0}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              Enregistrer {markedCount > 0 ? `(${markedCount})` : ""}
            </Button>
          </TabsContent>

          {/* GRADES */}
          <TabsContent value="grades" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-slate-700 mb-2 block">Examen / Contrôle</label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un examen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} ({e.trimester})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedExam && (
              <>
                <div className="space-y-2">
                  {students.map((student) => (
                    <Card key={student.id}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{student.student_code}</p>
                        </div>
                        <div className="flex items-center gap-2 w-28">
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            placeholder="/20"
                            value={gradeData[student.id] ?? ""}
                            onChange={(e) => handleGradeChange(student.id, e.target.value)}
                            className="text-center font-bold text-lg w-20"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-base font-semibold"
                  onClick={handleSaveGrades}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Send className="w-5 h-5 mr-2" />
                  )}
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