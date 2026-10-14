// RİBA Özel Hedef İstatistikleri PDF (jspdf + autotable + embedded Roboto, same as ramAggregatePdf.js).
// Data comes only from the already-authorized on-screen responses; nothing is recomputed.

const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
const fileSlug = (s) => String(s || "")
  .replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => TR_MAP[m])
  .replace(/[^a-zA-Z0-9-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 60);

export const topTargets = (items) => [...(items || [])]
  .sort((a, b) => (b.school_count - a.school_count) || String(a.meb_code || "").localeCompare(String(b.meb_code || ""), "tr"))
  .slice(0, 10);

const EMERALD = [16, 185, 129];
const PCT_NOTE = "Her okul iki özel hedef seçebildiği için yüzdelerin toplamı %100'ü aşabilir.";

// sections: [{ levelName, data, error }]; meta: { ramName, yearName, districtName, levelLabel, isAll }
export async function generateRamRibaSpecialTargetsPdf(sections, meta) {
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

  const barChart = (items, context) => {
    const labelW = 200;
    const valueW = 80;
    const barX = marginX + labelW + 10;
    const barW = contentW - labelW - valueW - 20;
    ensure(60);
    font(10.5, true, 20);
    doc.text("En Çok Seçilen Özel Hedefler (İlk 10)", marginX, y);
    y += 13;
    font(8.5, false, 110);
    doc.text(context, marginX, y);
    y += 14;
    topTargets(items).forEach((t) => {
      font(8.5, false, 40);
      const lines = doc.splitTextToSize(`${t.meb_code || "—"} – ${t.target_name || "—"}`, labelW);
      const rowH = Math.max(lines.length * 10.5, 12) + 6;
      ensure(rowH);
      doc.text(lines, marginX, y + 8);
      const midY = y + rowH / 2 - 4;
      doc.setFillColor(232, 236, 241);
      doc.rect(barX, midY, barW, 8, "F");
      const pct = Math.min(100, Math.max(0, Number(t.percentage) || 0));
      if (pct > 0) { doc.setFillColor(...EMERALD); doc.rect(barX, midY, (barW * pct) / 100, 8, "F"); }
      doc.text(`${t.school_count} okul · %${Number(t.percentage).toFixed(1)}`, pageW - marginX, midY + 7, { align: "right" });
      y += rowH;
    });
    ensure(14);
    font(7, false, 130);
    [0, 25, 50, 75, 100].forEach((v) => doc.text(`%${v}`, barX + (barW * v) / 100, y + 6, { align: "center" }));
    y += 20;
  };

  const targetTable = (items) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 46 },
      head: [["Sıra", "MEB Kodu", "Hedef", "Seçen Okul", "Seçilme Yüzdesi"]],
      body: (items || []).map((t) => [String(t.rank ?? "—"), t.meb_code || "—", t.target_name || "—", String(t.school_count), `%${Number(t.percentage).toFixed(1)}`]),
      styles: tableStyles,
      headStyles: { font: "Roboto", fontStyle: "bold", fillColor: EMERALD, textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { cellWidth: 36, halign: "center" }, 1: { cellWidth: 62 }, 2: { cellWidth: "auto" }, 3: { cellWidth: 66, halign: "right" }, 4: { cellWidth: 86, halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 18;
  };

  // ---- Header ----
  font(16, true, 30);
  doc.text("PDRPUSULA", marginX, y);
  y += 19;
  font(12.5, true, 20);
  doc.text("RİBA Özel Hedef İstatistikleri Raporu", marginX, y);
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
      ["Kademe Bazlı Toplam Özel Hedef Seçimi", String(ok.reduce((n, s) => n + (s.data.total_selections || 0), 0))],
    ]);
    paragraph("Kademe sonuçlarının toplamıdır; tekil okul sayısı değildir.", 8.5, 110);
    if (sections.some((s) => s.error)) paragraph("Eksik veri: Bazı kademelerin istatistikleri yüklenemedi; genel toplam yalnız yüklenen kademeleri içerir.", 9, 150);
  }

  sections.forEach((s) => {
    if (meta.isAll) { doc.addPage(); y = 50; }
    font(13, true, 20);
    ensure(40);
    doc.text(s.levelName || "—", marginX, y);
    y += 8;
    if (s.error) { y += 8; paragraph(s.error, 9.5, 150); return; }
    summaryTable([
      ["Katılan Okul Sayısı", String(s.data.participating_school_count ?? 0)],
      ["Toplam Özel Hedef Seçimi", String(s.data.total_selections ?? 0)],
    ]);
    if (!s.data.participating_school_count) { paragraph("Bu kademede henüz gönderim bulunmuyor.", 9.5, 90); return; }
    barChart(s.data.items, `${meta.yearName || "—"} · ${s.levelName || "—"} · ${meta.districtName || "—"}`);
    ensure(40);
    font(10.5, true, 20);
    doc.text("Tüm Seçilen Hedefler", marginX, y);
    y += 8;
    targetTable(s.data.items);
  });

  y += 4;
  ensure(60);
  font(10.5, true, 20);
  doc.text("Değerlendirme Notu", marginX, y);
  y += 14;
  [
    "• Rapor, RAM'ın sorumluluk alanındaki okulların RAM'a gönderdiği RİBA kayıtlarından oluşturulur; her okulun en son gönderimi esas alınır.",
    `• ${PCT_NOTE}`,
    "• Değerler sistemdeki istatistiklerle aynıdır; rapor oluşturulurken yeniden hesaplanmaz.",
  ].forEach((n) => paragraph(n, 9, 70));

  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    font(8, false, 130);
    doc.text("PDRPUSULA · RİBA Özel Hedef İstatistikleri", marginX, pageH - 18);
    doc.text(`Sayfa ${pg} / ${total}`, pageW - marginX, pageH - 18, { align: "right" });
  }

  const parts = ["RIBA_Ozel_Hedef_Istatistikleri", fileSlug(meta.yearName), fileSlug(meta.districtName), fileSlug(meta.levelLabel)];
  doc.save(`${parts.filter(Boolean).join("_")}.pdf`);
}
