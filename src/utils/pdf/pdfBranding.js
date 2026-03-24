/**
 * pdfBranding.js
 * Shared utilities for branded PDF documents:
 *   - Image loading (logo, stamp, signature)
 *   - Branded header band
 *   - Director signature + establishment stamp section
 *   - Security QR code generation
 *   - Configurable footer
 */
import { format } from "date-fns";
import { fr }     from "date-fns/locale";
import QRCode     from "qrcode";

// ── Image loader ──────────────────────────────────────────────────────────────
/**
 * Fetch a remote image URL and return it as a base64 data URL.
 * Returns null if unavailable (graceful).
 */
export async function urlToDataUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── QR code ───────────────────────────────────────────────────────────────────
/**
 * Generate a QR code data URL from a text string.
 * Requires the `qrcode` npm package. Returns null if not available.
 */
export async function makeQRDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, {
      width:  300,
      margin: 1,
      color:  { dark: "#1a1a2e", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

// ── Asset loader ──────────────────────────────────────────────────────────────
/**
 * Load logo / stamp / signature images in parallel.
 * @param {object} settings - School settings from getSchoolSettings
 */
export async function loadBrandingAssets(settings = {}) {
  const [logoDataUrl, stampDataUrl, signatureDataUrl] = await Promise.all([
    urlToDataUrl(settings.school_logo),
    urlToDataUrl(settings.school_stamp),
    urlToDataUrl(settings.director_signature),
  ]);
  return { logoDataUrl, stampDataUrl, signatureDataUrl };
}

// ── Header ────────────────────────────────────────────────────────────────────
/**
 * Draw the branded header band.
 *
 * Layout:
 *   [ LOGO? ]  SCHOOL NAME (bold, white)          DOCUMENT TITLE
 *              school_address                      date/subtitle
 *                                                  [ BADGE? ]
 *
 * @param {import("jspdf").jsPDF} doc
 * @param {object}      opts
 * @param {string}      opts.title          - Document title (right)
 * @param {string}      [opts.subtitle]     - Subtitle / date line (right)
 * @param {string}      [opts.badge]        - Small badge text
 * @param {number[]}    opts.color          - Band RGB [r, g, b]
 * @param {object}      opts.settings       - School settings
 * @param {string|null} opts.logoDataUrl    - Logo as data URL
 * @returns {number} First usable y position after header
 */
export function drawHeader(doc, { title, subtitle, badge, color, settings = {}, logoDataUrl = null }) {
  const W      = doc.internal.pageSize.getWidth();
  const BAND_H = 44;

  doc.setFillColor(...color);
  doc.rect(0, 0, W, BAND_H, "F");

  const schoolName = settings.school_name || "Établissement";
  const schoolAddr = settings.school_address || "";
  const textX      = logoDataUrl ? 48 : 14;

  // Logo (top-left, 34×34 mm)
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", 7, 5, 34, 34); } catch {}
  }

  doc.setTextColor(255, 255, 255);

  // ── School name (left half) — wraps automatically if too long ──────────────
  const maxNameW = W / 2 - textX - 4;          // left half minus margins
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(schoolName, maxNameW);
  const displayLines = nameLines.slice(0, 2);   // max 2 lines
  displayLines.forEach((line, i) => {
    doc.text(line, textX, 13 + i * 7);
  });

  // Address below name
  if (schoolAddr) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const addrY = displayLines.length > 1 ? 28 : 21;
    doc.text(schoolAddr, textX, addrY);
  }

  // ── Document title (right half, right-aligned) ────────────────────────────
  const maxTitleW = W / 2 - 18;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(title, maxTitleW);
  titleLines.slice(0, 2).forEach((line, i) => {
    doc.text(line, W - 14, 13 + i * 7, { align: "right" });
  });

  // Subtitle / date
  if (subtitle) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const subY = titleLines.length > 1 ? 28 : 21;
    doc.text(subtitle, W - 14, subY, { align: "right" });
  }

  // Badge (bottom-right of band)
  if (badge) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(W - 58, 32, 44, 8, 2, 2, "F");
    doc.setTextColor(...color);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(badge, W - 36, 37.4, { align: "center" });
  }

  return BAND_H + 8; // first usable y
}

// ── Stamp + Signature ─────────────────────────────────────────────────────────
/**
 * Draw two side-by-side boxes:
 *   Left  → Director signature
 *   Right → Establishment stamp
 *
 * @param {import("jspdf").jsPDF} doc
 * @param {object}      opts
 * @param {number}      opts.sigY               - Top Y of the section
 * @param {string|null} opts.signatureDataUrl
 * @param {string|null} opts.stampDataUrl
 * @param {number[]}    opts.color
 */
export function drawStampSignature(doc, { sigY, signatureDataUrl = null, stampDataUrl = null, color }) {
  const W     = doc.internal.pageSize.getWidth();
  const BOX_W = (W - 40) / 2;
  const BOX_H = 46;
  const BG    = [248, 250, 252];
  const BD    = [226, 232, 240];
  const MU    = [107, 114, 128];

  const drawBox = (x, headerLabel, imgDataUrl, footerLabel) => {
    doc.setFillColor(...BG);
    doc.setDrawColor(...BD);
    doc.roundedRect(x, sigY, BOX_W, BOX_H, 2, 2, "FD");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MU);
    doc.text(headerLabel, x + BOX_W / 2, sigY + 9, { align: "center" });

    if (imgDataUrl) {
      try {
        doc.addImage(imgDataUrl, "PNG", x + BOX_W / 2 - 20, sigY + 13, 40, 25);
      } catch {}
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MU);
    doc.text(footerLabel, x + BOX_W / 2, sigY + BOX_H - 4, { align: "center" });
  };

  drawBox(14,                  "Le Directeur",               signatureDataUrl, "Signature");
  drawBox(14 + BOX_W + 12,     "Cachet de l'établissement",  stampDataUrl,     "Cachet officiel");
}

// ── Footer ────────────────────────────────────────────────────────────────────
/**
 * Draw the footer bar with:
 *   - Horizontal rule
 *   - Generated-at date line
 *   - Custom footer text (admin-configured) or fallback docNote
 *   - QR code (bottom-right, 20×20 mm)
 *
 * @param {import("jspdf").jsPDF} doc
 * @param {object}      opts
 * @param {object}      opts.settings    - School settings
 * @param {string|null} opts.qrDataUrl   - QR code data URL
 * @param {string}      [opts.docNote]   - Fallback note text
 * @param {number[]}    opts.color
 */
export function drawFooter(doc, { settings = {}, qrDataUrl = null, docNote = "", color }) {
  const W          = doc.internal.pageSize.getWidth();
  const H          = doc.internal.pageSize.getHeight();
  const MU         = [107, 114, 128];
  const BD         = [226, 232, 240];
  const schoolName = settings.school_name || "Établissement";
  const footerText = settings.doc_footer_text || docNote;
  const QR_SZ      = 20; // mm
  const LINE_Y     = H - 28;

  doc.setDrawColor(...BD);
  doc.line(14, LINE_Y, W - 14, LINE_Y);

  // QR code — bottom-right
  if (qrDataUrl) {
    try {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.2);
      doc.roundedRect(W - QR_SZ - 14, LINE_Y + 2, QR_SZ, QR_SZ, 1, 1, "S");
      doc.addImage(qrDataUrl, "PNG", W - QR_SZ - 14, LINE_Y + 2, QR_SZ, QR_SZ);
      doc.setTextColor(...MU);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      doc.setLineWidth(0.2);
      doc.text("Scan pour vérification", W - QR_SZ / 2 - 14, H - 3, { align: "center" });
    } catch {}
  }

  doc.setTextColor(...MU);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const dateStr = format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  doc.text(`Document généré le ${dateStr} — ${schoolName}`, 14, LINE_Y + 9);

  if (footerText) {
    const maxW   = qrDataUrl ? W - QR_SZ - 32 : W - 28;
    const lines  = doc.splitTextToSize(footerText, maxW);
    if (lines[0]) doc.text(lines[0], 14, LINE_Y + 16);
    if (lines[1]) doc.text(lines[1], 14, LINE_Y + 22);
  }
}
