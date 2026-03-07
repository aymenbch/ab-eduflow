import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, addWeeks, subWeeks, getISOWeek, getYear } from "date-fns";
import { fr } from "date-fns/locale";
import DeclareEventModal from "@/components/schedule/DeclareEventModal";
import { useTeacherProfile } from "@/components/teachers/useTeacherProfile";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const EVENT_LABELS = {
  cours_annule:       { label: "Annulé",          color: "bg-red-500" },
  cours_reporte:      { label: "Reporté",          color: "bg-orange-500" },
  prof_absent:        { label: "Prof absent",      color: "bg-yellow-500" },
  salle_indisponible: { label: "Salle indispo",    color: "bg-purple-500" },
  force_majeure:      { label: "Force majeure",    color: "bg-slate-500" },
  greve:              { label: "Grève",            color: "bg-rose-500" },
  sortie_scolaire:    { label: "Sortie scolaire",  color: "bg-blue-500" },
  rattrappage:        { label: "Rattrapage",       color: "bg-green-500" },
  autre:              { label: "Autre",            color: "bg-gray-500" },
};

// Roles allowed to declare events
const CAN_DECLARE_ROLES = ["admin_systeme", "directeur_general", "directeur_college", "directeur_lycee", "cpe", "enseignant", "secretaire"];

function getCurrentSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export default function Schedule() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedScheduleForEvent, setSelectedScheduleForEvent] = useState(null);
  const [viewMode, setViewMode] = useState("week"); // "week" | "list"
  const [formData, setFormData] = useState({
    class_id: "", subject_id: "", teacher_id: "",
    day_of_week: "", start_time: "", end_time: "", room: "",
  });

  const currentRole = localStorage.getItem("edugest_role");
  const canDeclare = CAN_DECLARE_ROLES.includes(currentRole);
  const { mySubjectIds, isTeacherRole } = useTeacherProfile();
  const { isStudent, myStudent } = useCurrentMember();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));
  const weekNumber = getISOWeek(currentWeek);
  const schoolYear = getCurrentSchoolYear();

  const { data: schedules = [] } = useQuery({ queryKey: ["schedules"], queryFn: () => base44.entities.Schedule.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => base44.entities.Class.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => base44.entities.Subject.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: scheduleEvents = [] } = useQuery({ queryKey: ["schedule-events"], queryFn: () => base44.entities.ScheduleEvent.list() });

  // Auto-select student's class
  React.useEffect(() => {
    if (isStudent && myStudent?.class_id && !selectedClass) {
      setSelectedClass(myStudent.class_id);
    }
  }, [isStudent, myStudent]);

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

  const filteredSchedules = selectedClass
    ? schedules.filter(s => {
        if (!isTeacherRole) return s.class_id === selectedClass;
        return s.class_id === selectedClass && mySubjectIds.includes(s.subject_id);
      })
    : [];

  const getScheduleForSlot = (day, hour) =>
    filteredSchedules.find(s => s.day_of_week === day && s.start_time === hour);

  const getEventForSlot = (scheduleId, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return scheduleEvents.find(e => e.schedule_id === scheduleId && e.event_date === dateStr && e.status === "active");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Schedule.create(formData);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
    setFormOpen(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Schedule.delete(id);
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  };

  const openEventModal = (schedule) => {
    setSelectedScheduleForEvent(schedule);
    setEventModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        description="Gérez les horaires de cours"
        action={() => {
          setFormData({ class_id: selectedClass, subject_id: "", teacher_id: "", day_of_week: "", start_time: "", end_time: "", room: "" });
          setFormOpen(true);
        }}
        actionLabel="Ajouter un cours"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <Label className="mb-1 block text-xs text-slate-500">Classe</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} - {c.level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-xs text-slate-500 mr-2">
            <span className="font-semibold text-slate-700">Année scolaire {schoolYear}</span>
            <span className="mx-2">•</span>
            Semaine {weekNumber}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week range display */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-blue-500" />
        <span className="text-sm text-slate-600">
          Semaine du{" "}
          <span className="font-semibold text-slate-800">
            {format(weekDates[0], "d MMMM", { locale: fr })}
          </span>
          {" "}au{" "}
          <span className="font-semibold text-slate-800">
            {format(weekDates[4], "d MMMM yyyy", { locale: fr })}
          </span>
        </span>
      </div>

      {selectedClass ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Emploi du temps – {classes.find(c => c.id === selectedClass)?.name}</span>
              {canDeclare && (
                <span className="text-xs font-normal text-slate-500">
                  Cliquez sur un cours pour déclarer un événement
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-7 gap-1">
                {/* Header with dates */}
                <div className="p-2 font-semibold text-center bg-slate-100 rounded-lg text-sm">Heure</div>
                {DAYS.map((day, i) => {
                  const date = weekDates[i];
                  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <div key={day} className={cn(
                      "p-2 text-center rounded-lg",
                      isToday ? "bg-blue-600 text-white" : "bg-slate-100"
                    )}>
                      <p className="font-semibold text-sm">{day}</p>
                      <p className={cn("text-xs", isToday ? "text-blue-100" : "text-slate-500")}>
                        {format(date, "d MMM", { locale: fr })}
                      </p>
                    </div>
                  );
                })}

                {/* Time slots */}
                {HOURS.map(hour => (
                  <React.Fragment key={hour}>
                    <div className="p-2 text-sm text-center bg-slate-50 rounded-lg font-medium text-slate-600">{hour}</div>
                    {DAYS.map((day, i) => {
                      const schedule = getScheduleForSlot(day, hour);
                      const subject = schedule ? subjectMap[schedule.subject_id] : null;
                      const teacher = schedule ? teacherMap[schedule.teacher_id] : null;
                      const date = weekDates[i];
                      const event = schedule ? getEventForSlot(schedule.id, date) : null;
                      const eventInfo = event ? EVENT_LABELS[event.event_type] : null;

                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={cn(
                            "p-2 rounded-lg min-h-[64px] text-xs relative group cursor-default",
                            schedule ? "text-white" : "bg-slate-50 hover:bg-slate-100",
                            event ? "opacity-80" : ""
                          )}
                          style={{ backgroundColor: schedule ? (event ? "#111827" : (subject?.color || "#3B82F6")) : undefined }}
                        >
                          {schedule ? (
                            <>
                              {event && (
                                <div className="mb-1 flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-orange-300">⚠</span>
                                  <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wide">{eventInfo?.label}</span>
                                </div>
                              )}
                              <div>
                                <p className="font-semibold truncate">{subject?.name}</p>
                                <p className="opacity-80">{teacher?.first_name} {teacher?.last_name?.[0]}.</p>
                                {schedule.room && <p className="opacity-70">Salle {schedule.room}</p>}
                              </div>
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canDeclare && (
                                  <button
                                    onClick={() => openEventModal(schedule)}
                                    className="p-1 rounded bg-white/20 hover:bg-orange-500/80 transition-colors"
                                    title="Déclarer un événement"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(schedule.id)}
                                  className="p-1 rounded bg-white/20 hover:bg-white/40"
                                  title="Supprimer le cours"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Sélectionnez une classe pour afficher son emploi du temps</p>
          </CardContent>
        </Card>
      )}

      {/* Events list for the week */}
      {selectedClass && scheduleEvents.filter(e => {
        const wd = weekDates.map(d => format(d, "yyyy-MM-dd"));
        return wd.includes(e.event_date) && e.class_id === selectedClass && e.status === "active";
      }).length > 0 && (
        <Card className="mt-4 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Événements déclarés cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scheduleEvents.filter(e => {
                const wd = weekDates.map(d => format(d, "yyyy-MM-dd"));
                return wd.includes(e.event_date) && e.class_id === selectedClass && e.status === "active";
              }).map(event => {
                const ei = EVENT_LABELS[event.event_type];
                const sub = subjectMap[event.subject_id];
                const tch = teacherMap[event.teacher_id];
                return (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <Badge className={`${ei?.color || "bg-gray-500"} text-white border-0 text-xs`}>{ei?.label}</Badge>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{sub?.name || "Cours"} • {event.start_time} – {event.end_time}</p>
                      <p className="text-slate-500 text-xs">
                        {format(new Date(event.event_date), "EEEE d MMMM yyyy", { locale: fr })}
                        {tch && ` • ${tch.first_name} ${tch.last_name}`}
                      </p>
                      {event.description && <p className="text-slate-600 text-xs mt-1">{event.description}</p>}
                      {event.replacement_date && (
                        <p className="text-green-700 text-xs mt-1">
                          🔄 Reporté au {format(new Date(event.replacement_date), "d MMM", { locale: fr })} {event.replacement_time && `à ${event.replacement_time}`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{event.declared_by}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add course dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un cours</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Classe *</Label>
              <Select value={formData.class_id} onValueChange={v => setFormData({ ...formData, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matière *</Label>
              <Select value={formData.subject_id} onValueChange={v => setFormData({ ...formData, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Enseignant *</Label>
              <Select value={formData.teacher_id} onValueChange={v => setFormData({ ...formData, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jour *</Label>
              <Select value={formData.day_of_week} onValueChange={v => setFormData({ ...formData, day_of_week: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{DAYS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure début *</Label>
                <Select value={formData.start_time} onValueChange={v => setFormData({ ...formData, start_time: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heure fin *</Label>
                <Select value={formData.end_time} onValueChange={v => setFormData({ ...formData, end_time: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Salle</Label>
              <Input value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} placeholder="Ex: A101" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event declaration modal */}
      {selectedScheduleForEvent && (
        <DeclareEventModal
          open={eventModalOpen}
          onClose={() => { setEventModalOpen(false); setSelectedScheduleForEvent(null); }}
          schedule={selectedScheduleForEvent}
          subject={subjectMap[selectedScheduleForEvent.subject_id]}
          teacher={teacherMap[selectedScheduleForEvent.teacher_id]}
          currentRole={currentRole}
        />
      )}
    </div>
  );
}