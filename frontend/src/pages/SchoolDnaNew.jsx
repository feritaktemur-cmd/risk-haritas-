import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, CalendarX2, ArrowLeft, AlertTriangle, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function ClassGrid({ classes, selectedIds, onToggle, navigate }) {
  if (classes.length === 0) {
    return (
      <p data-testid="dna-new-no-classes" className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
        Henüz sınıf tanımlanmamış. Önce{" "}
        <button
          type="button"
          onClick={() => navigate("/school/student-management/classes")}
          data-testid="dna-new-classes-link"
          className="font-semibold text-amber-300 underline-offset-2 hover:underline"
        >
          Öğrenci Yönetimi › Sınıf Tanımları
        </button>{" "}
        ekranından sınıf ekleyiniz.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4" data-testid="dna-new-class-grid">
      {classes.map((c) => {
        const active = selectedIds.includes(c.id);
        return (
          <button
            type="button"
            key={c.id}
            onClick={() => onToggle(c.id)}
            data-testid={`dna-new-class-${c.id}`}
            aria-pressed={active}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-sm font-bold transition ${
              active
                ? "border-amber-400/60 bg-amber-500/15 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
            }`}
          >
            <span>{c.level}/{c.branch}</span>
            <span className={`grid h-5 w-5 place-items-center rounded-md border transition ${active ? "border-amber-400 bg-amber-500 text-white" : "border-white/20 text-transparent"}`}>
              <Check size={13} strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function SchoolDnaNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [academicYear, setAcademicYear] = useState(null);
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/students`, { headers: h });
      setAcademicYear(res.data.academic_year || null);
      setClasses(res.data.classes || []);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 && err.response?.data?.detail === "password_change_required") {
        return navigate("/school/change-password", { replace: true });
      }
      if (status === 401) {
        await supabase.auth.signOut();
        return navigate("/school/login", { replace: true });
      }
      setLoadError(
        status === 409
          ? "Aktif bir eğitim öğretim yılı bulunamadı. DNA uygulaması oluşturabilmek için lütfen RAM ile iletişime geçiniz."
          : "Bilgiler yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleClass = (id) => {
    setFormError(null);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) return setFormError("Lütfen uygulamaya bir ad veriniz.");
    if (trimmed.length > 200) return setFormError("Uygulama adı en fazla 200 karakter olabilir.");
    if (selectedIds.length === 0) return setFormError("Lütfen en az bir sınıf seçiniz.");
    setSubmitting(true);
    setFormError(null);
    try {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      await axios.post(`${API}/school/dna/applications`, { name: trimmed, school_class_ids: selectedIds }, { headers: h });
      navigate("/school/dna", { replace: true, state: { flash: "DNA uygulaması taslak olarak oluşturuldu." } });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "DNA uygulaması oluşturulurken bir sorun oluştu. Lütfen tekrar deneyiniz.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="dna-new-loading">
        <Loader2 size={28} className="animate-spin text-amber-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(245,158,11,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-400 text-white">
              <CalendarX2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="dna-new-title">Yeni DNA Uygulaması</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/dna")}
            data-testid="dna-new-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> DNA'ya Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {loadError ? (
          <div data-testid="dna-new-load-error" className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : (
          <form onSubmit={submit} data-testid="dna-new-form" className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Aktif Eğitim Öğretim Yılı</p>
              <p className="mt-1 text-lg font-extrabold text-white" data-testid="dna-new-academic-year">{academicYear || "—"}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <label htmlFor="dna-name" className="text-sm font-bold text-white">Uygulama Adı</label>
              <input
                id="dna-name"
                type="text"
                maxLength={200}
                value={name}
                onChange={(e) => { setFormError(null); setName(e.target.value); }}
                data-testid="dna-new-name"
                placeholder="Örn. 1. Dönem DNA Uygulaması"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-bold text-white">Uygulamaya Dahil Edilecek Sınıflar</p>
              <p className="mb-3 mt-1 text-xs text-slate-400">Bir veya birden fazla sınıf seçebilirsiniz. En az bir sınıf seçilmesi zorunludur.</p>
              <ClassGrid classes={classes} selectedIds={selectedIds} onToggle={toggleClass} navigate={navigate} />
            </div>

            {formError && (
              <div data-testid="dna-new-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                data-testid="dna-new-submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                {submitting ? "Oluşturuluyor…" : "Taslak Oluştur"}
              </button>
            </div>
          </form>
        )}
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
