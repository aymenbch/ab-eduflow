import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, CheckCircle2 } from "lucide-react";
import { EDUCATION_SYSTEMS, getEducationSystem, setEducationSystem } from "@/components/config/educationSystems";

export default function SystemConfigSection() {
  const [selected, setSelected] = useState(getEducationSystem());

  const handleSelect = (key) => {
    setSelected(key);
    setEducationSystem(key);
  };

  return (
    <Card className="mb-8 border-2 border-blue-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="w-5 h-5 text-blue-600" />
          Configuration du système éducatif
        </CardTitle>
        <p className="text-sm text-slate-500">
          Choisissez le système éducatif de votre établissement. Ce choix définit la nomenclature des niveaux scolaires.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(EDUCATION_SYSTEMS).map(([key, system]) => {
            const isSelected = selected === key;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-blue-500" />
                )}
                <div className="text-3xl mb-2">{system.flag}</div>
                <h3 className={`font-bold text-sm mb-1 ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                  {system.label}
                </h3>
                <p className="text-xs text-slate-500 mb-3">{system.description}</p>
                <div className="space-y-2">
                  {system.cycles.map((cycle) => (
                    <div key={cycle.name}>
                      <p className="text-xs font-semibold text-slate-600 mb-1">{cycle.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {cycle.levels.map((level) => (
                          <Badge
                            key={level}
                            variant="secondary"
                            className={`text-xs px-1.5 py-0 ${isSelected ? "bg-blue-100 text-blue-700" : ""}`}
                          >
                            {level}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          ⚠️ Changer le système éducatif n'affecte pas les classes déjà créées, uniquement les nouvelles.
        </p>
      </CardContent>
    </Card>
  );
}