import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Loader2, ArrowLeft, AlertTriangle, Search, BarChart3, ClipboardList } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const STATUS_LABELS = {
  submitted: "Gönderildi",
  under_review: "İnceleniyor",
  revision_requested: "Düzeltme İstendi",
  approved: "Onaylandı",
};

const STATUS_STYLES = {
  submitted: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  under_review: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  revision_requested: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  approved: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) {
    return iso;
  }
}

export default function AdminRiskMap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState(null);

  const [district, setDistrict] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/admin/risk-map/submissions`, { headers: h });
      setSubmissions(res.data.submissions || []);
      return res.data;
    } catch (err) {
      if (err.response?.status === 401) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      } else if (err.response?.status === 403) {
        setError("Bu hesabın yönetim erişimi yok.");
      } else {
        setError("Okul gönderimleri yüklenemedi. Lütfen tekrar deneyin.");
      }
      return null;
    }
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const d = await load();
      setReady(true);
      if (!d) { /* error already set */ }
    })();
  }, [load]);

  const districts = useMemo(() => {
    const set = new Set(submissions.map((s) => s.district).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (district && s.district !== district) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q && !(s.school_name || "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [submissions, district, statusFilter, q]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="adminrisk-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/admin/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="adminrisk-title">RAM Risk Haritası</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/admin/risk-map/tracking")} data-testid="adminrisk-tracking-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <ClipboardList size={15} /> Gönderim Takibi
            </button>
            <button onClick={() => navigate("/admin/risk-map/aggregate")} data-testid="adminrisk-aggregate-btn" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90">
              <BarChart3 size={15} /> Birleşik Risk Haritası
            </button>
            <button onClick={() => navigate("/admin")} data-testid="adminrisk-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <ArrowLeft size={15} /> Yönetim Paneli
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="mb-1 text-base font-bold text-white">Okul Gönderimleri</h2>
        <p className="mb-6 text-xs text-slate-400">Okulların RAM'a gönderdiği toplu (anonim) Risk Haritası snapshot'ları. Tüm sürümler geçmişiyle listelenir.</p>

        {error ? (
          <div data-testid="adminrisk-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  data-testid="adminrisk-search"
                  placeholder="Okul ara"
                  className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} data-testid="adminrisk-district-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
                <option value="">Tüm İlçeler</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="adminrisk-status-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
                <option value="all">Tüm Durumlar</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {submissions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="adminrisk-empty">
                Henüz RAM'a gönderilmiş Risk Haritası bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[980px] text-left text-sm" data-testid="adminrisk-table">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">İlçe</th>
                      <th className="px-4 py-3 font-semibold">Okul</th>
                      <th className="px-4 py-3 font-semibold">Eğitim Yılı</th>
                      <th className="px-4 py-3 font-semibold">Sürüm</th>
                      <th className="px-4 py-3 font-semibold">Durum</th>
                      <th className="px-4 py-3 font-semibold">Toplam</th>
                      <th className="px-4 py-3 font-semibold">Tamamlanan</th>
                      <th className="px-4 py-3 font-semibold">Eksik</th>
                      <th className="px-4 py-3 font-semibold">Tamamlanma</th>
                      <th className="px-4 py-3 font-semibold">Risk İşaretleme</th>
                      <th className="px-4 py-3 font-semibold">Gönderim Tarihi</th>
                      <th className="px-4 py-3 font-semibold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">Filtreye uygun gönderim bulunamadı.</td></tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.submission_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`adminrisk-row-${s.submission_id}`}>
                          <td className="px-4 py-2.5">{s.district || "—"}</td>
                          <td className="px-4 py-2.5 font-semibold text-white">{s.school_name || "—"}</td>
                          <td className="px-4 py-2.5">{s.academic_year || "—"}</td>
                          <td className="px-4 py-2.5">Sürüm {s.version_no}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[s.status] || "bg-white/10 text-slate-300 ring-white/10"}`}>
                              {STATUS_LABELS[s.status] || s.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{s.total_students}</td>
                          <td className="px-4 py-2.5">{s.completed_students}</td>
                          <td className="px-4 py-2.5">{s.not_entered_students}</td>
                          <td className="px-4 py-2.5">%{s.completion_rate}</td>
                          <td className="px-4 py-2.5">{s.total_risk_marks}</td>
                          <td className="px-4 py-2.5 text-slate-400">{formatDate(s.submitted_at)}</td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => navigate(`/admin/risk-map/submissions/${s.submission_id}`)}
                              data-testid={`adminrisk-view-${s.submission_id}`}
                              className="rounded-lg bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30 transition hover:bg-indigo-500/25"
                            >Görüntüle</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
