import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, MapPinned, Users, CheckCircle2, Circle, Percent, ListChecks, Building2 } from "lucide-react";
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

const BarRow = ({ label, count, percentage }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-sm text-slate-200">{label}</span>
      <span className="shrink-0 text-xs font-semibold text-slate-300">{count} öğrenci — %{percentage}</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: `${Math.min(100, percentage)}%` }} />
    </div>
  </div>
);

export default function RamAggregateRiskMap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [years, setYears] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [yearId, setYearId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [educationLevelId, setEducationLevelId] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [domainSort, setDomainSort] = useState("prevalence");
  const [catSort, setCatSort] = useState("density");

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      const [refRes, dRes] = await Promise.all([
        axios.get(`${API}/ram/risk-map/refs`, { headers: h }),
        axios.get(`${API}/ram/risk-map/districts`, { headers: h }),
      ]);
      const ys = refRes.data.academic_years || [];
      setYears(ys);
      setEducationLevels(refRes.data.education_levels || []);
      setDistricts(dRes.data.districts || []);
      const active = ys.find((y) => y.is_active) || ys[0];
      setYearId(active ? active.id : "");
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setError("Veriler yüklenemedi. Lütfen tekrar deneyin.");
    }
    setReady(true);
  }, [navigate]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const loadAggregate = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      const params = { academic_year_id: yearId };
      if (districtId) params.district_id = districtId;
      if (educationLevelId) params.education_level_id = educationLevelId;
      const res = await axios.get(`${API}/ram/risk-map/aggregate`, { headers: h, params });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setError("Birleşik analiz yüklenemedi. Lütfen tekrar deneyin.");
      setData(null);
    }
    setLoading(false);
  }, [yearId, districtId, educationLevelId, navigate]);

  useEffect(() => { if (yearId) loadAggregate(); }, [yearId, districtId, educationLevelId, loadAggregate]);

  const sortedDomains = () => {
    if (!data) return [];
    return [...data.domains].sort((a, b) => domainSort === "order"
      ? a.sort_order - b.sort_order
      : (b.student_count - a.student_count) || (a.sort_order - b.sort_order));
  };
  const sortedCategories = () => {
    if (!data) return [];
    return [...data.categories].sort((a, b) => catSort === "form"
      ? a.sort_order - b.sort_order
      : (b.student_count - a.student_count) || (a.sort_order - b.sort_order));
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="ramagg-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const hasData = data && data.summary.schools_count > 0;

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/ram/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <MapPinned size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="ramagg-title">RAM Geneli Risk Haritası</h1>
            </div>
          </div>
          <button onClick={() => navigate("/ram/risk-map")} data-testid="ramagg-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Gönderimler
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-6 text-xs text-slate-400">RAM sorumluluk alanındaki okulların en güncel gönderimleri üzerinden oluşturulur. Yalnız sorumlu olduğunuz ilçeler kapsanır.</p>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Eğitim Yılı</label>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} data-testid="ramagg-year-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60">
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (Aktif)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">İlçe</label>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} data-testid="ramagg-district-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60">
              <option value="">Tüm Sorumlu İlçeler</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Kademe</label>
            <select value={educationLevelId} onChange={(e) => setEducationLevelId(e.target.value)} data-testid="ramagg-level-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60">
              <option value="">Tüm Kademeler</option>
              {educationLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 size={26} className="animate-spin text-emerald-300" /></div>
        ) : error ? (
          <div data-testid="ramagg-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : !hasData ? (
          <div data-testid="ramagg-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
            Seçilen kapsamda RAM'a gönderilmiş Risk Haritası bulunmuyor.
          </div>
        ) : (
          <div data-testid="ramagg-content">
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard icon={Building2} label="Analize Dahil Okul" value={data.summary.schools_count} tone="text-indigo-400" testid="ramagg-stat-schools" />
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="ramagg-stat-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="ramagg-stat-completed" />
              <StatCard icon={Circle} label="Girilmeyen" value={data.summary.not_entered} tone="text-slate-500" testid="ramagg-stat-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="ramagg-stat-rate" />
              <StatCard icon={ListChecks} label="Toplam Risk İşaretlemesi" value={data.summary.total_marks} tone="text-rose-400" testid="ramagg-stat-marks" />
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">Ana Risk Alanları</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button onClick={() => setDomainSort("prevalence")} data-testid="ramagg-domain-sort-prevalence" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "prevalence" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Yaygınlığa göre</button>
                <button onClick={() => setDomainSort("order")} data-testid="ramagg-domain-sort-order" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "order" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Alan sırasına göre</button>
              </div>
            </div>
            <div className="mb-8 space-y-2.5" data-testid="ramagg-domains">
              {sortedDomains().map((d) => <BarRow key={d.risk_domain_id} label={d.name} count={d.student_count} percentage={d.percentage} />)}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">36 Risk Maddesi Analizi</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button onClick={() => setCatSort("density")} data-testid="ramagg-cat-sort-density" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "density" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Yoğunluğa göre</button>
                <button onClick={() => setCatSort("form")} data-testid="ramagg-cat-sort-form" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "form" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Form sırasına göre</button>
              </div>
            </div>
            <div className="space-y-2.5" data-testid="ramagg-categories">
              {sortedCategories().map((c) => <BarRow key={c.risk_category_id} label={c.label} count={c.student_count} percentage={c.percentage} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
