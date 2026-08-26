import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, Building2, Users, CheckCircle2, Circle, Percent, ListChecks, Send } from "lucide-react";
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

export default function SchoolRiskMap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);
  const [domainSort, setDomainSort] = useState("prevalence"); // prevalence | order
  const [sortMode, setSortMode] = useState("density"); // density | form

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null); // {type:'success'|'error', text}

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/school/risk-map/school`, { headers: h });
      setData(res.data);
      try {
        const cmp = await axios.get(`${API}/school/risk-map/classes-comparison`, { headers: h });
        setComparison(cmp.data);
      } catch (_) { /* comparison is secondary; ignore its failure */ }
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
      const d = await load();
      if (d) setReady(true);
    })();
  }, [load]);

  const sortedCategories = () => {
    if (!data) return [];
    const arr = [...data.categories];
    if (sortMode === "form") arr.sort((a, b) => a.sort_order - b.sort_order);
    else arr.sort((a, b) => (b.student_count - a.student_count) || (a.sort_order - b.sort_order));
    return arr;
  };

  const sortedDomains = () => {
    if (!data || !data.domains) return [];
    const arr = [...data.domains];
    if (domainSort === "order") arr.sort((a, b) => a.sort_order - b.sort_order);
    else arr.sort((a, b) => (b.student_count - a.student_count) || (a.sort_order - b.sort_order));
    return arr;
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const h = await authHeader();
      if (!h) { navigate("/school/login", { replace: true }); return; }
      const res = await axios.post(`${API}/school/risk-map/submit`, {}, { headers: h });
      setConfirmOpen(false);
      setSubmitMsg({ type: "success", text: `${res.data.message} Gönderim sürümü: ${res.data.version_no}` });
    } catch (err) {
      const detail = err.response?.data?.detail;
      let text = "Gönderim sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      if (typeof detail === "string") {
        text = detail;
      } else if (detail && typeof detail === "object") {
        text = detail.message || text;
        if (detail.total_students != null) {
          text += ` (Toplam: ${detail.total_students} · Tamamlanan: ${detail.completed_students} · Eksik: ${detail.not_entered_students})`;
        }
      }
      setConfirmOpen(false);
      setSubmitMsg({ type: "error", text });
    }
    setSubmitting(false);
  };

  if (!ready || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="schoolmap-loading">
        {error ? (
          <div className="max-w-md rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20" data-testid="schoolmap-fatal-error">{error}</div>
        ) : (
          <Loader2 size={28} className="animate-spin text-emerald-300" />
        )}
      </div>
    );
  }

  const cats = sortedCategories();
  const maxCount = Math.max(1, ...data.categories.map((c) => c.student_count));
  const domains = sortedDomains();
  const maxDomainCount = data.domains ? Math.max(1, ...data.domains.map((d) => d.student_count)) : 1;

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/school/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="schoolmap-title">Okul Risk Haritası</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSubmitMsg(null); setConfirmOpen(true); }}
              disabled={submitting}
              data-testid="schoolmap-submit-btn"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {submitting ? "Gönderiliyor..." : "RAM'a Gönder"}
            </button>
            <button onClick={() => navigate("/school")} data-testid="schoolmap-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <ArrowLeft size={15} /> Okul Paneli
            </button>
          </div>
        </div>
      </header>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="schoolmap-confirm-modal">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141b2d] p-6 shadow-2xl">
            {data.summary.not_entered > 0 ? (
              <>
                <h3 className="text-base font-bold text-white" data-testid="schoolmap-confirm-title">
                  {data.summary.not_entered} öğrencinin Risk Haritası veri girişi tamamlanmamış. Bu haliyle RAM'a göndermek istediğinizden emin misiniz?
                </h3>
                <p className="mt-2 text-sm text-slate-400">Gönderim, mevcut sonuçların yeni bir sürümünü oluşturur.</p>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300/90 ring-1 ring-amber-400/20" data-testid="schoolmap-confirm-summary">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>Toplam: {data.summary.total_students} · Tamamlanan: {data.summary.completed} · Eksik: {data.summary.not_entered} · Tamamlanma: %{data.summary.completion_rate}</span>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-white" data-testid="schoolmap-confirm-title">Risk Haritası sonuçlarını RAM'a göndermek istediğinizden emin misiniz?</h3>
                <p className="mt-2 text-sm text-slate-400">Gönderim, mevcut sonuçların yeni bir sürümünü oluşturur.</p>
                <div className="mt-3 text-sm text-slate-400" data-testid="schoolmap-confirm-summary">
                  Toplam: {data.summary.total_students} · Tamamlanan: {data.summary.completed} · Tamamlanma: %{data.summary.completion_rate}
                </div>
              </>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                data-testid="schoolmap-confirm-cancel"
                className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-50"
              >Vazgeç</button>
              <button
                onClick={submit}
                disabled={submitting}
                data-testid="schoolmap-confirm-submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {data.summary.not_entered > 0 ? "Yine de RAM'a Gönder" : "RAM'a Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400" data-testid="schoolmap-school-name">Okul: <span className="text-white">{data.school_name}</span></p>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30" data-testid="schoolmap-academic-year">Eğitim Yılı: {data.academic_year}</span>
        </div>

        {submitMsg && (
          <div
            data-testid="schoolmap-submit-msg"
            className={`mb-6 flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ${submitMsg.type === "success" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : "bg-rose-500/10 text-rose-300 ring-rose-400/20"}`}
          >
            {submitMsg.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>{submitMsg.text}</span>
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="stat-total" />
          <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="stat-completed" />
          <StatCard icon={Circle} label="Girilmeyen" value={data.summary.not_entered} tone="text-slate-500" testid="stat-not-entered" />
          <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="stat-rate" />
          <StatCard icon={ListChecks} label="Toplam Risk İşaretlemesi" value={data.summary.total_marks} tone="text-rose-400" testid="stat-marks" />
        </div>

        {/* Domains */}
        <div className="mb-8" data-testid="schoolmap-domains">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Ana Risk Alanları</h2>
              <p className="mt-0.5 text-xs text-slate-400">Formu tamamlanan öğrenciler arasında, ilgili alanda en az bir risk göstergesi bulunan öğrenci oranı.</p>
            </div>
            <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
              <button onClick={() => setDomainSort("prevalence")} data-testid="domain-sort-prevalence" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "prevalence" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}>Yaygınlığa göre</button>
              <button onClick={() => setDomainSort("order")} data-testid="domain-sort-order" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "order" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}>Alan sırasına göre</button>
            </div>
          </div>

          {data.summary.completed === 0 && (
            <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300/90 ring-1 ring-amber-400/20" data-testid="schoolmap-no-data">
              Okulda henüz tamamlanmış Risk Haritası formu yok. Oranlar %0 görünecektir.
            </p>
          )}

          <div className="mb-4 space-y-2.5" data-testid="schoolmap-domain-bars">
            {domains.map((d) => (
              <div key={d.risk_domain_id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid={`domain-bar-${d.code}`}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-200">{d.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-300">{d.student_count} öğrenci — %{d.percentage}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all" style={{ width: `${Math.round((d.student_count / maxDomainCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm" data-testid="schoolmap-domain-table">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sıra</th>
                  <th className="px-4 py-3 font-semibold">Ana Risk Alanı</th>
                  <th className="px-4 py-3 font-semibold">Öğrenci Sayısı</th>
                  <th className="px-4 py-3 font-semibold">Oran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {domains.map((d, i) => (
                  <tr key={d.risk_domain_id} className="text-slate-300" data-testid={`domain-row-${d.code}`}>
                    <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-200">{d.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{d.student_count}</td>
                    <td className="px-4 py-2.5">%{d.percentage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 36 categories */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">36 Risk Maddesi Analizi</h2>
          <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
            <button onClick={() => setSortMode("density")} data-testid="sort-density" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sortMode === "density" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Yoğunluğa göre</button>
            <button onClick={() => setSortMode("form")} data-testid="sort-form" className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sortMode === "form" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}>Form sırasına göre</button>
          </div>
        </div>

        <div className="mb-8 space-y-2.5" data-testid="schoolmap-bars">
          {cats.map((c) => (
            <div key={c.risk_category_id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid={`bar-${c.code}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate-200">{c.label}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-300">{c.student_count} öğrenci — %{c.percentage}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all" style={{ width: `${Math.round((c.student_count / maxCount) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm" data-testid="schoolmap-table">
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

        {/* Classes comparison */}
        {comparison && comparison.classes.length > 0 && (
          <div className="mt-10" data-testid="schoolmap-comparison">
            <h2 className="mb-1 text-base font-bold text-white">Sınıflar Arası Karşılaştırma</h2>
            <p className="mb-4 text-xs text-slate-400">Her sınıf kendi tamamlanan öğrenci paydasıyla hesaplanır. Risk işaretleme sütunu yalnız bilgilendirme amaçlıdır.</p>

            {/* Class summary table */}
            <div className="mb-8 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm" data-testid="comparison-summary-table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sınıf</th>
                    <th className="px-4 py-3 font-semibold">Toplam Öğrenci</th>
                    <th className="px-4 py-3 font-semibold">Tamamlanan</th>
                    <th className="px-4 py-3 font-semibold">Girilmeyen</th>
                    <th className="px-4 py-3 font-semibold">Tamamlanma Oranı</th>
                    <th className="px-4 py-3 font-semibold">Risk İşaretleme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {comparison.classes.map((c) => (
                    <tr key={c.school_class_id} className="text-slate-300" data-testid={`comparison-summary-${c.class_label}`}>
                      <td className="px-4 py-2.5 font-semibold text-white">{c.class_label}</td>
                      <td className="px-4 py-2.5">{c.total_students}</td>
                      <td className="px-4 py-2.5">{c.completed}</td>
                      <td className="px-4 py-2.5">{c.not_entered}</td>
                      <td className="px-4 py-2.5">%{c.completion_rate}</td>
                      <td className="px-4 py-2.5">{c.total_marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Domains x classes matrix */}
            <h3 className="mb-1 text-sm font-bold text-white">8 Ana Risk Alanı × Sınıflar</h3>
            <p className="mb-3 text-xs text-slate-400">Hücreler, ilgili sınıfta formu tamamlanan öğrenciler arasında o alanda en az bir risk göstergesi bulunan öğrenci oranını gösterir.</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm" data-testid="comparison-matrix-table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#141b2d] px-4 py-3 font-semibold">Ana Risk Alanı</th>
                    {comparison.classes.map((c) => (
                      <th key={c.school_class_id} className="px-4 py-3 text-center font-semibold">
                        <div>{c.class_label}</div>
                        <div className="mt-0.5 text-[10px] font-normal normal-case text-slate-500">%{c.completion_rate} tamamlandı</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {comparison.domains.map((d) => (
                    <tr key={d.risk_domain_id} className="text-slate-300" data-testid={`comparison-matrix-${d.code}`}>
                      <td className="sticky left-0 z-10 bg-[#0f1626] px-4 py-2.5 text-slate-200">{d.name}</td>
                      {comparison.classes.map((c) => {
                        const cell = c.domains[d.risk_domain_id] || { student_count: 0, percentage: 0 };
                        return (
                          <td key={c.school_class_id} className="px-4 py-2.5 text-center">
                            <span className="font-semibold text-white">{cell.student_count} öğrenci</span>
                            <span className="text-slate-400"> · %{cell.percentage}</span>
                          </td>
                        );
                      })}
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
