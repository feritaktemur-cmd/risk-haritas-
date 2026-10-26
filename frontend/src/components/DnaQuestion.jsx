import React from "react";

const OPTIONS = [
  { value: 2, label: "Evet", on: "border-emerald-400 bg-emerald-500/20 text-white" },
  { value: 1, label: "Bazen", on: "border-amber-400 bg-amber-500/20 text-white" },
  { value: 0, label: "Hayır", on: "border-sky-400 bg-sky-500/20 text-white" },
];

export const DnaQuestion = ({ item, value, onChange, missing }) => (
  <li
    id={`dna-q-${item.item_no}`}
    data-testid={`dna-q-${item.item_no}`}
    className={`rounded-2xl border p-4 transition ${missing ? "border-rose-400/60 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}
  >
    <p className="text-sm text-slate-100">
      <span className="mr-2 font-bold text-amber-300">{item.item_no}.</span>
      {item.text}
    </p>
    <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Soru ${item.item_no}`}>
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.item_no, o.value)}
            data-testid={`dna-q-${item.item_no}-opt-${o.value}`}
            className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${
              active ? o.on : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  </li>
);
