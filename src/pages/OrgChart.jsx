import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ROLES } from "@/components/roles/roles";
import {
  ZoomIn, ZoomOut, RotateCcw, Users, ChevronDown, ChevronRight,
  Download, Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Hierarchy definition ───────────────────────────────────────────────────
const HIERARCHY = [
  {
    role: "directeur_general",
    children: [
      {
        role: "admin_systeme",
        children: [],
      },
      {
        role: "directeur_primaire",
        children: [
          { role: "enseignant", children: [] },
        ],
      },
      {
        role: "directeur_college",
        children: [],
      },
      {
        role: "directeur_lycee",
        children: [],
      },
      {
        role: "cpe",
        children: [],
      },
      {
        role: "secretaire",
        children: [],
      },
      {
        role: "comptable",
        children: [],
      },
    ],
  },
];

// Leaf roles shown at bottom as separate section
const LEAF_ROLES = ["eleve", "parent"];

// ─── Color palette per role (from / to) ─────────────────────────────────────
const ROLE_STYLES = {
  directeur_general:  { from: "#1e293b", to: "#334155", border: "#475569", text: "#f8fafc" },
  admin_systeme:      { from: "#991b1b", to: "#b91c1c", border: "#dc2626", text: "#fef2f2" },
  directeur_primaire: { from: "#1d4ed8", to: "#2563eb", border: "#3b82f6", text: "#eff6ff" },
  directeur_college:  { from: "#4338ca", to: "#4f46e5", border: "#6366f1", text: "#eef2ff" },
  directeur_lycee:    { from: "#6d28d9", to: "#7c3aed", border: "#8b5cf6", text: "#f5f3ff" },
  cpe:                { from: "#c2410c", to: "#ea580c", border: "#f97316", text: "#fff7ed" },
  enseignant:         { from: "#15803d", to: "#16a34a", border: "#22c55e", text: "#f0fdf4" },
  secretaire:         { from: "#0e7490", to: "#0891b2", border: "#06b6d4", text: "#ecfeff" },
  comptable:          { from: "#0f766e", to: "#0d9488", border: "#14b8a6", text: "#f0fdfa" },
  eleve:              { from: "#be185d", to: "#db2777", border: "#ec4899", text: "#fdf2f8" },
  parent:             { from: "#b45309", to: "#d97706", border: "#f59e0b", text: "#fffbeb" },
};

// ─── OrgNode component ───────────────────────────────────────────────────────
function OrgNode({ node, usersByRole, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const cfg = ROLES[node.role];
  const style = ROLE_STYLES[node.role] || ROLE_STYLES.directeur_general;
  const people = usersByRole[node.role] || [];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className="org-li">
      <div className="org-node-wrapper">
        {/* Card */}
        <div
          className="org-card group"
          style={{
            background: `linear-gradient(135deg, ${style.from}, ${style.to})`,
            borderColor: style.border,
          }}
        >
          {/* Header row */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-2xl leading-none select-none">{cfg?.icon || "👤"}</span>
            <div className="flex-1 min-w-0">
              <p
                className="font-bold text-[13px] leading-snug truncate"
                style={{ color: style.text }}
              >
                {cfg?.label || node.role}
              </p>
              <p
                className="text-[10px] leading-snug opacity-70 truncate"
                style={{ color: style.text }}
              >
                {cfg?.description || ""}
              </p>
            </div>
            {/* Count badge */}
            <span
              className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.22)",
                color: style.text,
              }}
            >
              {people.length}
            </span>
          </div>

          {/* People list (show up to 3, then "+N") */}
          {people.length > 0 && (
            <ul className="space-y-0.5 mt-1">
              {people.slice(0, 3).map((p) => (
                <li
                  key={p.id}
                  className="text-[11px] truncate px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: style.text,
                  }}
                >
                  {p.full_name || p.email || "—"}
                </li>
              ))}
              {people.length > 3 && (
                <li
                  className="text-[11px] px-2 py-0.5 rounded font-medium"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: style.text,
                    opacity: 0.8,
                  }}
                >
                  +{people.length - 3} autres…
                </li>
              )}
            </ul>
          )}

          {people.length === 0 && (
            <p
              className="text-[11px] px-2 py-0.5 rounded italic opacity-60"
              style={{ color: style.text }}
            >
              Aucun membre
            </p>
          )}

          {/* Expand toggle */}
          {hasChildren && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all"
              style={{
                background: style.border,
                color: "#fff",
              }}
              title={expanded ? "Réduire" : "Développer"}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul className="org-ul">
          {node.children.map((child) => (
            <OrgNode
              key={child.role}
              node={child}
              usersByRole={usersByRole}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function OrgChart() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    base44.entities.AppUser.list()
      .then((data) => setUsers(data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const usersByRole = React.useMemo(() => {
    const map = {};
    for (const u of users) {
      if (!u.role) continue;
      if (!map[u.role]) map[u.role] = [];
      map[u.role].push(u);
    }
    return map;
  }, [users]);

  const totalStaff = users.filter(
    (u) => !["eleve", "parent"].includes(u.role)
  ).length;

  const handleExport = () => {
    if (!containerRef.current) return;
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Organigramme</h1>
            <p className="text-sm text-slate-500">
              Hiérarchie institutionnelle de l'établissement
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600"
              title="Zoom arrière"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-600 w-12 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600"
              title="Zoom avant"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500 border-l"
              title="Réinitialiser le zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-sm"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* ── Stats pills ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Membres du personnel", count: totalStaff, color: "bg-slate-100 text-slate-700" },
          { label: "Enseignants", count: (usersByRole["enseignant"] || []).length, color: "bg-green-100 text-green-700" },
          { label: "Élèves", count: (usersByRole["eleve"] || []).length, color: "bg-pink-100 text-pink-700" },
          { label: "Parents", count: (usersByRole["parent"] || []).length, color: "bg-amber-100 text-amber-700" },
        ].map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm shadow-sm ${s.color}`}
          >
            <Users className="w-4 h-4" />
            <span className="font-bold">{s.count}</span>
            <span className="opacity-80">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Tree ── */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm overflow-auto p-6 print:border-0 print:shadow-none">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">Chargement des données…</p>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              transition: "transform 0.2s ease",
              minHeight: "400px",
            }}
          >
            {/* CSS tree */}
            <style>{`
              .org-tree { display: flex; justify-content: center; padding-bottom: 24px; }
              .org-ul { display: flex; justify-content: center; padding-top: 28px; position: relative; gap: 12px; }
              .org-ul::before {
                content: "";
                position: absolute;
                top: 0;
                left: 50%;
                border-left: 2px dashed #94a3b8;
                height: 28px;
                transform: translateX(-50%);
              }
              .org-li {
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                padding-top: 20px;
              }
              /* horizontal line above each sibling */
              .org-ul > .org-li::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                border-top: 2px solid #94a3b8;
              }
              /* vertical drop from horizontal line to node */
              .org-li::after {
                content: "";
                position: absolute;
                top: 0;
                left: 50%;
                border-left: 2px solid #94a3b8;
                height: 20px;
                transform: translateX(-50%);
              }
              /* clean up first/last child horizontal lines */
              .org-ul > .org-li:first-child::before { left: 50%; }
              .org-ul > .org-li:last-child::before  { right: 50%; }
              .org-ul > .org-li:only-child::before  { display: none; }

              .org-node-wrapper {
                position: relative;
                padding-bottom: 16px;
              }
              .org-card {
                position: relative;
                border: 2px solid transparent;
                border-radius: 16px;
                padding: 14px 16px 12px;
                width: 200px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08);
                transition: transform 0.15s, box-shadow 0.15s;
                cursor: default;
                user-select: none;
              }
              .org-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10);
              }

              /* Root node (no top connector) */
              .org-tree > .org-li::after,
              .org-tree > .org-li::before { display: none; }
              .org-tree > .org-li { padding-top: 0; }

              @media print {
                .org-card { box-shadow: none !important; }
              }
            `}</style>

            <ul className="org-tree">
              {HIERARCHY.map((node) => (
                <OrgNode
                  key={node.role}
                  node={node}
                  usersByRole={usersByRole}
                  depth={0}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Élèves & Parents section ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {LEAF_ROLES.map((role) => {
          const cfg = ROLES[role];
          const style = ROLE_STYLES[role];
          const people = usersByRole[role] || [];
          return (
            <div
              key={role}
              className="rounded-2xl border-2 p-5 shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${style.from}18, ${style.to}28)`,
                borderColor: style.border,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{cfg?.icon}</span>
                <div>
                  <p className="font-bold text-base text-slate-800">{cfg?.label}</p>
                  <p className="text-xs text-slate-500">{cfg?.description}</p>
                </div>
                <Badge
                  className="ml-auto text-sm font-bold px-3 py-1"
                  style={{
                    background: style.border,
                    color: "#fff",
                    border: "none",
                  }}
                >
                  {people.length}
                </Badge>
              </div>
              {people.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun membre enregistré</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {people.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="text-xs truncate px-2 py-1 rounded-lg"
                      style={{
                        background: `${style.border}22`,
                        color: "#1e293b",
                      }}
                    >
                      {p.full_name || p.email || "—"}
                    </div>
                  ))}
                  {people.length > 8 && (
                    <div
                      className="text-xs px-2 py-1 rounded-lg font-medium col-span-2 text-center"
                      style={{ background: `${style.border}18`, color: "#475569" }}
                    >
                      +{people.length - 8} autres…
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Légende des rôles
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLES).map(([key, cfg]) => {
            const style = ROLE_STYLES[key];
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${style?.from || "#334155"}, ${style?.to || "#475569"})`,
                  color: style?.text || "#f8fafc",
                }}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
