import React from "react";

export const CorporateFooter = ({ className = "" }) => (
  <footer
    data-testid="corporate-footer"
    className={`px-6 py-6 text-center text-xs leading-relaxed text-slate-500 ${className}`}
  >
    <p>Bu uygulama Çukurova Rehberlik ve Araştırma Merkezi tarafından geliştirilmiştir.</p>
    <p className="mt-1">
      Destek ve geri bildirim:{" "}
      <a
        href="mailto:feritaktemur@gmail.com"
        data-testid="corporate-footer-email"
        className="text-slate-400 underline-offset-2 transition hover:text-emerald-300 hover:underline"
      >
        feritaktemur@gmail.com
      </a>
    </p>
  </footer>
);
