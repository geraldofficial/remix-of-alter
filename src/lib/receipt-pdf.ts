import { jsPDF } from "jspdf";

export type ReceiptLine = { name: string; note?: string; amount: string };
export type ReceiptDoc = {
  heading: string;
  number: string;
  stamp: string;
  /** the shop's own name and phone, set by the admin */
  shopName?: string;
  shopPhone?: string;
  lines: ReceiptLine[];
  totals: { label: string; value: string; strong?: boolean }[];
  footer?: string;
  /** proof block: a scannable code plus the address it opens */
  verifyCode?: string;
  verifyUrl?: string;
  qr?: string;
};

/** Builds a narrow, printer friendly receipt page. */
function build(doc: ReceiptDoc) {
  const width = 80;
  const margin = 6;
  const inner = width - margin * 2;
  const pdf = new jsPDF({ unit: "mm", format: [width, 200] });
  let y = 12;

  const text = (value: string, opts?: { size?: number; bold?: boolean; right?: boolean }) => {
    pdf.setFontSize(opts?.size ?? 9);
    pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(value, inner) as string[];
    for (const line of lines) {
      pdf.text(
        line,
        opts?.right ? width - margin : margin,
        y,
        opts?.right ? { align: "right" } : undefined,
      );
      y += (opts?.size ?? 9) * 0.45 + 1.6;
    }
  };

  const pair = (left: string, right: string, bold = false) => {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(left, margin, y);
    pdf.text(right, width - margin, y, { align: "right" });
    y += 5.4;
  };

  const rule = () => {
    pdf.setDrawColor(170);
    pdf.line(margin, y - 2.6, width - margin, y - 2.6);
    y += 1.4;
  };

  if (doc.shopName) text(doc.shopName, { size: 12, bold: true });
  if (doc.shopPhone) text(doc.shopPhone, { size: 8 });
  text(doc.heading, { size: doc.shopName ? 10 : 13, bold: !doc.shopName });
  text(doc.number, { size: 10 });
  text(doc.stamp, { size: 8 });
  y += 1;
  rule();

  for (const line of doc.lines) {
    pair(line.name.slice(0, 26), line.amount);
    if (line.note) {
      pdf.setFontSize(7.5);
      pdf.setTextColor(110);
      pdf.text(line.note, margin, y - 2.4);
      pdf.setTextColor(0);
      y += 2.4;
    }
  }
  rule();

  for (const t of doc.totals) pair(t.label, t.value, t.strong);
  rule();

  if (doc.qr) {
    const size = 26;
    y += 2;
    pdf.addImage(doc.qr, "PNG", (width - size) / 2, y, size, size);
    y += size + 3.5;
    pdf.setFontSize(7.5);
    pdf.setTextColor(110);
    pdf.text("scan to check this receipt", width / 2, y, { align: "center" });
    y += 3.6;
    if (doc.verifyCode) {
      pdf.text(`code ${doc.verifyCode}`, width / 2, y, { align: "center" });
      y += 3.6;
    }
    if (doc.verifyUrl) {
      pdf.text(doc.verifyUrl, width / 2, y, { align: "center" });
      y += 3.6;
    }
    pdf.setTextColor(0);
    y += 1.5;
  }

  if (doc.footer) {
    y += 2;
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text(doc.footer, width / 2, y, { align: "center" });
    pdf.setTextColor(0);
    y += 6;
  }

  return { pdf, height: y + 6 };
}

function render(doc: ReceiptDoc) {
  return build(doc).pdf;
}

const fileName = (doc: ReceiptDoc) => `${doc.number.replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`;

export function downloadReceiptPdf(doc: ReceiptDoc) {
  render(doc).save(fileName(doc));
}

/** Shares the pdf itself through the phone share sheet where that is supported. */
export async function shareReceiptPdf(doc: ReceiptDoc) {
  const pdf = render(doc);
  const blob = pdf.output("blob");
  const file = new File([blob], fileName(doc), { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: doc.number });
      return "shared" as const;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled" as const;
    }
  }
  // the caller decides what to do instead — usually the plain share sheet
  return "unsupported" as const;
}
