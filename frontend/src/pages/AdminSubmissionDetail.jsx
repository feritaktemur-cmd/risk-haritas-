import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
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

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }); }
  catch (_) { return iso; }
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

export default function AdminSubmissionDetail() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [domainSort, setDomainSort] = useState("prevalence"); // prevalence | order
  const [catSort, setCatSort] = useState("density"); // density | form

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const res = await axios.get(`${API}/admin/risk-map/submissions/${submissionId}`, { headers: h });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
        return;
      }
      if (err.response?.status === 404) setError("Gönderim kaydı bulunamadı.");
      else if (err.response?.status === 403) setError("Bu hesabın yönetim erişimi yok.");
      else setError("Gönderim detayları yüklenemedi. Lütfen tekrar deneyin.");
    }
    setReady(true);
  }, [navigate, submissionId]);

  useEffect(() => { load(); }, [load]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="detail-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/admin/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="detail-title">Okul Gönderim Detayı</h1>
            </div>
          </div>
          <button onClick={() => navigate("/admin/risk-map")} data-testid="detail-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Gönderimleri
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error ? (
          <div data-testid="detail-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : data ? (
          <div data-testid="detail-content">
            {/* Header info */}
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-white" data-testid="detail-school-name">{data.school_name || "—"}</h2>
              <p className="mt-1 text-sm text-slate-400" data-testid="detail-meta">
                {data.district || "—"} · {data.academic_year || "—"} · Sürüm {data.version_no} · {STATUS_LABELS[data.status] || data.status} · {formatDate(data.submitted_at)}
              </p>
            </div>

            {/* Summary cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="detail-stat-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="detail-stat-completed" />
              <StatCard icon={Circle} label="Girilmeyen" value={data.summary.not_entered} tone="text-slate-500" testid="detail-stat-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="detail-stat-rate" />
              <StatCard icon={ListChecks} label="Toplam Risk İşaretlemesi" value={data.summary.total_marks} tone="text-rose-400" testid="detail-stat-marks" />
            </div>

            {/* Domains */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">Ana Risk Alanları</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button
                  onClick={() => setDomainSort("prevalence")}
                  data-testid="detail-domain-sort-prevalence"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "prevalence" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}
                >Yaygınlığa göre</button>
                <button
                  onClick={() => setDomainSort("order")}
                  data-testid="detail-domain-sort-order"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${domainSort === "order" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"}`}
                >Alan sırasına göre</button>
              </div>
            </div>
            <div className="mb-8 space-y-2.5" data-testid="detail-domains">
              {[...data.domains].sort((a, b) => domainSort === "order"
                ? a.sort_order - b.sort_order
                : (b.student_count - a.student_count) || (a.sort_order - b.sort_order)
              ).map((d) => (
                <BarRow key={d.risk_domain_id} label={d.name} count={d.student_count} percentage={d.percentage} />
              ))}
            </div>

            {/* Categories */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">36 Risk Maddesi Analizi</h3>
              <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
                <button
                  onClick={() => setCatSort("density")}
                  data-testid="detail-cat-sort-density"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "density" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}
                >Yoğunluğa göre</button>
                <button
                  onClick={() => setCatSort("form")}
                  data-testid="detail-cat-sort-form"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${catSort === "form" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"}`}
                >Form sırasına göre</button>
              </div>
            </div>
            <div className="mb-8 space-y-2.5" data-testid="detail-categories">
              {[...data.categories].sort((a, b) => catSort === "form"
                ? a.sort_order - b.sort_order
                : (b.student_count - a.student_count) || (a.sort_order - b.sort_order)
              ).map((c) => (
                <BarRow key={c.risk_category_id} label={c.label} count={c.student_count} percentage={c.percentage} />
              ))}
            </div>

            {/* Classes */}
            <h3 className="mb-3 text-base font-bold text-white">Sınıf Sonuçları</h3>
            <div className="space-y-3" data-testid="detail-classes">
              {data.classes.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">Sınıf snapshot'ı bulunmuyor.</p>
              ) : data.classes.map((c) => {
                const open = !!expanded[c.class_name];
                return (
                  <div key={c.class_name} className="rounded-2xl border border-white/10 bg-white/[0.03]" data-testid={`detail-class-${c.class_name}`}>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [c.class_name]: !open }))}
                      data-testid={`detail-class-toggle-${c.class_name}`}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-white">
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {c.class_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        Toplam {c.total_students} · Tamamlanan {c.completed_students} · Eksik {c.not_entered_students} · %{c.completion_rate} · Risk İşaretleme {c.total_risk_marks}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-white/10 px-5 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ana Risk Alanları</p>
                        <div className="mb-4 space-y-2">
                          {c.domains.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{d.name}</span>
                              <span className="text-xs font-semibold text-slate-400">{d.student_count} öğrenci — %{d.percentage}</span>
                            </div>
                          ))}
                        </div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Risk Maddeleri</p>
                        <div className="space-y-2">
                          {c.categories.map((ct, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{ct.label}</span>
                              <span className="text-xs font-semibold text-slate-400">{ct.student_count} öğrenci — %{ct.percentage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
