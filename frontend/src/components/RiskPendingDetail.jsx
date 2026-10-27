import React from "react";
import { Copy } from "lucide-react";
import { RiskPendingDecision } from "./RiskPendingDecision";

const fmt = (v) => new Date(v).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const STATUS = { pending: "Onay bekliyor", approved: "Onaylandı", rejected: "Reddedildi" };

export const RiskPendingDetail = ({ data, onApprove, onReject }) => {
  const p = data.pending;
  return (
    <div data-testid="risk-pending-detail" className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p data-testid="risk-pending-detail-name" className="text-lg font-extrabold text-white">{p.first_name} {p.last_name}</p>
          <span data-testid="risk-pending-detail-status" className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-bold text-slate-200">{STATUS[p.status]}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">No: {p.student_number} · Sınıf: {p.class_label} · Gönderim: {fmt(p.submitted_at)}</p>
        {p.status === "rejected" && p.reject_reason && <p className="mt-2 text-xs text-rose-300">Gerekçe: {p.reject_reason}</p>}
        {p.status === "approved" && <p className="mt-2 text-xs text-emerald-300">{p.created_student ? "Yeni öğrenci olarak Havuz'a eklendi" : "Mevcut öğrenciyle eşleştirildi"} · {fmt(p.decided_at)}</p>}
      </div>
      {data.duplicates.length > 0 && (
        <div data-testid="risk-pending-duplicates" className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.05] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-200"><Copy size={14} /> Olası tekrar: aynı numara veya ad soyadla {data.duplicates.length} başka form</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {data.duplicates.map((d) => <li key={d.id}>{d.first_name} {d.last_name} · No: {d.student_number} · {fmt(d.submitted_at)} · {STATUS[d.status]}</li>)}
          </ul>
        </div>
      )}
      <section data-testid="risk-pending-answers" className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold text-amber-200">İşaretlenen maddeler ({data.answers.length})</h3>
        {data.answers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">Öğrenci "Bunlardan hiçbiri benim için geçerli değil" seçeneğini işaretledi.</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {data.answers.map((a) => (
              <li key={a.no} data-testid={`risk-pending-answer-${a.no}`} className="text-sm text-slate-200">
                <b className="mr-1 text-amber-300">{a.no}.</b>{a.label}{a.note && <span className="block pl-5 text-xs text-slate-400">Açıklama: {a.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      {p.status === "pending" && <RiskPendingDecision key={p.id} candidates={data.candidates} numberInPool={data.candidates.some((c) => c.match === "number")} onApprove={onApprove} onReject={onReject} />}
    </div>
  );
};
