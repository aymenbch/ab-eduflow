import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Trash2, AlertTriangle, ChevronLeft, ChevronRight,
  Calendar, Edit2, Send, EyeOff, Users, BookOpen, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import DeclareEventModal from "@/components/schedule/DeclareEventModal";
import { useTeacherProfile } from "@/components/teachers/useTeacherProfile";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";
import { useFilteredSubjects } from "@/hooks/useFilteredSubjects";
import { getSession } from "@/components/auth/appAuth";

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const GRID_START = 7;  // 07:00
const GRID_END   = 19; // 19:00 (exclusive)
const SLOT_H     = 64; // px per hour

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = GRID_START; h <= GRID_END; h++) {
    opts.push(`${String(h).padStart(2, "0")}:00`);
    if (h < GRID_END) opts.push(`${String(h).padStart(2, "0")}:30`);
  }
  return opts;
})();

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

const CAN_DECLARE_ROLES = [
  "admin_systeme", "directeur_general", "directeur_college",
  "directeur_lycee", "cpe", "enseignant", "secretaire",
];
const CAN_EDIT_ROLES = [
  "admin_systeme", "directeur_general", "directeur_primaire",
  "directeur_college", "directeur_lycee", "secretaire",
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getCurrentSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function timeMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timeToTop(t) {
  return ((timeMins(t) - GRID_START * 60) / 60) * SLOT_H;
}

function timeToDuration(start, end) {
  return ((timeMins(end) - timeMins(start)) / 60) * SLOT_H;
}

function overlaps(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

/**
 * Optimistic client-side check for instant real-time UX feedback.
 * Identical rules to the backend endpoint `checkScheduleConflicts`.
 * The backend runs the authoritative check before any save — this is for UX only.
 */
function detectConflicts(formData, allSchedules, maps, editingId = null) {
  const { teacherMap, classMap, subjectMap, roomMap } = maps;
  const errors = [];
  const warnings = [];

  const { day_of_week, start_time, end_time, teacher_id, class_id, room_id, subject_id } = formData;
  if (!day_of_week || !start_time || !end_time) return { errors, warnings };
  if (start_time >= end_time) {
    errors.push("L'heure de fin doit être postérieure à l'heure de début.");
    return { errors, warnings };
  }

  const conflicting = allSchedules.filter(
    s => s.day_of_week === day_of_week
      && s.id !== editingId
      && overlaps(start_time, end_time, s.start_time, s.end_time)
  );

  // RG-EDT-01 : enseignant déjà occupé
  if (teacher_id) {
    const c = conflicting.find(s => s.teacher_id === teacher_id);
    if (c) {
      const t = teacherMap[teacher_id];
      const cl = classMap[c.class_id];
      errors.push(`RG-EDT-01 : ${t?.first_name} ${t?.last_name} est déjà en cours (${cl?.name || ""}) de ${c.start_time} à ${c.end_time}`);
    }
  }

  // RG-EDT-02 : classe déjà en cours
  if (class_id) {
    const c = conflicting.find(s => s.class_id === class_id);
    if (c) {
      const sub = subjectMap[c.subject_id];
      errors.push(`RG-EDT-02 : Cette classe a déjà ${sub?.name || "un cours"} de ${c.start_time} à ${c.end_time}`);
    }
  }

  // RG-EDT-03 : salle déjà occupée
  if (room_id) {
    const c = conflicting.find(s => s.room_id === room_id);
    if (c) {
      const r = roomMap[c.room_id];
      errors.push(`RG-EDT-03 : La salle "${r?.name || ""}" est déjà occupée de ${c.start_time} à ${c.end_time}`);
    }
  }

  // RG-EDT-04 : capacité salle insuffisante
  if (room_id && class_id) {
    const room = roomMap[room_id];
    const cls  = classMap[class_id];
    if (room?.capacity && cls?.capacity && cls.capacity > room.capacity) {
      errors.push(`RG-EDT-04 : La salle "${room.name}" (${room.capacity} places) est insuffisante pour la classe (${cls.capacity} élèves)`);
    }
  }

  // RG-MAT-04 : enseignant non accrédité (warning)
  if (teacher_id && subject_id) {
    const t = teacherMap[teacher_id];
    if (t) {
      let sids = [];
      try { sids = JSON.parse(t.subject_ids || "[]"); } catch {}
      if (sids.length > 0 && !sids.includes(subject_id)) {
        warnings.push(`RG-MAT-04 : ${t.first_name} ${t.last_name} n'est pas accrédité(e) pour cette matière`);
      }
    }
  }

  // RG-EDT-06 : adéquation salle/matière (warning)
  if (room_id && subject_id) {
    const room    = roomMap[room_id];
    const subject = subjectMap[subject_id];
    if (room && subject) {
      if (["sciences"].includes(subject.category) && room.type === "classroom") {
        warnings.push(`RG-EDT-06 : La matière "${subject.name}" (sciences) devrait être dans un laboratoire`);
      } else if (subject.category === "informatique" && room.type !== "lab_info") {
        warnings.push(`RG-EDT-06 : La matière "${subject.name}" devrait être dans une salle informatique`);
      } else if (subject.category === "sports" && !["gym", "sports_field"].includes(room.type)) {
        warnings.push(`RG-EDT-06 : La matière "${subject.name}" (EPS) devrait être dans un espace sportif`);
      }
    }
  }

  return { errors, warnings };
}

// Valeurs par défaut du formulaire — hors du composant pour une référence stable
// (évite les re-créations inutiles et les dépendances fantômes dans les useEffect).
const EMPTY_SCHEDULE_FORM = {
  class_id: "", subject_id: "", teacher_id: "", room_id: "",
  day_of_week: "", start_time: "", end_time: "",
  status: "brouillon", school_year: getCurrentSchoolYear(),
};

// ── ScheduleFormDialog ─────────────────────────────────────────────────────
function ScheduleFormDialog({
  open, onClose, editingSchedule, classes, teachers, rooms,
  allSubjects, allClasses, allSchedules, onSave,
}) {

  const [formData, setFormData] = useState(EMPTY_SCHEDULE_FORM);
  const [saving, setSaving]     = useState(false);
  const [serverError, setServerError] = useState(null);

  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);
  const classMap   = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => Object.fromEntries(allSubjects.map(s => [s.id, s])), [allSubjects]);
  const roomMap    = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);

  // F1 : sujets filtrés par niveau de la classe sélectionnée
  const { subjects: filteredSubjects } = useFilteredSubjects({
    classId: formData.class_id || null,
    allSubjects,
    allClasses,
  });

  // Détection de conflits en temps réel
  const { errors: conflictErrors, warnings: conflictWarnings } = useMemo(
    () => detectConflicts(formData, allSchedules, { teacherMap, classMap, subjectMap, roomMap }, editingSchedule?.id),
    [formData, allSchedules, teacherMap, classMap, subjectMap, roomMap, editingSchedule]
  );

  useEffect(() => {
    setServerError(null);
    if (editingSchedule) {
      setFormData({
        class_id:    editingSchedule.class_id || "",
        subject_id:  editingSchedule.subject_id || "",
        teacher_id:  editingSchedule.teacher_id || "",
        room_id:     editingSchedule.room_id || "",
        day_of_week: editingSchedule.day_of_week || "",
        start_time:  editingSchedule.start_time || "",
        end_time:    editingSchedule.end_time || "",
        status:      editingSchedule.status || "brouillon",
        school_year: editingSchedule.school_year || getCurrentSchoolYear(),
      });
    } else {
      setFormData(EMPTY_SCHEDULE_FORM);
    }
  }, [editingSchedule, open]);

  const set = field => v => setFormData(prev => ({ ...prev, [field]: v }));

  // Tri enseignants : accrédités d'abord
  const sortedTeachers = useMemo(() => {
    if (!formData.subject_id) return teachers;
    return [...teachers].sort((a, b) => {
      const aIds = (() => { try { return JSON.parse(a.subject_ids || "[]"); } catch { return []; } })();
      const bIds = (() => { try { return JSON.parse(b.subject_ids || "[]"); } catch { return []; } })();
      const aOk = aIds.includes(formData.subject_id);
      const bOk = bIds.includes(formData.subject_id);
      return aOk === bOk ? 0 : aOk ? -1 : 1;
    });
  }, [teachers, formData.subject_id]);

  const selectedClass = classes.find(c => c.id === formData.class_id);
  const canSubmit = conflictErrors.length === 0
    && formData.class_id && formData.subject_id
    && formData.day_of_week && formData.start_time && formData.end_time;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError(null);
    setSaving(true);
    try {
      // La détection côté client (detectConflicts) gère le feedback en temps réel.
      // La validation autoritative est effectuée par le backend lors du create/update
      // (validateSchedule dans entities.js) — les erreurs 422 remontent ici.
      if (editingSchedule) {
        await base44.entities.Schedule.update(editingSchedule.id, formData);
      } else {
        await base44.entities.Schedule.create(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setServerError(err?.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSchedule ? "Modifier le cours" : "Ajouter un cours"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Erreur serveur */}
          {serverError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Erreurs de conflits (bloquantes) */}
          {conflictErrors.map((err, i) => (
            <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}

          {/* Avertissements (non bloquants) */}
          {conflictWarnings.map((w, i) => (
            <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}

          {/* Classe + Jour */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classe *</Label>
              <Select
                value={formData.class_id}
                onValueChange={v => setFormData(prev => ({ ...prev, class_id: v, subject_id: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.level && ` (${c.level})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jour *</Label>
              <Select value={formData.day_of_week} onValueChange={set("day_of_week")}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Matière (filtrée F1) */}
          <div className="space-y-1.5">
            <Label>
              Matière *
              {selectedClass?.level && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  filtrées pour {selectedClass.level}
                </span>
              )}
            </Label>
            <Select
              value={formData.subject_id}
              onValueChange={v => setFormData(prev => ({ ...prev, subject_id: v, teacher_id: "" }))}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {filteredSubjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: s.color || "#3B82F6" }}
                      />
                      {s.name}
                      {s.code && <span className="text-xs text-slate-400">({s.code})</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Enseignant (accrédités en premier) */}
          <div className="space-y-1.5">
            <Label>Enseignant</Label>
            <Select value={formData.teacher_id || "_none"} onValueChange={v => set("teacher_id")(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucun enseignant —</SelectItem>
                {sortedTeachers.map(t => {
                  let sids = [];
                  try { sids = JSON.parse(t.subject_ids || "[]"); } catch {}
                  const notAccredited = formData.subject_id && sids.length > 0 && !sids.includes(formData.subject_id);
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-1.5">
                        {notAccredited && <span className="text-amber-500" title="Non accrédité">⚠️</span>}
                        {t.first_name} {t.last_name}
                        {notAccredited && (
                          <span className="text-xs text-amber-600">(non habilité)</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heure de début *</Label>
              <Select value={formData.start_time} onValueChange={set("start_time")}>
                <SelectTrigger><SelectValue placeholder="HH:MM" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Heure de fin *</Label>
              <Select value={formData.end_time} onValueChange={set("end_time")}>
                <SelectTrigger><SelectValue placeholder="HH:MM" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS
                    .filter(t => !formData.start_time || t > formData.start_time)
                    .map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {formData.start_time && formData.end_time && formData.start_time < formData.end_time && (
            <p className="text-xs text-slate-400 -mt-2">
              Durée : {timeMins(formData.end_time) - timeMins(formData.start_time)} min
            </p>
          )}

          {/* Salle (liée à l'entité Room) */}
          <div className="space-y-1.5">
            <Label>Salle</Label>
            <Select
              value={formData.room_id || "_none"}
              onValueChange={v => set("room_id")(v === "_none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Aucune salle assignée" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucune salle —</SelectItem>
                {rooms.filter(r => r.status !== "inactive").map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      {r.name}
                      {r.capacity && (
                        <span className="text-xs text-slate-400">({r.capacity} places)</span>
                      )}
                      {r.building && (
                        <span className="text-xs text-slate-400">· {r.building}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Statut brouillon / publié */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {formData.status === "publie" ? "✅ Publié" : "📝 Brouillon"}
              </p>
              <p className="text-xs text-slate-400">
                {formData.status === "publie"
                  ? "Visible par les élèves, parents et enseignants"
                  : "Non visible — en cours de planification"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                status: prev.status === "publie" ? "brouillon" : "publie",
              }))}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                formData.status === "publie" ? "bg-green-500" : "bg-slate-300"
              )}
            >
              <span className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                formData.status === "publie" ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSchedule ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── DayColumn ──────────────────────────────────────────────────────────────
function DayColumn({
  schedules, subjectMap, teacherMap, roomMap, classMap,
  scheduleEvents, weekDate, canEdit, canDeclare, showClass,
  onEdit, onDelete, onDeclareEvent,
}) {
  const gridHeight = (GRID_END - GRID_START) * SLOT_H;
  const dateStr    = weekDate ? format(weekDate, "yyyy-MM-dd") : "";

  return (
    <div className="relative" style={{ height: gridHeight }}>
      {/* Lignes d'heures */}
      {Array.from({ length: GRID_END - GRID_START }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ top: i * SLOT_H }}
          />
          <div
            className="absolute left-0 right-0 border-t border-slate-50"
            style={{ top: i * SLOT_H + SLOT_H * 0.5, borderStyle: "dashed" }}
          />
        </React.Fragment>
      ))}

      {/* Cartes de cours */}
      {schedules.map(schedule => {
        const top     = timeToTop(schedule.start_time);
        const height  = Math.max(timeToDuration(schedule.start_time, schedule.end_time) - 3, 18);
        const subject = subjectMap[schedule.subject_id];
        const teacher = teacherMap[schedule.teacher_id];
        const room    = roomMap[schedule.room_id];
        const cls     = classMap[schedule.class_id];
        const event   = scheduleEvents.find(
          e => e.schedule_id === schedule.id && e.event_date === dateStr && e.status === "active"
        );
        const eventInfo = event ? EVENT_LABELS[event.event_type] : null;
        const isDraft   = schedule.status === "brouillon";
        const bgColor   = event ? "#1e293b" : (subject?.color || "#3B82F6");

        return (
          <div
            key={schedule.id}
            className={cn(
              "absolute left-1 right-1 rounded-lg overflow-hidden group cursor-pointer transition-shadow hover:shadow-lg",
              isDraft && "border-2 border-dashed border-white/50 opacity-75"
            )}
            style={{ top, height, backgroundColor: bgColor }}
            title={`${subject?.name} • ${schedule.start_time}–${schedule.end_time}${isDraft ? " (brouillon)" : ""}`}
          >
            <div className="p-1.5 h-full text-white text-xs overflow-hidden">
              {/* Badge DRAFT */}
              {isDraft && (
                <span className="text-[9px] bg-yellow-400/90 text-yellow-900 rounded px-1 py-0.5 font-bold leading-none">
                  DRAFT
                </span>
              )}
              {/* Badge événement */}
              {event && (
                <div className="flex items-center gap-0.5 mb-0.5">
                  <span className="text-[10px] font-bold text-orange-300">
                    ⚠ {eventInfo?.label}
                  </span>
                </div>
              )}
              <p className={cn("font-semibold truncate leading-tight", isDraft ? "mt-0.5" : "")}>
                {subject?.name || "?"}
              </p>
              {height > 46 && teacher && (
                <p className="opacity-80 truncate">
                  {teacher.first_name} {teacher.last_name?.[0]}.
                </p>
              )}
              {height > 60 && room && (
                <p className="opacity-70 truncate">🚪 {room.name}</p>
              )}
              {height > 60 && showClass && cls && (
                <p className="opacity-70 truncate">📚 {cls.name}</p>
              )}
              {height > 76 && (
                <p className="opacity-50 text-[10px]">
                  {schedule.start_time}–{schedule.end_time}
                </p>
              )}
            </div>

            {/* Overlay actions au survol */}
            {(canEdit || canDeclare) && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                {canEdit && (
                  <button
                    onClick={e => { e.stopPropagation(); onEdit(schedule); }}
                    className="p-1.5 bg-white/20 rounded hover:bg-blue-500/80 transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-3 h-3 text-white" />
                  </button>
                )}
                {canDeclare && (
                  <button
                    onClick={e => { e.stopPropagation(); onDeclareEvent(schedule); }}
                    className="p-1.5 bg-white/20 rounded hover:bg-orange-500/80 transition-colors"
                    title="Déclarer un événement"
                  >
                    <AlertTriangle className="w-3 h-3 text-white" />
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(schedule.id); }}
                    className="p-1.5 bg-white/20 rounded hover:bg-red-500/80 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── TimeGrid ──────────────────────────────────────────────────────────────
function TimeGrid({
  days, weekDates, getSchedulesForDay,
  subjectMap, teacherMap, roomMap, classMap,
  scheduleEvents, canEdit, canDeclare, showClass,
  onEdit, onDelete, onDeclareEvent,
}) {
  const gridHeight = (GRID_END - GRID_START) * SLOT_H;

  return (
    <div className="flex overflow-x-auto">
      {/* Colonne des heures */}
      <div className="flex-shrink-0 w-14 border-r border-slate-200 bg-slate-50">
        <div className="h-10 border-b border-slate-200" />
        <div className="relative" style={{ height: gridHeight }}>
          {Array.from({ length: GRID_END - GRID_START }, (_, i) => (
            <div
              key={i}
              className="absolute text-xs text-slate-400 font-medium"
              style={{ top: i * SLOT_H - 8, right: 6 }}
            >
              {String(GRID_START + i).padStart(2, "0")}h
            </div>
          ))}
        </div>
      </div>

      {/* Colonnes des jours */}
      {days.map((day, i) => {
        const date    = weekDates[i];
        const isToday = date && format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
        const daySchedules = getSchedulesForDay(day);

        return (
          <div key={day} className="flex-1 min-w-[130px] border-r border-slate-200 last:border-r-0">
            {/* En-tête du jour */}
            <div className={cn(
              "h-10 flex flex-col items-center justify-center border-b border-slate-200 px-1",
              isToday ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700"
            )}>
              <p className="text-xs font-semibold">{day}</p>
              {date && (
                <p className={cn("text-[10px]", isToday ? "text-blue-100" : "text-slate-400")}>
                  {format(date, "d MMM", { locale: fr })}
                </p>
              )}
            </div>

            <DayColumn
              schedules={daySchedules}
              subjectMap={subjectMap}
              teacherMap={teacherMap}
              roomMap={roomMap}
              classMap={classMap}
              scheduleEvents={scheduleEvents}
              weekDate={date}
              canEdit={canEdit}
              canDeclare={canDeclare}
              showClass={showClass}
              onEdit={onEdit}
              onDelete={onDelete}
              onDeclareEvent={onDeclareEvent}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────
export default function Schedule() {
  const [view, setView]               = useState("class"); // "class" | "teacher"
  const [selectedClass, setSelectedClass]     = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [formOpen, setFormOpen]       = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [eventModalOpen, setEventModalOpen]   = useState(false);
  const [selectedScheduleForEvent, setSelectedScheduleForEvent] = useState(null);

  const currentRole = localStorage.getItem("edugest_role");
  const canEdit    = CAN_EDIT_ROLES.includes(currentRole);
  const canDeclare = CAN_DECLARE_ROLES.includes(currentRole);
  const { mySubjectIds, isTeacherRole } = useTeacherProfile();
  const { isStudent, myStudent }        = useCurrentMember();
  const queryClient = useQueryClient();
  // ID du membre connecté (teacher ou student)
  const myMemberId = getSession()?.member_id || null;

  const weekStart  = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDates  = DAYS.map((_, i) => addDays(weekStart, i));
  const weekNumber = getISOWeek(currentWeek);
  const schoolYear = getCurrentSchoolYear();

  // ── Queries ──
  const { data: schedules = [] }      = useQuery({ queryKey: ["schedules"],       queryFn: () => base44.entities.Schedule.list() });
  const { data: classes = [] }        = useQuery({ queryKey: ["classes"],         queryFn: () => base44.entities.Class.list() });
  const { data: subjects = [] }       = useQuery({ queryKey: ["subjects"],        queryFn: () => base44.entities.Subject.list() });
  const { data: teachers = [] }       = useQuery({ queryKey: ["teachers"],        queryFn: () => base44.entities.Teacher.list() });
  const { data: rooms = [] }          = useQuery({ queryKey: ["rooms"],           queryFn: () => base44.entities.Room.list() });
  const { data: scheduleEvents = [] } = useQuery({ queryKey: ["schedule-events"], queryFn: () => base44.entities.ScheduleEvent.list() });

  // ── Maps ──
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);
  const classMap   = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c])), [classes]);
  const roomMap    = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);

  // Auto-sélections
  useEffect(() => {
    // Élève → forcer la sélection de sa propre classe (vue par classe)
    if (isStudent && myStudent?.class_id && !selectedClass) {
      setSelectedClass(myStudent.class_id);
    }
  }, [isStudent, myStudent]);

  useEffect(() => {
    // Enseignant → forcer la vue "par enseignant" et sélectionner son propre profil
    if (isTeacherRole) {
      setView("teacher");
      if (myMemberId && !selectedTeacher) {
        setSelectedTeacher(myMemberId);
      }
    }
  }, [isTeacherRole, myMemberId]);

  // ── Créneaux filtrés selon la vue ──
  const viewSchedules = useMemo(() => {
    if (view === "class" && selectedClass) {
      // Tout le monde voit toute la grille de la classe sélectionnée
      return schedules.filter(s => s.class_id === selectedClass);
    }
    if (view === "teacher" && selectedTeacher) {
      // Vue enseignant : toutes les classes où cet enseignant intervient
      // Le backend a déjà restreint les données selon le rôle
      // En vue "par enseignant" on affiche TOUS les cours de ses classes
      const myClassIds = [...new Set(
        schedules
          .filter(s => s.teacher_id === selectedTeacher)
          .map(s => s.class_id)
          .filter(Boolean)
      )];
      // Si l'utilisateur EST l'enseignant : on restreint aux classes où il enseigne
      // Si c'est un admin qui consulte un prof : on affiche uniquement ses propres cours
      if (isTeacherRole) {
        return schedules.filter(s => myClassIds.includes(s.class_id));
      }
      return schedules.filter(s => s.teacher_id === selectedTeacher);
    }
    return [];
  }, [schedules, view, selectedClass, selectedTeacher, isTeacherRole]);

  const getSchedulesForDay = useCallback(
    day => viewSchedules.filter(s => s.day_of_week === day),
    [viewSchedules]
  );

  // ── Stats brouillon / publié ──
  const classStats = useMemo(() => {
    const target = view === "class"
      ? schedules.filter(s => s.class_id === selectedClass)
      : schedules.filter(s => s.teacher_id === selectedTeacher);
    return {
      total:     target.length,
      published: target.filter(s => s.status === "publie").length,
      drafts:    target.filter(s => s.status === "brouillon").length,
    };
  }, [schedules, selectedClass, selectedTeacher, view]);

  // ── Handlers ──
  const handleEdit = useCallback(schedule => {
    if (!canEdit) return;
    setEditingSchedule(schedule);
    setFormOpen(true);
  }, [canEdit]);

  const handleDelete = useCallback(async id => {
    if (!canEdit) return;
    if (!confirm("Supprimer ce cours de l'emploi du temps ?")) return;
    await base44.entities.Schedule.delete(id);
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  }, [canEdit, queryClient]);

  const handleDeclareEvent = useCallback(schedule => {
    setSelectedScheduleForEvent(schedule);
    setEventModalOpen(true);
  }, []);

  const handlePublishAll = async () => {
    const target = schedules.filter(
      s => s.class_id === selectedClass && s.status === "brouillon"
    );
    if (!target.length) return;
    try {
      // 1 requête batch au lieu de N updates individuels
      await base44.functions.invoke('bulkUpdateScheduleStatus', {
        ids: target.map(s => s.id),
        status: 'publie',
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (err) {
      console.error('[handlePublishAll] Erreur lors de la publication :', err?.message);
    }
  };

  const handleUnpublishAll = async () => {
    const target = schedules.filter(
      s => s.class_id === selectedClass && s.status === "publie"
    );
    if (!target.length) return;
    try {
      // 1 requête batch au lieu de N updates individuels
      await base44.functions.invoke('bulkUpdateScheduleStatus', {
        ids: target.map(s => s.id),
        status: 'brouillon',
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (err) {
      console.error('[handleUnpublishAll] Erreur lors de la dépublication :', err?.message);
    }
  };

  const openAddForm = () => {
    setEditingSchedule(null);
    setFormOpen(true);
  };

  const selectedClassObj   = classMap[selectedClass];
  const selectedTeacherObj = teacherMap[selectedTeacher];
  const hasSelection = (view === "class" && selectedClass) || (view === "teacher" && selectedTeacher);

  // ── Événements de la semaine ──
  const weekEventList = useMemo(() => {
    const wd = weekDates.map(d => format(d, "yyyy-MM-dd"));
    return scheduleEvents.filter(e => {
      if (!wd.includes(e.event_date) || e.status !== "active") return false;
      if (view === "class")   return e.class_id === selectedClass;
      if (view === "teacher") return e.teacher_id === selectedTeacher;
      return false;
    });
  }, [scheduleEvents, weekDates, view, selectedClass, selectedTeacher]);

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        description="Planification et gestion des horaires de cours"
        action={canEdit ? openAddForm : undefined}
        actionLabel="Ajouter un cours"
      />

      {/* ── Barre d'outils ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-5">

        {/* Toggle vue — masqué pour élève (vue classe forcée) et enseignant (vue teacher forcée) */}
        {!isStudent && !isTeacherRole && (
          <div className="flex rounded-lg border overflow-hidden flex-shrink-0">
            <button
              onClick={() => setView("class")}
              className={cn(
                "px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
                view === "class" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              <Users className="w-3.5 h-3.5" /> Par classe
            </button>
            <button
              onClick={() => setView("teacher")}
              className={cn(
                "px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors border-l",
                view === "teacher" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" /> Par enseignant
            </button>
          </div>
        )}

        {/* Sélecteur classe ou enseignant */}
        {view === "class" && (
          <div>
            <Label className="mb-1 block text-xs text-slate-500">Classe</Label>
            {/* Élève : sa classe est verrouillée */}
            {isStudent ? (
              <div className="w-56 px-3 py-2 rounded-lg border bg-slate-50 text-sm text-slate-700 font-medium">
                {classMap[selectedClass]?.name || "Ma classe"}
              </div>
            ) : (
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.level && ` (${c.level})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {view === "teacher" && (
          <div>
            <Label className="mb-1 block text-xs text-slate-500">Enseignant</Label>
            {/* Enseignant : son propre profil est verrouillé */}
            {isTeacherRole ? (
              <div className="w-56 px-3 py-2 rounded-lg border bg-slate-50 text-sm text-slate-700 font-medium">
                {(() => {
                  const t = teacherMap[selectedTeacher];
                  return t ? `${t.first_name} ${t.last_name}` : "Mon planning";
                })()}
              </div>
            ) : (
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choisir un enseignant" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Navigateur de semaine */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-xs text-slate-500 hidden md:flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Année {schoolYear}</span>
            <span className="text-slate-300">•</span>
            <span>S{weekNumber}</span>
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

      {/* ── Barre de statut / publication ──────────────────────────── */}
      {canEdit && hasSelection && classStats.total > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border">
          <div className="flex items-center gap-2 text-sm flex-1 flex-wrap">
            <Badge variant="outline" className="bg-white">
              {classStats.total} cours
            </Badge>
            {classStats.published > 0 && (
              <Badge className="bg-green-100 text-green-800 border-0">
                ✅ {classStats.published} publiés
              </Badge>
            )}
            {classStats.drafts > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border-0">
                📝 {classStats.drafts} brouillons
              </Badge>
            )}
          </div>
          {view === "class" && selectedClass && (
            <div className="flex gap-2">
              {classStats.drafts > 0 && (
                <Button
                  size="sm" variant="outline"
                  onClick={handlePublishAll}
                  className="text-green-700 border-green-300 hover:bg-green-50 gap-1.5"
                >
                  <Send className="w-3 h-3" /> Tout publier
                </Button>
              )}
              {classStats.published > 0 && (
                <Button
                  size="sm" variant="outline"
                  onClick={handleUnpublishAll}
                  className="text-slate-600 gap-1.5"
                >
                  <EyeOff className="w-3 h-3" /> Tout dépublier
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Barre date ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-blue-500" />
        <span className="text-sm text-slate-600">
          Semaine du{" "}
          <span className="font-semibold text-slate-800">
            {format(weekDates[0], "d MMMM", { locale: fr })}
          </span>
          {" "}au{" "}
          <span className="font-semibold text-slate-800">
            {format(weekDates[5], "d MMMM yyyy", { locale: fr })}
          </span>
        </span>
        {view === "class" && selectedClassObj && (
          <Badge variant="outline" className="ml-2">{selectedClassObj.name}</Badge>
        )}
        {view === "teacher" && selectedTeacherObj && (
          <Badge variant="outline" className="ml-2">
            {selectedTeacherObj.first_name} {selectedTeacherObj.last_name}
          </Badge>
        )}
      </div>

      {/* ── Grille ──────────────────────────────────────────────────── */}
      {hasSelection ? (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            <TimeGrid
              days={DAYS}
              weekDates={weekDates}
              getSchedulesForDay={getSchedulesForDay}
              subjectMap={subjectMap}
              teacherMap={teacherMap}
              roomMap={roomMap}
              classMap={classMap}
              scheduleEvents={scheduleEvents}
              canEdit={canEdit}
              canDeclare={canDeclare}
              showClass={view === "teacher"}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeclareEvent={handleDeclareEvent}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {view === "class"
                ? "Sélectionnez une classe pour afficher son emploi du temps"
                : "Sélectionnez un enseignant pour afficher son planning"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Événements de la semaine ─────────────────────────────────── */}
      {weekEventList.length > 0 && (
        <Card className="mt-4 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Événements déclarés cette semaine ({weekEventList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weekEventList.map(event => {
                const ei  = EVENT_LABELS[event.event_type];
                const sub = subjectMap[event.subject_id];
                const tch = teacherMap[event.teacher_id];
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100"
                  >
                    <Badge className={`${ei?.color || "bg-gray-500"} text-white border-0 text-xs flex-shrink-0`}>
                      {ei?.label || event.event_type}
                    </Badge>
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="font-medium">
                        {sub?.name || "Cours"} • {event.start_time} – {event.end_time}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {event.event_date && format(new Date(event.event_date), "EEEE d MMMM yyyy", { locale: fr })}
                        {tch && ` • ${tch.first_name} ${tch.last_name}`}
                      </p>
                      {event.description && (
                        <p className="text-slate-600 text-xs mt-1">{event.description}</p>
                      )}
                      {event.replacement_date && (
                        <p className="text-green-700 text-xs mt-1">
                          🔄 Reporté au {format(new Date(event.replacement_date), "d MMM", { locale: fr })}
                          {event.replacement_time && ` à ${event.replacement_time}`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{event.declared_by}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Formulaire ajout / modification ─────────────────────────── */}
      <ScheduleFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingSchedule(null); }}
        editingSchedule={editingSchedule}
        classes={classes}
        teachers={teachers}
        rooms={rooms}
        allSubjects={subjects}
        allClasses={classes}
        allSchedules={schedules}
        onSave={() => queryClient.invalidateQueries({ queryKey: ["schedules"] })}
      />

      {/* ── Modal déclaration d'événement ────────────────────────────── */}
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
