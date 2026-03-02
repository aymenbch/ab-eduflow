import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar, MapPin, Clock, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

const EVENT_TYPES = {
  holiday: { label: "Vacances", color: "bg-green-100 text-green-800" },
  meeting: { label: "Réunion", color: "bg-blue-100 text-blue-800" },
  exam_period: { label: "Période d'examens", color: "bg-purple-100 text-purple-800" },
  event: { label: "Événement", color: "bg-orange-100 text-orange-800" },
  trip: { label: "Sortie scolaire", color: "bg-cyan-100 text-cyan-800" },
  other: { label: "Autre", color: "bg-slate-100 text-slate-800" },
};

const AUDIENCES = {
  all: "Tous",
  teachers: "Enseignants",
  students: "Élèves",
  parents: "Parents",
  staff: "Personnel",
};

export default function Events() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    type: "event",
    target_audience: "all",
    location: "",
  });

  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  const handleNew = () => {
    setSelectedEvent(null);
    setFormData({
      title: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      start_time: "",
      end_time: "",
      type: "event",
      target_audience: "all",
      location: "",
    });
    setFormOpen(true);
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title || "",
      description: event.description || "",
      date: event.date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      type: event.type || "event",
      target_audience: event.target_audience || "all",
      location: event.location || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (selectedEvent) {
      await base44.entities.Event.update(selectedEvent.id, formData);
    } else {
      await base44.entities.Event.create(formData);
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["events"] });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (eventToDelete) {
      await base44.entities.Event.delete(eventToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const getEventsForDay = (day) => {
    return events.filter((e) => e.date && isSameDay(new Date(e.date), day));
  };

  const upcomingEvents = events
    .filter((e) => e.date && new Date(e.date) >= new Date())
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Événements & Calendrier"
        description="Gérez les événements de l'établissement"
        action={handleNew}
        actionLabel="Nouvel événement"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {format(currentMonth, "MMMM yyyy", { locale: fr })}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))
                  }
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))
                  }
                >
                  →
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-semibold text-slate-500">
                  {day}
                </div>
              ))}
              
              {/* Add empty cells for days before month start */}
              {Array((monthStart.getDay() + 6) % 7)
                .fill(null)
                .map((_, i) => (
                  <div key={`empty-${i}`} className="p-2" />
                ))}

              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={day.toString()}
                    className={`min-h-[80px] p-2 rounded-lg border ${
                      isCurrentDay
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        isCurrentDay ? "text-blue-600" : "text-slate-700"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer ${
                            EVENT_TYPES[event.type]?.color || "bg-slate-100"
                          }`}
                          onClick={() => handleEdit(event)}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-xs text-slate-500">
                          +{dayEvents.length - 2} autres
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming events */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-4">Prochains événements</h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Aucun événement à venir</p>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                    onClick={() => handleEdit(event)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Badge className={EVENT_TYPES[event.type]?.color}>
                          {EVENT_TYPES[event.type]?.label}
                        </Badge>
                        <h3 className="font-semibold mt-2">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                          <Calendar className="w-4 h-4" />
                          {event.date &&
                            format(new Date(event.date), "d MMMM yyyy", { locale: fr })}
                        </div>
                        {event.start_time && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            {event.start_time}
                            {event.end_time && ` - ${event.end_time}`}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(event)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setEventToDelete(event);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? "Modifier l'événement" : "Nouvel événement"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Public cible</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Heure début</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Heure fin</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lieu</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Salle polyvalente"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedEvent ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet événement ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}