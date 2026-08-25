import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardList, Building2, CheckCircle2, Circle, Percent, Download, FileText } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) {
    return iso;
  }
}

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
      <Icon size={14} className={tone} /> {label}
    </div>
    <p className="mt-1.5 text-2xl font-extrabold text-white">{value}</p>
  </div>
);

export default function AdminTracking() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [years, setYears] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [schoolTypes, setSchoolTypes] = useState([]);
  const [managementTypes, setManagementTypes] = useState([]);
  const [yearId, setYearId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [educationLevelId, setEducationLevelId] = useState("");
  const [schoolTypeId, setSchoolTypeId] = useState("");
  const [managementTypeId, setManagementTypeId] = useState("");
  const [submissionState, setSubmissionState] = useState("all");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const [yRes, dRes, rRes] = await Promise.all([
        axios.get(`${API}/admin/academic-years`, { headers: h }),
        axios.get(`${API}/admin/districts`, { headers: h }),
        axios.get(`${API}/admin/school-refs`, { headers: h }),
      ]);
      const ys = yRes.data.academic_years || [];
      setYears(ys);
      setDistricts(dRes.data.districts || []);
      setEducationLevels(rRes.data.education_levels || []);
      setSchoolTypes(rRes.data.school_types || []);
      setManagementTypes(rRes.data.management_types || []);
      const active = ys.find((y) => y.is_active) || ys[0];
      setYearId(active ? active.id : "");
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); return; }
      setError("Veriler yüklenemedi. Lütfen tekrar deneyin.");
    }
    setReady(true);
  }, [navigate]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const loadTracking = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const params = { academic_year_id: yearId, submission_state: submissionState };
      if (districtId) params.district_id = districtId;
      if (educationLevelId) params.education_level_id = educationLevelId;
      if (schoolTypeId) params.school_type_id = schoolTypeId;
      if (managementTypeId) params.management_type_id = managementTypeId;
      const res = await axios.get(`${API}/admin/risk-map/tracking`, { headers: h, params });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); return; }
      setError("Gönderim takibi yüklenemedi. Lütfen tekrar deneyin.");
      setData(null);
    }
    setLoading(false);
  }, [yearId, districtId, educationLevelId, schoolTypeId, managementTypeId, submissionState, navigate]);

  useEffect(() => { if (yearId) loadTracking(); }, [yearId, districtId, educationLevelId, schoolTypeId, managementTypeId, submissionState, loadTracking]);

  // Level -> type narrowing: only show school types of the selected level.
  const visibleSchoolTypes = educationLevelId
    ? schoolTypes.filter((t) => String(t.education_level_id) === String(educationLevelId))
    : schoolTypes;

  const onLevelChange = (val) => {
    setEducationLevelId(val);
    if (schoolTypeId) {
      const stillValid = schoolTypes.some(
        (t) => String(t.id) === String(schoolTypeId) && (!val || String(t.education_level_id) === String(val))
      );
      if (!stillValid) setSchoolTypeId("");
    }
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="tracking-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  const summary = data?.summary;
  const schools = data?.schools || [];

  const yearLabel = (years.find((y) => String(y.id) === String(yearId))?.name || "")
    .replace(/[^0-9A-Za-zÇĞİÖŞÜçğıöşü]+/g, "-").replace(/^-+|-+$/g, "");

  const downloadCsv = () => {
    if (!schools.length) return;
    const headers = ["İlçe", "Okul", "Kademe", "Okul Türü", "Yönetim Türü", "Gönderim Durumu", "Son Sürüm", "Son Gönderim", "Tamamlanma"];
    const esc = (v) => `"${String(v ?? "—").replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(",")];
    for (const s of schools) {
      lines.push([
        s.district || "—",
        s.school_name || "—",
        s.education_level || "—",
        s.school_type || "—",
        s.management_type || "—",
        s.submitted ? "Gönderdi" : "Göndermedi",
        s.submitted ? `Sürüm ${s.version_no}` : "—",
        s.submitted ? formatDate(s.submitted_at) : "—",
        s.submitted ? `%${s.completion_rate}` : "—",
      ].map(esc).join(","));
    }
    const base = submissionState === "not_submitted"
      ? "ram-gondermeyen-okullar"
      : submissionState === "submitted"
      ? "ram-gonderen-okullar"
      : "ram-gonderim-takibi";
    const fileName = `${base}${yearLabel ? `-${yearLabel}` : ""}.csv`;
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const nameOf = (arr, id, fallback) =>
    (id ? (arr.find((x) => String(x.id) === String(id))?.name || fallback) : fallback);

  const downloadPdf = async () => {
    if (!schools.length || pdfBusy) return;
    setPdfBusy(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      // Load Turkish-capable TTF and register (both normal + bold -> same file).
      const fontUrl = `${process.env.PUBLIC_URL || ""}/fonts/Roboto-Regular.ttf`;
      const buf = await (await fetch(fontUrl)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const fontB64 = btoa(binary);

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.addFileToVFS("Roboto-Regular.ttf", fontB64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
      doc.setFont("Roboto", "normal");

      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 40;
      const yearName = years.find((y) => String(y.id) === String(yearId))?.name || "";
      const statusLabel = { all: "Tümü", submitted: "Gönderdi", not_submitted: "Göndermedi" }[submissionState];
      const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

      // ---- Header block (once, top of first page) ----
      let y = 42;
      doc.setFont("Roboto", "bold");
      doc.setFontSize(16);
      doc.text("PDRPUSULA", marginX, y);
      y += 20;
      doc.setFontSize(13);
      doc.text("RAM Gönderim Takip Raporu", marginX, y);
      y += 18;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(11);
      doc.setTextColor(80);
      doc.text(`${yearName} Eğitim Öğretim Yılı`, marginX, y);
      doc.setTextColor(0);
      y += 22;

      // Rapor Kapsamı
      doc.setFont("Roboto", "bold");
      doc.setFontSize(10.5);
      doc.text("Rapor Kapsamı", marginX, y);
      y += 4;
      doc.setDrawColor(210);
      doc.line(marginX, y, pageW - marginX, y);
      y += 14;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(9.5);
      const scope = [
        ["İlçe", nameOf(districts, districtId, "Tüm İlçeler")],
        ["Kademe", nameOf(educationLevels, educationLevelId, "Tüm Kademeler")],
        ["Okul Türü", nameOf(schoolTypes, schoolTypeId, "Tüm Okul Türleri")],
        ["Yönetim Türü", nameOf(managementTypes, managementTypeId, "Tüm Yönetim Türleri")],
        ["Gönderim Durumu", statusLabel],
      ];
      const colW = (pageW - marginX * 2) / 2;
      scope.forEach((row, i) => {
        const cx = marginX + (i % 2) * colW;
        const cy = y + Math.floor(i / 2) * 15;
        doc.setTextColor(110);
        doc.text(`${row[0]}:`, cx, cy);
        doc.setTextColor(0);
        doc.text(String(row[1]), cx + 90, cy);
      });
      y += Math.ceil(scope.length / 2) * 15 + 12;

      // Özet göstergeler
      const cards = [
        ["Toplam Okul", String(summary?.total_schools ?? 0)],
        ["Gönderen Okul", String(summary?.submitted_schools ?? 0)],
        ["Göndermeyen Okul", String(summary?.not_submitted_schools ?? 0)],
        ["Gönderim Oranı", `%${summary?.submission_rate ?? 0}`],
      ];
      const cardW = (pageW - marginX * 2 - 24) / 4;
      const cardH = 40;
      cards.forEach((c, i) => {
        const cx = marginX + i * (cardW + 8);
        doc.setDrawColor(220);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(cx, y, cardW, cardH, 4, 4, "FD");
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(c[0], cx + 8, y + 15);
        doc.setFont("Roboto", "bold");
        doc.setFontSize(14);
        doc.setTextColor(20);
        doc.text(c[1], cx + 8, y + 33);
        doc.setFont("Roboto", "normal");
      });
      doc.setTextColor(0);
      const tableStartY = y + cardH + 18;

      // ---- School table (multi-page, repeated header) ----
      const body = schools.map((s, idx) => [
        String(idx + 1),
        s.district || "—",
        s.school_name || "—",
        s.education_level || "—",
        s.school_type || "—",
        s.management_type || "—",
        s.submitted ? "Gönderdi" : "Göndermedi",
        s.submitted ? `Sürüm ${s.version_no}` : "—",
        s.submitted ? formatDate(s.submitted_at) : "—",
        s.submitted ? `%${s.completion_rate}` : "—",
      ]);

      autoTable(doc, {
        startY: tableStartY,
        margin: { top: 40, left: marginX, right: marginX, bottom: 36 },
        head: [["Sıra", "İlçe", "Okul", "Kademe", "Okul Türü", "Yönetim Türü", "Durum", "Son Sürüm", "Son Gönderim", "Tamamlanma"]],
        body,
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 8, cellPadding: 3, overflow: "linebreak", valign: "middle", lineColor: [225, 225, 225], lineWidth: 0.5 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: {
          0: { cellWidth: 30, halign: "right" },
          1: { cellWidth: 75 },
          2: { cellWidth: "auto" },
          3: { cellWidth: 70 },
          4: { cellWidth: 95 },
          5: { cellWidth: 70 },
          6: { cellWidth: 62 },
          7: { cellWidth: 55 },
          8: { cellWidth: 95 },
          9: { cellWidth: 62, halign: "right" },
        },
      });

      // ---- Footer on every page: brand + generation date + page X / Y ----
      const total = doc.getNumberOfPages();
      const pageH = doc.internal.pageSize.getHeight();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFont("Roboto", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text("PDRPUSULA – RAM Gönderim Takip Raporu", marginX, pageH - 18);
        doc.text(`Rapor tarihi: ${generatedAt}`, pageW / 2, pageH - 18, { align: "center" });
        doc.text(`Sayfa ${p} / ${total}`, pageW - marginX, pageH - 18, { align: "right" });
      }
      doc.setTextColor(0);

      const base = submissionState === "not_submitted"
        ? "ram-gondermeyen-okullar"
        : submissionState === "submitted"
        ? "ram-gonderen-okullar"
        : "ram-gonderim-takibi";
      doc.save(`${base}${yearLabel ? `-${yearLabel}` : ""}.pdf`);
    } catch (_) {
      setError("PDF raporu oluşturulamadı. Lütfen tekrar deneyin.");
    }
    setPdfBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="tracking-title">RAM Gönderim Takibi</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCsv} disabled={!schools.length} data-testid="tracking-csv-btn" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              <Download size={15} /> CSV İndir
            </button>
            <button onClick={downloadPdf} disabled={!schools.length || pdfBusy} data-testid="tracking-pdf-btn" className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-300 ring-1 ring-indigo-400/30 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF Raporu İndir
            </button>
            <button onClick={() => navigate("/admin/risk-map")} data-testid="tracking-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <ArrowLeft size={15} /> Okul Gönderimleri
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Eğitim Yılı</label>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} data-testid="tracking-year-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (Aktif)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">İlçe</label>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} data-testid="tracking-district-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="">Tüm İlçeler</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Kademe</label>
            <select value={educationLevelId} onChange={(e) => onLevelChange(e.target.value)} data-testid="tracking-level-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="">Tüm Kademeler</option>
              {educationLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Okul Türü</label>
            <select value={schoolTypeId} onChange={(e) => setSchoolTypeId(e.target.value)} data-testid="tracking-school-type-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="">Tüm Okul Türleri</option>
              {visibleSchoolTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Yönetim Türü</label>
            <select value={managementTypeId} onChange={(e) => setManagementTypeId(e.target.value)} data-testid="tracking-management-type-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="">Tüm Yönetim Türleri</option>
              {managementTypes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Gönderim Durumu</label>
            <select value={submissionState} onChange={(e) => setSubmissionState(e.target.value)} data-testid="tracking-state-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="all">Tümü</option>
              <option value="submitted">Gönderdi</option>
              <option value="not_submitted">Göndermedi</option>
            </select>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Building2} label="Toplam Okul" value={summary.total_schools} tone="text-indigo-400" testid="tracking-stat-total" />
            <StatCard icon={CheckCircle2} label="Gönderen Okul" value={summary.submitted_schools} tone="text-emerald-400" testid="tracking-stat-submitted" />
            <StatCard icon={Circle} label="Göndermeyen Okul" value={summary.not_submitted_schools} tone="text-slate-500" testid="tracking-stat-not-submitted" />
            <StatCard icon={Percent} label="Gönderim Oranı" value={`%${summary.submission_rate}`} tone="text-indigo-400" testid="tracking-stat-rate" />
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 size={26} className="animate-spin text-indigo-300" /></div>
        ) : error ? (
          <div data-testid="tracking-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : schools.length === 0 ? (
          <div data-testid="tracking-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
            Seçilen kapsamda okul bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10" data-testid="tracking-content">
            <table className="w-full min-w-[980px] text-left text-sm" data-testid="tracking-table">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">İlçe</th>
                  <th className="px-4 py-3 font-semibold">Okul</th>
                  <th className="px-4 py-3 font-semibold">Kademe</th>
                  <th className="px-4 py-3 font-semibold">Okul Türü</th>
                  <th className="px-4 py-3 font-semibold">Yönetim Türü</th>
                  <th className="px-4 py-3 font-semibold">Gönderim Durumu</th>
                  <th className="px-4 py-3 font-semibold">Son Sürüm</th>
                  <th className="px-4 py-3 font-semibold">Son Gönderim</th>
                  <th className="px-4 py-3 font-semibold">Tamamlanma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {schools.map((s) => (
                  <tr key={s.school_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`tracking-row-${s.school_id}`}>
                    <td className="px-4 py-2.5">{s.district || "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{s.school_name || "—"}</td>
                    <td className="px-4 py-2.5">{s.education_level || "—"}</td>
                    <td className="px-4 py-2.5">{s.school_type || "—"}</td>
                    <td className="px-4 py-2.5">{s.management_type || "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.submitted ? (
                        <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">Gönderdi</span>
                      ) : (
                        <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-400 ring-1 ring-white/10">Göndermedi</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{s.submitted ? `Sürüm ${s.version_no}` : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.submitted ? formatDate(s.submitted_at) : "—"}</td>
                    <td className="px-4 py-2.5">{s.submitted ? `%${s.completion_rate}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
