import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ClipboardList, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

export default function SchoolRibaNew() {
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
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riba-new-loading">
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
              <h1 className="text-lg font-extrabold text-white" data-testid="riba-new-title">Yeni RİBA Uygulaması</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/riba")}
            data-testid="riba-new-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> RİBA'ya Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center" data-testid="riba-new-placeholder">
          <h2 className="text-xl font-extrabold text-white">Yeni RİBA Uygulaması</h2>
          <p className="mt-3 text-sm text-slate-400">
            Uygulama oluşturma ekranı sonraki adımda hazırlanacaktır.
          </p>
        </div>
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
