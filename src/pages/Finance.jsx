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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, DollarSign,
  FileWarning, Plus, Loader2, ChevronLeft, ChevronRight, Trash2,
  Receipt, Settings, FileText, Zap, Eye
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSession } from "@/components/auth/appAuth";
import NotifyParentButton from "@/components/notifications/NotifyParentButton";
import toast from "react-hot-toast";

const FIN_API = "http://localhost:3001/api/finv2";
function apiFetch(path, opts = {}) {
  const s = getSession();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (s?.token) headers["X-Session-Token"] = s.token;
  return fetch(`${FIN_API}${path}`, { ...opts, headers }).then(r => r.json());
}

const CURRENT_YEAR = "2024-2025";

const STATUS_CONFIG = {
  paid:    { label: "Payé",      color: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Partiel",   color: "bg-amber-100 text-amber-800" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-800" },
  unpaid:  { label: "Impayé",    color: "bg-slate-100 text-slate-700" },
};

const FEE_TYPES = {
  inscription:  "Inscription",
  scolarite:    "Scolarité",
  transport:    "Transport",
  cantine:      "Cantine",
  activites:    "Activités",
  autre:        "Autre",
};

const FREQUENCIES = {
  once:    "Unique",
  annual:  "Annuel",
  monthly: "Mensuel",
  forfait: "Forfait",
};

const PAYMENT_METHODS = {
  cash:     "Espèces",
  cheque:   "Chèque",
  virement: "Virement",
  carte:    "Carte bancaire",
};

const LITIGATION_STATUS = {
  ouvert:        { label: "Ouvert",        color: "bg-red-100 text-red-800" },
  en_traitement: { label: "En traitement", color: "bg-yellow-100 text-yellow-800" },
  résolu:        { label: "Résolu",        color: "bg-green-100 text-green-800" },
  abandonné:     { label: "Abandonné",     color: "bg-slate-100 text-slate-800" },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, borderColor = "border-l-slate-400" }) {
  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="text-slate-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

// ── Invoice Detail Dialog ────────────────────────────────────────────────────
function InvoiceDetailDialog({ invoice, student, onClose, onPaymentAdded }) {
  const session = getSession();
  const qc = useQueryClient();
  const [payForm, setPayForm] = useState({
    amount: "", payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash", reference: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ["fin_invoice_detail", invoice?.id],
    queryFn: () => apiFetch(`/invoices/${invoice.id}`),
    enabled: !!invoice?.id,
  });

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error("Montant invalide");
    setSaving(true);
    const res = await apiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({ ...payForm, invoice_id: invoice.id, amount: Number(payForm.amount), recorded_by: session?.full_name }),
    });
    setSaving(false);
    if (res.id) {
      toast.success("Paiement enregistré");
      qc.invalidateQueries({ queryKey: ["fin_invoice_detail", invoice.id] });
      qc.invalidateQueries({ queryKey: ["fin_invoices"] });
      qc.invalidateQueries({ queryKey: ["fin_dashboard"] });
      onPaymentAdded?.();
      setPayForm({ amount: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "", notes: "" });
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleDeleteTx = async (txId) => {
    await apiFetch(`/transactions/${txId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["fin_invoice_detail", invoice.id] });
    qc.invalidateQueries({ queryKey: ["fin_invoices"] });
    qc.invalidateQueries({ queryKey: ["fin_dashboard"] });
  };

  const fmt = n => Number(n || 0).toLocaleString("fr-DZ") + " DA";
  const pct = detail ? Math.min(100, Math.round(((detail.paid_amount || 0) / Math.max(1, detail.net_amount || 1)) * 100)) : 0;

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      {invoice && (
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              Facture — {student?.first_name} {student?.last_name}
            </DialogTitle>
          </DialogHeader>

          {!detail ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-4">
              {/* Progress */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 font-medium">{detail.label || "Facture"}</span>
                  <span className="font-bold text-indigo-700">{pct}% payé</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Payé : {fmt(detail.paid_amount)}</span>
                  <span>Reste : {fmt(detail.balance)}</span>
                  <span>Total : {fmt(detail.net_amount)}</span>
                </div>
              </div>

              {/* Items */}
              {detail.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Détail des frais</p>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="text-left p-2">Désignation</th>
                        <th className="text-right p-2">Qté</th>
                        <th className="text-right p-2">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.items.map(it => (
                        <tr key={it.id}>
                          <td className="p-2">{it.label}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2 text-right font-mono">{fmt(it.amount * it.quantity)}</td>
                        </tr>
                      ))}
                      {detail.discount_amount > 0 && (
                        <tr className="text-green-700">
                          <td className="p-2" colSpan={2}>Remise ({detail.discount_reason || "—"})</td>
                          <td className="p-2 text-right font-mono">− {fmt(detail.discount_amount)}</td>
                        </tr>
                      )}
                      <tr className="font-semibold bg-slate-50">
                        <td className="p-2" colSpan={2}>Total net</td>
                        <td className="p-2 text-right font-mono">{fmt(detail.net_amount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Transactions */}
              {detail.transactions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historique des paiements</p>
                  <div className="space-y-1.5">
                    {detail.transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="font-semibold text-emerald-800">{fmt(tx.amount)}</span>
                            <span className="text-slate-500 text-xs ml-2">
                              {PAYMENT_METHODS[tx.payment_method] || tx.payment_method}
                              {tx.reference ? ` · Réf: ${tx.reference}` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {format(new Date(tx.payment_date + "T12:00:00"), "d MMM yyyy", { locale: fr })}
                          </span>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="text-red-300 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Record payment */}
              {detail.status !== "paid" && (
                <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/40">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">Enregistrer un paiement</p>
                  <form onSubmit={handlePay} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Montant (DA) *</Label>
                        <Input type="number" min="1" step="100"
                          placeholder={`Max: ${Math.round(detail.balance)}`}
                          value={payForm.amount}
                          onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={payForm.payment_date}
                          onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Mode</Label>
                        <Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Référence</Label>
                        <Input placeholder="N° chèque, virement…" value={payForm.reference}
                          onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enregistrer le paiement
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Finance() {
  const session = getSession();
  const qc = useQueryClient();
  const [schoolYear, setSchoolYear] = useState(CURRENT_YEAR);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Fee structure form
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({ name: "", fee_type: "scolarite", amount: "", frequency: "annual", school_year: CURRENT_YEAR, description: "" });
  const [feeEditing, setFeeEditing] = useState(null);

  // Invoice form
  const [invFormOpen, setInvFormOpen] = useState(false);
  const [invForm, setInvForm] = useState({ student_id: "", items: [], discount_amount: "", discount_reason: "", notes: "" });

  // Pagination
  const [invPage, setInvPage] = useState(1);
  const PAGE_SIZE = 20;

  // Litigation
  const [litigFormOpen, setLitigFormOpen] = useState(false);
  const [litigForm, setLitigForm] = useState({ student_id: "", type: "impayé", amount: "", description: "", status: "ouvert", opened_date: new Date().toISOString().split("T")[0] });

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: () => base44.entities.Student.list() });
  const { data: litigations = [] } = useQuery({ queryKey: ["litigations"], queryFn: () => base44.entities.Litigation.list("-opened_date") });

  const { data: dashboard = {} } = useQuery({
    queryKey: ["fin_dashboard", schoolYear],
    queryFn: () => apiFetch(`/dashboard?school_year=${schoolYear}`),
  });

  const { data: feeStructures = [] } = useQuery({
    queryKey: ["fin_fee_structures", schoolYear],
    queryFn: () => apiFetch(`/fee-structures?school_year=${schoolYear}`),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["fin_invoices", schoolYear],
    queryFn: () => apiFetch(`/invoices?school_year=${schoolYear}`),
  });

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);

  const filteredInvoices = useMemo(
    () => statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter),
    [invoices, statusFilter]
  );
  const pageInvoices = filteredInvoices.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);

  const openLitigations = litigations.filter(l => ["ouvert", "en_traitement"].includes(l.status));
  const fmt = n => Number(n || 0).toLocaleString("fr-DZ") + " DA";

  // ── Fee structure handlers ──
  const handleSaveFee = async (e) => {
    e.preventDefault();
    const payload = { ...feeForm, amount: Number(feeForm.amount) };
    if (feeEditing) {
      await apiFetch(`/fee-structures/${feeEditing}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/fee-structures", { method: "POST", body: JSON.stringify(payload) });
    }
    qc.invalidateQueries({ queryKey: ["fin_fee_structures", schoolYear] });
    setFeeFormOpen(false);
    setFeeEditing(null);
    setFeeForm({ name: "", fee_type: "scolarite", amount: "", frequency: "annual", school_year: schoolYear, description: "" });
    toast.success(feeEditing ? "Frais modifié" : "Frais créé");
  };

  const handleDeleteFee = async (id) => {
    if (!confirm("Supprimer ce type de frais ?")) return;
    await apiFetch(`/fee-structures/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["fin_fee_structures", schoolYear] });
    toast.success("Supprimé");
  };

  const openEditFee = (fee) => {
    setFeeForm({ name: fee.name, fee_type: fee.fee_type, amount: String(fee.amount), frequency: fee.frequency, school_year: fee.school_year, description: fee.description || "" });
    setFeeEditing(fee.id);
    setFeeFormOpen(true);
  };

  // ── Generate bulk ──
  const handleGenerateBulk = async () => {
    if (!feeStructures.length) return toast.error("Aucun frais configuré pour cette année.");
    if (!confirm(`Générer les factures pour tous les élèves non encore facturés (${students.length} élèves) ?`)) return;
    setGenerating(true);
    const res = await apiFetch("/invoices/generate-bulk", {
      method: "POST",
      body: JSON.stringify({ school_year: schoolYear, student_ids: students.map(s => s.id), created_by: session?.full_name }),
    });
    setGenerating(false);
    if (res.ok !== undefined) {
      toast.success(`${res.created} facture(s) créée(s) · ${res.skipped} ignorée(s) (déjà existantes)`);
      qc.invalidateQueries({ queryKey: ["fin_invoices", schoolYear] });
      qc.invalidateQueries({ queryKey: ["fin_dashboard", schoolYear] });
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  // ── Delete invoice ──
  const handleDeleteInvoice = async (id) => {
    if (!confirm("Supprimer cette facture et tous ses paiements ?")) return;
    const res = await apiFetch(`/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["fin_invoices", schoolYear] });
      qc.invalidateQueries({ queryKey: ["fin_dashboard", schoolYear] });
      toast.success("Facture supprimée");
    }
  };

  // ── Litigation handlers ──
  const handleSaveLitig = async (e) => {
    e.preventDefault();
    await base44.entities.Litigation.create({ ...litigForm, amount: Number(litigForm.amount) });
    qc.invalidateQueries({ queryKey: ["litigations"] });
    setLitigFormOpen(false);
    toast.success("Contentieux créé");
  };

  const handleLitigStatus = async (id, status) => {
    await base44.entities.Litigation.update(id, { status, ...(status === "résolu" ? { resolved_date: new Date().toISOString().split("T")[0] } : {}) });
    qc.invalidateQueries({ queryKey: ["litigations"] });
  };

  const collectionRate = Number(dashboard.collection_rate || 0);

  return (
    <div>
      <PageHeader title="Finance & Scolarité" description="Facturation, paiements et recouvrement" />

      {/* School year selector */}
      <div className="flex items-center gap-3 mb-6">
        <Label className="text-sm text-slate-600 whitespace-nowrap">Année scolaire :</Label>
        <Input value={schoolYear} onChange={e => setSchoolYear(e.target.value)} className="w-32" placeholder="2024-2025" />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="frais">Frais & Tarifs</TabsTrigger>
          <TabsTrigger value="factures">
            Factures
            {invoices.filter(i => i.status === "overdue").length > 0 && (
              <Badge className="ml-1.5 bg-red-500 text-white text-[10px]">
                {invoices.filter(i => i.status === "overdue").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contentieux">
            Contentieux
            {openLitigations.length > 0 && (
              <Badge className="ml-1.5 bg-red-500 text-white text-[10px]">{openLitigations.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── DASHBOARD ───────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total attendu" value={fmt(dashboard.total_expected)} sub={`${dashboard.total_invoices || 0} factures`} icon={<DollarSign className="w-8 h-8" />} borderColor="border-l-blue-500" />
            <KpiCard label="Encaissé" value={fmt(dashboard.total_collected)} sub={`Taux : ${collectionRate}%`} icon={<TrendingUp className="w-8 h-8" />} borderColor="border-l-emerald-500" />
            <KpiCard label="Reste à percevoir" value={fmt(dashboard.total_balance)} sub="Toutes factures" icon={<TrendingDown className="w-8 h-8" />} borderColor="border-l-amber-500" />
            <KpiCard label="Ce mois-ci" value={fmt(dashboard.month_collected)} sub="Encaissements" icon={<Receipt className="w-8 h-8" />} borderColor="border-l-indigo-500" />
          </div>

          {/* Collection rate bar */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800">Taux de recouvrement global</p>
                <span className={`text-lg font-bold ${collectionRate >= 80 ? "text-emerald-600" : collectionRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {collectionRate}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${collectionRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : collectionRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-gradient-to-r from-red-400 to-red-600"}`}
                  style={{ width: `${Math.min(collectionRate, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{fmt(dashboard.total_collected)} encaissés</span>
                <span>Objectif : {fmt(dashboard.total_expected)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status breakdown */}
          {dashboard.by_status && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <Card key={key} className="text-center">
                  <CardContent className="p-4">
                    <Badge className={`${cfg.color} mb-2`}>{cfg.label}</Badge>
                    <p className="text-2xl font-bold text-slate-800">{dashboard.by_status[key] || 0}</p>
                    <p className="text-xs text-slate-400">factures</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Quick action */}
          <div className="flex gap-3">
            <NotifyParentButton
              eventType="payment_overdue"
              students={invoices.filter(i => i.status === "overdue").map(i => {
                const st = studentMap[i.student_id];
                return st ? { ...st, extra_vars: { label: i.label || "Scolarité", amount: String(i.balance || 0), due_date: "" } } : null;
              }).filter(Boolean)}
              variables={{}}
              label="Rappel impayés"
              variant="outline"
            />
          </div>
        </TabsContent>

        {/* ─── FRAIS & TARIFS ───────────────────────────────────────────────── */}
        <TabsContent value="frais">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">{feeStructures.length} frais configurés pour {schoolYear}</p>
            <Button size="sm" onClick={() => { setFeeEditing(null); setFeeForm({ name: "", fee_type: "scolarite", amount: "", frequency: "annual", school_year: schoolYear, description: "" }); setFeeFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Nouveau frais
            </Button>
          </div>

          {feeStructures.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun frais configuré — ajoutez les types de frais applicables à cette année scolaire.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left p-3">Désignation</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Fréquence</th>
                      <th className="text-right p-3">Montant</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feeStructures.map(fs => (
                      <tr key={fs.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium">
                          {fs.name}
                          {fs.description && <p className="text-xs text-slate-400">{fs.description}</p>}
                        </td>
                        <td className="p-3"><Badge variant="outline">{FEE_TYPES[fs.fee_type] || fs.fee_type}</Badge></td>
                        <td className="p-3 text-slate-500 text-xs">{FREQUENCIES[fs.frequency] || fs.frequency}</td>
                        <td className="p-3 text-right font-semibold">{fmt(fs.amount)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEditFee(fs)}>Modifier</Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => handleDeleteFee(fs.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="p-3" colSpan={3}>Total annuel par élève</td>
                      <td className="p-3 text-right">{fmt(feeStructures.reduce((s, f) => s + Number(f.amount || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── FACTURES ────────────────────────────────────────────────────── */}
        <TabsContent value="factures">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setInvPage(1); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Tous statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500">{filteredInvoices.length} facture(s)</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateBulk} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
                Générer pour tous les élèves
              </Button>
            </div>
          </div>

          {loadingInvoices ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune facture — configurez les frais puis cliquez sur "Générer pour tous les élèves"</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left p-3">Élève</th>
                      <th className="text-left p-3 hidden md:table-cell">Libellé</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-right p-3">Payé</th>
                      <th className="text-right p-3">Reste</th>
                      <th className="text-center p-3">%</th>
                      <th className="text-center p-3">Statut</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageInvoices.map(inv => {
                      const student = studentMap[inv.student_id];
                      const pct = Math.min(100, Math.round(((inv.paid_amount || 0) / Math.max(1, inv.net_amount || 1)) * 100));
                      const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.unpaid;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium">
                            {student ? `${student.first_name} ${student.last_name}` : inv.student_id}
                          </td>
                          <td className="p-3 text-slate-500 text-xs hidden md:table-cell">{inv.label || "—"}</td>
                          <td className="p-3 text-right font-mono text-xs">{Number(inv.net_amount||0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-xs text-emerald-600">{Number(inv.paid_amount||0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-xs font-semibold text-red-600">{Number(inv.balance||0).toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400">{pct}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={`${st.color} text-xs`}>{st.label}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700"
                                onClick={() => { setSelectedInvoice(inv); setSelectedStudent(student || null); }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                onClick={() => handleDeleteInvoice(inv.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-slate-500">
                      {(invPage - 1) * PAGE_SIZE + 1}–{Math.min(invPage * PAGE_SIZE, filteredInvoices.length)} sur {filteredInvoices.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pg => (
                        <button key={pg} onClick={() => setInvPage(pg)} className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium ${pg === invPage ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-700"}`}>{pg}</button>
                      ))}
                      <button onClick={() => setInvPage(p => Math.min(totalPages, p + 1))} disabled={invPage === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── CONTENTIEUX ─────────────────────────────────────────────────── */}
        <TabsContent value="contentieux">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">{openLitigations.length} dossier(s) ouverts</p>
            <Button size="sm" onClick={() => setLitigFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nouveau contentieux
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left p-3">Élève</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Montant</th>
                    <th className="text-left p-3 hidden md:table-cell">Description</th>
                    <th className="text-left p-3 hidden md:table-cell">Ouvert le</th>
                    <th className="text-center p-3">Statut</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {litigations.map(l => {
                    const student = studentMap[l.student_id];
                    const st = LITIGATION_STATUS[l.status] || LITIGATION_STATUS.ouvert;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium">{student ? `${student.first_name} ${student.last_name}` : "—"}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{l.type}</Badge></td>
                        <td className="p-3 text-right font-bold text-red-600">{Number(l.amount || 0).toLocaleString()} DA</td>
                        <td className="p-3 text-slate-500 text-xs hidden md:table-cell max-w-[200px]"><span className="line-clamp-1">{l.description || "—"}</span></td>
                        <td className="p-3 text-xs text-slate-500 hidden md:table-cell">
                          {l.opened_date ? format(new Date(l.opened_date), "d MMM yyyy", { locale: fr }) : "—"}
                        </td>
                        <td className="p-3 text-center"><Badge className={`${st.color} text-xs`}>{st.label}</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            {l.status === "ouvert" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleLitigStatus(l.id, "en_traitement")}>Prendre en charge</Button>
                            )}
                            {l.status === "en_traitement" && (
                              <Button size="sm" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleLitigStatus(l.id, "résolu")}>
                                <CheckCircle className="w-3 h-3 mr-1" /> Résoudre
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {litigations.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Aucun contentieux enregistré</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Invoice Detail ─── */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        student={selectedStudent}
        onClose={() => setSelectedInvoice(null)}
        onPaymentAdded={() => {}}
      />

      {/* ── Fee Structure Form ─── */}
      <Dialog open={feeFormOpen} onOpenChange={setFeeFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{feeEditing ? "Modifier" : "Nouveau"} type de frais</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveFee} className="space-y-4">
            <div className="space-y-1">
              <Label>Désignation *</Label>
              <Input value={feeForm.name} onChange={e => setFeeForm({ ...feeForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={feeForm.fee_type} onValueChange={v => setFeeForm({ ...feeForm, fee_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FEE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fréquence</Label>
                <Select value={feeForm.frequency} onValueChange={v => setFeeForm({ ...feeForm, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FREQUENCIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Montant (DA) *</Label>
                <Input type="number" min="0" step="100" value={feeForm.amount} onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Année scolaire</Label>
                <Input value={feeForm.school_year} onChange={e => setFeeForm({ ...feeForm, school_year: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={feeForm.description} onChange={e => setFeeForm({ ...feeForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFeeFormOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Litigation Form ─── */}
      <Dialog open={litigFormOpen} onOpenChange={setLitigFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau contentieux</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveLitig} className="space-y-4">
            <div className="space-y-1">
              <Label>Élève *</Label>
              <Select value={litigForm.student_id} onValueChange={v => setLitigForm({ ...litigForm, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={litigForm.type} onValueChange={v => setLitigForm({ ...litigForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["impayé","contestation","remboursement","exonération","autre"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Montant (DA) *</Label>
                <Input type="number" value={litigForm.amount} onChange={e => setLitigForm({ ...litigForm, amount: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Textarea rows={3} value={litigForm.description} onChange={e => setLitigForm({ ...litigForm, description: e.target.value })} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLitigFormOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
