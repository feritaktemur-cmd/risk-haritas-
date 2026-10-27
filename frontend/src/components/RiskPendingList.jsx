import React from "react";
import { Inbox, Copy, UserCheck } from "lucide-react";

const fmt = (v) => new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
const Tag = ({ testId, tone, icon: Icon, children }) => (
  <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tone}`}>
    {Icon && <Icon size={11} />}{children}
  </span>
);

export const RiskPendingList = ({ items, selectedId, onSelect, status }) => {
  if (items.length === 0) {
    return (
      <div data-testid="risk-pending-empty" className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-12 text-center">
        <Inbox size={28} className="mx-auto text-slate-500" />
        <p className="mt-3 text-sm font-semibold text-slate-300">
          {status === "pending" ? "Onay bekleyen öğrenci formu yok." : status === "approved" ? "Henüz onaylanan form yok." : "Reddedilen form yok."}
        </p>
      </div>
    );
  }
  return (
    <ul data-testid="risk-pending-list" className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {items.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onSelect(r.id)} data-testid={`risk-pending-row-${r.id}`}
            className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.05] ${selectedId === r.id ? "bg-amber-500/10" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-white">{r.first_name} {r.last_name}</p>
              <span className="shrink-0 text-xs text-slate-400">{fmt(r.submitted_at)}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">No: {r.student_number} · Sınıf: {r.class_label}</p>
            {(r.dup_number || r.dup_name || (status === "pending" && r.number_in_pool)) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.dup_number && <Tag testId={`risk-pending-dup-number-${r.id}`} icon={Copy} tone="bg-rose-500/15 text-rose-200 ring-rose-400/30">Aynı numarayla başka form</Tag>}
                {r.dup_name && <Tag testId={`risk-pending-dup-name-${r.id}`} icon={Copy} tone="bg-amber-500/15 text-amber-200 ring-amber-400/30">Aynı ad soyadla başka form</Tag>}
                {status === "pending" && r.number_in_pool && <Tag testId={`risk-pending-in-pool-${r.id}`} icon={UserCheck} tone="bg-sky-500/15 text-sky-200 ring-sky-400/30">Numara Havuz'da kayıtlı</Tag>}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};
