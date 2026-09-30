import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, ClipboardList, ArrowLeft, AlertTriangle, Users, CalendarDays, Rocket, X, Info, Link2, Copy, ExternalLink, Check, BarChart3, GraduationCap, Lock, CheckCircle2, ChevronDown, School } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PARTICIPANT_LABELS = {
  student: "Öğrenci Formu",
  parent: "Veli Formu",
  teacher: "Öğretmen Formu",
};

const STATUS_LABELS = {
  draft: "Taslak",
  active: "Aktif",
  closed: "Kapalı",
  finalized: "Sonuçlandırılmış",
};

const STATUS_STYLES = {
  draft: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  closed: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  finalized: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatPct(percentage) {
  if (percentage === null || percentage === undefined) return "—";
  // Round to 1 decimal for display only; backend value is authoritative.
  const r = Math.round(percentage * 10) / 10;
  return `%${Number.isInteger(r) ? r : r.toFixed(1)}`;
}

const NO_DATA_TEXT = "Hesaplama için yeterli veri bulunmamaktadır.";

// Presentation-only ASP formatting; raw value in state stays unchanged.
function formatAsp(asp) {
  if (asp === null || asp === undefined) return null;
  const r = Math.round(asp * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

// Visual bar width is capped at 100% so the UI never overflows, while the
// written percentage above shows the real (possibly >100%) backend value.
function barWidth(percentage) {
  if (percentage === null || percentage === undefined) return 0;
  return Math.max(0, Math.min(100, percentage));
}

const RIBA_METHODOLOGY_TEXT =
  "RİBA sonuçları MEB RİBA Sınıf ve Okul Sonuç Çizelgelerinde kullanılan hesaplama yöntemi esas alınarak oluşturulmuştur. Katılımcı cevaplarından her rehberlik ihtiyacının frekansı belirlenmiş, frekanslar standart puana dönüştürülmüş ve ilgili eğitim kademesi için belirlenen öğrenci, veli ve öğretmen ağırlıkları kullanılarak ASP hesaplanmıştır. Öncelik sırası ASP değerlerine göre belirlenmiştir.";

function HowCalculated({ open, setOpen }) {
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="riba-results-how-toggle"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-white"
      >
        <span className="inline-flex items-center gap-2"><Info size={15} className="text-emerald-300/80" /> Nasıl hesaplandı?</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed text-slate-400" data-testid="riba-results-how-text">
          {RIBA_METHODOLOGY_TEXT}
        </p>
      )}
    </div>
  );
}

function ResultsPanel({ results, tab, setTab, selectedClassId, setSelectedClassId, howOpen, setHowOpen, st1, st2, setSt1, setSt2, onFinalizeClick }) {
  const app = results.application || {};
  const classResults = results.class_results || [];
  const schoolResults = results.school_results || [];
  // Preschool (education_level_id === 1) has no student participant group.
  const showStudent = app.education_level_id !== 1;
  const closed = formatDate(app.closed_at);
  const isClosed = app.status === "closed";
  const isFinalized = app.status === "finalized";

  const activeClass = classResults.find((c) => c.school_class_id === selectedClassId) || classResults[0] || null;

  // Special-target option label (helper info only; never reorders).
  const optionLabel = (t) => {
    let extra = "";
    const hasRank = t.rank !== null && t.rank !== undefined;
    const hasAsp = t.average_asp !== null && t.average_asp !== undefined;
    if (hasRank && hasAsp) extra = ` (Sıra: ${t.rank}, ASP: ${formatAsp(t.average_asp)})`;
    else if (hasRank) extra = ` (Sıra: ${t.rank})`;
    else if (hasAsp) extra = ` (ASP: ${formatAsp(t.average_asp)})`;
    return `${t.meb_code} — ${t.target_name}${extra}`;
  };
  const canFinalize = st1 && st2 && st1 !== st2;

  return (
    <div className="mt-5" data-testid="riba-results-panel">
      {/* summary */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400" data-testid="riba-results-summary">
        <span>Eğitim Öğretim Yılı: <span className="text-slate-200">{app.academic_year || "—"}</span></span>
        <span>Eğitim Kademesi: <span className="text-slate-200">{app.education_level || "—"}</span></span>
        {closed && <span>Kapanış: <span className="text-slate-200">{closed}</span></span>}
      </div>

      {/* tabs */}
      <div className="mt-4 inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10" data-testid="riba-results-tabs">
        <button
          onClick={() => setTab("class")}
          data-testid="riba-results-tab-class"
          className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${tab === "class" ? "bg-emerald-500/20 text-white" : "text-slate-300 hover:text-white"}`}
        >
          Sınıf Sonuçları
        </button>
        <button
          onClick={() => setTab("school")}
          data-testid="riba-results-tab-school"
          className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${tab === "school" ? "bg-emerald-500/20 text-white" : "text-slate-300 hover:text-white"}`}
        >
          Okul Sonucu
        </button>
      </div>

      {/* CLASS TAB */}
      {tab === "class" && activeClass && (
        <div className="mt-4" data-testid="riba-results-class">
          {classResults.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sınıf:</span>
              <select
                value={activeClass.school_class_id}
                onChange={(e) => setSelectedClassId(e.target.value)}
                data-testid="riba-results-class-select"
                className="rounded-lg border border-white/10 bg-[#0b1120] px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-emerald-400/60"
              >
                {classResults.map((c) => (
                  <option key={c.school_class_id} value={c.school_class_id}>{c.class_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm font-extrabold text-white" data-testid="riba-results-class-name">{activeClass.class_name}</p>
          )}

          {/* response counts */}
          <div className="mt-3 flex flex-wrap gap-2.5" data-testid="riba-results-counts">
            {showStudent && (
              <CountChip icon={<GraduationCap size={14} />} label="Öğrenci" value={activeClass.student_response_count} testid="riba-results-count-student" />
            )}
            <CountChip icon={<Users size={14} />} label="Veli" value={activeClass.parent_response_count} testid="riba-results-count-parent" />
            <CountChip icon={<Users size={14} />} label="Öğretmen" value={activeClass.teacher_response_count} testid="riba-results-count-teacher" />
          </div>

          {/* target table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10" data-testid="riba-results-class-table">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-20 px-3 py-2 font-semibold">MEB Kodu</th>
                  <th className="px-3 py-2 font-semibold">Rehberlik İhtiyacı</th>
                  <th className="w-56 px-3 py-2 font-semibold">ASP</th>
                </tr>
              </thead>
              <tbody>
                {activeClass.targets.map((t) => {
                  const asp = formatAsp(t.asp);
                  return (
                    <tr key={t.target_id} className="border-t border-white/10" data-testid={`riba-results-class-row-${t.meb_code}`}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{t.meb_code}</td>
                      <td className="px-3 py-2 text-slate-200">{t.target_name}</td>
                      <td className="px-3 py-2">
                        {asp === null ? (
                          <span className="text-xs italic text-slate-500">{NO_DATA_TEXT}</span>
                        ) : (
                          <span className="font-bold text-white">{asp}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCHOOL TAB */}
      {tab === "school" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10" data-testid="riba-results-school-table">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-16 px-3 py-2 font-semibold">Sıra</th>
                <th className="w-20 px-3 py-2 font-semibold">MEB Kodu</th>
                <th className="px-3 py-2 font-semibold">Rehberlik İhtiyacı</th>
                <th className="w-56 px-3 py-2 font-semibold">Ortalama ASP</th>
              </tr>
            </thead>
            <tbody>
              {schoolResults.map((t) => {
                const avg = formatAsp(t.average_asp);
                return (
                  <tr key={t.target_id} className="border-t border-white/10" data-testid={`riba-results-school-row-${t.meb_code}`}>
                    <td className="px-3 py-2 text-slate-300">{t.rank === null || t.rank === undefined ? <span className="text-slate-500">—</span> : t.rank}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{t.meb_code}</td>
                    <td className="px-3 py-2 text-slate-200">{t.target_name}</td>
                    <td className="px-3 py-2">
                      {avg === null ? (
                        <span className="text-xs italic text-slate-500">{NO_DATA_TEXT}</span>
                      ) : (
                        <span className="font-bold text-white">{avg}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Okul Özel Hedefleri */}
      {(isClosed || isFinalized) && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5" data-testid="riba-special-targets-card">
          <h4 className="text-sm font-bold text-white">Okul Özel Hedefleri</h4>

          {isFinalized ? (
            <div className="mt-3" data-testid="riba-special-targets-readonly">
              {(app.special_targets || []).map((t, i) => (
                <p key={t.target_id} className="text-sm text-slate-200" data-testid={`riba-special-target-ro-${i + 1}`}>
                  <span className="text-slate-400">{i + 1}.</span> <span className="font-mono text-xs text-slate-300">{t.meb_code}</span> — {t.target_name}
                </p>
              ))}
              {app.finalized_at && (
                <p className="mt-2 text-xs text-slate-500">Sonuçlandırma: {formatDate(app.finalized_at)}</p>
              )}
            </div>
          ) : (
            <div className="mt-3" data-testid="riba-special-targets-select">
              <p className="text-xs leading-relaxed text-slate-400">
                RİBA sonuçlarını ve okulunuzdaki gözlem, görüşme ve diğer değerlendirme sonuçlarını dikkate alarak iki özel hedef belirleyiniz.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Özel Hedef 1</label>
                  <select
                    value={st1}
                    onChange={(e) => setSt1(e.target.value)}
                    data-testid="riba-special-target-1"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  >
                    <option value="">Seçiniz…</option>
                    {schoolResults.map((t) => (
                      <option key={t.target_id} value={t.target_id} disabled={t.target_id === st2}>
                        {optionLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Özel Hedef 2</label>
                  <select
                    value={st2}
                    onChange={(e) => setSt2(e.target.value)}
                    data-testid="riba-special-target-2"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  >
                    <option value="">Seçiniz…</option>
                    {schoolResults.map((t) => (
                      <option key={t.target_id} value={t.target_id} disabled={t.target_id === st1}>
                        {optionLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={onFinalizeClick}
                disabled={!canFinalize}
                data-testid="riba-finalize-btn"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Özel Hedefleri Kaydet ve Sonuçlandır
              </button>
            </div>
          )}
        </div>
      )}

      <HowCalculated open={howOpen} setOpen={setHowOpen} />
    </div>
  );
}

function CountChip({ icon, label, value, testid }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm ring-1 ring-white/10" data-testid={testid}>
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-300">{label}:</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function CloseMetricRow({ title, metric, testid }) {
  const met = metric.meets_30_percent === true;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5" data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-sm font-bold text-white" data-testid={`${testid}-count`}>
          {metric.response_count} / {metric.denominator} yanıt · {formatPct(metric.percentage)}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-400">Minimum hedef: <span className="text-slate-200">{metric.minimum_required}</span></span>
        {met ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-300" data-testid={`${testid}-target`}>
            <Check size={13} /> %30 hedefe ulaşıldı
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-300" data-testid={`${testid}-target`}>
            <AlertTriangle size={13} /> %30 hedef henüz tamamlanmadı
          </span>
        )}
      </div>
    </div>
  );
}

function ParticipantMetric({ label, icon, metric, testid }) {
  const met = metric.meets_30_percent === true;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5" data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          {icon}
          {label}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-white" data-testid={`${testid}-count`}>
            {metric.response_count} / {metric.denominator} yanıt
          </p>
          <p className="text-xs text-slate-400" data-testid={`${testid}-pct`}>{formatPct(metric.percentage)}</p>
        </div>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : "bg-indigo-500/70"}`}
          style={{ width: `${barWidth(metric.percentage)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-400">Minimum hedef: <span className="text-slate-200">{metric.minimum_required}</span></span>
        {met ? (
          <span className="font-semibold text-emerald-300" data-testid={`${testid}-target`}>%30 hedefe ulaşıldı</span>
        ) : (
          <span className="text-slate-500" data-testid={`${testid}-target`}>%30 hedef henüz tamamlanmadı</span>
        )}
      </div>
    </div>
  );
}

export default function SchoolRibaManage() {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [app, setApp] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState(null);
  const [links, setLinks] = useState(null); // { parent: url, teacher: url }
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const [participation, setParticipation] = useState(null);
  const [partLoading, setPartLoading] = useState(false);
  const [partError, setPartError] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closePreview, setClosePreview] = useState(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closeSubmitError, setCloseSubmitError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null);
  const [resultsTab, setResultsTab] = useState("class");
  const [selectedResultClassId, setSelectedResultClassId] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const [st1, setSt1] = useState("");
  const [st2, setSt2] = useState("");
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState(null);

  const submitFinalize = async () => {
    if (finalizing) return;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.post(
        `${API}/school/riba/applications/${applicationId}/finalize`,
        { special_target_1_id: st1, special_target_2_id: st2 },
        { headers: h }
      );
      if (res.data?.status === "finalized") {
        setFinalizeConfirmOpen(false);
        setFlash("RİBA uygulaması başarıyla sonuçlandırıldı.");
        await load();
        await loadResults();
      } else {
        setFinalizeError("RİBA uygulaması sonuçlandırılırken bir sorun oluştu. Lütfen tekrar deneyiniz.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setFinalizeError("RİBA uygulaması sonuçlandırılırken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setFinalizing(false);
    }
  };

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.get(`${API}/school/riba/applications/${applicationId}/results`, { headers: h });
      setResults(res.data);
      const first = res.data?.class_results?.[0]?.school_class_id || null;
      setSelectedResultClassId(first);
    } catch (err) {
      setResultsError("RİBA sonuçları yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setResultsLoading(false);
    }
  }, [navigate, applicationId]);

  const openClosePreview = useCallback(async () => {
    setCloseOpen(true);
    setClosePreview(null);
    setCloseError(null);
    setCloseSubmitError(null);
    setCloseLoading(true);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.get(`${API}/school/riba/applications/${applicationId}/close-preview`, { headers: h });
      setClosePreview(res.data);
    } catch (err) {
      setCloseError("Kapatma ön kontrolü yapılırken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setCloseLoading(false);
    }
  }, [navigate, applicationId]);

  const submitClose = async () => {
    if (closing) return;
    setClosing(true);
    setCloseSubmitError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.post(`${API}/school/riba/applications/${applicationId}/close`, {}, { headers: h });
      if (res.data?.status === "closed") {
        setCloseOpen(false);
        setFlash("RİBA uygulaması başarıyla kapatıldı. Yeni yanıt kabul edilmeyecektir.");
        await load();
      } else {
        setCloseSubmitError("RİBA uygulaması kapatılırken bir sorun oluştu. Uygulama açık bırakıldı; lütfen tekrar deneyiniz.");
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setCloseSubmitError("RİBA uygulaması kapatılırken bir sorun oluştu. Uygulama açık bırakıldı; lütfen tekrar deneyiniz.");
    } finally {
      setClosing(false);
    }
  };

  const loadParticipation = useCallback(async () => {
    setPartLoading(true);
    setPartError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.get(`${API}/school/riba/applications/${applicationId}/participation`, { headers: h });
      setParticipation(res.data);
    } catch (err) {
      setPartError("Katılım bilgileri yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setPartLoading(false);
    }
  }, [navigate, applicationId]);

  const loadLinks = useCallback(async () => {
    setLinksLoading(true);
    setLinksError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      const res = await axios.get(`${API}/school/riba/applications/${applicationId}/access-links`, { headers: h });
      // Backend is authoritative: only participant types actually present are shown.
      const tokens = res.data.access_tokens || {};
      const built = {};
      Object.keys(tokens).forEach((ptype) => {
        built[ptype] = `${window.location.origin}/riba/respond/${tokens[ptype]}`;
      });
      setLinks(built);
    } catch (err) {
      setLinksError("Form bağlantıları yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLinksLoading(false);
    }
  }, [navigate, applicationId]);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) {
      navigate("/school/login", { replace: true });
      return;
    }
    try {
      const res = await axios.get(`${API}/school/riba/applications`, { headers: h });
      const found = (res.data.applications || []).find((a) => a.id === applicationId);
      if (!found) {
        setError("Bu RİBA uygulaması bulunamadı.");
        setApp(null);
      } else {
        setApp(found);
        setError(null);
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
        return;
      }
      if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      }
      setError("RİBA uygulaması yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  }, [navigate, applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (app?.status === "active") {
      loadLinks();
      loadParticipation();
    }
    if (app?.status === "closed" || app?.status === "finalized") {
      loadResults();
    }
  }, [app?.status, loadLinks, loadParticipation, loadResults]);

  const copyLink = async (ptype, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedType(ptype);
      setTimeout(() => setCopiedType((c) => (c === ptype ? null : c)), 2000);
    } catch {
      // Clipboard blocked; do not break the app — user can select the URL manually.
    }
  };

  const closeModal = () => {
    if (activating) return;
    setConfirmOpen(false);
    setActivateError(null);
  };

  const activate = async () => {
    if (activating) return;
    setActivating(true);
    setActivateError(null);
    try {
      const h = await authHeader();
      if (!h) {
        navigate("/school/login", { replace: true });
        return;
      }
      // Backend derives school_id from token and handles form pinning, access
      // links, status and opened_at. No body / no client-generated fields.
      await axios.post(`${API}/school/riba/applications/${applicationId}/activate`, {}, { headers: h });
      setConfirmOpen(false);
      await load();
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setActivateError("Bu RİBA uygulaması artık başlatılamıyor.");
      } else if (status === 401) {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
        return;
      } else {
        setActivateError("RİBA uygulaması başlatılırken bir sorun oluştu. Lütfen tekrar deneyiniz.");
      }
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="riba-manage-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const label = app ? (STATUS_LABELS[app.status] || app.status) : null;
  const badge = app ? (STATUS_STYLES[app.status] || "bg-white/10 text-slate-300 ring-white/20") : "";
  const created = app ? formatDate(app.created_at) : null;
  const opened = app ? formatDate(app.opened_at) : null;
  const isDraft = app?.status === "draft";

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="riba-manage-title">RİBA Uygulaması</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/riba")}
            data-testid="riba-manage-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> RİBA'ya Dön
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {error || !app ? (
          <div
            data-testid="riba-manage-error"
            className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-200"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error || "Bu RİBA uygulaması bulunamadı."}</span>
          </div>
        ) : (
          <>
            {flash && (
              <div
                data-testid="riba-manage-flash"
                className="mb-5 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200 ring-1 ring-emerald-400/20"
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{flash}</span>
              </div>
            )}
            {/* Top summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-summary">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold text-white" data-testid="riba-manage-name">{app.name}</h2>
                <span
                  data-testid="riba-manage-status"
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${badge}`}
                >
                  {label}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-400">
                <span data-testid="riba-manage-year">
                  Eğitim Öğretim Yılı: <span className="text-slate-200">{app.academic_year || "—"}</span>
                </span>
                {created && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> Oluşturulma: <span className="text-slate-300">{created}</span>
                  </span>
                )}
                {opened && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> Başlangıç Tarihi: <span className="text-slate-300">{opened}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Application info */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-info">
              <h3 className="text-sm font-bold text-white">Uygulama Bilgileri</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dahil Edilen Sınıflar</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="riba-manage-classes">
                    {app.classes && app.classes.length > 0 ? (
                      app.classes.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10"
                        >
                          {c.name || `${c.level}/${c.branch}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Users size={16} className="shrink-0 text-slate-400" />
                  <span data-testid="riba-manage-teachers">
                    Toplam Öğretmen Sayısı: <span className="font-bold text-white">{app.teacher_count}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Draft note + start / active info */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-manage-start-area">
              {isDraft ? (
                <>
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <Info size={16} className="mt-0.5 shrink-0 text-emerald-300/80" />
                    <p>
                      Uygulama henüz başlamadı. Başlatıldığında katılımcı formları ve paylaşım bağlantıları oluşturulacaktır.
                    </p>
                  </div>
                  <button
                    onClick={() => { setActivateError(null); setConfirmOpen(true); }}
                    data-testid="riba-manage-start-btn"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
                  >
                    <Rocket size={16} /> Uygulamayı Başlat
                  </button>
                </>
              ) : app.status === "active" ? (
                <div className="flex items-start gap-2 text-sm text-slate-300" data-testid="riba-manage-active-info">
                  <Info size={16} className="mt-0.5 shrink-0 text-emerald-300/80" />
                  <p>RİBA uygulaması aktif. Katılımcılar için form bağlantıları oluşturuldu.</p>
                </div>
              ) : app.status === "closed" ? (
                <div className="flex items-start gap-2 text-sm text-slate-300" data-testid="riba-manage-closed-info">
                  <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <p>RİBA uygulaması kapatılmıştır. Yeni yanıt kabul edilmemektedir.</p>
                </div>
              ) : null}
            </div>

            {/* Sonuçlar (closed / finalized) */}
            {(app.status === "closed" || app.status === "finalized") && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-results-section">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-300/80" />
                  <h3 className="text-sm font-bold text-white">Sonuçlar</h3>
                </div>

                {resultsLoading && (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-400" data-testid="riba-results-loading">
                    <Loader2 size={16} className="animate-spin text-emerald-300" /> Sonuçlar yükleniyor…
                  </div>
                )}

                {!resultsLoading && resultsError && (
                  <div
                    data-testid="riba-results-error"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{resultsError}</span>
                  </div>
                )}

                {!resultsLoading && !resultsError && results && (
                  <ResultsPanel
                    results={results}
                    tab={resultsTab}
                    setTab={setResultsTab}
                    selectedClassId={selectedResultClassId}
                    setSelectedClassId={setSelectedResultClassId}
                    howOpen={howOpen}
                    setHowOpen={setHowOpen}
                    st1={st1}
                    st2={st2}
                    setSt1={setSt1}
                    setSt2={setSt2}
                    onFinalizeClick={() => { setFinalizeError(null); setFinalizeConfirmOpen(true); }}
                  />
                )}
              </div>
            )}


            {/* Formlar ve QR (only when active) */}
            {app.status === "active" && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-forms-section">
                <div className="flex items-center gap-2">
                  <Link2 size={16} className="text-emerald-300/80" />
                  <h3 className="text-sm font-bold text-white">Formlar ve QR</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Katılımcı bağlantılarını paylaşarak RİBA formlarına erişim sağlayabilirsiniz.
                </p>

                {linksLoading && (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-400" data-testid="riba-forms-loading">
                    <Loader2 size={16} className="animate-spin text-emerald-300" /> Bağlantılar yükleniyor…
                  </div>
                )}

                {!linksLoading && linksError && (
                  <div
                    data-testid="riba-forms-error"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{linksError}</span>
                  </div>
                )}

                {!linksLoading && !linksError && links && (
                  <div className="mt-5 space-y-4" data-testid="riba-forms-list">
                    {Object.keys(links).map((ptype) => {
                      const url = links[ptype];
                      const title = PARTICIPANT_LABELS[ptype] || ptype;
                      const copied = copiedType === ptype;
                      return (
                        <div
                          key={ptype}
                          data-testid={`riba-form-card-${ptype}`}
                          className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                        >
                          <p className="text-sm font-bold text-white" data-testid={`riba-form-title-${ptype}`}>{title}</p>
                          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="flex flex-col items-center gap-1.5" data-testid={`riba-form-qr-${ptype}`}>
                              <div className="rounded-xl bg-white p-3">
                                <QRCodeSVG value={url} size={148} level="M" marginSize={0} />
                              </div>
                              <p className="max-w-[160px] text-center text-[11px] leading-tight text-slate-400">
                                Telefon kamerasıyla tarayarak forma ulaşabilirsiniz.
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                  readOnly
                                  value={url}
                                  data-testid={`riba-form-url-${ptype}`}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full flex-1 truncate rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-400/60"
                                />
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => copyLink(ptype, url)}
                                  data-testid={`riba-form-copy-${ptype}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
                                >
                                  {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                                  {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid={`riba-form-open-${ptype}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
                                >
                                  <ExternalLink size={14} /> Formu Aç
                                </a>
                              </div>
                              {copied && (
                                <p className="mt-2 text-xs text-emerald-300" data-testid={`riba-form-copied-${ptype}`}>
                                  Bağlantı kopyalandı.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Katılım Takibi (only when active) */}
            {app.status === "active" && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-participation-section">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-300/80" />
                  <h3 className="text-sm font-bold text-white">Katılım Takibi</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  RİBA formlarına gelen yanıtları ve %30 katılım hedefini takip edebilirsiniz.
                </p>

                {partLoading && (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-400" data-testid="riba-participation-loading">
                    <Loader2 size={16} className="animate-spin text-emerald-300" /> Katılım bilgileri yükleniyor…
                  </div>
                )}

                {!partLoading && partError && (
                  <div
                    data-testid="riba-participation-error"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{partError}</span>
                  </div>
                )}

                {!partLoading && !partError && participation && (
                  <div className="mt-5 space-y-4" data-testid="riba-participation-body">
                    {(participation.classes || []).map((cls) => (
                      <div
                        key={cls.school_class_id}
                        data-testid={`riba-part-class-${cls.school_class_id}`}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <p className="text-sm font-extrabold text-white">{cls.class_name}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {cls.parent && (
                            <ParticipantMetric
                              label="Veli"
                              icon={<Users size={15} className="text-slate-400" />}
                              metric={cls.parent}
                              testid={`riba-part-${cls.school_class_id}-parent`}
                            />
                          )}
                          {cls.student && (
                            <ParticipantMetric
                              label="Öğrenci"
                              icon={<GraduationCap size={15} className="text-slate-400" />}
                              metric={cls.student}
                              testid={`riba-part-${cls.school_class_id}-student`}
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {participation.teacher && (
                      <div data-testid="riba-part-teacher-card">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Okul Geneli</p>
                        <ParticipantMetric
                          label="Öğretmen"
                          icon={<Users size={15} className="text-slate-400" />}
                          metric={participation.teacher}
                          testid="riba-part-teacher"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Uygulamayı Kapat (only when active) */}
            {app.status === "active" && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="riba-close-section">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-amber-300/80" />
                  <h3 className="text-sm font-bold text-white">Uygulamayı Kapat</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Uygulamayı kapatmadan önce mevcut katılım durumunu kontrol edebilirsiniz.
                </p>
                <button
                  onClick={openClosePreview}
                  data-testid="riba-close-btn"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-200 ring-1 ring-amber-400/30 transition hover:bg-amber-500/25"
                >
                  <Lock size={15} /> Uygulamayı Kapat
                </button>
              </div>
            )}


          </>
        )}
      </main>

      {/* Confirm modal -> calls Activate API */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          data-testid="riba-start-modal"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold text-white">RİBA uygulamasını başlatmak istiyor musunuz?</h3>
              <button
                onClick={closeModal}
                disabled={activating}
                data-testid="riba-start-modal-close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Uygulama başlatıldığında seçilen sınıflar ve ilgili RİBA formları uygulamaya bağlanacak, katılımcı
              bağlantıları oluşturulacaktır.
            </p>

            {activateError && (
              <div
                data-testid="riba-start-error"
                className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{activateError}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={activating}
                data-testid="riba-start-cancel"
                className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-40"
              >
                Vazgeç
              </button>
              <button
                onClick={activate}
                disabled={activating}
                data-testid="riba-start-confirm"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : null}
                {activating ? "Başlatılıyor…" : "Başlat"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Close pre-check modal (read-only; NO real close in this task) */}
      {closeOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          data-testid="riba-close-modal"
          onClick={() => setCloseOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold text-white">RİBA Uygulamasını Kapat</h3>
              <button
                onClick={() => setCloseOpen(false)}
                data-testid="riba-close-modal-close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Uygulama kapatıldığında yeni yanıt kabul edilmeyecektir. Kapatmadan önce mevcut katılım durumunu kontrol ediniz.
            </p>

            {closeLoading && (
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-400" data-testid="riba-close-loading">
                <Loader2 size={16} className="animate-spin text-emerald-300" /> Katılım durumu kontrol ediliyor…
              </div>
            )}

            {!closeLoading && closeError && (
              <div
                data-testid="riba-close-error"
                className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{closeError}</span>
              </div>
            )}

            {!closeLoading && !closeError && closePreview && (
              <>
                {/* Below-target advisory (amber, non-blocking) */}
                {closePreview.has_below_target ? (
                  <div
                    data-testid="riba-close-below-target"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3.5 text-sm text-amber-200 ring-1 ring-amber-400/25"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>
                      Bazı katılımcı gruplarında %30 katılım hedefine henüz ulaşılmadı. Bu durum uygulamayı kapatmanıza
                      engel değildir. İsterseniz yanıt toplamaya devam edebilir veya mevcut katılımla uygulamayı
                      kapatabilirsiniz.
                    </span>
                  </div>
                ) : (
                  <div
                    data-testid="riba-close-all-met"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3.5 text-sm text-emerald-200 ring-1 ring-emerald-400/25"
                  >
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>Tüm katılımcı gruplarında %30 katılım hedefine ulaşılmıştır.</span>
                  </div>
                )}

                {/* Participation summary (authoritative from endpoint) */}
                <div className="mt-5 space-y-2.5" data-testid="riba-close-summary">
                  {(closePreview.participation?.classes || []).map((cls) => (
                    <React.Fragment key={cls.school_class_id}>
                      {cls.parent && (
                        <CloseMetricRow title={`${cls.class_name} – Veli`} metric={cls.parent} testid={`riba-close-${cls.school_class_id}-parent`} />
                      )}
                      {cls.student && (
                        <CloseMetricRow title={`${cls.class_name} – Öğrenci`} metric={cls.student} testid={`riba-close-${cls.school_class_id}-student`} />
                      )}
                    </React.Fragment>
                  ))}
                  {closePreview.participation?.teacher && (
                    <CloseMetricRow title="Öğretmen – Okul Geneli" metric={closePreview.participation.teacher} testid="riba-close-teacher" />
                  )}
                </div>

                {/* Submit error */}
                {closeSubmitError && (
                  <div
                    data-testid="riba-close-submit-error"
                    className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{closeSubmitError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    onClick={() => setCloseOpen(false)}
                    disabled={closing}
                    data-testid="riba-close-continue"
                    className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-40"
                  >
                    Yanıt Toplamaya Devam Et
                  </button>
                  <button
                    onClick={submitClose}
                    disabled={closing || !closePreview?.can_close}
                    data-testid="riba-close-confirm"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {closing ? <Loader2 size={14} className="animate-spin" /> : null}
                    {closing ? "Uygulama kapatılıyor…" : "Mevcut Katılımla Kapat"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Finalize confirmation modal */}
      {finalizeConfirmOpen && (() => {
        const opts = results?.school_results || [];
        const find = (id) => opts.find((t) => t.target_id === id);
        const t1 = find(st1);
        const t2 = find(st2);
        const label = (t) => (t ? `${t.meb_code} — ${t.target_name}` : "—");
        return (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            data-testid="riba-finalize-modal"
            onClick={() => { if (!finalizing) setFinalizeConfirmOpen(false); }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-extrabold text-white">RİBA Uygulamasını Sonuçlandır</h3>
                <button
                  onClick={() => setFinalizeConfirmOpen(false)}
                  disabled={finalizing}
                  data-testid="riba-finalize-modal-close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 space-y-1.5 rounded-xl bg-white/[0.03] p-3 text-sm text-slate-200 ring-1 ring-white/10">
                <p data-testid="riba-finalize-preview-1"><span className="text-slate-400">Özel Hedef 1:</span> {label(t1)}</p>
                <p data-testid="riba-finalize-preview-2"><span className="text-slate-400">Özel Hedef 2:</span> {label(t2)}</p>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Bu işlem RİBA uygulamasını sonuçlandıracaktır. Seçtiğiniz iki özel hedef sonuçlandırma sonrasında değiştirilemeyecektir. Devam etmek istiyor musunuz?
              </p>
              {finalizeError && (
                <div data-testid="riba-finalize-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{finalizeError}</span>
                </div>
              )}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setFinalizeConfirmOpen(false)}
                  disabled={finalizing}
                  data-testid="riba-finalize-cancel"
                  className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-40"
                >
                  Vazgeç
                </button>
                <button
                  onClick={submitFinalize}
                  disabled={finalizing}
                  data-testid="riba-finalize-confirm"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {finalizing ? <Loader2 size={14} className="animate-spin" /> : null}
                  {finalizing ? "Sonuçlandırılıyor…" : "Sonuçlandır"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
