import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, Plus, ArrowLeft, AlertTriangle, Search, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const STATUS_LABELS = { active: "Aktif", left: "Ayrıldı", graduated: "Mezun" };

export default function SchoolStudents() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null); // {school_name, district, academic_year}
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  const [q, setQ] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState("");

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (searchTerm) => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return null;
    }
    try {
      const params = searchTerm ? { q: searchTerm } : {};
      const res = await axios.get(`${API}/school/students`, { headers: h, params });
      setInfo({
        school_name: res.data.school_name,
        district: res.data.district,
        academic_year: res.data.academic_year,
      });
      setClasses(res.data.classes || []);
      setStudents(res.data.students || []);
      return res.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
      } else if (err.response?.status === 409) {
        setError(detail || "Aktif eğitim yılı belirlenemedi.");
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

  const doSearch = async (e) => {
    e.preventDefault();
    await load(q.trim());
  };

  const addStudent = async (e) => {
    e.preventDefault();
    setError(null);
    if (!studentNumber.trim() || !firstName.trim() || !lastName.trim() || !classId) {
      setError("Lütfen öğrenci no, ad, soyad ve sınıf bilgilerini doldurun.");
      return;
    }
    setAdding(true);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      await axios.post(
        `${API}/school/students`,
        {
          student_number: studentNumber.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          school_class_id: classId,
        },
        { headers: h }
      );
      setStudentNumber("");
      setFirstName("");
      setLastName("");
      setClassId("");
      await load(q.trim());
    } catch (err) {
      setError(err.response?.data?.detail || "Öğrenci eklenemedi.");
    }
    setAdding(false);
  };

  if (!ready || !info) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="students-loading">
        {error ? (
          <div className="max-w-md rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20" data-testid="students-fatal-error">
            {error}
          </div>
        ) : (
          <Loader2 size={28} className="animate-spin text-emerald-300" />
        )}
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
              <h1 className="text-lg font-extrabold text-white" data-testid="students-title">Öğrenciler</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school")}
            data-testid="students-back-btn"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400" data-testid="students-school-name">
            Okul: <span className="text-white">{info.school_name}</span>
          </p>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30" data-testid="students-academic-year">
            Eğitim Yılı: {info.academic_year}
          </span>
        </div>

        {/* Add student form */}
        <form onSubmit={addStudent} data-testid="student-add-form" className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Users size={16} className="text-emerald-300" /> Öğrenci Ekle</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Öğrenci No</label>
              <input
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                data-testid="student-number-input"
                placeholder="örn. 0012"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Ad</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="student-firstname-input"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Soyad</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="student-lastname-input"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Sınıf</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                data-testid="student-class-select"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              >
                <option value="">Seçin</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.level}/{c.branch}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              data-testid="student-add-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Öğrenci Ekle
            </button>
          </div>
          {classes.length === 0 && (
            <p className="mt-3 text-xs text-amber-300/80" data-testid="students-no-classes">
              Öğrenci eklemek için önce Sınıf Tanımları ekranından sınıf oluşturun.
            </p>
          )}
          {error && (
            <div data-testid="students-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
        </form>

        {/* Search */}
        <form onSubmit={doSearch} className="mb-4 flex items-center gap-2" data-testid="students-search-form">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="students-search-input"
              placeholder="Öğrenci no, ad veya soyad ara"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
            />
          </div>
          <button
            type="submit"
            data-testid="students-search-btn"
            className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            Ara
          </button>
        </form>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm" data-testid="students-table">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Öğrenci No</th>
                <th className="px-4 py-3 font-semibold">Ad</th>
                <th className="px-4 py-3 font-semibold">Soyad</th>
                <th className="px-4 py-3 font-semibold">Sınıf / Şube</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {students.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Öğrenci bulunamadı.</td></tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="text-slate-300 hover:bg-white/[0.02]" data-testid={`student-row-${s.id}`}>
                    <td className="px-4 py-2.5 font-semibold text-white">{s.student_number}</td>
                    <td className="px-4 py-2.5">{s.first_name}</td>
                    <td className="px-4 py-2.5">{s.last_name}</td>
                    <td className="px-4 py-2.5">{s.class_label || <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
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
