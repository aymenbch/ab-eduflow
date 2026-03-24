/**
 * generateAttestation — Attestation d'inscription PDF
 * Supports: logo, stamp, director signature, QR code, configurable footer.
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { fr }     from "date-fns/locale";
import {
  loadBrandingAssets,
  makeQRDataUrl,
  drawHeader,
  drawStampSignature,
  drawFooter,
} from "./pdfBranding";

const C = {
  primary: [67, 56, 202],
  text:    [30, 30, 30],
  muted:   [107, 114, 128],
  border:  [226, 232, 240],
  bg:      [248, 250, 252],
};

function safeDate(d) {
  if (!d) return "—";
  try { return format(new Date(d + (d.length === 10 ? "T12:00:00" : "")), "d MMMM yyyy", { locale: fr }); }
  catch { return String(d); }
}

/**
 * @param {object} opts
 * @param {object} opts.student
 * @param {object} [opts.cls]
 * @param {string} [opts.schoolYear]
 * @param {string} [opts.schoolName]     - Legacy; prefer opts.settings.school_name
 * @param {string} [opts.schoolAddress]  - Legacy; prefer opts.settings.school_address
 * @param {object} [opts.settings]       - School settings from getSchoolSettings
 */
export async function generateAttestation({
  student,
  cls,
  schoolYear,
  schoolName    = "Établissement",
  schoolAddress = "",
  settings      = {},
}) {
  // Merge legacy params into settings
  const S = {
    school_name:    settings.school_name    || schoolName,
    school_address: settings.school_address || schoolAddress,
    school_logo:       settings.school_logo,
    school_stamp:      settings.school_stamp,
    director_signature: settings.director_signature,
    doc_footer_text:   settings.doc_footer_text,
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();

  // ── Load images + QR in parallel ─────────────────────────────────────────
  const qrText = [
    `DOCUMENT: Attestation d'inscription`,
    `ÉTABLISSEMENT: ${S.school_name}`,
    `ÉLÈVE: ${student.first_name} ${student.last_name}`,
    `N° ÉLÈVE: ${student.student_code || "—"}`,
    `CLASSE: ${cls?.name || "—"}`,
    `ANNÉE SCOLAIRE: ${schoolYear || "—"}`,
    `DATE: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
  ].join("\n");

  const [{ logoDataUrl, stampDataUrl, signatureDataUrl }, qrDataUrl] = await Promise.all([
    loadBrandingAssets(S),
    makeQRDataUrl(qrText),
  ]);

  // ── Header ────────────────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    title:      "ATTESTATION D'INSCRIPTION",
    subtitle:   `Date : ${format(new Date(), "d MMMM yyyy", { locale: fr })}`,
    badge:      "DOCUMENT OFFICIEL",
    color:      C.primary,
    settings:   S,
    logoDataUrl,
  });

  // ── Title block ───────────────────────────────────────────────────────────
  doc.setTextColor(...C.text);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ATTESTATION D'INSCRIPTION", W / 2, y + 4, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`Année scolaire ${schoolYear || "en cours"}`, W / 2, y + 13, { align: "center" });
  y += 28;

  // ── Intro text ────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.text);
  doc.text(`Nous soussignés, Direction de l'établissement ${S.school_name},`, W / 2, y, { align: "center" });
  doc.text("attestons par la présente que l'élève :", W / 2, y + 7, { align: "center" });
  y += 22;

  // ── Student info box ──────────────────────────────────────────────────────
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(30, y, W - 60, 48, 3, 3, "FD");

  const rows = [
    ["Nom et prénom",      `${(student.last_name || "").toUpperCase()} ${student.first_name || ""}`],
    ["Date de naissance",  safeDate(student.date_of_birth)],
    ["Numéro matricule",   student.student_code || "—"],
    ["Classe",             cls?.name || "—"],
    ["Niveau",             cls?.level || "—"],
    ["Date d'inscription", safeDate(student.enrollment_date || student.created_date)],
  ];
  let ry = y + 8;
  rows.forEach(([label, value]) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.muted);
    doc.text(label, 38, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.text);
    doc.text(`: ${value}`, 38 + 44, ry);
    ry += 7;
  });
  y += 56;

  // ── Body text ─────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.text);
  [
    `est régulièrement inscrit(e) dans notre établissement`,
    `pour l'année scolaire ${schoolYear || "en cours"}, en qualité d'élève.`,
    "",
    "Cette attestation lui est délivrée pour servir et valoir ce que de droit.",
  ].forEach(line => {
    if (line === "") { y += 5; return; }
    doc.text(line, W / 2, y, { align: "center" });
    y += 8;
  });

  // ── Stamp + Signature ─────────────────────────────────────────────────────
  drawStampSignature(doc, {
    sigY: H - 84,
    signatureDataUrl,
    stampDataUrl,
    color: C.primary,
  });

  // ── Footer + QR ───────────────────────────────────────────────────────────
  drawFooter(doc, {
    settings:  S,
    qrDataUrl,
    docNote:   "Ce document est une attestation officielle d'inscription scolaire.",
    color:     C.primary,
  });

  const slug = `${student.last_name || ""}-${student.first_name || ""}`.toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  doc.save(`attestation-inscription-${slug}.pdf`);
}
