import React, { useState, useEffect, useRef } from "react";
import { hashPin, saveSession, getSession } from "@/components/auth/appAuth";
import { createPageUrl } from "@/utils";

async function hashPattern(seq) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seq.join(',')));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Eye, EyeOff, Lock, User, Loader2, AlertCircle,
  CheckCircle2, XCircle, ShieldCheck, ArrowRight, KeyRound, QrCode,
} from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

const COMPLEXITY_RULES = [
  { id: "length",  label: `Au moins ${MIN_PASSWORD_LENGTH} caractères`, test: (v) => v.length >= MIN_PASSWORD_LENGTH },
  { id: "upper",   label: "Au moins une lettre majuscule (A-Z)",        test: (v) => /[A-Z]/.test(v) },
  { id: "lower",   label: "Au moins une lettre minuscule (a-z)",        test: (v) => /[a-z]/.test(v) },
  { id: "digit",   label: "Au moins un chiffre (0-9)",                  test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "Au moins un caractère spécial (!@#$%…)",     test: (v) => /[^a-zA-Z0-9]/.test(v) },
];
const checkRules    = (pwd) => COMPLEXITY_RULES.map((r) => ({ ...r, passed: r.test(pwd) }));
const allRulesPassed = (pwd) => COMPLEXITY_RULES.every((r) => r.test(pwd));

/* ── Animations CSS ── */
const ANIM_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap');
  @keyframes floatA {
    0%,100% { transform: translateY(0px) rotate(0deg) scale(1); }
    33%     { transform: translateY(-28px) rotate(120deg) scale(1.08); }
    66%     { transform: translateY(14px) rotate(240deg) scale(0.95); }
  }
  @keyframes floatB {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%     { transform: translateY(-40px) rotate(180deg); }
  }
  @keyframes floatC {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(20px,-20px) scale(1.12); }
  }
  @keyframes pulseGlow {
    0%,100% { opacity: 0.15; }
    50%     { opacity: 0.35; }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .anim-floatA  { animation: floatA  9s ease-in-out infinite; }
  .anim-floatB  { animation: floatB  7s ease-in-out infinite; }
  .anim-floatC  { animation: floatC  11s ease-in-out infinite; }
  .anim-glow    { animation: pulseGlow 4s ease-in-out infinite; }
  .anim-slideUp { animation: slideUp  0.5s ease both; }
  .anim-fadeIn  { animation: fadeIn   0.4s ease both; }
  .glass {
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.18);
  }
  .input-modern {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .input-modern:focus {
    background: #fff;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    outline: none;
  }
  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%);
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    box-shadow: 0 4px 15px rgba(99,102,241,0.35);
  }
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(99,102,241,0.45);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.6; }
`;

/* ── Composant côté gauche (panneau marque) ── */
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between relative overflow-hidden"
      style={{ background: "linear-gradient(145deg,#312e81 0%,#4338ca 40%,#3730a3 70%,#1e1b4b 100%)", minHeight: "100vh", width: "42%" }}>

      {/* Blobs animés */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="anim-floatA anim-glow absolute w-80 h-80 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(167,139,250,0.4) 0%,transparent 70%)", top:"-60px", left:"-80px" }} />
        <div className="anim-floatB anim-glow absolute w-64 h-64 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(99,102,241,0.5) 0%,transparent 70%)", bottom:"80px", right:"-60px", animationDelay:"2s" }} />
        <div className="anim-floatC anim-glow absolute w-48 h-48 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(196,181,253,0.3) 0%,transparent 70%)", top:"45%", left:"55%", animationDelay:"4s" }} />
        {/* Grille subtile */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      </div>

      {/* Contenu */}
      <div className="relative z-10 flex flex-col justify-center h-full px-10 py-12">
        {/* Logo */}
        <div className="mb-12">
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-5"
            style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}>
            <span className="text-3xl">🏫</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">EduGest</h1>
          <p className="text-indigo-300 text-base mt-2 font-medium">Plateforme de gestion scolaire</p>
        </div>

        {/* Features */}
        <div className="space-y-5 mb-12">
          {[
            { icon:"📊", title:"Tableau de bord en temps réel", desc:"Suivez les indicateurs clés de votre établissement" },
            { icon:"👨‍🎓", title:"Gestion complète des élèves",   desc:"Inscriptions, notes, absences, sanctions" },
            { icon:"📅", title:"Emplois du temps intelligents",  desc:"Planification et gestion des conflits automatisée" },
            { icon:"🔐", title:"Sécurité renforcée avec 2FA",    desc:"Authentification à deux facteurs pour tous les profils" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3.5 glass rounded-xl px-4 py-3">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-indigo-300 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-indigo-400 text-xs">© 2026 EduGest · Tous droits réservés</p>
      </div>
    </div>
  );
}

/* ── Champ mot de passe complexité ── */
function PasswordRules({ password, show }) {
  if (!show) return null;
  const rules = checkRules(password);
  return (
    <ul className="mt-2.5 space-y-1.5 text-xs rounded-xl border border-slate-100 p-3 bg-slate-50">
      {rules.map((r) => (
        <li key={r.id} className={`flex items-center gap-2 font-medium transition-colors duration-200 ${r.passed ? "text-emerald-600" : "text-red-400"}`}>
          {r.passed
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            : <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />}
          {r.label}
        </li>
      ))}
    </ul>
  );
}

/* ── Champ input stylisé ── */
function ModernInput({ icon: Icon, rightSlot, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />}
      <input
        className={`input-modern w-full h-11 text-sm text-slate-800 placeholder:text-slate-400 px-4 ${Icon ? "pl-10" : ""} ${rightSlot ? "pr-11" : ""}`}
        {...props}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

/* ── Message d'erreur ── */
function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div className="anim-fadeIn flex items-start gap-2.5 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

/* ── Wrapper plein écran (vues secondaires) ── */
function FullScreenWrap({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background:"linear-gradient(145deg,#312e81 0%,#4338ca 40%,#3730a3 70%,#1e1b4b 100%)" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="anim-floatA absolute w-96 h-96 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(167,139,250,0.25) 0%,transparent 70%)", top:"-80px", left:"-100px" }} />
        <div className="anim-floatB absolute w-72 h-72 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(99,102,241,0.3) 0%,transparent 70%)", bottom:"60px", right:"-70px", animationDelay:"3s" }} />
      </div>
      <div className="anim-slideUp relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}

/* ── Carte blanche ── */
function WhiteCard({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-2xl ${className}`} style={{ boxShadow:"0 25px 60px rgba(0,0,0,0.25)" }}>
      {children}
    </div>
  );
}

/* ── Pattern Lock 3×3 ── */
function PatternLock({ onComplete, reset, label }) {
  const SIZE = 240;
  const COLS = 3;
  const PAD  = 48;
  const STEP = (SIZE - 2 * PAD) / (COLS - 1);

  const DOTS = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    x: PAD + (i % COLS) * STEP,
    y: PAD + Math.floor(i / COLS) * STEP,
  }));

  const [seq,     setSeq]     = useState([]);
  const [active,  setActive]  = useState(false);
  const [mouse,   setMouse]   = useState({ x: 0, y: 0 });
  const [done,    setDone]    = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    if (reset) { setSeq([]); setActive(false); setDone(false); }
  }, [reset]);

  const svgPt = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * SIZE / r.width, y: (cy - r.top) * SIZE / r.height };
  };

  const nearDot = (pt) => DOTS.find(d => Math.hypot(d.x - pt.x, d.y - pt.y) < 26);

  const onStart = (e) => {
    e.preventDefault();
    if (done) return;
    const pt = svgPt(e);
    const d  = nearDot(pt);
    if (d) { setSeq([d.id]); setActive(true); setMouse(pt); }
  };

  const onMove = (e) => {
    if (!active || done) return;
    e.preventDefault();
    const pt = svgPt(e);
    setMouse(pt);
    const d = nearDot(pt);
    if (d && !seq.includes(d.id)) setSeq(prev => [...prev, d.id]);
  };

  const onEnd = () => {
    if (!active) return;
    setActive(false);
    if (seq.length >= 4) {
      setDone(true);
      onComplete(seq);
      setTimeout(() => { setSeq([]); setDone(false); }, 800);
    } else {
      setTimeout(() => setSeq([]), 400);
    }
  };

  const selSet = new Set(seq);
  const COLOR  = done ? '#10b981' : '#6366f1';

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <p className="text-xs text-slate-500 text-center">{label}</p>}
      <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{ touchAction:'none', userSelect:'none', cursor:'crosshair' }}
        className="rounded-2xl bg-slate-50 border-2 border-slate-200">

        {/* Lines between selected dots */}
        {seq.map((id, i) => {
          if (i === 0) return null;
          const a = DOTS[seq[i-1]], b = DOTS[id];
          return <line key={`l${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={COLOR} strokeWidth={3} strokeLinecap="round" opacity={0.6} />;
        })}
        {/* Line to cursor */}
        {active && seq.length > 0 && (
          <line x1={DOTS[seq[seq.length-1]].x} y1={DOTS[seq[seq.length-1]].y}
            x2={mouse.x} y2={mouse.y}
            stroke={COLOR} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
        )}

        {/* Dots */}
        {DOTS.map(d => {
          const on = selSet.has(d.id);
          const idx = seq.indexOf(d.id);
          return (
            <g key={d.id}>
              <circle cx={d.x} cy={d.y} r={22} fill={on ? `${COLOR}18` : 'rgba(148,163,184,0.06)'} />
              <circle cx={d.x} cy={d.y} r={on ? 11 : 7}
                fill={on ? COLOR : '#94a3b8'}
                style={{ transition: 'all 0.12s' }} />
              {on && (
                <text x={d.x} y={d.y+1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill="white" fontWeight="bold">{idx+1}</text>
              )}
            </g>
          );
        })}
      </svg>
      {seq.length > 0 && seq.length < 4 && !active && (
        <p className="text-xs text-amber-500">Minimum 4 points requis</p>
      )}
    </div>
  );
}

/* ── Clavier dynamique PIN ── */
function DynamicKeyboard({ pinLength = 4, onComplete }) {
  const [keys] = useState(() => {
    const arr = [1,2,3,4,5,6,7,8,9,0];
    for (let i = arr.length-1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [entered, setEntered] = useState([]);
  const [done,    setDone]    = useState(false);

  const press = (d) => {
    if (done || entered.length >= pinLength) return;
    const next = [...entered, d];
    setEntered(next);
    if (next.length === pinLength) { setDone(true); setTimeout(() => onComplete(next), 200); }
  };
  const del = () => { if (!done) setEntered(p => p.slice(0,-1)); };

  return (
    <div className="space-y-4">
      {/* PIN dots */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: pinLength }).map((_, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
            i < entered.length ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-300'
          }`} />
        ))}
      </div>
      {/* Shuffled grid — 3 columns */}
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map(d => (
          <button key={d} onClick={() => press(d)} disabled={done}
            className="h-14 rounded-2xl bg-white border-2 border-slate-200 text-xl font-bold text-slate-800
              hover:bg-indigo-50 hover:border-indigo-300 active:scale-95 transition-all shadow-sm">
            {d}
          </button>
        ))}
        {/* Delete (11th cell in a 3-col grid: padding left empty cell before) */}
        <div />
        <button onClick={del} disabled={done}
          className="col-span-1 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-500
            hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all shadow-sm text-lg">
          ⌫
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function AppLogin() {
  const [login,   setLogin]   = useState("");
  const [pin,     setPin]     = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  /* ── Logo de l'école ── */
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [schoolName, setSchoolName] = useState("");

  /* ── Changement de mot de passe ── */
  const [mustChangePin,    setMustChangePin]    = useState(false);
  const [newPin,           setNewPin]           = useState("");
  const [confirmPin,       setConfirmPin]       = useState("");
  const [showNewPin,       setShowNewPin]       = useState(false);
  const [showConfirmPin,   setShowConfirmPin]   = useState(false);
  const [newPinTouched,    setNewPinTouched]    = useState(false);
  const [pendingUser,      setPendingUser]      = useState(null);
  const [pendingPinHash,   setPendingPinHash]   = useState("");

  /* ── 2FA : vérification TOTP ── */
  const [requires2FA,      setRequires2FA]      = useState(false);
  const [twoFATempToken,   setTwoFATempToken]   = useState("");
  const [twoFAUserName,    setTwoFAUserName]    = useState("");
  const [totpCode,         setTotpCode]         = useState("");
  const totpInputRef = useRef(null);

  /* ── 2FA : configuration forcée ── */
  const [requires2FASetup, setRequires2FASetup] = useState(false);
  const [forcedSetupQr,    setForcedSetupQr]    = useState(null);
  const [forcedSetupCode,  setForcedSetupCode]  = useState("");
  const [forcedSetupStep,  setForcedSetupStep]  = useState("start");

  /* ── Admin sécurité avancée ── */
  const [requiresAdminSecurity, setRequiresAdminSecurity] = useState(false);
  const [requiresAdminSetup,    setRequiresAdminSetup]    = useState(false);
  const [adminTempToken,        setAdminTempToken]        = useState('');
  const [adminStep,             setAdminStep]             = useState('pattern'); // 'pattern' | 'pin'
  const [adminPatternSeq,       setAdminPatternSeq]       = useState([]);
  const [adminPatternHash,      setAdminPatternHash]      = useState('');
  const [adminStep2Token,       setAdminStep2Token]       = useState('');
  // For setup flow:
  const [setupStep,        setSetupStep]        = useState('pattern1'); // 'pattern1'|'pattern2'|'pin1'|'pin2'
  const [setupPattern1Hash,setSetupPattern1Hash]= useState('');
  const pattern1SeqRef = useRef([]);
  const [setupPin1,        setSetupPin1]        = useState([]);
  const [setupPin1Hash,    setSetupPin1Hash]    = useState('');
  const [patternResetKey,  setPatternResetKey]  = useState(0);
  const [pinResetKey,      setPinResetKey]      = useState(0);

  useEffect(() => {
    const session = getSession();
    if (session) window.location.href = createPageUrl("Dashboard");
    // Charger le logo de l'école
    fetch("/api/functions/getSchoolSettings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.json())
      .then(d => { if (d.school_logo) setSchoolLogo(d.school_logo); if (d.school_name) setSchoolName(d.school_name); })
      .catch(() => {});
  }, []);

  const callFunction = async (fnName, payload) => {
    const res = await fetch(`/api/functions/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  /* ── Connexion ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!login.trim() || !pin.trim()) { setError("Veuillez renseigner votre identifiant et votre mot de passe."); return; }
    if (pin.trim().length < MIN_PASSWORD_LENGTH) { setError("Identifiants incorrects ou compte inactif."); return; }
    setLoading(true); setError("");
    const pinHash = await hashPin(pin.trim());
    const data = await callFunction("appLogin", { login: login.trim().toLowerCase(), pin_hash: pinHash });
    if (data.error) {
      setError(data.locked ? data.error : "Identifiants incorrects ou compte inactif.");
      setLoading(false); return;
    }
    if (data.requires_2fa) {
      setTwoFATempToken(data.temp_token); setTwoFAUserName(data.full_name || login);
      setRequires2FA(true); setTimeout(() => totpInputRef.current?.focus(), 100);
    } else if (data.requires_2fa_setup) {
      setTwoFATempToken(data.temp_token); setTwoFAUserName(data.full_name || login);
      setRequires2FASetup(true); setForcedSetupStep("start");
    } else if (data.requires_admin_security) {
      setAdminTempToken(data.temp_token);
      setAdminStep('pattern');
      setRequiresAdminSecurity(true);
    } else if (data.requires_admin_setup) {
      setAdminTempToken(data.temp_token);
      setSetupStep('pattern1');
      pattern1SeqRef.current = []; setSetupPattern1Hash(''); setSetupPin1([]); setSetupPin1Hash('');
      setRequiresAdminSetup(true);
    } else if (data.must_change_pin) {
      setPendingUser(data); setPendingPinHash(pinHash); setMustChangePin(true);
    } else {
      saveSession(data); window.location.href = createPageUrl("Dashboard");
    }
    setLoading(false);
  };

  /* ── TOTP ── */
  const handleTOTPSubmit = async (e) => {
    e.preventDefault();
    const code = totpCode.replace(/\s/g, "");
    if (code.length !== 6) { setError("Le code doit comporter 6 chiffres."); return; }
    setLoading(true); setError("");
    const data = await callFunction("verify2FALogin", { temp_token: twoFATempToken, code });
    if (data.error) { setError(data.error); setTotpCode(""); totpInputRef.current?.focus(); setLoading(false); return; }
    if (data.must_change_pin) { setPendingUser(data); setMustChangePin(true); }
    else { saveSession(data); window.location.href = createPageUrl("Dashboard"); }
    setLoading(false);
  };

  /* ── Setup 2FA forcé ── */
  const handleForcedSetupStart = async () => {
    setLoading(true); setError("");
    const data = await callFunction("setupForced2FA", { temp_token: twoFATempToken });
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setForcedSetupQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
    setForcedSetupStep("scan"); setForcedSetupCode("");
  };

  const handleForcedSetupConfirm = async (e) => {
    e.preventDefault();
    const code = forcedSetupCode.replace(/\s/g, "");
    if (code.length !== 6) { setError("Le code doit comporter 6 chiffres."); return; }
    setLoading(true); setError("");
    const data = await callFunction("confirmForced2FA", { temp_token: twoFATempToken, code });
    setLoading(false);
    if (data.error) { setError(data.error); setForcedSetupCode(""); return; }
    if (data.must_change_pin) { setPendingUser(data); setMustChangePin(true); setRequires2FASetup(false); }
    else { saveSession(data); window.location.href = createPageUrl("Dashboard"); }
  };

  /* ── Admin Pattern verify ── */
  const handleAdminPattern = async (seq) => {
    setError('');
    const hash = await hashPattern(seq);
    if (adminStep === 'pattern') {
      setLoading(true);
      const data = await callFunction('verifyAdminPattern', { temp_token: adminTempToken, pattern_hash: hash });
      setLoading(false);
      if (data.error) { setError(data.error); setPatternResetKey(k=>k+1); return; }
      setAdminStep2Token(data.step2_token);
      setAdminStep('pin');
    }
  };

  /* ── Admin PIN verify ── */
  const handleAdminPin = async (digits) => {
    setError('');
    const hash = await hashPin(digits.join(''));
    setLoading(true);
    const data = await callFunction('verifyAdminPin', { step2_token: adminStep2Token, pin_hash: hash });
    setLoading(false);
    if (data.error) { setError(data.error); setPinResetKey(k => k + 1); return; }
    if (data.requires_2fa) {
      setTwoFATempToken(data.temp_token); setTwoFAUserName(data.full_name || '');
      setRequires2FA(true); setRequiresAdminSecurity(false);
    } else if (data.must_change_pin) {
      setPendingUser(data); setMustChangePin(true); setRequiresAdminSecurity(false);
    } else {
      saveSession(data); window.location.href = createPageUrl('Dashboard');
    }
  };

  /* ── Admin Setup: pattern step 1 ── */
  const handleSetupPattern1 = async (seq) => {
    pattern1SeqRef.current = seq; // store immediately (no async, no stale closure)
    const h = await hashPattern(seq);
    setSetupPattern1Hash(h);
    setSetupStep('pattern2');
    setPatternResetKey(k=>k+1);
  };

  /* ── Admin Setup: pattern step 2 (confirm) ── */
  const handleSetupPattern2 = (seq) => {
    // Compare raw sequences via ref — avoids any stale-closure issue with hashed state
    if (seq.join(',') !== pattern1SeqRef.current.join(',')) {
      setError('Schéma différent. Redessinez exactement le même schéma.');
      setPatternResetKey(k => k + 1);
      return;
    }
    setError('');
    setSetupStep('pin1');
  };

  /* ── Admin Setup: PIN step 1 ── */
  const handleSetupPin1 = async (digits) => {
    setSetupPin1(digits);
    const h = await hashPin(digits.join(''));
    setSetupPin1Hash(h);
    setSetupStep('pin2');
  };

  /* ── Admin Setup: PIN step 2 (confirm) ── */
  const handleSetupPin2 = async (digits) => {
    const h = await hashPin(digits.join(''));
    if (h !== setupPin1Hash) {
      setError('Code différent. Ressaisissez votre PIN.');
      setPinResetKey(k => k + 1);
      return;
    }
    setError('');
    setLoading(true);
    const data = await callFunction('setupAdminSecurityStep', {
      temp_token: adminTempToken,
      pattern_hash: setupPattern1Hash,
      pin_hash: setupPin1Hash,
    });
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    if (data.must_change_pin) { setPendingUser(data); setMustChangePin(true); }
    else { saveSession(data); window.location.href = createPageUrl('Dashboard'); }
  };

  /* ── Complexité ── */
  const newPinValid    = allRulesPassed(newPin);
  const passwordsMatch = newPin.length > 0 && newPin === confirmPin;
  const canSubmit      = newPinValid && passwordsMatch;

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!newPinValid)    { setError("Le mot de passe ne respecte pas toutes les règles requises."); return; }
    if (!passwordsMatch) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true); setError("");
    const newHash = await hashPin(newPin);
    const data = await callFunction("appUpdatePin", { user_id: pendingUser.id, current_pin_hash: pendingPinHash, new_pin_hash: newHash });
    if (data.error) { setError(data.error); setLoading(false); return; }
    saveSession({ ...pendingUser, pin_hash: newHash, must_change_pin: false });
    window.location.href = createPageUrl("Dashboard");
    setLoading(false);
  };

  /* ════════════════════════════════════════════════════════
     VUE : Changement de mot de passe obligatoire
  ════════════════════════════════════════════════════════ */
  if (mustChangePin) {
    return (
      <FullScreenWrap>
        <style>{ANIM_STYLES}</style>
        <WhiteCard className="p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Changement de mot de passe requis</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Bonjour <strong className="text-slate-700">{pendingUser?.full_name}</strong>, définissez votre nouveau mot de passe pour accéder à l'application.
            </p>
          </div>

          <form onSubmit={handleChangePinSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Nouveau mot de passe</label>
              <ModernInput
                icon={Lock} type={showNewPin ? "text" : "password"}
                placeholder="Choisissez un mot de passe sécurisé"
                value={newPin} onChange={e => { setNewPin(e.target.value); setNewPinTouched(true); }}
                autoComplete="new-password" autoFocus
                rightSlot={
                  <button type="button" onClick={() => setShowNewPin(v => !v)} className="text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <PasswordRules password={newPin} show={newPinTouched} />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Confirmer le mot de passe</label>
              <ModernInput
                icon={Lock} type={showConfirmPin ? "text" : "password"}
                placeholder="Répétez le mot de passe"
                value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
                autoComplete="new-password"
                rightSlot={
                  <button type="button" onClick={() => setShowConfirmPin(v => !v)} className="text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              {confirmPin.length > 0 && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${passwordsMatch ? "text-emerald-600" : "text-red-400"}`}>
                  {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {passwordsMatch ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                </div>
              )}
            </div>

            {newPinTouched && (
              <div className="flex gap-1">
                {COMPLEXITY_RULES.map((r, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${r.test(newPin) ? "bg-emerald-500" : "bg-slate-200"}`} />
                ))}
              </div>
            )}

            <ErrorBox msg={error} />

            <button type="submit" className="btn-primary w-full h-11 text-white text-sm flex items-center justify-center gap-2" disabled={loading || !canSubmit}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Confirmer et accéder
            </button>
          </form>
        </WhiteCard>
      </FullScreenWrap>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Admin — Vérification sécurité avancée
  ════════════════════════════════════════════════════════ */
  if (requiresAdminSecurity) {
    return (
      <FullScreenWrap>
        <style>{ANIM_STYLES}</style>
        <WhiteCard className="p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Authentification Administrateur</h2>
            <p className="text-sm text-slate-500 mt-1">
              {adminStep === 'pattern' ? 'Étape 2 — Tracez votre schéma de sécurité' : 'Étape 3 — Saisissez votre code PIN'}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {['Mot de passe', 'Schéma', 'PIN'].map((label, i) => (
              <React.Fragment key={label}>
                <div className={`flex flex-col items-center gap-1`}>
                  <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                    i === 0 ? 'bg-emerald-500 text-white' :
                    (i === 1 && adminStep === 'pattern') || (i === 2 && adminStep === 'pin') ? 'bg-red-600 text-white' :
                    i < (['pattern','pin'].indexOf(adminStep) + 1) ? 'bg-emerald-500 text-white' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {i < (['pattern','pin'].indexOf(adminStep) + 1) ? <CheckCircle2 className="w-4 h-4"/> : i+1}
                  </div>
                  <span className="text-[9px] text-slate-400">{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 rounded-full mb-3 ${i < ['pattern','pin'].indexOf(adminStep)+1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {adminStep === 'pattern' && (
            <div className="flex justify-center">
              <PatternLock key={patternResetKey} onComplete={handleAdminPattern}
                label="Tracez votre schéma (minimum 4 points)" />
            </div>
          )}

          {adminStep === 'pin' && (
            <DynamicKeyboard key={'adminPin_' + pinResetKey} pinLength={4} onComplete={handleAdminPin} />
          )}

          <ErrorBox msg={error} />

          <button type="button" onClick={() => { setRequiresAdminSecurity(false); setError(''); setAdminStep('pattern'); }}
            className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors font-medium mt-4">
            ← Retour à la connexion
          </button>
        </WhiteCard>
      </FullScreenWrap>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Admin — Configuration initiale sécurité
  ════════════════════════════════════════════════════════ */
  if (requiresAdminSetup) {
    const setupSteps = ['pattern1', 'pattern2', 'pin1', 'pin2'];
    const stepLabels = ['Tracez votre schéma', 'Confirmez le schéma', 'Créez votre PIN', 'Confirmez le PIN'];
    const stepIdx = setupSteps.indexOf(setupStep);

    return (
      <FullScreenWrap>
        <style>{ANIM_STYLES}</style>
        <WhiteCard className="p-8">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Configuration sécurité</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configurez votre authentification à 3 facteurs (une seule fois)
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1 mb-6">
            {setupSteps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                  i < stepIdx ? 'bg-emerald-500 text-white' :
                  i === stepIdx ? 'bg-amber-500 text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5"/> : i+1}
                </div>
                {i < setupSteps.length-1 && (
                  <div className={`flex-1 h-0.5 rounded-full ${i < stepIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <p className="text-sm font-semibold text-slate-700 text-center mb-4">{stepLabels[stepIdx]}</p>

          {(setupStep === 'pattern1' || setupStep === 'pattern2') && (
            <div className="flex justify-center">
              <PatternLock key={patternResetKey} onComplete={setupStep === 'pattern1' ? handleSetupPattern1 : handleSetupPattern2}
                label={setupStep === 'pattern1' ? 'Dessinez votre schéma (min. 4 points)' : 'Redessinez le même schéma pour confirmer'} />
            </div>
          )}

          {(setupStep === 'pin1' || setupStep === 'pin2') && (
            <DynamicKeyboard key={setupStep + '_' + pinResetKey} pinLength={4} onComplete={setupStep === 'pin1' ? handleSetupPin1 : handleSetupPin2} />
          )}

          {loading && <div className="flex justify-center mt-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          <ErrorBox msg={error} />
        </WhiteCard>
      </FullScreenWrap>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Configuration 2FA forcée
  ════════════════════════════════════════════════════════ */
  if (requires2FASetup) {
    const steps = ["start", "scan", "confirm"];
    const stepIdx = steps.indexOf(forcedSetupStep);
    return (
      <FullScreenWrap>
        <style>{ANIM_STYLES}</style>
        <WhiteCard className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Configuration 2FA requise</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Bonjour <strong className="text-slate-700">{twoFAUserName}</strong>,
              l'administrateur a rendu la double authentification
              <span className="text-amber-600 font-semibold"> obligatoire</span> pour votre profil.
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300 ${
                  i < stepIdx ? "bg-emerald-500 text-white" :
                  i === stepIdx ? "bg-indigo-600 text-white shadow-md" :
                  "bg-slate-100 text-slate-400"
                }`}>
                  {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${i < stepIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Étape START */}
          {forcedSetupStep === "start" && (
            <div className="space-y-4 anim-slideUp">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2 text-sm text-indigo-800">
                <p className="font-semibold">📱 Ce dont vous aurez besoin :</p>
                <p className="text-xs text-indigo-700">• Une application TOTP : <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>Microsoft Authenticator</strong></p>
                <p className="text-xs text-indigo-700">• Environ 2 minutes pour la configuration</p>
              </div>
              <ErrorBox msg={error} />
              <button onClick={handleForcedSetupStart} disabled={loading}
                className="btn-primary w-full h-11 text-white text-sm flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Démarrer la configuration 2FA
              </button>
            </div>
          )}

          {/* Étape SCAN */}
          {forcedSetupStep === "scan" && forcedSetupQr && (
            <div className="space-y-4 anim-slideUp">
              <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                <li>Ouvrez votre application d'authentification</li>
                <li>Scannez le QR code ci-dessous</li>
                <li>Cliquez sur "Continuer" pour saisir le code</li>
              </ol>
              <div className="flex flex-col items-center gap-3 p-5 bg-slate-50 border-2 border-dashed border-indigo-200 rounded-2xl">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <img src={forcedSetupQr.qrDataUrl} alt="QR Code" className="w-44 h-44 rounded-xl shadow-md" />
                <p className="text-[10px] text-slate-400">Ou saisissez la clé manuellement :</p>
                <code className="text-xs bg-white border border-slate-200 px-3 py-2 rounded-xl font-mono tracking-widest text-slate-700 break-all text-center w-full">
                  {forcedSetupQr.secret}
                </code>
              </div>
              <button onClick={() => { setForcedSetupStep("confirm"); setError(""); }}
                className="btn-primary w-full h-11 text-white text-sm flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />J'ai scanné le QR code — Continuer
              </button>
            </div>
          )}

          {/* Étape CONFIRM */}
          {forcedSetupStep === "confirm" && (
            <form onSubmit={handleForcedSetupConfirm} className="space-y-4 anim-slideUp">
              <p className="text-sm text-slate-500 text-center">
                Saisissez le code à 6 chiffres affiché dans votre application d'authentification.
              </p>
              <input
                type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
                placeholder="000 000"
                value={forcedSetupCode}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setForcedSetupCode(raw.length > 3 ? raw.slice(0,3) + " " + raw.slice(3) : raw);
                }}
                className="input-modern w-full h-14 text-center text-2xl tracking-[0.5em] font-mono text-slate-800"
                autoComplete="one-time-code" autoFocus
              />
              <ErrorBox msg={error} />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setForcedSetupStep("scan"); setError(""); }}
                  className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  ← Retour
                </button>
                <button type="submit" disabled={loading || forcedSetupCode.replace(/\s/g,"").length !== 6}
                  className="btn-primary flex-1 h-11 text-white text-sm flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Activer et accéder
                </button>
              </div>
            </form>
          )}
        </WhiteCard>
      </FullScreenWrap>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Vérification TOTP
  ════════════════════════════════════════════════════════ */
  if (requires2FA) {
    return (
      <FullScreenWrap>
        <style>{ANIM_STYLES}</style>
        <WhiteCard className="p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow:"0 4px 20px rgba(99,102,241,0.2)" }}>
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Vérification en deux étapes</h2>
            <p className="text-sm text-slate-500 mt-2">
              Bonjour <strong className="text-slate-700">{twoFAUserName}</strong>, ouvrez votre application d'authentification et saisissez le code à 6 chiffres.
            </p>
          </div>

          <form onSubmit={handleTOTPSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2 text-center">Code d'authentification</label>
              <input
                ref={totpInputRef}
                type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
                placeholder="000 000"
                value={totpCode}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTotpCode(raw.length > 3 ? raw.slice(0,3) + " " + raw.slice(3) : raw);
                }}
                className="input-modern w-full h-16 text-center text-3xl tracking-[0.6em] font-mono text-slate-800"
                autoComplete="one-time-code" autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-2 text-center">Le code est renouvelé toutes les 30 secondes.</p>
            </div>

            <ErrorBox msg={error} />

            <button type="submit" disabled={loading || totpCode.replace(/\s/g,"").length !== 6}
              className="btn-primary w-full h-11 text-white text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Vérifier le code
            </button>

            <button type="button"
              onClick={() => { setRequires2FA(false); setTotpCode(""); setError(""); }}
              className="w-full text-xs text-slate-400 hover:text-indigo-500 transition-colors font-medium">
              ← Retour à la connexion
            </button>
          </form>
        </WhiteCard>
      </FullScreenWrap>
    );
  }

  /* ════════════════════════════════════════════════════════
     VUE : Connexion principale
  ════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex">
      <style>{ANIM_STYLES}</style>

      {/* ── Panneau gauche (marque) ── */}
      <BrandPanel />

      {/* ── Panneau droit (formulaire) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50 relative">
        {/* Motif de fond subtil */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:"radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)",
          backgroundSize:"28px 28px"
        }} />

        <div className="anim-slideUp relative z-10 w-full max-w-sm">

          {/* Logo & nom de l'établissement — centré en haut */}
          {(schoolLogo || schoolName) && (
            <div className="flex flex-col items-center gap-3 mb-8 pb-6 border-b border-slate-200">
              {schoolName && (
                <p style={{
                  fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "-0.02em",
                  color: "#1e293b",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}>
                  {schoolName}
                </p>
              )}
              {schoolLogo && (
                <img
                  src={schoolLogo}
                  alt={schoolName || "Logo établissement"}
                  className="h-20 w-auto max-w-[220px] object-contain"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          )}

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background:"linear-gradient(135deg,#6366f1,#4338ca)" }}>
              🏫
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg leading-none">EduGest</p>
              <p className="text-xs text-slate-500">Plateforme scolaire</p>
            </div>
          </div>

          {/* Titre */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bon retour 👋</h2>
            <p className="text-slate-500 text-sm mt-1">Connectez-vous à votre espace EduGest</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Identifiant</label>
              <ModernInput
                icon={User}
                type="text"
                placeholder="N° étudiant, email ou téléphone"
                value={login}
                onChange={e => setLogin(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Mot de passe</label>
              <ModernInput
                icon={Lock}
                type={showPin ? "text" : "password"}
                placeholder="Votre mot de passe"
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoComplete="current-password"
                rightSlot={
                  <button type="button" onClick={() => setShowPin(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <ErrorBox msg={error} />

            <button type="submit" disabled={loading}
              className="btn-primary w-full h-11 text-white text-sm flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>

          {/* Aide roles */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Qui êtes-vous ?</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon:"🎒", role:"Élève",       hint:"N° étudiant" },
                { icon:"👨‍👩‍👧", role:"Parent",      hint:"Email ou tél." },
                { icon:"📚", role:"Enseignant",  hint:"Email ou tél." },
              ].map(({ icon, role, hint }) => (
                <div key={role} className="flex flex-col items-center gap-1 bg-white border border-slate-200 rounded-xl py-2.5 px-2 text-center">
                  <span className="text-lg">{icon}</span>
                  <p className="text-[11px] font-semibold text-slate-700">{role}</p>
                  <p className="text-[10px] text-slate-400">{hint}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-3">
              Mot de passe oublié ? Contactez l'administration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
