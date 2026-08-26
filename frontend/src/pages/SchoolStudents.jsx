import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, Plus, ArrowLeft, AlertTriangle, Search, Users, FileSpreadsheet } from "lucide-react";
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

  // Excel bulk preview
  const [file, setFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null); // {summary, rows}
  const [previewError, setPreviewError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [fileKey, setFileKey] = useState(0);

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

  const runPreview = async (e) => {
    e.preventDefault();
    setPreviewError(null);
    setPreview(null);
    setImportMsg(null);
    if (!file) {
      setPreviewError("Lütfen bir Excel (.xlsx) dosyası seçin.");
      return;
    }
    setPreviewing(true);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/school/students/preview`, fd, { headers: h });
      setPreview(res.data);
    } catch (err) {
      setPreviewError(err.response?.data?.detail || "Ön izleme oluşturulamadı.");
    }
    setPreviewing(false);
  };

  const runImport = async () => {
    if (!file || !preview || preview.summary.invalid > 0 || preview.summary.total === 0) return;
    setPreviewError(null);
    setImportMsg(null);
    setImporting(true);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/school/students/import`, fd, { headers: h });
      // Success: reset the preview/file so the same file can't be re-imported by one click.
      setImportMsg(`${res.data.message} Aktarılan öğrenci sayısı: ${res.data.imported}`);
      setPreview(null);
      setFile(null);
      setFileKey((k) => k + 1);
      await load(q.trim());
    } catch (err) {
      setPreviewError(err.response?.data?.detail || "Aktarım yapılamadı.");
    }
    setImporting(false);
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
          <div onClick={() => navigate("/school/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
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

        {/* Excel bulk preview */}
        <section data-testid="students-excel-section" className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><FileSpreadsheet size={16} className="text-indigo-300" /> Excel ile Toplu Yükleme</p>
          <p className="mb-4 text-xs text-slate-400">
            Beklenen sütunlar: <span className="text-slate-200">Öğrenci No · Ad · Soyad · Sınıf · Şube</span>. Dosyayı bu formatta hazırlayın. Bu adım yalnızca ön izleme oluşturur; kayıt yazılmaz.
          </p>
          <form onSubmit={runPreview} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx"
              key={fileKey}
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setPreviewError(null); setImportMsg(null); }}
              data-testid="students-excel-file"
              className="text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
            />
            <button
              type="submit"
              disabled={previewing}
              data-testid="students-preview-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {previewing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              Ön İzleme Oluştur
            </button>
          </form>

          {previewError && (
            <div data-testid="students-preview-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{previewError}</span>
            </div>
          )}

          {importMsg && (
            <div data-testid="students-import-success" className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
              {importMsg}
            </div>
          )}

          {preview && (
            <div className="mt-5" data-testid="students-preview-result">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 font-semibold text-slate-200 ring-1 ring-white/10" data-testid="preview-total">Toplam: {preview.summary.total}</span>
                <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300 ring-1 ring-emerald-400/30" data-testid="preview-valid">Geçerli: {preview.summary.valid}</span>
                <span className="rounded-lg bg-rose-500/15 px-3 py-1.5 font-semibold text-rose-300 ring-1 ring-rose-400/30" data-testid="preview-invalid">Hatalı: {preview.summary.invalid}</span>
                <button
                  type="button"
                  onClick={runImport}
                  disabled={importing || preview.summary.invalid > 0 || preview.summary.total === 0}
                  data-testid="students-import-btn"
                  className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Öğrencileri Aktar
                </button>
              </div>
              {preview.summary.invalid > 0 && (
                <p className="mb-3 text-xs text-amber-300/90" data-testid="students-import-blocked">
                  Hatalı satırlar düzeltilmeden aktarım yapılamaz. Dosyayı düzeltip yeniden ön izleyin.
                </p>
              )}
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm" data-testid="students-preview-table">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Öğrenci No</th>
                      <th className="px-3 py-2.5 font-semibold">Ad</th>
                      <th className="px-3 py-2.5 font-semibold">Soyad</th>
                      <th className="px-3 py-2.5 font-semibold">Sınıf</th>
                      <th className="px-3 py-2.5 font-semibold">Şube</th>
                      <th className="px-3 py-2.5 font-semibold">Durum</th>
                      <th className="px-3 py-2.5 font-semibold">Hata Açıklaması</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {preview.rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Dosyada satır bulunamadı.</td></tr>
                    ) : (
                      preview.rows.map((r, i) => (
                        <tr key={i} className="text-slate-300" data-testid={`preview-row-${i}`}>
                          <td className="px-3 py-2 font-semibold text-white">{r.student_number}</td>
                          <td className="px-3 py-2">{r.first_name}</td>
                          <td className="px-3 py-2">{r.last_name}</td>
                          <td className="px-3 py-2">{r.level}</td>
                          <td className="px-3 py-2">{r.branch}</td>
                          <td className="px-3 py-2">
                            {r.status === "Hazır" ? (
                              <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">Hazır</span>
                            ) : (
                              <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30">Hatalı</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400">{r.error}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

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
