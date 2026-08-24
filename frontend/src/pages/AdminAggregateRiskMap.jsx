import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, ListChecks, Building2 } from "lucide-react";
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

export default function AdminAggregateRiskMap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [years, setYears] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [yearId, setYearId] = useState("");
  const [districtId, setDistrictId] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [domainSort, setDomainSort] = useState("prevalence");
  const [catSort, setCatSort] = useState("density");

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const [yRes, dRes] = await Promise.all([
        axios.get(`${API}/admin/academic-years`, { headers: h }),
        axios.get(`${API}/admin/districts`, { headers: h }),
      ]);
      const ys = yRes.data.academic_years || [];
      setYears(ys);
      setDistricts(dRes.data.districts || []);
      const active = ys.find((y) => y.is_active) || ys[0];
      setYearId(active ? active.id : "");
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); return; }
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
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const params = { academic_year_id: yearId };
      if (districtId) params.district_id = districtId;
      const res = await axios.get(`${API}/admin/risk-map/aggregate`, { headers: h, params });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); return; }
      setError("Birleşik analiz yüklenemedi. Lütfen tekrar deneyin.");
      setData(null);
    }
    setLoading(false);
  }, [yearId, districtId, navigate]);

  useEffect(() => { if (yearId) loadAggregate(); }, [yearId, districtId, loadAggregate]);

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
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="agg-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  const hasData = data && data.summary.schools_count > 0;

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="agg-title">RAM Birleşik Risk Haritası</h1>
            </div>
          </div>
          <button onClick={() => navigate("/admin/risk-map")} data-testid="agg-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Gönderimleri
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Eğitim Yılı</label>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} data-testid="agg-year-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (Aktif)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">İlçe</label>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} data-testid="agg-district-filter" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60">
              <option value="">Tüm İlçeler</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 size={26} className="animate-spin text-indigo-300" /></div>
        ) : error ? (
          <div data-testid="agg-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : !hasData ? (
          <div data-testid="agg-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
            Seçilen kapsamda RAM'a gönderilmiş Risk Haritası bulunmuyor.
          </div>
        ) : (
          <div data-testid="agg-content">
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard icon={Building2} label="Analize Dahil Okul" value={data.summary.schools_count} tone="text-indigo-400" testid="agg-stat-schools" />
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="agg-stat-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="agg-stat-completed" />
              <StatCard icon={Circle} label="Girilmeyen" value={data.summary.not_entered} tone="text-slate-500" testid="agg-stat-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="agg-stat-rate" />
              <StatCard icon={ListChecks} label="Toplam Risk İşaretlemesi" value={data.summary.total_marks} tone="text-rose-400" testid="agg-stat-marks" />
            </div>

            {/* Domains */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">Ana Risk Alanları</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button onClick={() => setDomainSort("prevalence")} data-testid="agg-domain-sort-prevalence" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "prevalence" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}>Yaygınlığa göre</button>
                <button onClick={() => setDomainSort("order")} data-testid="agg-domain-sort-order" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "order" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}>Alan sırasına göre</button>
              </div>
            </div>
            <div className="mb-8 space-y-2.5" data-testid="agg-domains">
              {sortedDomains().map((d) => <BarRow key={d.risk_domain_id} label={d.name} count={d.student_count} percentage={d.percentage} />)}
            </div>

            {/* Categories */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">36 Risk Maddesi Analizi</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button onClick={() => setCatSort("density")} data-testid="agg-cat-sort-density" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "density" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Yoğunluğa göre</button>
                <button onClick={() => setCatSort("form")} data-testid="agg-cat-sort-form" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "form" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Form sırasına göre</button>
              </div>
            </div>
            <div className="space-y-2.5" data-testid="agg-categories">
              {sortedCategories().map((c) => <BarRow key={c.risk_category_id} label={c.label} count={c.student_count} percentage={c.percentage} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
