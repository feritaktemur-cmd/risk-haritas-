import React from "react";
import { Inbox } from "lucide-react";

const fmt = (v) => new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

export const DnaInvalidBadge = ({ testId }) => (
  <span data-testid={testId} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30">
    Geçersiz
  </span>
);

export const DnaResponseList = ({ responses, selectedId, onSelect }) => {
  if (responses.length === 0) {
    return (
      <div data-testid="dna-responses-empty" className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-12 text-center">
        <Inbox size={28} className="mx-auto text-slate-500" />
        <p className="mt-3 text-sm font-semibold text-slate-300">Bu uygulamaya henüz öğrenci yanıtı gönderilmemiş.</p>
        <p className="mt-1 text-xs text-slate-500">Öğrenciler paylaşım bağlantısından anketi doldurdukça yanıtlar burada listelenir.</p>
      </div>
    );
  }
  return (
    <ul data-testid="dna-responses-list" className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {responses.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            data-testid={`dna-response-row-${r.id}`}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05] ${
              selectedId === r.id ? "bg-amber-500/10" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{r.first_name} {r.last_name}</p>
              <p className="mt-0.5 text-xs text-slate-400">No: {r.student_number} · Sınıf: {r.class_label}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-slate-400">{fmt(r.submitted_at)}</span>
              {r.status === "invalidated" && <DnaInvalidBadge testId={`dna-response-invalid-${r.id}`} />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};
