import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, DollarSign, FileText, Loader2, PlayCircle, Trash2 } from "lucide-react";
import { getSession } from "@/components/auth/appAuth";
import toast from "react-hot-toast";

const RH_API = "http://localhost:3001/api/rh";
function apiFetch(path, opts = {}) {
  const s = getSession();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (s?.token) headers["X-Session-Token"] = s.token;
  return fetch(`${RH_API}${path}`, { ...opts, headers }).then(r => r.json());
}

const STATUS_CONFIG = {
  draft:     { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  validated: { label: "Validé",    color: "bg-blue-100 text-blue-800" },
  paid:      { label: "Payé",      color: "bg-emerald-100 text-emerald-800" },
};

function KPI({ icon, label, value, color = "indigo", sub }) {
  const bg = { indigo: "bg-indigo-50", emerald: "bg-emerald-50", slate: "bg-slate-50", amber: "bg-amber-50" };
  const ic = { indigo: "text-indigo-600", emerald: "text-emerald-600", slate: "text-slate-600", amber: "text-amber-600" };
  return (
    <Card className={`${bg[color]} border-0`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={ic[color]}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value ?? "—"}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RHPaie() {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState(null);
  const qc = useQueryClient();
  const session = getSession();

  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: () => base44.entities.Teacher.list() });
  const { data: staff = [] }    = useQuery({ queryKey: ["staff"],    queryFn: () => base44.entities.Staff.list() });

  const allPeople = [...teachers.map(t => ({ ...t, _type: "teacher" })), ...staff.map(s => ({ ...s, _type: "staff" }))];
  const peopleMap = Object.fromEntries(allPeople.map(p => [p.id, p]));

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["rh_payslips", month],
    queryFn: () => apiFetch(`/payslips?period_month=${month}`),
  });

  const { data: kpi = {} } = useQuery({
    queryKey: ["rh_payslips_kpi"],
    queryFn: () => apiFetch("/payslips/kpi"),
  });

  const generateAll = async () => {
    setGenerating(true);
    let done = 0; let errors = 0;
    for (const p of allPeople) {
      const res = await apiFetch("/payslips/generate", {
        method: "POST",
        body: JSON.stringify({ employee_id: p.id, employee_type: p._type, period_month: month, generated_by: session?.full_name }),
      });
      if (res.id || res.recalculated) done++;
      else errors++;
    }
    setGenerating(false);
    toast.success(`${done} fiche(s) générée(s)${errors > 0 ? ` (${errors} sans contrat)` : ""}`);
    qc.invalidateQueries({ queryKey: ["rh_payslips", month] });
    qc.invalidateQueries({ queryKey: ["rh_payslips_kpi"] });
  };

  const handleValidate = async (id) => {
    const res = await apiFetch(`/payslips/${id}/validate`, { method: "PUT", body: JSON.stringify({ validated_by: session?.full_name }) });
    if (res.ok) { toast.success("Validé"); qc.invalidateQueries({ queryKey: ["rh_payslips", month] }); qc.invalidateQueries({ queryKey: ["rh_payslips_kpi"] }); }
  };

  const handleMarkPaid = async (id) => {
    const res = await apiFetch(`/payslips/${id}/mark-paid`, { method: "PUT" });
    if (res.ok) { toast.success("Marqué payé"); qc.invalidateQueries({ queryKey: ["rh_payslips", month] }); qc.invalidateQueries({ queryKey: ["rh_payslips_kpi"] }); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce brouillon ?")) return;
    const res = await apiFetch(`/payslips/${id}`, { method: "DELETE" });
    if (res.ok) { qc.invalidateQueries({ queryKey: ["rh_payslips", month] }); }
  };

  const fmt = (n) => Number(n || 0).toLocaleString("fr-DZ") + " DA";

  return (
    <div>
      <PageHeader title="Paie" description="Calcul et validation des fiches de paie mensuelles" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI icon={<DollarSign className="w-6 h-6" />}  label="Masse salariale (mois)" value={fmt(kpi.masse_salariale)} color="emerald" />
        <KPI icon={<FileText className="w-6 h-6" />}     label="Brouillons"              value={kpi.draft}              color="slate" />
        <KPI icon={<CheckCircle className="w-6 h-6" />}  label="Validées"                value={kpi.validated}          color="indigo" />
        <KPI icon={<CheckCircle className="w-6 h-6" />}  label="Payées"                  value={kpi.paid}               color="amber" />
      </div>

      {/* Contrôles */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44" />
        <Button onClick={generateAll} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
          Générer la paie du mois
        </Button>
      </div>

      {/* Tableau */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune fiche de paie pour ce mois — cliquez sur "Générer la paie du mois"</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left p-3">Employé</th>
                  <th className="text-right p-3">H.Plan.</th>
                  <th className="text-right p-3">H.Abs.</th>
                  <th className="text-right p-3">H.Sup.</th>
                  <th className="text-right p-3">H.Eff.</th>
                  <th className="text-right p-3">Brut</th>
                  <th className="text-right p-3">Net</th>
                  <th className="text-center p-3">Statut</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map(ps => {
                  const person = peopleMap[ps.employee_id];
                  const name = person ? `${person.first_name} ${person.last_name}` : ps.employee_id;
                  const st = STATUS_CONFIG[ps.status] || STATUS_CONFIG.draft;
                  return (
                    <tr key={ps.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium">{name}</td>
                      <td className="p-3 text-right font-mono text-xs">{Number(ps.scheduled_hours).toFixed(1)}</td>
                      <td className="p-3 text-right font-mono text-xs text-red-600">{Number(ps.absent_hours).toFixed(1)}</td>
                      <td className="p-3 text-right font-mono text-xs text-emerald-600">{Number(ps.overtime_hours).toFixed(1)}</td>
                      <td className="p-3 text-right font-mono text-xs font-semibold">{Number(ps.effective_hours).toFixed(1)}</td>
                      <td className="p-3 text-right text-xs">{Number(ps.gross_salary).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">{Number(ps.net_salary).toLocaleString()} DA</td>
                      <td className="p-3 text-center">
                        <Badge className={`${st.color} text-xs cursor-pointer`} onClick={() => setDetail(ps)}>{st.label}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          {ps.status === "draft" && (
                            <>
                              <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700 px-2" onClick={() => handleValidate(ps.id)}>Valider</Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => handleDelete(ps.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {ps.status === "validated" && (
                            <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 px-2" onClick={() => handleMarkPaid(ps.id)}>Marquer payé</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Détail fiche de paie */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        {detail && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Détail fiche de paie — {month}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Heures planifiées</span><span className="font-mono">{Number(detail.scheduled_hours).toFixed(1)} h</span></div>
                <div className="flex justify-between text-red-600"><span>− Heures absentes</span><span className="font-mono">{Number(detail.absent_hours).toFixed(1)} h</span></div>
                <div className="flex justify-between text-emerald-600"><span>+ Heures supplémentaires</span><span className="font-mono">{Number(detail.overtime_hours).toFixed(1)} h</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>= Heures effectives</span><span className="font-mono">{Number(detail.effective_hours).toFixed(1)} h</span></div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Taux horaire</span><span>{Number(detail.hourly_rate).toLocaleString()} DA/h</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Base mensuelle</span><span>{Number(detail.monthly_base).toLocaleString()} DA</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>Salaire brut</span><span>{Number(detail.gross_salary).toLocaleString()} DA</span></div>
                <div className="flex justify-between text-red-600"><span>− Déductions</span><span>{Number(detail.deductions).toLocaleString()} DA</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Salaire net</span><span className="text-emerald-700">{Number(detail.net_salary).toLocaleString()} DA</span></div>
              </div>
              <div className="text-xs text-slate-400 text-center">
                Formule : (H.eff × taux) + base − déductions = net
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
