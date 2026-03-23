/**
 * generateReceipt — Génère un reçu de paiement PDF avec jsPDF
 * Usage : generateReceipt({ transaction, invoice, student, schoolName })
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = {
  primary:    [67,  56,  202],   // indigo-700
  success:    [5,   150, 105],   // emerald-600
  text:       [30,  30,  30],
  muted:      [107, 114, 128],
  border:     [226, 232, 240],
  bg:         [248, 250, 252],
};

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-DZ") + " DA";
}

function safeDate(dateStr) {
  try {
    return format(new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : "")), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr || "—";
  }
}

/**
 * @param {object} opts
 * @param {object} opts.transaction  - FinTransaction row
 * @param {object} opts.invoice      - FinInvoice (enriched, with .items and .transactions)
 * @param {object} opts.student      - Student row { first_name, last_name, student_code }
 * @param {string} [opts.schoolName] - School name
 * @param {string} [opts.schoolAddress]
 */
export function generateReceipt({ transaction, invoice, student, schoolName = "Établissement", schoolAddress = "" }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;

  // ── Header background band ───────────────────────────────────────────────
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, W, 40, "F");

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName, 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (schoolAddress) doc.text(schoolAddress, 14, 22);

  // "REÇU DE PAIEMENT" on the right
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("REÇU DE PAIEMENT", W - 14, 16, { align: "right" });

  // Receipt number
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${transaction.id.slice(0, 8).toUpperCase()}`, W - 14, 23, { align: "right" });
  doc.text(`Date : ${safeDate(transaction.payment_date)}`, W - 14, 29, { align: "right" });

  // Green "PAYÉ" stamp
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(W - 50, 32, 36, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PAIEMENT REÇU", W - 32, 37.5, { align: "center" });

  y = 50;

  // ── Student info box ─────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.bg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, y, W - 28, 22, 2, 2, "FD");

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ÉLÈVE", 20, y + 6);
  doc.text("ANNÉE SCOLAIRE", W / 2, y + 6);

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const studentName = student ? `${student.first_name} ${student.last_name}` : invoice.student_id;
  doc.text(studentName, 20, y + 13);
  doc.setFontSize(10);
  doc.text(invoice.school_year || "—", W / 2, y + 13);

  if (student?.student_code) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(`N° ${student.student_code}`, 20, y + 19);
  }

  y += 30;

  // ── Invoice items ────────────────────────────────────────────────────────
  if (invoice.items?.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.muted);
    doc.text("DÉTAIL DE LA FACTURE", 14, y);
    y += 5;

    // Table header
    doc.setFillColor(...COLORS.primary);
    doc.rect(14, y, W - 28, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("Désignation", 18, y + 4.5);
    doc.text("Qté", W - 50, y + 4.5, { align: "right" });
    doc.text("Montant", W - 14, y + 4.5, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    invoice.items.forEach((it, idx) => {
      const bg = idx % 2 === 0 ? [255, 255, 255] : COLORS.bg;
      doc.setFillColor(...bg);
      doc.rect(14, y, W - 28, 7, "F");
      doc.setTextColor(...COLORS.text);
      doc.setFontSize(9);
      doc.text(String(it.label || ""), 18, y + 4.5);
      doc.text(String(it.quantity || 1), W - 50, y + 4.5, { align: "right" });
      doc.text(fmt(Number(it.amount || 0) * Number(it.quantity || 1)), W - 14, y + 4.5, { align: "right" });
      y += 7;
    });

    // Discount
    if (Number(invoice.discount_amount) > 0) {
      doc.setFillColor(240, 253, 244);
      doc.rect(14, y, W - 28, 7, "F");
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(9);
      doc.text(`Remise${invoice.discount_reason ? ` (${invoice.discount_reason})` : ""}`, 18, y + 4.5);
      doc.text(`- ${fmt(invoice.discount_amount)}`, W - 14, y + 4.5, { align: "right" });
      y += 7;
    }

    // Total net
    doc.setFillColor(...COLORS.primary);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL NET", 18, y + 5.5);
    doc.text(fmt(invoice.net_amount), W - 14, y + 5.5, { align: "right" });
    y += 15;
  }

  // ── Payment details ──────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.muted);
  doc.text("CE PAIEMENT", 14, y);
  y += 5;

  const PAYMENT_LABELS = { cash: "Espèces", cheque: "Chèque", virement: "Virement bancaire", carte: "Carte bancaire" };
  const payRows = [
    ["Montant payé",    fmt(transaction.amount)],
    ["Mode",            PAYMENT_LABELS[transaction.payment_method] || transaction.payment_method || "—"],
    ["Date",            safeDate(transaction.payment_date)],
    ...(transaction.reference ? [["Référence", transaction.reference]] : []),
    ...(transaction.recorded_by ? [["Enregistré par", transaction.recorded_by]] : []),
  ];

  payRows.forEach(([label, value], idx) => {
    const bg = idx % 2 === 0 ? [255, 255, 255] : COLORS.bg;
    doc.setFillColor(...bg);
    doc.setDrawColor(...COLORS.border);
    doc.rect(14, y, W - 28, 7, "FD");
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, 18, y + 4.5);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.text(String(value), W - 14, y + 4.5, { align: "right" });
    y += 7;
  });

  y += 5;

  // ── Remaining balance ────────────────────────────────────────────────────
  const balance = Number(invoice.balance || 0);
  const isPaid = balance === 0;

  doc.setFillColor(...(isPaid ? COLORS.success : [245, 158, 11]));
  doc.roundedRect(14, y, W - 28, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (isPaid) {
    doc.text("✓  Facture entièrement réglée", W / 2, y + 8, { align: "center" });
  } else {
    doc.text(`Reste à payer : ${fmt(balance)}`, W / 2, y + 8, { align: "center" });
  }
  y += 20;

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setDrawColor(...COLORS.border);
  doc.line(14, H - 20, W - 14, H - 20);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Document généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — ${schoolName}`, W / 2, H - 14, { align: "center" });
  doc.text("Ce document tient lieu de reçu officiel.", W / 2, H - 9, { align: "center" });

  // Save
  const studentSlug = student ? `${student.first_name}-${student.last_name}`.replace(/\s+/g, "-").toLowerCase() : "eleve";
  doc.save(`recu-${studentSlug}-${transaction.payment_date}.pdf`);
}
