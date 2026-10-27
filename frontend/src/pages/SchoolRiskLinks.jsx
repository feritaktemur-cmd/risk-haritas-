import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, QrCode, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";
import { RiskLinkRow } from "../components/RiskLinkRow";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolRiskLinks() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleErr = useCallback(async (err, msg) => {
    const s = err.response?.status;
    if (s === 403 && err.response?.data?.detail === "password_change_required") return navigate("/school/change-password", { replace: true });
    if (s === 401) {
      await supabase.auth.signOut();
      return navigate("/school/login", { replace: true });
    }
    return err.response?.data?.detail || msg;
  }, [navigate]);

  const load = useCallback(async () => {
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/risk-links`, { headers: h });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(await handleErr(err, "Sınıf bağlantıları yüklenemedi. Lütfen tekrar deneyiniz."));
      setData((d) => d || { classes: [] });
    }
  }, [navigate, handleErr]);

  useEffect(() => { load(); }, [load]);

  const act = async (url, body, okMsg) => {
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      await axios.post(url, body, { headers: h });
      setNotice({ ok: true, text: okMsg });
    } catch (err) {
      const m = await handleErr(err, "İşlem tamamlanamadı. Lütfen tekrar deneyiniz.");
      if (m) setNotice({ ok: false, text: m });
    }
    await load();
  };
  const onCreate = (classId) => act(`${API}/school/risk-links`, { school_class_id: classId }, "Sınıf bağlantısı hazırlandı.");
  const onDeactivate = (linkId) => act(`${API}/school/risk-links/${linkId}/deactivate`, {}, "Bağlantı kapatıldı.");

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(245,158,11,0.10),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-400 text-white"><QrCode size={20} /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300/80">Risk Haritası</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="risk-links-title">Sınıf Bağlantıları</h1>
            </div>
          </div>
          <button onClick={() => navigate("/school")} data-testid="risk-links-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Risk Haritası
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-4 text-sm text-slate-300 ring-1 ring-white/10" data-testid="risk-links-info">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p>
            {data?.academic_year ? <b className="text-white">{data.academic_year}</b> : "Aktif eğitim yılı"} için her sınıfa ayrı bir bağlantı oluşturabilirsiniz.
            Öğrencilerin gönderdiği formlar doğrudan Risk Haritası'na işlenmez; rehber öğretmen onayından sonra aktarılır. Mevcut Risk Girişi aynen kullanılmaya devam eder.
          </p>
        </div>
        {error && (
          <div data-testid="risk-links-error" className="mt-6 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {notice && (
          <div data-testid="risk-links-notice" className={`mt-6 flex items-center gap-2 rounded-xl p-3 text-sm ring-1 ${notice.ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : "bg-rose-500/10 text-rose-300 ring-rose-400/20"}`}>
            {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {notice.text}
          </div>
        )}
        {data === null ? (
          <div className="grid place-items-center py-16" data-testid="risk-links-loading"><Loader2 size={26} className="animate-spin text-amber-300" /></div>
        ) : data.classes.length === 0 ? (
          !error && <p data-testid="risk-links-empty" className="mt-8 text-sm text-slate-400">Henüz sınıf tanımlanmamış. Önce Öğrenci Yönetimi bölümünden sınıflarınızı ekleyiniz.</p>
        ) : (
          <ul className="mt-6 space-y-3" data-testid="risk-links-list">
            {data.classes.map((c) => <RiskLinkRow key={c.id} cls={c} onCreate={onCreate} onDeactivate={onDeactivate} />)}
          </ul>
        )}
      </main>
      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
