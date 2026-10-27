import React, { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { generateDnaGuidancePdf } from "../lib/dnaGuidancePdf";

export const DnaGuidancePdfButton = ({ data }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const run = async () => {
    setBusy(true);
    setError(false);
    try {
      await generateDnaGuidancePdf(data);
    } catch (_) {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {error && <span data-testid="dna-guidance-pdf-error" className="text-xs text-rose-300">PDF oluşturulamadı. Lütfen tekrar deneyiniz.</span>}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid="dna-guidance-pdf-btn"
        className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3.5 py-1.5 text-xs font-bold text-indigo-100 ring-1 ring-indigo-400/30 transition-colors hover:bg-indigo-500/25 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF İndir
      </button>
    </div>
  );
};
