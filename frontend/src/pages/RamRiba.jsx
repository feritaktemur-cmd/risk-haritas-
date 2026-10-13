import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, Search, ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { ramGet, formatDate, targetLabel } from "../lib/ramRibaApi";

const PAGE_SIZE = 25;
const selectCls = "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60";

export default function RamRiba() {
  const navigate = useNavigate();
  const [refs, setRefs] = useState({ academic_years: [], education_levels: [], districts: [] });
  const [filters, setFilters] = useState({ academic_year_id: "", education_level_id: "", district_id: "" });
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, d] = await Promise.all([
          ramGet(navigate, "/ram/risk-map/refs"),
          ramGet(navigate, "/ram/risk-map/districts"),
        ]);
        setRefs({ academic_years: r.academic_years || [], education_levels: r.education_levels || [], districts: d.districts || [] });
      } catch (e) { if (!e.silent) setError(e.message || "Filtre seçenekleri yüklenemedi."); }
    })();
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    Object.entries(filters).forEach(([k, v]) => { if (v !== "") params[k] = v; });
    if (q) params.q = q;
    try {
      const res = await ramGet(navigate, "/ram/riba/submissions", params);
      setData(res);
      setError(null);
    } catch (e) {
      if (!e.silent) setError(e.message || "RİBA gönderimleri yüklenemedi. Lütfen tekrar deneyin.");
    }
    setLoading(false);
  }, [navigate, filters, q, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = q || Object.values(filters).some((v) => v !== "");

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/ram/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="ramriba-title">RİBA – Gelen Gönderimler</h1>
            </div>
          </div>
          <button onClick={() => navigate("/ram/modules")} data-testid="ramriba-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Modüller
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="mb-1 text-base font-bold text-white">RİBA Gönderimleri</h2>
        <p className="mb-6 text-xs text-slate-400">Sorumlu olduğunuz ilçelerdeki okulların RAM'a gönderdiği RİBA okul sonuçları (gönderim anındaki değişmez kayıt).</p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} data-testid="ramriba-search" placeholder="Okul ara"
              className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60" />
          </div>
          <select value={filters.academic_year_id} onChange={setFilter("academic_year_id")} data-testid="ramriba-year-filter" className={selectCls}>
            <option value="">Tüm Eğitim Yılları</option>
            {refs.academic_years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select value={filters.district_id} onChange={setFilter("district_id")} data-testid="ramriba-district-filter" className={selectCls}>
            <option value="">Tüm Sorumlu İlçeler</option>
            {refs.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filters.education_level_id} onChange={setFilter("education_level_id")} data-testid="ramriba-level-filter" className={selectCls}>
            <option value="">Tüm Kademeler</option>
            {refs.education_levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {loading && <Loader2 size={16} className="animate-spin text-emerald-300" data-testid="ramriba-loading" />}
        </div>

        {error ? (
          <div data-testid="ramriba-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : data && items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="ramriba-empty">
            {hasFilter ? "Seçili filtrelere uygun RİBA gönderimi bulunamadı." : "Sorumlu ilçelerinizde henüz RAM'a gönderilmiş RİBA sonucu bulunmuyor."}
          </div>
        ) : data ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[1000px] text-left text-sm" data-testid="ramriba-table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    {["Okul", "İlçe", "Eğitim Yılı", "Kademe", "Özel Hedef 1", "Özel Hedef 2", "Gönderim Tarihi", "İşlem"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((s) => (
                    <tr key={s.submission_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`ramriba-row-${s.submission_id}`}>
                      <td className="px-4 py-2.5 font-semibold text-white">{s.school_name || "—"}</td>
                      <td className="px-4 py-2.5">{s.district_name || "—"}</td>
                      <td className="px-4 py-2.5">{s.academic_year_name || "—"}</td>
                      <td className="px-4 py-2.5">{s.education_level_name || "—"}</td>
                      <td className="px-4 py-2.5">{targetLabel(s.special_target_1)}</td>
                      <td className="px-4 py-2.5">{targetLabel(s.special_target_2)}</td>
                      <td className="px-4 py-2.5 text-slate-400">{formatDate(s.submitted_at)}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => navigate(`/ram/riba/submissions/${s.submission_id}`)} data-testid={`ramriba-view-${s.submission_id}`}
                          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25">Görüntüle</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span data-testid="ramriba-total">Toplam {total} kayıt · Sayfa {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} data-testid="ramriba-prev-btn"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 disabled:opacity-40"><ChevronLeft size={14} /> Önceki</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} data-testid="ramriba-next-btn"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 disabled:opacity-40">Sonraki <ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
