import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, CheckCircle2, Upload, Trash2, Building2, Loader2, AlertCircle, FileText, Stamp, PenLine, AlignLeft } from "lucide-react";
import { EDUCATION_SYSTEMS, getEducationSystem, setEducationSystem } from "@/components/config/educationSystems";

function getAuthHeaders() {
  try {
    const session = JSON.parse(localStorage.getItem("edugest_session") || "null");
    const headers = { "Content-Type": "application/json" };
    if (session?.token) headers["X-Session-Token"] = session.token;
    if (session?.id)    headers["X-User-Id"]       = session.id;
    return headers;
  } catch {
    return { "Content-Type": "application/json" };
  }
}

/** Supprime l'arrière-plan d'un logo par flood fill BFS depuis les bords (tolérance couleur) */
function removeBackground(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const W = img.width, H = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;

      // Couleur de fond = moyenne des 4 coins
      const corner = (x, y) => { const i=(y*W+x)*4; return [data[i],data[i+1],data[i+2]]; };
      const cols = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]].map(([x,y])=>corner(x,y));
      const bgR = cols.reduce((s,c)=>s+c[0],0)/4;
      const bgG = cols.reduce((s,c)=>s+c[1],0)/4;
      const bgB = cols.reduce((s,c)=>s+c[2],0)/4;
      const TOL = 45 * 3;

      const isBg = (x,y) => {
        const i=(y*W+x)*4;
        return Math.abs(data[i]-bgR)+Math.abs(data[i+1]-bgG)+Math.abs(data[i+2]-bgB) < TOL;
      };

      // BFS depuis tous les pixels de bord
      const visited = new Uint8Array(W*H);
      const queue = [];
      for (let x=0;x<W;x++) { queue.push(x,0); queue.push(x,H-1); }
      for (let y=0;y<H;y++) { queue.push(0,y); queue.push(W-1,y); }

      let qi = 0;
      while (qi < queue.length) {
        const x = queue[qi++], y = queue[qi++];
        if (x<0||x>=W||y<0||y>=H) continue;
        const idx = y*W+x;
        if (visited[idx]) continue;
        if (!isBg(x,y)) continue;
        visited[idx] = 1;
        data[idx*4+3] = 0;
        queue.push(x+1,y, x-1,y, x,y+1, x,y-1);
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function SchoolBrandingSection() {
  const [schoolLogo,    setSchoolLogo]    = useState(null);
  const [schoolName,    setSchoolName]    = useState("");
  const [nameInput,     setNameInput]     = useState("");
  const [addressInput,  setAddressInput]  = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [saving,        setSaving]        = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [msg,           setMsg]           = useState({ type: "", text: "" });
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/functions/getSchoolSettings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.json())
      .then(d => {
        if (d.school_logo)    setSchoolLogo(d.school_logo);
        if (d.school_name)    { setSchoolName(d.school_name);       setNameInput(d.school_name); }
        if (d.school_address) { setSchoolAddress(d.school_address); setAddressInput(d.school_address); }
      })
      .catch(() => {});
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg({ type: "", text: "Suppression de l'arrière-plan…" });

    // Suppression de l'arrière-plan côté client
    const processed = await removeBackground(file);

    setMsg({ type: "", text: "" });
    const formData = new FormData();
    formData.append("file", processed);
    try {
      const headers = {};
      const session = JSON.parse(localStorage.getItem("edugest_session") || "null");
      if (session?.token) headers["X-Session-Token"] = session.token;
      if (session?.id)    headers["X-User-Id"]       = session.id;

      const res  = await fetch("/api/upload", { method: "POST", headers, body: formData });
      const data = await res.json();
      if (data.error) { setMsg({ type: "error", text: data.error }); setUploading(false); return; }

      // Save logo URL
      const save = await fetch("/api/functions/updateSchoolSettings", {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ school_logo: data.file_url }),
      });
      const saved = await save.json();
      if (saved.error) { setMsg({ type: "error", text: saved.error }); }
      else { setSchoolLogo(data.file_url); setMsg({ type: "success", text: "Logo mis à jour." }); }
    } catch (err) {
      setMsg({ type: "error", text: "Erreur lors du téléversement." });
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleRemoveLogo = async () => {
    setSaving(true); setMsg({ type: "", text: "" });
    const res  = await fetch("/api/functions/updateSchoolSettings", {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ school_logo: "" }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setMsg({ type: "error", text: data.error }); }
    else { setSchoolLogo(null); setMsg({ type: "success", text: "Logo supprimé." }); }
  };

  const handleSaveName = async () => {
    setSaving(true); setMsg({ type: "", text: "" });
    const res  = await fetch("/api/functions/updateSchoolSettings", {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ school_name: nameInput.trim(), school_address: addressInput.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setMsg({ type: "error", text: data.error }); }
    else {
      setSchoolName(nameInput.trim());
      setSchoolAddress(addressInput.trim());
      setMsg({ type: "success", text: "Informations de l'établissement enregistrées." });
    }
  };

  return (
    <Card className="mb-8 border-2 border-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Identité de l'établissement
        </CardTitle>
        <p className="text-sm text-slate-500">
          Le logo et le nom s'affichent sur la page de connexion.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Nom + Adresse */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Nom de l'établissement</label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Ex: Lycée Ibn Khaldoun"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Adresse / Ville</label>
            <input
              type="text"
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              placeholder="Ex: 12 Rue de la République, Alger"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-slate-50"
            />
          </div>
          <Button
            onClick={handleSaveName}
            disabled={saving || (nameInput.trim() === schoolName && addressInput.trim() === schoolAddress)}
            size="sm" className="h-10 px-4"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>

        {/* Logo */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Logo de l'école</label>
          <div className="flex items-start gap-5">
            {/* Aperçu */}
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {schoolLogo
                ? <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain p-2" onError={() => setSchoolLogo(null)} />
                : <Building2 className="w-10 h-10 text-slate-300" />
              }
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Téléversement…" : "Choisir un logo"}
              </Button>
              {schoolLogo && (
                <Button variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={saving} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </Button>
              )}
              <p className="text-[11px] text-slate-400">PNG, JPG ou SVG · max 50 Mo</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {msg.text && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
            msg.type === "error"
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-green-700 bg-green-50 border-green-200"
          }`}>
            {msg.type === "error"
              ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Documents Settings Section ────────────────────────────────────────────────
function DocumentsSettingsSection() {
  const [stamp,       setStamp]       = useState(null);
  const [signature,   setSignature]   = useState(null);
  const [footerText,  setFooterText]  = useState("");
  const [footerInput, setFooterInput] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [uploadingSig,   setUploadingSig]   = useState(false);
  const [msg,         setMsg]         = useState({ type: "", text: "" });
  const stampRef  = useRef(null);
  const sigRef    = useRef(null);

  useEffect(() => {
    fetch("/api/functions/getSchoolSettings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.json())
      .then(d => {
        if (d.school_stamp)         setStamp(d.school_stamp);
        if (d.director_signature)   setSignature(d.director_signature);
        if (d.doc_footer_text)      { setFooterText(d.doc_footer_text); setFooterInput(d.doc_footer_text); }
      })
      .catch(() => {});
  }, []);

  const uploadImage = async (file, field, setPreview, setUploading) => {
    setUploading(true);
    setMsg({ type: "", text: "Suppression de l'arrière-plan…" });
    const processed = await removeBackground(file);
    setMsg({ type: "", text: "" });

    const formData = new FormData();
    formData.append("file", processed);
    try {
      const headers = {};
      const session = JSON.parse(localStorage.getItem("edugest_session") || "null");
      if (session?.token) headers["X-Session-Token"] = session.token;
      if (session?.id)    headers["X-User-Id"]       = session.id;

      const res  = await fetch("/api/upload", { method: "POST", headers, body: formData });
      const data = await res.json();
      if (data.error) { setMsg({ type: "error", text: data.error }); setUploading(false); return; }

      const save = await fetch("/api/functions/updateSchoolSettings", {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: data.file_url }),
      });
      const saved = await save.json();
      if (saved.error) { setMsg({ type: "error", text: saved.error }); }
      else { setPreview(data.file_url); setMsg({ type: "success", text: "Image mise à jour." }); }
    } catch {
      setMsg({ type: "error", text: "Erreur lors du téléversement." });
    }
    setUploading(false);
  };

  const removeImage = async (field, setPreview) => {
    setSaving(true);
    const res  = await fetch("/api/functions/updateSchoolSettings", {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ [field]: "" }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setMsg({ type: "error", text: data.error }); }
    else { setPreview(null); setMsg({ type: "success", text: "Image supprimée." }); }
  };

  const saveFooter = async () => {
    setSaving(true);
    const res  = await fetch("/api/functions/updateSchoolSettings", {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ doc_footer_text: footerInput.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setMsg({ type: "error", text: data.error }); }
    else { setFooterText(footerInput.trim()); setMsg({ type: "success", text: "Pied de page enregistré." }); }
  };

  const ImageUploadRow = ({ label, icon: Icon, preview, setPreview, field, fileRef: ref, uploading, setUploading, tip }) => (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      <p className="text-xs text-slate-400 mb-2">{tip}</p>
      <div className="flex items-start gap-4">
        <div className="w-28 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {preview
            ? <img src={preview} alt={label} className="w-full h-full object-contain p-2" onError={() => setPreview(null)} />
            : <Icon className="w-8 h-8 text-slate-300" />}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <input ref={ref} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, field, setPreview, setUploading); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Téléversement…" : "Choisir une image"}
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" onClick={() => removeImage(field, setPreview)} disabled={saving}
              className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Supprimer
            </Button>
          )}
          <p className="text-[11px] text-slate-400">PNG, JPG · fond auto-retiré</p>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="mb-8 border-2 border-violet-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5 text-violet-600" />
          Paramètres des documents exportés
        </CardTitle>
        <p className="text-sm text-slate-500">
          Cachet, signature du directeur et pied de page apparaissent sur les attestations et relevés PDF.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">

        <ImageUploadRow
          label="Cachet de l'établissement"
          icon={Stamp}
          preview={stamp}
          setPreview={setStamp}
          field="school_stamp"
          fileRef={stampRef}
          uploading={uploadingStamp}
          setUploading={setUploadingStamp}
          tip="Image ronde du cachet officiel. L'arrière-plan sera automatiquement supprimé."
        />

        <div className="border-t border-slate-100" />

        <ImageUploadRow
          label="Signature du directeur"
          icon={PenLine}
          preview={signature}
          setPreview={setSignature}
          field="director_signature"
          fileRef={sigRef}
          uploading={uploadingSig}
          setUploading={setUploadingSig}
          tip="Signature manuscrite scannée. L'arrière-plan blanc sera automatiquement supprimé."
        />

        <div className="border-t border-slate-100" />

        {/* Footer text */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <AlignLeft className="w-3.5 h-3.5" /> Pied de page personnalisé
          </label>
          <p className="text-xs text-slate-400 mb-2">
            Ce texte apparaît en bas de chaque document PDF exporté (après la date de génération).
          </p>
          <div className="flex gap-2">
            <textarea
              value={footerInput}
              onChange={e => setFooterInput(e.target.value)}
              placeholder="Ex: Document délivré par la Direction — Tél : 023 XX XX XX — contact@etablissement.dz"
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-slate-50 resize-none"
            />
            <Button onClick={saveFooter} disabled={saving || footerInput.trim() === footerText} size="sm" className="h-10 px-4 self-start">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </div>

        {/* Message */}
        {msg.text && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
            msg.type === "error"
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-green-700 bg-green-50 border-green-200"
          }`}>
            {msg.type === "error"
              ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemConfigSection() {
  const [selected, setSelected] = useState(getEducationSystem());

  const handleSelect = (key) => {
    setSelected(key);
    setEducationSystem(key);
  };

  return (
    <>
    <SchoolBrandingSection />
    <DocumentsSettingsSection />
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
    </>
  );
}