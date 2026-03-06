import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ROLES } from "@/components/roles/roles";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: "Bonjour", emoji: "☀️" };
  if (h >= 12 && h < 18) return { text: "Bon après-midi", emoji: "🌤️" };
  if (h >= 18 && h < 22) return { text: "Bonsoir", emoji: "🌇" };
  return { text: "Bonne nuit", emoji: "🌙" };
}

export default function WelcomeBanner({ currentRole }) {
  const [user, setUser] = useState(null);
  const { text, emoji } = getGreeting();
  const roleConfig = currentRole ? ROLES[currentRole] : null;

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm mb-6">
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${roleConfig?.color || "from-blue-400 to-blue-600"} flex items-center justify-center text-2xl shadow-md flex-shrink-0`}>
        {roleConfig?.icon || "👤"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 text-sm">{emoji} {text} !</p>
        <p className="text-slate-900 font-bold text-lg truncate">
          {user.full_name || user.email}
        </p>
        <p className="text-xs text-slate-400">
          {roleConfig?.label || "Utilisateur"} · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}