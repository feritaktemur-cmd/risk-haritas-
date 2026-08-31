import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, Info } from "lucide-react";
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

export default function SchoolStatistics() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/school/risk-map/school`, { headers: h });
      setData(res.data);
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
          <button onClick={() => navigate("/school")} data-testid="schoolstats-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
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
          </>
        ) : null}
      </main>
    </div>
  );
}
