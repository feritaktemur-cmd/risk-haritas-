import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ClipboardList, Loader2, AlertTriangle, GraduationCap, CalendarDays, Layers, Users } from "lucide-react";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PARTICIPANT_LABELS = { student: "Öğrenci", parent: "Veli", teacher: "Öğretmen" };
const GENDER_LABELS = { K: "Kız", E: "Erkek" };

function MetaRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <Icon size={15} className="shrink-0 text-emerald-300/80" />
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export default function RibaRespond() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);

  const [selectedClass, setSelectedClass] = useState("");
  const [gender, setGender] = useState("");
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API}/riba/respond/${token}`);
        if (active) setForm(data);
      } catch (err) {
        const status = err.response?.status;
        let msg;
        if (status === 404) msg = "Bu anket bağlantısı geçersiz veya artık kullanılamıyor.";
        else if (status === 409) msg = "Bu anket şu anda yanıt kabul etmiyor.";
        else msg = "Form yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyiniz.";
        if (active) setError(msg);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [token]);

  const setAnswer = (qid, opt) => setAnswers((prev) => ({ ...prev, [qid]: opt }));

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)] px-6">
        <div data-testid="riba-respond-loading" className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 size={28} className="animate-spin text-emerald-300" />
          <p className="text-sm">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)] px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={24} />
          </div>
          <div data-testid="riba-respond-error" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-200 backdrop-blur">
            {error}
          </div>
          <CorporateFooter className="mt-8" />
        </div>
      </div>
    );
  }

  const questions = form?.questions || [];
  const answeredCount = questions.filter((q) => answers[q.question_id]).length;
  const totalCount = questions.length;
  const participantLabel = PARTICIPANT_LABELS[form?.participant_type] || form?.participant_type;

  return (
    <div className="min-h-screen w-full bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div data-testid="riba-respond-header" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white shadow-lg shadow-emerald-500/20">
              <ClipboardList size={22} />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white sm:text-xl" data-testid="riba-school-name">{form?.school_name}</h1>
            </div>
          </div>
          <p className="mt-4 text-base font-bold text-white">RİBA – Rehberlik İhtiyacı Belirleme Anketi</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MetaRow icon={GraduationCap} label="Eğitim Kademesi" value={form?.education_level} />
            <MetaRow icon={CalendarDays} label="Eğitim Öğretim Yılı" value={form?.academic_year} />
            <MetaRow icon={Users} label="Katılımcı Türü" value={participantLabel} />
          </div>
        </div>

        {/* Participant info */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
          <label className="mb-1 block text-sm font-medium text-slate-300">Sınıf / Şube</label>
          <select
            data-testid="riba-class-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
          >
            <option value="" className="bg-[#0b1120]">Seçiniz…</option>
            {(form?.classes || []).map((cls) => (
              <option key={cls.id} value={cls.id} className="bg-[#0b1120]">{cls.name}</option>
            ))}
          </select>

          {form?.requires_gender && (
            <>
              <label className="mb-1 block text-sm font-medium text-slate-300">Cinsiyet</label>
              <div className="grid grid-cols-2 gap-3">
                {(form?.gender_options || ["K", "E"]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-testid={`riba-gender-${g}`}
                    onClick={() => setGender(g)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      gender === g
                        ? "border-emerald-400/60 bg-emerald-500/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {GENDER_LABELS[g] || g}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Instruction */}
        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-sm leading-relaxed text-emerald-100/90" data-testid="riba-instruction">
          Her soruda <strong>A</strong> veya <strong>B</strong> seçeneklerinden yalnızca birini işaretleyiniz. Tüm soruların cevaplanması gerekmektedir.
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-slate-400">Cevaplanan</span>
          <span data-testid="riba-progress" className="font-bold text-white">{answeredCount} / {totalCount}</span>
        </div>

        {/* Questions */}
        <div className="mt-5 space-y-4">
          {questions.map((q) => (
            <div
              key={q.question_id}
              data-testid={`riba-question-${q.question_no}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur sm:p-5"
            >
              <p className="mb-3 text-sm font-semibold text-slate-300">Soru {q.question_no}</p>
              <div className="space-y-3">
                {["A", "B"].map((opt) => {
                  const text = opt === "A" ? q.option_a_text : q.option_b_text;
                  const active = answers[q.question_id] === opt;
                  return (
                    <label
                      key={opt}
                      data-testid={`riba-q${q.question_no}-option-${opt}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        active
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.question_id}`}
                        checked={active}
                        onChange={() => setAnswer(q.question_id, opt)}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-400"
                      />
                      <span className="text-sm leading-relaxed text-white">
                        <span className="mr-1.5 font-bold text-emerald-300">{opt})</span>
                        {text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit (disabled in this task) */}
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled
            data-testid="riba-submit-disabled"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white opacity-50"
          >
            Yanıtları Gönder
          </button>
          <p className="mt-2 text-xs text-slate-400">Form gönderme sonraki adımda etkinleştirilecektir.</p>
        </div>

        <CorporateFooter className="mt-10" />
      </div>
    </div>
  );
}
