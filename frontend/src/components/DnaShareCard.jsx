import React, { useEffect, useState } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Copy, Check, Share2, AlertTriangle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DnaShareCard = ({ appId, appName, getHeaders }) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await getHeaders();
        const res = await axios.get(`${API}/school/dna/applications/${appId}/share`, { headers: h });
        if (alive) setUrl(`${window.location.origin}/dna/respond/${res.data.token}`);
      } catch (err) {
        const d = err.response?.data?.detail;
        if (alive) setError(typeof d === "string" ? d : "Paylaşım bağlantısı yüklenemedi.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [appId, getHeaders]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim engellenirse kullanıcı bağlantıyı elle seçebilir.
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: appName, text: "Devamsızlık Nedenleri Anketi", url });
    } catch {
      // Kullanıcı paylaşımı iptal etti.
    }
  };

  if (error) {
    return (
      <div data-testid={`dna-share-error-${appId}`} className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
      </div>
    );
  }
  if (!url) {
    return <Loader2 data-testid={`dna-share-loading-${appId}`} size={20} className="mt-4 animate-spin text-amber-300" />;
  }
  return (
    <div data-testid={`dna-share-${appId}`} className="mt-4 flex flex-col gap-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 rounded-lg bg-white p-2" data-testid={`dna-share-qr-${appId}`}>
        <QRCodeSVG value={url} size={132} level="M" marginSize={0} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">Öğrenci Paylaşım Bağlantısı</p>
        <p data-testid={`dna-share-url-${appId}`} className="mt-1 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-slate-200 select-all">
          {url}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copy} data-testid={`dna-share-copy-${appId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
          </button>
          {typeof navigator.share === "function" && (
            <button onClick={share} data-testid={`dna-share-native-${appId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]">
              <Share2 size={14} /> Paylaş
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">Bu bağlantı yalnızca devamsızlık sorunu yaşayan öğrencilerle paylaşılmalıdır.</p>
      </div>
    </div>
  );
};
