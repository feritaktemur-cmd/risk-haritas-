import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import SchoolImportPreview from "./SchoolImportPreview";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function AdminSchoolImport() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Server-side authoritative General Admin gate (same model as other /admin pages).
  useEffect(() => {
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/admin/login", { replace: true });
      try {
        await axios.get(`${API}/admin/me`, { headers: h });
        setReady(true);
      } catch (_) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      }
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="asi-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA · RAM</p>
              <h1 className="text-lg font-extrabold text-white">Okul İçe Aktarma</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            data-testid="asi-back-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> Yönetim
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Reuse the existing, working import/preview component unchanged. */}
        <SchoolImportPreview />
      </main>
    </div>
  );
}
