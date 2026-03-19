import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSession } from "@/components/auth/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Mail, MessageCircle, Bell, Settings, Send, Check, X,
  Loader2, Eye, Trash2, AlertTriangle, TestTube, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── API helpers ────────────────────────────────────────────────────────────────
function apiHeaders() {
  const s = getSession();
  const h = { "Content-Type": "application/json" };
  if (s?.token) h["X-Session-Token"] = s.token;
  if (s?.id) h["X-User-Id"] = s.id;
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

// ── Constants ─────────────────────────────────────────────────────────────────
const EMAIL_PROVIDERS = [
  { value: "smtp",     label: "SMTP personnalisé" },
  { value: "gmail",    label: "Gmail (App Password)" },
  { value: "office365",label: "Office 365 (SMTP)" },
];

const SMS_PROVIDERS = [
  { value: "twilio",   label: "Twilio" },
  { value: "infobip",  label: "Infobip" },
  { value: "custom",   label: "API HTTP personnalisée" },
];

const EVENT_LABELS = {
  absence:         { label: "Absence élève",       icon: "📅", color: "bg-red-50 border-red-200" },
  sanction:        { label: "Sanction disciplinaire", icon: "⚠️", color: "bg-orange-50 border-orange-200" },
  payment_overdue: { label: "Retard de paiement",  icon: "💰", color: "bg-yellow-50 border-yellow-200" },
  bulletin:        { label: "Bulletin disponible", icon: "📋", color: "bg-green-50 border-green-200" },
  note:            { label: "Résultat d'examen",   icon: "📝", color: "bg-blue-50 border-blue-200" },
  event:           { label: "Événement scolaire",  icon: "📅", color: "bg-purple-50 border-purple-200" },
};

// ── Email Config Section ───────────────────────────────────────────────────────
function EmailConfigSection({ settings, onSave, onTest }) {
  const cfg = settings?.email || {};
  const [enabled, setEnabled] = useState(!!cfg.enabled);
  const [provider, setProvider] = useState(cfg.provider || "smtp");
  const [config, setConfig] = useState(cfg.config || {
    host: "", port: 587, secure: false, user: "", pass: "", from_name: "EduGest", from_email: ""
  });
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  async function handleTest() {
    if (!testTo) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await apiFetch("/test", { method: "POST", body: JSON.stringify({ channel: "email", to: testTo }) });
      setTestResult(r);
    } catch (e) { setTestResult({ success: false, error: e.message }); }
    setTesting(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Notifications Email</p>
            <p className="text-sm text-blue-600">Envoi automatique aux parents par email</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-1.5">
        <Label>Fournisseur Email</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EMAIL_PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* SMTP fields */}
      {(provider === "smtp" || provider === "office365") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Serveur SMTP</Label>
            <Input value={config.host || ""} onChange={e => set("host", e.target.value)}
              placeholder={provider === "office365" ? "smtp.office365.com" : "smtp.example.com"} />
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input type="number" value={config.port || 587} onChange={e => set("port", parseInt(e.target.value))}
              placeholder="587" />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label>SSL/TLS</Label>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Switch checked={!!config.secure} onCheckedChange={v => set("secure", v)} />
              <span className="text-sm">{config.secure ? "Activé (port 465)" : "Désactivé (STARTTLS)"}</span>
            </div>
          </div>
        </div>
      )}

      {provider === "gmail" && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Gmail :</strong> Activez la validation en 2 étapes puis générez un <em>mot de passe d'application</em> dans{" "}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline">
            myaccount.google.com/apppasswords
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Identifiant (Email)</Label>
          <Input value={config.user || ""} onChange={e => set("user", e.target.value)}
            placeholder="notifications@ecole.com" type="email" />
        </div>
        <div className="space-y-1.5">
          <Label>Mot de passe / App Password</Label>
          <Input value={config.pass || ""} onChange={e => set("pass", e.target.value)}
            placeholder="••••••••••••" type="password" />
        </div>
        <div className="space-y-1.5">
          <Label>Nom de l'expéditeur</Label>
          <Input value={config.from_name || ""} onChange={e => set("from_name", e.target.value)}
            placeholder="EduGest – École" />
        </div>
        <div className="space-y-1.5">
          <Label>Email expéditeur</Label>
          <Input value={config.from_email || ""} onChange={e => set("from_email", e.target.value)}
            placeholder="no-reply@ecole.com" type="email" />
        </div>
      </div>

      {/* Test */}
      <div className="p-4 border rounded-xl space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <TestTube className="w-4 h-4" /> Tester la configuration
        </p>
        <div className="flex gap-2">
          <Input value={testTo} onChange={e => setTestTo(e.target.value)}
            placeholder="email@test.com" type="email" className="flex-1" />
          <Button variant="outline" onClick={handleTest} disabled={!testTo || testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer test
          </Button>
        </div>
        {testResult && (
          <div className={cn("flex items-center gap-2 p-2 rounded text-sm", testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.success ? "Email envoyé avec succès !" : `Erreur : ${testResult.error}`}
          </div>
        )}
      </div>

      <Button onClick={() => onSave({ channel: "email", enabled, provider, config })} className="w-full">
        <Check className="w-4 h-4 mr-2" /> Enregistrer la configuration email
      </Button>
    </div>
  );
}

// ── SMS Config Section ─────────────────────────────────────────────────────────
function SMSConfigSection({ settings, onSave }) {
  const cfg = settings?.sms || {};
  const [enabled, setEnabled] = useState(!!cfg.enabled);
  const [provider, setProvider] = useState(cfg.provider || "twilio");
  const [config, setConfig] = useState(cfg.config || {
    account_sid: "", auth_token: "", from_number: "", api_url: "", api_key: "", sender_id: ""
  });
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  async function handleTest() {
    if (!testTo) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await apiFetch("/test", { method: "POST", body: JSON.stringify({ channel: "sms", to: testTo }) });
      setTestResult(r);
    } catch (e) { setTestResult({ success: false, error: e.message }); }
    setTesting(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Notifications SMS</p>
            <p className="text-sm text-green-600">Envoi de SMS aux numéros des parents</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-1.5">
        <Label>Fournisseur SMS</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SMS_PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {provider === "twilio" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Account SID</Label>
            <Input value={config.account_sid || ""} onChange={e => set("account_sid", e.target.value)} placeholder="ACxxxxxxxx" />
          </div>
          <div className="space-y-1.5">
            <Label>Auth Token</Label>
            <Input value={config.auth_token || ""} onChange={e => set("auth_token", e.target.value)} type="password" placeholder="••••••••" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Numéro Twilio (format E.164)</Label>
            <Input value={config.from_number || ""} onChange={e => set("from_number", e.target.value)} placeholder="+12125551234" />
          </div>
        </div>
      )}

      {provider === "infobip" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Clé API Infobip</Label>
            <Input value={config.api_key || ""} onChange={e => set("api_key", e.target.value)} type="password" placeholder="••••••••" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Sender ID</Label>
            <Input value={config.sender_id || ""} onChange={e => set("sender_id", e.target.value)} placeholder="EduGest" />
          </div>
        </div>
      )}

      {provider === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>URL de l'API</Label>
            <Input value={config.api_url || ""} onChange={e => set("api_url", e.target.value)} placeholder="https://api.mon-fournisseur.com/sms" />
          </div>
          <div className="space-y-1.5">
            <Label>Clé API</Label>
            <Input value={config.api_key || ""} onChange={e => set("api_key", e.target.value)} type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label>Sender ID / Numéro</Label>
            <Input value={config.sender_id || ""} onChange={e => set("sender_id", e.target.value)} placeholder="EduGest" />
          </div>
          <div className="col-span-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            L'API doit accepter un <code>POST</code> JSON avec les champs : <code>to</code>, <code>from</code>, <code>message</code>.
            En-tête Authorization: Bearer [clé API].
          </div>
        </div>
      )}

      {/* Test */}
      <div className="p-4 border rounded-xl space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <TestTube className="w-4 h-4" /> Tester la configuration
        </p>
        <div className="flex gap-2">
          <Input value={testTo} onChange={e => setTestTo(e.target.value)}
            placeholder="+213XXXXXXXXX" className="flex-1" />
          <Button variant="outline" onClick={handleTest} disabled={!testTo || testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer test
          </Button>
        </div>
        {testResult && (
          <div className={cn("flex items-center gap-2 p-2 rounded text-sm", testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.success ? "SMS envoyé avec succès !" : `Erreur : ${testResult.error}`}
          </div>
        )}
      </div>

      <Button onClick={() => onSave({ channel: "sms", enabled, provider, config })} className="w-full">
        <Check className="w-4 h-4 mr-2" /> Enregistrer la configuration SMS
      </Button>
    </div>
  );
}

// ── Rule Editor ────────────────────────────────────────────────────────────────
function RuleRow({ rule, onSave }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ ...rule });
  const [saving, setSaving] = useState(false);
  const ev = EVENT_LABELS[rule.event_type] || { label: rule.event_type, icon: "📌", color: "bg-slate-50 border-slate-200" };

  async function handleSave() {
    setSaving(true);
    await onSave(rule.id, data);
    setSaving(false);
    setOpen(false);
  }

  const vars = (tpl) => {
    const matches = [...(tpl || "").matchAll(/\{\{(\w+)\}\}/g)];
    return [...new Set(matches.map(m => m[1]))];
  };

  return (
    <div className={cn("border rounded-xl overflow-hidden", ev.color)}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{ev.icon}</span>
          <div>
            <p className="font-medium text-sm">{ev.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                data.email_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
                <Mail className="w-3 h-3" /> Email {data.email_enabled ? "✓" : "off"}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                data.sms_enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                <MessageCircle className="w-3 h-3" /> SMS {data.sms_enabled ? "✓" : "off"}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Configurer
        </Button>
      </div>

      {open && (
        <div className="border-t p-4 bg-white space-y-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={!!data.email_enabled} onCheckedChange={v => setData(d => ({ ...d, email_enabled: v }))} />
              <span className="text-sm font-medium flex items-center gap-1"><Mail className="w-4 h-4 text-blue-500" /> Activer Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={!!data.sms_enabled} onCheckedChange={v => setData(d => ({ ...d, sms_enabled: v }))} />
              <span className="text-sm font-medium flex items-center gap-1"><MessageCircle className="w-4 h-4 text-green-500" /> Activer SMS</span>
            </label>
          </div>

          {/* Email template */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Modèle Email
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Sujet</Label>
              <Input value={data.email_subject_tpl || ""} onChange={e => setData(d => ({ ...d, email_subject_tpl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Corps du message</Label>
              <Textarea value={data.email_body_tpl || ""} onChange={e => setData(d => ({ ...d, email_body_tpl: e.target.value }))} rows={5} className="font-mono text-xs" />
            </div>
            {vars(data.email_body_tpl).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {vars(data.email_body_tpl).map(v => (
                  <code key={v} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>
                ))}
              </div>
            )}
          </div>

          {/* SMS template */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" /> Modèle SMS
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message ({data.sms_tpl?.length || 0}/160 caractères)</Label>
                <span className={cn("text-xs", (data.sms_tpl?.length || 0) > 160 ? "text-red-500" : "text-slate-400")}>
                  {(data.sms_tpl?.length || 0) > 160 ? "Multi-SMS" : ""}
                </span>
              </div>
              <Textarea value={data.sms_tpl || ""} onChange={e => setData(d => ({ ...d, sms_tpl: e.target.value }))} rows={3} className="font-mono text-xs" />
            </div>
          </div>

          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            Enregistrer cette règle
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Notification Log ───────────────────────────────────────────────────────────
function NotifLog() {
  const qc = useQueryClient();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["notif_logs"],
    queryFn: () => apiFetch("/log"),
    refetchInterval: 15000,
  });

  const clearMut = useMutation({
    mutationFn: () => apiFetch("/log", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries(["notif_logs"]),
  });

  const statusBadge = (s) => {
    if (s === "sent") return <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Envoyé</span>;
    if (s === "failed") return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Échec</span>;
    return <span className="text-xs text-slate-500">{s}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{logs.length} notification(s) dans l'historique</p>
        {logs.length > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => clearMut.mutate()}>
            <Trash2 className="w-3.5 h-3.5" /> Vider l'historique
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune notification envoyée pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                log.channel === "email" ? "bg-blue-100" : "bg-green-100")}>
                {log.channel === "email" ? <Mail className="w-4 h-4 text-blue-600" /> : <MessageCircle className="w-4 h-4 text-green-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(log.status)}
                  <span className="text-xs text-muted-foreground">{EVENT_LABELS[log.event_type]?.label || log.event_type}</span>
                  <span className="text-xs text-muted-foreground">→ {log.recipient_contact}</span>
                  {log.recipient_name && <span className="text-xs font-medium">{log.recipient_name}</span>}
                </div>
                {log.message_preview && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.message_preview}</p>}
                {log.error_msg && <p className="text-xs text-red-500 mt-0.5">{log.error_msg}</p>}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(log.sent_date).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function NotificationSettings() {
  const qc = useQueryClient();

  const { data: settings = {}, isLoading: loadingSettings } = useQuery({
    queryKey: ["notif_settings"],
    queryFn: () => apiFetch("/settings"),
  });

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["notif_rules"],
    queryFn: () => apiFetch("/rules"),
  });

  const saveMut = useMutation({
    mutationFn: ({ channel, enabled, provider, config }) =>
      apiFetch(`/settings/${channel}`, { method: "PUT", body: JSON.stringify({ enabled, provider, config }) }),
    onSuccess: () => { qc.invalidateQueries(["notif_settings"]); },
  });

  const rulesMut = useMutation({
    mutationFn: ({ id, data }) =>
      apiFetch(`/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries(["notif_rules"]),
  });

  function handleSaveRule(id, data) {
    return rulesMut.mutateAsync({ id, data });
  }

  const emailEnabled = settings?.email?.enabled;
  const smsEnabled = settings?.sms?.enabled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
        <Bell className="w-7 h-7" />
        <div>
          <h2 className="text-lg font-bold">Notifications Parents</h2>
          <p className="text-white/70 text-sm">Configurez les canaux d'envoi SMS et Email vers les parents</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
            emailEnabled ? "bg-blue-200 text-blue-900" : "bg-white/20 text-white/70")}>
            <Mail className="w-3 h-3 inline mr-1" />Email {emailEnabled ? "ON" : "OFF"}
          </span>
          <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
            smsEnabled ? "bg-green-200 text-green-900" : "bg-white/20 text-white/70")}>
            <MessageCircle className="w-3 h-3 inline mr-1" />SMS {smsEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="email">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="w-4 h-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5">
            <MessageCircle className="w-4 h-4" /> SMS
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Bell className="w-4 h-4" /> Règles
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Clock className="w-4 h-4" /> Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-5">
          {loadingSettings ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : (
            <EmailConfigSection settings={settings} onSave={d => saveMut.mutate(d)} />
          )}
        </TabsContent>

        <TabsContent value="sms" className="mt-5">
          {loadingSettings ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : (
            <SMSConfigSection settings={settings} onSave={d => saveMut.mutate(d)} />
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-5">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Activez les notifications pour chaque type d'événement et personnalisez les modèles de messages.
              Utilisez <code className="bg-muted px-1 rounded text-xs">{`{{variable}}`}</code> pour les champs dynamiques.
            </p>
            {loadingRules ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
            ) : (
              rules.map(rule => (
                <RuleRow key={rule.id} rule={rule} onSave={handleSaveRule} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-5">
          <NotifLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
