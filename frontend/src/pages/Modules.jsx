import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut, MapPinned, BarChart3, GraduationCap, ArrowUpRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const LGS_URL = "https://pusulalgs.com.tr";

export default function Modules({ variant = "school" }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  const loginRoute = variant === "admin" ? "/admin/login" : "/school/login";
  const riskTarget = variant === "admin" ? "/admin" : "/school";

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) {
        navigate(loginRoute, { replace: true });
        return;
      }
      if (active) setChecking(false);
    })();
    return () => { active = false; };
  }, [navigate, loginRoute]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate(loginRoute, { replace: true });
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="modules-loading">
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
              <MapPinned size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="modules-title">Modüller</h1>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="modules-logout-btn"
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
          PDRPUSULA rehberlik platformu üzerinden kullanmak istediğiniz modülü seçerek devam edin.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {/* Risk Haritası */}
          <button
            onClick={() => navigate(riskTarget)}
            data-testid="module-risk-map"
            className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <BarChart3 size={24} />
            </span>
            <span className="mt-4 block text-base font-bold text-white">Risk Haritası</span>
            <span className="mt-2 block text-sm text-slate-400">
              Öğrenci risk verilerinin girilmesi, sınıf ve okul risk haritalarının oluşturulması ve RAM düzeyinde analiz edilmesi.
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300">
              Aç <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </button>

          {/* LGS Tercih Sistemi */}
          <a
            href={LGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="module-lgs"
            className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <GraduationCap size={24} />
            </span>
            <span className="mt-4 flex items-center gap-1 text-base font-bold text-white">
              LGS Tercih Sistemi <ArrowUpRight size={16} className="text-indigo-300" />
            </span>
            <span className="mt-2 block text-sm text-slate-400">
              Ortaokullara yönelik LGS tercih danışmanlığı sistemi.
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-300">
              Yeni sekmede aç <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </a>
        </div>
      </main>
    </div>
  );
}
