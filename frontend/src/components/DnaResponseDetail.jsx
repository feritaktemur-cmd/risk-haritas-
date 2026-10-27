import React from "react";
import { DnaInvalidBadge } from "./DnaResponseList";
import { DnaGuidanceSection } from "./DnaGuidanceSection";

const LABEL = {
  2: { t: "Evet", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  1: { t: "Bazen", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  0: { t: "Hayır", cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
};

const Dimension = ({ d }) => (
  <section data-testid={`dna-detail-dim-${d.dimension_no}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-amber-200">{d.dimension_no}. {d.name}</h3>
      <span data-testid={`dna-detail-dim-score-${d.dimension_no}`} className="text-xs font-bold text-slate-300">
        {d.score} / {d.max_score}
      </span>
    </div>
    <ol className="mt-3 space-y-2">
      {d.items.map((i) => {
        const l = LABEL[i.value];
        return (
          <li key={i.item_no} data-testid={`dna-detail-item-${i.item_no}`} className="flex items-start justify-between gap-3 text-sm">
            <p className="text-slate-200"><span className="mr-1.5 font-bold text-amber-300">{i.item_no}.</span>{i.text}</p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${l ? l.cls : "bg-white/10 text-slate-400 ring-white/20"}`}>
              {l ? l.t : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  </section>
);

export const DnaResponseDetail = ({ data }) => {
  const r = data.response;
  return (
    <div data-testid="dna-response-detail" className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p data-testid="dna-detail-name" className="text-lg font-extrabold text-white">{r.first_name} {r.last_name}</p>
          {r.status === "invalidated" && <DnaInvalidBadge testId="dna-detail-invalid" />}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          No: {r.student_number} · Sınıf: {r.class_label} · {new Date(r.submitted_at).toLocaleString("tr-TR")}
        </p>
        <p data-testid="dna-detail-total" className="mt-3 text-sm font-bold text-slate-200">
          Toplam puan: <span className="text-amber-300">{r.total_score} / {r.max_total_score}</span>
        </p>
        {r.status === "invalidated" && r.invalidation_reason && (
          <p className="mt-2 text-xs text-rose-300">Geçersiz kılma gerekçesi: {r.invalidation_reason}</p>
        )}
      </div>
      {data.dimensions.map((d) => <Dimension key={d.dimension_no} d={d} />)}
      <section data-testid="dna-detail-open-text" className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold text-amber-200">52. {r.open_text_prompt}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
          {r.open_text || <span className="italic text-slate-500">Öğrenci bu soruyu boş bıraktı.</span>}
        </p>
      </section>
      <DnaGuidanceSection status={r.status} dimensions={data.dimensions} />
    </div>
  );
};
