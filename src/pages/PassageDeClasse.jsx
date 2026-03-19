import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui/PageHeader";
import PromotionManager from "@/components/schoolyear/PromotionManager";
import { GraduationCap } from "lucide-react";

export default function PassageDeClasse() {
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => base44.entities.SchoolYear.list("-start_date"),
  });

  return (
    <div>
      <PageHeader
        title="Passage de classe"
        description="Calcul des moyennes, décisions de promotion et historique des passages"
      />
      <PromotionManager schoolYears={schoolYears} />
    </div>
  );
}
