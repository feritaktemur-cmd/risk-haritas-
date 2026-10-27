import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { RiskRespondItem } from "../components/RiskRespondItem";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const inputCls = "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60";

const Shell = ({ children }) => (
  <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(50rem_30rem_at_80%_-10%,rgba(245,158,11,0.12),transparent)]">
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{children}</main>
  </div>
);

const Message = ({ testId, icon: Icon, tone, title, text }) => (
  <Shell>
    <div data-testid={testId} className={`mt-16 rounded-2xl border p-8 text-center ${tone}`}>
      <Icon size={36} className="mx-auto" />
      <p className="mt-4 text-lg font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </div>
  </Shell>
);

const Field = ({ label, testId, value, onChange, max, numeric }) => (
  <label className="text-sm font-semibold text-slate-200">{label}
    <input data-testid={testId} maxLength={max} inputMode={numeric ? "numeric" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
  </label>
);

export default function RiskRespond() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", student_number: "" });
  const [selected, setSelected] = useState({});
  const [none, setNone] = useState(false);
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/risk/respond/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setLoadError(err.response?.data?.detail || "Form yüklenemedi. Lütfen daha sonra tekrar deneyiniz."));
  }, [token]);

  if (loadError) return <Message testId="risk-r-invalid" icon={AlertTriangle} tone="border-rose-400/30 bg-rose-500/[0.06] text-rose-300" title="Form açılamadı" text={loadError} />;
  if (!data) return <Shell><div className="grid place-items-center py-24" data-testid="risk-r-loading"><Loader2 size={28} className="animate-spin text-amber-300" /></div></Shell>;
  if (state === "done") return <Message testId="risk-r-success" icon={CheckCircle2} tone="border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-300" title="Formunuz alındı" text="Teşekkür ederiz. Yanıtlarınız okul rehberlik servisine iletildi. Bu sayfayı kapatabilirsiniz." />;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (id) => {
    setNone(false);
    setSelected((s) => { const n = { ...s }; if (id in n) delete n[id]; else n[id] = ""; return n; });
  };
  const count = Object.keys(selected).length;
  const otherMissing = data.items.some((i) => i.requires_note && i.id in selected && !selected[i.id].trim());
  const ready = form.first_name.trim() && form.last_name.trim() && form.student_number.trim() && (count > 0 || none) && !otherMissing;

  const submit = async () => {
    setState("sending");
    setError(null);
    try {
      await axios.post(`${API}/risk/respond/${token}`, {
        ...form,
        items: Object.entries(selected).map(([id, note]) => ({ risk_category_id: id, note: note.trim() || null })),
        confirm_none: count === 0 && none,
      });
      setState("done");
    } catch (err) {
      setError(err.response?.data?.detail || "Formunuz gönderilemedi. Lütfen tekrar deneyiniz.");
      setState("idle");
    }
  };

  return (
    <Shell>
      <header data-testid="risk-r-header">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300/80">PDRPUSULA · Risk Haritası Öğrenci Formu</p>
        <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">{data.school_name}</h1>
        <p className="mt-1 text-sm text-slate-400" data-testid="risk-r-class">{data.class_label} · {data.academic_year}</p>
      </header>
      <div className="mt-5 flex gap-2 rounded-xl bg-white/[0.03] p-4 text-sm text-slate-300 ring-1 ring-white/10">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-300" />
        <p>Aşağıdaki listeden <b className="text-white">sizin için geçerli olan</b> maddeleri işaretleyiniz. Yanıtlarınızı yalnızca okul rehberlik servisi görür.</p>
      </div>
      <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-3">
        <Field label="Adınız" testId="risk-r-first-name" max={60} value={form.first_name} onChange={(v) => setField("first_name", v)} />
        <Field label="Soyadınız" testId="risk-r-last-name" max={60} value={form.last_name} onChange={(v) => setField("last_name", v)} />
        <Field label="Okul Numaranız" testId="risk-r-number" max={20} numeric value={form.student_number} onChange={(v) => setField("student_number", v)} />
      </div>
      <ul className="mt-5 space-y-2" data-testid="risk-r-items">
        {data.items.map((i) => (
          <RiskRespondItem key={i.id} item={i} checked={i.id in selected} note={selected[i.id] || ""}
            onToggle={() => toggle(i.id)} onNote={(v) => setSelected((s) => ({ ...s, [i.id]: v }))} />
        ))}
      </ul>
      <label data-testid="risk-r-none" className={`mt-4 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${none ? "border-emerald-400/50 bg-emerald-500/[0.08] text-emerald-100" : "border-white/10 text-slate-300"} ${count ? "opacity-50" : ""}`}>
        <input type="checkbox" data-testid="risk-r-none-checkbox" disabled={count > 0} checked={none && count === 0} onChange={(e) => setNone(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
        Bunlardan hiçbiri benim için geçerli değil.
      </label>
      {otherMissing && <p data-testid="risk-r-other-hint" className="mt-3 flex items-center gap-2 text-xs text-amber-200"><ShieldAlert size={14} /> "Diğer" seçeneği için kısa bir açıklama yazınız.</p>}
      {error && <div data-testid="risk-r-error" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"><AlertTriangle size={16} /> {error}</div>}
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400" data-testid="risk-r-count">{count} madde seçildi</p>
        <button type="button" onClick={submit} disabled={!ready || state === "sending"} data-testid="risk-r-submit"
          className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-extrabold text-[#0b1120] transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">
          {state === "sending" && <Loader2 size={16} className="animate-spin" />} Gönder
        </button>
      </div>
    </Shell>
  );
}
