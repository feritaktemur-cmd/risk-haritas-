import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ClipboardList, ArrowLeft, Plus, Inbox } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

export default function SchoolRiba() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) {
        navigate("/school/login", { replace: true });
        return;
      }
      if (active) setChecking(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  if (checking) {
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
        <p className="text-sm font-semibold text-emerald-300/80">Rehberlik İhtiyacı Belirleme Anketi</p>
        <h2 className="mt-1 text-2xl font-extrabold text-white">RİBA</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          RİBA uygulamalarınızı oluşturabilir, katılım durumunu takip edebilir ve sonuçları görüntüleyebilirsiniz.
        </p>

        {/* Empty state */}
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
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
