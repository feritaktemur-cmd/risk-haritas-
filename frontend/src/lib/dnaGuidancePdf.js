// DNA bireysel değerlendirme PDF'i (tek sayfa A4 hedefli). Veri yalnızca görüntülenen ayrıntı yanıtıdır.
import {
  DNA_GUIDANCE_TEXTS, DNA_GUIDANCE_DISCLAIMER, DNA_GUIDANCE_ALL_ZERO,
  DNA_ATTENTION_TITLE, DNA_ATTENTION_NOTE, computeDnaGuidance,
} from "./dnaGuidance";

const fmtAvg = (v) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ANSWER = { 2: "Evet", 1: "Bazen" };
const slug = (s) => String(s || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

async function loadRoboto(doc) {
  const buf = await (await fetch(`${process.env.PUBLIC_URL || ""}/fonts/Roboto-Regular.ttf`)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  doc.addFileToVFS("Roboto-Regular.ttf", btoa(bin));
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
}

export async function generateDnaGuidancePdf(data) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  await loadRoboto(doc);
  const r = data.response;
  const g = computeDnaGuidance(data.dimensions);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const X = 36;
  const TW = W - 2 * X;
  const FOOTER = 96;
  let y = 40;
  const ensure = (h) => { if (y + h > H - FOOTER) { doc.addPage(); y = 40; } };
  const text = (s, { size = 9, bold = false, color = 30, indent = 0, gap = 2 } = {}) => {
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(s, TW - indent);
    ensure(lines.length * size * 1.25);
    doc.text(lines, X + indent, y + size);
    y += lines.length * size * 1.25 + gap;
  };
  const heading = (s) => { y += 6; ensure(30); text(s, { size: 10.5, bold: true, color: 15, gap: 3 }); };

  text("PDRPUSULA — Devamsızlık Nedenleri Anketi (DNA)", { size: 8, color: 110 });
  text("Bireysel Değerlendirme ve Rehberlik Önerileri", { size: 14, bold: true, color: 10, gap: 4 });
  text("GİZLİDİR — Yalnızca okul rehberlik servisi kullanımı içindir.", { size: 8.5, bold: true, color: 150, gap: 6 });

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "Roboto", fontSize: 8.5, cellPadding: 3, textColor: 30 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 2: { fontStyle: "bold", cellWidth: 90 } },
    body: [
      ["Ad Soyad", `${r.first_name} ${r.last_name}`, "Okul No", r.student_number],
      ["Sınıf", r.class_label, "Yanıt Tarihi", new Date(r.submitted_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })],
      ["Uygulama", data.application?.name || "—", "Toplam Puan", `${r.total_score} / ${r.max_total_score}`],
    ],
    margin: { left: X, right: X },
  });
  y = doc.lastAutoTable.finalY + 6;

  heading("Boyut Ortalamaları (madde başına, 0–2)");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2.5, textColor: 30 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: "bold" },
    head: [["Boyut", "Puan", "Madde", "Ortalama"]],
    body: g.averages.map((a, i) => [`${a.dimension_no}. ${a.name}`, `${data.dimensions[i].score} / ${data.dimensions[i].max_score}`, String(data.dimensions[i].items.length), fmtAvg(a.average)]),
    columnStyles: { 1: { halign: "center", cellWidth: 70 }, 2: { halign: "center", cellWidth: 50 }, 3: { halign: "center", cellWidth: 60 } },
    margin: { left: X, right: X },
  });
  y = doc.lastAutoTable.finalY + 3;
  text("Bu ortalamalar bireysel göstergedir, resmî grup ortalaması değildir.", { size: 7.5, color: 110 });

  heading("Öne Çıkan Boyutlar ve Rehberlik Önerileri");
  if (g.allZero) text(DNA_GUIDANCE_ALL_ZERO);
  g.highlighted.forEach((a) => {
    text(`${a.dimension_no}. ${a.name} (ortalama ${fmtAvg(a.average)})`, { size: 9.5, bold: true, color: 20, gap: 1 });
    text(`Değerlendirme: ${DNA_GUIDANCE_TEXTS[a.dimension_no].assessment}`, { indent: 8, gap: 1 });
    text(`Öneri: ${DNA_GUIDANCE_TEXTS[a.dimension_no].advice}`, { indent: 8, gap: 5 });
  });

  if (g.attention.length) {
    heading(DNA_ATTENTION_TITLE);
    text(DNA_ATTENTION_NOTE, { size: 8, color: 90 });
    g.attention.forEach((i) => text(`${i.item_no}. ${i.text} — ${ANSWER[i.value]}`, { indent: 8, gap: 1 }));
  }

  heading(`52. ${r.open_text_prompt || "Açık uçlu soru"}`);
  text(r.open_text || "Öğrenci bu soruyu boş bıraktı.", { color: r.open_text ? 30 : 120 });

  y += 4;
  text(DNA_GUIDANCE_DISCLAIMER, { size: 7.5, color: 100 });

  const pages = doc.getNumberOfPages();
  doc.setPage(pages);
  const fy = H - FOOTER + 22;
  doc.setDrawColor(160);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40);
  [["Görüşmeyi Yapan", X], ["Tarih", X + TW * 0.45], ["İmza", X + TW * 0.72]].forEach(([label, fx], idx) => {
    doc.text(label, fx, fy);
    const end = idx === 0 ? X + TW * 0.4 : idx === 1 ? X + TW * 0.67 : X + TW;
    doc.line(fx, fy + 26, end, fy + 26);
  });
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(`Gizlidir — yalnızca okul rehberlik servisi kullanımı içindir. · Oluşturma: ${new Date().toLocaleString("tr-TR")} · Sayfa ${p}/${pages}`, X, H - 22);
  }
  doc.save(`DNA_Degerlendirme_${slug(r.student_number)}_${slug(r.class_label)}.pdf`);
  return pages;
}
