import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export default function Schedule() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    class_id: "",
    subject_id: "",
    teacher_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    room: "",
  });

  const queryClient = useQueryClient();

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => base44.entities.Schedule.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

  const filteredSchedules = selectedClass
    ? schedules.filter((s) => s.class_id === selectedClass)
    : [];

  const getScheduleForSlot = (day, hour) => {
    return filteredSchedules.find(
      (s) => s.day_of_week === day && s.start_time === hour
    );
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

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        description="Gérez les horaires de cours"
        action={() => {
          setFormData({
            class_id: selectedClass,
            subject_id: "",
            teacher_id: "",
            day_of_week: "",
            start_time: "",
            end_time: "",
            room: "",
          });
          setFormOpen(true);
        }}
        actionLabel="Ajouter un cours"
      />

      {/* Class Selector */}
      <div className="mb-6">
        <Label className="mb-2 block">Sélectionner une classe</Label>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choisir une classe" />
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

      {selectedClass ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Emploi du temps - {classes.find((c) => c.id === selectedClass)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-7 gap-1">
                {/* Header */}
                <div className="p-2 font-semibold text-center bg-slate-100 rounded-lg">
                  Heure
                </div>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="p-2 font-semibold text-center bg-slate-100 rounded-lg"
                  >
                    {day}
                  </div>
                ))}

                {/* Time slots */}
                {HOURS.map((hour) => (
                  <React.Fragment key={hour}>
                    <div className="p-2 text-sm text-center bg-slate-50 rounded-lg font-medium">
                      {hour}
                    </div>
                    {DAYS.map((day) => {
                      const schedule = getScheduleForSlot(day, hour);
                      const subject = schedule ? subjectMap[schedule.subject_id] : null;
                      const teacher = schedule ? teacherMap[schedule.teacher_id] : null;

                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={cn(
                            "p-2 rounded-lg min-h-[60px] text-xs relative group",
                            schedule
                              ? "text-white"
                              : "bg-slate-50 hover:bg-slate-100"
                          )}
                          style={{
                            backgroundColor: schedule ? subject?.color || "#3B82F6" : undefined,
                          }}
                        >
                          {schedule ? (
                            <>
                              <p className="font-semibold">{subject?.name}</p>
                              <p className="opacity-80">
                                {teacher?.first_name} {teacher?.last_name?.[0]}.
                              </p>
                              {schedule.room && (
                                <p className="opacity-70">Salle {schedule.room}</p>
                              )}
                              <button
                                onClick={() => handleDelete(schedule.id)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white/20 hover:bg-white/40"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
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
            <p className="text-slate-500">
              Sélectionnez une classe pour afficher son emploi du temps
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un cours</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Classe *</Label>
              <Select
                value={formData.class_id}
                onValueChange={(value) => setFormData({ ...formData, class_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Matière *</Label>
              <Select
                value={formData.subject_id}
                onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Enseignant *</Label>
              <Select
                value={formData.teacher_id}
                onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Jour *</Label>
              <Select
                value={formData.day_of_week}
                onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure début *</Label>
                <Select
                  value={formData.start_time}
                  onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heure fin *</Label>
                <Select
                  value={formData.end_time}
                  onValueChange={(value) => setFormData({ ...formData, end_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Salle</Label>
              <Input
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="Ex: A101"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}