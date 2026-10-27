import React, { useState } from "react";
import { Loader2, UserPlus, CheckCircle2, XCircle } from "lucide-react";

const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const Candidate = ({ c, chosen, onChoose }) => {
  const blocked = c.status !== "active" || c.has_assessment || (c.class_label && !c.same_class);
  const why = c.status !== "active" ? "Aktif değil" : c.has_assessment ? "Bu yıl değerlendirmesi var" : c.class_label && !c.same_class ? `Başka sınıfta (${c.class_label})` : null;
  return (
    <label data-testid={`risk-cand-${c.id}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${chosen ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10"} ${blocked ? "opacity-60" : "cursor-pointer"}`}>
      <input type="radio" name="risk-cand" disabled={blocked} checked={chosen} onChange={onChoose} data-testid={`risk-cand-radio-${c.id}`} className="accent-emerald-400" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-white">{c.first_name} {c.last_name}</span>
        <span className="ml-2 text-xs text-slate-400">No: {c.student_number} · {c.class_label || "Bu yıl sınıf kaydı yok"}</span>
        <span className="ml-2 text-[11px] text-sky-300">{c.match === "number" ? "numara eşleşti" : "ad soyad eşleşti"}</span>
      </span>
      {why && <span className="shrink-0 text-[11px] font-semibold text-rose-300">{why}</span>}
    </label>
  );
};

export const RiskPendingDecision = ({ candidates, numberInPool, onApprove, onReject }) => {
  const [choice, setChoice] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <section data-testid="risk-pending-decision" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-extrabold text-white">Öğrenci eşleştirme</h3>
      <p className="mt-1 text-xs text-slate-400">Formu dolduran öğrenciyi Öğrenci Havuzu'ndaki kayıtla eşleştiriniz veya yeni öğrenci olarak ekleyiniz.</p>
      <div className="mt-3 space-y-2">
        {candidates.map((c) => <Candidate key={c.id} c={c} chosen={choice === c.id} onChoose={() => setChoice(c.id)} />)}
        <label data-testid="risk-cand-new" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${choice === "new" ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10"} ${numberInPool ? "opacity-60" : "cursor-pointer"}`}>
          <input type="radio" name="risk-cand" disabled={numberInPool} checked={choice === "new"} onChange={() => setChoice("new")} data-testid="risk-cand-radio-new" className="accent-emerald-400" />
          <UserPlus size={15} className="text-emerald-300" />
          <span className="flex-1 text-white">Yeni öğrenci olarak Havuz'a ekle</span>
          {numberInPool && <span className="text-[11px] font-semibold text-rose-300">Numara Havuz'da kayıtlı</span>}
        </label>
      </div>
      {!rejecting ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={!choice || busy} data-testid="risk-pending-approve" onClick={() => run(() => onApprove(choice === "new" ? null : choice))}
            className={`${btn} bg-emerald-500/20 text-emerald-100 ring-emerald-400/40 hover:bg-emerald-500/30`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Onayla ve Risk Haritası'na aktar
          </button>
          <button type="button" disabled={busy} data-testid="risk-pending-reject-open" onClick={() => setRejecting(true)}
            className={`${btn} bg-rose-500/10 text-rose-200 ring-rose-400/30 hover:bg-rose-500/20`}><XCircle size={14} /> Reddet</button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <textarea data-testid="risk-pending-reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2}
            placeholder="Gerekçe (isteğe bağlı)" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-rose-400/60" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} data-testid="risk-pending-reject-confirm" onClick={() => run(() => onReject(reason.trim() || null))}
              className={`${btn} bg-rose-500/20 text-rose-100 ring-rose-400/40 hover:bg-rose-500/30`}>{busy && <Loader2 size={14} className="animate-spin" />} Reddi onayla</button>
            <button type="button" disabled={busy} data-testid="risk-pending-reject-cancel" onClick={() => setRejecting(false)} className={`${btn} bg-white/[0.06] text-slate-200 ring-white/10`}>Vazgeç</button>
          </div>
        </div>
      )}
    </section>
  );
};
