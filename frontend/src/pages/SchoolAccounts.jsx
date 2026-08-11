import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Loader2, LogOut, Search, UserPlus, Copy, Check, X, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function CopyBtn({ label, value, testid }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (_) {}
  };
  return (
    <button
      onClick={copy}
      data-testid={testid}
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1]"
    >
      {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {label}
    </button>
  );
}

function ResultModal({ result, onClose }) {
  const all = `Okul: ${result.school_name}\nKullanıcı adı: ${result.username}\nGeçici şifre: ${result.temp_password}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="account-result-modal">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1629] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Hesap Oluşturuldu</h3>
          <button onClick={onClose} data-testid="modal-close-btn" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-slate-400">Okul: <span className="text-slate-200">{result.school_name}</span></p>
          <p className="text-slate-400">Kullanıcı adı: <span className="font-semibold text-white" data-testid="result-username">{result.username}</span></p>
          <p className="text-slate-400">Geçici şifre: <span className="font-mono font-semibold text-emerald-300" data-testid="result-password">{result.temp_password}</span></p>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300 ring-1 ring-amber-400/20">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Geçici şifre bu pencere kapatıldıktan sonra <b>tekrar görüntülenemez</b>. Lütfen şimdi kopyalayın.</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyBtn label="Kullanıcı Adını Kopyala" value={result.username} testid="copy-username" />
          <CopyBtn label="Geçici Şifreyi Kopyala" value={result.temp_password} testid="copy-password" />
          <CopyBtn label="Tüm Bilgileri Kopyala" value={all} testid="copy-all" />
        </div>
      </div>
    </div>
  );
}

export default function SchoolAccounts() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creatingId, setCreatingId] = useState(null);
  const [result, setResult] = useState(null);
  const debounceRef = useRef();

  // Auth gate (server-side authoritative via /api/admin/me)
  useEffect(() => {
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/admin/login", { replace: true });
      try {
        await axios.get(`${API}/admin/me`, { headers: h });
        const d = await axios.get(`${API}/admin/districts`, { headers: h });
        setDistricts(d.data.districts || []);
        setReady(true);
      } catch (_) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      }
    })();
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeader();
      if (!h) return navigate("/admin/login", { replace: true });
      const params = { status };
      if (districtId) params.district_id = districtId;
      if (q.trim()) params.q = q.trim();
      const res = await axios.get(`${API}/admin/school-accounts`, { headers: h, params });
      setItems(res.data.items || []);
      setSummary(res.data.summary || null);
    } catch (e) {
      setError("Liste yüklenemedi.");
    }
    setLoading(false);
  }, [districtId, q, status, navigate]);

  // Fetch when ready + on filter change (debounced for q)
  useEffect(() => {
    if (!ready) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 350);
    return () => clearTimeout(debounceRef.current);
  }, [ready, load]);

  const createAccount = async (school_id) => {
    setCreatingId(school_id);
    setError(null);
    try {
      const h = await authHeader();
      if (!h) return navigate("/admin/login", { replace: true });
      const res = await axios.post(`${API}/admin/school-accounts`, { school_id }, { headers: h });
      setResult(res.data);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Hesap oluşturulamadı.");
    }
    setCreatingId(null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="sa-loading">
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
              <h1 className="text-lg font-extrabold text-white">Okul Hesapları</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/admin")} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              ← Yönetim
            </button>
            <button onClick={logout} data-testid="sa-logout-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
              <LogOut size={15} /> Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Filters */}
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">İlçe</label>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              data-testid="filter-district"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
            >
              <option value="">Tümü</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Okul adı ara</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="filter-search"
                placeholder="Okul adı"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-400/60"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Hesap durumu</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              data-testid="filter-status"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
            >
              <option value="all">Tümü</option>
              <option value="has">Hesabı olan</option>
              <option value="none">Hesabı olmayan</option>
            </select>
          </div>
        </div>

        {summary && (
          <p className="mb-3 text-sm text-slate-400" data-testid="sa-summary">
            Toplam <span className="text-white">{summary.total}</span> · Hesabı olan <span className="text-emerald-300">{summary.with_account}</span> · Hesabı olmayan <span className="text-amber-300">{summary.without_account}</span>
          </p>
        )}

        {error && (
          <div data-testid="sa-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm" data-testid="sa-table">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Okul Adı</th>
                <th className="px-4 py-3 font-semibold">İlçe</th>
                <th className="px-4 py-3 font-semibold">Tür</th>
                <th className="px-4 py-3 font-semibold">Yönetim</th>
                <th className="px-4 py-3 font-semibold">Hesap</th>
                <th className="px-4 py-3 font-semibold">Kullanıcı Adı</th>
                <th className="px-4 py-3 font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              ) : (
                items.map((it) => (
                  <tr key={it.school_id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`sa-row-${it.school_id}`}>
                    <td className="px-4 py-2.5">{it.name}</td>
                    <td className="px-4 py-2.5 text-slate-400">{it.district}</td>
                    <td className="px-4 py-2.5 text-slate-400">{it.school_type}</td>
                    <td className="px-4 py-2.5 text-slate-400">{it.management_type}</td>
                    <td className="px-4 py-2.5">
                      {it.has_account ? (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">Hesap var</span>
                      ) : (
                        <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-400/30">Hesap yok</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">{it.username || "—"}</td>
                    <td className="px-4 py-2.5">
                      {!it.has_account && (
                        <button
                          onClick={() => createAccount(it.school_id)}
                          disabled={creatingId === it.school_id}
                          data-testid={`create-account-${it.school_id}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                        >
                          {creatingId === it.school_id ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                          Hesap Oluştur
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {result && <ResultModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}
