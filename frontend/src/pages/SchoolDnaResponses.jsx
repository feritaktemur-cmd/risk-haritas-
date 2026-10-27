import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, CalendarX2, ArrowLeft, AlertTriangle, MousePointerClick } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CorporateFooter } from "../components/CorporateFooter";
import { DnaResponseList } from "../components/DnaResponseList";
import { DnaResponseDetail } from "../components/DnaResponseDetail";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function SchoolDnaResponses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState("idle");

  const handleErr = useCallback(async (err, msg) => {
    const s = err.response?.status;
    if (s === 403 && err.response?.data?.detail === "password_change_required") return navigate("/school/change-password", { replace: true });
    if (s === 401) {
      await supabase.auth.signOut();
      return navigate("/school/login", { replace: true });
    }
    setError(s === 404 ? (err.response?.data?.detail || msg) : msg);
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const h = await authHeader();
      if (!h) return navigate("/school/login", { replace: true });
      try {
        const res = await axios.get(`${API}/school/dna/applications/${id}/responses`, { headers: h });
        setList(res.data);
      } catch (err) {
        await handleErr(err, "Yanıtlar yüklenirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
        setList({ application: null, responses: [] });
      }
    })();
  }, [id, navigate, handleErr]);

  const select = async (rid) => {
    setSelected(rid);
    setDetailState("loading");
    setError(null);
    const h = await authHeader();
    if (!h) return navigate("/school/login", { replace: true });
    try {
      const res = await axios.get(`${API}/school/dna/applications/${id}/responses/${rid}`, { headers: h });
      setDetail(res.data);
      setDetailState("ready");
    } catch (err) {
      setDetailState("idle");
      await handleErr(err, "Yanıt ayrıntısı yüklenemedi. Lütfen tekrar deneyiniz.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(245,158,11,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(99,102,241,0.10),transparent)]">
      <header className="border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-400 text-white">
              <CalendarX2 size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300/80">PDRPUSULA</p>
              <h1 className="text-lg font-extrabold text-white" data-testid="dna-responses-title">DNA Yanıtları</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/school/dna")}
            data-testid="dna-responses-back"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ArrowLeft size={15} /> DNA Uygulamaları
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {list?.application && (
          <div>
            <p data-testid="dna-responses-app-name" className="text-base font-bold text-white">{list.application.name}</p>
            <p data-testid="dna-responses-count" className="mt-1 text-sm text-slate-400">{list.responses.length} yanıt</p>
          </div>
        )}
        {error && (
          <div data-testid="dna-responses-error" className="mt-6 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-rose-400/20">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {list === null ? (
          <div className="grid place-items-center py-16" data-testid="dna-responses-loading">
            <Loader2 size={26} className="animate-spin text-amber-300" />
          </div>
        ) : list.application && (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <DnaResponseList responses={list.responses} selectedId={selected} onSelect={select} />
            {list.responses.length > 0 && (
              <div>
                {detailState === "loading" && (
                  <div className="grid place-items-center py-16" data-testid="dna-detail-loading">
                    <Loader2 size={24} className="animate-spin text-amber-300" />
                  </div>
                )}
                {detailState === "ready" && detail && <DnaResponseDetail data={detail} />}
                {detailState === "idle" && (
                  <div data-testid="dna-detail-placeholder" className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-sm text-slate-400">
                    <MousePointerClick size={16} /> Yanıtlarını görmek için listeden bir öğrenci seçiniz.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <CorporateFooter className="border-t border-white/10" />
    </div>
  );
}
