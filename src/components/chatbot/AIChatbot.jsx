import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, X, Send, Loader2, Sparkles, ChevronDown,
  BookOpen, Users, BarChart2, ClipboardList, Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ─── Role-based chat configurations ───────────────────────────────────────────
const CHAT_MODES = {
  eleve: {
    label: "Aide aux devoirs",
    icon: BookOpen,
    color: "from-pink-500 to-pink-700",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-200",
    accentText: "text-pink-700",
    emoji: "🎒",
    systemPrompt: `Tu es un assistant pédagogique bienveillant pour les élèves. Tu aides avec les devoirs, expliques les leçons de façon simple et claire, encourages l'élève. Tu poses des questions pour guider plutôt que de donner directement les réponses. Tu t'adaptes au niveau collège/lycée. Tu réponds toujours en français.`,
    suggestions: [
      "Explique-moi les équations du 2nd degré",
      "Comment analyser un texte en français ?",
      "C'est quoi la photosynthèse ?",
      "Aide-moi à faire un plan de dissertation",
    ]
  },
  parent: {
    label: "Comprendre le bulletin",
    icon: Users,
    color: "from-amber-500 to-amber-700",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    accentText: "text-amber-700",
    emoji: "👨‍👩‍👧",
    systemPrompt: `Tu es un conseiller pédagogique bienveillant pour les parents d'élèves. Tu aides à comprendre les bulletins scolaires, les notes, les appréciations des enseignants. Tu expliques le système de notation français, donnes des conseils pour accompagner son enfant à la maison. Tu es rassurant et constructif. Tu réponds toujours en français.`,
    suggestions: [
      "Que veut dire la mention 'peut mieux faire' ?",
      "Mon enfant a 11/20 en maths, est-ce bien ?",
      "Comment aider mon enfant à réviser ?",
      "Que signifie un avertissement ?",
    ]
  },
  direction: {
    label: "Analyse KPI Direction",
    icon: BarChart2,
    color: "from-slate-700 to-slate-900",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    accentText: "text-slate-700",
    emoji: "👑",
    systemPrompt: `Tu es un conseiller stratégique pour la direction d'un établissement scolaire. Tu analyses les indicateurs de performance (KPIs), taux de réussite, absentéisme, résultats par classe et matière. Tu formules des recommandations de pilotage concrètes. Tu maîtrises les enjeux de management scolaire, de qualité pédagogique et de gestion d'équipe. Tu réponds toujours en français avec une approche professionnelle et factuelle.`,
    suggestions: [
      "Comment interpréter un taux d'absentéisme de 12% ?",
      "Quels KPIs surveiller en priorité ?",
      "Comment améliorer les résultats d'une classe en difficulté ?",
      "Quels leviers pour réduire le décrochage scolaire ?",
    ]
  },
  admin: {
    label: "Assistant Administratif",
    icon: ClipboardList,
    color: "from-cyan-600 to-cyan-800",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    accentText: "text-cyan-700",
    emoji: "📋",
    systemPrompt: `Tu es un assistant administratif expert pour un établissement scolaire français. Tu aides avec la gestion du planning, l'organisation des emplois du temps, la rédaction de courriers officiels, la connaissance du règlement intérieur type, les procédures administratives, les délais légaux. Tu fournis des modèles de documents et des conseils pratiques. Tu réponds toujours en français de façon précise et professionnelle.`,
    suggestions: [
      "Rédige un courrier de convocation aux parents",
      "Quels sont les droits d'un élève exclu ?",
      "Comment organiser un conseil de classe ?",
      "Modèle de règlement intérieur type",
    ]
  },
};

// ─── Role → mode mapping ───────────────────────────────────────────────────────
const ROLE_TO_MODE = {
  eleve: "eleve",
  parent: "parent",
  directeur_general: "direction",
  directeur_primaire: "direction",
  directeur_college: "direction",
  directeur_lycee: "direction",
  cpe: "admin",
  enseignant: "admin",
  secretaire: "admin",
  comptable: "admin",
};

// ─── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm",
        isUser
          ? "bg-slate-800 text-white rounded-br-sm"
          : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
      )}>
        {isUser ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-1 ml-3 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 ml-3 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children }) => <code className="bg-slate-100 px-1 rounded text-xs">{children}</code>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ─── Main Chatbot Component ────────────────────────────────────────────────────
export default function AIChatbot() {
  const role = localStorage.getItem("edugest_role") || "secretaire";
  const defaultMode = ROLE_TO_MODE[role] || "admin";

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(defaultMode);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const modeConfig = CHAT_MODES[mode];
  const ModeIcon = modeConfig.icon;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages]);

  // Reset messages when mode changes
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setMessages([]);
    setShowModeSelector(false);
  };

  const sendMessage = async (content) => {
    if (!content.trim() || loading) return;
    const userMsg = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Build prompt with context
    const history = newMessages.slice(-10).map(m => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`).join("\n");
    const prompt = `${modeConfig.systemPrompt}\n\nHistorique de la conversation:\n${history}\n\nRéponds maintenant à la dernière question de l'utilisateur de façon claire et utile.`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { role: "assistant", content: response }]);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-500/40 flex items-center justify-center text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[370px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-200 bg-white"
          style={{ height: "560px" }}>

          {/* Header */}
          <div className={`bg-gradient-to-r ${modeConfig.color} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                {modeConfig.emoji}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Assistant IA EduGest</p>
                <button
                  onClick={() => setShowModeSelector(!showModeSelector)}
                  className="flex items-center gap-1 text-white/70 text-xs hover:text-white transition-colors"
                >
                  <ModeIcon className="w-3 h-3" />
                  {modeConfig.label}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showModeSelector && "rotate-180")} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white/60" />
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mode selector dropdown */}
          {showModeSelector && (
            <div className="flex-shrink-0 border-b border-slate-100 bg-white p-2 grid grid-cols-2 gap-1">
              {Object.entries(CHAT_MODES).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleModeChange(key)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-medium transition-all text-left",
                      mode === key ? `${cfg.bgLight} ${cfg.accentText} border ${cfg.borderColor}` : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="text-base">{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center pt-4">
                <div className={`inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${modeConfig.color} items-center justify-center text-2xl mb-3`}>
                  {modeConfig.emoji}
                </div>
                <p className="font-semibold text-slate-700 text-sm mb-1">{modeConfig.label}</p>
                <p className="text-slate-400 text-xs mb-4">Posez votre question ou choisissez une suggestion ci-dessous</p>
                <div className="space-y-2">
                  {modeConfig.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className={cn(
                        "w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm",
                        modeConfig.bgLight, modeConfig.borderColor, modeConfig.accentText
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-slate-100 bg-white">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-400 hover:text-slate-600 mb-2 block ml-auto"
              >
                Effacer la conversation
              </button>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Votre question..."
                className="flex-1 text-sm h-10 rounded-xl border-slate-200"
                disabled={loading}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className={cn("h-10 w-10 p-0 rounded-xl bg-gradient-to-br", modeConfig.color, "text-white flex-shrink-0 hover:opacity-90")}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}