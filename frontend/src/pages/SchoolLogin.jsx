import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SchoolLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/school/login`, {
        username: username.trim(),
        password,
      });
      // Persist the Supabase session returned by the backend.
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (data.must_change_password) {
        navigate("/school/change-password", { replace: true });
      } else {
        navigate("/school", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Kullanıcı adı veya şifre hatalı.");
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white shadow-lg shadow-emerald-500/20">
            <School size={24} />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">PDRPUSULA</p>
          <h1 className="mt-1 text-2xl font-extrabold text-white">Okul Girişi</h1>
        </div>

        <form onSubmit={onSubmit} data-testid="school-login-form" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <label className="mb-1 block text-sm font-medium text-slate-300">Kullanıcı adı</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            data-testid="school-username-input"
            autoCapitalize="none"
            autoCorrect="off"
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
            placeholder="ornekokuladi"
          />

          <label className="mb-1 block text-sm font-medium text-slate-300">Şifre</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="school-password-input"
            className="mb-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
            placeholder="••••••••"
          />

          {error && (
            <div data-testid="school-login-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="school-login-submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}
