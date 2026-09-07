import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, ClipboardList, CheckCircle2, ListChecks, ChevronDown, ChevronUp, Inbox, FilterX, Pencil, Trash2, X, BarChart3, Users, GraduationCap, UserCog, UsersRound, FileDown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { generateRamReportPdf } from "../lib/ramReportPdf";

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

const StatTable = ({ testid, heading, firstCol, nameKey, rows }) => (
  <section>
    <h2 className="mb-3 text-base font-bold text-white">{heading}</h2>
    {rows.length === 0 ? (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">Kayıt yok.</div>
    ) : (
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table data-testid={testid} className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">{firstCol}</th>
              <th className="px-3 py-3 text-right font-semibold">Çalışma</th>
              <th className="px-3 py-3 text-right font-semibold">Öğrenci</th>
              <th className="px-3 py-3 text-right font-semibold">Öğretmen</th>
              <th className="px-3 py-3 text-right font-semibold">Veli</th>
              <th className="px-4 py-3 text-right font-semibold">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5 font-medium text-white">{r[nameKey] || "—"}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{r.activities_count}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{r.student_count}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{r.teacher_count}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{r.parent_count}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{r.total_participants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

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

  // Düzenleme modal state
  const [editing, setEditing] = useState(null); // aktif kaydın id'si
  const [editForm, setEditForm] = useState(EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Silme onayı state
  const [deleteTarget, setDeleteTarget] = useState(null); // {id, activity_date, title}
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [listSuccess, setListSuccess] = useState(null);

  // İstatistik state
  const [statFilters, setStatFilters] = useState({ date_from: "", date_to: "" });
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Rapor / PDF state
  const [reportFilters, setReportFilters] = useState({ date_from: "", date_to: "", report_type: "summary" });
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [reportInfo, setReportInfo] = useState(null);

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

  const editTotal = toInt(editForm.student_count) + toInt(editForm.teacher_count) + toInt(editForm.parent_count);

  const openEdit = (a) => {
    setEditError(null);
    setEditing(a.id);
    setEditForm({
      activity_date: a.activity_date || "",
      district_id: a.district_id != null ? String(a.district_id) : "",
      institution_name: a.institution_name || "",
      activity_type: a.activity_type || "",
      title: a.title || "",
      target_type: a.target_type || "",
      student_count: a.student_count != null ? String(a.student_count) : "",
      teacher_count: a.teacher_count != null ? String(a.teacher_count) : "",
      parent_count: a.parent_count != null ? String(a.parent_count) : "",
      note: a.note || "",
    });
  };

  const closeEdit = () => { setEditing(null); setEditError(null); };
  const setEdit = (k, v) => setEditForm((f) => ({ ...f, [k]: v }));

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditError(null);
    setEditSaving(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      await axios.put(`${API}/ram/activities/${editing}`, {
        activity_date: editForm.activity_date,
        district_id: editForm.district_id,
        institution_name: editForm.institution_name.trim(),
        activity_type: editForm.activity_type.trim(),
        title: editForm.title.trim(),
        target_type: editForm.target_type,
        student_count: toInt(editForm.student_count),
        teacher_count: toInt(editForm.teacher_count),
        parent_count: toInt(editForm.parent_count),
        note: editForm.note.trim(),
      }, { headers: h });
      setEditing(null);
      setListSuccess("Çalışma kaydı güncellendi.");
      await loadActivities(); // mevcut filtreler korunarak yeniden çekilir
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setEditError(err.response?.data?.detail || "Çalışma kaydı güncellenemedi.");
    }
    setEditSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    try {
      await axios.delete(`${API}/ram/activities/${deleteTarget.id}`, { headers: h });
      setDeleteTarget(null);
      setListSuccess("Çalışma kaydı silindi.");
      await loadActivities(); // mevcut filtreler korunarak yeniden çekilir
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setDeleteError(err.response?.data?.detail || "Çalışma kaydı silinemedi.");
    }
    setDeleting(false);
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

  const loadStats = useCallback(async () => {
    setStatsError(null);
    setStatsLoading(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    if (statFilters.date_from && statFilters.date_to && statFilters.date_from > statFilters.date_to) {
      setStatsError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      setStatsLoading(false);
      return;
    }
    const params = {};
    if (statFilters.date_from) params.date_from = statFilters.date_from;
    if (statFilters.date_to) params.date_to = statFilters.date_to;
    try {
      const res = await axios.get(`${API}/ram/activities/statistics`, { headers: h, params });
      setStats(res.data);
      setStatsLoaded(true);
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setStatsError(err.response?.data?.detail || "İstatistikler yüklenemedi.");
    }
    setStatsLoading(false);
  }, [statFilters, navigate]);

  const openStats = () => {
    setTab("stats");
    if (!statsLoaded) loadStats();
  };

  const resetStatFilters = () => setStatFilters({ date_from: "", date_to: "" });

  const generateReport = async () => {
    if (reportBusy) return;
    setReportError(null);
    setReportInfo(null);
    if (reportFilters.date_from && reportFilters.date_to && reportFilters.date_from > reportFilters.date_to) {
      setReportError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }
    setReportBusy(true);
    const h = await authHeader();
    if (!h) { navigate("/ram/login", { replace: true }); return; }
    const params = { detailed: reportFilters.report_type === "detailed" };
    if (reportFilters.date_from) params.date_from = reportFilters.date_from;
    if (reportFilters.date_to) params.date_to = reportFilters.date_to;
    try {
      const res = await axios.get(`${API}/ram/activities/report`, { headers: h, params });
      const report = res.data;
      if (!report.statistics?.summary?.activities_count) {
        setReportError("Seçilen tarih aralığında raporlanacak çalışma kaydı bulunamadı.");
        setReportBusy(false);
        return;
      }
      await generateRamReportPdf(report);
      setReportInfo("PDF raporu oluşturuldu ve indirildi.");
    } catch (err) {
      if (err.response?.status === 401) { await supabase.auth.signOut(); navigate("/ram/login", { replace: true }); return; }
      if (err.response?.status === 403) { navigate("/ram/change-password", { replace: true }); return; }
      setReportError(err.response?.data?.detail || "PDF raporu oluşturulamadı.");
    }
    setReportBusy(false);
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
          <button type="button" onClick={openStats} data-testid="ramact-tab-stats" className={tabCls(tab === "stats")}>İstatistikler</button>
          <button type="button" onClick={() => setTab("reports")} data-testid="ramact-tab-reports" className={tabCls(tab === "reports")}>Raporlar / PDF</button>
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

            {listSuccess && (
              <div data-testid="ramact-list-success" className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300 ring-1 ring-emerald-400/20">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{listSuccess}</span>
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

                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-white/5 pt-3">
                      <button type="button" onClick={() => openEdit(a)} data-testid={`ramact-edit-${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
                        <Pencil size={13} /> Düzenle
                      </button>
                      <button type="button" onClick={() => { setDeleteError(null); setDeleteTarget({ id: a.id, activity_date: a.activity_date, title: a.title }); }} data-testid={`ramact-delete-${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/20 transition hover:bg-rose-500/20">
                        <Trash2 size={13} /> Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div data-testid="ramact-stats">
            {/* Tarih filtresi */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Başlangıç Tarihi</label>
                  <input type="date" value={statFilters.date_from} onChange={(e) => setStatFilters((f) => ({ ...f, date_from: e.target.value }))} data-testid="ramact-stats-from" className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Bitiş Tarihi</label>
                  <input type="date" value={statFilters.date_to} onChange={(e) => setStatFilters((f) => ({ ...f, date_to: e.target.value }))} data-testid="ramact-stats-to" className={fieldCls} />
                </div>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button type="button" onClick={loadStats} data-testid="ramact-stats-apply" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
                    <ListChecks size={15} /> Uygula
                  </button>
                  {(statFilters.date_from || statFilters.date_to) && (
                    <button type="button" onClick={() => { resetStatFilters(); }} data-testid="ramact-stats-reset" className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                      <FilterX size={15} /> Temizle
                    </button>
                  )}
                </div>
              </div>
            </div>

            {statsError && (
              <div data-testid="ramact-stats-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{statsError}</span>
              </div>
            )}

            {statsLoading ? (
              <div className="grid place-items-center py-16" data-testid="ramact-stats-loading">
                <Loader2 size={26} className="animate-spin text-emerald-300" />
              </div>
            ) : stats && !statsError && stats.summary?.activities_count === 0 ? (
              <div data-testid="ramact-stats-empty" className="grid place-items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
                <BarChart3 size={28} className="text-slate-500" />
                <p className="text-sm font-semibold text-slate-300">
                  {(statFilters.date_from || statFilters.date_to)
                    ? "Seçilen tarih aralığında çalışma kaydı bulunamadı."
                    : "Henüz çalışma kaydı bulunmuyor."}
                </p>
              </div>
            ) : stats && !statsError ? (
              <div className="space-y-6">
                {/* 1. Genel Özet Kartları */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { key: "activities_count", label: "Toplam Çalışma", Icon: ClipboardList, tint: "text-emerald-300" },
                    { key: "student_count", label: "Öğrenci", Icon: GraduationCap, tint: "text-sky-300" },
                    { key: "teacher_count", label: "Öğretmen", Icon: UserCog, tint: "text-indigo-300" },
                    { key: "parent_count", label: "Veli", Icon: UsersRound, tint: "text-amber-300" },
                    { key: "total_participants", label: "Toplam Katılımcı", Icon: Users, tint: "text-fuchsia-300" },
                  ].map((c) => (
                    <div key={c.key} data-testid={`ramact-stat-card-${c.key}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <c.Icon size={18} className={c.tint} />
                      <p className="mt-2 text-2xl font-extrabold text-white">{stats.summary[c.key]}</p>
                      <p className="text-xs text-slate-400">{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* 2. Hedef Türlerine Göre Dağılım */}
                <section>
                  <h2 className="mb-3 text-base font-bold text-white">Hedef Türlerine Göre Dağılım</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stats.target_types.map((t) => {
                      const max = Math.max(1, ...stats.target_types.map((x) => x.activities_count));
                      const pct = Math.round((t.activities_count / max) * 100);
                      return (
                        <div key={t.target_type} data-testid={`ramact-stat-target-${t.target_type}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{TARGET_LABELS[t.target_type] || t.target_type}</span>
                            <span className="text-sm font-bold text-emerald-300">{t.activities_count} çalışma</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>Öğrenci: <b className="text-slate-200">{t.student_count}</b></span>
                            <span>Öğretmen: <b className="text-slate-200">{t.teacher_count}</b></span>
                            <span>Veli: <b className="text-slate-200">{t.parent_count}</b></span>
                            <span>Toplam: <b className="text-slate-200">{t.total_participants}</b></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* 3. Aylara Göre Çalışmalar */}
                {stats.monthly.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-bold text-white">Aylara Göre Çalışmalar</h2>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="space-y-3">
                        {stats.monthly.map((m) => {
                          const max = Math.max(1, ...stats.monthly.map((x) => x.activities_count));
                          const pct = Math.round((m.activities_count / max) * 100);
                          return (
                            <div key={m.month_key} data-testid={`ramact-stat-month-${m.month_key}`}>
                              <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-200">{m.label}</span>
                                <span className="text-slate-400">{m.activities_count} çalışma · {m.total_participants} katılımcı</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                                <span>Öğrenci {m.student_count}</span>
                                <span>Öğretmen {m.teacher_count}</span>
                                <span>Veli {m.parent_count}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}

                {/* 4-7. Tablolar */}
                <StatTable testid="ramact-stat-titles" heading="Konu / Çalışma Başlığı Analizi" firstCol="Konu / Çalışma Başlığı" nameKey="title" rows={stats.titles} />
                <StatTable testid="ramact-stat-types" heading="Çalışma Türü Analizi" firstCol="Çalışma Türü" nameKey="activity_type" rows={stats.activity_types} />
                <StatTable testid="ramact-stat-districts" heading="İlçelere Göre Analiz" firstCol="İlçe" nameKey="district_name" rows={stats.districts} />
                <StatTable testid="ramact-stat-institutions" heading="Okul/Kurum Bazlı Analiz" firstCol="Okul/Kurum" nameKey="institution_name" rows={stats.institutions} />
              </div>
            ) : null}
          </div>
        )}

        {tab === "reports" && (
          <div data-testid="ramact-reports" className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white">
                  <FileDown size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Raporlar / PDF</h2>
                  <p className="text-xs text-slate-400">Çalışmalarınızın istatistiksel dökümünü PDF olarak indirin.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Başlangıç Tarihi</label>
                  <input type="date" value={reportFilters.date_from} onChange={(e) => setReportFilters((f) => ({ ...f, date_from: e.target.value }))} data-testid="ramact-report-from" className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Bitiş Tarihi</label>
                  <input type="date" value={reportFilters.date_to} onChange={(e) => setReportFilters((f) => ({ ...f, date_to: e.target.value }))} data-testid="ramact-report-to" className={fieldCls} />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Tarih girmezseniz tüm çalışma kayıtlarınız rapora dahil edilir.</p>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-300">Rapor Türü</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: "summary", title: "Özet Rapor", desc: "Yalnız istatistiksel özet ve analizler." },
                    { value: "detailed", title: "Ayrıntılı Rapor", desc: "Özet + tüm çalışma kayıtlarının dökümü." },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setReportFilters((f) => ({ ...f, report_type: o.value }))}
                      data-testid={`ramact-report-type-${o.value}`}
                      className={`rounded-xl border p-3 text-left transition ${reportFilters.report_type === o.value ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}
                    >
                      <p className={`text-sm font-bold ${reportFilters.report_type === o.value ? "text-emerald-300" : "text-white"}`}>{o.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{o.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {reportError && (
                <div data-testid="ramact-report-error" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{reportError}</span>
                </div>
              )}
              {reportInfo && (
                <div data-testid="ramact-report-info" className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300 ring-1 ring-emerald-400/20">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{reportInfo}</span>
                </div>
              )}

              <button
                type="button"
                onClick={generateReport}
                disabled={reportBusy}
                data-testid="ramact-report-generate"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {reportBusy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                {reportBusy ? "PDF Oluşturuluyor…" : "PDF Oluştur / İndir"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Düzenleme Modalı */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" data-testid="ramact-edit-modal">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-white">Çalışmayı Düzenle</h2>
              <button type="button" onClick={closeEdit} data-testid="ramact-edit-close" className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-slate-300 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div data-testid="ramact-edit-error" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{editError}</span>
              </div>
            )}

            <form onSubmit={submitEdit} data-testid="ramact-edit-form" className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışma Tarihi</label>
                <input type="date" required value={editForm.activity_date} onChange={(e) => setEdit("activity_date", e.target.value)} data-testid="ramact-edit-date" className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">İlçe</label>
                <select required value={editForm.district_id} onChange={(e) => setEdit("district_id", e.target.value)} data-testid="ramact-edit-district" className={fieldCls}>
                  <option value="">İlçe seçin</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışmanın Yapıldığı Okul/Kurum</label>
                <input type="text" required value={editForm.institution_name} onChange={(e) => setEdit("institution_name", e.target.value)} data-testid="ramact-edit-institution" className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Çalışma Türü</label>
                <input type="text" required value={editForm.activity_type} onChange={(e) => setEdit("activity_type", e.target.value)} data-testid="ramact-edit-type" className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Konu / Çalışma Başlığı</label>
                <input type="text" required value={editForm.title} onChange={(e) => setEdit("title", e.target.value)} data-testid="ramact-edit-title-input" className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Hedef Türü</label>
                <select required value={editForm.target_type} onChange={(e) => setEdit("target_type", e.target.value)} data-testid="ramact-edit-target" className={fieldCls}>
                  <option value="">Hedef türü seçin</option>
                  {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Öğrenci Sayısı</label>
                  <input type="number" min="0" value={editForm.student_count} onChange={(e) => setEdit("student_count", e.target.value)} data-testid="ramact-edit-students" className={fieldCls} placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Öğretmen Sayısı</label>
                  <input type="number" min="0" value={editForm.teacher_count} onChange={(e) => setEdit("teacher_count", e.target.value)} data-testid="ramact-edit-teachers" className={fieldCls} placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Veli Sayısı</label>
                  <input type="number" min="0" value={editForm.parent_count} onChange={(e) => setEdit("parent_count", e.target.value)} data-testid="ramact-edit-parents" className={fieldCls} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Toplam Katılımcı</label>
                <input type="text" readOnly value={editTotal} data-testid="ramact-edit-total" className={`${fieldCls} cursor-not-allowed bg-white/[0.02] text-slate-300`} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Kısa Açıklama / Not</label>
                <textarea rows={3} value={editForm.note} onChange={(e) => setEdit("note", e.target.value)} data-testid="ramact-edit-note" className={`${fieldCls} resize-y`} placeholder="Opsiyonel" />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" onClick={closeEdit} data-testid="ramact-edit-cancel" className="rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                  Vazgeç
                </button>
                <button type="submit" disabled={editSaving} data-testid="ramact-edit-submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
                  {editSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" data-testid="ramact-delete-modal">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
                <Trash2 size={20} />
              </div>
              <h2 className="text-lg font-extrabold text-white">Kaydı Sil</h2>
            </div>
            <p className="text-sm text-slate-300">
              Bu çalışma kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
              <p className="font-semibold text-white">{deleteTarget.title}</p>
              <p className="text-xs text-slate-400">{deleteTarget.activity_date}</p>
            </div>

            {deleteError && (
              <div data-testid="ramact-delete-error" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} data-testid="ramact-delete-cancel" className="rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                Vazgeç
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting} data-testid="ramact-delete-confirm" className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-50">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : null}
                Kaydı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
