import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Search, MoreHorizontal, Pencil, Trash2, CheckCircle, Loader2,
  ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isToday, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import NotifyParentButton from "@/components/notifications/NotifyParentButton";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";

const SANCTION_TYPES = {
  warning:    { label: "Avertissement",        color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  detention:  { label: "Retenue",              color: "bg-orange-100 text-orange-800 border-orange-200" },
  suspension: { label: "Exclusion temporaire", color: "bg-red-100 text-red-800 border-red-200"         },
  expulsion:  { label: "Exclusion définitive", color: "bg-red-200 text-red-900 border-red-300"         },
  other:      { label: "Autre",                color: "bg-slate-100 text-slate-800 border-slate-200"   },
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Sanctions() {
  // ── Admin / Teacher states ─────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sanctionToDelete, setSanctionToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    student_id: "",
    type: "warning",
    reason: "",
    description: "",
    date: "",
    issued_by: "",
    duration_days: "",
    parent_notified: false,
    resolved: false,
  });

  // ── Parent states (must stay at top level) ─────────────────────────────────
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailDay, setDetailDay] = useState(null);

  const queryClient = useQueryClient();
  const { isParent, myChildren, isTeacher, myTeacherId } = useCurrentMember();

  // Default to first child
  useEffect(() => {
    if (myChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(myChildren[0].id);
    }
  }, [myChildren, selectedChildId]);

  // ── Shared / Admin queries ─────────────────────────────────────────────────
  const { data: sanctions = [], isLoading } = useQuery({
    queryKey: ["sanctions"],
    queryFn: () => base44.entities.Sanction.list("-date"),
    enabled: !isParent,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
    enabled: !isParent,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => base44.entities.Class.list(),
    enabled: isParent,
  });

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["schedules_teacher", myTeacherId],
    queryFn: () => base44.entities.Schedule.filter({ teacher_id: myTeacherId }),
    enabled: isTeacher && !!myTeacherId,
  });

  const visibleStudents = useMemo(() => {
    if (!isTeacher || teacherSchedules.length === 0) return students;
    const classIds = new Set(teacherSchedules.map(s => s.class_id));
    return students.filter(s => classIds.has(s.class_id));
  }, [students, isTeacher, teacherSchedules]);

  // ── Parent: fetch all sanctions for selected child ─────────────────────────
  const monthKey = format(currentMonth, "yyyy-MM");
  const { data: childSanctions = [] } = useQuery({
    queryKey: ["sanctions_child", selectedChildId],
    queryFn: () => base44.entities.Sanction.filter({ student_id: selectedChildId }),
    enabled: isParent && !!selectedChildId,
  });

  const monthSanctions = useMemo(
    () => childSanctions.filter(s => s.date?.startsWith(monthKey)),
    [childSanctions, monthKey],
  );

  // Map: dateStr → sanction[] (multiple sanctions can share the same day)
  const sanctionsByDay = useMemo(() => {
    const map = {};
    monthSanctions.forEach(s => {
      if (!s.date) return;
      const d = s.date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return map;
  }, [monthSanctions]);

  // ── Admin handlers ─────────────────────────────────────────────────────────
  const handleNew = () => {
    setSelectedSanction(null);
    setFormData({
      student_id: "", type: "warning", reason: "", description: "",
      date: new Date().toISOString().split("T")[0],
      issued_by: "", duration_days: "", parent_notified: false, resolved: false,
    });
    setFormOpen(true);
  };

  const handleEdit = (sanction) => {
    setSelectedSanction(sanction);
    setFormData({
      student_id: sanction.student_id || "",
      type: sanction.type || "warning",
      reason: sanction.reason || "",
      description: sanction.description || "",
      date: sanction.date || "",
      issued_by: sanction.issued_by || "",
      duration_days: sanction.duration_days || "",
      parent_notified: sanction.parent_notified || false,
      resolved: sanction.resolved || false,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...formData, duration_days: formData.duration_days ? Number(formData.duration_days) : null };
    if (selectedSanction) {
      await base44.entities.Sanction.update(selectedSanction.id, data);
    } else {
      await base44.entities.Sanction.create(data);
    }
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["sanctions"] });
    setFormOpen(false);
  };

  const handleResolve = async (sanction) => {
    await base44.entities.Sanction.update(sanction.id, { resolved: true });
    queryClient.invalidateQueries({ queryKey: ["sanctions"] });
  };

  const handleDelete = async () => {
    if (sanctionToDelete) {
      await base44.entities.Sanction.delete(sanctionToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["sanctions"] });
      setDeleteDialogOpen(false);
      setSanctionToDelete(null);
    }
  };

  const filteredSanctions = sanctions.filter((s) => {
    const student = studentMap[s.student_id];
    const studentName = student ? `${student.first_name} ${student.last_name}` : "";
    return (
      search === "" ||
      studentName.toLowerCase().includes(search.toLowerCase()) ||
      s.reason?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const columns = [
    {
      header: "Élève",
      cell: (row) => {
        const student = studentMap[row.student_id];
        return student ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-sm font-medium">
              {student.first_name?.[0]}{student.last_name?.[0]}
            </div>
            <span className="font-medium">{student.first_name} {student.last_name}</span>
          </div>
        ) : "-";
      },
    },
    {
      header: "Type",
      cell: (row) => {
        const config = SANCTION_TYPES[row.type] || SANCTION_TYPES.other;
        return <Badge className={config.color}>{config.label}</Badge>;
      },
    },
    {
      header: "Motif",
      cell: (row) => <span className="line-clamp-1 max-w-[200px]">{row.reason}</span>,
    },
    {
      header: "Date",
      cell: (row) => (
        <span>{row.date ? format(new Date(row.date), "d MMM yyyy", { locale: fr }) : "-"}</span>
      ),
    },
    {
      header: "Statut",
      cell: (row) => (
        <Badge className={row.resolved ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {row.resolved ? "Résolu" : "En cours"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!row.resolved && (
              <DropdownMenuItem onClick={() => handleResolve(row)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Marquer comme résolu
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => { setSanctionToDelete(row); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // ── Parent calendar view ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isParent) {
    const selectedChild = myChildren.find(c => c.id === selectedChildId);
    const childClass    = selectedChild ? classes.find(c => c.id === selectedChild.class_id) : null;

    const monthStart  = startOfMonth(currentMonth);
    const monthEnd    = endOfMonth(currentMonth);
    const allDays     = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startOffset = (getDay(monthStart) + 6) % 7;

    const detailSanctions = detailDay ? (sanctionsByDay[detailDay] || []) : [];

    // Dot color: red if any active sanction, amber if all resolved
    const dotColor = (recs) => {
      if (!recs?.length) return null;
      const hasActive = recs.some(r => !r.resolved);
      return hasActive ? "red" : "amber";
    };

    // Monthly counts by type
    const countByType = Object.fromEntries(
      Object.keys(SANCTION_TYPES).map(k => [k, monthSanctions.filter(s => s.type === k).length])
    );
    const activeCount   = monthSanctions.filter(s => !s.resolved).length;
    const resolvedCount = monthSanctions.filter(s => s.resolved).length;

    return (
      <div>
        <PageHeader
          title="Sanctions de mes enfants"
          description="Suivi mensuel des sanctions disciplinaires"
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
                            ? "bg-orange-50 border-l-4 border-orange-500"
                            : "hover:bg-slate-50 border-l-4 border-transparent"
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0
                          ${active ? "bg-orange-500" : "bg-slate-400"}`}
                        >
                          {child.first_name?.[0]}{child.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? "text-orange-700" : "text-slate-700"}`}>
                            {child.first_name} {child.last_name}
                          </p>
                          {cls && <p className="text-xs text-slate-400 truncate">{cls.name}</p>}
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
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Sanction active
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Résolue
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
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`e-${i}`} />
                    ))}

                    {allDays.map(day => {
                      const dateStr  = format(day, "yyyy-MM-dd");
                      const recs     = sanctionsByDay[dateStr];
                      const isSelDay = detailDay === dateStr;
                      const today    = isToday(day);
                      const dot      = dotColor(recs);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => recs?.length ? setDetailDay(isSelDay ? null : dateStr) : undefined}
                          className={`
                            flex flex-col items-center justify-start pt-1.5 pb-2 rounded-lg
                            transition-all min-h-[52px]
                            ${isSelDay ? "ring-2 ring-orange-400 bg-orange-50" : ""}
                            ${recs?.length && !isSelDay ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}
                            ${today && !isSelDay ? "bg-orange-50" : ""}
                          `}
                        >
                          <span className={`text-sm leading-none
                            ${today ? "font-bold text-orange-600" : "text-slate-700"}
                          `}>
                            {format(day, "d")}
                          </span>
                          <div className="mt-1.5">
                            {dot === "red"   && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                            {dot === "amber" && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Detail panel ────────────────────────────────────────── */}
                  {detailDay && detailSanctions.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
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

                      <div className="space-y-3">
                        {detailSanctions.map((s, i) => {
                          const cfg = SANCTION_TYPES[s.type] || SANCTION_TYPES.other;
                          return (
                            <div key={s.id || i} className="p-3 rounded-lg bg-white border border-slate-200">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                                  <ShieldAlert className="w-3 h-3" />
                                  {cfg.label}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                  s.resolved
                                    ? "bg-green-100 text-green-800 border-green-200"
                                    : "bg-red-100 text-red-800 border-red-200"
                                }`}>
                                  {s.resolved ? "Résolu" : "En cours"}
                                </span>
                              </div>
                              {s.reason && (
                                <p className="text-sm font-medium text-slate-800">{s.reason}</p>
                              )}
                              {s.description && (
                                <p className="text-sm text-slate-600 mt-1">{s.description}</p>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                {s.issued_by && (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-medium">Par :</span> {s.issued_by}
                                  </p>
                                )}
                                {s.duration_days && (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-medium">Durée :</span> {s.duration_days} jour{s.duration_days > 1 ? "s" : ""}
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

              {/* ── Monthly summary stats ──────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <Card className="border shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">En cours</p>
                      <p className="text-lg font-bold leading-none mt-0.5">{activeCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Résolues</p>
                      <p className="text-lg font-bold leading-none mt-0.5">{resolvedCount}</p>
                    </div>
                  </CardContent>
                </Card>
                {Object.entries(SANCTION_TYPES).slice(0, 2).map(([key, cfg]) => (
                  <Card key={key} className="border shadow-sm">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${cfg.color}`}>
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{cfg.label}s</p>
                        <p className="text-lg font-bold leading-none mt-0.5">{countByType[key]}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
        title="Gestion des sanctions"
        description={`${sanctions.filter((s) => !s.resolved).length} sanctions en cours`}
        action={handleNew}
        actionLabel="Nouvelle sanction"
      />

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <NotifyParentButton
          eventType="sanction"
          students={filteredSanctions
            .filter(s => !s.resolved && !s.parent_notified)
            .map(s => {
              const st = studentMap[s.student_id];
              return st ? {
                ...st,
                _sanction_type: SANCTION_TYPES[s.type]?.label || s.type,
                _reason: s.reason,
                _date: s.date,
              } : null;
            })
            .filter(Boolean)}
          variables={{ sanction_type: "sanction", reason: "voir détail" }}
          label="Notifier parents (non notifiés)"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredSanctions}
        isLoading={isLoading}
        emptyMessage="Aucune sanction enregistrée"
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedSanction ? "Modifier la sanction" : "Nouvelle sanction"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Élève *</Label>
              <Select
                value={formData.student_id}
                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un élève" />
                </SelectTrigger>
                <SelectContent>
                  {visibleStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    {Object.entries(SANCTION_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motif *</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description détaillée</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Émis par</Label>
                <Input
                  value={formData.issued_by}
                  onChange={(e) => setFormData({ ...formData, issued_by: e.target.value })}
                  placeholder="Nom de la personne"
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (jours)</Label>
                <Input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="parent_notified"
                  checked={formData.parent_notified}
                  onCheckedChange={(checked) => setFormData({ ...formData, parent_notified: checked })}
                />
                <Label htmlFor="parent_notified" className="cursor-pointer">Parents notifiés</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolved"
                  checked={formData.resolved}
                  onCheckedChange={(checked) => setFormData({ ...formData, resolved: checked })}
                />
                <Label htmlFor="resolved" className="cursor-pointer">Résolu</Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedSanction ? "Mettre à jour" : "Créer"}
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
              Êtes-vous sûr de vouloir supprimer cette sanction ?
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
