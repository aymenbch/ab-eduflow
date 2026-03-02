import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, FileWarning } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FinanceWidget() {
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => base44.entities.Payment.list(),
  });
  const { data: litigations = [] } = useQuery({
    queryKey: ["litigations"],
    queryFn: () => base44.entities.Litigation.list(),
  });

  const totalDue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);
  const openLitigations = litigations.filter(l => l.status === "ouvert" || l.status === "en_traitement");
  const totalLitigationAmount = openLitigations.reduce((sum, l) => sum + (l.amount || 0), 0);
  const collectionRate = totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) : 0;

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-500" />
            Indicateurs Financiers
          </div>
          <Link to={createPageUrl("Finance")} className="text-xs text-blue-500 hover:underline font-normal">
            Voir tout →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <p className="text-xs text-green-600 font-medium">Encaissé</p>
            <p className="text-lg font-bold text-green-700">{totalCollected.toLocaleString("fr-FR")} €</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-600 font-medium">Attendu</p>
            <p className="text-lg font-bold text-blue-700">{totalDue.toLocaleString("fr-FR")} €</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-xl">
            <p className="text-xs text-orange-600 font-medium">Créances</p>
            <p className="text-lg font-bold text-orange-700">{totalOverdue.toLocaleString("fr-FR")} €</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl">
            <p className="text-xs text-red-600 font-medium">Contentieux</p>
            <p className="text-lg font-bold text-red-700">{openLitigations.length} dossier{openLitigations.length !== 1 ? "s" : ""}</p>
            <p className="text-xs text-red-400">{totalLitigationAmount.toLocaleString("fr-FR")} €</p>
          </div>
        </div>

        {/* Collection rate bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Taux de recouvrement</span>
            <span className="font-bold text-green-600">{collectionRate}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>

        {openLitigations.length > 0 && (
          <div className="mt-3 p-2 bg-red-50 rounded-lg flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">
              <span className="font-bold">{openLitigations.length} contentieux</span> ouverts — {totalLitigationAmount.toLocaleString("fr-FR")} € en jeu
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}