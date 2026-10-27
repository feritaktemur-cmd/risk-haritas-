import React from "react";
import { QrCode } from "lucide-react";

export const RiskLinkShareCard = ({ classLabel }) => (
  <div data-testid="risk-link-share-pending" className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/[0.05] px-4 py-3">
    <QrCode size={18} className="mt-0.5 shrink-0 text-amber-300" />
    <p className="text-xs text-amber-100/90">
      {classLabel} bağlantısı hazır. Öğrenci formu hazırlanıyor; QR kod ve bağlantı form yayına alındığında burada gösterilecek.
    </p>
  </div>
);
