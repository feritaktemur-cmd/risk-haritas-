import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, BarChart3, Users, CheckCircle2, Circle, Percent, Info, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
      <Icon size={14} className={tone} /> {label}
    </div>
    <p className="mt-1.5 text-2xl font-extrabold text-white">{value}</p>
  </div>
);

const fmtPct = (n) => String(n).replace(".", ",");

const DomainBar = ({ name, count, percentage }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid="schoolstats-domain-row">
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-sm text-slate-200">{name}</span>
      <span className="shrink-0 text-xs font-semibold text-slate-300">%{fmtPct(percentage)} · {count} öğrenci</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: `${Math.min(100, percentage)}%` }} />
    </div>
  </div>
);

export default function SchoolStatistics() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const [howCatOpen, setHowCatOpen] = useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [classData, setClassData] = useState(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState(null);
  const [howClassOpen, setHowClassOpen] = useState(false);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return null; }
    try {
      const res = await axios.get(`${API}/school/risk-map/school`, { headers: h });
      setData(res.data);
      try {
        const initRes = await axios.get(`${API}/school/risk/init`, { headers: h });
        setClasses(initRes.data.classes || []);
      } catch (_) { /* class list is secondary; ignore its failure */ }
      return res.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403 && detail === "password_change_required") {
        navigate("/school/change-password", { replace: true });
      } else if (err.response?.status === 409) {
        setError(detail || "Aktif eğitim yılı belirlenemedi.");
      } else {
        await supabase.auth.signOut();
        navigate("/school/login", { replace: true });
      }
      return null;
    }
  }, [navigate]);

  const loadClass = useCallback(async (cid) => {
    setClassData(null);
    setClassError(null);
    if (!cid) return;
    setClassLoading(true);
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); return; }
    try {
      const res = await axios.get(`${API}/school/risk-map/class`, { headers: h, params: { school_class_id: cid } });
      setClassData(res.data);
    } catch (err) {
      setClassError(err.response?.data?.detail || "Sınıf analizi yüklenemedi.");
    }
    setClassLoading(false);
  }, [navigate]);

  const onClassChange = (cid) => {
    setClassId(cid);
    loadClass(cid);
  };

  useEffect(() => {
    (async () => { await load(); setReady(true); })();
  }, [load]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="schoolstats-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div onClick={() => navigate("/school/modules")} role="button" tabIndex={0} data-testid="brand-home-link" className="flex cursor-pointer items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="schoolstats-title">İstatistikler</h1>
            </div>
          </div>
          <button onClick={() => navigate("/school")} data-testid="schoolstats-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Okul Paneli
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error ? (
          <div data-testid="schoolstats-error" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        ) : data ? (
          <>
            <p className="text-sm text-slate-400">Aktif Eğitim Öğretim Yılı</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white" data-testid="schoolstats-year">
              {data.academic_year} Eğitim Öğretim Yılı
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Toplam Öğrenci" value={data.summary.total_students} tone="text-slate-300" testid="schoolstats-total" />
              <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={data.summary.completed} tone="text-emerald-400" testid="schoolstats-completed" />
              <StatCard icon={Circle} label="Formu Tamamlanmayan" value={data.summary.not_entered} tone="text-slate-500" testid="schoolstats-not-entered" />
              <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${data.summary.completion_rate}`} tone="text-indigo-400" testid="schoolstats-rate" />
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400" data-testid="schoolstats-context-note">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                Bu sayfadaki istatistikler mevcut öğrenci kayıtlarına göre canlı olarak hesaplanmaktadır. Risk oranlarının hesaplanmasında yalnızca formu tamamlanan öğrenciler esas alınır.
              </span>
            </div>

            {/* 8 Ana Risk Alanının Dağılımı */}
            <section className="mt-10" data-testid="schoolstats-domains-section">
              <h3 className="text-base font-bold text-white">8 Ana Risk Alanının Dağılımı</h3>

              <div className="mt-4 space-y-2.5" data-testid="schoolstats-domains">
                {[...(data.domains || [])]
                  .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                  .map((d) => (
                    <DomainBar key={d.risk_domain_id} name={d.name} count={d.student_count} percentage={d.percentage} />
                  ))}
              </div>

              {/* Bu grafik neyi gösterir? (varsayılan açık) */}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-domains-explain">
                <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                <div className="space-y-2 text-sm leading-relaxed text-slate-400">
                  <p>
                    Bu grafik, Risk Haritası formu tamamlanmış öğrenciler arasında, her bir ana risk alanında en az bir risk göstergesi bulunan öğrencilerin oranını ve öğrenci sayısını gösterir.
                  </p>
                  <p>
                    Risk alanları, okulda hangi alanlardaki risk göstergelerinin öğrenciler arasında daha yaygın olduğunu görebilmek amacıyla en yüksek orandan en düşük orana doğru sıralanır.
                  </p>
                  <p>
                    Grafikteki oranlar öğrencilerin tanılanması veya risk düzeylerinin derecelendirilmesi anlamına gelmez. Sonuçlar, okulun mevcut verileri üzerinden genel durumu görmeye ve rehberlik çalışmalarının planlanmasına yardımcı olan göstergelerdir.
                  </p>
                </div>
              </div>

              {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setHowOpen((v) => !v)}
                  data-testid="schoolstats-how-toggle"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                >
                  <span>Nasıl hesaplanıyor?</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howOpen ? "rotate-180" : ""}`} />
                </button>
                {howOpen && (
                  <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-how-content">
                    <p>
                      Hesaplamada yalnızca Risk Haritası formu tamamlanmış öğrenciler dikkate alınır. Formu henüz tamamlanmamış öğrenciler risk oranlarının hesaplanmasına dahil edilmez.
                    </p>
                    <p>
                      Bir öğrencinin aynı ana risk alanına ait birden fazla risk maddesi işaretlenmiş olabilir. Böyle bir durumda öğrenci o risk alanında yalnızca bir kez sayılır. Örneğin aynı öğrencide bir risk alanına ait 3 farklı madde işaretlenmişse bu durum "3 öğrenci" olarak değil, "1 öğrenci" olarak hesaplanır.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                      İlgili risk alanında en az bir risk göstergesi bulunan öğrenci sayısı ÷ Formu tamamlanan öğrenci sayısı × 100
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Örnek:</span> Okulda 120 öğrenci bulunuyor ve 100 öğrencinin Risk Haritası formu tamamlanmış olsun. Bu 100 öğrencinin 25'inde belirli bir risk alanına ait en az bir risk göstergesi varsa grafikte: %25 · 25 öğrenci gösterilir. Okuldaki diğer 20 öğrencinin formu henüz tamamlanmadığı için bu öğrenciler oranın paydasına dahil edilmez.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Önemli not:</span> Aynı öğrenci birden fazla ana risk alanında risk göstergesine sahip olabilir. Bu nedenle grafikteki 8 risk alanının yüzdeleri birbirinden bağımsızdır ve toplamlarının %100 olması beklenmez.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 36 Risk Maddesinin Dağılımı */}
            <section className="mt-10" data-testid="schoolstats-categories-section">
              <h3 className="text-base font-bold text-white">36 Risk Maddesinin Dağılımı</h3>

              <div className="mt-4 space-y-2.5" data-testid="schoolstats-categories">
                {[...(data.categories || [])]
                  .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                  .map((c) => (
                    <DomainBar key={c.risk_category_id} name={c.label} count={c.student_count} percentage={c.percentage} />
                  ))}
              </div>

              {/* Bu grafik neyi gösterir? (varsayılan açık) */}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-categories-explain">
                <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                <div className="space-y-2 text-sm leading-relaxed text-slate-400">
                  <p>
                    Bu grafik, Risk Haritası formu tamamlanan öğrenciler arasında 36 risk maddesinin her birinin kaç öğrencide görüldüğünü ve bu öğrencilerin tamamlanan formlar içindeki oranını gösterir. Maddeler en yaygın görülen risk göstergesinden en az görülene doğru sıralanarak okulda öne çıkan somut risklerin kolayca fark edilmesini sağlar.
                  </p>
                </div>
              </div>

              {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setHowCatOpen((v) => !v)}
                  data-testid="schoolstats-cat-how-toggle"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                >
                  <span>Nasıl hesaplanıyor?</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howCatOpen ? "rotate-180" : ""}`} />
                </button>
                {howCatOpen && (
                  <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-cat-how-content">
                    <p>
                      Her risk maddesi ayrı olarak değerlendirilir. Bir öğrenci, işaretlenmiş olan farklı risk maddelerinin her birinde ayrı ayrı sayılabilir. Ancak aynı öğrenci aynı risk maddesi için yalnızca bir kez sayılır. Hesaplamaya yalnızca Risk Haritası formu tamamlanmış öğrenciler dahil edilir.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                      İlgili risk maddesinin bulunduğu öğrenci sayısı ÷ Formu tamamlanan öğrenci sayısı × 100
                    </p>
                    <p>
                      <span className="font-semibold text-slate-300">Önemli not:</span> 36 maddenin yüzdeleri birbirinden bağımsızdır. Aynı öğrencide birden fazla risk maddesi bulunabileceğinden yüzdelerin toplamının %100 olması beklenmez.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Sınıf Bazlı 36 Risk Maddesi */}
            <section className="mt-12 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-5" data-testid="schoolstats-class-section">
              <h3 className="text-base font-bold text-white">
                Sınıf Bazlı 36 Risk Maddesi
                {classData ? <span className="text-sm font-normal text-indigo-300"> — {classData.class_label} · Risk Maddelerinin Dağılımı</span> : null}
              </h3>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-400">Sınıf / Şube</label>
                <select
                  value={classId}
                  onChange={(e) => onClassChange(e.target.value)}
                  data-testid="schoolstats-class-select"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
                >
                  <option value="">Sınıf seçin</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.level}/{c.branch}</option>
                  ))}
                </select>
              </div>

              {classLoading ? (
                <div className="grid place-items-center py-12"><Loader2 size={24} className="animate-spin text-indigo-300" /></div>
              ) : classError ? (
                <div data-testid="schoolstats-class-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-400/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{classError}</span>
                </div>
              ) : !classData ? (
                <p className="mt-4 text-sm text-slate-400" data-testid="schoolstats-class-hint">
                  Sınıf bazlı risk maddesi dağılımını görüntülemek için yukarıdan bir sınıf/şube seçin.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={Users} label="Toplam Öğrenci" value={classData.summary.total_students} tone="text-slate-300" testid="schoolstats-class-total" />
                    <StatCard icon={CheckCircle2} label="Formu Tamamlanan" value={classData.summary.completed} tone="text-emerald-400" testid="schoolstats-class-completed" />
                    <StatCard icon={Circle} label="Formu Tamamlanmayan" value={classData.summary.not_entered} tone="text-slate-500" testid="schoolstats-class-not-entered" />
                    <StatCard icon={Percent} label="Tamamlanma Oranı" value={`%${classData.summary.completion_rate}`} tone="text-indigo-400" testid="schoolstats-class-rate" />
                  </div>

                  <div className="mt-5 space-y-2.5" data-testid="schoolstats-class-categories">
                    {[...(classData.categories || [])]
                      .sort((a, b) => (b.percentage - a.percentage) || (a.sort_order - b.sort_order))
                      .map((c) => (
                        <DomainBar key={c.risk_category_id} name={c.label} count={c.student_count} percentage={c.percentage} />
                      ))}
                  </div>

                  {/* Bu grafik neyi gösterir? (varsayılan açık) */}
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="schoolstats-class-explain">
                    <p className="mb-1.5 text-sm font-semibold text-slate-200">Bu grafik neyi gösterir?</p>
                    <p className="text-sm leading-relaxed text-slate-400">
                      Bu grafik, seçilen sınıfta Risk Haritası formu tamamlanan öğrenciler arasında 36 risk maddesinin görülme sıklığını gösterir. Maddeler en yaygın görülen risk göstergesinden en az görülene doğru sıralanır.
                    </p>
                  </div>

                  {/* Nasıl hesaplanıyor? (varsayılan kapalı) */}
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <button
                      onClick={() => setHowClassOpen((v) => !v)}
                      data-testid="schoolstats-class-how-toggle"
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03]"
                    >
                      <span>Nasıl hesaplanıyor?</span>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${howClassOpen ? "rotate-180" : ""}`} />
                    </button>
                    {howClassOpen && (
                      <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400" data-testid="schoolstats-class-how-content">
                        <p>
                          Hesaplamada yalnızca seçilen sınıfta Risk Haritası formu tamamlanmış öğrenciler dikkate alınır. Her risk maddesi ayrı olarak değerlendirilir. Bir öğrenci farklı risk maddelerinin her birinde ayrı ayrı sayılabilir; ancak aynı öğrenci aynı risk maddesi için yalnızca bir kez sayılır.
                        </p>
                        <p>
                          <span className="font-semibold text-slate-300">Hesaplama formülü:</span><br />
                          Seçilen sınıfta ilgili risk maddesinin bulunduğu öğrenci sayısı ÷ Seçilen sınıfta formu tamamlanan öğrenci sayısı × 100
                        </p>
                        <p>
                          <span className="font-semibold text-slate-300">Önemli not:</span> Aynı öğrencide birden fazla risk maddesi bulunabileceğinden 36 maddenin yüzdelerinin toplamının %100 olması beklenmez.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
