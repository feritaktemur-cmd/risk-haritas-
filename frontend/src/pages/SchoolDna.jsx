import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, CalendarX2, ArrowLeft, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";
import { DnaShareCard } from "../components/DnaShareCard";
import { DnaActivateButton } from "../components/DnaActivateButton";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS = {
  draft: { label: "Taslak", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  active: { label: "Aktif", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  closed: { label: "Kapalı", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("tr-TR") : "—");

function StatusBadge({ status, testId }) {
  const s = STATUS[status] || { label: status, cls: "bg-white/10 text-slate-300 ring-white/20" };
  return (
    <span data-testid={testId} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${s.cls}`}>
      {s.label}
    </span>
  );
}

function ApplicationRow({ app, getHeaders, onChanged }) {
  return (
    <li data-testid={`dna-app-${app.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-bold text-white" data-testid={`dna-app-name-${app.id}`}>{app.name}</p>
        <div className="flex items-center gap-2">
          {app.status === "draft" && <DnaActivateButton app={app} getHeaders={getHeaders} onActivated={onChanged} />}
          <StatusBadge status={app.status} testId={`dna-app-status-${app.id}`} />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {app.academic_year || "—"} · Oluşturma: {fmtDate(app.created_at)} · {app.class_count} sınıf
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {app.classes.map((c) => (
          <span key={c.id} className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-slate-300">
            {c.level}/{c.branch}
          </span>
        ))}
      </div>
      {app.status === "active" && <DnaShareCard appId={app.id} appName={app.name} getHeaders={getHeaders} />}
    </li>
  );
}

export default function SchoolDna() {
  const navigate = useNavigate();
  const location = useLocation();
  const flash = location.state?.flash;
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/dna/applications`, { headers: h });
      setApps(res.data.applications || []);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 && err.response?.data?.detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
      } else if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
      } else {
        setError("DNA uygulamaları yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
        setApps([]);
      }
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(245,158,11,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-400 text-white">
              <CalendarX2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="dna-title">DNA Uygulamaları</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/modules")}
            data-testid="dna-back-modules"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> Modüller
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-300/80">Devamsızlık Nedenleri Anketi</p>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Devamsızlık sorunu yaşayan öğrencilere uygulanacak DNA uygulamalarını oluşturun ve durumlarını takip edin.
            </p>
          </div>
          <button
            onClick={() => navigate("/school/dna/new")}
            data-testid="dna-new-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:opacity-90"
          >
            <Plus size={16} /> Yeni DNA Uygulaması
          </button>
        </div>

        {flash && (
          <div data-testid="dna-flash" className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300 ring-1 ring-emerald-400/20">
            <CheckCircle2 size={16} /> {flash}
          </div>
        )}
        {error && (
          <div data-testid="dna-list-error" className="mt-6 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="mt-8">
          {apps === null ? (
            <div className="grid place-items-center py-16" data-testid="dna-list-loading">
              <Loader2 size={26} className="animate-spin text-amber-300" />
            </div>
          ) : apps.length === 0 && !error ? (
            <p data-testid="dna-list-empty" className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-slate-400">
              Henüz DNA uygulaması oluşturulmamış.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="dna-list">
              {apps.map((a) => (
                <ApplicationRow key={a.id} app={a} getHeaders={authHeader} onChanged={load} />
              ))}
            </ul>
          )}
        </div>
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
