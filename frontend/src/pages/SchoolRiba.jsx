import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Loader2, ClipboardList, ArrowLeft, Plus, Inbox, CheckCircle2, AlertTriangle, Users, CalendarDays, Settings2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
  draft: "Taslak",
  active: "Aktif",
  closed: "Kapalı",
  finalized: "Sonuçlandırılmış",
};

const STATUS_STYLES = {
  draft: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  closed: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  finalized: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SchoolRiba() {
  const navigate = useNavigate();
  const location = useLocation();
  const [flash, setFlash] = useState(location.state?.flash || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (location.state?.flash) {
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return;
    }
    try {
      const res = await axios.get(`${API}/school/riba/applications`, { headers: h });
      setApplications(res.data.applications || []);
      setError(null);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
        return;
      }
      if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setError("RİBA uygulamaları yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riba-home-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="riba-home-title">RİBA</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/modules")}
            data-testid="riba-back-modules"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> Modüllere Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-300/80">Rehberlik İhtiyacı Belirleme Anketi</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white">RİBA</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              RİBA uygulamalarınızı oluşturabilir, katılım durumunu takip edebilir ve sonuçları görüntüleyebilirsiniz.
            </p>
          </div>
          <button
            onClick={() => navigate("/school/riba/new")}
            data-testid="riba-new-btn-top"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
          >
            <Plus size={16} /> Yeni RİBA Uygulaması
          </button>
        </div>

        {flash && (
          <div
            data-testid="riba-flash"
            className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200 ring-1 ring-emerald-400/20"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{flash}</span>
          </div>
        )}

        {error && (
          <div
            data-testid="riba-list-error"
            className="mt-6 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {!error && applications.length === 0 && (
          <div
            data-testid="riba-empty-state"
            className="mt-8 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-slate-400">
              <Inbox size={26} />
            </span>
            <p className="mt-4 text-base font-bold text-white">Henüz RİBA uygulaması bulunmuyor.</p>
            <p className="mt-1 text-sm text-slate-400">Yeni bir RİBA uygulaması oluşturarak başlayabilirsiniz.</p>
            <button
              onClick={() => navigate("/school/riba/new")}
              data-testid="riba-new-btn"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
            >
              <Plus size={16} /> Yeni RİBA Uygulaması
            </button>
          </div>
        )}

        {!error && applications.length > 0 && (
          <div className="mt-8 space-y-4" data-testid="riba-app-list">
            {applications.map((app) => {
              const label = STATUS_LABELS[app.status] || app.status;
              const badge = STATUS_STYLES[app.status] || "bg-white/10 text-slate-300 ring-white/20";
              const created = formatDate(app.created_at);
              const opened = formatDate(app.opened_at);
              const closed = formatDate(app.closed_at);
              return (
                <div
                  key={app.id}
                  data-testid={`riba-app-card-${app.id}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-extrabold text-white" data-testid={`riba-app-name-${app.id}`}>
                          {app.name}
                        </h3>
                        <span
                          data-testid={`riba-app-status-${app.id}`}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${badge}`}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400" data-testid={`riba-app-year-${app.id}`}>
                        Eğitim Öğretim Yılı: <span className="text-slate-200">{app.academic_year || "—"}</span>
                      </p>
                    </div>
                    {app.status === "draft" && (
                      <button
                        onClick={() => navigate(`/school/riba/${app.id}`)}
                        data-testid={`riba-app-manage-${app.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
                      >
                        <Settings2 size={15} /> Uygulamayı Yönet
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dahil Sınıflar</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid={`riba-app-classes-${app.id}`}>
                        {app.classes && app.classes.length > 0 ? (
                          app.classes.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10"
                            >
                              {c.name || `${c.level}/${c.branch}`}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <Users size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span data-testid={`riba-app-teachers-${app.id}`}>
                        Toplam Öğretmen: <span className="font-bold text-white">{app.teacher_count}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-white/10 pt-3 text-xs text-slate-400">
                    {created && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> Oluşturulma: <span className="text-slate-300">{created}</span>
                      </span>
                    )}
                    {opened && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> Başlangıç: <span className="text-slate-300">{opened}</span>
                      </span>
                    )}
                    {closed && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> Kapanış: <span className="text-slate-300">{closed}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
