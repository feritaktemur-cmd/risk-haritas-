import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, CalendarX2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { DnaQuestion } from "../components/DnaQuestion";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(50rem_30rem_at_80%_-10%,rgba(245,158,11,0.12),transparent)]">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function Message({ testId, icon: Icon, tone, title, text }) {
  return (
    <Shell>
      <div data-testid={testId} className={`mt-16 rounded-2xl border p-8 text-center ${tone}`}>
        <Icon size={36} className="mx-auto" />
        <p className="mt-4 text-lg font-bold text-white">{title}</p>
        <p className="mt-2 text-sm text-slate-300">{text}</p>
      </div>
    </Shell>
  );
}

function IdentityFields({ form, setField, classes }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-200">Adınız
        <input data-testid="dna-r-first-name" maxLength={60} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} className={inputCls} />
      </label>
      <label className="text-sm font-semibold text-slate-200">Soyadınız
        <input data-testid="dna-r-last-name" maxLength={60} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} className={inputCls} />
      </label>
      <label className="text-sm font-semibold text-slate-200">Okul Numaranız
        <input data-testid="dna-r-number" maxLength={20} inputMode="numeric" value={form.student_number} onChange={(e) => setField("student_number", e.target.value)} className={inputCls} />
      </label>
      <label className="text-sm font-semibold text-slate-200">Sınıfınız / Şubeniz
        <select data-testid="dna-r-class" value={form.school_class_id} onChange={(e) => setField("school_class_id", e.target.value)} className={inputCls}>
          <option value="" className="bg-[#0b1120]">Seçiniz</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#0b1120]">{c.level}/{c.branch}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function DnaRespond() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", student_number: "", school_class_id: "", open_text: "" });
  const [answers, setAnswers] = useState({});
  const [missing, setMissing] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/dna/respond/${encodeURIComponent(token)}`)
      .then((res) => setData(res.data))
      .catch((err) => setLoadError(err.response?.data?.detail || "Anket yüklenemedi. Lütfen daha sonra tekrar deneyiniz."));
  }, [token]);

  const setField = (k, v) => { setError(null); setForm((f) => ({ ...f, [k]: v })); };
  const setAnswer = (n, v) => { setAnswers((a) => ({ ...a, [n]: v })); setMissing((m) => m.filter((x) => x !== n)); };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.student_number.trim()) {
      return setError("Lütfen adınızı, soyadınızı ve okul numaranızı yazınız.");
    }
    if (!form.school_class_id) return setError("Lütfen sınıfınızı seçiniz.");
    const miss = data.items.map((i) => i.item_no).filter((n) => answers[n] === undefined);
    if (miss.length) {
      setMissing(miss);
      document.getElementById(`dna-q-${miss[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError(`Lütfen tüm soruları yanıtlayınız. Yanıtlanmamış soru sayısı: ${miss.length}`);
    }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API}/dna/respond/${encodeURIComponent(token)}`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        student_number: form.student_number.trim(),
        school_class_id: form.school_class_id,
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [String(k), v])),
        open_text: form.open_text.trim() || null,
      });
      setDone(true);
      window.scrollTo(0, 0);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Yanıtınız gönderilemedi. Lütfen tekrar deneyiniz.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return <Message testId="dna-r-load-error" icon={AlertTriangle} tone="border-amber-400/20 bg-amber-500/10 text-amber-300" title="Anket açılamadı" text={loadError} />;
  }
  if (done) {
    return <Message testId="dna-r-done" icon={CheckCircle2} tone="border-emerald-400/20 bg-emerald-500/10 text-emerald-300" title="Teşekkürler!" text="Yanıtlarınız kaydedildi. Bu sayfayı kapatabilirsiniz." />;
  }
  if (!data) {
    return <Shell><div className="grid place-items-center py-32" data-testid="dna-r-loading"><Loader2 size={28} className="animate-spin text-amber-300" /></div></Shell>;
  }

  const answered = Object.keys(answers).length;
  return (
    <Shell>
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-400 text-white"><CalendarX2 size={22} /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80" data-testid="dna-r-school">{data.school_name} · {data.academic_year}</p>
          <h1 className="text-xl font-extrabold text-white" data-testid="dna-r-title">Devamsızlık Nedenleri Anketi</h1>
        </div>
      </header>

      <div data-testid="dna-r-privacy" className="mt-6 flex gap-2.5 rounded-2xl border border-sky-400/20 bg-sky-500/[0.07] p-4 text-sm text-sky-100">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-300" />
        <p>Bu anket, okula devam etmeme nedenlerini anlamak için uygulanmaktadır. Yazdığınız ad, soyad, okul numarası ve yanıtlarınız yalnızca okulunuzun rehberlik servisi tarafından görülür; başka kurumlarla kimlik bilgilerinizle paylaşılmaz.</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-6" data-testid="dna-r-form">
        <IdentityFields form={form} setField={setField} classes={data.classes} />

        <div>
          <p className="text-sm text-slate-300">Aşağıdaki durumlar okula gelmemenize neden oluyorsa <b className="text-white">Evet</b>, bazen neden oluyorsa <b className="text-white">Bazen</b>, hiç neden olmuyorsa <b className="text-white">Hayır</b> seçeneğini işaretleyiniz.</p>
          <p className="mt-2 text-xs font-semibold text-amber-300" data-testid="dna-r-progress">{answered} / {data.items.length} soru yanıtlandı</p>
          <ol className="mt-4 space-y-3">
            {data.items.map((it) => (
              <DnaQuestion key={it.item_no} item={it} value={answers[it.item_no]} onChange={setAnswer} missing={missing.includes(it.item_no)} />
            ))}
          </ol>
        </div>

        <label className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-100">
          <span className="mr-2 font-bold text-amber-300">52.</span>{data.open_text_prompt} <span className="text-xs text-slate-400">(İsteğe bağlı)</span>
          <textarea data-testid="dna-r-open-text" rows={4} maxLength={data.open_text_max_length} value={form.open_text} onChange={(e) => setField("open_text", e.target.value)} className={inputCls} />
        </label>

        {error && (
          <div data-testid="dna-r-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={submitting} data-testid="dna-r-submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:opacity-90 disabled:opacity-50">
          {submitting && <Loader2 size={15} className="animate-spin" />} {submitting ? "Gönderiliyor…" : "Yanıtlarımı Gönder"}
        </button>
      </form>
    </Shell>
  );
}
