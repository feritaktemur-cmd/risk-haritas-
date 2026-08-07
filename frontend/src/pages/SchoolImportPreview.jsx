import React, { useRef, useState } from "react";
import axios from "axios";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, Building2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STYLES = {
  "YÜKLENEBİLİR": "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  "KAPSAM DIŞI": "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  "HATALI İLÇE": "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  "HATALI OKUL TÜRÜ": "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || "bg-slate-500/15 text-slate-300 ring-slate-400/30";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {status === "YÜKLENEBİLİR" && <Check size={13} />}
      {status}
    </span>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    total: "text-white",
    ok: "text-emerald-300",
    muted: "text-slate-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${tones[tone] || "text-white"}`} data-testid={`stat-${tone}`}>
        {value}
      </p>
    </div>
  );
}

export default function SchoolImportPreview() {
  const [managementType, setManagementType] = useState("Resmî");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  const onFile = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError(null);
  };

  const generate = async () => {
    if (!file) {
      setError("Lütfen bir Excel dosyası seçin.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("management_type", managementType);
      const { data } = await axios.post(`${API}/schools/preview`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    }
    setLoading(false);
  };

  const s = result?.summary;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">Okul İçe Aktarma · Ön İzleme</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Excel dosyası okunur, analiz edilir ve size ön izleme gösterilir.
          <span className="text-slate-300"> Bu adımda veritabanına hiçbir kayıt yazılmaz.</span>
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-200">Yönetim Türü</p>
            <div className="flex gap-3">
              {["Resmî", "Özel"].map((mt) => (
                <label
                  key={mt}
                  data-testid={`mgmt-${mt}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    managementType === mt
                      ? "border-indigo-400/50 bg-indigo-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="managementType"
                    value={mt}
                    checked={managementType === mt}
                    onChange={() => setManagementType(mt)}
                    className="accent-indigo-400"
                  />
                  <Building2 size={15} />
                  {mt}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-slate-200">Excel Dosyası</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              onChange={onFile}
              className="hidden"
              data-testid="file-input"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                data-testid="file-select-btn"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                <Upload size={15} /> Dosya Seç
              </button>
              <span className="truncate text-sm text-slate-400" data-testid="file-name">
                {file ? file.name : "Dosya seçilmedi"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={generate}
            disabled={loading}
            data-testid="preview-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            Ön İzleme Oluştur
          </button>
          <span className="text-xs text-slate-500">Henüz okul oluşturulmaz.</span>
        </div>

        {error && (
          <div data-testid="preview-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Preview result */}
      {result && (
        <div className="mt-8" data-testid="preview-result">
          <h2 className="mb-4 text-lg font-bold text-white">Ön İzleme Sonucu</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Toplam Satır" value={s.total} tone="total" />
            <Stat label="Yüklenebilir" value={s.loadable} tone="ok" />
            <Stat label="Kapsam Dışı" value={s.out_of_scope} tone="muted" />
            <Stat label="Hatalı İlçe" value={s.invalid_district} tone="warn" />
            <Stat label="Hatalı Okul Türü" value={s.invalid_school_type} tone="bad" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm" data-testid="preview-table">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kurum Adı</th>
                  <th className="px-4 py-3 font-semibold">İlçe</th>
                  <th className="px-4 py-3 font-semibold">MEB Kurum Türü</th>
                  <th className="px-4 py-3 font-semibold">Sistem Okul Türü</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.rows.map((r, i) => (
                  <tr key={i} className="text-slate-300 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">{r.institution_name}</td>
                    <td className="px-4 py-2.5 text-slate-400">{r.district}</td>
                    <td className="px-4 py-2.5 text-slate-400">{r.meb_type}</td>
                    <td className="px-4 py-2.5">{r.system_school_type}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
