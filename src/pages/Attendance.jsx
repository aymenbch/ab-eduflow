import React, { useState, useEffect, useMemo } from "react";
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
import {
  Save, Loader2, Check, X, Clock, AlertCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isToday, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import NotifyParentButton from "@/components/notifications/NotifyParentButton";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";

const STATUS_CONFIG = {
  present: { label: "Présent",  icon: Check,        color: "bg-green-100 text-green-800 border-green-200"  },
  absent:  { label: "Absent",   icon: X,            color: "bg-red-100 text-red-800 border-red-200"        },
  late:    { label: "Retard",   icon: Clock,        color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  excused: { label: "Excusé",   icon: AlertCircle,  color: "bg-blue-100 text-blue-800 border-blue-200"     },
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Attendance() {
  // ── Admin / Teacher states ─────────────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceData, setAttendanceData] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Parent states (hooks must stay at top level) ───────────────────────────
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailDay, setDetailDay] = useState(null);

  const queryClient = useQueryClient();
  const { isParent, myChildren, myChildrenIds } = useCurrentMember();

  // Default to first child when list loads
  useEffect(() => {
    if (myChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(myChildren[0].id);
    }
  }, [myChildren, selectedChildId]);

  // ── Shared queries ─────────────────────────────────────────────────────────
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  // Admin/teacher: students of selected class
  const { data: students = [] } = useQuery({
    queryKey: ["students", selectedClass],
    queryFn: () => base44.entities.Student.filter({ class_id: selectedClass }),
    enabled: !!selectedClass && !isParent,
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ["attendance", selectedClass, selectedDate],
    queryFn: () =>
      base44.entities.Attendance.filter({ class_id: selectedClass, date: selectedDate }),
    enabled: !!selectedClass && !!selectedDate && !isParent,
  });

  // Parent: all attendance records for the selected child (we filter month on the client)
  const monthKey = format(currentMonth, "yyyy-MM");
  const { data: childAttendance = [] } = useQuery({
    queryKey: ["attendance_child", selectedChildId],
    queryFn: () => base44.entities.Attendance.filter({ student_id: selectedChildId }),
    enabled: isParent && !!selectedChildId,
  });

  const monthAttendance = useMemo(
    () => childAttendance.filter(a => a.date?.startsWith(monthKey)),
    [childAttendance, monthKey],
  );

  const attendanceMap = useMemo(() => {
    const map = {};
    monthAttendance.forEach(a => { map[a.date] = a; });
    return map;
  }, [monthAttendance]);

  // ── Admin effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isParent) return;
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
      const data = {};
      students.forEach((s) => {
        data[s.id] = { status: "present", reason: "", justified: false };
      });
      setAttendanceData(data);
    }
  }, [existingAttendance, students]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const student of students) {
      const data = attendanceData[student.id];
      if (!data) continue;
      const existing = existingAttendance.find((a) => a.student_id === student.id);
      const record = {
        student_id: student.id,
        class_id: selectedClass,
        date: selectedDate,
        status: data.status,
        reason: data.reason || "",
        justified: data.justified || false,
      };
      if (existing) {
        await base44.entities.Attendance.update(existing.id, record);
      } else {
        await base44.entities.Attendance.create(record);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    setSaving(false);
  };

  const stats = {
    present: Object.values(attendanceData).filter((a) => a.status === "present").length,
    absent:  Object.values(attendanceData).filter((a) => a.status === "absent").length,
    late:    Object.values(attendanceData).filter((a) => a.status === "late").length,
    excused: Object.values(attendanceData).filter((a) => a.status === "excused").length,
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── Parent calendar view ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isParent) {
    const selectedChild = myChildren.find(c => c.id === selectedChildId);
    const childClass = selectedChild ? classes.find(c => c.id === selectedChild.class_id) : null;

    const monthStart   = startOfMonth(currentMonth);
    const monthEnd     = endOfMonth(currentMonth);
    const allDays      = eachDayOfInterval({ start: monthStart, end: monthEnd });
    // Monday = 0 offset (getDay: 0=Sun → shift)
    const startOffset  = (getDay(monthStart) + 6) % 7;

    const isAlertRec = (r) => r && (r.status === "absent" || r.status === "late");
    const isGoodRec  = (r) => r && (r.status === "present" || r.status === "excused");

    const detailRecord = detailDay ? attendanceMap[detailDay] : null;

    return (
      <div>
        <PageHeader
          title="Présences de mes enfants"
          description="Suivi mensuel des absences et retards"
        />

        {myChildren.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">Aucun enfant associé à votre compte.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-6 items-start">

            {/* ── Left: children vertical filter ─────────────────────────── */}
            <div className="w-44 shrink-0">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Enfants
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {myChildren.map(child => {
                    const active = child.id === selectedChildId;
                    const cls    = classes.find(c => c.id === child.class_id);
                    return (
                      <button
                        key={child.id}
                        onClick={() => { setSelectedChildId(child.id); setDetailDay(null); }}
                        className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors
                          ${active
                            ? "bg-indigo-50 border-l-4 border-indigo-500"
                            : "hover:bg-slate-50 border-l-4 border-transparent"
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0
                          ${active ? "bg-indigo-500" : "bg-slate-400"}`}
                        >
                          {child.first_name?.[0]}{child.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? "text-indigo-700" : "text-slate-700"}`}>
                            {child.first_name} {child.last_name}
                          </p>
                          {cls && (
                            <p className="text-xs text-slate-400 truncate">{cls.name}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Right: calendar + summary ───────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize text-lg">
                      {format(currentMonth, "MMMM yyyy", { locale: fr })}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="icon"
                        onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setDetailDay(null); }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setCurrentMonth(new Date()); setDetailDay(null); }}
                        className="text-xs"
                      >
                        Ce mois
                      </Button>
                      <Button
                        variant="outline" size="icon"
                        onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setDetailDay(null); }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Présent / Excusé
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent / Retard
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Offset for first day of month */}
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`e-${i}`} />
                    ))}

                    {allDays.map(day => {
                      const dateStr   = format(day, "yyyy-MM-dd");
                      const rec       = attendanceMap[dateStr];
                      const isSelDay  = detailDay === dateStr;
                      const today     = isToday(day);
                      const hasAlert  = isAlertRec(rec);
                      const hasGood   = isGoodRec(rec);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => rec ? setDetailDay(isSelDay ? null : dateStr) : undefined}
                          className={`
                            flex flex-col items-center justify-start pt-1.5 pb-2 rounded-lg
                            transition-all min-h-[52px]
                            ${isSelDay ? "ring-2 ring-indigo-400 bg-indigo-50" : ""}
                            ${rec && !isSelDay ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}
                            ${today ? "bg-indigo-50" : ""}
                          `}
                        >
                          <span className={`text-sm leading-none
                            ${today ? "font-bold text-indigo-600" : "text-slate-700"}
                          `}>
                            {format(day, "d")}
                          </span>
                          <div className="mt-1.5">
                            {hasAlert && (
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            )}
                            {hasGood && (
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Detail panel (click on a day) ───────────────────── */}
                  {detailDay && detailRecord && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-800 capitalize">
                            {format(parseISO(detailDay), "EEEE d MMMM yyyy", { locale: fr })}
                          </p>
                          <p className="text-sm text-slate-500">
                            {selectedChild?.first_name} {selectedChild?.last_name}
                          </p>
                        </div>
                        <button
                          onClick={() => setDetailDay(null)}
                          className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const cfg  = STATUS_CONFIG[detailRecord.status];
                          const Icon = cfg?.icon;
                          return cfg ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${cfg.color}`}>
                              <Icon className="w-4 h-4" />
                              {cfg.label}
                            </span>
                          ) : null;
                        })()}

                        {childClass && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {childClass.name}
                          </span>
                        )}
                      </div>

                      {detailRecord.comment && (
                        <p className="mt-3 text-sm text-slate-600">
                          <span className="font-medium">Commentaire :</span> {detailRecord.comment}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Monthly summary stats ──────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const Icon  = cfg.icon;
                  const count = monthAttendance.filter(a => a.status === key).length;
                  return (
                    <Card key={key} className="border shadow-sm">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{cfg.label}s</p>
                          <p className="text-lg font-bold leading-none mt-0.5">{count}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Admin / Teacher view ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
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
          <div className="flex items-end gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
            <NotifyParentButton
              eventType="absence"
              students={students
                .filter(s => ["absent", "late"].includes(attendanceData[s.id]?.status))
                .map(s => ({
                  ...s,
                  class_name: classes.find(c => c.id === selectedClass)?.name || "",
                }))}
              variables={{
                date: format(new Date(selectedDate), "dd/MM/yyyy"),
                status: "absent/retard",
              }}
              label="Notifier parents"
            />
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
