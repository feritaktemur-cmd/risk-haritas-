import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut, Building2, ClipboardList } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

// /ram/activities is not built yet -> keep the card visible but disabled.
const ACTIVITIES_READY = false;

export default function RamModules() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) {
        navigate("/ram/login", { replace: true });
        return;
      }
      if (active) setChecking(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/ram/login", { replace: true });
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="rammodules-loading">
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
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="rammodules-title">RAM Modülleri</h1>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="rammodules-logout-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <LogOut size={15} /> Çıkış Yap
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-slate-400">PDRPUSULA Modülleri</p>
        <h2 className="mt-1 text-2xl font-extrabold text-white">Bir modül seçin</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          RAM kurumunuza ait çalışmaları yönetmek için aşağıdaki modülü kullanın.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <button
            onClick={() => { if (ACTIVITIES_READY) navigate("/ram/activities"); }}
            disabled={!ACTIVITIES_READY}
            data-testid="module-ram-activities"
            className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition enabled:hover:border-emerald-400/40 enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {!ACTIVITIES_READY && (
              <span className="absolute right-4 top-4 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">Yakında</span>
            )}
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <ClipboardList size={24} />
            </span>
            <span className="mt-4 block text-base font-bold text-white">RAM Çalışmaları</span>
            <span className="mt-2 block text-sm text-slate-400">
              RAM tarafından yürütülen çalışmaların kaydı, takibi, istatistikleri ve yıl sonu raporları.
            </span>
          </button>
        </div>
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
