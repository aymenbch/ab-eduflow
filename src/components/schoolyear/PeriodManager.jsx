import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import { CalendarRange, Plus, Pencil, Trash2, CheckCircle2, Lock, Wand2 } from "lucide-react";

const STATUS_CFG = {
  open:   { label: "En cours",  color: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Clôturée", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function PeriodManager({ schoolYear }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    name: "", type: "trimestre", order: 1, start_date: "", end_date: "", status: "open",
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["periods", schoolYear?.id],
    queryFn: () => base44.entities.Period.filter({ school_year_id: schoolYear.id }),
    enabled: !!schoolYear?.id,
  });

  const sorted = [...periods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const saveMutation = useMutation({
    mutationFn: (data) =>
      selected
        ? base44.entities.Period.update(selected.id, data)
        : base44.entities.Period.create({ ...data, school_year_id: schoolYear.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      setFormOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Period.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  const toggleStatus = (p) =>
    base44.entities.Period.update(p.id, { status: p.status === "open" ? "closed" : "open" })
      .then(() => qc.invalidateQueries({ queryKey: ["periods"] }));

  const openNew = () => {
    setSelected(null);
    setFormData({ name: "", type: "trimestre", order: sorted.length + 1, start_date: "", end_date: "", status: "open" });
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setSelected(p);
    setFormData({ name: p.name, type: p.type, order: p.order, start_date: p.start_date || "", end_date: p.end_date || "", status: p.status });
    setFormOpen(true);
  };

  const quickCreate = (type) => {
    const count = type === "trimestre" ? 3 : 2;
    const names = type === "trimestre"
      ? ["Trimestre 1", "Trimestre 2", "Trimestre 3"]
      : ["Semestre 1", "Semestre 2"];
    const existing = new Set(periods.map((p) => p.name));
    const toCreate = names.filter((n) => !existing.has(n));
    Promise.all(
      toCreate.map((name, i) =>
        base44.entities.Period.create({
          school_year_id: schoolYear.id,
          name,
          type,
          order: (periods.length + i + 1),
          status: "open",
        })
      )
    ).then(() => qc.invalidateQueries({ queryKey: ["periods"] }));
  };

  if (!schoolYear) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-indigo-500" />
            Périodes — {schoolYear.name}
          </CardTitle>
          <div className="flex gap-2">
            {periods.length === 0 && (
              <>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => quickCreate("trimestre")}>
                  <Wand2 className="w-3 h-3 mr-1" /> 3 trimestres
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => quickCreate("semestre")}>
                  <Wand2 className="w-3 h-3 mr-1" /> 2 semestres
                </Button>
              </>
            )}
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CalendarRange className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Aucune période définie.</p>
            <p className="text-xs mt-1">Utilisez les boutons "3 trimestres" ou "2 semestres" pour créer rapidement.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => {
              const cfg = STATUS_CFG[p.status] || STATUS_CFG.open;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {p.order}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {(p.start_date || p.end_date) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.start_date || "?"} → {p.end_date || "?"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title={p.status === "open" ? "Clôturer la période" : "Réouvrir"}
                      onClick={() => toggleStatus(p)}
                    >
                      {p.status === "open"
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : <Lock className="w-4 h-4 text-slate-400" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selected ? "Modifier la période" : "Nouvelle période"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ex: Trimestre 1, Semestre 2…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="semestre">Semestre</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ordre</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">En cours</SelectItem>
                  <SelectItem value="closed">Clôturée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button
              disabled={!formData.name || saveMutation.isPending}
              onClick={() => saveMutation.mutate(formData)}
            >
              {selected ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la période ?</AlertDialogTitle>
            <AlertDialogDescription>
              La période <strong>{deleteTarget?.name}</strong> sera supprimée. Les examens liés à cette période ne seront pas supprimés mais perdront leur référence de période.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
