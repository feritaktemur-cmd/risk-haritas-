import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardCheck, Star } from "lucide-react";
import { ramGet, formatDate, targetLabel } from "../lib/ramRibaApi";

const NA = <span className="text-xs italic text-amber-300/80">Hesaplanamadı</span>;
const show = (v) => (v === null || v === undefined ? NA : v);

export default function RamRibaSubmissionDetail() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [sub, setSub] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setSub(await ramGet(navigate, `/ram/riba/submissions/${submissionId}`));
      } catch (e) {
        if (e.silent) return;
        setError(e.status === 404 ? "Gönderim kaydı bulunamadı." : (e.message || "Gönderim yüklenemedi. Lütfen tekrar deneyin."));
      }
    })();
  }, [navigate, submissionId]);

  const specialIds = new Set([sub?.special_target_1?.id, sub?.special_target_2?.id].filter(Boolean));
  const meta = sub ? [
    ["Okul", sub.school_name], ["İlçe", sub.district_name], ["Eğitim Yılı", sub.academic_year_name],
    ["Eğitim Kademesi", sub.education_level_name], ["RAM'a Gönderim Tarihi", formatDate(sub.submitted_at)],
  ] : [];

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/ram/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="ramriba-detail-title">RİBA Gönderim Detayı</h1>
            </div>
          </div>
          <button onClick={() => navigate("/ram/riba")} data-testid="ramriba-detail-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Gönderimler
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error ? (
          <div data-testid="ramriba-detail-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : !sub ? (
          <div className="grid place-items-center py-20" data-testid="ramriba-detail-loading"><Loader2 size={28} className="animate-spin text-emerald-300" /></div>
        ) : (
          <>
            <p className="mb-4 text-xs text-slate-400">Bu kayıt okulun RAM'a gönderdiği andaki değişmez sonuçtur; değerler yeniden hesaplanmaz.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="ramriba-detail-meta">
              {meta.map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-400">{k}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{v || "—"}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[sub.special_target_1, sub.special_target_2].map((t, i) => (
                <div key={i} className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4" data-testid={`ramriba-detail-special-${i + 1}`}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Star size={13} /> Okul Özel Hedefi {i + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{targetLabel(t)}</p>
                </div>
              ))}
            </div>

            <h2 className="mb-3 mt-8 text-base font-bold text-white">Hedef Sonuçları ({(sub.targets || []).length})</h2>
            {(sub.targets || []).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400" data-testid="ramriba-detail-targets-empty">Bu gönderimde hedef sonucu bulunmuyor.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[760px] text-left text-sm" data-testid="ramriba-detail-targets-table">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      {["MEB Kodu", "Hedef", "Sınıf Sayısı", "Okul Ortalama ASP", "Sıralama"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sub.targets.map((t) => (
                      <tr key={t.target_id || t.meb_code} className={`text-slate-300 ${specialIds.has(t.target_id) ? "bg-emerald-500/[0.06]" : ""}`} data-testid={`ramriba-target-row-${t.meb_code}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{t.meb_code || "—"}</td>
                        <td className="px-4 py-2.5 text-white">
                          {t.target_name || "—"}
                          {specialIds.has(t.target_id) && <span className="ml-2 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Özel Hedef</span>}
                        </td>
                        <td className="px-4 py-2.5">{show(t.class_count)}</td>
                        <td className="px-4 py-2.5" data-testid={`ramriba-target-asp-${t.meb_code}`}>{show(t.average_asp)}</td>
                        <td className="px-4 py-2.5" data-testid={`ramriba-target-rank-${t.meb_code}`}>{show(t.rank)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
