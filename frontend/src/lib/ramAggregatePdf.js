// RAM Geneli Risk Haritası (aggregate) PDF generator.
// Reuses the proven jspdf + jspdf-autotable + embedded Roboto TTF approach so
// Turkish characters (Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü) render correctly.
// The ONLY data source is the already-authorized aggregate response from
// GET /api/ram/risk-map/aggregate (single source of truth). Nothing is
// recomputed here; it represents exactly the on-screen filtered scope. No
// scope widening; latest-version selection is done by the backend, not here.

const slugify = (s) => {
  if (!s) return "";
  const map = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
  return String(s)
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => map[m] || m)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
};

// meta: { ramName, yearName, districtName, levelName }
export async function generateRamAggregatePdf(data, meta = {}) {
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

  const summary = data.summary || {};
  const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  let y = 46;
  const ensure = (needed) => { if (y + needed > bottomLimit) { doc.addPage(); y = 50; } };

  const sectionTitle = (title) => {
    ensure(46);
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
  doc.text("RAM Geneli Risk Haritası Raporu", marginX, y);
  y += 18;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  const infoLines = [];
  if (meta.ramName) infoLines.push(`RAM: ${meta.ramName}`);
  infoLines.push(`Eğitim Yılı: ${meta.yearName || "—"}`);
  infoLines.push(`İlçe: ${meta.districtName || "Tümü"}`);
  infoLines.push(`Kademe: ${meta.levelName || "Tümü"}`);
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
      ["Kapsama Giren Okul Sayısı", String(summary.schools_count ?? 0)],
      ["Toplam Öğrenci", String(summary.total_students ?? 0)],
      ["Formu Tamamlayan", String(summary.completed ?? 0)],
      ["Girilmeyen / Tamamlanmayan", String(summary.not_entered ?? 0)],
      ["Tamamlanma Oranı", `%${summary.completion_rate ?? 0}`],
      ["Toplam Risk İşaretlemesi", String(summary.total_marks ?? 0)],
    ],
    styles: { font: "Roboto", fontStyle: "normal", fontSize: 9.5, cellPadding: 4, textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: 280, fontStyle: "bold", textColor: 20 }, 1: { cellWidth: 100, halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 20;

  // ---- 8 domains (preserve UI order: sort_order) ----
  const domains = [...(data.domains || [])].sort((a, b) => a.sort_order - b.sort_order);
  sectionTitle("8 Ana Risk Alanı");
  metricTable("Risk Alanı", domains, "name");

  // ---- 36 categories (preserve UI order; keep 0% rows) ----
  const categories = [...(data.categories || [])].sort((a, b) => a.sort_order - b.sort_order);
  sectionTitle("36 Risk Maddesi");
  metricTable("Risk Maddesi", categories, "label");

  // ---- Hesaplama ve Değerlendirme Notu ----
  ensure(120);
  sectionTitle("Hesaplama ve Değerlendirme Notu");
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  const notes = [
    "• Rapor, RAM'ın sorumluluk alanındaki okulların RAM'a gönderilmiş snapshot verilerinden oluşturulur.",
    "• Bir okulun birden fazla gönderimi varsa aggregate sonuçta en güncel gönderimi kullanılır.",
    "• Risk yüzdeleri okul yüzdelerinin ortalaması değildir; SUM(student_count) / SUM(completed_students) × 100 mantığına dayanır.",
    "• Formu tamamlamayan öğrenciler risk yüzdelerinin paydasına dahil edilmez.",
    "• Sonuçlar tanı koymaz; rehberlik çalışmalarının planlanmasına yardımcı veri olarak değerlendirilmelidir.",
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
    doc.text("PDRPUSULA · RAM Geneli Risk Haritası", marginX, pageH - 18);
    doc.text(`Sayfa ${pg} / ${total}`, pageW - marginX, pageH - 18, { align: "right" });
  }
  doc.setTextColor(0);

  const parts = ["RAM_Geneli_Risk_Haritasi"];
  if (meta.yearName) parts.push(slugify(meta.yearName));
  if (meta.districtName) parts.push(slugify(meta.districtName));
  if (meta.levelName) parts.push(slugify(meta.levelName));
  doc.save(`${parts.filter(Boolean).join("_")}.pdf`);
}
