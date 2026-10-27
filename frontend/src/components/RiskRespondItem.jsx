import React from "react";
import { Check } from "lucide-react";

export const RiskRespondItem = ({ item, checked, note, onToggle, onNote }) => (
  <li data-testid={`risk-r-item-${item.no}`} className={`rounded-xl border transition-colors ${checked ? "border-amber-400/50 bg-amber-500/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
    <button type="button" onClick={onToggle} data-testid={`risk-r-toggle-${item.no}`} aria-pressed={checked}
      className="flex w-full items-start gap-3 px-4 py-3 text-left">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-amber-400 bg-amber-400 text-[#0b1120]" : "border-white/30"}`}>
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="text-sm text-slate-100"><span className="mr-1.5 font-bold text-amber-300">{item.no}.</span>{item.label}</span>
    </button>
    {checked && item.requires_note && (
      <div className="px-4 pb-3">
        <textarea data-testid={`risk-r-note-${item.no}`} value={note} onChange={(e) => onNote(e.target.value)} maxLength={500} rows={2}
          placeholder="Kısaca açıklayınız (zorunlu)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60" />
        <p className="mt-1 text-right text-[11px] text-slate-500">{note.length}/500</p>
      </div>
    )}
  </li>
);
