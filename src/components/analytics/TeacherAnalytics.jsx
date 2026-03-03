import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from "recharts";

export default function TeacherAnalytics() {
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => base44.entities.Exam.list() });
  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => base44.entities.Grade.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });

  const teacherStats = useMemo(() => {
    return teachers.map(t => {
      const teacherExams = exams.filter(e => e.teacher_id === t.id);
      const examIds = teacherExams.map(e => e.id);
      const teacherGrades = grades.filter(g => examIds.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = teacherGrades.length ? (teacherGrades.reduce((a, b) => a + b.score, 0) / teacherGrades.length).toFixed(1) : null;
      const successRate = teacherGrades.length ? ((teacherGrades.filter(g => g.score >= 10).length / teacherGrades.length) * 100).toFixed(0) : null;
      const classIds = [...new Set(teacherExams.map(e => e.class_id))];
      const classNames = classIds.map(id => classes.find(c => c.id === id)?.name).filter(Boolean);

      // Scores distribution
      const distribution = [
        { range: "0-5", count: teacherGrades.filter(g => g.score < 5).length },
        { range: "5-10", count: teacherGrades.filter(g => g.score >= 5 && g.score < 10).length },
        { range: "10-15", count: teacherGrades.filter(g => g.score >= 10 && g.score < 15).length },
        { range: "15-20", count: teacherGrades.filter(g => g.score >= 15).length },
      ];

      return {
        teacher: t,
        avg,
        successRate,
        examCount: teacherExams.length,
        classNames,
        distribution,
        gradeCount: teacherGrades.length
      };
    }).filter(t => t.examCount > 0);
  }, [teachers, exams, grades, classes]);

  // Class comparison data
  const classComparison = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id).map(s => s.id);
      const classExams = exams.filter(e => e.class_id === cls.id).map(e => e.id);
      const classGrades = grades.filter(g => classStudents.includes(g.student_id) && classExams.includes(g.exam_id) && !g.absent && g.score != null);
      const avg = classGrades.length ? (classGrades.reduce((a, b) => a + b.score, 0) / classGrades.length).toFixed(1) : null;
      const successRate = classGrades.length ? ((classGrades.filter(g => g.score >= 10).length / classGrades.length) * 100).toFixed(0) : null;
      return { name: cls.name, moyenne: avg ? parseFloat(avg) : null, reussite: successRate ? parseFloat(successRate) : null };
    }).filter(c => c.moyenne !== null);
  }, [classes, students, exams, grades]);

  return (
    <div className="space-y-6">
      {/* Class comparison */}
      {classComparison.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">🏫 Comparaison des classes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={classComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" domain={[0, 20]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="moyenne" fill="#6366f1" radius={[4, 4, 0, 0]} name="Moyenne /20" />
                <Bar yAxisId="right" dataKey="reussite" fill="#10b981" radius={[4, 4, 0, 0]} name="Réussite %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Teacher cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teacherStats.length === 0 && (
          <div className="col-span-2 flex items-center justify-center h-40 text-slate-400 bg-slate-50 rounded-xl">
            Aucune donnée disponible — ajoutez des examens et des notes
          </div>
        )}
        {teacherStats.map(({ teacher, avg, successRate, examCount, classNames, distribution }) => (
          <Card key={teacher.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                    {teacher.first_name[0]}{teacher.last_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{teacher.first_name} {teacher.last_name}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {classNames.map(cn => <Badge key={cn} variant="outline" className="text-xs">{cn}</Badge>)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">{avg}/20</p>
                  <p className="text-xs text-slate-500">Moyenne classe</p>
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-700">{successRate}%</p>
                  <p className="text-xs text-slate-500">Réussite</p>
                </div>
                <div className="flex-1 bg-indigo-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-indigo-700">{examCount}</p>
                  <p className="text-xs text-slate-500">Examens</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Distribution des notes</p>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={distribution} barSize={20}>
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}