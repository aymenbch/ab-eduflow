import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload, FileText, CheckCircle2, XCircle, ArrowRight, ArrowLeft,
  Download, AlertCircle, Loader2, Users, BookOpen, School, UserCog,
  DollarSign, Home, GraduationCap, User, CreditCard, ClipboardList,
  SkipForward, RefreshCw, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Configuration des entités importables ─────────────────────────────────
const IMPORT_ENTITIES = {
  Student: {
    label: "Élèves", icon: GraduationCap, color: "from-pink-500 to-pink-700",
    fields: [
      { key: "first_name",      label: "Prénom",               required: true },
      { key: "last_name",       label: "Nom",                  required: true },
      { key: "date_of_birth",   label: "Date de naissance",    hint: "AAAA-MM-JJ" },
      { key: "gender",          label: "Genre",                hint: "M ou F" },
      { key: "class_id",        label: "Classe",               hint: "Nom ou ID" },
      { key: "enrollment_date", label: "Date inscription",     hint: "AAAA-MM-JJ" },
      { key: "address",         label: "Adresse" },
      { key: "parent_name",     label: "Nom parent" },
      { key: "parent_phone",    label: "Tél parent" },
      { key: "parent_email",    label: "Email parent" },
      { key: "medical_notes",   label: "Notes médicales" },
      { key: "status",          label: "Statut",               hint: "active / inactive" },
    ],
    example: ["Jean", "Dupont", "2010-05-15", "M", "6ème A", "2024-09-01", "", "Marie Dupont", "0612345678", "marie@ex.com", "", "active"],
  },
  Teacher: {
    label: "Enseignants", icon: BookOpen, color: "from-green-600 to-green-800",
    fields: [
      { key: "first_name",     label: "Prénom",          required: true },
      { key: "last_name",      label: "Nom",             required: true },
      { key: "email",          label: "Email" },
      { key: "phone",          label: "Téléphone" },
      { key: "hire_date",      label: "Date embauche",   hint: "AAAA-MM-JJ" },
      { key: "qualification",  label: "Qualification" },
      { key: "employee_code",  label: "Code employé" },
      { key: "contract_type",  label: "Type contrat",    hint: "CDI / CDD / vacataire" },
      { key: "salary",         label: "Salaire",         hint: "Nombre" },
      { key: "status",         label: "Statut",          hint: "active / inactive" },
      { key: "address",        label: "Adresse" },
    ],
    example: ["Farid", "Brahimi", "f.brahimi@ecole.dz", "0555123456", "2020-09-01", "Master Mathématiques", "ENS-042", "CDI", "45000", "active", ""],
  },
  Staff: {
    label: "Personnel", icon: UserCog, color: "from-slate-600 to-slate-800",
    fields: [
      { key: "first_name",     label: "Prénom",          required: true },
      { key: "last_name",      label: "Nom",             required: true },
      { key: "email",          label: "Email" },
      { key: "phone",          label: "Téléphone" },
      { key: "role",           label: "Fonction" },
      { key: "hire_date",      label: "Date embauche",   hint: "AAAA-MM-JJ" },
      { key: "employee_code",  label: "Code employé" },
      { key: "contract_type",  label: "Type contrat" },
      { key: "salary",         label: "Salaire",         hint: "Nombre" },
      { key: "status",         label: "Statut",          hint: "active / inactive" },
    ],
    example: ["Amina", "Kaddouri", "a.kaddouri@ecole.dz", "0666789012", "Surveillant", "2019-01-15", "STF-011", "CDD", "28000", "active"],
  },
  Class: {
    label: "Classes", icon: School, color: "from-blue-600 to-blue-800",
    fields: [
      { key: "name",        label: "Nom de la classe",  required: true },
      { key: "level",       label: "Niveau",            hint: "6ème, 5ème, CP…" },
      { key: "school_year", label: "Année scolaire" },
      { key: "room",        label: "Salle" },
      { key: "capacity",    label: "Capacité",          hint: "Nombre" },
    ],
    example: ["6ème A", "6ème", "2024-2025", "Salle 101", "30"],
  },
  Subject: {
    label: "Matières", icon: BookOpen, color: "from-indigo-600 to-indigo-800",
    fields: [
      { key: "name",         label: "Nom matière",     required: true },
      { key: "code",         label: "Code" },
      { key: "coefficient",  label: "Coefficient",     hint: "Nombre" },
      { key: "level",        label: "Niveau" },
      { key: "category",     label: "Catégorie",       hint: "general / scientifique" },
      { key: "weekly_hours", label: "Heures/semaine",  hint: "Nombre" },
      { key: "description",  label: "Description" },
    ],
    example: ["Mathématiques", "MATH", "4", "6ème", "scientifique", "4", "Algèbre et géométrie"],
  },
  Parent: {
    label: "Parents", icon: User, color: "from-amber-500 to-amber-700",
    fields: [
      { key: "first_name", label: "Prénom",    required: true },
      { key: "last_name",  label: "Nom",       required: true },
      { key: "email",      label: "Email" },
      { key: "phone",      label: "Téléphone" },
      { key: "address",    label: "Adresse" },
      { key: "relation",   label: "Relation",  hint: "père / mère / tuteur" },
    ],
    example: ["Karim", "Mansouri", "k.mansouri@gmail.com", "0661234567", "12 rue des Oliviers", "père"],
  },
  Room: {
    label: "Salles", icon: Home, color: "from-teal-600 to-teal-800",
    fields: [
      { key: "name",        label: "Nom de la salle", required: true },
      { key: "code",        label: "Code" },
      { key: "type",        label: "Type",            hint: "classroom / lab / amphitheater" },
      { key: "capacity",    label: "Capacité",        hint: "Nombre" },
      { key: "building",    label: "Bâtiment" },
      { key: "floor",       label: "Étage" },
      { key: "description", label: "Description" },
    ],
    example: ["Salle 101", "S101", "classroom", "30", "Bloc A", "1", ""],
  },
  Payment: {
    label: "Paiements", icon: CreditCard, color: "from-emerald-600 to-emerald-800",
    fields: [
      { key: "student_id",      label: "Élève",          required: true, hint: "Nom ou ID" },
      { key: "label",           label: "Libellé",        required: true },
      { key: "amount",          label: "Montant total",  required: true, hint: "Nombre" },
      { key: "amount_paid",     label: "Montant payé",   hint: "Nombre" },
      { key: "due_date",        label: "Échéance",       hint: "AAAA-MM-JJ" },
      { key: "category",        label: "Catégorie",      hint: "scolarité / cantine / transport" },
      { key: "status",          label: "Statut",         hint: "pending / partial / paid" },
      { key: "payment_method",  label: "Moyen paiement", hint: "espèces / virement / chèque" },
      { key: "school_year",     label: "Année scolaire" },
    ],
    example: ["Jean Dupont", "Scolarité T1", "15000", "15000", "2024-10-01", "scolarité", "paid", "virement", "2024-2025"],
  },
  Exam: {
    label: "Examens", icon: ClipboardList, color: "from-violet-600 to-violet-800",
    fields: [
      { key: "title",      label: "Intitulé",     required: true },
      { key: "class_id",   label: "Classe",       hint: "Nom ou ID" },
      { key: "subject_id", label: "Matière",      hint: "Nom ou ID" },
      { key: "date",       label: "Date",         hint: "AAAA-MM-JJ" },
      { key: "type",       label: "Type",         hint: "devoir / interrogation / examen" },
      { key: "coefficient", label: "Coefficient", hint: "Nombre" },
      { key: "max_score",  label: "Note max",     hint: "Nombre" },
      { key: "trimester",  label: "Trimestre",    hint: "T1 / T2 / T3" },
    ],
    example: ["Devoir 1 - Maths", "6ème A", "Mathématiques", "2024-10-15", "devoir", "2", "20", "T1"],
  },
};

// ── Parser CSV léger (gère virgule/point-virgule, guillemets, UTF-8 BOM) ──
function parseCSV(text) {
  if (!text) return { headers: [], rows: [] };
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Auto-detect delimiter
  const candidates = [',', ';', '\t'];
  let delimiter = ',';
  let maxCount = 0;
  for (const d of candidates) {
    const re = new RegExp(`\\${d === '\t' ? 't' : d}`, 'g');
    const count = (lines[0].match(re) || []).length;
    if (count > maxCount) { maxCount = count; delimiter = d; }
  }

  const parseLine = (line) => {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; }
      else if (ch === '"' && inQ) {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else if (ch === delimiter && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else { cur += ch; }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] ?? ''; return obj; }, {});
  });
  return { headers, rows };
}

// ── Auto-mapping CSV header → champ entité ────────────────────────────────
const SYNONYMS = {
  first_name: ['prénom', 'prenom', 'firstname', 'first name', 'givenname'],
  last_name: ['nom', 'name', 'lastname', 'last name', 'family name', 'nom de famille', 'surname'],
  email: ['e-mail', 'courriel', 'mail', 'adresse email'],
  phone: ['téléphone', 'telephone', 'tel', 'mobile', 'gsm', 'tél'],
  date_of_birth: ['date naissance', 'naissance', 'ddn', 'birthday', 'né le', 'née le', 'date of birth'],
  gender: ['sexe', 'sex', 'genre'],
  class_id: ['classe', 'class', 'classe id', 'class id'],
  subject_id: ['matière', 'matiere', 'subject', 'matiere id'],
  student_id: ['élève', 'eleve', 'student', 'étudiant'],
  teacher_id: ['enseignant', 'professeur', 'teacher'],
  level: ['niveau', 'level'],
  school_year: ['année scolaire', 'annee scolaire', 'year'],
  address: ['adresse', 'address'],
  hire_date: ['date embauche', 'embauche', 'hire date'],
  qualification: ['qualification', 'diplôme', 'diplome'],
  employee_code: ['code employé', 'code employe', 'matricule', 'employee code'],
  contract_type: ['type contrat', 'contrat', 'contract'],
  salary: ['salaire', 'salary', 'rémunération'],
  coefficient: ['coefficient', 'coeff'],
  weekly_hours: ['heures semaine', 'h/semaine', 'heures/semaine', 'weekly hours'],
  capacity: ['capacité', 'capacite', 'capacity'],
  building: ['bâtiment', 'batiment', 'building'],
  floor: ['étage', 'etage', 'floor'],
  amount: ['montant', 'amount', 'total', 'montant total'],
  amount_paid: ['montant payé', 'montant paye', 'payé', 'paid', 'versé'],
  due_date: ['échéance', 'echeance', 'date limite', 'due date'],
  category: ['catégorie', 'categorie', 'category'],
  status: ['statut', 'status', 'état', 'etat', 'situation'],
  label: ['libellé', 'libelle', 'description', 'objet'],
  payment_method: ['moyen paiement', 'mode paiement', 'payment method'],
  parent_name: ['nom parent', 'parent', 'tuteur', 'responsable'],
  parent_phone: ['tél parent', 'tel parent', 'téléphone parent'],
  parent_email: ['email parent', 'mail parent', 'courriel parent'],
  medical_notes: ['notes médicales', 'medical', 'santé', 'allergie'],
  enrollment_date: ['date inscription', 'inscription', 'enrollment date'],
  code: ['code'],
  name: ['nom', 'name', 'intitulé', 'intitule', 'libellé'],
  relation: ['relation', 'lien', 'parenté'],
  title: ['titre', 'title', 'intitulé', 'libellé'],
  type: ['type'],
  date: ['date'],
  trimester: ['trimestre', 'trimester', 'période'],
  role: ['fonction', 'poste', 'role'],
};

function autoDetectMapping(csvHeaders, fields) {
  const result = {};
  for (const header of csvHeaders) {
    const h = header.toLowerCase().trim();
    for (const field of fields) {
      if (result[header]) break;
      if (h === field.key.toLowerCase()) { result[header] = field.key; break; }
      if (h === field.label.toLowerCase()) { result[header] = field.key; break; }
      const syns = SYNONYMS[field.key] || [];
      if (syns.some(s => h === s || h.includes(s))) { result[header] = field.key; break; }
    }
  }
  return result;
}

// ── Génération du modèle CSV à télécharger ────────────────────────────────
function downloadTemplate(entityKey) {
  const entity = IMPORT_ENTITIES[entityKey];
  const headers = entity.fields.map(f => f.label);
  const example = entity.example || entity.fields.map(() => '');
  const csv = [headers.join(';'), example.join(';')].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modele_import_${entityKey.toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Télécharger le rapport d'erreurs ──────────────────────────────────────
function downloadErrorReport(errors) {
  const lines = ['Ligne;Message', ...errors.map(e => `${e.row};${e.message}`)];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `erreurs_import.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────
export default function Import() {
  const [step, setStep] = useState(1);
  const [entityKey, setEntityKey] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);    // { name, rowCount }
  const [parsedData, setParsedData] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({});          // csvHeader → fieldKey
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const entity = entityKey ? IMPORT_ENTITIES[entityKey] : null;

  // ── Étape 1 → 2 ─────────────────────────────────────────────────────────
  const handleSelectEntity = (key) => {
    setEntityKey(key);
    setParsedData(null);
    setFileInfo(null);
    setMapping({});
    setResults(null);
    setStep(2);
  };

  // ── Parsing du fichier ───────────────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        alert("Fichier vide ou format non reconnu.");
        return;
      }
      setParsedData(parsed);
      setFileInfo({ name: file.name, rowCount: parsed.rows.length });
      const autoMap = autoDetectMapping(parsed.headers, entity.fields);
      setMapping(autoMap);
      setStep(3);
    };
    reader.readAsText(file, 'UTF-8');
  }, [entity]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Importer ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsedData || !entityKey) return;
    setImporting(true);

    // Appliquer le mapping : transformer chaque ligne CSV en objet avec les clés champ
    const rows = parsedData.rows.map(csvRow => {
      const mapped = {};
      for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
        if (fieldKey && csvRow[csvHeader] !== undefined) {
          mapped[fieldKey] = csvRow[csvHeader];
        }
      }
      return mapped;
    });

    try {
      const res = await fetch(`/api/import/${entityKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, options: { skipDuplicates } }),
      });
      const data = await res.json();
      setResults(data);
      setStep(5);
    } catch (err) {
      alert(`Erreur lors de l'import: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // ── Calcul des colonnes requises non-mappées ──────────────────────────────
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = entity?.fields.filter(f => f.required && !mappedFields.has(f.key)) || [];

  // ── Aperçu (5 premières lignes mappées) ──────────────────────────────────
  const previewRows = parsedData?.rows.slice(0, 5).map(csvRow => {
    const out = {};
    for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
      if (fieldKey) out[fieldKey] = csvRow[csvHeader] ?? '';
    }
    return out;
  }) || [];
  const previewFields = entity?.fields.filter(f => mappedFields.has(f.key)) || [];

  // ── STEPS INDICATOR ────────────────────────────────────────────────────
  const STEPS = ["Module", "Fichier", "Colonnes", "Import", "Résultats"];

  const reset = () => {
    setStep(1); setEntityKey(null); setParsedData(null);
    setFileInfo(null); setMapping({}); setResults(null);
  };

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold main-text-hi">Import de données</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Migrez vos données depuis n'importe quel outil vers EduGest via CSV
          </p>
        </div>
        {step > 1 && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" /> Recommencer
          </Button>
        )}
      </div>

      {/* Barre de progression */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              step === i + 1 ? "bg-blue-100 text-blue-700" :
              step > i + 1 ? "text-green-600" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                step > i + 1 ? "bg-green-500 text-white" :
                step === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
              )}>
                {step > i + 1 ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </div>
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={cn("w-4 h-4 mx-1 flex-shrink-0",
                step > i + 1 ? "text-green-500" : "text-gray-300")} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── ÉTAPE 1 : Choix du module ─────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Sélectionnez le type de données à importer :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Object.entries(IMPORT_ENTITIES).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectEntity(key)}
                  className="group p-4 rounded-xl border-2 border-transparent hover:border-blue-200 bg-white shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-sm main-text-hi">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.fields.length} champs</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ÉTAPE 2 : Upload fichier ──────────────────────────────────────── */}
      {step === 2 && entity && (
        <div className="max-w-xl space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${entity.color} flex items-center justify-center`}>
                  <entity.icon className="w-4 h-4 text-white" />
                </div>
                Importer : {entity.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Zone drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                )}
              >
                <Upload className={cn("w-10 h-10 mx-auto mb-3", dragOver ? "text-blue-500" : "text-gray-400")} />
                <p className="font-medium text-sm">Glissez votre fichier CSV ici</p>
                <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
                <p className="text-xs text-muted-foreground mt-2">Formats acceptés : .csv — Séparateurs : , ou ;</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {/* Bouton modèle */}
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <FileText className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">Besoin d'un modèle ?</p>
                  <p className="text-xs text-amber-600">Téléchargez le CSV exemple pré-rempli</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                  onClick={() => downloadTemplate(entityKey)}
                >
                  <Download className="w-4 h-4 mr-1" /> Modèle
                </Button>
              </div>

              {/* Champs attendus */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Champs disponibles :</p>
                <div className="flex flex-wrap gap-1.5">
                  {entity.fields.map(f => (
                    <Badge key={f.key} variant={f.required ? "default" : "secondary"} className="text-xs">
                      {f.label}{f.required ? " *" : ""}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">* = obligatoire</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : Mapping des colonnes ───────────────────────────────── */}
      {step === 3 && entity && parsedData && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800">{fileInfo?.name}</span>
            </div>
            <Badge variant="secondary">{fileInfo?.rowCount} lignes</Badge>
            <Badge variant="secondary">{parsedData.headers.length} colonnes</Badge>
          </div>

          {missingRequired.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Champs obligatoires non mappés :{" "}
                <strong>{missingRequired.map(f => f.label).join(', ')}</strong>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Correspondance des colonnes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Associez chaque colonne de votre fichier au champ correspondant dans EduGest.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-1/3">
                        Colonne CSV
                      </th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        Champ EduGest
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground w-20">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.headers.map((header) => {
                      const mapped = mapping[header];
                      const field = entity.fields.find(f => f.key === mapped);
                      return (
                        <tr key={header} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{header}</code>
                          </td>
                          <td className="py-2 pr-4">
                            <Select
                              value={mapping[header] || '__skip__'}
                              onValueChange={(v) => setMapping(prev => ({
                                ...prev,
                                [header]: v === '__skip__' ? undefined : v,
                              }))}
                            >
                              <SelectTrigger className="h-8 text-xs w-56">
                                <SelectValue placeholder="Ignorer…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">
                                  <span className="text-muted-foreground">— Ignorer —</span>
                                </SelectItem>
                                {entity.fields.map(f => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label}{f.required ? " *" : ""}
                                    {f.hint ? ` (${f.hint})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2">
                            {mapped ? (
                              field?.required ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">✓ Requis</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">✓ Mappé</Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Ignoré</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={missingRequired.length > 0}
            >
              Aperçu & Import <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : Aperçu + Import ─────────────────────────────────────── */}
      {step === 4 && entity && (
        <div className="space-y-4">
          {/* Récapitulatif */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Module", value: entity.label, color: "blue" },
              { label: "Fichier", value: fileInfo?.name, color: "gray", small: true },
              { label: "Lignes à importer", value: parsedData?.rows.length, color: "green" },
              { label: "Colonnes mappées", value: mappedFields.size, color: "indigo" },
            ].map(({ label, value, color, small }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("font-bold mt-0.5", small ? "text-sm truncate" : "text-xl", `text-${color}-600`)}>
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Option doublons */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
            <input
              type="checkbox"
              id="skipDuplicates"
              checked={skipDuplicates}
              onChange={e => setSkipDuplicates(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="skipDuplicates" className="text-sm cursor-pointer">
              <span className="font-medium">Ignorer les doublons</span>
              <span className="text-muted-foreground ml-2">
                (détection par nom pour les élèves/enseignants, par email pour les parents)
              </span>
            </label>
          </div>

          {/* Aperçu des données */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Aperçu ({Math.min(5, parsedData?.rows.length || 0)} premières lignes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {previewFields.map(f => (
                        <th key={f.key} className="text-left py-2 pr-3 font-medium text-muted-foreground whitespace-nowrap">
                          {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        {previewFields.map(f => (
                          <td key={f.key} className="py-2 pr-3">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded",
                              f.required && !row[f.key] ? "bg-red-100 text-red-700" : ""
                            )}>
                              {row[f.key] || (f.required ? "⚠ manquant" : "—")}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData?.rows.length > 5 && (
                <p className="text-xs text-muted-foreground mt-3">
                  … et {parsedData.rows.length - 5} lignes supplémentaires
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} disabled={importing}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Lancer l'import ({parsedData?.rows.length} lignes)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 5 : Résultats ───────────────────────────────────────────── */}
      {step === 5 && results && (
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200">
              <CardContent className="pt-5 pb-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-600">{results.created}</p>
                <p className="text-sm text-muted-foreground mt-1">Créés</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-5 pb-4 text-center">
                <SkipForward className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-amber-600">{results.skipped}</p>
                <p className="text-sm text-muted-foreground mt-1">Ignorés (doublons)</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-5 pb-4 text-center">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-red-600">{results.errors?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Erreurs</p>
              </CardContent>
            </Card>
          </div>

          {/* Détail des erreurs */}
          {results.errors?.length > 0 && (
            <Card className="border-red-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-red-700">
                    Détail des erreurs ({results.errors.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => downloadErrorReport(results.errors)}
                  >
                    <Download className="w-4 h-4 mr-1" /> Télécharger
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {results.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded text-xs">
                      <Badge variant="destructive" className="text-xs shrink-0">Ligne {err.row}</Badge>
                      <span className="text-red-700">{err.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {results.created > 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>{results.created} {entity?.label.toLowerCase()}</strong> ont été créés avec succès dans EduGest.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button onClick={reset}>
              <Upload className="w-4 h-4 mr-2" /> Nouvel import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
