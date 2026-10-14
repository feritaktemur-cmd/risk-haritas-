import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardCheck, Info, FileDown } from "lucide-react";
import { ramGet } from "../lib/ramRibaApi";
import { RamRibaTabs } from "../components/RamRibaTabs";
import { generateRamRibaSpecialTargetsPdf, topTargets } from "../lib/ramRibaSpecialTargetsPdf";

const selectCls = "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60";
const ALL = "all";
const ALL_VIEW_EXCLUDED = ["özel eğitim"];
const STATS_PATH = "/ram/riba/statistics/special-targets";

const StatCard = ({ label, value, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-1 text-3xl font-extrabold text-white" data-testid={testid}>{value}</p>
  </div>
);

const TargetTable = ({ items, prefix }) => (
  <div className="overflow-x-auto rounded-2xl border border-white/10">
    <table className="w-full min-w-[720px] text-left text-sm" data-testid={`${prefix}-table`}>
      <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
        <tr>
          {["Sıra", "MEB Kodu", "Hedef", "Seçen Okul", "Seçilme Yüzdesi"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {items.map((t) => (
          <tr key={t.target_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`${prefix}-row-${t.meb_code}`}>
            <td className="px-4 py-2.5 font-bold text-white" data-testid={`${prefix}-rank-${t.meb_code}`}>{t.rank}</td>
            <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{t.meb_code || "—"}</td>
            <td className="px-4 py-2.5 text-white">{t.target_name || "—"}</td>
            <td className="px-4 py-2.5" data-testid={`${prefix}-count-${t.meb_code}`}>{t.school_count}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-14 tabular-nums" data-testid={`${prefix}-pct-${t.meb_code}`}>%{Number(t.percentage).toFixed(1)}</span>
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
);

const PctNote = ({ testid }) => (
  <p className="mb-4 flex items-start gap-2 text-xs text-slate-400" data-testid={testid}>
    <Info size={14} className="mt-0.5 shrink-0" /> Her okul iki özel hedef seçebildiği için yüzdelerin toplamı %100'ü aşabilir.
  </p>
);

const TargetBarChart = ({ items, context, prefix }) => {
  const top = topTargets(items);
  return (
    <figure className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid={`${prefix}-chart`}>
      <figcaption className="mb-4">
        <p className="text-sm font-bold text-white" data-testid={`${prefix}-chart-title`}>En Çok Seçilen Özel Hedefler (İlk 10)</p>
        <p className="mt-0.5 text-xs text-slate-400" data-testid={`${prefix}-chart-context`}>{context}</p>
      </figcaption>
      <div className="space-y-3">
        {top.map((t) => (
          <div key={t.target_id} className="grid gap-1.5 sm:grid-cols-[minmax(0,16rem)_1fr_auto] sm:items-center sm:gap-4" data-testid={`${prefix}-chart-bar-${t.meb_code}`}>
            <p className="break-words text-xs text-slate-200"><span className="font-mono text-slate-400">{t.meb_code}</span> – {t.target_name}</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, t.percentage))}%` }} />
            </div>
            <p className="text-xs tabular-nums text-slate-300 sm:text-right">{t.school_count} okul · %{Number(t.percentage).toFixed(1)}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 hidden text-[10px] text-slate-500 sm:grid sm:grid-cols-[minmax(0,16rem)_1fr_auto] sm:gap-4">
        <span />
        <div className="flex justify-between">{[0, 25, 50, 75, 100].map((v) => <span key={v}>%{v}</span>)}</div>
        <span className="invisible">00 okul · %100.0</span>
      </div>
    </figure>
  );
};

const LevelSection = ({ entry, context }) => {
  const { level, data, error } = entry;
  const prefix = `ramriba-stats-level-${level.id}`;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5" data-testid={prefix}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-bold text-white" data-testid={`${prefix}-name`}>{level.name}</h3>
        {data && (
          <p className="text-xs text-slate-400">
            Katılan okul: <span className="font-bold text-white" data-testid={`${prefix}-school-count`}>{data.participating_school_count}</span>
            {" · "}Toplam seçim: <span className="font-bold text-white" data-testid={`${prefix}-total-selections`}>{data.total_selections}</span>
          </p>
        )}
      </div>
      {error ? (
        <div data-testid={`${prefix}-error`} className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      ) : data.participating_school_count === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400" data-testid={`${prefix}-empty`}>Bu kademede henüz gönderim bulunmuyor.</p>
      ) : (
        <>
          <TargetBarChart items={data.items || []} prefix={prefix} context={`${context.year} · ${level.name} · ${context.district}`} />
          <TargetTable items={data.items || []} prefix={prefix} />
        </>
      )}
    </section>
  );
};

export default function RamRibaSpecialTargets() {
  const navigate = useNavigate();
  const [refs, setRefs] = useState({ academic_years: [], education_levels: [], districts: [] });
  const [filters, setFilters] = useState({ academic_year_id: "", education_level_id: "", district_id: "" });
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

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

  const isAll = filters.education_level_id === ALL;
  const ready = filters.academic_year_id !== "" && filters.education_level_id !== "";
  const allLevels = refs.education_levels.filter((l) => !ALL_VIEW_EXCLUDED.includes((l.name || "").toLocaleLowerCase("tr")));

  useEffect(() => {
    setData(null);
    setAllData(null);
    setError(null);
    if (!ready) return;
    let active = true;
    const base = { academic_year_id: filters.academic_year_id };
    if (filters.district_id !== "") base.district_id = filters.district_id;
    (async () => {
      setLoading(true);
      if (isAll) {
        const results = await Promise.all(allLevels.map(async (level) => {
          try {
            return { level, data: await ramGet(navigate, STATS_PATH, { ...base, education_level_id: level.id }) };
          } catch (e) {
            return { level, silent: e.silent, error: e.message || "Bu kademenin istatistikleri yüklenemedi." };
          }
        }));
        if (active && !results.some((r) => r.silent)) setAllData(results);
      } else {
        try {
          const res = await ramGet(navigate, STATS_PATH, { ...base, education_level_id: filters.education_level_id });
          if (active) setData(res);
        } catch (e) {
          if (active && !e.silent) setError(e.message || "İstatistikler yüklenemedi. Lütfen tekrar deneyin.");
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate, ready, isAll, filters, refs.education_levels]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const items = data?.items || [];
  const okLevels = (allData || []).filter((r) => r.data);
  const sumSchools = okLevels.reduce((s, r) => s + (r.data.participating_school_count || 0), 0);
  const sumSelections = okLevels.reduce((s, r) => s + (r.data.total_selections || 0), 0);
  const hasPartialError = (allData || []).some((r) => r.error);
  const nameOf = (list, id) => list.find((x) => String(x.id) === String(id))?.name;
  const ctx = {
    year: nameOf(refs.academic_years, filters.academic_year_id) || "—",
    district: filters.district_id === "" ? "Tüm Sorumlu İlçeler" : (nameOf(refs.districts, filters.district_id) || "—"),
  };
  const levelName = nameOf(refs.education_levels, filters.education_level_id) || "—";
  const pdfReady = !loading && !error && (isAll ? !!allData : !!data);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const sections = isAll
        ? allData.map((r) => ({ levelName: r.level.name, data: r.data, error: r.error }))
        : [{ levelName, data }];
      await generateRamRibaSpecialTargetsPdf(sections, {
        ramName: sections.find((s) => s.data?.ram_name)?.data.ram_name,
        yearName: ctx.year, districtName: ctx.district, levelLabel: isAll ? "Tüm Kademeler" : levelName, isAll,
      });
    } catch (_) {
      setPdfError("PDF oluşturulamadı. Lütfen tekrar deneyin.");
    }
    setPdfBusy(false);
  };

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
            <option value={ALL}>Tüm Kademeler</option>
            {refs.education_levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filters.district_id} onChange={setFilter("district_id")} data-testid="ramriba-stats-district-filter" className={selectCls}>
            <option value="">Tüm Sorumlu İlçeler</option>
            {refs.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {loading && <Loader2 size={16} className="animate-spin text-emerald-300" data-testid="ramriba-stats-loading" />}
          <button onClick={() => { setPdfError(null); downloadPdf(); }} disabled={!pdfReady || pdfBusy} data-testid="ramriba-stats-pdf-btn"
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF İndir
          </button>
        </div>
        {pdfError && <p className="-mt-3 mb-4 text-xs text-rose-300" data-testid="ramriba-stats-pdf-error">{pdfError}</p>}

        {error ? (
          <div data-testid="ramriba-stats-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : !ready ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="ramriba-stats-select-prompt">
            İstatistikleri görüntülemek için eğitim yılı ve kademe seçin.
          </div>
        ) : isAll ? (
          !allData ? (
            <div className="grid place-items-center py-16"><Loader2 size={28} className="animate-spin text-emerald-300" /></div>
          ) : (
            <div data-testid="ramriba-stats-all">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <StatCard label="Toplam Katılan Okul (Tüm Kademeler)" value={sumSchools} testid="ramriba-stats-all-school-count" />
                <StatCard label="Toplam Özel Hedef Seçimi (Tüm Kademeler)" value={sumSelections} testid="ramriba-stats-all-total-selections" />
              </div>
              {hasPartialError && (
                <div data-testid="ramriba-stats-all-partial-warning" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300 ring-1 ring-amber-400/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>Eksik veri: Bazı kademelerin istatistikleri yüklenemedi; genel toplam yalnız yüklenen kademeleri içerir.</span>
                </div>
              )}
              <PctNote testid="ramriba-stats-all-note" />
              <div className="space-y-4">
                {allData.map((entry) => <LevelSection key={entry.level.id} entry={entry} context={ctx} />)}
              </div>
            </div>
          )
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
            <PctNote testid="ramriba-stats-note" />
            <TargetBarChart items={items} prefix="ramriba-stats" context={`${ctx.year} · ${levelName} · ${ctx.district}`} />
            <TargetTable items={items} prefix="ramriba-stats" />
          </>
        )}
      </main>
    </div>
  );
}
