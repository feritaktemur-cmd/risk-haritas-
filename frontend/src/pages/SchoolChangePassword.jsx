import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { KeyRound, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolChangePassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      try {
        await axios.get(`${API}/school/session`, { headers: h });
        setReady(true);
      } catch (_) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
      }
    })();
  }, [navigate]);

  const valid = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw1 !== pw2) {
      setError("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }
    if (!valid(pw1)) {
      setError("Şifreniz en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.");
      return;
    }
    setLoading(true);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      await axios.post(`${API}/school/change-password`, { new_password: pw1 }, { headers: h });
      navigate("/school/modules", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Şifre değiştirilemedi.");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="scp-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent)] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Şifre Değiştir</h1>
          <p className="mt-2 text-sm text-slate-400">İlk girişte şifrenizi belirlemeniz gerekmektedir.</p>
        </div>

        <form onSubmit={onSubmit} data-testid="scp-form" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <label className="mb-1 block text-sm font-medium text-slate-300">Yeni şifre</label>
          <input
            type="password"
            required
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            data-testid="scp-pw1"
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
            placeholder="••••••••"
          />
          <label className="mb-1 block text-sm font-medium text-slate-300">Yeni şifre (tekrar)</label>
          <input
            type="password"
            required
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            data-testid="scp-pw2"
            className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
            placeholder="••••••••"
          />
          <p className="mb-4 text-xs text-slate-500">Şifreniz en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.</p>

          {error && (
            <div data-testid="scp-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="scp-submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Şifreyi Değiştir
          </button>
        </form>
      </div>
    </div>
  );
}
