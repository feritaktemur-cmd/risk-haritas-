import React, { useEffect, useState } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const RiskLinkShareCard = ({ linkId, classLabel }) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      try {
        const res = await axios.get(`${API}/school/risk-links/${linkId}/share`, { headers: { Authorization: `Bearer ${token}` } });
        if (alive) setUrl(`${window.location.origin}/risk/respond/${res.data.token}`);
      } catch (err) {
        if (alive) setError(err.response?.data?.detail || "Bağlantı gösterilemedi.");
      }
    })();
    return () => { alive = false; };
  }, [linkId]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (error) return <p data-testid="risk-link-share-error" className="mt-3 flex items-center gap-2 text-xs text-rose-300"><AlertTriangle size={14} /> {error}</p>;
  if (!url) return <div className="mt-3" data-testid="risk-link-share-loading"><Loader2 size={18} className="animate-spin text-amber-300" /></div>;
  return (
    <div data-testid="risk-link-share" className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="rounded-lg bg-white p-2" data-testid="risk-link-qr"><QRCodeSVG value={url} size={112} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-300">{classLabel} öğrenci formu bağlantısı</p>
        <p data-testid="risk-link-url" className="mt-1 break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] text-slate-300">{url}</p>
        <button type="button" onClick={copy} data-testid="risk-link-copy"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </button>
      </div>
    </div>
  );
};
