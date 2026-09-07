import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardList, CheckCircle2, ListChecks, ChevronDown, ChevronUp, Inbox, FilterX } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

const TARGET_OPTIONS = [
  { value: "genel_hedef", label: "Genel Hedef" },
  { value: "yerel_hedef", label: "Yerel Hedef" },
  { value: "ozel_hedef", label: "Özel Hedef" },
  { value: "hedef_disi", label: "Hedef Dışı" },
];

const TARGET_LABELS = TARGET_OPTIONS.reduce((a, o) => { a[o.value] = o.label; return a; }, {});

const EMPTY = {
  activity_date: "",
  district_id: "",
  institution_name: "",
  activity_type: "",
  title: "",
  target_type: "",
  student_count: "",
  teacher_count: "",
  parent_count: "",
  note: "",
};

const EMPTY_FILTERS = { district_id: "", target_type: "", date_from: "", date_to: "" };

const fieldCls = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60 placeholder:text-slate-500";

export default function RamActivities() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [tab, setTab] = useState("add");

  // Çalışma Ekle state
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Çalışma Kayıtları state
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activities, setActivities] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [listLoaded, setListLoaded] = useState(false);

  const hasFilters = useMemo(
    () => filters.district_id || filters.target_type || filters.date_from || filters.date_to,
    [filters]
  );

  const bootstrap = useCallback(async () => {
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      const res = await axios.get(`${API}/ram/districts`, { headers: h });
      setDistricts(res.data.districts || []);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setError("İlçe listesi yüklenemedi.");
    }
    setReady(true);
  }, [navigate]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const toInt = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) || n < 0 ? 0 : n; };
  const totalParticipants = toInt(form.student_count) + toInt(form.teacher_count) + toInt(form.parent_count);

  const loadActivities = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      setListError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      setListLoading(false);
      return;
    }
    const params = {};
    if (filters.district_id) params.district_id = filters.district_id;
    if (filters.target_type) params.target_type = filters.target_type;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    try {
      const res = await axios.get(`${API}/ram/activities`, { headers: h, params });
      setActivities(res.data.activities || []);
      setListLoaded(true);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setListError(err.response?.data?.detail || "Çalışma kayıtları yüklenemedi.");
    }
    setListLoading(false);
  }, [filters, navigate]);

  const openRecords = () => {
    setTab("records");
    if (!listLoaded) loadActivities();
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      await axios.post(`${API}/ram/activities`, {
        activity_date: form.activity_date,
        district_id: form.district_id,
        institution_name: form.institution_name.trim(),
        activity_type: form.activity_type.trim(),
        title: form.title.trim(),
        target_type: form.target_type,
        student_count: toInt(form.student_count),
        teacher_count: toInt(form.teacher_count),
        parent_count: toInt(form.parent_count),
        note: form.note.trim(),
      }, { headers: h });
      setForm(EMPTY);
      setSuccess(true);
      setListLoaded(false); // yeni kayıt eklendi, liste tazelensin
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setError(err.response?.data?.detail || "Çalışma kaydedilemedi.");
    }
    setSaving(false);
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1120]" data-testid="ramact-loading">
        <Loader2 size={28} className="animate-spin text-emerald-300" />
      </div>
    );
  }

  const tabCls = (active) =>
    `rounded-full px-4 py-1.5 font-semibold ring-1 transition ${active ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-white/[0.04] text-slate-300 ring-white/10 hover:bg-white/[0.08]"}`;

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
              <h1 className="text-lg font-extrabold text-white" data-testid="ramact-title">RAM Çalışmaları</h1>
            </div>
          </div>
          <button onClick={() => navigate("/ram/modules")} data-testid="ramact-back-btn" className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Modüller
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Sekmeler */}
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => setTab("add")} data-testid="ramact-tab-add" className={tabCls(tab === "add")}>Çalışma Ekle</button>
          <button type="button" onClick={openRecords} data-testid="ramact-tab-records" className={tabCls(tab === "records")}>Çalışma Kayıtları</button>
          <span className="rounded-full bg-white/[0.04] px-4 py-1.5 font-semibold text-slate-500 ring-1 ring-white/10">İstatistikler · Yakında</span>
          <span className="rounded-full bg-white/[0.04] px-4 py-1.5 font-semibold text-slate-500 ring-1 ring-white/10">Yıl Sonu Raporu · Yakında</span>
        </div>

        {tab === "add" && (
          <div className="mx-auto max-w-3xl">
            {success && (
              <div data-testid="ramact-success" className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300 ring-1 ring-emerald-400/20">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>Çalışma kaydı başarıyla eklendi.</span>
              </div>
            )}
            {error && (
              <div data-testid="ramact-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} data-testid="ramact-form" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışma Tarihi</label>
                <input type="date" required value={form.activity_date} onChange={(e) => set("activity_date", e.target.value)} data-testid="ramact-date" className={fieldCls} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">İlçe</label>
                <select required value={form.district_id} onChange={(e) => set("district_id", e.target.value)} data-testid="ramact-district" className={fieldCls}>
                  <option value="">İlçe seçin</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışmanın Yapıldığı Okul/Kurum</label>
                <input type="text" required value={form.institution_name} onChange={(e) => set("institution_name", e.target.value)} data-testid="ramact-institution" className={fieldCls} placeholder="Örn. Atatürk Ortaokulu" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışma Türü</label>
                <input type="text" required value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)} data-testid="ramact-type" className={fieldCls} placeholder="Örn. Seminer, Bireysel Görüşme" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Konu / Çalışma Başlığı</label>
                <input type="text" required value={form.title} onChange={(e) => set("title", e.target.value)} data-testid="ramact-title-input" className={fieldCls} placeholder="Örn. Sınav Kaygısıyla Başa Çıkma" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Hedef Türü</label>
                <select required value={form.target_type} onChange={(e) => set("target_type", e.target.value)} data-testid="ramact-target" className={fieldCls}>
                  <option value="">Hedef türü seçin</option>
                  {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Öğrenci Sayısı</label>
                  <input type="number" min="0" value={form.student_count} onChange={(e) => set("student_count", e.target.value)} data-testid="ramact-students" className={fieldCls} placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Öğretmen Sayısı</label>
                  <input type="number" min="0" value={form.teacher_count} onChange={(e) => set("teacher_count", e.target.value)} data-testid="ramact-teachers" className={fieldCls} placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Veli Sayısı</label>
                  <input type="number" min="0" value={form.parent_count} onChange={(e) => set("parent_count", e.target.value)} data-testid="ramact-parents" className={fieldCls} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Toplam Katılımcı</label>
                <input type="text" readOnly value={totalParticipants} data-testid="ramact-total" className={`${fieldCls} cursor-not-allowed bg-white/[0.02] text-slate-300`} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Kısa Açıklama / Not</label>
                <textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} data-testid="ramact-note" className={`${fieldCls} resize-y`} placeholder="Opsiyonel" />
              </div>

              <button
                type="submit"
                disabled={saving}
                data-testid="ramact-submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Çalışmayı Kaydet
              </button>
            </form>
          </div>
        )}

        {tab === "records" && (
          <div data-testid="ramact-records">
            {/* Filtreler */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">İlçe</label>
                  <select value={filters.district_id} onChange={(e) => setFilter("district_id", e.target.value)} data-testid="ramact-filter-district" className={fieldCls}>
                    <option value="">Tümü</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Hedef Türü</label>
                  <select value={filters.target_type} onChange={(e) => setFilter("target_type", e.target.value)} data-testid="ramact-filter-target" className={fieldCls}>
                    <option value="">Tümü</option>
                    {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Başlangıç Tarihi</label>
                  <input type="date" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} data-testid="ramact-filter-from" className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Bitiş Tarihi</label>
                  <input type="date" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} data-testid="ramact-filter-to" className={fieldCls} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={loadActivities} data-testid="ramact-filter-apply" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                  <ListChecks size={15} /> Filtrele
                </button>
                {hasFilters && (
                  <button type="button" onClick={resetFilters} data-testid="ramact-filter-reset" className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                    <FilterX size={15} /> Temizle
                  </button>
                )}
              </div>
            </div>

            {listError && (
              <div data-testid="ramact-list-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{listError}</span>
              </div>
            )}

            {/* Özet satırı */}
            {!listLoading && !listError && (
              <p data-testid="ramact-list-summary" className="mb-3 text-sm text-slate-400">
                {hasFilters
                  ? `Filtreye uyan ${activities.length} çalışma kaydı gösteriliyor.`
                  : `${activities.length} çalışma kaydı gösteriliyor.`}
              </p>
            )}

            {listLoading ? (
              <div className="grid place-items-center py-16" data-testid="ramact-list-loading">
                <Loader2 size={26} className="animate-spin text-emerald-300" />
              </div>
            ) : activities.length === 0 && !listError ? (
              <div data-testid="ramact-list-empty" className="grid place-items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
                <Inbox size={28} className="text-slate-500" />
                <p className="text-sm font-semibold text-slate-300">
                  {hasFilters ? "Seçilen filtrelere uygun çalışma kaydı bulunamadı." : "Henüz çalışma kaydı bulunmuyor."}
                </p>
                {hasFilters && (
                  <button type="button" onClick={resetFilters} className="mt-1 text-xs font-semibold text-emerald-300 hover:underline">Filtreleri temizle</button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} data-testid={`ramact-row-${a.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-300">{a.activity_date}</span>
                          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">{TARGET_LABELS[a.target_type] || a.target_type}</span>
                          <span className="text-xs text-slate-400">{a.district_name || "—"}</span>
                        </div>
                        <h3 className="mt-1.5 truncate text-sm font-bold text-white">{a.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span className="text-slate-300">{a.activity_type}</span> · {a.institution_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-white">{a.total_participants}</p>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Toplam Katılımcı</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 border-t border-white/5 pt-3 text-xs text-slate-400">
                      <span>Öğrenci: <span className="font-semibold text-slate-200">{a.student_count}</span></span>
                      <span>Öğretmen: <span className="font-semibold text-slate-200">{a.teacher_count}</span></span>
                      <span>Veli: <span className="font-semibold text-slate-200">{a.parent_count}</span></span>
                      {a.note && (
                        <button type="button" onClick={() => setExpanded(expanded === a.id ? null : a.id)} data-testid={`ramact-note-toggle-${a.id}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-300 hover:underline">
                          Not {expanded === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>

                    {a.note && expanded === a.id && (
                      <p data-testid={`ramact-note-${a.id}`} className="mt-3 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-xs text-slate-300 ring-1 ring-white/5">
                        {a.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
