import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Printer, ShieldCheck } from "lucide-react";

/**
 * Modal d'affichage des identifiants d'un nouveau compte.
 * Utilisé après la création d'un profil (Élève, Enseignant, Personnel)
 * ou depuis la gestion des comptes AppUser.
 *
 * Props:
 *   open              {boolean}
 *   onClose           {function}
 *   credentials       {{ title, full_name, typeLabel, login, provisional_password, notify_email }}
 */
export default function CredentialsModal({ open, onClose, credentials }) {
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [copiedPwd, setCopiedPwd]   = useState(false);

  if (!credentials) return null;

  const copy = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=520,height=440");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Accès EduGest — ${credentials.full_name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:36px;color:#0f172a;}
      .title{text-align:center;color:#2563eb;font-size:20px;font-weight:700;margin-bottom:4px;}
      .sub{text-align:center;font-size:13px;color:#64748b;margin-bottom:24px;}
      .lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
      .val{font-family:monospace;font-size:24px;font-weight:800;color:#2563eb;letter-spacing:3px;margin-bottom:20px;}
      .note{font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:8px;}
      @media print{button{display:none!important;}}
    </style></head><body>
    <div class="title">EduGest — Fiche d'accès</div>
    <div class="sub">${credentials.typeLabel} : ${credentials.full_name}</div>
    <div class="lbl">Identifiant de connexion</div>
    <div class="val">${credentials.login}</div>
    <div class="lbl">Mot de passe provisoire</div>
    <div class="val">${credentials.provisional_password}</div>
    ${credentials.notify_email ? `<p style="font-size:13px;color:#475569;">📧 À remettre à : <strong>${credentials.notify_email}</strong></p>` : ""}
    <div class="note">⚠️ Ce mot de passe est provisoire et devra être modifié à la première connexion.</div>
    <br><button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ Imprimer</button>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-base">{credentials.title || "Accès compte"}</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">{credentials.typeLabel} — {credentials.full_name}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          {/* Login */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Identifiant de connexion</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                {credentials.login}
              </code>
              <Button
                size="sm" variant="outline"
                className={copiedLogin ? "text-green-600 border-green-300" : ""}
                onClick={() => copy(credentials.login, setCopiedLogin)}
              >
                {copiedLogin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Mot de passe provisoire</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-2xl font-extrabold text-blue-600 tracking-[6px] bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                {credentials.provisional_password}
              </code>
              <Button
                size="sm" variant="outline"
                className={copiedPwd ? "text-green-600 border-green-300" : ""}
                onClick={() => copy(credentials.provisional_password, setCopiedPwd)}
              >
                {copiedPwd ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {credentials.notify_email && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>📧</span>
            <span>À communiquer à : <strong>{credentials.notify_email}</strong></span>
          </p>
        )}

        <p className="text-xs text-slate-400">
          Ce mot de passe est provisoire. L'utilisateur devra le modifier à la première connexion.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="gap-2 flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimer la fiche
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
