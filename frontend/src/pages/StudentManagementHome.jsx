import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, LogOut, MapPin, LayoutGrid, Users, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function NavCard({ onClick, testId, icon: Icon, title, desc, hoverCls, iconCls }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-left transition ${hoverCls} hover:bg-white/[0.06]`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${iconCls}`}>
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="block text-xs text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

export default function StudentManagementHome() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      try {
        const res = await axios.get(`${API}/school/panel`, { headers: h });
        if (active) setPanel(res.data);
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

  if (!panel) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="student-mgmt-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/school/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <School size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="student-mgmt-title">Öğrenci Yönetimi</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/school/modules")}
              data-testid="student-mgmt-modules-btn"
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              <ArrowLeft size={15} /> Modüller
            </button>
            <button
              onClick={logout}
              data-testid="student-mgmt-logout-btn"
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              <LogOut size={15} /> Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <p className="text-sm text-slate-400">Hoş geldiniz</p>
          <p className="mt-1 text-2xl font-extrabold text-white" data-testid="student-mgmt-school-name">{panel.school_name}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30" data-testid="student-mgmt-district">
            <MapPin size={14} /> {panel.district}
          </p>
        </div>

        <div className="mt-6 grid max-w-2xl gap-4">
          <NavCard
            onClick={() => navigate("/school/student-management/classes")}
            testId="nav-classes"
            icon={LayoutGrid}
            title="Sınıf Tanımları"
            desc="Sınıf/şube tanımlarını görüntüle ve ekle"
            hoverCls="hover:border-emerald-400/40"
            iconCls="bg-emerald-500/15 text-emerald-300"
          />
          <NavCard
            onClick={() => navigate("/school/student-management/students")}
            testId="nav-students"
            icon={Users}
            title="Öğrenciler"
            desc="Öğrenci listesini görüntüle ve öğrenci ekle"
            hoverCls="hover:border-indigo-400/40"
            iconCls="bg-indigo-500/15 text-indigo-300"
          />
        </div>
      </main>
    </div>
  );
}
