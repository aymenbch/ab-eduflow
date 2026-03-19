import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Plus,
  Archive,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PeriodManager from "@/components/schoolyear/PeriodManager";

export default function SchoolYearManager() {
  const [showNewYearDialog, setShowNewYearDialog] = useState(false);
  const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });
  const queryClient = useQueryClient();

  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list("-start_date"),
  });

  const createYearMutation = useMutation({
    mutationFn: (data) => base44.entities.SchoolYear.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
      setShowNewYearDialog(false);
      setNewYear({ name: "", start_date: "", end_date: "" });
    },
  });

  const updateYearMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SchoolYear.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schoolYears"] }),
  });

  const handleActivate = async (year) => {
    // Archive currently active year
    const active = schoolYears.find((y) => y.status === "active");
    if (active && active.id !== year.id) {
      await base44.entities.SchoolYear.update(active.id, { status: "archived", archived_date: new Date().toISOString().split("T")[0] });
    }
    updateYearMutation.mutate({ id: year.id, data: { status: "active" } });
  };

  const handleArchive = (year) => {
    updateYearMutation.mutate({
      id: year.id,
      data: { status: "archived", archived_date: new Date().toISOString().split("T")[0] },
    });
  };

  const statusConfig = {
    active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
    archived: { label: "Archivée", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Archive },
    upcoming: { label: "À venir", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  };

  const activeYear = schoolYears.find((y) => y.status === "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">📅</div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Gestion des Années Scolaires</h1>
              <p className="text-white/80">
                {activeYear ? `Année active : ${activeYear.name}` : "Aucune année active"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewYearDialog(true)}
            className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle année
          </Button>
        </div>
      </div>

      <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Année active</p>
                  <p className="text-lg font-bold">{schoolYears.filter((y) => y.status === "active").length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">À venir</p>
                  <p className="text-lg font-bold">{schoolYears.filter((y) => y.status === "upcoming").length}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Archivées</p>
                  <p className="text-lg font-bold">{schoolYears.filter((y) => y.status === "archived").length}</p>
                </div>
                <Archive className="w-8 h-8 text-slate-400" />
              </CardContent>
            </Card>
          </div>

          {/* Years list */}
          <div className="grid gap-4">
            {schoolYears.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center text-slate-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="font-medium">Aucune année scolaire créée</p>
                  <p className="text-sm mt-1">Cliquez sur "Nouvelle année" pour commencer</p>
                </CardContent>
              </Card>
            )}
            {schoolYears.map((year) => {
              const cfg = statusConfig[year.status] || statusConfig.upcoming;
              const StatusIcon = cfg.icon;
              return (
                <div key={year.id} className="space-y-2">
                  <Card className={year.status === "active" ? "ring-2 ring-green-400" : ""}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <CalendarDays className="w-7 h-7 text-indigo-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-slate-900">{year.name}</h3>
                              <span className={`text-xs px-2 py-1 rounded-full border font-medium ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3 inline mr-1" />
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              {year.start_date} → {year.end_date}
                            </p>
                            {year.archived_date && (
                              <p className="text-xs text-slate-400 mt-0.5">Archivée le {year.archived_date}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {year.status === "upcoming" && (
                            <Button
                              size="sm"
                              onClick={() => handleActivate(year)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Activer
                            </Button>
                          )}
                          {year.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="border-indigo-300 text-indigo-700"
                            >
                              <Link to={createPageUrl("PassageDeClasse")}>
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Passer à l'année suivante
                              </Link>
                            </Button>
                          )}
                          {year.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchive(year)}
                              className="border-slate-300 text-slate-600"
                            >
                              <Archive className="w-4 h-4 mr-1" />
                              Archiver
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Périodes — visible uniquement pour les années actives ou à venir */}
                  {year.status !== "archived" && (
                    <div className="ml-4 pl-4 border-l-2 border-indigo-100">
                      <PeriodManager schoolYear={year} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        {/* Link to separate Passage de Classe module */}
        <Card className="border-dashed border-indigo-300 bg-indigo-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-medium text-slate-800">Passage de classe</p>
                <p className="text-xs text-slate-500">Calcul des moyennes, promotions et historique</p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Link to={createPageUrl("PassageDeClasse")}>
                <ArrowRight className="w-4 h-4 mr-1" />
                Accéder
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* New Year Dialog */}
      <Dialog open={showNewYearDialog} onOpenChange={setShowNewYearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une nouvelle année scolaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom de l'année (ex: 2025-2026)</Label>
              <Input
                placeholder="2025-2026"
                value={newYear.name}
                onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={newYear.start_date}
                  onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={newYear.end_date}
                  onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewYearDialog(false)}>Annuler</Button>
            <Button
              onClick={() => createYearMutation.mutate({ ...newYear, status: "upcoming" })}
              disabled={!newYear.name || !newYear.start_date || !newYear.end_date || createYearMutation.isPending}
            >
              {createYearMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}