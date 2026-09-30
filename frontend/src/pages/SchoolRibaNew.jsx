import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ClipboardList, ArrowLeft, AlertTriangle, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolRibaNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // {message} - blocks the form
  const [academicYear, setAcademicYear] = useState(null);
  const [classes, setClasses] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [teacherCount, setTeacherCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return;
    }
    try {
      const res = await axios.get(`${API}/school/students`, { headers: h });
      setAcademicYear(res.data.academic_year || null);
      setClasses(res.data.classes || []);
      setLoadError(null);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
        return;
      }
      if (status === 409) {
        // Active academic year not resolvable -> block the form with a clear message.
        setLoadError({
          message:
            "Aktif bir eğitim öğretim yılı bulunamadı. RİBA uygulaması oluşturabilmek için lütfen RAM ile iletişime geçiniz.",
        });
        setLoading(false);
        return;
      }
      if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setLoadError({
        message: "Bilgiler yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.",
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleClass = (id) => {
    setFormError(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (selectedIds.length === 0) {
      setFormError("Lütfen en az bir sınıf seçiniz.");
      return;
    }
    const trimmed = String(teacherCount).trim();
    if (trimmed === "") {
      setFormError("Lütfen toplam öğretmen sayısını giriniz.");
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setFormError("Öğretmen sayısı 0 veya daha büyük bir tam sayı olmalıdır.");
      return;
    }
    const count = Number(trimmed);
    if (!Number.isInteger(count) || count < 0) {
      setFormError("Öğretmen sayısı 0 veya daha büyük bir tam sayı olmalıdır.");
      return;
    }

    setSubmitting(true);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      await axios.post(
        `${API}/school/riba/applications`,
        { teacher_count: count, school_class_ids: selectedIds },
        { headers: h }
      );
      navigate("/school/riba", {
        replace: true,
        state: { flash: "RİBA uygulaması taslak olarak oluşturuldu." },
      });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      if (status === 409 && detail.includes("zaten")) {
        setFormError("Bu eğitim öğretim yılı için zaten bir RİBA uygulaması bulunuyor.");
      } else if (status === 409 && detail.includes("Aktif eğitim yılı")) {
        setFormError(
          "Aktif bir eğitim öğretim yılı bulunamadı. Lütfen RAM ile iletişime geçiniz."
        );
      } else {
        setFormError(
          "RİBA uygulaması oluşturulurken bir sorun oluştu. Lütfen tekrar deneyiniz."
        );
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riba-new-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const appName = academicYear ? `${academicYear} RİBA Uygulaması` : "RİBA Uygulaması";

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="riba-new-title">Yeni RİBA Uygulaması</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/riba")}
            data-testid="riba-new-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> RİBA'ya Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {loadError ? (
          <div
            data-testid="riba-new-load-error"
            className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-200"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError.message}</span>
          </div>
        ) : (
          <form onSubmit={submit} data-testid="riba-new-form" className="space-y-6">
            {/* Read-only summary */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Aktif Eğitim Öğretim Yılı</p>
                <p className="mt-1 text-lg font-extrabold text-white" data-testid="riba-new-academic-year">
                  {academicYear || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Uygulama Adı</p>
                <p className="mt-1 text-lg font-extrabold text-white" data-testid="riba-new-app-name">
                  {appName}
                </p>
              </div>
            </div>

            {/* Classes */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3">
                <p className="text-sm font-bold text-white">Uygulamaya Dahil Edilecek Sınıflar</p>
                <p className="mt-1 text-xs text-slate-400">
                  Bir veya birden fazla sınıf seçebilirsiniz. En az bir sınıf seçilmesi zorunludur.
                </p>
              </div>

              {classes.length === 0 ? (
                <p
                  data-testid="riba-new-no-classes"
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400"
                >
                  Henüz sınıf tanımlanmamış. Önce Sınıf Tanımları ekranından sınıf ekleyiniz.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4" data-testid="riba-new-class-grid">
                  {classes.map((c) => {
                    const active = selectedIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleClass(c.id)}
                        data-testid={`riba-new-class-${c.id}`}
                        aria-pressed={active}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-sm font-bold transition ${
                          active
                            ? "border-emerald-400/60 bg-emerald-500/15 text-white"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span>{c.level}/{c.branch}</span>
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-md border transition ${
                            active ? "border-emerald-400 bg-emerald-500 text-white" : "border-white/20 text-transparent"
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teacher count */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <label htmlFor="riba-teacher-count" className="text-sm font-bold text-white">
                Toplam Öğretmen Sayısı
              </label>
              <input
                id="riba-teacher-count"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={teacherCount}
                onChange={(e) => { setFormError(null); setTeacherCount(e.target.value); }}
                data-testid="riba-new-teacher-count"
                placeholder="Örn. 24"
                className="mt-2 w-full max-w-[200px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              />
              <p className="mt-2 text-xs text-slate-400">
                Okulunuzdaki toplam öğretmen sayısını giriniz. Bu sayı yalnızca RİBA öğretmen katılım
                oranının hesaplanmasında kullanılacaktır.
              </p>
            </div>

            {formError && (
              <div
                data-testid="riba-new-error"
                className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                data-testid="riba-new-submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
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
