import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  MoreVertical, Pencil, Trash2, Calendar, MapPin, Clock, Loader2,
  ChevronLeft, ChevronRight, Users,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, isSameDay, addMonths, subMonths, getDay, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";

const EVENT_TYPES = {
  holiday:    { label: "Vacances",           color: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-500"  },
  meeting:    { label: "Réunion",            color: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-500"   },
  exam_period:{ label: "Période d'examens",  color: "bg-purple-100 text-purple-800 border-purple-200",dot: "bg-purple-500" },
  event:      { label: "Événement",          color: "bg-orange-100 text-orange-800 border-orange-200",dot: "bg-orange-500" },
  trip:       { label: "Sortie scolaire",    color: "bg-cyan-100 text-cyan-800 border-cyan-200",      dot: "bg-cyan-500"   },
  other:      { label: "Autre",              color: "bg-slate-100 text-slate-800 border-slate-200",   dot: "bg-slate-400"  },
};

const AUDIENCES = {
  all:      "Tous",
  teachers: "Enseignants",
  students: "Élèves",
  parents:  "Parents",
  staff:    "Personnel",
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Events() {
  // ── Admin states ───────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]           = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [saving, setSaving]               = useState(false);
  const [formData, setFormData]           = useState({
    title: "", description: "", date: "", start_time: "", end_time: "",
    type: "event", target_audience: "all", location: "",
  });

  // ── Shared: month navigation + detail day (used in both views) ─────────────
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailDay, setDetailDay]       = useState(null);

  const queryClient = useQueryClient();
  const { isParent } = useCurrentMember();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = (getDay(monthStart) + 6) % 7;

  const getEventsForDay = (day) =>
    events.filter((e) => e.date && isSameDay(new Date(e.date), day));

  // ── Admin handlers ─────────────────────────────────────────────────────────
  const handleNew = () => {
    setSelectedEvent(null);
    setFormData({
      title: "", description: "",
      date: new Date().toISOString().split("T")[0],
      start_time: "", end_time: "", type: "event", target_audience: "all", location: "",
    });
    setFormOpen(true);
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title || "", description: event.description || "",
      date: event.date || "", start_time: event.start_time || "",
      end_time: event.end_time || "", type: event.type || "event",
      target_audience: event.target_audience || "all", location: event.location || "",
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── Parent view ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isParent) {
    // Filter events relevant to parents: all, parents, students
    const parentEvents = events.filter(e =>
      !e.target_audience ||
      ["all", "parents", "students"].includes(e.target_audience)
    );

    const getParentEventsForDay = (day) =>
      parentEvents.filter((e) => e.date && isSameDay(new Date(e.date), day));

    const upcomingEvents = parentEvents
      .filter((e) => e.date && new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 6);

    const detailEvents = detailDay
      ? getParentEventsForDay(new Date(detailDay))
      : [];

    return (
      <div>
        <PageHeader
          title="Événements & Calendrier"
          description="Calendrier des événements de l'établissement"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main calendar ─────────────────────────────────────────────── */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
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
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </div>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}

                {daysInMonth.map((day) => {
                  const dateStr  = format(day, "yyyy-MM-dd");
                  const dayEvts  = getParentEventsForDay(day);
                  const isSelDay = detailDay === dateStr;
                  const today    = isToday(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => dayEvts.length ? setDetailDay(isSelDay ? null : dateStr) : undefined}
                      className={`
                        flex flex-col items-center justify-start pt-1.5 pb-2 rounded-lg
                        transition-all min-h-[56px]
                        ${isSelDay ? "ring-2 ring-blue-400 bg-blue-50" : ""}
                        ${dayEvts.length && !isSelDay ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}
                        ${today && !isSelDay ? "bg-blue-50" : ""}
                      `}
                    >
                      <span className={`text-sm leading-none ${today ? "font-bold text-blue-600" : "text-slate-700"}`}>
                        {format(day, "d")}
                      </span>
                      {/* Show up to 3 colored dots for events */}
                      {dayEvts.length > 0 && (
                        <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center max-w-[32px]">
                          {dayEvts.slice(0, 3).map((ev, i) => {
                            const dotCls = EVENT_TYPES[ev.type]?.dot || "bg-slate-400";
                            return <div key={i} className={`w-2 h-2 rounded-full ${dotCls}`} />;
                          })}
                          {dayEvts.length > 3 && (
                            <span className="text-[9px] text-slate-400 leading-none">+{dayEvts.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Detail panel */}
              {detailDay && detailEvents.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-semibold text-slate-800 capitalize">
                      {format(parseISO(detailDay), "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                    <button
                      onClick={() => setDetailDay(null)}
                      className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                    >×</button>
                  </div>
                  <div className="space-y-3">
                    {detailEvents.map((ev) => {
                      const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                      return (
                        <div key={ev.id} className="p-3 rounded-lg bg-white border border-slate-200">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {ev.target_audience && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">
                                <Users className="w-3 h-3" />
                                {AUDIENCES[ev.target_audience] || ev.target_audience}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-800">{ev.title}</p>
                          {ev.description && (
                            <p className="text-sm text-slate-600 mt-1">{ev.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {(ev.start_time || ev.end_time) && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {ev.start_time}{ev.end_time && ` – ${ev.end_time}`}
                              </p>
                            )}
                            {ev.location && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {ev.location}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Upcoming events list ───────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prochains événements</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-slate-500 text-center py-4 text-sm">Aucun événement à venir</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => {
                    const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => {
                          if (ev.date) {
                            const d = ev.date.slice(0, 10);
                            setCurrentMonth(new Date(d));
                            setDetailDay(d);
                          }
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-slate-800">{ev.title}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(ev.date), "d MMMM yyyy", { locale: fr })}
                        </div>
                        {ev.start_time && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {ev.start_time}{ev.end_time && ` – ${ev.end_time}`}
                          </div>
                        )}
                        {ev.location && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Admin / Teacher view (unchanged) ─────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
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
                  variant="outline" size="sm"
                  onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                >←</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >Aujourd'hui</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                >→</Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="p-2 text-center text-sm font-semibold text-slate-500">
                  {day}
                </div>
              ))}

              {Array(startOffset).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}

              {daysInMonth.map((day) => {
                const dayEvents    = getEventsForDay(day);
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
                    <span className={`text-sm font-medium ${isCurrentDay ? "text-blue-600" : "text-slate-700"}`}>
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
                        <span className="text-xs text-slate-500">+{dayEvents.length - 2} autres</span>
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
                          {event.date && format(new Date(event.date), "d MMMM yyyy", { locale: fr })}
                        </div>
                        {event.start_time && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            {event.start_time}{event.end_time && ` - ${event.end_time}`}
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
                            variant="ghost" size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(event)}>
                            <Pencil className="w-4 h-4 mr-2" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => { setEventToDelete(event); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />Supprimer
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
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
