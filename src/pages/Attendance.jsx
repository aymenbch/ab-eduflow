import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Check, X, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG = {
  present: { label: "Présent", icon: Check, color: "bg-green-100 text-green-800 border-green-200" },
  absent: { label: "Absent", icon: X, color: "bg-red-100 text-red-800 border-red-200" },
  late: { label: "Retard", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  excused: { label: "Excusé", icon: AlertCircle, color: "bg-blue-100 text-blue-800 border-blue-200" },
};

export default function Attendance() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceData, setAttendanceData] = useState({});
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClass],
    queryFn: () => base44.entities.Student.filter({ class_id: selectedClass }),
    enabled: !!selectedClass,
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ["attendance", selectedClass, selectedDate],
    queryFn: () =>
      base44.entities.Attendance.filter({
        class_id: selectedClass,
        date: selectedDate,
      }),
    enabled: !!selectedClass && !!selectedDate,
  });

  useEffect(() => {
    if (existingAttendance.length > 0) {
      const data = {};
      existingAttendance.forEach((a) => {
        data[a.student_id] = {
          id: a.id,
          status: a.status,
          reason: a.reason || "",
          justified: a.justified || false,
        };
      });
      setAttendanceData(data);
    } else {
      // Initialize all students as present
      const data = {};
      students.forEach((s) => {
        data[s.id] = { status: "present", reason: "", justified: false };
      });
      setAttendanceData(data);
    }
  }, [existingAttendance, students]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    for (const student of students) {
      const data = attendanceData[student.id];
      if (!data) continue;

      const existing = existingAttendance.find((a) => a.student_id === student.id);
      const attendanceRecord = {
        student_id: student.id,
        class_id: selectedClass,
        date: selectedDate,
        status: data.status,
        reason: data.reason || "",
        justified: data.justified || false,
      };

      if (existing) {
        await base44.entities.Attendance.update(existing.id, attendanceRecord);
      } else {
        await base44.entities.Attendance.create(attendanceRecord);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    setSaving(false);
  };

  // Calculate stats
  const stats = {
    present: Object.values(attendanceData).filter((a) => a.status === "present").length,
    absent: Object.values(attendanceData).filter((a) => a.status === "absent").length,
    late: Object.values(attendanceData).filter((a) => a.status === "late").length,
    excused: Object.values(attendanceData).filter((a) => a.status === "excused").length,
  };

  return (
    <div>
      <PageHeader
        title="Gestion des présences"
        description="Suivi des absences et retards"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="space-y-2">
          <Label>Classe</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} - {c.level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
        </div>
        {selectedClass && (
          <div className="flex items-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        )}
      </div>

      {selectedClass && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const StatusIcon = config.icon;
              return (
                <Card key={key}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{config.label}s</p>
                      <p className="text-2xl font-bold">{stats[key]}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Attendance list */}
          <Card>
            <CardHeader>
              <CardTitle>
                Appel du {format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {students.map((student) => {
                  const attendance = attendanceData[student.id] || { status: "present" };
                  
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                          {student.first_name?.[0]}
                          {student.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-sm text-slate-500">{student.student_code}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                          const StatusIcon = config.icon;
                          const isSelected = attendance.status === status;
                          
                          return (
                            <Button
                              key={status}
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(student.id, status)}
                              className={`${
                                isSelected ? config.color + " border-2" : "hover:bg-slate-200"
                              }`}
                            >
                              <StatusIcon className="w-4 h-4 mr-1" />
                              {config.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {students.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Aucun élève dans cette classe
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedClass && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">
              Sélectionnez une classe pour faire l'appel
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}