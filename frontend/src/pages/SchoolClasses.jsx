import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, Plus, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BRANCHES = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A-Z

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolClasses() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null); // {school_name, is_preschool, level_options}
  const [classes, setClasses] = useState([]);
  const [level, setLevel] = useState("");
  const [branch, setBranch] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return null;
    }
    try {
      const res = await axios.get(`${API}/school/classes`, { headers: h });
      setInfo({
        school_name: res.data.school_name,
        district: res.data.district,
        is_preschool: res.data.is_preschool,
        level_options: res.data.level_options,
      });
      setClasses(res.data.classes || []);
      return res.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
      } else {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
      }
      return null;
    }
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const d = await load();
      if (d) setReady(true);
    })();
  }, [load]);

  const addClass = async (e) => {
    e.preventDefault();
    setError(null);
    if (!level || !branch) {
      setError("Lütfen seviye ve şube seçin.");
      return;
    }
    setAdding(true);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      await axios.post(`${API}/school/classes`, { level: Number(level), branch }, { headers: h });
      setBranch("");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Sınıf eklenemedi.");
    }
    setAdding(false);
  };

  const removeClass = async (cls) => {
    if (!window.confirm(`${cls.level}/${cls.branch} sınıfını silmek istediğinize emin misiniz?`)) return;
    setDeletingId(cls.id);
    setError(null);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      await axios.delete(`${API}/school/classes/${cls.id}`, { headers: h });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Sınıf silinemedi.");
    }
    setDeletingId(null);
  };

  if (!ready || !info) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="classes-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const levelLabel = info.is_preschool ? "Yaş Grubu" : "Sınıf Seviyesi";

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
              <h1 className="text-lg font-extrabold text-white" data-testid="classes-title">Sınıf Tanımları</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school")}
            data-testid="classes-back-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 text-sm text-slate-400" data-testid="classes-school-name">
          Okul: <span className="text-white">{info.school_name}</span>
        </p>

        {/* Add form */}
        <form onSubmit={addClass} data-testid="class-add-form" className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">{levelLabel}</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                data-testid="class-level-select"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              >
                <option value="">Seçin</option>
                {info.level_options.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Şube</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                data-testid="class-branch-select"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              >
                <option value="">Seçin</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              data-testid="class-add-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Sınıf Ekle
            </button>
          </div>
          {error && (
            <div data-testid="classes-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
        </form>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm" data-testid="classes-table">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Sınıf</th>
                <th className="px-4 py-3 font-semibold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {classes.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-10 text-center text-slate-500">Henüz sınıf tanımlanmadı.</td></tr>
              ) : (
                classes.map((c) => (
                  <tr key={c.id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`class-row-${c.id}`}>
                    <td className="px-4 py-2.5 font-semibold text-white">{c.level}/{c.branch}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => removeClass(c)}
                        disabled={deletingId === c.id}
                        data-testid={`class-delete-${c.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 ring-1 ring-rose-400/30 transition hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        {deletingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Sil
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
