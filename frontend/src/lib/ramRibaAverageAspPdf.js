// RİBA İlçe Ortalama ASP Analizi PDF (jspdf + autotable + embedded Roboto).
// Data comes only from the already-authorized on-screen responses; nothing is recomputed.

const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
const fileSlug = (s) => String(s || "")
  .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => TR_MAP[m])
  .replace(/[^a-zA-Z0-9-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 60);

export const topAspTargets = (targets) => (targets || [])
  .filter((t) => t.average_asp !== null && t.average_asp !== undefined)
  .sort((a, b) => (a.rank - b.rank) || String(a.meb_code || "").localeCompare(String(b.meb_code || ""), "tr"))
  .slice(0, 10);

const fmtAsp = (v) => Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EMERALD = [16, 185, 129];
const NA = "Hesaplanamadı";

// sections: [{ levelName, data, error }]; meta: { ramName, yearName, districtName, levelLabel, isAll, note }
export async function generateRamRibaAverageAspPdf(sections, meta) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const buf = await (await fetch(`${process.env.PUBLIC_URL || ""}/fonts/Roboto-Regular.ttf`)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.addFileToVFS("Roboto-Regular.ttf", btoa(binary));
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 46;
  let y = 46;
  const ensure = (needed) => { if (y + needed > bottomLimit) { doc.addPage(); y = 50; } };
  const font = (size, bold = false, color = 40) => { doc.setFont("Roboto", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color); };
  const tableStyles = { font: "Roboto", fontStyle: "normal", fontSize: 9, cellPadding: 3.5, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 };

  const paragraph = (text, size = 9, color = 90) => {
    font(size, false, color);
    doc.splitTextToSize(text, contentW).forEach((l) => { ensure(13); doc.text(l, marginX, y); y += 12; });
  };

  const summaryTable = (rows) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 46 },
      body: rows,
      styles: { ...tableStyles, fontSize: 9.5, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: "auto", fontStyle: "bold", textColor: 20 }, 1: { cellWidth: 120, halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 16;
  };

  const barChart = (targets, context) => {
    const labelW = 200;
    const valueW = 50;
    const barX = marginX + labelW + 10;
    const barW = contentW - labelW - valueW - 20;
    ensure(60);
    font(10.5, true, 20);
    doc.text("Ortalama ASP'si En Yüksek Hedefler (İlk 10)", marginX, y);
    y += 13;
    font(8.5, false, 110);
    doc.text(context, marginX, y);
    y += 14;
    const top = topAspTargets(targets);
    if (top.length === 0) { paragraph("Grafik oluşturmak için hesaplanmış ASP verisi bulunmuyor.", 9.5, 90); y += 8; return; }
    top.forEach((t) => {
      font(8.5, false, 40);
      const lines = doc.splitTextToSize(`${t.meb_code || "—"} – ${t.target_name || "—"}`, labelW);
      const rowH = Math.max(lines.length * 10.5, 12) + 6;
      ensure(rowH);
      doc.text(lines, marginX, y + 8);
      const midY = y + rowH / 2 - 4;
      doc.setFillColor(232, 236, 241);
      doc.rect(barX, midY, barW, 8, "F");
      const v = Math.min(100, Math.max(0, Number(t.average_asp) || 0));
      if (v > 0) { doc.setFillColor(...EMERALD); doc.rect(barX, midY, (barW * v) / 100, 8, "F"); }
      doc.setDrawColor(120);
      doc.setLineWidth(0.6);
      doc.line(barX + barW / 2, midY - 1, barX + barW / 2, midY + 9);
      font(8.5, true, 30);
      doc.text(fmtAsp(t.average_asp), pageW - marginX, midY + 7, { align: "right" });
      y += rowH;
    });
    ensure(24);
    [0, 25, 50, 75, 100].forEach((v) => { font(7, v === 50, v === 50 ? 60 : 130); doc.text(String(v), barX + (barW * v) / 100, y + 6, { align: "center" }); });
    y += 14;
    font(7.5, false, 120);
    doc.text("Ölçek 0–100 ASP puanıdır; dikey çizgi 50 referans değerini gösterir.", marginX, y + 2);
    y += 18;
    doc.setLineWidth(0.5);
  };

  const targetTable = (targets) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 46 },
      head: [["Sıra", "MEB Kodu", "Hedef", "Katılan Okul", "Geçerli Okul", "Ortalama ASP"]],
      body: (targets || []).map((t) => [
        t.rank === null || t.rank === undefined ? NA : String(t.rank),
        t.meb_code || "—", t.target_name || "—",
        String(t.participating_school_count ?? 0), String(t.valid_school_count ?? 0),
        t.average_asp === null || t.average_asp === undefined ? NA : fmtAsp(t.average_asp),
      ]),
      styles: tableStyles,
      headStyles: { font: "Roboto", fontStyle: "bold", fillColor: EMERALD, textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { cellWidth: 78, halign: "center" }, 1: { cellWidth: 52 }, 2: { cellWidth: "auto" }, 3: { cellWidth: 52, halign: "right" }, 4: { cellWidth: 52, halign: "right" }, 5: { cellWidth: 78, halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 18;
  };

  // ---- Header ----
  font(16, true, 30);
  doc.text("PDRPUSULA", marginX, y);
  y += 19;
  font(12.5, true, 20);
  doc.text("RİBA İlçe Ortalama ASP Analizi Raporu", marginX, y);
  y += 18;
  font(10, false, 70);
  [
    ...(meta.ramName ? [`RAM: ${meta.ramName}`] : []),
    `Eğitim Yılı: ${meta.yearName || "—"}`,
    `İlçe: ${meta.districtName || "—"}`,
    `Kademe: ${meta.levelLabel || "—"}`,
    `Rapor Tarihi: ${new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}`,
  ].forEach((ln) => { doc.text(ln, marginX, y); y += 14; });
  y += 2;
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(1.1);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.5);
  y += 20;

  if (meta.isAll) {
    const ok = sections.filter((s) => s.data);
    font(12.5, true, 20);
    doc.text("Genel Özet", marginX, y);
    y += 8;
    summaryTable([
      ["Kademe Bazlı Katılım Toplamı", String(ok.reduce((n, s) => n + (s.data.participating_school_count || 0), 0))],
      ["Kademe Bazlı Hedef Toplamı", String(ok.reduce((n, s) => n + (s.data.targets || []).length, 0))],
    ]);
    paragraph("Kademe sonuçlarının toplamıdır; tekil okul sayısı değildir.", 8.5, 110);
    if (sections.some((s) => s.error)) paragraph("Eksik veri: Bazı kademelerin ASP analizi yüklenemedi; toplamlar yalnız yüklenen kademeleri içerir.", 9, 150);
  }

  sections.forEach((s) => {
    if (meta.isAll) { doc.addPage(); y = 50; }
    font(13, true, 20);
    ensure(40);
    doc.text(s.levelName || "—", marginX, y);
    y += 8;
    if (s.error) { y += 8; paragraph(s.error, 9.5, 150); return; }
    const targets = s.data.targets || [];
    summaryTable([
      ["Katılan Okul Sayısı", String(s.data.participating_school_count ?? 0)],
      ["Hedef Sayısı", String(targets.length)],
    ]);
    if (!s.data.participating_school_count) { paragraph("Bu kademede henüz gönderim bulunmuyor.", 9.5, 90); return; }
    barChart(targets, `${meta.yearName || "—"} · ${s.levelName || "—"} · ${meta.districtName || "—"}`);
    ensure(40);
    font(10.5, true, 20);
    doc.text("Tüm Hedefler", marginX, y);
    y += 8;
    targetTable(targets);
  });

  y += 4;
  ensure(60);
  font(10.5, true, 20);
  doc.text("Değerlendirme Notu", marginX, y);
  y += 14;
  [
    ...(meta.note ? [`• ${meta.note}`] : []),
    "• Her okulun en son RAM gönderimi esas alınır; ortalama, geçerli okul ASP değerlerinin doğrudan aritmetik ortalamasıdır.",
    "• Hesaplanamayan (NULL) ASP değerleri ortalamaya katılmaz ve 0 sayılmaz; bu hedefler sıralanmaz.",
    "• Değerler sistemdeki istatistiklerle aynıdır; rapor oluşturulurken yeniden hesaplanmaz.",
  ].forEach((n) => paragraph(n, 9, 70));

  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    font(8, false, 130);
    doc.text("PDRPUSULA · RİBA İlçe Ortalama ASP Analizi", marginX, pageH - 18);
    doc.text(`Sayfa ${pg} / ${total}`, pageW - marginX, pageH - 18, { align: "right" });
  }

  const parts = ["RIBA_Ortalama_ASP_Analizi", fileSlug(meta.yearName), fileSlug(meta.districtName), fileSlug(meta.levelLabel)];
  doc.save(`${parts.filter(Boolean).join("_")}.pdf`);
}
