import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Send, Loader2, MessageSquare, Clock, CheckCircle,
  XCircle, AlertTriangle, Filter, Ticket, RefreshCw, Trash2,
  ChevronRight, ChevronDown, User, UserCheck, Inbox, Settings2,
} from "lucide-react";

// ── API helpers ────────────────────────────────────────────────────────────────
function apiHeaders() {
  const s = JSON.parse(localStorage.getItem('edugest_session') || '{}');
  const h = { 'Content-Type': 'application/json' };
  if (s.token) h['X-Session-Token'] = s.token;
  if (s.id)    h['X-User-Id'] = s.id;
  return h;
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: apiHeaders(), ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TICKET_TYPES = [
  { value: "impression",    label: "Demande d'impression",         icon: "🖨️" },
  { value: "fournitures",   label: "Fournitures (papier, stylos)",  icon: "✏️" },
  { value: "equipement",    label: "Équipement informatique",       icon: "💻" },
  { value: "acces_module",  label: "Accès à un module",             icon: "🔓" },
  { value: "acces_salle",   label: "Accès / Clé de salle",          icon: "🔑" },
  { value: "maintenance",   label: "Maintenance / Réparation",      icon: "🔧" },
  { value: "nettoyage",     label: "Nettoyage / Hygiène",           icon: "🧹" },
  { value: "reunion",       label: "Demande de réunion",            icon: "🤝" },
  { value: "document",      label: "Document administratif",        icon: "📁" },
  { value: "attestation",   label: "Attestation / Certificat",      icon: "📜" },
  { value: "conge",         label: "Congé / Absence",               icon: "📅" },
  { value: "formation",     label: "Demande de formation",          icon: "🎓" },
  { value: "budget",        label: "Demande budgétaire",            icon: "💰" },
  { value: "communication", label: "Communication interne",         icon: "📢" },
  { value: "reparation",    label: "Réparation mobilier / salle",   icon: "🪑" },
  { value: "signalement",   label: "Signalement / Incident",        icon: "⚠️" },
  { value: "autorisation",  label: "Demande d'autorisation",        icon: "✅" },
  { value: "autre",         label: "Autre demande",                 icon: "📋" },
];

const PRIORITIES = [
  { value: "faible",  label: "Faible",  color: "bg-green-100 text-green-700 border-green-200",  ring: "ring-green-400" },
  { value: "normale", label: "Normale", color: "bg-blue-100 text-blue-700 border-blue-200",     ring: "ring-blue-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700 border-red-200",        ring: "ring-red-400" },
];

const STATUSES = [
  { value: "nouveau",  label: "Nouveau",  color: "bg-slate-100 text-slate-600 border-slate-200",   icon: Clock },
  { value: "en_cours", label: "En cours", color: "bg-amber-100 text-amber-700 border-amber-200",   icon: RefreshCw },
  { value: "résolu",   label: "Résolu",   color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle },
  { value: "fermé",    label: "Fermé",    color: "bg-slate-200 text-slate-500 border-slate-300",   icon: XCircle },
];

function getTypeInfo(val) { return TICKET_TYPES.find(t => t.value === val) || { label: val, icon: "📋" }; }
function getPriorityInfo(val) { return PRIORITIES.find(p => p.value === val) || PRIORITIES[1]; }
function getStatusInfo(val) { return STATUSES.find(s => s.value === val) || STATUSES[0]; }

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────
function TicketFormModal({ open, onClose, onSaved, users, currentUser }) {
  const [form, setForm] = useState({
    title: "", type: "_pick", description: "", priority: "normale",
    assigned_to_id: "", assigned_to_name: "", assigned_to_role: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAssign = (userId) => {
    if (userId === "_none") { set("assigned_to_id", ""); set("assigned_to_name", ""); set("assigned_to_role", ""); return; }
    const u = users.find(u => u.id === userId);
    if (u) { set("assigned_to_id", u.id); set("assigned_to_name", u.full_name || u.login); set("assigned_to_role", u.role || ""); }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return setErr("Le titre est obligatoire.");
    if (!form.type || form.type === "_pick") return setErr("Choisissez un type de demande.");
    setSaving(true); setErr("");
    try {
      await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          requester_id:   currentUser?.id   || "",
          requester_name: currentUser?.full_name || currentUser?.login || "",
          requester_role: currentUser?.role  || "",
        }),
      });
      onSaved();
      onClose();
      setForm({ title: "", type: "_pick", description: "", priority: "normale", assigned_to_id: "", assigned_to_name: "", assigned_to_role: "" });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-indigo-600" />
            Nouvelle demande
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titre */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Titre *</label>
            <Input placeholder="Ex : Besoin de ramettes A4 pour la salle 12..." value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Type de demande *</label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue placeholder="Choisir un type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_pick" disabled>Choisir un type...</SelectItem>
                {TICKET_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Description (optionnel)</label>
            <Textarea
              placeholder="Décrivez votre demande en détail..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Priorité</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => set("priority", p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.priority === p.value ? `${p.color} ring-2 ${p.ring}` : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigné à */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Assigner à</label>
            <Select value={form.assigned_to_id || "_none"} onValueChange={handleAssign}>
              <SelectTrigger><SelectValue placeholder="Choisir une personne..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Non assigné</SelectItem>
                {users.filter(u => u.id !== currentUser?.id).map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.login} {u.role ? `(${u.role})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Soumettre la demande
            </Button>
            <Button variant="outline" onClick={onClose}>Annuler</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Ticket Detail Modal ────────────────────────────────────────────────────────
function TicketDetailModal({ ticket, open, onClose, onUpdate, users, currentUser, isDirector }) {
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [resolutionNote, setResolutionNote] = useState(ticket?.resolution_note || "");
  const [updating, setUpdating] = useState(false);

  const queryClient = useQueryClient();

  if (!ticket) return null;
  const typeInfo = getTypeInfo(ticket.type);
  const statusInfo = getStatusInfo(ticket.status);
  const priorityInfo = getPriorityInfo(ticket.priority);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, resolution_note: resolutionNote }),
    });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    onUpdate?.();
    setUpdating(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    await apiFetch(`/api/tickets/${ticket.id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ author: currentUser?.full_name || currentUser?.login || "Moi", text: commentText }),
    });
    setCommentText("");
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    onUpdate?.();
    setSendingComment(false);
  };

  const handleReassign = async (userId) => {
    const u = users.find(u => u.id === userId);
    if (!u) return;
    await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'PUT',
      body: JSON.stringify({ assigned_to_id: u.id, assigned_to_name: u.full_name || u.login, assigned_to_role: u.role || "" }),
    });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    onUpdate?.();
  };

  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{typeInfo.icon}</span>
            <span className="flex-1 text-base">{ticket.title}</span>
            <Badge className={`border text-xs font-semibold ${priorityInfo.color}`}>{priorityInfo.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Info row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Statut</p>
              <Badge className={`border text-xs font-semibold gap-1 ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Demandeur</p>
              <p className="text-xs font-medium text-slate-700 truncate">{ticket.requester_name || "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Assigné à</p>
              <p className="text-xs font-medium text-slate-700 truncate">{ticket.assigned_to_name || "Non assigné"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Créé le</p>
              <p className="text-xs text-slate-600">{fmtDate(ticket.created_date)}</p>
            </div>
          </div>

          {/* Description */}
          {ticket.description && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Description</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{ticket.description}</p>
            </div>
          )}

          {/* Status actions */}
          {ticket.status !== "fermé" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Changer le statut</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter(s => s.value !== ticket.status && s.value !== "fermé").map(s => {
                  const Icon = s.icon;
                  return (
                    <Button key={s.value} variant="outline" size="sm" disabled={updating}
                      onClick={() => handleStatusChange(s.value)}
                      className={`gap-1.5 text-xs border ${s.color}`}
                    >
                      <Icon className="w-3 h-3" /> Passer à "{s.label}"
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={updating}
                  onClick={() => handleStatusChange("fermé")}
                  className="gap-1.5 text-xs border text-slate-500">
                  <XCircle className="w-3 h-3" /> Fermer le ticket
                </Button>
              </div>
            </div>
          )}

          {/* Note de résolution */}
          {(ticket.status === "résolu" || ticket.status === "fermé") && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">Note de résolution</p>
              <Textarea
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
                placeholder="Comment a été résolu ce ticket ?"
                className="min-h-[60px] resize-none text-sm"
              />
              <Button size="sm" variant="outline" className="text-xs"
                onClick={() => apiFetch(`/api/tickets/${ticket.id}`, {
                  method: 'PUT', body: JSON.stringify({ resolution_note: resolutionNote }),
                }).then(() => { queryClient.invalidateQueries({ queryKey: ["tickets"] }); onUpdate?.(); })}>
                Enregistrer la note
              </Button>
            </div>
          )}

          {/* Réassignation */}
          {(isDirector || ticket.requester_id === currentUser?.id) && ticket.status !== "fermé" && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Réassigner à</p>
              <Select value={ticket.assigned_to_id || "_none"} onValueChange={handleReassign}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Non assigné</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.login} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Commentaires */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Commentaires ({(ticket.comments || []).length})
            </p>

            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {(ticket.comments || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">Aucun commentaire</p>
              ) : (
                [...(ticket.comments || [])].reverse().map(c => (
                  <div key={c.id} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-700">{c.author}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(c.date)}</p>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-line">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {ticket.status !== "fermé" && (
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 min-h-[60px] resize-none text-xs"
                  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleAddComment(); }}
                />
                <Button size="sm" onClick={handleAddComment} disabled={sendingComment || !commentText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 self-end gap-1 px-3">
                  {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Ticket Card ────────────────────────────────────────────────────────────────
function TicketCard({ ticket, onSelect, onDelete, currentUser, isDirector }) {
  const typeInfo = getTypeInfo(ticket.type);
  const statusInfo = getStatusInfo(ticket.status);
  const priorityInfo = getPriorityInfo(ticket.priority);
  const StatusIcon = statusInfo.icon;
  const isMine = ticket.requester_id === currentUser?.id;
  const isAssignedToMe = ticket.assigned_to_id === currentUser?.id;
  const canDelete = (isMine || isDirector) && ticket.status !== "en_cours";

  const borderColor = ticket.priority === "urgente" ? "border-l-red-500"
    : ticket.status === "résolu" || ticket.status === "fermé" ? "border-l-green-400"
    : ticket.status === "en_cours" ? "border-l-amber-400"
    : "border-l-indigo-400";

  return (
    <Card className={`border-l-4 ${borderColor} hover:shadow-sm transition-all cursor-pointer`}
      onClick={() => onSelect(ticket)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0 mt-0.5">{typeInfo.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">{ticket.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{typeInfo.label}</p>
              {ticket.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ticket.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <Badge className={`border text-[10px] font-semibold ${priorityInfo.color}`}>{priorityInfo.label}</Badge>
            <Badge className={`border text-[10px] font-semibold gap-1 ${statusInfo.color}`}>
              <StatusIcon className="w-2.5 h-2.5" />{statusInfo.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{ticket.requester_name || "—"}</span>
            {ticket.assigned_to_name && (
              <span className="flex items-center gap-1"><UserCheck className="w-3 h-3 text-indigo-400" />{ticket.assigned_to_name}</span>
            )}
            {(ticket.comments || []).length > 0 && (
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{ticket.comments.length}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">{fmtDate(ticket.created_date).split(" à")[0]}</span>
            {canDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(ticket.id); }}
                className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Tickets() {
  const session = JSON.parse(localStorage.getItem('edugest_session') || '{}');
  const currentUser = session; // { id, full_name, login, role }
  const role = currentUser.role || localStorage.getItem("edugest_role");
  const isDirector = ["directeur_general", "directeur_primaire", "directeur_college", "directeur_lycee", "admin_systeme"].includes(role);

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState("_all");
  const [filterPriority, setFilterPriority] = useState("_all");
  const [filterType, setFilterType] = useState("_all");
  const [search, setSearch] = useState("");

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiFetch('/api/tickets'),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ["appUsers_tickets"],
    queryFn: () => base44.entities.AppUser.list(),
  });

  // Filter only active users (exclude eleve/parent for assignment)
  const assignableUsers = useMemo(() =>
    appUsers.filter(u => u.status === "active" && !["eleve", "parent"].includes(u.role)),
    [appUsers]
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/tickets/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filterTickets = (list) => list.filter(t => {
    if (filterStatus !== "_all" && t.status !== filterStatus) return false;
    if (filterPriority !== "_all" && t.priority !== filterPriority) return false;
    if (filterType !== "_all" && t.type !== filterType) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const myTickets      = filterTickets(tickets.filter(t => t.requester_id === currentUser.id));
  const assignedToMe   = filterTickets(tickets.filter(t => t.assigned_to_id === currentUser.id));
  const allTickets     = filterTickets(tickets);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = {
    total:    tickets.length,
    nouveau:  tickets.filter(t => t.status === "nouveau").length,
    en_cours: tickets.filter(t => t.status === "en_cours").length,
    resolu:   tickets.filter(t => t.status === "résolu").length,
    urgent:   tickets.filter(t => t.priority === "urgente" && t.status !== "fermé" && t.status !== "résolu").length,
    assigned: tickets.filter(t => t.assigned_to_id === currentUser.id && t.status !== "fermé").length,
  };

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    // Refresh selected ticket data
    if (selectedTicket) {
      queryClient.fetchQuery({ queryKey: ["tickets"] })
        .then(data => {
          const updated = data.find(t => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }).catch(() => {});
    }
  };

  const TicketList = ({ list }) => (
    <div className="space-y-3">
      {list.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun ticket correspondant</p>
        </div>
      ) : (
        list.map(t => (
          <TicketCard
            key={t.id}
            ticket={t}
            onSelect={setSelectedTicket}
            onDelete={id => deleteMutation.mutate(id)}
            currentUser={currentUser}
            isDirector={isDirector}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Demandes Internes</h1>
              <p className="text-white/70 text-sm mt-0.5">Système de ticketing — Impressions, fournitures, accès, maintenance…</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nouvelle demande
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",      value: stats.total,    color: "text-slate-700",  bg: "bg-slate-50 border-slate-200"  },
          { label: "Nouveaux",   value: stats.nouveau,  color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"    },
          { label: "En cours",   value: stats.en_cours, color: "text-amber-700",  bg: "bg-amber-50 border-amber-200"  },
          { label: "Résolus",    value: stats.resolu,   color: "text-green-700",  bg: "bg-green-50 border-green-200"  },
          { label: "🔴 Urgents", value: stats.urgent,   color: "text-red-700",    bg: "bg-red-50 border-red-200"      },
        ].map(s => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-xs font-medium mt-0.5 ${s.color} opacity-80`}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 rounded-xl border">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <Input
          className="w-52 h-8 text-xs"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les statuts</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les types</SelectItem>
            {TICKET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatus !== "_all" || filterPriority !== "_all" || filterType !== "_all" || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500 ml-auto"
            onClick={() => { setFilterStatus("_all"); setFilterPriority("_all"); setFilterType("_all"); setSearch(""); }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Tabs */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          <p className="text-sm">Chargement des tickets…</p>
        </div>
      ) : (
        <Tabs defaultValue="mine">
          <TabsList className={`grid w-full ${isDirector ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="mine" className="gap-2 text-sm">
              <User className="w-4 h-4" />
              Mes demandes
              {myTickets.filter(t => t.status !== "fermé" && t.status !== "résolu").length > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {myTickets.filter(t => t.status !== "fermé" && t.status !== "résolu").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="assigned" className="gap-2 text-sm">
              <UserCheck className="w-4 h-4" />
              Assignés à moi
              {assignedToMe.filter(t => t.status !== "fermé").length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {assignedToMe.filter(t => t.status !== "fermé").length}
                </span>
              )}
            </TabsTrigger>
            {isDirector && (
              <TabsTrigger value="all" className="gap-2 text-sm">
                <Settings2 className="w-4 h-4" />
                Tous les tickets
                <span className="bg-slate-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {allTickets.length}
                </span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <TicketList list={myTickets} />
          </TabsContent>
          <TabsContent value="assigned" className="mt-4">
            <TicketList list={assignedToMe} />
          </TabsContent>
          {isDirector && (
            <TabsContent value="all" className="mt-4">
              <TicketList list={allTickets} />
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Create modal */}
      <TicketFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["tickets"] })}
        users={assignableUsers}
        currentUser={currentUser}
      />

      {/* Detail modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={tickets.find(t => t.id === selectedTicket.id) || selectedTicket}
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleUpdate}
          users={assignableUsers}
          currentUser={currentUser}
          isDirector={isDirector}
        />
      )}
    </div>
  );
}
