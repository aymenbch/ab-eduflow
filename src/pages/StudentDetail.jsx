import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, User, AlertTriangle, BookOpen, Check, X, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StudentIDCard from "@/components/students/StudentIDCard";

export default function StudentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get("id");

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const students = await base44.entities.Student.filter({ id: studentId });
      return students[0];
    },
    enabled: !!studentId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["student-grades", studentId],
    queryFn: () => base44.entities.Grade.filter({ student_id: studentId }),
    enabled: !!studentId,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => base44.entities.Exam.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: sanctions = [] } = useQuery({
    queryKey: ["student-sanctions", studentId],
    queryFn: () => base44.entities.Sanction.filter({ student_id: studentId }),
    enabled: !!studentId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: () => base44.entities.Attendance.filter({ student_id: studentId }),
    enabled: !!studentId,
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
  const examMap = Object.fromEntries(exams.map((e) => [e.id, e]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  if (loadingStudent || !student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const studentClass = classMap[student.class_id];

  // Calculate average
  const gradesWithScores = grades.filter((g) => g.score !== null && !g.absent);
  const average =
    gradesWithScores.length > 0
      ? gradesWithScores.reduce((sum, g) => sum + g.score, 0) / gradesWithScores.length
      : null;

  // Attendance stats
  const attendanceStats = {
    present: attendance.filter((a) => a.status === "present").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    late: attendance.filter((a) => a.status === "late").length,
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    graduated: "bg-blue-100 text-blue-800",
    transferred: "bg-orange-100 text-orange-800",
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Students")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Fiche élève</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student ID Card */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold text-slate-900 mb-4 text-center">Carte Étudiant</h3>
            <StudentIDCard student={student} studentClass={studentClass} />
          </CardContent>
        </Card>

        {/* Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                {student.first_name?.[0]}
                {student.last_name?.[0]}
              </div>
              <h2 className="text-xl font-bold mt-4">
                {student.first_name} {student.last_name}
              </h2>
              <p className="text-slate-500">{student.student_code}</p>
              <Badge className={`mt-2 ${statusColors[student.status]}`}>
                {student.status === "active" ? "Actif" : student.status}
              </Badge>
            </div>

            <div className="mt-6 space-y-4">
              {studentClass && (
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Classe</p>
                    <p className="font-medium">{studentClass.name} - {studentClass.level}</p>
                  </div>
                </div>
              )}
              {student.date_of_birth && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Date de naissance</p>
                    <p className="font-medium">
                      {format(new Date(student.date_of_birth), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>
              )}
              {student.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Adresse</p>
                    <p className="font-medium">{student.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Parent info */}
            {student.parent_name && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <User className="w-4 h-4" />
                  Parent / Tuteur
                </h3>
                <p className="font-medium">{student.parent_name}</p>
                {student.parent_phone && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4" />
                    {student.parent_phone}
                  </div>
                )}
                {student.parent_email && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                    <Mail className="w-4 h-4" />
                    {student.parent_email}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats and tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-500">Moyenne</p>
                <p className="text-2xl font-bold text-blue-600">
                  {average ? average.toFixed(2) : "-"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-500">Présences</p>
                <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-500">Absences</p>
                <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-500">Sanctions</p>
                <p className="text-2xl font-bold text-orange-600">{sanctions.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Card>
            <Tabs defaultValue="grades">
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="grades">Notes</TabsTrigger>
                  <TabsTrigger value="attendance">Présences</TabsTrigger>
                  <TabsTrigger value="sanctions">Sanctions</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="grades">
                <CardContent>
                  {grades.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Aucune note enregistrée</p>
                  ) : (
                    <div className="space-y-3">
                      {grades.map((grade) => {
                        const exam = examMap[grade.exam_id];
                        const subject = exam ? subjectMap[exam.subject_id] : null;
                        return (
                          <div key={grade.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                            <div>
                              <p className="font-medium">{exam?.title || "Examen"}</p>
                              {subject && (
                                <Badge
                                  variant="outline"
                                  style={{ borderColor: subject.color, color: subject.color }}
                                  className="mt-1"
                                >
                                  {subject.name}
                                </Badge>
                              )}
                            </div>
                            <div className="text-right">
                              {grade.absent ? (
                                <Badge className="bg-red-100 text-red-800">Absent</Badge>
                              ) : (
                                <span className="text-lg font-bold">
                                  {grade.score}/{exam?.max_score || 20}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="attendance">
                <CardContent>
                  {attendance.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Aucun enregistrement de présence</p>
                  ) : (
                    <div className="space-y-2">
                      {attendance.slice(0, 20).map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                          <span>{a.date && format(new Date(a.date), "d MMMM yyyy", { locale: fr })}</span>
                          <Badge
                            className={
                              a.status === "present"
                                ? "bg-green-100 text-green-800"
                                : a.status === "absent"
                                ? "bg-red-100 text-red-800"
                                : a.status === "late"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                            }
                          >
                            {a.status === "present" && <Check className="w-3 h-3 mr-1" />}
                            {a.status === "absent" && <X className="w-3 h-3 mr-1" />}
                            {a.status === "late" && <Clock className="w-3 h-3 mr-1" />}
                            {a.status === "present" ? "Présent" : a.status === "absent" ? "Absent" : a.status === "late" ? "Retard" : "Excusé"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="sanctions">
                <CardContent>
                  {sanctions.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Aucune sanction</p>
                  ) : (
                    <div className="space-y-3">
                      {sanctions.map((s) => (
                        <div key={s.id} className="p-4 rounded-lg bg-slate-50 border-l-4 border-l-red-400">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge className="bg-red-100 text-red-800">{s.type}</Badge>
                              <p className="font-medium mt-2">{s.reason}</p>
                              <p className="text-sm text-slate-500 mt-1">
                                {s.date && format(new Date(s.date), "d MMMM yyyy", { locale: fr })}
                              </p>
                            </div>
                            <Badge className={s.resolved ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                              {s.resolved ? "Résolu" : "En cours"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}