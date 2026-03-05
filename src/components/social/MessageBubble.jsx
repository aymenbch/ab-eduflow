import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pin, Flag, SmilePlus, Reply, MoreHorizontal,
  AlertTriangle, Paperclip, Megaphone
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const QUICK_REACTIONS = ["👍","❤️","😂","🎉","🤔","👏"];

const SENTIMENT_COLORS = {
  positif:  "bg-green-50 border-green-200",
  neutre:   "",
  negatif:  "bg-orange-50 border-orange-200",
  alerte:   "bg-red-50 border-red-200",
};

const CLASS_LABELS = {
  information: { label: "Info",      cls: "bg-blue-100 text-blue-700" },
  devoir:      { label: "Devoir",    cls: "bg-purple-100 text-purple-700" },
  urgence:     { label: "Urgent",    cls: "bg-red-100 text-red-700" },
  pedagogique: { label: "Pédago",   cls: "bg-green-100 text-green-700" },
  social:      { label: "Social",    cls: "bg-yellow-100 text-yellow-700" },
  risque:      { label: "⚠️ Risque", cls: "bg-red-200 text-red-800" },
};

export default function MessageBubble({ post, isOwn, onReply, onPin, onFlag, groupId }) {
  const [showReactions, setShowReactions] = useState(false);
  const qc = useQueryClient();

  const reactMutation = useMutation({
    mutationFn: async (emoji) => {
      const reactions = { ...(post.reactions || {}) };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return base44.entities.SocialPost.update(post.id, { reactions });
    },
    onSuccess: () => qc.invalidateQueries(["social-posts", groupId])
  });

  const isAnnouncement = post.is_announcement || post.type === "announcement";
  const sentimentClass = SENTIMENT_COLORS[post.ai_sentiment] || "";
  const classification = CLASS_LABELS[post.ai_classification];

  return (
    <div className={cn("group flex gap-2", isOwn ? "flex-row-reverse" : "flex-row", "items-end")}>
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">
          {post.author_name?.[0] || "?"}
        </div>
      )}

      <div className={cn("max-w-[72%] space-y-1", isOwn && "items-end flex flex-col")}>
        {/* Author + meta */}
        {!isOwn && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-slate-700">{post.author_name}</span>
            {post.author_role && (
              <span className="text-[10px] text-slate-400">{post.author_role}</span>
            )}
            {classification && (
              <Badge className={cn("text-[9px] h-4 px-1", classification.cls)}>{classification.label}</Badge>
            )}
          </div>
        )}

        {/* Announcement banner */}
        {isAnnouncement && (
          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1 mb-1">
            <Megaphone className="w-3 h-3" />
            <span className="font-semibold">Annonce officielle</span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "relative px-4 py-2.5 rounded-2xl border shadow-sm",
          isOwn
            ? "bg-blue-600 text-white border-transparent rounded-br-sm"
            : cn("bg-white text-slate-800 rounded-bl-sm", sentimentClass),
          post.is_pinned && "ring-2 ring-yellow-400",
          post.is_flagged && "ring-2 ring-red-400"
        )}>
          {/* Pinned indicator */}
          {post.is_pinned && (
            <div className="flex items-center gap-1 text-yellow-600 text-[10px] mb-1 font-semibold">
              <Pin className="w-3 h-3" /> Épinglé
            </div>
          )}
          {post.is_flagged && (
            <div className="flex items-center gap-1 text-red-600 text-[10px] mb-1 font-semibold">
              <AlertTriangle className="w-3 h-3" /> Signalé par modération IA
            </div>
          )}

          {/* File attachment */}
          {post.file_url && (
            <a href={post.file_url} target="_blank" rel="noreferrer"
              className={cn("flex items-center gap-2 mb-2 text-xs underline", isOwn ? "text-blue-100" : "text-blue-600")}>
              <Paperclip className="w-3 h-3" />
              {post.file_name || "Fichier joint"}
            </a>
          )}

          {/* Poll */}
          {post.type === "poll" && post.poll_options?.length > 0 && (
            <div className="mb-2 space-y-1">
              <p className="text-xs font-semibold mb-1">📊 Sondage</p>
              {post.poll_options.map((opt, i) => (
                <div key={i} className={cn("px-3 py-1.5 rounded-lg text-xs border cursor-pointer hover:opacity-80",
                  isOwn ? "bg-blue-500 border-blue-400 text-white" : "bg-slate-50 border-slate-200")}>
                  {opt}
                </div>
              ))}
            </div>
          )}

          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isOwn ? "text-white" : "text-slate-800")}>
            {post.content}
          </p>

          {/* Reactions */}
          {post.reactions && Object.keys(post.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(post.reactions).map(([emoji, count]) => (
                <button key={emoji}
                  onClick={() => reactMutation.mutate(emoji)}
                  className="flex items-center gap-0.5 bg-white/20 hover:bg-white/30 rounded-full px-1.5 py-0.5 text-xs">
                  {emoji} <span>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI summary */}
        {post.ai_summary && (
          <p className="text-[10px] text-slate-400 italic px-1">✨ {post.ai_summary}</p>
        )}

        {/* Time */}
        <div className={cn("flex items-center gap-2 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-slate-400">
            {post.created_date ? new Date(post.created_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
          {post.edited && <span className="text-[10px] text-slate-400">(modifié)</span>}
        </div>
      </div>

      {/* Actions (hover) */}
      <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-6 flex-shrink-0")}>
        <button onClick={() => setShowReactions(v => !v)}
          className="p-1 rounded-full hover:bg-slate-100">
          <SmilePlus className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button onClick={() => onReply && onReply(post)}
          className="p-1 rounded-full hover:bg-slate-100">
          <Reply className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-full hover:bg-slate-100">
              <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="text-xs">
            <DropdownMenuItem onClick={() => onPin && onPin(post)}>
              <Pin className="w-3 h-3 mr-2" /> {post.is_pinned ? "Désépingler" : "Épingler"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFlag && onFlag(post)} className="text-red-600">
              <Flag className="w-3 h-3 mr-2" /> Signaler
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick reaction picker */}
      {showReactions && (
        <div className="absolute bg-white border border-slate-200 rounded-xl shadow-lg p-2 flex gap-1 z-20">
          {QUICK_REACTIONS.map(emoji => (
            <button key={emoji}
              onClick={() => { reactMutation.mutate(emoji); setShowReactions(false); }}
              className="text-lg hover:scale-125 transition-transform">
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}