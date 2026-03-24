/**
 * generateAttestatFiscale — Attestation fiscale / récapitulatif paiements PDF
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
  primary: [5, 150, 105],   // emerald — finance color
  text:    [30, 30, 30],
  muted:   [107, 114, 128],
  border:  [226, 232, 240],
  bg:      [248, 250, 252],
  paid:    [5, 150, 105],
  unpaid:  [220, 38, 38],
};

function fmt(n)    { return Number(n || 0).toLocaleString("fr-DZ") + " DA"; }

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
 * @param {Array}  opts.invoices       - FinInvoice rows (enriched)
 * @param {string} [opts.schoolName]   - Legacy
 * @param {string} [opts.schoolAddress]- Legacy
 * @param {object} [opts.settings]     - School settings from getSchoolSettings
 */
export async function generateAttestatFiscale({
  student,
  cls,
  schoolYear,
  invoices      = [],
  schoolName    = "Établissement",
  schoolAddress = "",
  settings      = {},
}) {
  const S = {
    school_name:    settings.school_name    || schoolName,
    school_address: settings.school_address || schoolAddress,
    school_logo:           settings.school_logo,
    school_stamp:          settings.school_stamp,
    director_signature:    settings.director_signature,
    doc_footer_text:       settings.doc_footer_text,
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();

  const totalNet  = invoices.reduce((s, i) => s + Number(i.net_amount  || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const balance   = totalNet - totalPaid;

  // ── Load images + QR in parallel ─────────────────────────────────────────
  const qrText = [
    `DOCUMENT: Attestation Fiscale`,
    `ÉTABLISSEMENT: ${S.school_name}`,
    `ÉLÈVE: ${student.first_name} ${student.last_name}`,
    `N° ÉLÈVE: ${student.student_code || "—"}`,
    `ANNÉE SCOLAIRE: ${schoolYear || "—"}`,
    `TOTAL PAYÉ: ${fmt(totalPaid)}`,
    `DATE: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
  ].join("\n");

  const [{ logoDataUrl, stampDataUrl, signatureDataUrl }, qrDataUrl] = await Promise.all([
    loadBrandingAssets(S),
    makeQRDataUrl(qrText),
  ]);

  // ── Header ────────────────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    title:      "ATTESTATION FISCALE",
    subtitle:   `Date : ${format(new Date(), "d MMMM yyyy", { locale: fr })}`,
    badge:      "DOCUMENT FISCAL",
    color:      C.primary,
    settings:   S,
    logoDataUrl,
  });

  // ── Page title ────────────────────────────────────────────────────────────
  doc.setTextColor(...C.text);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("ATTESTATION DE SCOLARITÉ FISCALE", W / 2, y + 3, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(
    `Récapitulatif des frais de scolarité — Année scolaire ${schoolYear || "en cours"}`,
    W / 2, y + 11, { align: "center" }
  );
  y += 22;

  // ── Student info ──────────────────────────────────────────────────────────
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(14, y, W - 28, 20, 2, 2, "FD");

  doc.setTextColor(...C.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ÉLÈVE",  20,      y + 6);
  doc.text("CLASSE", W / 2,   y + 6);

  doc.setTextColor(...C.text);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${student.first_name} ${student.last_name}`, 20, y + 14);
  doc.setFontSize(10);
  doc.text(cls?.name || "—", W / 2, y + 14);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  if (student.student_code) doc.text(`N° ${student.student_code}`, 20, y + 18);
  y += 30;

  // ── Invoices table ────────────────────────────────────────────────────────
  if (invoices.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.muted);
    doc.text("DÉTAIL DES FRAIS DE SCOLARITÉ", 14, y);
    y += 6;

    // Header row
    doc.setFillColor(...C.primary);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("Désignation", 18,      y + 5.5);
    doc.text("Échéance",    W - 85,  y + 5.5, { align: "right" });
    doc.text("Montant",     W - 55,  y + 5.5, { align: "right" });
    doc.text("Payé",        W - 28,  y + 5.5, { align: "right" });
    doc.text("Statut",      W - 14,  y + 5.5, { align: "right" });
    y += 8;

    invoices.forEach((inv, idx) => {
      const bg = idx % 2 === 0 ? [255, 255, 255] : C.bg;
      doc.setFillColor(...bg);
      doc.rect(14, y, W - 28, 7, "F");

      doc.setTextColor(...C.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(String(inv.label || inv.school_year || "Facture"), 18, y + 4.5);
      doc.text(safeDate(inv.due_date), W - 85, y + 4.5, { align: "right" });
      doc.text(fmt(inv.net_amount),    W - 55, y + 4.5, { align: "right" });

      doc.setTextColor(...C.paid);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(inv.paid_amount), W - 28, y + 4.5, { align: "right" });

      const statusLabel = inv.status === "paid" ? "Réglée" : inv.status === "partial" ? "Partiel" : "Impayée";
      if (inv.status === "paid") { doc.setTextColor(...C.paid); } else { doc.setTextColor(...C.unpaid); }
      doc.text(statusLabel, W - 14, y + 4.5, { align: "right" });
      y += 7;
    });
    y += 4;
  } else {
    doc.setTextColor(...C.muted);
    doc.setFontSize(10);
    doc.text("Aucune facture enregistrée pour cette période.", W / 2, y + 8, { align: "center" });
    y += 20;
  }

  // ── Summary box ───────────────────────────────────────────────────────────
  const summaryRows = [
    ["Total frais de scolarité",         fmt(totalNet),  C.text],
    ["Total payé (montant justifiable)",  fmt(totalPaid), C.paid],
    ["Solde restant",                     fmt(balance),   balance > 0 ? C.unpaid : C.paid],
  ];
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(14, y, W - 28, summaryRows.length * 9 + 6, 2, 2, "FD");
  let sy = y + 8;
  summaryRows.forEach(([label, value, color]) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.muted);
    doc.text(label, 20, sy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(value, W - 20, sy, { align: "right" });
    sy += 9;
  });
  y += summaryRows.length * 9 + 14;

  // ── Attestation paragraph ─────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.text);
  const attestText = "Nous attestons que les frais de scolarité ci-dessus ont été effectivement réglés par la famille de l'élève. Ce document peut être présenté aux services fiscaux compétents pour toute déduction applicable.";
  const attestLines = doc.splitTextToSize(attestText, W - 40);
  doc.text(attestLines, W / 2, y, { align: "center" });

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
    docNote:   "Ce document tient lieu d'attestation fiscale officielle.",
    color:     C.primary,
  });

  const slug = `${student.last_name || ""}-${student.first_name || ""}`.toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  doc.save(`attestation-fiscale-${slug}-${schoolYear || "annee"}.pdf`);
}
