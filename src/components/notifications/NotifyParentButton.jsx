/**
 * NotifyParentButton — Bouton réutilisable pour envoyer une notification aux parents
 *
 * Usage:
 *   <NotifyParentButton
 *     eventType="absence"
 *     students={[{ id, first_name, last_name, parent_name, parent_email, parent_phone, class_name }]}
 *     variables={{ date: "...", status: "Absent", ... }}
 *     label="Notifier les parents"
 *   />
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/components/auth/appAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Send, Loader2, CheckCircle2, XCircle, Mail, MessageCircle, X, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

function apiHeaders() {
  const s = getSession();
  const h = { "Content-Type": "application/json" };
  if (s?.token) h["X-Session-Token"] = s.token;
  if (s?.id)    h["X-User-Id"] = s.id;
  return h;
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(`http://localhost:3001/api/notifications${url}`, {
    headers: apiHeaders(), ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const EVENT_LABELS = {
  absence:         "Absence élève",
  sanction:        "Sanction disciplinaire",
  payment_overdue: "Retard de paiement",
  bulletin:        "Bulletin disponible",
  note:            "Résultat d'examen",
  event:           "Événement scolaire",
};

export default function NotifyParentButton({
  eventType,
  students = [],        // [{id, first_name, last_name, parent_name, parent_email, parent_phone, class_name, ...}]
  variables = {},       // extra template variables
  label = "Notifier les parents",
  variant = "outline",
  size = "sm",
  className = "",
  onSent,              // callback(results) after sending
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  // Fetch notification settings to check if channels are configured
  const { data: settings = {} } = useQuery({
    queryKey: ["notif_settings"],
    queryFn: () => apiFetch("/settings"),
    staleTime: 30000,
  });
  const { data: rules = [] } = useQuery({
    queryKey: ["notif_rules"],
    queryFn: () => apiFetch("/rules"),
    staleTime: 30000,
  });

  const rule = rules.find(r => r.event_type === eventType);
  const emailEnabled = settings?.email?.enabled && rule?.email_enabled;
  const smsEnabled   = settings?.sms?.enabled   && rule?.sms_enabled;
  const anyEnabled   = emailEnabled || smsEnabled;

  // Build recipients list
  const recipients = students
    .filter(s => s.parent_email || s.parent_phone)
    .map(s => ({
      name:         s.parent_name || `Parent de ${s.first_name} ${s.last_name}`,
      email:        s.parent_email || null,
      phone:        s.parent_phone || null,
      student_name: `${s.first_name} ${s.last_name}`,
      extra_vars: {
        student_name: `${s.first_name} ${s.last_name}`,
        class_name:   s.class_name || "",
        ...variables,
      },
    }));

  const noContact = students.filter(s => !s.parent_email && !s.parent_phone);

  async function handleSend() {
    if (!recipients.length) return;
    setSending(true);
    try {
      const res = await apiFetch("/send", {
        method: "POST",
        body: JSON.stringify({
          event_type: eventType,
          recipients: recipients.map(r => ({
            name:         r.name,
            email:        r.email,
            phone:        r.phone,
            student_name: r.student_name,
            extra_vars:   r.extra_vars,
          })),
          variables,
        }),
      });
      setResults(res);
      if (onSent) onSent(res);
    } catch (e) {
      setResults({ error: e.message, sent: 0, failed: recipients.length });
    }
    setSending(false);
  }

  function handleClose() {
    setOpen(false);
    setResults(null);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
        disabled={disabled || students.length === 0}
      >
        <Bell className="w-4 h-4" />
        {label}
        {students.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
            {students.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              {EVENT_LABELS[eventType] || eventType} — Notification parents
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Channel status */}
            <div className="flex gap-3">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-1",
                emailEnabled ? "bg-blue-50 border border-blue-200" : "bg-slate-50 border border-slate-200 opacity-50")}>
                <Mail className="w-4 h-4" />
                <span>Email {emailEnabled ? <span className="text-green-600 font-medium">✓ activé</span> : <span className="text-slate-400">désactivé</span>}</span>
              </div>
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-1",
                smsEnabled ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200 opacity-50")}>
                <MessageCircle className="w-4 h-4" />
                <span>SMS {smsEnabled ? <span className="text-green-600 font-medium">✓ activé</span> : <span className="text-slate-400">désactivé</span>}</span>
              </div>
            </div>

            {/* Warning if not configured */}
            {!anyEnabled && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Aucun canal de notification n'est activé pour cet événement.
                  Configurez email et/ou SMS dans <strong>Administration → Notifications</strong>.
                </span>
              </div>
            )}

            {/* Recipients list */}
            {!results && (
              <>
                <div>
                  <p className="text-sm font-medium mb-2">
                    {recipients.length} parent(s) avec coordonnées de contact :
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {recipients.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                          {r.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.student_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                        </div>
                        <div className="flex gap-1">
                          {r.email && <Mail className="w-3.5 h-3.5 text-blue-400" />}
                          {r.phone && <MessageCircle className="w-3.5 h-3.5 text-green-400" />}
                        </div>
                      </div>
                    ))}
                    {noContact.length > 0 && (
                      <div className="text-xs text-muted-foreground p-2 bg-slate-50 rounded-lg">
                        ⚠️ {noContact.length} élève(s) sans coordonnées parent : {noContact.map(s => `${s.first_name} ${s.last_name}`).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={handleClose}>Annuler</Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSend}
                    disabled={sending || !recipients.length}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? "Envoi en cours…" : `Envoyer (${recipients.length})`}
                  </Button>
                </div>
              </>
            )}

            {/* Results */}
            {results && (
              <div className="space-y-3">
                {results.error ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm">{results.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-lg font-bold text-green-700">{results.sent}</p>
                          <p className="text-xs text-green-600">Envoyé(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <XCircle className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-lg font-bold text-red-600">{results.failed}</p>
                          <p className="text-xs text-red-500">Échec(s)</p>
                        </div>
                      </div>
                    </div>
                    {results.results?.filter(r => !r.success).map((r, i) => (
                      <p key={i} className="text-xs text-red-600">✗ {r.recipient} : {r.error}</p>
                    ))}
                  </>
                )}
                <Button className="w-full" onClick={handleClose}>Fermer</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
