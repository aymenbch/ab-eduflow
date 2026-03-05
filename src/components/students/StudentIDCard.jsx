import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, Download, Loader2, School } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import html2canvas from "html2canvas";

export default function StudentIDCard({ student, studentClass }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cardRef = useRef(null);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Student.update(student.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["student", student.id]);
      toast.success("Photo mise à jour !");
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateMutation.mutateAsync({ photo_url: file_url });
    } catch (err) {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.download = `carte_${student.first_name}_${student.last_name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Carte téléchargée !");
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const genderLabel = student.gender === "M" ? "Masculin" : student.gender === "F" ? "Féminin" : "-";
  const schoolYear = studentClass?.school_year || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

  return (
    <div className="space-y-4">
      {/* Carte */}
      <div
        ref={cardRef}
        className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-xl"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)",
          aspectRatio: "1.6",
          minHeight: "210px"
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white transform translate-x-10 -translate-y-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white transform -translate-x-8 translate-y-8" />
        </div>

        <div className="relative flex h-full p-5 gap-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/60 bg-white/20 flex items-center justify-center flex-shrink-0">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt="Photo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-2xl font-bold">
                  {student.first_name?.[0]}{student.last_name?.[0]}
                </span>
              )}
            </div>
            {/* School logo placeholder */}
            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
              <School className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Infos */}
          <div className="flex-1 flex flex-col justify-between text-white min-w-0">
            <div>
              <div className="bg-white/20 rounded-lg px-2 py-1 mb-2 inline-block">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-100">
                  Carte Étudiant
                </p>
              </div>
              <h3 className="text-lg font-bold leading-tight truncate">
                {student.first_name} {student.last_name}
              </h3>
              {student.student_code && (
                <p className="text-blue-200 text-xs font-mono">{student.student_code}</p>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-blue-100">
              {studentClass && (
                <div className="flex items-center gap-1">
                  <span className="text-white/60">Classe:</span>
                  <span className="font-semibold text-white">{studentClass.name} — {studentClass.level}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-white/60">Année:</span>
                <span className="font-semibold text-white">{schoolYear}</span>
              </div>
              {student.date_of_birth && (
                <div className="flex items-center gap-1">
                  <span className="text-white/60">Né(e) le:</span>
                  <span className="font-semibold text-white">
                    {format(new Date(student.date_of_birth), "dd/MM/yyyy")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-white/60">Genre:</span>
                <span className="font-semibold text-white">{genderLabel}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                style={{
                  background: student.status === "active" ? "#22c55e" : "#64748b",
                  color: "white"
                }}
              >
                {student.status === "active" ? "Actif" : student.status}
              </div>
              <p className="text-[9px] text-blue-200">EduGest</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {uploading ? "Upload..." : "Changer la photo"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Télécharger
        </Button>
      </div>
    </div>
  );
}