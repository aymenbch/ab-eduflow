import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, Paperclip, Lock, Megaphone, BarChart2, Pin,
  Smile, Loader2, ChevronDown, Brain
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GROUP_TYPE_CONFIG = {
  classe_eleves:  { label: "Classe Élèves",   color: "from-blue-500 to-blue-700" },
  classe_parents: { label: "Classe Parents",  color: "from-purple-500 to-purple-700" },
  classe_prof:    { label: "Classe + Prof",   color: "from-indigo-500 to-indigo-700" },
  matiere:        { label: "Matière",         color: "from-green-500 to-green-700" },
  club:           { label: "Club",            color: "from-yellow-500 to-yellow-700" },
  internat:       { label: "Internat",        color: "from-orange-500 to-orange-700" },
  transport:      { label: "Transport",       color: "from-cyan-500 to-cyan-700" },
  projet:         { label: "Projet",          color: "from-pink-500 to-pink-700" },
  enseignants:    { label: "Enseignants",     color: "from-teal-500 to-teal-700" },
  annonces:       { label: "Annonces Officielles", color: "from-red-500 to-red-700" },
};

export default function ChatArea({ group, currentRole }) {
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [postType, setPostType] = useState("text");
  const [uploading, setUploading] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [aiSummarizing, setAiSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const authorName = currentRole === "directeur_general" ? "Direction" : currentRole || "Utilisateur";

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["social-posts", group.id],
    queryFn: () => base44.entities.SocialPost.filter({ group_id: group.id }, "-created_date", 100),
    refetchInterval: 5000,
  });

  // Reverse to show oldest first
  const orderedPosts = [...posts].reverse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts.length]);

  const sendMutation = useMutation({
    mutationFn: async (postData) => {
      return base44.entities.SocialPost.create(postData);
    },
    onSuccess: () => {
      setContent("");
      setReplyTo(null);
      setFileData(null);
      setPostType("text");
      qc.invalidateQueries(["social-posts", group.id]);
      qc.invalidateQueries(["social-groups"]);
    }
  });

  const handleSend = async () => {
    if (!content.trim() && !fileData) return;
    const postData = {
      group_id: group.id,
      author_name: authorName,
      author_role: currentRole,
      content: content.trim(),
      type: fileData ? "file" : postType,
      is_announcement: postType === "announcement",
      parent_post_id: replyTo?.id || null,
      ...(fileData || {}),
    };
    sendMutation.mutate(postData);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileData({ file_url, file_name: file.name, file_type: file.type });
      setContent(prev => prev || file.name);
      toast.success("Fichier prêt à envoyer");
    } catch {
      toast.error("Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const handlePin = async (post) => {
    await base44.entities.SocialPost.update(post.id, { is_pinned: !post.is_pinned });
    qc.invalidateQueries(["social-posts", group.id]);
    toast.success(post.is_pinned ? "Message désépinglé" : "Message épinglé");
  };

  const handleFlag = async (post) => {
    await base44.entities.SocialPost.update(post.id, { is_flagged: true, flag_reason: "Signalement manuel" });
    qc.invalidateQueries(["social-posts", group.id]);
    toast.success("Message signalé à la modération");
  };

  const handleAISummary = async () => {
    if (posts.length === 0) return;
    setAiSummarizing(true);
    try {
      const lastPosts = orderedPosts.slice(-30).map(p => `${p.author_name}: ${p.content}`).join("\n");
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Voici les derniers messages du groupe "${group.name}" d'une plateforme scolaire :\n\n${lastPosts}\n\nFais un résumé en 3-4 points des échanges importants, en mettant en avant les actions à retenir, les informations clés et l'ambiance générale. Réponds en français.`,
      });
      setAiSummary(res);
    } catch {
      toast.error("Erreur IA");
    } finally {
      setAiSummarizing(false);
    }
  };

  const cfg = GROUP_TYPE_CONFIG[group.type] || {};
  const pinnedPosts = orderedPosts.filter(p => p.is_pinned);
  const isReadonly = group.is_readonly;
  const isAdminOrTeacher = ["directeur_general","directeur_primaire","directeur_college","directeur_lycee","enseignant","admin_systeme","cpe"].includes(currentRole);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className={cn("px-4 py-3 bg-gradient-to-r text-white flex items-center justify-between flex-shrink-0", cfg.color || "from-blue-500 to-blue-700")}>
        <div>
          <h3 className="font-bold text-sm">{group.name}</h3>
          <p className="text-xs text-white/70">{cfg.label} {group.is_readonly ? "· lecture seule" : `· ${posts.length} messages`}</p>
        </div>
        <div className="flex items-center gap-2">
          {pinnedPosts.length > 0 && (
            <Badge className="bg-white/20 text-white text-[10px]">
              <Pin className="w-2.5 h-2.5 mr-1" />{pinnedPosts.length} épinglé(s)
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 gap-1 text-xs"
            onClick={handleAISummary} disabled={aiSummarizing}>
            {aiSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            Résumé IA
          </Button>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl text-xs text-slate-700">
          <div className="flex items-center gap-2 mb-1 font-semibold text-purple-700">
            <Brain className="w-3.5 h-3.5" /> Résumé IA
          </div>
          <p className="whitespace-pre-wrap">{aiSummary}</p>
          <button className="text-purple-500 text-[10px] mt-1 hover:underline" onClick={() => setAiSummary("")}>Fermer</button>
        </div>
      )}

      {/* Pinned messages */}
      {pinnedPosts.length > 0 && (
        <div className="mx-4 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800 flex items-center gap-2">
          <Pin className="w-3 h-3" />
          <span className="font-semibold">{pinnedPosts[0].author_name} :</span>
          <span className="truncate">{pinnedPosts[0].content}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
        {!isLoading && orderedPosts.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun message pour l'instant</p>
            <p className="text-xs mt-1">Soyez le premier à écrire !</p>
          </div>
        )}
        {orderedPosts.map(post => (
          <MessageBubble
            key={post.id}
            post={post}
            isOwn={post.author_role === currentRole}
            groupId={group.id}
            onReply={setReplyTo}
            onPin={isAdminOrTeacher ? handlePin : undefined}
            onFlag={handleFlag}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="mx-4 px-3 py-2 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg text-xs flex items-center justify-between">
          <span className="text-blue-700"><span className="font-semibold">{replyTo.author_name}:</span> {replyTo.content.slice(0, 60)}…</span>
          <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600 ml-2">✕</button>
        </div>
      )}

      {/* Input area */}
      {!isReadonly || isAdminOrTeacher ? (
        <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
          {/* Type selector */}
          <div className="flex gap-1 mb-2">
            {["text","announcement","poll"].map(t => (
              <button key={t} onClick={() => setPostType(t)}
                className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-all",
                  postType === t ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:border-slate-400")}>
                {t === "text" ? "Message" : t === "announcement" ? "📢 Annonce" : "📊 Sondage"}
              </button>
            ))}
          </div>

          {fileData && (
            <div className="flex items-center gap-2 text-xs text-blue-600 mb-2 bg-blue-50 px-3 py-1.5 rounded-lg">
              <Paperclip className="w-3 h-3" />
              <span className="truncate">{fileData.file_name}</span>
              <button onClick={() => setFileData(null)} className="ml-auto text-slate-400">✕</button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isReadonly ? "Annonce officielle..." : "Écrire un message… (Entrée pour envoyer)"}
              className="min-h-[40px] max-h-32 resize-none text-sm"
              rows={1}
            />
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
              onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Button className="h-9 w-9 flex-shrink-0 bg-blue-600 hover:bg-blue-700" size="icon"
              onClick={handleSend} disabled={sendMutation.isPending || (!content.trim() && !fileData)}>
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-center gap-2 text-sm text-slate-500 flex-shrink-0">
          <Lock className="w-4 h-4" />
          Canal en lecture seule — seule la direction peut publier
        </div>
      )}
    </div>
  );
}