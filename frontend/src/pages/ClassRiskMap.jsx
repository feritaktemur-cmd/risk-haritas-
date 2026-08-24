import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, ListChecks } from "lucide-react";
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

export default function ClassRiskMap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState("density"); // density | form

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/school/risk/init`, { headers: h });
      setInfo({ school_name: res.data.school_name, academic_year: res.data.academic_year });
      setClasses(res.data.classes || []);
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

  useEffect(() => {
    (async () => {
      const d = await bootstrap();
      if (d) setReady(true);
    })();
  }, [bootstrap]);

  const loadAnalysis = useCallback(async (cid) => {
    setData(null);
    setError(null);
    if (!cid) return;
    setLoading(true);
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/risk-map/class`, { headers: h, params: { school_class_id: cid } });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Analiz yüklenemedi.");
    }
    setLoading(false);
  }, [navigate]);

  const onClassChange = (cid) => {
    setClassId(cid);
    loadAnalysis(cid);
  };

  const sortedCategories = () => {
    if (!data) return [];
    const arr = [...data.categories];
    if (sortMode === "form") {
      arr.sort((a, b) => a.sort_order - b.sort_order);
    } else {
      arr.sort((a, b) => (b.student_count - a.student_count) || (a.sort_order - b.sort_order));
    }
    return arr;
  };

  if (!ready || !info) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riskmap-loading">
        {error ? (
          <div className="max-w-md rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20" data-testid="riskmap-fatal-error">{error}</div>
        ) : (
          <Loader2 size={28} className="animate-spin text-emerald-300" />
        )}
      </div>
    );
  }

  const cats = sortedCategories();
  const maxCount = data ? Math.max(1, ...data.categories.map((c) => c.student_count)) : 1;

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="riskmap-title">Sınıf Risk Haritası</h1>
            </div>
          </div>
          <button onClick={() => navigate("/school")} data-testid="riskmap-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400" data-testid="riskmap-school-name">Okul: <span className="text-white">{info.school_name}</span></p>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30" data-testid="riskmap-academic-year">Eğitim Yılı: {info.academic_year}</span>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <label className="mb-2 block text-sm font-bold text-white">Sınıf / Şube Seç</label>
          <select
            value={classId}
            onChange={(e) => onClassChange(e.target.value)}
            data-testid="riskmap-class-select"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
          >
            <option value="">Seçin</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.level}/{c.branch}</option>
            ))}
          </select>
        </div>

        {error && classId && (
          <div data-testid="riskmap-error" className="mb-6 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="grid place-items-center py-16"><Loader2 size={26} className="animate-spin text-emerald-300" /></div>
        )}

        {!loading && data && (
          <div data-testid="riskmap-analysis">
            {/* Summary cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="stat-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="stat-completed" />
              <StatCard icon={Circle} label="Girilmeyen" value={data.summary.not_entered} tone="text-slate-500" testid="stat-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="stat-rate" />
              <StatCard icon={ListChecks} label="Toplam Risk İşaretlemesi" value={data.summary.total_marks} tone="text-rose-400" testid="stat-marks" />
            </div>

            {/* Sort toggle */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-white">36 Risk Maddesi Analizi <span className="text-sm font-normal text-slate-400">({data.class_label})</span></h2>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button
                  onClick={() => setSortMode("density")}
                  data-testid="sort-density"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sortMode === "density" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}
                >Yoğunluğa göre</button>
                <button
                  onClick={() => setSortMode("form")}
                  data-testid="sort-form"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sortMode === "form" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}
                >Form sırasına göre</button>
              </div>
            </div>

            {data.summary.completed === 0 && (
              <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300/90 ring-1 ring-amber-400/20" data-testid="riskmap-no-data">
                Bu sınıfta henüz tamamlanmış Risk Haritası formu yok. Oranlar %0 görünecektir.
              </p>
            )}

            {/* Horizontal bar chart */}
            <div className="mb-8 space-y-2.5" data-testid="riskmap-bars">
              {cats.map((c) => (
                <div key={c.risk_category_id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid={`bar-${c.code}`}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm text-slate-200">{c.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-300">{c.student_count} öğrenci — %{c.percentage}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all"
                      style={{ width: `${Math.round((c.student_count / maxCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm" data-testid="riskmap-table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sıra</th>
                    <th className="px-4 py-3 font-semibold">Risk Maddesi</th>
                    <th className="px-4 py-3 font-semibold">Öğrenci Sayısı</th>
                    <th className="px-4 py-3 font-semibold">Oran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cats.map((c, i) => (
                    <tr key={c.risk_category_id} className="text-slate-300" data-testid={`row-${c.code}`}>
                      <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-200">{c.label}</td>
                      <td className="px-4 py-2.5 font-semibold text-white">{c.student_count}</td>
                      <td className="px-4 py-2.5">%{c.percentage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
