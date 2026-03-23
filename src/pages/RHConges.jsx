import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, Calendar, Loader2, AlertTriangle } from "lucide-react";
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

const LEAVE_TYPES = {
  conge_annuel: "Congé annuel",
  maladie:      "Maladie",
  maternite:    "Maternité",
  exceptionnel: "Exceptionnel",
  sans_solde:   "Sans solde",
};

const STATUS_CONFIG = {
  pending:   { label: "En attente",  color: "bg-amber-100 text-amber-800",   icon: <Clock className="w-3 h-3" /> },
  approved:  { label: "Approuvé",    color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="w-3 h-3" /> },
  rejected:  { label: "Rejeté",      color: "bg-red-100 text-red-800",        icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Annulé",      color: "bg-slate-100 text-slate-600",    icon: <XCircle className="w-3 h-3" /> },
};

function KPI({ icon, label, value, color = "indigo" }) {
  const bg = { indigo: "bg-indigo-50", amber: "bg-amber-50", emerald: "bg-emerald-50", red: "bg-red-50" };
  const ic = { indigo: "text-indigo-600", amber: "text-amber-600", emerald: "text-emerald-600", red: "text-red-600" };
  return (
    <Card className={`${bg[color]} border-0`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={ic[color]}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RHConges() {
  const [formOpen, setFormOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "", employee_type: "teacher", leave_type: "conge_annuel",
    start_date: "", end_date: "", reason: "",
  });
  const qc = useQueryClient();
  const session = getSession();

  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] }    = useQuery({ queryKey: ["staff"],    queryFn: () => base44.entities.Staff.list() });
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["rh_leaves"],
    queryFn: () => apiFetch("/leaves"),
    refetchInterval: 30000,
  });
  const { data: stats = {} } = useQuery({
    queryKey: ["rh_leaves_stats"],
    queryFn: () => apiFetch("/leaves/stats"),
  });

  const allPeople = [
    ...teachers.map(t => ({ ...t, _type: "teacher" })),
    ...staff.map(s => ({ ...s, _type: "staff" })),
  ];
  const peopleMap = Object.fromEntries(allPeople.map(p => [p.id, p]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch("/leaves", {
      method: "POST",
      body: JSON.stringify({ ...formData, requested_by: session?.full_name }),
    });
    setSaving(false);
    if (res.id) {
      toast.success(`Demande créée — ${res.days_count} jour(s) ouvrable(s)`);
      qc.invalidateQueries({ queryKey: ["rh_leaves"] });
      qc.invalidateQueries({ queryKey: ["rh_leaves_stats"] });
      setFormOpen(false);
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleApprove = async (id) => {
    const res = await apiFetch(`/leaves/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ approved_by: session?.full_name }),
    });
    if (res.ok) {
      toast.success(`Congé approuvé — ${res.impactCount} créneaux marqués annulés`);
      qc.invalidateQueries({ queryKey: ["rh_leaves"] });
      qc.invalidateQueries({ queryKey: ["rh_leaves_stats"] });
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleReject = async () => {
    const res = await apiFetch(`/leaves/${rejectTarget}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejection_note: rejectNote, approved_by: session?.full_name }),
    });
    if (res.ok) {
      toast.success("Congé rejeté");
      qc.invalidateQueries({ queryKey: ["rh_leaves"] });
      setRejectOpen(false); setRejectNote(""); setRejectTarget(null);
    }
  };

  const LeaveCard = ({ leave }) => {
    const person = peopleMap[leave.employee_id];
    const name = person ? `${person.first_name} ${person.last_name}` : leave.employee_id;
    const status = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{name}</span>
                <Badge className={`${status.color} text-xs flex items-center gap-1`}>
                  {status.icon}{status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="font-medium text-slate-700">{LEAVE_TYPES[leave.leave_type]}</span>
                <span>·</span>
                <Calendar className="w-3 h-3" />
                <span>
                  {leave.start_date && format(new Date(leave.start_date + "T12:00:00"), "d MMM", { locale: fr })}
                  {" → "}
                  {leave.end_date && format(new Date(leave.end_date + "T12:00:00"), "d MMM yyyy", { locale: fr })}
                </span>
                <span>·</span>
                <span className="font-medium">{leave.days_count} jour(s)</span>
              </div>
              {leave.reason && <p className="text-xs text-slate-500 mt-1 italic">"{leave.reason}"</p>}
              {leave.rejection_note && <p className="text-xs text-red-600 mt-1">Motif refus : {leave.rejection_note}</p>}
            </div>
            {leave.status === "pending" && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => handleApprove(leave.id)}>
                  <CheckCircle className="w-3 h-3 mr-1" />Approuver
                </Button>
                <Button size="sm" variant="outline" className="h-7 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                  onClick={() => { setRejectTarget(leave.id); setRejectOpen(true); }}>
                  <XCircle className="w-3 h-3 mr-1" />Rejeter
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const filterLeaves = (status) => status === "all" ? leaves : leaves.filter(l => l.status === status);

  return (
    <div>
      <PageHeader
        title="Congés & Absences"
        description="Gestion des demandes de congé avec synchronisation emploi du temps"
        action={() => setFormOpen(true)}
        actionLabel="Nouvelle demande"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KPI icon={<Clock className="w-6 h-6" />}        label="En attente"       value={stats.pending}       color="amber" />
        <KPI icon={<CheckCircle className="w-6 h-6" />}  label="Approuvés ce mois" value={stats.approvedMonth} color="emerald" />
        <KPI icon={<Calendar className="w-6 h-6" />}     label="Jours absents ce mois" value={stats.daysThisMonth} color="indigo" />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">En attente ({leaves.filter(l => l.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approuvés</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
        {["pending", "approved", "rejected", "all"].map(tab => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : filterLeaves(tab).length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Aucune demande</div>
            ) : (
              <div className="space-y-3 mt-2">
                {filterLeaves(tab).map(l => <LeaveCard key={l.id} leave={l} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Formulaire nouvelle demande */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle demande de congé</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type d'employé</Label>
                <Select value={formData.employee_type} onValueChange={v => setFormData({ ...formData, employee_type: v, employee_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Enseignant</SelectItem>
                    <SelectItem value="staff">Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Employé *</Label>
                <Select value={formData.employee_id} onValueChange={v => setFormData({ ...formData, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {(formData.employee_type === "teacher" ? teachers : staff).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Type de congé</Label>
              <Select value={formData.leave_type} onValueChange={v => setFormData({ ...formData, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date début *</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Date fin *</Label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motif</Label>
              <Textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Soumettre
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogue de rejet */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motif de rejet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Expliquer la raison du rejet…" value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleReject}>Rejeter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
