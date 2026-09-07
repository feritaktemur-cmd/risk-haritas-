// RAM Çalışmaları PDF report generator.
// Reuses the proven jspdf + jspdf-autotable + embedded Roboto TTF approach so
// Turkish characters (Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü) render correctly.
// The numbers come from the backend /api/ram/activities/report (single source
// of truth), never recomputed here.

const TARGET_LABELS = {
  genel_hedef: "Genel Hedef",
  yerel_hedef: "Yerel Hedef",
  ozel_hedef: "Özel Hedef",
  hedef_disi: "Hedef Dışı",
};

const fmtTrDate = (iso) => {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}.${m}.${y}`;
};

export async function generateRamReportPdf(report) {
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
  const contentW = pageW - marginX * 2;

  const stats = report.statistics || {};
  const summary = stats.summary || { activities_count: 0, student_count: 0, teacher_count: 0, parent_count: 0, total_participants: 0 };
  const detailed = report.report_type === "detailed";
  const ramName = report.ram_name || "";
  const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  // Report period text.
  const p = report.period || {};
  let periodText;
  if (p.date_from || p.date_to) {
    const from = p.date_from ? fmtTrDate(p.date_from) : "…";
    const to = p.date_to ? fmtTrDate(p.date_to) : "…";
    periodText = `Rapor Dönemi: ${from} – ${to}`;
  } else if (p.first_date && p.last_date) {
    periodText = `Rapor Dönemi: Tüm Kayıtlar (${fmtTrDate(p.first_date)} – ${fmtTrDate(p.last_date)})`;
  } else {
    periodText = "Rapor Dönemi: Tüm Kayıtlar";
  }

  // ---- Header ----
  let y = 46;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(17);
  doc.setTextColor(30, 41, 59);
  doc.text("PDRPUSULA", marginX, y);
  y += 20;
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("RAM Çalışmaları Raporu", marginX, y);
  y += 19;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70);
  if (ramName) { doc.text(ramName, marginX, y); y += 15; }
  doc.text(periodText, marginX, y); y += 15;
  doc.text(`Rapor Türü: ${detailed ? "Ayrıntılı" : "Özet"}`, marginX, y);
  doc.setTextColor(0);
  y += 8;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.5);
  y += 22;

  // ---- Summary cards ----
  const drawCards = (startY, cards) => {
    const gap = 8;
    const n = cards.length;
    const cardW = (contentW - gap * (n - 1)) / n;
    const cardH = 44;
    cards.forEach((c, i) => {
      const cx = marginX + i * (cardW + gap);
      doc.setDrawColor(220);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(cx, startY, cardW, cardH, 4, 4, "FD");
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7);
      doc.setTextColor(110);
      doc.text(c[0], cx + 7, startY + 15);
      doc.setFont("Roboto", "bold");
      doc.setFontSize(15);
      doc.setTextColor(20);
      doc.text(String(c[1]), cx + 7, startY + 35);
    });
    doc.setTextColor(0);
    return startY + cardH;
  };

  const sectionTitle = (startY, title) => {
    let ny = startY;
    if (ny + 70 > pageH - 45) { doc.addPage(); ny = 50; }
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(20);
    doc.text(title, marginX, ny);
    doc.setTextColor(0);
    return ny + 8;
  };

  const metricTable = (startY, firstCol, rows, nameKey) => {
    const body = (rows || []).map((r) => [
      r[nameKey] || "—",
      String(r.activities_count),
      String(r.student_count),
      String(r.teacher_count),
      String(r.parent_count),
      String(r.total_participants),
    ]);
    autoTable(doc, {
      startY: startY + 6,
      margin: { left: marginX, right: marginX, bottom: 40 },
      head: [[firstCol, "Çalışma", "Öğrenci", "Öğretmen", "Veli", "Toplam"]],
      body: body.length ? body : [["Kayıt yok", "", "", "", "", ""]],
      styles: { font: "Roboto", fontStyle: "normal", fontSize: 9, cellPadding: 3, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 54, halign: "right" },
        2: { cellWidth: 54, halign: "right" },
        3: { cellWidth: 60, halign: "right" },
        4: { cellWidth: 48, halign: "right" },
        5: { cellWidth: 54, halign: "right" },
      },
    });
    return doc.lastAutoTable.finalY;
  };

  // ---- Genel Özet ----
  y = drawCards(y, [
    ["Toplam Çalışma", summary.activities_count],
    ["Öğrenci", summary.student_count],
    ["Öğretmen", summary.teacher_count],
    ["Veli", summary.parent_count],
    ["Toplam Katılımcı", summary.total_participants],
  ]);
  y += 22;

  // ---- Hedef Türlerine Göre Dağılım ----
  y = sectionTitle(y, "Hedef Türlerine Göre Dağılım");
  y = metricTable(y, "Hedef Türü", (stats.target_types || []).map((t) => ({ ...t, label: TARGET_LABELS[t.target_type] || t.target_type })), "label");
  y += 22;

  // ---- Aylara Göre Dağılım ----
  y = sectionTitle(y, "Aylara Göre Dağılım");
  y = metricTable(y, "Ay / Yıl", stats.monthly || [], "label");
  y += 22;

  // ---- Konu / Çalışma Başlıkları ----
  y = sectionTitle(y, "Konu / Çalışma Başlıkları");
  y = metricTable(y, "Konu / Çalışma Başlığı", stats.titles || [], "title");
  y += 22;

  // ---- Çalışma Türleri ----
  y = sectionTitle(y, "Çalışma Türleri");
  y = metricTable(y, "Çalışma Türü", stats.activity_types || [], "activity_type");
  y += 22;

  // ---- İlçelere Göre Dağılım ----
  y = sectionTitle(y, "İlçelere Göre Dağılım");
  y = metricTable(y, "İlçe", stats.districts || [], "district_name");
  y += 22;

  // ---- Okul/Kurum Bazlı Dağılım ----
  y = sectionTitle(y, "Okul/Kurum Bazlı Dağılım");
  y = metricTable(y, "Okul/Kurum", stats.institutions || [], "institution_name");
  y += 22;

  // ---- Ayrıntılı: Çalışma Kayıtları ----
  if (detailed) {
    y = sectionTitle(y, "Çalışma Kayıtları");
    const body = (report.activities || []).map((a) => [
      fmtTrDate(a.activity_date),
      a.district_name || "—",
      a.institution_name || "—",
      a.activity_type || "—",
      a.title || "—",
      TARGET_LABELS[a.target_type] || a.target_type || "—",
      String(a.student_count),
      String(a.teacher_count),
      String(a.parent_count),
      String(a.total_participants),
      a.note || "",
    ]);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX, bottom: 40 },
      head: [["Tarih", "İlçe", "Okul/Kurum", "Tür", "Konu", "Hedef", "Öğr.", "Öğrt.", "Veli", "Top.", "Not"]],
      body: body.length ? body : [["Kayıt yok", "", "", "", "", "", "", "", "", "", ""]],
      styles: { font: "Roboto", fontStyle: "normal", fontSize: 7, cellPadding: 2.5, overflow: "linebreak", valign: "top", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [16, 185, 129], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 48 },
        2: { cellWidth: 66 },
        3: { cellWidth: 52 },
        4: { cellWidth: 74 },
        5: { cellWidth: 44 },
        6: { cellWidth: 26, halign: "right" },
        7: { cellWidth: 28, halign: "right" },
        8: { cellWidth: 26, halign: "right" },
        9: { cellWidth: 28, halign: "right" },
        10: { cellWidth: "auto" },
      },
    });
    y = doc.lastAutoTable.finalY;
  }

  // ---- Footer + page numbers ----
  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("PDRPUSULA · RAM Çalışmaları", marginX, pageH - 20);
    doc.text(`Rapor tarihi: ${generatedAt}`, pageW / 2, pageH - 20, { align: "center" });
    doc.text(`Sayfa ${pg} / ${total}`, pageW - marginX, pageH - 20, { align: "right" });
  }
  doc.setTextColor(0);

  // ---- File name ----
  let fname = "PDRPUSULA_RAM_Calismalari_Raporu";
  if (p.date_from || p.date_to) {
    const a = (p.date_from || "baslangic").slice(0, 10);
    const b = (p.date_to || "bitis").slice(0, 10);
    fname += `_${a}_${b}`;
  }
  doc.save(`${fname}.pdf`);
}
