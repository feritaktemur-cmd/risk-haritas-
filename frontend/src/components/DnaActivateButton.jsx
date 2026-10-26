import React, { useState } from "react";
import axios from "axios";
import { Loader2, Play, AlertTriangle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DnaActivateButton = ({ app, getHeaders, onActivated }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const activate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const h = await getHeaders();
      await axios.post(`${API}/school/dna/applications/${app.id}/activate`, {}, { headers: h });
      setOpen(false);
      onActivated();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Uygulama başlatılamadı. Lütfen tekrar deneyiniz.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid={`dna-activate-btn-${app.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
      >
        <Play size={13} /> Uygulamayı Başlat
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="dna-activate-dialog">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6">
            <p className="text-base font-bold text-white">Uygulamayı başlat</p>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-semibold text-white">{app.name}</span> aktif hâle getirilecek ve öğrenci paylaşım bağlantısı
              oluşturulacak. Başlatıldıktan sonra sınıf seçimi değiştirilemez ve uygulama taslağa geri alınamaz.
            </p>
            {error && (
              <div data-testid="dna-activate-error" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => !busy && setOpen(false)}
                data-testid="dna-activate-cancel"
                className="rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.1]"
              >
                Vazgeç
              </button>
              <button
                onClick={activate}
                disabled={busy}
                data-testid="dna-activate-confirm"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
