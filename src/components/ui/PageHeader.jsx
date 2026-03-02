import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PageHeader({ 
  title, 
  description, 
  action, 
  actionLabel = "Ajouter",
  actionIcon: ActionIcon = Plus 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button 
          onClick={action}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30"
        >
          <ActionIcon className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}