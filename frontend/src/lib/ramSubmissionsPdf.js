// RAM Risk Haritası — Gönderim Listesi PDF generator.
// Reuses the proven jspdf + jspdf-autotable + embedded Roboto TTF approach so
// Turkish characters (Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü) render correctly.
// Operational submission-list report ONLY: no risk domains/categories, no
// aggregate math, no latest-version dedup (all versions shown, as on screen).
// Consumes exactly the rows the screen already filtered — no second filter
// logic and no scope widening (data comes from /api/ram/risk-map/submissions).

const STATUS_LABELS = {
  submitted: "Gönderildi",
  under_review: "İnceleniyor",
  revision_requested: "Düzeltme İstendi",
  approved: "Onaylandı",
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }); }
  catch (_) { return String(iso); }
};

export async function generateRamSubmissionsPdf({ submissions, filters }) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const fontUrl = `${process.env.PUBLIC_URL || ""}/fonts/Roboto-Regular.ttf`;
  const buf = await (await fetch(fontUrl)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const fontB64 = btoa(binary);

  // Landscape A4: 9 columns read better wide.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.addFileToVFS("Roboto-Regular.ttf", fontB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 36;

  const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  // ---- Header ----
  let y = 44;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("PDRPUSULA", marginX, y);
  y += 19;
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("RAM Risk Haritası — Gönderim Listesi", marginX, y);
  y += 17;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(80);
  doc.text(`Rapor Tarihi: ${generatedAt}`, marginX, y);
  y += 13;

  const districtText = filters?.district ? filters.district : "Tümü";
  const statusText = filters?.status && filters.status !== "all"
    ? (STATUS_LABELS[filters.status] || filters.status) : "Tümü";
  const searchText = filters?.q ? filters.q : "Tümü";
  doc.text(`Filtreler — İlçe: ${districtText}   |   Durum: ${statusText}   |   Okul Arama: ${searchText}`, marginX, y);
  y += 13;
  doc.setFont("Roboto", "bold");
  doc.setTextColor(20);
  doc.text(`Toplam Gönderim: ${submissions.length}`, marginX, y);
  doc.setTextColor(0);
  y += 8;

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.1);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.5);
  y += 12;

  // ---- Table (all versions, exactly as filtered on screen) ----
  const body = submissions.map((s) => [
    s.school_name || "—",
    s.district || "—",
    s.academic_year || "—",
    `Sürüm ${s.version_no}`,
    fmtDateTime(s.submitted_at),
    String(s.total_students ?? 0),
    String(s.completed_students ?? 0),
    String(s.not_entered_students ?? 0),
    STATUS_LABELS[s.status] || s.status || "—",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 44 },
    head: [["Okul", "İlçe", "Eğitim Yılı", "Sürüm", "Gönderim Tarihi", "Toplam", "Tamamlanan", "Girilmeyen", "Durum"]],
    body,
    styles: { font: "Roboto", fontStyle: "normal", fontSize: 8.5, cellPadding: 3.5, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [16, 185, 129], textColor: 255, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 170 },
      1: { cellWidth: 90 },
      2: { cellWidth: 80 },
      3: { cellWidth: 56 },
      4: { cellWidth: 120 },
      5: { cellWidth: 52, halign: "right" },
      6: { cellWidth: 68, halign: "right" },
      7: { cellWidth: 62, halign: "right" },
      8: { cellWidth: "auto" },
    },
  });

  // ---- Footer + page numbers ----
  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("PDRPUSULA · RAM Risk Haritası", marginX, pageH - 18);
    doc.text(`Sayfa ${pg} / ${total}`, pageW - marginX, pageH - 18, { align: "right" });
  }
  doc.setTextColor(0);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`PDRPUSULA_RAM_Risk_Haritasi_Gonderim_Listesi_${stamp}.pdf`);
}
