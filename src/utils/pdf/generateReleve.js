/**
 * generateReleve — Relevé de notes PDF
 * Supports: logo, QR code, configurable footer.
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { fr }     from "date-fns/locale";
import { loadBrandingAssets, makeQRDataUrl, drawHeader, drawFooter } from "./pdfBranding";

const C = {
  primary: [67, 56, 202],
  text:    [30, 30, 30],
  muted:   [107, 114, 128],
  border:  [226, 232, 240],
  bg:      [248, 250, 252],
  good:    [5, 150, 105],
  bad:     [220, 38, 38],
  rowalt:  [239, 246, 255],
};

function scoreColor(s) { return s >= 10 ? C.good : C.bad; }

function getMention(avg) {
  if (avg >= 16) return "Très bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez bien";
  if (avg >= 10) return "Passable";
  return "Insuffisant";
}

/**
 * @param {object} opts
 * @param {object}   opts.student
 * @param {object}   [opts.cls]
 * @param {Array}    [opts.exams]
 * @param {Array}    [opts.grades]
 * @param {Array}    [opts.subjects]
 * @param {string}   [opts.schoolYear]
 * @param {string}   [opts.period]
 * @param {string}   [opts.schoolName]    - Legacy
 * @param {object}   [opts.settings]      - School settings from getSchoolSettings
 */
export async function generateReleve({
  student,
  cls,
  exams    = [],
  grades   = [],
  subjects = [],
  schoolYear,
  period,
  schoolName = "Établissement",
  settings   = {},
}) {
  const S = {
    school_name:    settings.school_name    || schoolName,
    school_address: settings.school_address || "",
    school_logo:           settings.school_logo,
    doc_footer_text:       settings.doc_footer_text,
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();
  let y     = 0;

  // ── Load images + QR in parallel ─────────────────────────────────────────
  const qrText = [
    `DOCUMENT: Relevé de Notes`,
    `ÉTABLISSEMENT: ${S.school_name}`,
    `ÉLÈVE: ${student.first_name} ${student.last_name}`,
    `N° ÉLÈVE: ${student.student_code || "—"}`,
    `CLASSE: ${cls?.name || "—"}`,
    `ANNÉE SCOLAIRE: ${schoolYear || "—"}`,
    period ? `PÉRIODE: ${period}` : null,
    `DATE: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
  ].filter(Boolean).join("\n");

  const [{ logoDataUrl }, qrDataUrl] = await Promise.all([
    loadBrandingAssets(S),
    makeQRDataUrl(qrText),
  ]);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerSubtitle = period
    ? `Généré le ${format(new Date(), "d MMM yyyy", { locale: fr })} · Période : ${period}`
    : `Généré le ${format(new Date(), "d MMMM yyyy", { locale: fr })}`;

  y = drawHeader(doc, {
    title:      "RELEVÉ DE NOTES",
    subtitle:   headerSubtitle,
    color:      C.primary,
    settings:   S,
    logoDataUrl,
  });

  // ── Student info band ─────────────────────────────────────────────────────
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(14, y, W - 28, 22, 2, 2, "FD");

  doc.setTextColor(...C.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ÉLÈVE",          20,        y + 6);
  doc.text("CLASSE",         W * 0.45,  y + 6);
  doc.text("ANNÉE SCOLAIRE", W * 0.72,  y + 6);

  doc.setTextColor(...C.text);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${student.first_name} ${student.last_name}`, 20, y + 14);
  doc.setFontSize(10);
  doc.text(cls?.name || "—",  W * 0.45, y + 14);
  doc.text(schoolYear || "—", W * 0.72, y + 14);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  if (student.student_code) doc.text(`N° ${student.student_code}`, 20, y + 19);
  y += 32;

  // ── Build data structures ─────────────────────────────────────────────────
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const gradeMap   = Object.fromEntries(grades.map(g => [g.exam_id, g]));
  const bySubject  = {};
  exams.forEach(exam => {
    const sid = exam.subject_id || "__unknown";
    if (!bySubject[sid]) bySubject[sid] = [];
    bySubject[sid].push(exam);
  });

  // ── Table header ──────────────────────────────────────────────────────────
  doc.setFillColor(...C.primary);
  doc.rect(14, y, W - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Matière / Évaluation", 18, y + 5.5);
  doc.text("Coeff",    W - 65, y + 5.5, { align: "right" });
  doc.text("Note /20", W - 40, y + 5.5, { align: "right" });
  doc.text("Mention",  W - 14, y + 5.5, { align: "right" });
  y += 8;

  let rowIdx       = 0;
  let totalWeighted = 0;
  let totalCoeff   = 0;

  Object.entries(bySubject).forEach(([subjectId, subjectExams]) => {
    const subject     = subjectMap[subjectId];
    const subjectName = subject?.name || "Matière inconnue";

    // Subject title row
    const subBg = rowIdx % 2 === 0 ? [255, 255, 255] : C.bg;
    doc.setFillColor(...subBg);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setTextColor(...C.text);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(subjectName, 18, y + 5.5);
    y += 8;
    rowIdx++;

    const subjectScores = [];
    let   subjectCoeff  = 0;

    subjectExams.forEach(exam => {
      const grade = gradeMap[exam.id];
      const coeff = Number(exam.coefficient || 1);
      const max   = Number(exam.max_score || 20);
      const raw   = grade?.score;
      const on20  = raw != null ? (Number(raw) / max * 20) : null;

      const rowBg = rowIdx % 2 === 0 ? [255, 255, 255] : C.bg;
      doc.setFillColor(...rowBg);
      doc.rect(14, y, W - 28, 7, "F");
      doc.setTextColor(...C.muted);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`   → ${exam.title || "Évaluation"}`, 18, y + 4.5);
      doc.text(String(coeff), W - 65, y + 4.5, { align: "right" });

      if (on20 !== null) {
        doc.setTextColor(...scoreColor(on20));
        doc.setFont("helvetica", "bold");
        doc.text(`${on20.toFixed(2)}/20`, W - 40, y + 4.5, { align: "right" });
        subjectScores.push({ score: on20, coeff });
        subjectCoeff  += coeff;
        totalWeighted += on20 * coeff;
        totalCoeff    += coeff;
      } else if (grade?.absent) {
        doc.setTextColor(...C.bad);
        doc.setFont("helvetica", "bold");
        doc.text("ABS", W - 40, y + 4.5, { align: "right" });
      } else {
        doc.setTextColor(...C.muted);
        doc.text("—", W - 40, y + 4.5, { align: "right" });
      }
      y += 7;
      rowIdx++;
    });

    // Subject average row
    if (subjectScores.length > 0) {
      const avg = subjectScores.reduce((s, r) => s + r.score * r.coeff, 0) / subjectCoeff;
      doc.setFillColor(...C.rowalt);
      doc.rect(14, y, W - 28, 7, "F");
      doc.setTextColor(...C.primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`Moyenne ${subjectName}`, 18, y + 4.5);
      doc.text(`${avg.toFixed(2)}/20`, W - 40, y + 4.5, { align: "right" });
      doc.setTextColor(...C.muted);
      doc.setFont("helvetica", "normal");
      doc.text(getMention(avg), W - 14, y + 4.5, { align: "right" });
      y += 7;
    }
    y += 3;
  });

  y += 4;

  // ── Overall average ───────────────────────────────────────────────────────
  if (totalCoeff > 0) {
    const overall = totalWeighted / totalCoeff;
    doc.setFillColor(...C.primary);
    doc.rect(14, y, W - 28, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("MOYENNE GÉNÉRALE", 18, y + 8);
    doc.text(`${overall.toFixed(2)} / 20`, W - 14, y + 8, { align: "right" });
    y += 11;

    const mention = getMention(overall);
    if (overall >= 10) { doc.setFillColor(...C.good); } else { doc.setFillColor(...C.bad); }
    doc.roundedRect(W / 2 - 25, y + 4, 50, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(mention, W / 2, y + 9.5, { align: "center" });
  }

  // ── Footer + QR ───────────────────────────────────────────────────────────
  drawFooter(doc, {
    settings:  S,
    qrDataUrl,
    docNote:   "Document non contractuel — Pour toute question, contacter l'établissement.",
    color:     C.primary,
  });

  const slug       = `${student.last_name || ""}-${student.first_name || ""}`.toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const periodSlug = period ? `-${period.toLowerCase().replace(/\s+/g, "-")}` : "";
  doc.save(`releve-notes-${slug}${periodSlug}.pdf`);
}
