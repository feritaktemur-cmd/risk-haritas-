import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, LogOut, MapPin, LayoutGrid, Users, ShieldAlert, BarChart3, Building2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolHome() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      try {
        const res = await axios.get(`${API}/school/panel`, { headers: h });
        if (active) {
          setPanel(res.data);
          setChecking(false);
        }
      } catch (err) {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 403 && detail === "password_change_required") {
          navigate("/school/change-password", { replace: true });
        } else {
          await supabase.auth.signOut();
          navigate("/school/login", { replace: true });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/school/login", { replace: true });
  };

  if (checking || !panel) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="school-loading">
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
              <School size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="school-panel-title">Okul Paneli</h1>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="school-logout-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <LogOut size={15} /> Çıkış Yap
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <p className="text-sm text-slate-400">Hoş geldiniz</p>
          <p className="mt-1 text-2xl font-extrabold text-white" data-testid="school-name">{panel.school_name}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30" data-testid="school-district">
            <MapPin size={14} /> {panel.district}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => navigate("/school/classes")}
            data-testid="nav-classes"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <LayoutGrid size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Sınıf Tanımları</span>
              <span className="block text-xs text-slate-400">Sınıf/şube tanımlarını görüntüle ve ekle</span>
            </span>
          </button>

          <button
            onClick={() => navigate("/school/students")}
            data-testid="nav-students"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <Users size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Öğrenciler</span>
              <span className="block text-xs text-slate-400">Öğrenci listesini görüntüle ve öğrenci ekle</span>
            </span>
          </button>

          <button
            onClick={() => navigate("/school/risk-entry")}
            data-testid="nav-risk-entry"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-rose-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
              <ShieldAlert size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Risk Haritası Veri Girişi</span>
              <span className="block text-xs text-slate-400">Öğrencilerin risk haritası verilerini girin ve düzenleyin.</span>
            </span>
          </button>

          <button
            onClick={() => navigate("/school/risk-map")}
            data-testid="nav-risk-map"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <BarChart3 size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Sınıf Risk Haritası</span>
              <span className="block text-xs text-slate-400">Seçilen sınıfın toplu risk analizini görüntüleyin.</span>
            </span>
          </button>

          <button
            onClick={() => navigate("/school/risk-map/school")}
            data-testid="nav-school-risk-map"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Building2 size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Okul Risk Haritası</span>
              <span className="block text-xs text-slate-400">Okulun geneli için toplu risk profilini görüntüleyin.</span>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
