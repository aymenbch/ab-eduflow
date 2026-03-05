import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { AlertTriangle, Calendar } from "lucide-react";

const EVENT_TYPES = [
  { value: "cours_annule",       label: "🚫 Cours annulé",          color: "bg-red-100 text-red-700" },
  { value: "cours_reporte",      label: "📅 Cours reporté",          color: "bg-orange-100 text-orange-700" },
  { value: "prof_absent",        label: "🤒 Professeur absent",      color: "bg-yellow-100 text-yellow-700" },
  { value: "salle_indisponible", label: "🚪 Salle indisponible",     color: "bg-purple-100 text-purple-700" },
  { value: "force_majeure",      label: "⚡ Force majeure",          color: "bg-slate-100 text-slate-700" },
  { value: "greve",              label: "✊ Grève",                  color: "bg-rose-100 text-rose-700" },
  { value: "sortie_scolaire",    label: "🚌 Sortie scolaire",        color: "bg-blue-100 text-blue-700" },
  { value: "rattrappage",        label: "🔄 Cours de rattrapage",    color: "bg-green-100 text-green-700" },
  { value: "autre",              label: "📌 Autre",                  color: "bg-gray-100 text-gray-700" },
];

export default function DeclareEventModal({ open, onClose, schedule, subject, teacher, currentRole }) {
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [replacementDate, setReplacementDate] = useState("");
  const [replacementTime, setReplacementTime] = useState("");
  const [replacementRoom, setReplacementRoom] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduleEvent.create(data),
    onSuccess: () => {
      qc.invalidateQueries(["schedule-events"]);
      toast.success("Événement déclaré avec succès");
      handleClose();
    }
  });

  const handleClose = () => {
    setEventType(""); setEventDate(new Date().toISOString().split("T")[0]);
    setDescription(""); setReplacementDate(""); setReplacementTime(""); setReplacementRoom("");
    onClose();
  };

  const handleSubmit = () => {
    if (!eventType || !eventDate) return;
    mutation.mutate({
      schedule_id: schedule.id,
      class_id: schedule.class_id,
      subject_id: schedule.subject_id,
      teacher_id: schedule.teacher_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      event_type: eventType,
      event_date: eventDate,
      description,
      declared_by: currentRole,
      replacement_date: replacementDate || undefined,
      replacement_time: replacementTime || undefined,
      replacement_room: replacementRoom || undefined,
      status: "active",
    });
  };

  const selectedType = EVENT_TYPES.find(t => t.value === eventType);
  const isReported = eventType === "cours_reporte";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Déclarer un événement
          </DialogTitle>
        </DialogHeader>

        {/* Course info */}
        {schedule && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-semibold text-slate-800">{subject?.name || "Cours"}</p>
            <p className="text-slate-500">{schedule.day_of_week} • {schedule.start_time} – {schedule.end_time}</p>
            {teacher && <p className="text-slate-500">Prof : {teacher.first_name} {teacher.last_name}</p>}
            {schedule.room && <p className="text-slate-500">Salle : {schedule.room}</p>}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>Type d'événement *</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType && (
            <div className={`text-xs px-3 py-2 rounded-lg ${selectedType.color}`}>
              {selectedType.label}
            </div>
          )}

          <div>
            <Label>Date concernée *</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="mt-1" />
          </div>

          {isReported && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Informations de report
              </p>
              <div>
                <Label className="text-xs">Date de remplacement</Label>
                <Input type="date" value={replacementDate} onChange={e => setReplacementDate(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Heure</Label>
                  <Input type="time" value={replacementTime} onChange={e => setReplacementTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Salle</Label>
                  <Input value={replacementRoom} onChange={e => setReplacementRoom(e.target.value)} placeholder="Ex: B205" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Commentaire / Détail</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Précisions supplémentaires..." className="mt-1" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={handleClose}>Annuler</Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={handleSubmit}
            disabled={!eventType || !eventDate || mutation.isPending}
          >
            {mutation.isPending ? "Enregistrement..." : "Déclarer l'événement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}