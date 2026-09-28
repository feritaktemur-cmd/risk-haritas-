// RAM Risk Haritası — Tek Okul Gönderim Detayı PDF generator.
// Reuses the proven jspdf + jspdf-autotable + embedded Roboto TTF approach so
// Turkish characters (Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü) render correctly.
// The ONLY data source is the already-authorized detail response from
// GET /api/ram/risk-map/submissions/{id} (single source of truth). Nothing is
// recomputed here; it represents exactly the viewed submission_id snapshot
// (never latest-version). No scope widening.

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

// Safe, filesystem-friendly slug from an arbitrary (Turkish) string.
const slugify = (s) => {
  if (!s) return "";
  const map = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
  return String(s)
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => map[m] || m)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
};

export async function generateRamSubmissionDetailPdf(detail) {
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

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.addFileToVFS("Roboto-Regular.ttf", fontB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const bottomLimit = pageH - 46;

  const summary = detail.summary || {};
  const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  // Cursor + helpers that respect page breaks.
  let y = 46;
  const ensure = (needed) => { if (y + needed > bottomLimit) { doc.addPage(); y = 50; } };

  const sectionTitle = (title) => {
    ensure(46); // avoid a heading orphaned at page bottom
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(20);
    doc.text(title, marginX, y);
    doc.setTextColor(0);
    y += 8;
  };

  const metricTable = (firstCol, rows, nameKey) => {
    const body = (rows || []).map((r) => [
      r[nameKey] || "—",
      String(r.student_count ?? 0),
      `%${r.percentage ?? 0}`,
    ]);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX, bottom: 46 },
      head: [[firstCol, "Öğrenci", "Yüzde"]],
      body: body.length ? body : [["Kayıt yok", "", ""]],
      styles: { font: "Roboto", fontStyle: "normal", fontSize: 9, cellPadding: 3.5, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 80, halign: "right" },
        2: { cellWidth: 70, halign: "right" },
      },
    });
    y = doc.lastAutoTable.finalY + 20;
  };

  // ---- Header ----
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("PDRPUSULA", marginX, y);
  y += 19;
  doc.setFontSize(12.5);
  doc.setTextColor(20);
  doc.text("Risk Haritası — Okul Gönderim Raporu", marginX, y);
  y += 18;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  const infoLines = [];
  if (detail.school_name) infoLines.push(`Okul: ${detail.school_name}`);
  if (detail.district) infoLines.push(`İlçe: ${detail.district}`);
  if (detail.education_level) infoLines.push(`Kademe: ${detail.education_level}`);
  if (detail.academic_year) infoLines.push(`Eğitim Yılı: ${detail.academic_year}`);
  if (detail.version_no != null) infoLines.push(`Sürüm: ${detail.version_no}`);
  if (detail.status) infoLines.push(`Durum: ${STATUS_LABELS[detail.status] || detail.status}`);
  if (detail.submitted_at) infoLines.push(`Gönderim Tarihi: ${fmtDateTime(detail.submitted_at)}`);
  infoLines.push(`Rapor Tarihi: ${generatedAt}`);
  infoLines.forEach((ln) => { doc.text(ln, marginX, y); y += 14; });
  doc.setTextColor(0);
  y += 2;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.1);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.5);
  y += 18;

  // ---- Summary ----
  sectionTitle("Özet");
  autoTable(doc, {
    startY: y + 6,
    margin: { left: marginX, right: marginX, bottom: 46 },
    body: [
      ["Toplam Öğrenci", String(summary.total_students ?? 0)],
      ["Formu Tamamlayan", String(summary.completed ?? 0)],
      ["Girilmeyen / Tamamlanmayan", String(summary.not_entered ?? 0)],
      ["Tamamlanma Oranı", `%${summary.completion_rate ?? 0}`],
      ["Toplam Risk İşaretlemesi", String(summary.total_marks ?? 0)],
    ],
    styles: { font: "Roboto", fontStyle: "normal", fontSize: 9.5, cellPadding: 4, textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: 260, fontStyle: "bold", textColor: 20 }, 1: { cellWidth: 100, halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 20;

  // ---- 8 domains (preserve UI order: sort_order) ----
  const domains = [...(detail.domains || [])].sort((a, b) => a.sort_order - b.sort_order);
  sectionTitle("8 Ana Risk Alanı");
  metricTable("Risk Alanı", domains, "name");

  // ---- 36 categories (preserve UI order: sort_order; keep 0% rows) ----
  const categories = [...(detail.categories || [])].sort((a, b) => a.sort_order - b.sort_order);
  sectionTitle("36 Risk Maddesi");
  metricTable("Risk Maddesi", categories, "label");

  // ---- Class-based results ----
  const classes = detail.classes || [];
  if (classes.length) {
    sectionTitle("Sınıf Bazlı Risk Haritası");
    y += 2;
    classes.forEach((c) => {
      ensure(70);
      doc.setFont("Roboto", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.text(`Sınıf ${c.class_name}`, marginX, y);
      doc.setFont("Roboto", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(90);
      y += 13;
      doc.text(
        `Toplam ${c.total_students} · Tamamlanan ${c.completed_students} · Girilmeyen ${c.not_entered_students} · %${c.completion_rate} · Risk İşaretleme ${c.total_risk_marks}`,
        marginX, y
      );
      doc.setTextColor(0);
      y += 6;

      // Class domains.
      autoTable(doc, {
        startY: y + 4,
        margin: { left: marginX, right: marginX, bottom: 46 },
        head: [["Risk Alanı", "Öğrenci", "Yüzde"]],
        body: (c.domains || []).map((d) => [d.name || "—", String(d.student_count ?? 0), `%${d.percentage ?? 0}`]),
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 8, cellPadding: 2.5, overflow: "linebreak", textColor: 40, lineColor: [230, 230, 230], lineWidth: 0.5 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [99, 102, 241], textColor: 255, fontSize: 8 },
        columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 70, halign: "right" }, 2: { cellWidth: 60, halign: "right" } },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Class categories (keep all 36, incl. 0%).
      autoTable(doc, {
        startY: y + 2,
        margin: { left: marginX, right: marginX, bottom: 46 },
        head: [["Risk Maddesi", "Öğrenci", "Yüzde"]],
        body: (c.categories || []).map((ct) => [ct.label || "—", String(ct.student_count ?? 0), `%${ct.percentage ?? 0}`]),
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 7.5, cellPadding: 2.2, overflow: "linebreak", textColor: 40, lineColor: [235, 235, 235], lineWidth: 0.5 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [71, 85, 105], textColor: 255, fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 70, halign: "right" }, 2: { cellWidth: 60, halign: "right" } },
      });
      y = doc.lastAutoTable.finalY + 18;
    });
  }

  // ---- Hesaplama Notu ----
  ensure(96);
  sectionTitle("Hesaplama Notu");
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  const notes = [
    "• Bu rapor, okulun RAM'a gönderdiği sabit (snapshot) verisini gösterir; canlı veri değildir.",
    "• Risk yüzdeleri, formu tamamlayan öğrenciler üzerinden değerlendirilir.",
    "• Eksik/girilmemiş öğrenciler yüzde paydasına dahil edilmez.",
    "• Sonuçlar tanı koymaz; rehberlik çalışmalarını planlamaya yardımcı veri olarak değerlendirilmelidir.",
  ];
  notes.forEach((n) => {
    const lines = doc.splitTextToSize(n, pageW - marginX * 2);
    lines.forEach((l) => { ensure(14); doc.text(l, marginX, y); y += 13; });
  });
  doc.setTextColor(0);

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

  const schoolSlug = slugify(detail.school_name) || "Okul";
  const verSlug = detail.version_no != null ? `Surum${detail.version_no}` : "Surum";
  doc.save(`Risk_Haritasi_Okul_Gonderim_Raporu_${schoolSlug}_${verSlug}.pdf`);
}
