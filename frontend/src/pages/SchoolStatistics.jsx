import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, Info, ChevronDown, FileDown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
      <Icon size={14} className={tone} /> {label}
    </div>
    <p className="mt-1.5 text-2xl font-extrabold text-white">{value}</p>
  </div>
);

const fmtPct = (n) => String(n).replace(".", ",");

const DomainBar = ({ name, count, percentage }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid="schoolstats-domain-row">
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-sm text-slate-200">{name}</span>
      <span className="shrink-0 text-xs font-semibold text-slate-300">%{fmtPct(percentage)} · {count} öğrenci</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: `${Math.min(100, percentage)}%` }} />
    </div>
  </div>
);

const CompareBar = ({ name, mine, peer }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid="schoolstats-compare-row">
    <p className="mb-2 text-sm font-medium text-slate-200">{name}</p>
    <div className="space-y-2">
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold text-emerald-300">Okulum</span>
          <span className="shrink-0 text-xs font-semibold text-slate-300">%{fmtPct(mine)}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, mine)}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold text-indigo-300">Aynı Kademedeki Diğer Okullar</span>
          <span className="shrink-0 text-xs font-semibold text-slate-300">%{fmtPct(peer)}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, peer)}%` }} />
        </div>
      </div>
    </div>
  </div>
);

export default function SchoolStatistics() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const [howCatOpen, setHowCatOpen] = useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [classData, setClassData] = useState(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState(null);
  const [howClassOpen, setHowClassOpen] = useState(false);

  const [peer, setPeer] = useState(null);
  const [howPeerOpen, setHowPeerOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/school/risk-map/school`, { headers: h });
      setData(res.data);
      try {
        const initRes = await axios.get(`${API}/school/risk/init`, { headers: h });
        setClasses(initRes.data.classes || []);
      } catch (_) { /* class list is secondary; ignore its failure */ }
      try {
        const peerRes = await axios.get(`${API}/school/risk-map/peer-comparison`, { headers: h });
        setPeer(peerRes.data);
      } catch (_) { /* peer comparison is secondary; ignore its failure */ }
      return res.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
      } else if (err.response?.status === 409) {
        setError(detail || "Aktif eğitim yılı belirlenemedi.");
      } else {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
      }
      return null;
    }
  }, [navigate]);

  const loadClass = useCallback(async (cid) => {
    setClassData(null);
    setClassError(null);
    if (!cid) return;
    setClassLoading(true);
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return; }
    try {
      const res = await axios.get(`${API}/school/risk-map/class`, { headers: h, params: { school_class_id: cid } });
      setClassData(res.data);
    } catch (err) {
      setClassError(err.response?.data?.detail || "Sınıf analizi yüklenemedi.");
    }
    setClassLoading(false);
  }, [navigate]);

  const onClassChange = (cid) => {
    setClassId(cid);
    loadClass(cid);
  };

  const downloadPdf = async () => {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      // Turkish-capable TTF embed (same proven method as AdminTracking).
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
      const yearName = data.academic_year || "";
      const schoolName = data.school_name || "";
      const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

      // ---- Header (page 1) ----
      let y = 46;
      doc.setFont("Roboto", "bold");
      doc.setFontSize(17);
      doc.setTextColor(30, 41, 59);
      doc.text("PDRPUSULA", marginX, y);
      y += 20;
      doc.setFontSize(13);
      doc.setTextColor(20);
      doc.text("Risk Haritası İstatistik Raporu", marginX, y);
      y += 20;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(11);
      doc.setTextColor(70);
      if (schoolName) { doc.text(schoolName, marginX, y); y += 15; }
      doc.text(`${yearName} Eğitim Öğretim Yılı`, marginX, y);
      doc.setTextColor(0);
      y += 8;
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1.2);
      doc.line(marginX, y, pageW - marginX, y);
      doc.setLineWidth(0.5);
      y += 20;

      // ---- Cards helper ----
      const drawCards = (startY, cards) => {
        const gap = 8;
        const cardW = (contentW - gap * 3) / 4;
        const cardH = 42;
        cards.forEach((c, i) => {
          const cx = marginX + i * (cardW + gap);
          doc.setDrawColor(220);
          doc.setFillColor(245, 247, 250);
          doc.roundedRect(cx, startY, cardW, cardH, 4, 4, "FD");
          doc.setFont("Roboto", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(110);
          doc.text(c[0], cx + 8, startY + 15);
          doc.setFont("Roboto", "bold");
          doc.setFontSize(15);
          doc.setTextColor(20);
          doc.text(String(c[1]), cx + 8, startY + 34);
        });
        doc.setTextColor(0);
        return startY + cardH;
      };

      // ---- Section title with page-break guard ----
      const sectionTitle = (startY, title) => {
        let ny = startY;
        if (ny + 60 > pageH - 45) { doc.addPage(); ny = 50; }
        doc.setFont("Roboto", "bold");
        doc.setFontSize(12.5);
        doc.setTextColor(20);
        doc.text(title, marginX, ny);
        doc.setTextColor(0);
        return ny + 8;
      };

      // ---- Single-metric bar table ----
      const barTable = (startY, rows) => {
        const body = rows.map((r, i) => [String(i + 1), r.name, String(r.count), `%${fmtPct(r.percentage)}`, r.percentage]);
        autoTable(doc, {
          startY: startY + 6,
          margin: { left: marginX, right: marginX, bottom: 40 },
          head: [["#", "Risk Alanı / Maddesi", "Öğrenci", "Oran", "Grafik"]],
          body,
          styles: { font: "Roboto", fontStyle: "normal", fontSize: 9, cellPadding: 3, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
          headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
          alternateRowStyles: { fillColor: [247, 249, 252] },
          columnStyles: {
            0: { cellWidth: 22, halign: "right" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 52, halign: "right" },
            3: { cellWidth: 46, halign: "right" },
            4: { cellWidth: 150 },
          },
          didParseCell: (d) => { if (d.column.index === 4) d.cell.text = [""]; },
          didDrawCell: (d) => {
            if (d.section === "body" && d.column.index === 4) {
              const pctVal = d.row.raw[4] || 0;
              const pad = 4;
              const bx = d.cell.x + pad, bw = d.cell.width - pad * 2, bh = 6;
              const by = d.cell.y + (d.cell.height - bh) / 2;
              doc.setFillColor(230, 232, 236);
              doc.roundedRect(bx, by, bw, bh, 2, 2, "F");
              const fw = Math.max(0, Math.min(1, pctVal / 100)) * bw;
              if (fw > 0) { doc.setFillColor(16, 185, 129); doc.roundedRect(bx, by, fw, bh, 2, 2, "F"); }
            }
          },
        });
        return doc.lastAutoTable.finalY;
      };

      // ---- Two-metric comparison bar table ----
      const compareTable = (startY, rows) => {
        const body = rows.map((r, i) => [String(i + 1), r.name, `%${fmtPct(r.mine)}`, `%${fmtPct(r.peer)}`, [r.mine, r.peer]]);
        autoTable(doc, {
          startY: startY + 6,
          margin: { left: marginX, right: marginX, bottom: 40 },
          head: [["#", "Ana Risk Alanı", "Okulum", "Diğer Okullar", "Grafik"]],
          body,
          styles: { font: "Roboto", fontStyle: "normal", fontSize: 9, cellPadding: 3, overflow: "linebreak", valign: "middle", textColor: 40, lineColor: [225, 225, 225], lineWidth: 0.5 },
          headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
          alternateRowStyles: { fillColor: [247, 249, 252] },
          columnStyles: {
            0: { cellWidth: 22, halign: "right" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 55, halign: "right" },
            3: { cellWidth: 78, halign: "right" },
            4: { cellWidth: 150 },
          },
          didParseCell: (d) => { if (d.column.index === 4) d.cell.text = [""]; },
          didDrawCell: (d) => {
            if (d.section === "body" && d.column.index === 4) {
              const [mine, peerVal] = d.row.raw[4] || [0, 0];
              const pad = 4;
              const bx = d.cell.x + pad, bw = d.cell.width - pad * 2, bh = 5;
              const y1 = d.cell.y + d.cell.height / 2 - bh - 1;
              const y2 = d.cell.y + d.cell.height / 2 + 1;
              doc.setFillColor(230, 232, 236);
              doc.roundedRect(bx, y1, bw, bh, 2, 2, "F");
              doc.roundedRect(bx, y2, bw, bh, 2, 2, "F");
              const fwMine = Math.max(0, Math.min(1, mine / 100)) * bw;
              const fwPeer = Math.max(0, Math.min(1, peerVal / 100)) * bw;
              if (fwMine > 0) { doc.setFillColor(16, 185, 129); doc.roundedRect(bx, y1, fwMine, bh, 2, 2, "F"); }
              if (fwPeer > 0) { doc.setFillColor(79, 70, 229); doc.roundedRect(bx, y2, fwPeer, bh, 2, 2, "F"); }
            }
          },
        });
        return doc.lastAutoTable.finalY;
      };

      // ---- Genel Özet ----
      y = drawCards(y, [
        ["Toplam Öğrenci", data.summary.total_students],
        ["Formu Tamamlanan", data.summary.completed],
        ["Formu Tamamlanmayan", data.summary.not_entered],
        ["Tamamlanma Oranı", `%${fmtPct(data.summary.completion_rate)}`],
      ]);
      y += 22;

      // ---- 8 Ana Risk Alanı ----
      const domainRows = [...(data.domains || [])]
        .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
        .map((d) => ({ name: d.name, count: d.student_count, percentage: d.percentage }));
      y = sectionTitle(y, "8 Ana Risk Alanının Dağılımı");
      y = barTable(y, domainRows);
      y += 22;

      // ---- 36 Risk Maddesi ----
      const catRows = [...(data.categories || [])]
        .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
        .map((c) => ({ name: c.label, count: c.student_count, percentage: c.percentage }));
      y = sectionTitle(y, "36 Risk Maddesinin Dağılımı");
      y = barTable(y, catRows);
      y += 22;

      // ---- Seçili sınıf (yalnız classData varsa) ----
      if (classData) {
        y = sectionTitle(y, `Sınıf Bazlı Risk Maddeleri — ${classData.class_label}`);
        y = drawCards(y + 4, [
          ["Toplam Öğrenci", classData.summary.total_students],
          ["Formu Tamamlanan", classData.summary.completed],
          ["Formu Tamamlanmayan", classData.summary.not_entered],
          ["Tamamlanma Oranı", `%${fmtPct(classData.summary.completion_rate)}`],
        ]);
        y += 14;
        const classCatRows = [...(classData.categories || [])]
          .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
          .map((c) => ({ name: c.label, count: c.student_count, percentage: c.percentage }));
        y = barTable(y, classCatRows);
        y += 22;
      }

      // ---- Peer karşılaştırma ----
      if (peer) {
        y = sectionTitle(y, "Aynı Kademedeki Okullarla Karşılaştırma");
        if (peer.eligible) {
          doc.setFont("Roboto", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(70);
          doc.text(`${peer.education_level} · ${peer.schools_count} diğer okul · ${(peer.total_completed || 0).toLocaleString("tr-TR")} tamamlanmış form`, marginX, y + 14);
          doc.setTextColor(0);
          y += 20;
          const myPct = {};
          (data.domains || []).forEach((d) => { myPct[d.risk_domain_id] = d.percentage; });
          const peerRows = [...(peer.domains || [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((d) => ({ name: d.name, mine: myPct[d.risk_domain_id] ?? 0, peer: d.percentage }));
          y = compareTable(y, peerRows);
        } else {
          doc.setFont("Roboto", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(90);
          const note = "Karşılaştırma için yeterli sayıda okul verisi bulunmuyor. Bu bölüm, aynı kademede RAM'a gönderim yapan en az 3 diğer okul bulunduğunda oluşturulur.";
          const lines = doc.splitTextToSize(note, contentW);
          doc.text(lines, marginX, y + 14);
          doc.setTextColor(0);
          y += 14 + lines.length * 13;
        }
        y += 22;
      }

      // ---- Hesaplama ve Yorumlama Notları ----
      const notes = [
        "Risk oranlarının paydasında yalnızca Risk Haritası formu tamamlanan öğrenciler bulunur; tamamlanmayan öğrenciler dahil edilmez.",
        "Aynı öğrenci, bir ana risk alanında birden fazla maddeye sahip olsa bile o alanda yalnızca bir kez sayılır.",
        "36 risk maddesinin her biri ayrı değerlendirilir; bir öğrenci farklı maddelerde ayrı ayrı sayılabilir, ancak aynı maddede yalnızca bir kez sayılır.",
        "Risk alanları ve risk maddeleri birbirinden bağımsız olduğundan yüzdelerin toplamının %100 olması beklenmez.",
        "Okul ve sınıf istatistikleri mevcut canlı verilere dayanır.",
        "Karşılaştırma grubu, aynı kademedeki diğer okulların RAM'a gönderdikleri en güncel snapshot sonuçlarından oluşturulur.",
        "Karşılaştırmada okul yüzdelerinin basit ortalaması alınmaz; ilgili risk alanındaki toplam öğrenci sayısı, toplam tamamlanmış form sayısına bölünür.",
        "Okulun kendisi karşılaştırma (referans) grubuna dahil edilmez.",
        "Sonuçlar tanı koymaz veya öğrencilerin risk düzeyini derecelendirmez; rehberlik çalışmalarının planlanmasını destekleyen göstergelerdir.",
      ];
      y = sectionTitle(y, "Hesaplama ve Yorumlama Notları");
      y += 8;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60);
      notes.forEach((n) => {
        const lines = doc.splitTextToSize(`•  ${n}`, contentW);
        if (y + lines.length * 12 > pageH - 45) { doc.addPage(); y = 50; }
        doc.text(lines, marginX, y);
        y += lines.length * 12 + 4;
      });
      doc.setTextColor(0);

      // ---- Footer + page numbers on every page ----
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFont("Roboto", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text("PDRPUSULA – Risk Haritası İstatistik Raporu", marginX, pageH - 20);
        doc.text(`Rapor tarihi: ${generatedAt}`, pageW / 2, pageH - 20, { align: "center" });
        doc.text(`Sayfa ${p} / ${total}`, pageW - marginX, pageH - 20, { align: "right" });
      }
      doc.setTextColor(0);

      const safeYear = String(yearName).replace(/[^0-9A-Za-z-]+/g, "-").replace(/^-+|-+$/g, "") || "rapor";
      doc.save(`PDRPUSULA_Risk_Haritasi_Istatistik_Raporu_${safeYear}.pdf`);
    } catch (_) {
      setPdfError("PDF raporu oluşturulamadı. Lütfen tekrar deneyin.");
    }
    setPdfBusy(false);
  };

  useEffect(() => {
    (async () => { await load(); setReady(true); })();
  }, [load]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="schoolstats-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/school/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="schoolstats-title">İstatistikler</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={!data || pdfBusy}
              data-testid="schoolstats-pdf-btn"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-300 ring-1 ring-indigo-400/30 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              {pdfBusy ? "Hazırlanıyor..." : "PDF Olarak İndir"}
            </button>
            <button onClick={() => navigate("/school")} data-testid="schoolstats-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <ArrowLeft size={15} /> Okul Paneli
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {pdfError && (
          <div data-testid="schoolstats-pdf-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{pdfError}</span>
          </div>
        )}
        {error ? (
          <div data-testid="schoolstats-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : data ? (
          <>
            <p className="text-sm text-slate-400">Aktif Eğitim Öğretim Yılı</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white" data-testid="schoolstats-year">
              {data.academic_year} Eğitim Öğretim Yılı
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="schoolstats-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="schoolstats-completed" />
              <StatCard icon={Circle} label="Formu Tamamlanmayan" value={data.summary.not_entered} tone="text-slate-500" testid="schoolstats-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="schoolstats-rate" />
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400" data-testid="schoolstats-context-note">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                Bu sayfadaki istatistikler mevcut öğrenci kayıtlarına göre canlı olarak hesaplanmaktadır. Risk oranlarının hesaplanmasında yalnızca formu tamamlanan öğrenciler esas alınır.
              </span>
            </div>

            {/* 8 Ana Risk Alanının Dağılımı */}
            <section className="mt-10" data-testid="schoolstats-domains-section">
              <h3 className="text-base font-bold text-white">8 Ana Risk Alanının Dağılımı</h3>

              <div className="mt-4 space-y-2.5" data-testid="schoolstats-domains">
                {[...(data.domains || [])]
                  .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                  .map((d) => (
                    <DomainBar key={d.risk_domain_id} name={d.name} count={d.student_count} percentage={d.percentage} />
                  ))}
              </div>

              {/* Bu grafik neyi gösterir? (varsayılan açık) */}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-domains-explain">
                <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                <div className="space-y-2 text-sm leading-relaxed text-slate-400">
                  <p>
                    Bu grafik, Risk Haritası formu tamamlanmış öğrenciler arasında, her bir ana risk alanında en az bir risk göstergesi bulunan öğrencilerin oranını ve öğrenci sayısını gösterir.
                  </p>
                  <p>
                    Risk alanları, okulda hangi alanlardaki risk göstergelerinin öğrenciler arasında daha yaygın olduğunu görebilmek amacıyla en yüksek orandan en düşük orana doğru sıralanır.
                  </p>
                  <p>
                    Grafikteki oranlar öğrencilerin tanılanması veya risk düzeylerinin derecelendirilmesi anlamına gelmez. Sonuçlar, okulun mevcut verileri üzerinden genel durumu görmeye ve rehberlik çalışmalarının planlanmasına yardımcı olan göstergelerdir.
                  </p>
                </div>
              </div>

              {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setHowOpen((v) => !v)}
                  data-testid="schoolstats-how-toggle"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                >
                  <span>Nasıl hesaplanıyor?</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howOpen ? "rotate-180" : ""}`} />
                </button>
                {howOpen && (
                  <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-how-content">
                    <p>
                      Hesaplamada yalnızca Risk Haritası formu tamamlanmış öğrenciler dikkate alınır. Formu henüz tamamlanmamış öğrenciler risk oranlarının hesaplanmasına dahil edilmez.
                    </p>
                    <p>
                      Bir öğrencinin aynı ana risk alanına ait birden fazla risk maddesi işaretlenmiş olabilir. Böyle bir durumda öğrenci o risk alanında yalnızca bir kez sayılır. Örneğin aynı öğrencide bir risk alanına ait 3 farklı madde işaretlenmişse bu durum "3 öğrenci" olarak değil, "1 öğrenci" olarak hesaplanır.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                      İlgili risk alanında en az bir risk göstergesi bulunan öğrenci sayısı ÷ Formu tamamlanan öğrenci sayısı × 100
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Örnek:</span> Okulda 120 öğrenci bulunuyor ve 100 öğrencinin Risk Haritası formu tamamlanmış olsun. Bu 100 öğrencinin 25'inde belirli bir risk alanına ait en az bir risk göstergesi varsa grafikte: %25 · 25 öğrenci gösterilir. Okuldaki diğer 20 öğrencinin formu henüz tamamlanmadığı için bu öğrenciler oranın paydasına dahil edilmez.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Önemli not:</span> Aynı öğrenci birden fazla ana risk alanında risk göstergesine sahip olabilir. Bu nedenle grafikteki 8 risk alanının yüzdeleri birbirinden bağımsızdır ve toplamlarının %100 olması beklenmez.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 36 Risk Maddesinin Dağılımı */}
            <section className="mt-10" data-testid="schoolstats-categories-section">
              <h3 className="text-base font-bold text-white">36 Risk Maddesinin Dağılımı</h3>

              <div className="mt-4 space-y-2.5" data-testid="schoolstats-categories">
                {[...(data.categories || [])]
                  .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                  .map((c) => (
                    <DomainBar key={c.risk_category_id} name={c.label} count={c.student_count} percentage={c.percentage} />
                  ))}
              </div>

              {/* Bu grafik neyi gösterir? (varsayılan açık) */}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-categories-explain">
                <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                <div className="space-y-2 text-sm leading-relaxed text-slate-400">
                  <p>
                    Bu grafik, Risk Haritası formu tamamlanan öğrenciler arasında 36 risk maddesinin her birinin kaç öğrencide görüldüğünü ve bu öğrencilerin tamamlanan formlar içindeki oranını gösterir. Maddeler en yaygın görülen risk göstergesinden en az görülene doğru sıralanarak okulda öne çıkan somut risklerin kolayca fark edilmesini sağlar.
                  </p>
                </div>
              </div>

              {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setHowCatOpen((v) => !v)}
                  data-testid="schoolstats-cat-how-toggle"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                >
                  <span>Nasıl hesaplanıyor?</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howCatOpen ? "rotate-180" : ""}`} />
                </button>
                {howCatOpen && (
                  <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-cat-how-content">
                    <p>
                      Her risk maddesi ayrı olarak değerlendirilir. Bir öğrenci, işaretlenmiş olan farklı risk maddelerinin her birinde ayrı ayrı sayılabilir. Ancak aynı öğrenci aynı risk maddesi için yalnızca bir kez sayılır. Hesaplamaya yalnızca Risk Haritası formu tamamlanmış öğrenciler dahil edilir.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                      İlgili risk maddesinin bulunduğu öğrenci sayısı ÷ Formu tamamlanan öğrenci sayısı × 100
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Önemli not:</span> 36 maddenin yüzdeleri birbirinden bağımsızdır. Aynı öğrencide birden fazla risk maddesi bulunabileceğinden yüzdelerin toplamının %100 olması beklenmez.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Sınıf Bazlı 36 Risk Maddesi */}
            <section className="mt-12 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-5" data-testid="schoolstats-class-section">
              <h3 className="text-base font-bold text-white">
                Sınıf Bazlı 36 Risk Maddesi
                {classData ? <span className="text-sm font-normal text-indigo-300"> — {classData.class_label} · Risk Maddelerinin Dağılımı</span> : null}
              </h3>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-400">Sınıf / Şube</label>
                <select
                  value={classId}
                  onChange={(e) => onClassChange(e.target.value)}
                  data-testid="schoolstats-class-select"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
                >
                  <option value="">Sınıf seçin</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.level}/{c.branch}</option>
                  ))}
                </select>
              </div>

              {classLoading ? (
                <div className="grid place-items-center py-12"><Loader2 size={24} className="animate-spin text-indigo-300" /></div>
              ) : classError ? (
                <div data-testid="schoolstats-class-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{classError}</span>
                </div>
              ) : !classData ? (
                <p className="mt-4 text-sm text-slate-400" data-testid="schoolstats-class-hint">
                  Sınıf bazlı risk maddesi dağılımını görüntülemek için yukarıdan bir sınıf/şube seçin.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={Users} label="Toplam Öğrenci" value={classData.summary.total_students} tone="text-slate-300" testid="schoolstats-class-total" />
                    <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={classData.summary.completed} tone="text-emerald-400" testid="schoolstats-class-completed" />
                    <StatCard icon={Circle} label="Formu Tamamlanmayan" value={classData.summary.not_entered} tone="text-slate-500" testid="schoolstats-class-not-entered" />
                    <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${classData.summary.completion_rate}`} tone="text-indigo-400" testid="schoolstats-class-rate" />
                  </div>

                  <div className="mt-5 space-y-2.5" data-testid="schoolstats-class-categories">
                    {[...(classData.categories || [])]
                      .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                      .map((c) => (
                        <DomainBar key={c.risk_category_id} name={c.label} count={c.student_count} percentage={c.percentage} />
                      ))}
                  </div>

                  {/* Bu grafik neyi gösterir? (varsayılan açık) */}
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-class-explain">
                    <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                    <p className="text-sm leading-relaxed text-slate-400">
                      Bu grafik, seçilen sınıfta Risk Haritası formu tamamlanan öğrenciler arasında 36 risk maddesinin görülme sıklığını gösterir. Maddeler en yaygın görülen risk göstergesinden en az görülene doğru sıralanır.
                    </p>
                  </div>

                  {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <button
                      onClick={() => setHowClassOpen((v) => !v)}
                      data-testid="schoolstats-class-how-toggle"
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                    >
                      <span>Nasıl hesaplanıyor?</span>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howClassOpen ? "rotate-180" : ""}`} />
                    </button>
                    {howClassOpen && (
                      <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-class-how-content">
                        <p>
                          Hesaplamada yalnızca seçilen sınıfta Risk Haritası formu tamamlanmış öğrenciler dikkate alınır. Her risk maddesi ayrı olarak değerlendirilir. Bir öğrenci farklı risk maddelerinin her birinde ayrı ayrı sayılabilir; ancak aynı öğrenci aynı risk maddesi için yalnızca bir kez sayılır.
                        </p>
                        <p>
                          <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                          Seçilen sınıfta ilgili risk maddesinin bulunduğu öğrenci sayısı ÷ Seçilen sınıfta formu tamamlanan öğrenci sayısı × 100
                        </p>
                        <p>
                          <span className="font-semibold text-slate-300">Önemli not:</span> Aynı öğrencide birden fazla risk maddesi bulunabileceğinden 36 maddenin yüzdelerinin toplamının %100 olması beklenmez.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Aynı Kademedeki Okullarla Karşılaştırma */}
            <section className="mt-12" data-testid="schoolstats-peer-section">
              <h3 className="text-base font-bold text-white">Aynı Kademedeki Okullarla Karşılaştırma</h3>

              {!peer ? (
                <p className="mt-4 text-sm text-slate-400" data-testid="schoolstats-peer-hint">
                  Karşılaştırma verisi şu anda yüklenemedi.
                </p>
              ) : !peer.eligible ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400" data-testid="schoolstats-peer-insufficient">
                  <Info size={16} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    {peer.education_level ? `${peer.education_level} kademesinde ` : ""}
                    karşılaştırma için yeterli sayıda okul verisi bulunmuyor. Aynı kademede RAM'a gönderim yapan en az {peer.min_schools || 3} diğer okul olduğunda bu bölüm gösterilecektir.
                  </span>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-indigo-300" data-testid="schoolstats-peer-context">
                    {peer.education_level} · {peer.schools_count} diğer okul · {peer.total_completed.toLocaleString("tr-TR")} tamamlanmış form
                  </p>

                  <div className="mt-5 space-y-2.5" data-testid="schoolstats-peer-domains">
                    {(() => {
                      const myPct = {};
                      (data.domains || []).forEach((d) => { myPct[d.risk_domain_id] = d.percentage; });
                      return [...(peer.domains || [])]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((d) => (
                          <CompareBar key={d.risk_domain_id} name={d.name} mine={myPct[d.risk_domain_id] ?? 0} peer={d.percentage} />
                        ));
                    })()}
                  </div>

                  {/* Bu grafik neyi gösterir? (varsayılan açık) */}
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-peer-explain">
                    <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                    <div className="space-y-2 text-sm leading-relaxed text-slate-400">
                      <p>
                        Bu grafik, okulunuzdaki 8 ana risk alanının güncel oranlarını, aynı eğitim kademesindeki diğer okulların RAM'a gönderdikleri en güncel Risk Haritası sonuçlarından oluşturulan toplulaştırılmış oranlarla karşılaştırır. Karşılaştırma, okulunuzun sonuçlarını daha geniş bir bağlam içinde değerlendirmeye yardımcı olur; tek tek okul sonuçları gösterilmez.
                      </p>
                      <p>
                        Okulunuzun değerleri mevcut canlı verilerinizden hesaplanır. Karşılaştırma grubu ise diğer okulların RAM'a gönderdikleri en güncel snapshot verilerine dayanır. Bu nedenle iki veri farklı zamanlara ait olabilir.
                      </p>
                    </div>
                  </div>

                  {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <button
                      onClick={() => setHowPeerOpen((v) => !v)}
                      data-testid="schoolstats-peer-how-toggle"
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                    >
                      <span>Nasıl hesaplanıyor?</span>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howPeerOpen ? "rotate-180" : ""}`} />
                    </button>
                    {howPeerOpen && (
                      <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-peer-how-content">
                        <p>
                          Karşılaştırma grubuna aynı eğitim kademesindeki diğer okullar dahil edilir; giriş yapan okulunuz bu gruptan çıkarılır. Her okul için yalnızca aktif eğitim yılındaki en güncel Risk Haritası gönderimi kullanılır.
                        </p>
                        <p>
                          Okulların yüzdelerinin ortalaması alınmaz. Bunun yerine ilgili risk alanındaki toplam öğrenci sayısı, bu okullardaki toplam tamamlanmış form sayısına bölünür. Böylece büyük ve küçük okullar aynı ağırlıkta değerlendirilmez.
                        </p>
                        <p>
                          <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                          Aynı kademedeki diğer okullarda ilgili risk alanındaki toplam öğrenci sayısı ÷ Bu okullardaki toplam tamamlanmış form sayısı × 100
                        </p>
                        <p>
                          Sonuçlar yalnızca toplulaştırılmış olarak gösterilir; tek tek okul sonuçları veya okul adları paylaşılmaz.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
