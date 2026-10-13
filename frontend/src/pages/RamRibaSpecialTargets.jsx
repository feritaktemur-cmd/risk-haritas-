import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardCheck, Info } from "lucide-react";
import { ramGet } from "../lib/ramRibaApi";
import { RamRibaTabs } from "../components/RamRibaTabs";

const selectCls = "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60";

const StatCard = ({ label, value, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-1 text-3xl font-extrabold text-white" data-testid={testid}>{value}</p>
  </div>
);

export default function RamRibaSpecialTargets() {
  const navigate = useNavigate();
  const [refs, setRefs] = useState({ academic_years: [], education_levels: [], districts: [] });
  const [filters, setFilters] = useState({ academic_year_id: "", education_level_id: "", district_id: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, d] = await Promise.all([
          ramGet(navigate, "/ram/risk-map/refs"),
          ramGet(navigate, "/ram/risk-map/districts"),
        ]);
        const years = r.academic_years || [];
        setRefs({ academic_years: years, education_levels: r.education_levels || [], districts: d.districts || [] });
        const activeYear = years.find((y) => y.is_active);
        if (activeYear) setFilters((f) => ({ ...f, academic_year_id: String(activeYear.id) }));
      } catch (e) { if (!e.silent) setError(e.message || "Filtre seçenekleri yüklenemedi."); }
    })();
  }, [navigate]);

  const ready = filters.academic_year_id !== "" && filters.education_level_id !== "";

  useEffect(() => {
    if (!ready) { setData(null); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const params = { academic_year_id: filters.academic_year_id, education_level_id: filters.education_level_id };
      if (filters.district_id !== "") params.district_id = filters.district_id;
      try {
        const res = await ramGet(navigate, "/ram/riba/statistics/special-targets", params);
        if (active) { setData(res); setError(null); }
      } catch (e) {
        if (active && !e.silent) { setData(null); setError(e.message || "İstatistikler yüklenemedi. Lütfen tekrar deneyin."); }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate, ready, filters]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const items = data?.items || [];

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
              <h1 className="text-lg font-extrabold text-white" data-testid="ramriba-stats-title">RİBA</h1>
            </div>
          </div>
          <button onClick={() => navigate("/ram/modules")} data-testid="ramriba-stats-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Modüller
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <RamRibaTabs />
        <h2 className="mb-1 text-base font-bold text-white">Özel Hedef Seçilme Sıklığı</h2>
        <p className="mb-6 text-xs text-slate-400">Sorumlu ilçelerinizdeki okulların RAM'a gönderdiği RİBA kayıtlarında seçilen okul özel hedefleri (her okulun en son gönderimi esas alınır).</p>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select value={filters.academic_year_id} onChange={setFilter("academic_year_id")} data-testid="ramriba-stats-year-filter" className={selectCls}>
            <option value="">Eğitim Yılı Seçin</option>
            {refs.academic_years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select value={filters.education_level_id} onChange={setFilter("education_level_id")} data-testid="ramriba-stats-level-filter" className={selectCls}>
            <option value="">Kademe Seçin</option>
            {refs.education_levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filters.district_id} onChange={setFilter("district_id")} data-testid="ramriba-stats-district-filter" className={selectCls}>
            <option value="">Tüm Sorumlu İlçeler</option>
            {refs.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {loading && <Loader2 size={16} className="animate-spin text-emerald-300" data-testid="ramriba-stats-loading" />}
        </div>

        {error ? (
          <div data-testid="ramriba-stats-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : !ready ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="ramriba-stats-select-prompt">
            İstatistikleri görüntülemek için eğitim yılı ve kademe seçin.
          </div>
        ) : !data ? (
          <div className="grid place-items-center py-16"><Loader2 size={28} className="animate-spin text-emerald-300" /></div>
        ) : data.participating_school_count === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="ramriba-stats-empty">
            Seçilen eğitim yılı, kademe ve ilçede RAM'a gönderilmiş RİBA kaydı bulunmuyor.
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="Katılan Okul Sayısı" value={data.participating_school_count} testid="ramriba-stats-school-count" />
              <StatCard label="Toplam Özel Hedef Seçimi" value={data.total_selections} testid="ramriba-stats-total-selections" />
            </div>
            <p className="mb-4 flex items-start gap-2 text-xs text-slate-400" data-testid="ramriba-stats-note">
              <Info size={14} className="mt-0.5 shrink-0" /> Her okul iki özel hedef seçebildiği için yüzdelerin toplamı %100'ü aşabilir.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[720px] text-left text-sm" data-testid="ramriba-stats-table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    {["Sıra", "MEB Kodu", "Hedef", "Seçen Okul", "Seçilme Yüzdesi"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((t) => (
                    <tr key={t.target_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`ramriba-stats-row-${t.meb_code}`}>
                      <td className="px-4 py-2.5 font-bold text-white" data-testid={`ramriba-stats-rank-${t.meb_code}`}>{t.rank}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{t.meb_code || "—"}</td>
                      <td className="px-4 py-2.5 text-white">{t.target_name || "—"}</td>
                      <td className="px-4 py-2.5" data-testid={`ramriba-stats-count-${t.meb_code}`}>{t.school_count}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-14 tabular-nums" data-testid={`ramriba-stats-pct-${t.meb_code}`}>%{Number(t.percentage).toFixed(1)}</span>
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, t.percentage)}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
