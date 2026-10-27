import React from "react";
import { AlertTriangle, Compass, Info } from "lucide-react";
import {
  DNA_GUIDANCE_TEXTS, DNA_GUIDANCE_DISCLAIMER, DNA_GUIDANCE_ALL_ZERO, DNA_GUIDANCE_INVALID,
  DNA_ATTENTION_TITLE, DNA_ATTENTION_NOTE, computeDnaGuidance,
} from "../lib/dnaGuidance";
import { DnaGuidancePdfButton } from "./DnaGuidancePdfButton";

const fmtAvg = (v) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ANSWER = { 2: "Evet", 1: "Bazen" };

const Shell = ({ children, action }) => (
  <section data-testid="dna-guidance-section" className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-indigo-200">
        <Compass size={16} /> Bireysel Değerlendirme ve Rehberlik Önerileri
      </h3>
      {action}
    </div>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const Averages = ({ averages }) => (
  <div data-testid="dna-guidance-averages">
    <p className="text-xs font-semibold text-slate-400">Boyut ortalamaları (madde başına, 0–2) — bireysel göstergedir, resmî grup ortalaması değildir.</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {averages.map((a) => (
        <span key={a.dimension_no} data-testid={`dna-guidance-avg-${a.dimension_no}`} className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">
          {a.dimension_no}. {a.name}: <b className="text-white">{fmtAvg(a.average)}</b>
        </span>
      ))}
    </div>
  </div>
);

const Highlighted = ({ list }) => (
  <div className="space-y-3" data-testid="dna-guidance-highlighted">
    {list.map((a) => (
      <article key={a.dimension_no} data-testid={`dna-guidance-dim-${a.dimension_no}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-bold text-amber-200">{a.dimension_no}. {a.name} <span className="ml-1 text-xs font-semibold text-slate-400">(ortalama {fmtAvg(a.average)})</span></p>
        <p className="mt-2 text-sm text-slate-200"><span className="font-semibold text-slate-400">Değerlendirme: </span>{DNA_GUIDANCE_TEXTS[a.dimension_no]?.assessment}</p>
        <p className="mt-1.5 text-sm text-slate-200"><span className="font-semibold text-slate-400">Öneri: </span>{DNA_GUIDANCE_TEXTS[a.dimension_no]?.advice}</p>
      </article>
    ))}
  </div>
);

const Attention = ({ items }) => (
  <div data-testid="dna-guidance-attention" className="rounded-xl border border-rose-400/30 bg-rose-500/[0.06] p-4">
    <p className="flex items-center gap-2 text-sm font-bold text-rose-200"><AlertTriangle size={15} /> {DNA_ATTENTION_TITLE}</p>
    <p className="mt-1 text-xs text-rose-200/80">{DNA_ATTENTION_NOTE}</p>
    <ul className="mt-2 space-y-1.5">
      {items.map((i) => (
        <li key={i.item_no} data-testid={`dna-guidance-attention-${i.item_no}`} className="flex items-start justify-between gap-3 text-sm text-slate-200">
          <span><b className="mr-1 text-rose-300">{i.item_no}.</b>{i.text}</span>
          <span className="shrink-0 text-xs font-bold text-rose-200">{ANSWER[i.value]}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const DnaGuidanceSection = ({ data }) => {
  const { status } = data.response;
  if (status === "invalidated") {
    return <Shell><p data-testid="dna-guidance-invalid" className="text-sm text-slate-300">{DNA_GUIDANCE_INVALID}</p></Shell>;
  }
  const g = computeDnaGuidance(data.dimensions);
  return (
    <Shell action={<DnaGuidancePdfButton data={data} />}>
      <Averages averages={g.averages} />
      {g.allZero
        ? <p data-testid="dna-guidance-all-zero" className="text-sm text-slate-200">{DNA_GUIDANCE_ALL_ZERO}</p>
        : <Highlighted list={g.highlighted} />}
      {g.attention.length > 0 && <Attention items={g.attention} />}
      <p data-testid="dna-guidance-disclaimer" className="flex gap-2 text-xs text-slate-400"><Info size={14} className="mt-0.5 shrink-0" />{DNA_GUIDANCE_DISCLAIMER}</p>
    </Shell>
  );
};
