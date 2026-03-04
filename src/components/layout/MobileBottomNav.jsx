import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import { ROLES } from "@/components/roles/roles";

const QUICK_NAV = [
  { name: "Accueil", href: "Dashboard", icon: LayoutDashboard },
  { name: "Élèves", href: "Students", icon: Users },
  { name: "Enseignants", href: "Teachers", icon: GraduationCap },
  { name: "Examens", href: "Exams", icon: ClipboardList },
  { name: "Messages", href: "Messages", icon: MessageSquare },
];

export default function MobileBottomNav({ currentRole, onMoreClick }) {
  const location = useLocation();
  const currentPath = location.pathname.split("/").pop() || "Dashboard";
  const roleConfig = currentRole ? ROLES[currentRole] : null;

  // Filter to only pages the role can access, max 4 items + More
  const allowedPages = roleConfig ? roleConfig.pages : [];
  const visibleNav = QUICK_NAV.filter(
    (item) => !roleConfig || allowedPages.includes(item.href)
  ).slice(0, 4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-slate-200 shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {visibleNav.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              to={createPageUrl(item.href)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium transition-colors active:scale-95",
                isActive
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="truncate max-w-[60px]">{item.name}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors active:scale-95"
        >
          <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
          <span>Plus</span>
        </button>
      </div>
    </nav>
  );
}