import React, { useState } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, DollarSign, FileWarning, Plus, Loader2, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import NotifyParentButton from "@/components/notifications/NotifyParentButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_PAYMENT = {
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
  partial: { label: "Partiel", color: "bg-orange-100 text-orange-800" },
  paid: { label: "Payé", color: "bg-green-100 text-green-800" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-800" },
  litigation: { label: "Contentieux", color: "bg-red-200 text-red-900" },
};

const CATEGORIES = {
  scolarite: "Scolarité",
  cantine: "Cantine",
  transport: "Transport",
  activites: "Activités",
  fournitures: "Fournitures",
  autre: "Autre",
};

const LITIGATION_TYPES = {
  "impayé": "Impayé",
  "contestation": "Contestation",
  "remboursement": "Remboursement",
  "exonération": "Exonération",
  "autre": "Autre",
};

const LITIGATION_STATUS = {
  ouvert: { label: "Ouvert", color: "bg-red-100 text-red-800" },
  en_traitement: { label: "En traitement", color: "bg-yellow-100 text-yellow-800" },
  résolu: { label: "Résolu", color: "bg-green-100 text-green-800" },
  abandonné: { label: "Abandonné", color: "bg-slate-100 text-slate-800" },
};

export default function Finance() {
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [litigationFormOpen, setLitigationFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    student_id: "", label: "", amount: "", amount_paid: "", due_date: "",
    category: "scolarite", status: "pending", payment_method: "", school_year: "2024-2025", notes: "",
  });
  const [litigationForm, setLitigationForm] = useState({
    student_id: "", type: "impayé", amount: "", description: "",
    status: "ouvert", opened_date: new Date().toISOString().split("T")[0], notes: "",
  });

  const [payPage, setPayPage] = useState(1);
  const [litigPage, setLitigPage] = useState(1);
  const FIN_PAGE_SIZE = 20;

  const queryClient = useQueryClient();

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => base44.entities.Payment.list("-created_date"),
  });
  const { data: litigations = [], isLoading: loadingLitigations } = useQuery({
    queryKey: ["litigations"],
    queryFn: () => base44.entities.Litigation.list("-opened_date"),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  // Pagination slices
  const payTotalPages = Math.ceil(payments.length / FIN_PAGE_SIZE);
  const pagePayments = payments.slice((payPage - 1) * FIN_PAGE_SIZE, payPage * FIN_PAGE_SIZE);
  const litigTotalPages = Math.ceil(litigations.length / FIN_PAGE_SIZE);
  const pageLitigations = litigations.slice((litigPage - 1) * FIN_PAGE_SIZE, litigPage * FIN_PAGE_SIZE);

  // Financial KPIs
  const totalDue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalPending = payments.filter(p => p.status === "pending" || p.status === "partial").reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);
  const openLitigations = litigations.filter(l => l.status === "ouvert" || l.status === "en_traitement");
  const totalLitigationAmount = openLitigations.reduce((sum, l) => sum + (l.amount || 0), 0);
  const collectionRate = totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) : 0;

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Payment.create({ ...paymentForm, amount: Number(paymentForm.amount), amount_paid: Number(paymentForm.amount_paid || 0) });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    setSaving(false);
    setPaymentFormOpen(false);
  };

  const handleSaveLitigation = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Litigation.create({ ...litigationForm, amount: Number(litigationForm.amount) });
    queryClient.invalidateQueries({ queryKey: ["litigations"] });
    setSaving(false);
    setLitigationFormOpen(false);
  };

  const handleUpdateLitigationStatus = async (id, status) => {
    await base44.entities.Litigation.update(id, { status, ...(status === "résolu" ? { resolved_date: new Date().toISOString().split("T")[0] } : {}) });
    queryClient.invalidateQueries({ queryKey: ["litigations"] });
  };

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion Financière &amp; Contentieux</h1>
          <p className="text-slate-500 mt-1">Suivi des paiements, créances et contentieux</p>
        </div>
        <NotifyParentButton
          eventType="payment_overdue"
          students={payments
            .filter(p => p.status === "overdue")
            .map(p => {
              const st = studentMap[p.student_id];
              return st ? {
                ...st,
                extra_vars: {
                  label: p.label || "Paiement",
                  amount: String(p.amount || 0),
                  due_date: p.due_date || "",
                },
              } : null;
            })
            .filter(Boolean)}
          variables={{}}
          label="Rappel paiements en retard"
          variant="outline"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total encaissé</p>
                <p className="text-2xl font-bold text-green-600">{totalCollected.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-slate-400 mt-1">Taux: {collectionRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total attendu</p>
                <p className="text-2xl font-bold text-blue-600">{totalDue.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-slate-400 mt-1">{payments.length} paiements</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Créances</p>
                <p className="text-2xl font-bold text-orange-600">{totalOverdue.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-slate-400 mt-1">{payments.filter(p => p.status === "overdue").length} dossiers</p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Contentieux ouverts</p>
                <p className="text-2xl font-bold text-red-600">{openLitigations.length}</p>
                <p className="text-xs text-slate-400 mt-1">{totalLitigationAmount.toLocaleString("fr-FR")} € en jeu</p>
              </div>
              <FileWarning className="w-8 h-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar collection rate */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">Taux de recouvrement global</p>
            <span className="text-lg font-bold text-green-600">{collectionRate}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-4 rounded-full transition-all"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{totalCollected.toLocaleString("fr-FR")} € encaissés</span>
            <span>Objectif: {totalDue.toLocaleString("fr-FR")} €</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="payments">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="litigations">
              Contentieux
              {openLitigations.length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{openLitigations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPaymentFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Paiement
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLitigationFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Contentieux
            </Button>
          </div>
        </div>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Élève</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Encaissé</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagePayments.map(p => {
                      const student = studentMap[p.student_id];
                      const remaining = (p.amount || 0) - (p.amount_paid || 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {student ? `${student.first_name} ${student.last_name}` : "-"}
                          </TableCell>
                          <TableCell>{p.label}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{CATEGORIES[p.category] || p.category}</Badge>
                          </TableCell>
                          <TableCell>{(p.amount || 0).toLocaleString("fr-FR")} €</TableCell>
                          <TableCell>
                            <span className={remaining > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                              {(p.amount_paid || 0).toLocaleString("fr-FR")} €
                              {remaining > 0 && <span className="text-xs text-slate-400 ml-1">(reste {remaining.toLocaleString("fr-FR")}€)</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            {p.due_date ? format(new Date(p.due_date), "d MMM yyyy", { locale: fr }) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_PAYMENT[p.status]?.color || "bg-slate-100"}>
                              {STATUS_PAYMENT[p.status]?.label || p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {payments.length === 0 && !loadingPayments && (
                  <p className="text-center text-slate-500 py-8">Aucun paiement enregistré</p>
                )}
              </div>
              {payTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-slate-500">
                    {(payPage - 1) * FIN_PAGE_SIZE + 1}–{Math.min(payPage * FIN_PAGE_SIZE, payments.length)} sur {payments.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPayPage(p => Math.max(1, p - 1))}
                      disabled={payPage === 1}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: payTotalPages }, (_, i) => i + 1).map(pg => (
                      <button
                        key={pg}
                        onClick={() => setPayPage(pg)}
                        className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium ${pg === payPage ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-700"}`}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      onClick={() => setPayPage(p => Math.min(payTotalPages, p + 1))}
                      disabled={payPage === payTotalPages}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="litigations">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Élève</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ouvert le</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageLitigations.map(l => {
                      const student = studentMap[l.student_id];
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">
                            {student ? `${student.first_name} ${student.last_name}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{LITIGATION_TYPES[l.type] || l.type}</Badge>
                          </TableCell>
                          <TableCell className="font-bold text-red-600">
                            {(l.amount || 0).toLocaleString("fr-FR")} €
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="line-clamp-1">{l.description || "-"}</span>
                          </TableCell>
                          <TableCell>
                            {l.opened_date ? format(new Date(l.opened_date), "d MMM yyyy", { locale: fr }) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className={LITIGATION_STATUS[l.status]?.color || "bg-slate-100"}>
                              {LITIGATION_STATUS[l.status]?.label || l.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {l.status === "ouvert" && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateLitigationStatus(l.id, "en_traitement")}>
                                Prendre en charge
                              </Button>
                            )}
                            {l.status === "en_traitement" && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateLitigationStatus(l.id, "résolu")}>
                                <CheckCircle className="w-3 h-3 mr-1" /> Résoudre
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {litigations.length === 0 && !loadingLitigations && (
                  <p className="text-center text-slate-500 py-8">Aucun contentieux enregistré</p>
                )}
              </div>
              {litigTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-slate-500">
                    {(litigPage - 1) * FIN_PAGE_SIZE + 1}–{Math.min(litigPage * FIN_PAGE_SIZE, litigations.length)} sur {litigations.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLitigPage(p => Math.max(1, p - 1))}
                      disabled={litigPage === 1}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: litigTotalPages }, (_, i) => i + 1).map(pg => (
                      <button
                        key={pg}
                        onClick={() => setLitigPage(pg)}
                        className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium ${pg === litigPage ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-700"}`}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      onClick={() => setLitigPage(p => Math.min(litigTotalPages, p + 1))}
                      disabled={litigPage === litigTotalPages}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Form */}
      <Dialog open={paymentFormOpen} onOpenChange={setPaymentFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau paiement</DialogTitle></DialogHeader>
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Élève *</Label>
              <Select value={paymentForm.student_id} onValueChange={v => setPaymentForm({ ...paymentForm, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Libellé *</Label>
              <Input value={paymentForm.label} onChange={e => setPaymentForm({ ...paymentForm, label: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={paymentForm.category} onValueChange={v => setPaymentForm({ ...paymentForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={paymentForm.status} onValueChange={v => setPaymentForm({ ...paymentForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_PAYMENT).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant (€) *</Label>
                <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Montant encaissé (€)</Label>
                <Input type="number" value={paymentForm.amount_paid} onChange={e => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date d'échéance *</Label>
                <Input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm({ ...paymentForm, due_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select value={paymentForm.payment_method} onValueChange={v => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Litigation Form */}
      <Dialog open={litigationFormOpen} onOpenChange={setLitigationFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau contentieux</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveLitigation} className="space-y-4">
            <div className="space-y-2">
              <Label>Élève *</Label>
              <Select value={litigationForm.student_id} onValueChange={v => setLitigationForm({ ...litigationForm, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={litigationForm.type} onValueChange={v => setLitigationForm({ ...litigationForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LITIGATION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Montant (€) *</Label>
                <Input type="number" value={litigationForm.amount} onChange={e => setLitigationForm({ ...litigationForm, amount: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={litigationForm.description} onChange={e => setLitigationForm({ ...litigationForm, description: e.target.value })} rows={3} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date d'ouverture</Label>
                <Input type="date" value={litigationForm.opened_date} onChange={e => setLitigationForm({ ...litigationForm, opened_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Assigné à</Label>
                <Input value={litigationForm.assigned_to} onChange={e => setLitigationForm({ ...litigationForm, assigned_to: e.target.value })} placeholder="Nom du responsable" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLitigationFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}