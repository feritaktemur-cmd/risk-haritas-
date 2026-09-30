import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, ClipboardList, ArrowLeft, AlertTriangle, Users, CalendarDays, Rocket, X, Info } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
  draft: "Taslak",
  active: "Aktif",
  closed: "Kapalı",
  finalized: "Sonuçlandırılmış",
};

const STATUS_STYLES = {
  draft: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  closed: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  finalized: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SchoolRibaManage() {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [app, setApp] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return;
    }
    try {
      const res = await axios.get(`${API}/school/riba/applications`, { headers: h });
      const found = (res.data.applications || []).find((a) => a.id === applicationId);
      if (!found) {
        setError("Bu RİBA uygulaması bulunamadı.");
        setApp(null);
      } else {
        setApp(found);
        setError(null);
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
        return;
      }
      if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setError("RİBA uygulaması yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  }, [navigate, applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riba-manage-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const label = app ? (STATUS_LABELS[app.status] || app.status) : null;
  const badge = app ? (STATUS_STYLES[app.status] || "bg-white/10 text-slate-300 ring-white/20") : "";
  const created = app ? formatDate(app.created_at) : null;

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
              <h1 className="text-lg font-extrabold text-white" data-testid="riba-manage-title">RİBA Uygulaması</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/riba")}
            data-testid="riba-manage-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> RİBA'ya Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {error || !app ? (
          <div
            data-testid="riba-manage-error"
            className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-200"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error || "Bu RİBA uygulaması bulunamadı."}</span>
          </div>
        ) : (
          <>
            {/* Top summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-summary">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold text-white" data-testid="riba-manage-name">{app.name}</h2>
                <span
                  data-testid="riba-manage-status"
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${badge}`}
                >
                  {label}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-400">
                <span data-testid="riba-manage-year">
                  Eğitim Öğretim Yılı: <span className="text-slate-200">{app.academic_year || "—"}</span>
                </span>
                {created && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> Oluşturulma: <span className="text-slate-300">{created}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Application info */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-info">
              <h3 className="text-sm font-bold text-white">Uygulama Bilgileri</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dahil Edilen Sınıflar</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="riba-manage-classes">
                    {app.classes && app.classes.length > 0 ? (
                      app.classes.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10"
                        >
                          {c.name || `${c.level}/${c.branch}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Users size={16} className="shrink-0 text-slate-400" />
                  <span data-testid="riba-manage-teachers">
                    Toplam Öğretmen Sayısı: <span className="font-bold text-white">{app.teacher_count}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Draft note + start */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-start-area">
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <Info size={16} className="mt-0.5 shrink-0 text-emerald-300/80" />
                <p>
                  Uygulama henüz başlamadı. Başlatıldığında katılımcı formları ve paylaşım bağlantıları oluşturulacaktır.
                </p>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                data-testid="riba-manage-start-btn"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
              >
                <Rocket size={16} /> Uygulamayı Başlat
              </button>
            </div>
          </>
        )}
      </main>

      {/* Confirm modal (no backend call in this task) */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          data-testid="riba-start-modal"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold text-white">RİBA uygulamasını başlatmak istiyor musunuz?</h3>
              <button
                onClick={() => setConfirmOpen(false)}
                data-testid="riba-start-modal-close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Uygulama başlatıldığında seçilen sınıflar ve ilgili RİBA formları uygulamaya bağlanacak, katılımcı
              bağlantıları oluşturulacaktır.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                data-testid="riba-start-cancel"
                className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
              >
                Vazgeç
              </button>
              <button
                disabled
                data-testid="riba-start-confirm"
                className="cursor-not-allowed rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white opacity-50"
              >
                Başlat
              </button>
            </div>
            <p className="mt-3 text-right text-xs text-slate-500" data-testid="riba-start-note">
              Başlatma işlemi sonraki adımda etkinleştirilecektir.
            </p>
          </div>
        </div>
      )}

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
