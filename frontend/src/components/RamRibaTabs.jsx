import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { key: "submissions", label: "Gelen Gönderimler", path: "/ram/riba" },
  { key: "special-targets", label: "Özel Hedef İstatistikleri", path: "/ram/riba/special-targets" },
  { key: "district-asp", label: "İlçe Ortalama ASP Analizi", disabled: true },
];

export const RamRibaTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="mb-6 overflow-x-auto border-b border-white/10" data-testid="ramriba-tabs">
      <div className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const active = t.path === pathname;
          return (
            <button
              key={t.key}
              disabled={t.disabled}
              onClick={() => { if (!t.disabled && !active) navigate(t.path); }}
              data-testid={`ramriba-tab-${t.key}`}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "border-emerald-400 text-white" : "border-transparent text-slate-400 enabled:hover:text-slate-200"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {t.label}
              {t.disabled && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10">Yakında</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
