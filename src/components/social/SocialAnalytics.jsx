import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from "recharts";
import { MessageSquare, AlertTriangle, TrendingUp, Brain, Users, Shield } from "lucide-react";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
const SENTIMENT_COLORS = { positif: "#10b981", neutre: "#6b7280", negatif: "#f59e0b", alerte: "#ef4444" };
const CLASS_COLORS = {
  information: "#3b82f6", devoir: "#8b5cf6", urgence: "#ef4444",
  pedagogique: "#10b981", social: "#f59e0b", risque: "#dc2626"
};

export default function SocialAnalytics({ groups }) {
  const { data: allPosts = [] } = useQuery({
    queryKey: ["social-posts-all"],
    queryFn: () => base44.entities.SocialPost.list(),
  });
  const { data: badges = [] } = useQuery({
    queryKey: ["social-badges"],
    queryFn: () => base44.entities.SocialBadge.list(),
  });

  // KPIs
  const totalMessages = allPosts.length;
  const flaggedMessages = allPosts.filter(p => p.is_flagged).length;
  const riskIndex = totalMessages > 0 ? ((flaggedMessages / totalMessages) * 100).toFixed(1) : 0;
  const pedaMessages = allPosts.filter(p => p.ai_classification === "pedagogique").length;
  const pedaRate = totalMessages > 0 ? ((pedaMessages / totalMessages) * 100).toFixed(0) : 0;

  // Activity by group
  const groupActivity = groups.slice(0, 8).map(g => ({
    name: g.name.length > 15 ? g.name.slice(0, 15) + "…" : g.name,
    messages: allPosts.filter(p => p.group_id === g.id).length,
  })).sort((a, b) => b.messages - a.messages);

  // Sentiment distribution
  const sentiments = ["positif","neutre","negatif","alerte"].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: allPosts.filter(p => p.ai_sentiment === s).length,
    color: SENTIMENT_COLORS[s],
  })).filter(s => s.value > 0);

  // Classification distribution
  const classifications = ["information","devoir","urgence","pedagogique","social","risque"].map(c => ({
    name: c.charAt(0).toUpperCase() + c.slice(1),
    value: allPosts.filter(p => p.ai_classification === c).length,
    fill: CLASS_COLORS[c],
  })).filter(c => c.value > 0);

  // Author activity (top contributors)
  const authorMap = {};
  allPosts.forEach(p => {
    authorMap[p.author_name] = (authorMap[p.author_name] || 0) + 1;
  });
  const topAuthors = Object.entries(authorMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Badge distribution
  const badgeTypes = ["solidaire","contributeur_academique","leader_positif","mentor","createur","assidu"];
  const badgeDist = badgeTypes.map(t => ({
    name: t.replace(/_/g, " "),
    count: badges.filter(b => b.badge_type === t).length,
  }));

  const kpis = [
    { label: "Messages totaux",    value: totalMessages, icon: MessageSquare, color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Taux pédagogique",   value: pedaRate + "%", icon: TrendingUp,   color: "text-green-600",  bg: "bg-green-50" },
    { label: "Index risque cyber", value: riskIndex + "%",icon: Shield,       color: "text-red-600",    bg: "bg-red-50" },
    { label: "Groupes actifs",     value: groups.length,  icon: Users,        color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Badges attribués",   value: badges.length,  icon: Brain,        color: "text-amber-600",  bg: "bg-amber-50" },
    { label: "Messages signalés",  value: flaggedMessages,icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      <h2 className="text-lg font-bold text-slate-900">Analytics & Tableau de bord BI</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
                <p className="text-xs text-slate-500">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity by group */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activité par groupe</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={groupActivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="messages" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Analyse sentimentale</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <PieChart width={120} height={120}>
              <Pie data={sentiments} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                {sentiments.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-1.5 flex-1">
              {sentiments.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-700 flex-1">{s.name}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
              {sentiments.length === 0 && <p className="text-xs text-slate-400">Données insuffisantes</p>}
            </div>
          </CardContent>
        </Card>

        {/* Classification */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Classification IA des messages</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classifications} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {classifications.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top contributors */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top contributeurs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topAuthors.length === 0 && <p className="text-xs text-slate-400">Aucun message</p>}
              {topAuthors.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i+1}</div>
                  <span className="flex-1 text-sm text-slate-700 truncate">{a.name}</span>
                  <Badge variant="secondary" className="text-xs">{a.count} msg</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Gamification — Badges distribués</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {badgeDist.map((b, i) => (
              <div key={i} className="text-center p-2 bg-slate-50 rounded-xl">
                <div className="text-2xl mb-1">
                  {["🤝","🎓","🏆","🧑‍🏫","✨","📅"][i]}
                </div>
                <p className="text-xs font-medium text-slate-700 capitalize">{b.name}</p>
                <p className="text-lg font-bold text-blue-600">{b.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk alert */}
      {parseFloat(riskIndex) > 5 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-semibold text-red-700">⚠️ Indice de risque cyberharcèlement élevé</p>
              <p className="text-sm text-red-600">{flaggedMessages} messages signalés sur {totalMessages} ({riskIndex}%). Une intervention est recommandée.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}