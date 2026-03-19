import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Mail, MailOpen, Loader2, Trash2, Search, Reply, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSession } from "@/components/auth/appAuth";

// ─── Dériver le sender_type à partir du rôle ─────────────────────────────────
function roleToSenderType(role) {
  if (!role) return "admin";
  if (role === "enseignant")                                        return "teacher";
  if (role === "parent")                                            return "parent";
  if (role === "eleve")                                             return "student";
  if (role === "comptable")                                         return "staff";
  if (role === "cpe")                                               return "cpe";
  // directeur_*, secretaire, admin_systeme → "admin"
  return "admin";
}

// ─── Labels lisibles pour sender_type ────────────────────────────────────────
const SENDER_TYPE_LABELS = {
  admin:    "Administration",
  teacher:  "Enseignant",
  parent:   "Parent",
  student:  "Élève",
  staff:    "Personnel",
  cpe:      "CPE",
};

export default function Messages() {
  // ── Session courante ────────────────────────────────────────────────────────
  const session = getSession();
  const myAppUserId   = session?.id       || null;
  const myFullName    = session?.full_name || session?.login || "Utilisateur";
  const mySenderType  = roleToSenderType(session?.role);

  // ── State ───────────────────────────────────────────────────────────────────
  const [formOpen,          setFormOpen]          = useState(false);
  const [selectedMessage,   setSelectedMessage]   = useState(null);
  const [deleteDialogOpen,  setDeleteDialogOpen]  = useState(false);
  const [messageToDelete,   setMessageToDelete]   = useState(null);
  const [search,            setSearch]            = useState("");
  const [saving,            setSaving]            = useState(false);
  const [replyContent,      setReplyContent]      = useState("");
  const [replying,          setReplying]          = useState(false);

  const [formData, setFormData] = useState({
    recipient_type: "parent",
    subject:        "",
    content:        "",
    priority:       "normal",
    student_id:     "",
  });

  const queryClient = useQueryClient();

  // ── Requêtes ────────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn:  () => base44.entities.Message.list("-created_date"),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn:  () => base44.entities.Student.list(),
  });

  const studentMap = useMemo(
    () => Object.fromEntries(students.map(s => [s.id, s])),
    [students]
  );

  // ── Thread helpers ──────────────────────────────────────────────────────────
  const getThreadKey = (subject) => subject?.replace(/^(Re:\s*)+/i, "").trim() ?? "";

  const getThread = (msg) => {
    const key = getThreadKey(msg.subject);
    return [...messages]
      .filter(m => getThreadKey(m.subject) === key)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  };

  // ── Identifier "mon" message dans le fil ───────────────────────────────────
  // Fiable si sender_id est renseigné ; fallback sur sender_type pour anciens msg
  const isMyMessage = (msg) => {
    if (myAppUserId && msg.sender_id === myAppUserId) return true;
    // Fallback : même type d'expéditeur ET sender_name correspond
    if (msg.sender_type === mySenderType && msg.sender_name === myFullName) return true;
    return false;
  };

  // ── Envoyer une réponse ─────────────────────────────────────────────────────
  const handleReply = async () => {
    if (!replyContent.trim() || !selectedMessage) return;
    setReplying(true);
    const reSubject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject}`;

    // Déterminer le destinataire = l'autre côté de la conversation
    const recipientType = isMyMessage(selectedMessage)
      ? selectedMessage.recipient_type
      : selectedMessage.sender_type || "parent";
    const recipientId = isMyMessage(selectedMessage)
      ? selectedMessage.recipient_id
      : selectedMessage.sender_id || "";

    await base44.entities.Message.create({
      sender_id:     myAppUserId,
      sender_type:   mySenderType,
      sender_name:   myFullName,
      recipient_type: recipientType,
      recipient_id:  recipientId,
      student_id:    selectedMessage.student_id || "",
      subject:       reSubject,
      content:       replyContent.trim(),
      priority:      selectedMessage.priority || "normal",
      read:          false,
    });
    setReplyContent("");
    setReplying(false);
    queryClient.invalidateQueries({ queryKey: ["messages"] });
  };

  // ── Nouveau message ─────────────────────────────────────────────────────────
  const handleNew = () => {
    setFormData({ recipient_type: "parent", subject: "", content: "", priority: "normal", student_id: "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Message.create({
      ...formData,
      sender_id:   myAppUserId,
      sender_type: mySenderType,
      sender_name: myFullName,
      read:        false,
    });
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    setFormOpen(false);
  };

  // ── Marquer lu / Supprimer ──────────────────────────────────────────────────
  const handleMarkAsRead = async (message) => {
    await base44.entities.Message.update(message.id, { read: true });
    queryClient.invalidateQueries({ queryKey: ["messages"] });
  };

  const handleDelete = async () => {
    if (messageToDelete) {
      await base44.entities.Message.delete(messageToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      setSelectedMessage(null);
    }
  };

  // ── Filtrage ────────────────────────────────────────────────────────────────
  const filteredMessages = useMemo(() => messages.filter(m =>
    search === "" ||
    m.subject?.toLowerCase().includes(search.toLowerCase()) ||
    m.sender_name?.toLowerCase().includes(search.toLowerCase())
  ), [messages, search]);

  const priorityColors = {
    low:    "bg-slate-100 text-slate-600",
    normal: "bg-blue-100  text-blue-800",
    high:   "bg-red-100   text-red-800",
  };

  const priorityLabels = { low: "Basse", normal: "Normale", high: "Haute !" };

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Messagerie"
        description={`${messages.filter(m => !m.read).length} message(s) non lu(s)`}
        action={handleNew}
        actionLabel="Nouveau message"
        actionIcon={Send}
      />

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un message…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Liste des messages ──────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-20" />
              </Card>
            ))
          ) : filteredMessages.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                {search ? "Aucun résultat" : "Aucun message"}
              </CardContent>
            </Card>
          ) : (
            filteredMessages.map(message => {
              const isMine = isMyMessage(message);
              return (
                <Card
                  key={message.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedMessage?.id === message.id
                      ? "border-blue-500 bg-blue-50"
                      : !message.read
                      ? "border-l-4 border-l-blue-500"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedMessage(message);
                    if (!message.read) handleMarkAsRead(message);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {message.read
                            ? <MailOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            : <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                          <span className={`font-medium truncate text-sm ${!message.read ? "text-blue-600" : ""}`}>
                            {message.subject}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          {isMine
                            ? <span className="text-blue-500 font-medium">Envoyé →</span>
                            : <>De : <span className="font-medium">{message.sender_name}</span></>
                          }
                          {message.sender_type && !isMine && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1">
                              {SENDER_TYPE_LABELS[message.sender_type] || message.sender_type}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {message.created_date &&
                            format(new Date(message.created_date), "d MMM HH:mm", { locale: fr })}
                        </p>
                      </div>
                      {message.priority === "high" && (
                        <Badge className="bg-red-100 text-red-800 text-[10px] flex-shrink-0">!</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* ── Détail du fil ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <Card>
              <CardContent className="p-6">
                {/* En-tête fil */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{getThreadKey(selectedMessage.subject)}</h2>
                    {selectedMessage.student_id && studentMap[selectedMessage.student_id] && (
                      <p className="text-sm text-slate-500 mt-1">
                        Concernant :{" "}
                        <span className="font-medium">
                          {studentMap[selectedMessage.student_id].first_name}{" "}
                          {studentMap[selectedMessage.student_id].last_name}
                        </span>
                      </p>
                    )}
                    {/* Participants du fil */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {[...new Set(getThread(selectedMessage).map(m => m.sender_name).filter(Boolean))].map(name => (
                        <span key={name} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                          <User className="w-3 h-3" />{name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={() => { setMessageToDelete(selectedMessage); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Bulles de conversation */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto mb-4 pr-1">
                  {getThread(selectedMessage).map(msg => {
                    const mine = isMyMessage(msg);
                    return (
                      <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        {/* Avatar expéditeur (côté gauche si pas moi) */}
                        {!mine && (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                            {msg.sender_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}

                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                          mine
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-900 rounded-bl-sm"
                        }`}>
                          {/* Métadonnées */}
                          <div className={`flex items-center gap-2 mb-1 text-xs ${mine ? "text-blue-200" : "text-slate-500"} flex-wrap`}>
                            <span className="font-semibold">
                              {mine ? "Moi" : msg.sender_name}
                            </span>
                            {!mine && msg.sender_type && (
                              <span className={`${mine ? "text-blue-300" : "text-slate-400"}`}>
                                ({SENDER_TYPE_LABELS[msg.sender_type] || msg.sender_type})
                              </span>
                            )}
                            <span>·</span>
                            <span>
                              {msg.created_date &&
                                format(new Date(msg.created_date), "d MMM HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>

                        {/* Avatar moi (côté droit) */}
                        {mine && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ml-2 flex-shrink-0 mt-1 ring-2 ring-blue-200">
                            {myFullName?.[0]?.toUpperCase() || "M"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Zone de réponse */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                    <Reply className="w-4 h-4 text-blue-500" />
                    <span>
                      Répondre en tant que{" "}
                      <strong className="text-slate-800">{myFullName}</strong>
                      <Badge variant="outline" className="ml-1.5 text-xs">
                        {SENDER_TYPE_LABELS[mySenderType] || mySenderType}
                      </Badge>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={replyContent}
                      onChange={e => setReplyContent(e.target.value)}
                      placeholder="Écrivez votre réponse…"
                      rows={3}
                      className="flex-1 resize-none"
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    />
                    <Button
                      onClick={handleReply}
                      disabled={!replyContent.trim() || replying}
                      className="self-end bg-blue-600 hover:bg-blue-700"
                    >
                      {replying
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Ctrl+Entrée pour envoyer</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-slate-400">
                <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Sélectionnez un message pour le lire</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Dialog nouveau message ────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Expéditeur — lecture seule, déduit de la session */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {myFullName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm text-slate-800">{myFullName}</p>
                <p className="text-xs text-slate-500">
                  {SENDER_TYPE_LABELS[mySenderType] || mySenderType}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Select
                  value={formData.recipient_type}
                  onValueChange={v => setFormData(f => ({ ...f, recipient_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="teacher">Enseignant</SelectItem>
                    <SelectItem value="student">Élève</SelectItem>
                    <SelectItem value="admin">Administration</SelectItem>
                    <SelectItem value="class">Classe entière</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={formData.priority}
                  onValueChange={v => setFormData(f => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Concernant (élève) <span className="text-xs text-slate-400">— optionnel</span></Label>
              <Select
                value={formData.student_id}
                onValueChange={v => setFormData(f => ({ ...f, student_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun élève spécifié" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sujet *</Label>
              <Input
                value={formData.subject}
                onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={formData.content}
                onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                rows={5}
                required
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Send className="w-4 h-4 mr-2" />}
                Envoyer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog suppression ───────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.
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
