import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Loader2, LogOut, Users, FileSpreadsheet } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminHome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null); // null = loading
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        navigate("/admin/login", { replace: true });
        return;
      }
      try {
        const res = await axios.get(`${API}/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) {
          setProfile(res.data);
          setChecking(false);
        }
      } catch (_) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  if (checking || !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="admin-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="admin-title">RAM Yönetimi</h1>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="admin-logout-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <LogOut size={15} /> Çıkış Yap
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <p className="text-sm text-slate-400">Hoş geldiniz</p>
          <p className="mt-1 text-2xl font-extrabold text-white" data-testid="admin-fullname">{profile.full_name}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-1 text-sm font-semibold text-indigo-300 ring-1 ring-indigo-400/30" data-testid="admin-role">
            Rolü: Genel Admin
          </p>
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate("/admin/school-accounts")}
            data-testid="nav-school-accounts"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <Users size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Okul Hesapları</span>
              <span className="block text-xs text-slate-400">Okulları görüntüle ve hesap oluştur</span>
            </span>
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={() => navigate("/admin/school-import")}
            data-testid="nav-school-import"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <FileSpreadsheet size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Okul İçe Aktarma</span>
              <span className="block text-xs text-slate-400">Excel ile okul kayıtlarını ön izle ve içe aktar</span>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
