import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clock, RefreshCw, Plus, Trash2, Loader2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSession } from "@/components/auth/appAuth";
import toast from "react-hot-toast";

const RH_API = "http://localhost:3001/api/rh";
function apiFetch(path, opts = {}) {
  const s = getSession();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (s?.token) headers["X-Session-Token"] = s.token;
  return fetch(`${RH_API}${path}`, { ...opts, headers }).then(r => r.json());
}

const ENTRY_TYPE_CONFIG = {
  scheduled:    { label: "Planifié",        color: "bg-blue-100 text-blue-800" },
  absent:       { label: "Absent",           color: "bg-red-100 text-red-800" },
  overtime:     { label: "Heure sup.",       color: "bg-emerald-100 text-emerald-800" },
  recuperation: { label: "Récupération",     color: "bg-purple-100 text-purple-800" },
};

function KPI({ label, value, unit = "h", color = "slate" }) {
  const colors = { slate: "text-slate-700", blue: "text-blue-600", red: "text-red-600", emerald: "text-emerald-600", indigo: "text-indigo-600" };
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${colors[color]}`}>{value != null ? `${Number(value).toFixed(1)} ${unit}` : "—"}</p>
      </CardContent>
    </Card>
  );
}

export default function RHTemps() {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [employeeId, setEmployeeId] = useState("");
  const [employeeType, setEmployeeType] = useState("teacher");
  const [syncing, setSyncing] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryData, setEntryData] = useState({ entry_type: "overtime", date: today.toISOString().split("T")[0], hours: 1, note: "" });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const session = getSession();

  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] }    = useQuery({ queryKey: ["staff"],    queryFn: () => base44.entities.Staff.list() });

  const people = employeeType === "teacher" ? teachers : staff;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["rh_worktime", employeeId, month],
    queryFn: () => employeeId ? apiFetch(`/worktime?employee_id=${employeeId}&month=${month}`) : [],
    enabled: !!employeeId,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ["rh_worktime_summary", employeeId, month],
    queryFn: () => employeeId ? apiFetch(`/worktime/summary/${employeeId}?month=${month}`) : {},
    enabled: !!employeeId,
  });

  const handleSync = async () => {
    if (!employeeId) return toast.error("Sélectionner un employé");
    setSyncing(true);
    const res = await apiFetch("/worktime/sync-month", {
      method: "POST",
      body: JSON.stringify({ employee_id: employeeId, employee_type: employeeType, period_month: month }),
    });
    setSyncing(false);
    if (res.ok) {
      toast.success(`Synchronisé : ${res.scheduled} planifiés, ${res.absent} absents`);
      qc.invalidateQueries({ queryKey: ["rh_worktime", employeeId, month] });
      qc.invalidateQueries({ queryKey: ["rh_worktime_summary", employeeId, month] });
    } else {
      toast.error(res.error || "Erreur de synchronisation");
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!employeeId) return toast.error("Sélectionner un employé d'abord");
    setSaving(true);
    const res = await apiFetch("/worktime", {
      method: "POST",
      body: JSON.stringify({ ...entryData, employee_id: employeeId, employee_type: employeeType, created_by: session?.full_name }),
    });
    setSaving(false);
    if (res.id) {
      toast.success("Entrée ajoutée");
      qc.invalidateQueries({ queryKey: ["rh_worktime", employeeId, month] });
      qc.invalidateQueries({ queryKey: ["rh_worktime_summary", employeeId, month] });
      setEntryOpen(false);
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleDelete = async (id) => {
    await apiFetch(`/worktime/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["rh_worktime", employeeId, month] });
    qc.invalidateQueries({ queryKey: ["rh_worktime_summary", employeeId, month] });
  };

  return (
    <div>
      <PageHeader title="Temps de Travail" description="Suivi des heures planifiées, absences et heures supplémentaires" />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          <Select value={employeeType} onValueChange={v => { setEmployeeType(v); setEmployeeId(""); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Enseignant</SelectItem>
              <SelectItem value="staff">Personnel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
            <SelectContent>
              {people.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing || !employeeId}>
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Synchroniser EDT
        </Button>
        <Button onClick={() => setEntryOpen(true)} disabled={!employeeId}>
          <Plus className="w-4 h-4 mr-2" />Saisie manuelle
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Heures planifiées" value={summary.scheduled} color="blue" />
        <KPI label="Heures absentes"   value={summary.absent}    color="red" />
        <KPI label="Heures sup."       value={summary.overtime}  color="emerald" />
        <KPI label="Heures effectives" value={summary.effective} color="indigo" />
      </div>

      {/* Tableau des entrées */}
      {!employeeId ? (
        <div className="text-center py-16 text-slate-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sélectionnez un employé pour voir ses heures</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Aucune entrée — cliquez sur "Synchroniser EDT" pour importer les heures planifiées
        </div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Entrées du mois</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Heures</th>
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">Note</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(e => {
                    const cfg = ENTRY_TYPE_CONFIG[e.entry_type] || ENTRY_TYPE_CONFIG.scheduled;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium">
                          {format(new Date(e.date + "T12:00:00"), "EEE d MMM", { locale: fr })}
                        </td>
                        <td className="p-3">
                          <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono">{Number(e.hours).toFixed(1)} h</td>
                        <td className="p-3 text-slate-500 text-xs">{e.source || "—"}</td>
                        <td className="p-3 text-slate-500 text-xs">{e.note || ""}</td>
                        <td className="p-3">
                          {e.source === "manual" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDelete(e.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulaire saisie manuelle */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Saisie manuelle</DialogTitle></DialogHeader>
          <form onSubmit={handleAddEntry} className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={entryData.entry_type} onValueChange={v => setEntryData({ ...entryData, entry_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overtime">Heures supplémentaires</SelectItem>
                  <SelectItem value="recuperation">Récupération</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={entryData.date} onChange={e => setEntryData({ ...entryData, date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Heures</Label>
                <Input type="number" step="0.5" min="0.5" value={entryData.hours} onChange={e => setEntryData({ ...entryData, hours: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea value={entryData.note} onChange={e => setEntryData({ ...entryData, note: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
