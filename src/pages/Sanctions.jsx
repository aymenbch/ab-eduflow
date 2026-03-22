import React, { useState, useMemo } from "react";
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
import { Search, MoreHorizontal, Pencil, Trash2, CheckCircle, Loader2, Bell } from "lucide-react";
import NotifyParentButton from "@/components/notifications/NotifyParentButton";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCurrentMember } from "@/components/hooks/useCurrentMember";

const SANCTION_TYPES = {
  warning: { label: "Avertissement", color: "bg-yellow-100 text-yellow-800" },
  detention: { label: "Retenue", color: "bg-orange-100 text-orange-800" },
  suspension: { label: "Exclusion temporaire", color: "bg-red-100 text-red-800" },
  expulsion: { label: "Exclusion définitive", color: "bg-red-200 text-red-900" },
  other: { label: "Autre", color: "bg-slate-100 text-slate-800" },
};

export default function Sanctions() {
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

  const queryClient = useQueryClient();
  const { isTeacher, myTeacherId } = useCurrentMember();

  const { data: sanctions = [], isLoading } = useQuery({
    queryKey: ["sanctions"],
    queryFn: () => base44.entities.Sanction.list("-date"),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  // Schedules de l'enseignant pour filtrer les élèves visibles
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

  const handleNew = () => {
    setSelectedSanction(null);
    setFormData({
      student_id: "",
      type: "warning",
      reason: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      issued_by: "",
      duration_days: "",
      parent_notified: false,
      resolved: false,
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

    const data = {
      ...formData,
      duration_days: formData.duration_days ? Number(formData.duration_days) : null,
    };

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
              {student.first_name?.[0]}
              {student.last_name?.[0]}
            </div>
            <span className="font-medium">
              {student.first_name} {student.last_name}
            </span>
          </div>
        ) : (
          "-"
        );
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
      cell: (row) => (
        <span className="line-clamp-1 max-w-[200px]">{row.reason}</span>
      ),
    },
    {
      header: "Date",
      cell: (row) => (
        <span>
          {row.date ? format(new Date(row.date), "d MMM yyyy", { locale: fr }) : "-"}
        </span>
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
              onClick={() => {
                setSanctionToDelete(row);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SANCTION_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
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
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, parent_notified: checked })
                  }
                />
                <Label htmlFor="parent_notified" className="cursor-pointer">
                  Parents notifiés
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolved"
                  checked={formData.resolved}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, resolved: checked })
                  }
                />
                <Label htmlFor="resolved" className="cursor-pointer">
                  Résolu
                </Label>
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