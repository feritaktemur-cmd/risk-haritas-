import React, { useState } from "react";
import { Loader2, Link2, RefreshCw, XCircle } from "lucide-react";
import { RiskLinkShareCard } from "./RiskLinkShareCard";

const fmt = (v) => new Date(v).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export const RiskLinkRow = ({ cls, onCreate, onDeactivate }) => {
  const [busy, setBusy] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const label = `${cls.level}/${cls.branch}`;
  const active = cls.active_link;
  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); setConfirmClose(false); }
  };
  const btn = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition-colors disabled:opacity-60";
  return (
    <li data-testid={`risk-link-row-${cls.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-white">{label}</p>
          <p data-testid={`risk-link-status-${cls.id}`} className="mt-0.5 text-xs text-slate-400">
            {active ? <span className="font-semibold text-emerald-300">Aktif bağlantı · {fmt(active.created_at)}</span> : "Aktif bağlantı yok"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!active && (
            <button onClick={() => run("create", () => onCreate(cls.id))} disabled={!!busy} data-testid={`risk-link-create-${cls.id}`}
              className={`${btn} bg-amber-500/15 text-amber-100 ring-amber-400/30 hover:bg-amber-500/25`}>
              {busy === "create" ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Bağlantı Oluştur
            </button>
          )}
          {active && !confirmClose && (
            <>
              <button onClick={() => run("renew", () => onCreate(cls.id))} disabled={!!busy} data-testid={`risk-link-renew-${cls.id}`}
                className={`${btn} bg-white/[0.06] text-slate-200 ring-white/10 hover:bg-white/[0.12]`}>
                {busy === "renew" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Yenile
              </button>
              <button onClick={() => setConfirmClose(true)} disabled={!!busy} data-testid={`risk-link-close-${cls.id}`}
                className={`${btn} bg-rose-500/10 text-rose-200 ring-rose-400/30 hover:bg-rose-500/20`}>
                <XCircle size={14} /> Kapat
              </button>
            </>
          )}
          {active && confirmClose && (
            <>
              <span className="text-xs text-rose-200">Bağlantı kapatılsın mı? Öğrenciler artık form gönderemez.</span>
              <button onClick={() => run("close", () => onDeactivate(active.id))} disabled={!!busy} data-testid={`risk-link-close-confirm-${cls.id}`}
                className={`${btn} bg-rose-500/20 text-rose-100 ring-rose-400/40 hover:bg-rose-500/30`}>
                {busy === "close" && <Loader2 size={14} className="animate-spin" />} Evet, kapat
              </button>
              <button onClick={() => setConfirmClose(false)} disabled={!!busy} data-testid={`risk-link-close-cancel-${cls.id}`}
                className={`${btn} bg-white/[0.06] text-slate-200 ring-white/10`}>Vazgeç</button>
            </>
          )}
        </div>
      </div>
      {active && <RiskLinkShareCard classLabel={label} />}
    </li>
  );
};
