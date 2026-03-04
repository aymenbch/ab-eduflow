import React, { useState } from "react";
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
import { Send, Mail, MailOpen, Loader2, Trash2, Search, Reply } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

export default function Messages() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);
  const [formData, setFormData] = useState({
    sender_name: "",
    recipient_type: "parent",
    subject: "",
    content: "",
    priority: "normal",
    student_id: "",
  });

  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: () => base44.entities.Message.list("-created_date"),
  });

  // Group messages into threads by subject (strip Re: prefix)
  const getThreadKey = (subject) => subject?.replace(/^(Re:\s*)+/i, "").trim();

  const getThread = (msg) => {
    const key = getThreadKey(msg.subject);
    return [...messages]
      .filter(m => getThreadKey(m.subject) === key)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedMessage) return;
    setReplying(true);
    const reSubject = selectedMessage.subject.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject}`;
    await base44.entities.Message.create({
      sender_type: "admin",
      sender_name: "Administration",
      recipient_type: selectedMessage.sender_type || "parent",
      recipient_id: selectedMessage.sender_id || "",
      student_id: selectedMessage.student_id || "",
      subject: reSubject,
      content: replyContent.trim(),
      priority: selectedMessage.priority || "normal",
      read: false,
    });
    setReplyContent("");
    setReplying(false);
    queryClient.invalidateQueries({ queryKey: ["messages"] });
  };

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list(),
  });

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  const handleNew = () => {
    setFormData({
      sender_name: "",
      recipient_type: "parent",
      subject: "",
      content: "",
      priority: "normal",
      student_id: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    await base44.entities.Message.create({
      ...formData,
      sender_type: "admin",
      read: false,
    });

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    setFormOpen(false);
  };

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

  const priorityColors = {
    low: "bg-slate-100 text-slate-800",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-red-100 text-red-800",
  };

  const filteredMessages = messages.filter((m) => {
    return (
      search === "" ||
      m.subject?.toLowerCase().includes(search.toLowerCase()) ||
      m.sender_name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <PageHeader
        title="Messagerie"
        description={`${messages.filter((m) => !m.read).length} messages non lus`}
        action={handleNew}
        actionLabel="Nouveau message"
        actionIcon={Send}
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message list */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            Array(5)
              .fill(0)
              .map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 h-20" />
                </Card>
              ))
          ) : filteredMessages.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                Aucun message
              </CardContent>
            </Card>
          ) : (
            filteredMessages.map((message) => (
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {message.read ? (
                          <MailOpen className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Mail className="w-4 h-4 text-blue-500" />
                        )}
                        <span className={`font-medium truncate ${!message.read ? "text-blue-600" : ""}`}>
                          {message.subject}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        De: {message.sender_name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {message.created_date &&
                          format(new Date(message.created_date), "d MMM HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <Badge className={priorityColors[message.priority]}>
                      {message.priority === "high" ? "!" : ""}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Message detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <Card>
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{getThreadKey(selectedMessage.subject)}</h2>
                    {selectedMessage.student_id && studentMap[selectedMessage.student_id] && (
                      <p className="text-sm text-slate-500 mt-1">
                        Concernant: {studentMap[selectedMessage.student_id].first_name}{" "}
                        {studentMap[selectedMessage.student_id].last_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMessageToDelete(selectedMessage);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Thread messages */}
                <div className="space-y-4 max-h-[380px] overflow-y-auto mb-4 pr-1">
                  {getThread(selectedMessage).map((msg, i) => {
                    const isAdmin = msg.sender_type === "admin";
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isAdmin
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-900 rounded-bl-sm"
                        }`}>
                          <div className={`flex items-center gap-2 mb-1 text-xs ${isAdmin ? "text-blue-200" : "text-slate-500"}`}>
                            <span className="font-semibold">{msg.sender_name}</span>
                            <span>·</span>
                            <span>{msg.created_date && format(new Date(msg.created_date), "d MMM HH:mm", { locale: fr })}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply box */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                    <Reply className="w-4 h-4 text-blue-500" />
                    <span>Répondre à <strong>{selectedMessage.sender_name}</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Écrivez votre réponse..."
                      rows={3}
                      className="flex-1 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply();
                      }}
                    />
                    <Button
                      onClick={handleReply}
                      disabled={!replyContent.trim() || replying}
                      className="self-end bg-blue-600 hover:bg-blue-700"
                    >
                      {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Ctrl+Entrée pour envoyer</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                Sélectionnez un message pour le lire
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Votre nom *</Label>
              <Input
                value={formData.sender_name}
                onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Select
                  value={formData.recipient_type}
                  onValueChange={(value) => setFormData({ ...formData, recipient_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="teacher">Enseignant</SelectItem>
                    <SelectItem value="class">Classe entière</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
              <Label>Concernant (élève)</Label>
              <Select
                value={formData.student_id}
                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
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
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Envoyer
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
              Êtes-vous sûr de vouloir supprimer ce message ?
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