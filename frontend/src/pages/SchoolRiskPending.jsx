import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, ClipboardCheck, MousePointerClick } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";
import { RiskPendingList } from "../components/RiskPendingList";
import { RiskPendingDetail } from "../components/RiskPendingDetail";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TABS = [["pending", "Onay Bekleyenler"], ["approved", "Onaylananlar"], ["rejected", "Reddedilenler"]];

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolRiskPending() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleErr = useCallback(async (err, msg) => {
    const s = err.response?.status;
    if (s === 403 && err.response?.data?.detail === "password_change_required") { navigate("/school/change-password", { replace: true }); return null; }
    if (s === 401) { await supabase.auth.signOut(); navigate("/school/login", { replace: true }); return null; }
    return err.response?.data?.detail || msg;
  }, [navigate]);

  const call = useCallback(async (method, url, body) => {
    const h = await authHeader();
    if (!h) { navigate("/school/login", { replace: true }); throw new Error("auth"); }
    return (await axios({ method, url: `${API}${url}`, data: body, headers: h })).data;
  }, [navigate]);

  const loadList = useCallback(async (st) => {
    try { setList(await call("get", `/school/risk-pending?status=${st}`)); } catch (err) {
      const m = await handleErr(err, "Formlar yüklenemedi."); if (m) setNotice({ ok: false, text: m }); setList({ items: [] });
    }
  }, [call, handleErr]);

  useEffect(() => { setList(null); setSelected(null); setDetail(null); loadList(status); }, [status, loadList]);

  const open = async (id) => {
    setSelected(id); setDetail(null);
    try { setDetail(await call("get", `/school/risk-pending/${id}`)); } catch (err) {
      const m = await handleErr(err, "Form açılamadı."); if (m) setNotice({ ok: false, text: m });
    }
  };
  const decide = async (path, body, okText) => {
    try {
      const res = await call("post", `/school/risk-pending/${selected}/${path}`, body);
      setNotice({ ok: true, text: typeof okText === "function" ? okText(res) : okText });
      setSelected(null); setDetail(null); await loadList(status);
    } catch (err) {
      const m = await handleErr(err, "İşlem tamamlanamadı."); if (m) setNotice({ ok: false, text: m });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(16,185,129,0.08),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-400 text-white"><ClipboardCheck size={20} /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/80">Risk Haritası</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="risk-pending-title">Öğrenci Formları Onayı</h1>
            </div>
          </div>
          <button onClick={() => navigate("/school")} data-testid="risk-pending-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
            <ArrowLeft size={15} /> Risk Haritası
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap gap-2" data-testid="risk-pending-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => { setNotice(null); setStatus(k); }} data-testid={`risk-pending-tab-${k}`}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ring-1 transition-colors ${status === k ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/40" : "bg-white/[0.04] text-slate-300 ring-white/10 hover:bg-white/[0.08]"}`}>{l}</button>
          ))}
        </div>
        {notice && (
          <div data-testid="risk-pending-notice" className={`mt-5 flex items-center gap-2 rounded-xl p-3 text-sm ring-1 ${notice.ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : "bg-rose-500/10 text-rose-300 ring-rose-400/20"}`}>
            {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {notice.text}
          </div>
        )}
        {list === null ? (
          <div className="grid place-items-center py-16" data-testid="risk-pending-loading"><Loader2 size={26} className="animate-spin text-emerald-300" /></div>
        ) : (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <RiskPendingList items={list.items} selectedId={selected} onSelect={open} status={status} />
            {list.items.length > 0 && (
              selected && !detail ? <div className="grid place-items-center py-16"><Loader2 size={24} className="animate-spin text-emerald-300" /></div>
              : detail ? <RiskPendingDetail data={detail}
                  onApprove={(sid) => decide("approve", { student_id: sid }, (r) => r.created_student ? "Form onaylandı; öğrenci Havuz'a eklendi ve Risk Haritası'na aktarıldı." : "Form onaylandı ve Risk Haritası'na aktarıldı.")}
                  onReject={(reason) => decide("reject", { reason }, "Form reddedildi.")} />
              : <div data-testid="risk-pending-placeholder" className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-sm text-slate-400"><MousePointerClick size={16} /> İncelemek için listeden bir form seçiniz.</div>
            )}
          </div>
        )}
      </main>
      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
