import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, Building2, Plus, KeyRound, Copy, CheckCircle2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function AdminRams() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [rams, setRams] = useState([]);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [creatingId, setCreatingId] = useState(null);
  const [credential, setCredential] = useState(null); // { ram_id, username, temporary_password }
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const res = await axios.get(`${API}/admin/rams`, { headers: h });
      setRams(res.data.rams || []);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); return; }
      setError("RAM listesi yüklenemedi.");
    }
  }, [navigate]);

  useEffect(() => { (async () => { await load(); setReady(true); })(); }, [load]);

  const addRam = async () => {
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(null);
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      await axios.post(`${API}/admin/rams`, { name: trimmed }, { headers: h });
      setName("");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "RAM kurumu oluşturulamadı.");
    }
    setAdding(false);
  };

  const createAccount = async (ramId) => {
    if (creatingId) return;
    setCreatingId(ramId);
    setError(null);
    const h = await authHeader();
    if (!h) { navigate("/admin/login", { replace: true }); return; }
    try {
      const res = await axios.post(`${API}/admin/ram-accounts`, { ram_id: ramId }, { headers: h });
      setCredential(res.data);
      setCopied(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "RAM hesabı oluşturulamadı.");
    }
    setCreatingId(null);
  };

  const copyCreds = async () => {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(`Kullanıcı adı: ${credential.username}\nGeçici şifre: ${credential.temporary_password}`);
      setCopied(true);
    } catch (_) { /* clipboard may be blocked; ignore */ }
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="adminrams-loading">
        <Loader2 size={28} className="animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="adminrams-title">RAM Yönetimi</h1>
            </div>
          </div>
          <button onClick={() => navigate("/admin")} data-testid="adminrams-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Panele Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-slate-400">RAM kurumlarını oluşturun ve her kurum için tek kurumsal giriş hesabı tanımlayın.</p>

        {error && (
          <div data-testid="adminrams-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* Yeni RAM ekle */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <label className="mb-1 block text-xs font-medium text-slate-400">RAM Adı</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRam(); }}
              placeholder="Örn. Çukurova Rehberlik ve Araştırma Merkezi"
              data-testid="adminrams-name-input"
              className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
            />
            <button
              onClick={addRam}
              disabled={!name.trim() || adding}
              data-testid="adminrams-add-btn"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500/90 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} RAM Ekle
            </button>
          </div>
        </div>

        {/* RAM listesi */}
        <div className="mt-6 space-y-3" data-testid="adminrams-list">
          {rams.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400" data-testid="adminrams-empty">
              Henüz RAM kurumu eklenmedi.
            </p>
          ) : (
            rams.map((r) => (
              <div key={r.id} data-testid={`adminrams-row-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-white">{r.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ${r.is_active ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-white/10 text-slate-400 ring-white/10"}`}>
                      {r.is_active ? "Aktif" : "Pasif"}
                    </span>
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ${r.has_account ? "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30" : "bg-white/10 text-slate-400 ring-white/10"}`}>
                      {r.has_account ? "Hesap var" : "Hesap yok"}
                    </span>
                  </div>
                </div>
                {!r.has_account && (
                  <button
                    onClick={() => createAccount(r.id)}
                    disabled={creatingId === r.id || !r.is_active}
                    data-testid={`adminrams-create-account-${r.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creatingId === r.id ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Hesap Oluştur
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Kimlik bilgisi modalı (bir kez) */}
      {credential && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="adminrams-cred-modal">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">RAM Hesabı Oluşturuldu</h3>
              <button onClick={() => setCredential(null)} data-testid="adminrams-cred-close" className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">Kullanıcı Adı</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-white" data-testid="adminrams-cred-username">{credential.username}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">Geçici Şifre</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-white" data-testid="adminrams-cred-password">{credential.temporary_password}</p>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300 ring-1 ring-amber-400/20">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>Geçici şifre yalnızca bu ekranda bir kez gösterilir. Kaydediniz.</span>
              </div>
              <button
                onClick={copyCreds}
                data-testid="adminrams-cred-copy"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
              >
                {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied ? "Kopyalandı" : "Bilgileri Kopyala"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
