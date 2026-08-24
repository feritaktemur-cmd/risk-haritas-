import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { School, Loader2, ArrowLeft, AlertTriangle, ShieldAlert, Save, SkipForward, User, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function RiskEntry() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null);
  const [classes, setClasses] = useState([]);
  const [categories, setCategories] = useState([]);

  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [current, setCurrent] = useState(null); // {id, student_number, first_name, last_name, class_label}
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [selected, setSelected] = useState({}); // {risk_category_id: true}
  const [notes, setNotes] = useState({}); // {risk_category_id: "text"}

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return null;
    }
    try {
      const res = await axios.get(`${API}/school/risk/init`, { headers: h });
      setInfo({ school_name: res.data.school_name, academic_year: res.data.academic_year });
      setClasses(res.data.classes || []);
      setCategories(res.data.categories || []);
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
      const d = await bootstrap();
      if (d) setReady(true);
    })();
  }, [bootstrap]);

  const loadStudents = useCallback(async (cid) => {
    setCurrent(null);
    setStudents([]);
    if (!cid) return;
    setLoadingStudents(true);
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/risk/students`, { headers: h, params: { school_class_id: cid } });
      setStudents(res.data.students || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Öğrenciler yüklenemedi.");
    }
    setLoadingStudents(false);
  }, [navigate]);

  const onClassChange = (cid) => {
    setClassId(cid);
    setError(null);
    setSuccess(null);
    loadStudents(cid);
  };

  const loadStudentRisks = useCallback(async (studentId) => {
    setError(null);
    setSuccess(null);
    setLoadingStudent(true);
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/risk/student/${studentId}`, { headers: h });
      setCurrent(res.data.student);
      const sel = {};
      const nts = {};
      (res.data.selected || []).forEach((m) => {
        sel[m.risk_category_id] = true;
        if (m.note != null) nts[m.risk_category_id] = m.note;
      });
      setSelected(sel);
      setNotes(nts);
    } catch (err) {
      setError(err.response?.data?.detail || "Öğrenci risk bilgileri yüklenemedi.");
    }
    setLoadingStudent(false);
  }, [navigate]);

  const toggle = (id) => {
    setSuccess(null);
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const buildPayload = () => {
    const risks = [];
    for (const cat of categories) {
      if (selected[cat.id]) {
        risks.push({ risk_category_id: cat.id, note: cat.requires_note ? (notes[cat.id] || "") : null });
      }
    }
    return risks;
  };

  const validate = () => {
    for (const cat of categories) {
      if (selected[cat.id] && cat.requires_note && !(notes[cat.id] || "").trim()) {
        setError(`"${cat.label}" için açıklama boş bırakılamaz.`);
        return false;
      }
    }
    return true;
  };

  const save = async () => {
    if (!current) return false;
    setError(null);
    setSuccess(null);
    if (!validate()) return false;
    setSaving(true);
    let ok = false;
    try {
      const h = await authHeader();
      if (!h) { navigate("/school/login", { replace: true }); return false; }
      const payload = buildPayload();
      await axios.post(`${API}/school/risk/save`, { student_id: current.id, risks: payload }, { headers: h });
      ok = true;
      // Update the list status in place (no page refresh).
      const savedId = current.id;
      const count = payload.length;
      setStudents((prev) => prev.map((s) => (s.id === savedId ? { ...s, assessed: true, risk_count: count } : s)));
    } catch (err) {
      setError(err.response?.data?.detail || "Risk bilgileri kaydedilemedi.");
    }
    setSaving(false);
    return ok;
  };

  const onSave = async () => {
    const ok = await save();
    if (ok) setSuccess("Risk bilgileri kaydedildi.");
  };

  const onSaveNext = async () => {
    const ok = await save();
    if (!ok) return;
    const idx = students.findIndex((s) => s.id === current.id);
    const next = students[idx + 1];
    if (next) {
      setSuccess("Risk bilgileri kaydedildi. Sonraki öğrenciye geçildi.");
      await loadStudentRisks(next.id);
    } else {
      setSuccess("Risk bilgileri kaydedildi. Sınıftaki son öğrenciydi.");
    }
  };

  if (!ready || !info) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="risk-loading">
        {error ? (
          <div className="max-w-md rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20" data-testid="risk-fatal-error">{error}</div>
        ) : (
          <Loader2 size={28} className="animate-spin text-emerald-300" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-400 text-white">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="risk-title">Risk Haritası Veri Girişi</h1>
            </div>
          </div>
          <button onClick={() => navigate("/school")} data-testid="risk-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400" data-testid="risk-school-name">Okul: <span className="text-white">{info.school_name}</span></p>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30" data-testid="risk-academic-year">Eğitim Yılı: {info.academic_year}</span>
        </div>

        {/* Step 1: class select */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <label className="mb-2 block text-sm font-bold text-white">1. Sınıf / Şube Seç</label>
          <select
            value={classId}
            onChange={(e) => onClassChange(e.target.value)}
            data-testid="risk-class-select"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
          >
            <option value="">Seçin</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.level}/{c.branch}</option>
            ))}
          </select>
        </div>

        {classId && (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Students list */}
            <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="risk-students-panel">
              <p className="mb-3 text-sm font-bold text-white">2. Öğrenci Seç</p>
              {loadingStudents ? (
                <div className="grid place-items-center py-8"><Loader2 size={20} className="animate-spin text-emerald-300" /></div>
              ) : students.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500" data-testid="risk-no-students">Bu sınıfta aktif öğrenci yok.</p>
              ) : (
                <ul className="space-y-1.5">
                  {students.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => loadStudentRisks(s.id)}
                        data-testid={`risk-student-${s.id}`}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${current?.id === s.id ? "bg-emerald-500/15 text-white ring-1 ring-emerald-400/40" : "text-slate-300 hover:bg-white/[0.05]"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span><span className="font-semibold text-white">{s.student_number}</span> · {s.first_name} {s.last_name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs" data-testid={`risk-status-${s.id}`}>
                          {s.assessed ? (
                            <><CheckCircle2 size={13} className="text-emerald-400" /> <span className="text-emerald-300">Tamamlandı · {s.risk_count > 0 ? `${s.risk_count} risk` : "Risk yok"}</span></>
                          ) : (
                            <><Circle size={13} className="text-slate-500" /> <span className="text-slate-500">Girilmedi</span></>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            {/* Risk form */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              {loadingStudent ? (
                <div className="grid place-items-center py-16"><Loader2 size={24} className="animate-spin text-emerald-300" /></div>
              ) : !current ? (
                <div className="grid place-items-center py-16 text-center text-sm text-slate-500" data-testid="risk-empty-state">
                  <User size={28} className="mb-3 text-slate-600" />
                  Riskleri girmek için soldan bir öğrenci seçin.
                </div>
              ) : (
                <div data-testid="risk-form">
                  <div className="mb-5 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Seçili Öğrenci</p>
                    <p className="mt-1 text-base font-bold text-white" data-testid="risk-current-student">
                      {current.student_number} · {current.first_name} {current.last_name}
                    </p>
                    <p className="text-sm text-slate-400">Sınıf / Şube: {current.class_label || "—"}</p>
                  </div>

                  <p className="mb-3 text-sm font-bold text-white">3. Risk Maddeleri</p>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <div key={cat.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!selected[cat.id]}
                            onChange={() => toggle(cat.id)}
                            data-testid={`risk-cat-${cat.code}`}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-emerald-500"
                          />
                          <span className="text-sm text-slate-200">{cat.label}</span>
                        </label>
                        {selected[cat.id] && cat.requires_note && (
                          <textarea
                            value={notes[cat.id] || ""}
                            onChange={(e) => { setSuccess(null); setNotes((p) => ({ ...p, [cat.id]: e.target.value })); }}
                            data-testid={`risk-note-${cat.code}`}
                            placeholder="Açıklama giriniz (zorunlu)"
                            rows={2}
                            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div data-testid="risk-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div data-testid="risk-success" className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/20">{success}</div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={onSave} disabled={saving} data-testid="risk-save-btn" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Kaydet
                    </button>
                    <button onClick={onSaveNext} disabled={saving} data-testid="risk-save-next-btn" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-50">
                      <SkipForward size={15} /> Kaydet ve Sonraki Öğrenci
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
