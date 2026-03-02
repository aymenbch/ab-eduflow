import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ROLES } from "@/components/roles/roles";

export default function RoleSelect() {
  const handleRoleSelect = (roleKey) => {
    localStorage.setItem("edugest_role", roleKey);
    window.location.href = createPageUrl("Dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6">
          <span className="text-4xl">🏫</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">EduGest</h1>
        <p className="text-xl text-slate-500">Choisissez votre profil pour accéder à votre espace</p>
      </div>

      {/* Role Grid */}
      <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(ROLES).map(([key, role]) => (
          <button
            key={key}
            onClick={() => handleRoleSelect(key)}
            className="group relative flex flex-col items-center p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-transparent hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center text-2xl shadow-lg mb-3 group-hover:scale-110 transition-transform duration-300`}>
              {role.icon}
            </div>
            <h3 className="font-bold text-slate-800 text-sm text-center leading-tight mb-1">
              {role.label}
            </h3>
            <p className="text-xs text-slate-400 text-center line-clamp-2">
              {role.description}
            </p>

            {/* Hover overlay */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
          </button>
        ))}
      </div>

      <p className="mt-10 text-sm text-slate-400">
        Mode démonstration — Cliquez sur un profil pour explorer son espace
      </p>
    </div>
  );
}