import React, { useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheck, KeyRound, HardDrive, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function Pill({ ok }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
          : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      {ok ? "Bağlı" : "Erişilemiyor"}
    </span>
  );
}

function Card({ icon: Icon, title, ok, children, testid }) {
  return (
    <div data-testid={testid} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <Icon size={20} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        {ok !== undefined && <Pill ok={ok} />}
      </div>
      <div className="text-sm text-slate-400">{children}</div>
    </div>
  );
}

export default function ConnectionStatus() {
  const [backend, setBackend] = useState(null);
  const [frontendAuth, setFrontendAuth] = useState({ ok: false, msg: "Kontrol ediliyor…" });
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/supabase/status`);
      setBackend(data);
    } catch (e) {
      setBackend({ connected: false, error: e.message });
    }
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setFrontendAuth({ ok: true, msg: "supabase-js istemcisi hazır" });
    } catch (e) {
      setFrontendAuth({ ok: false, msg: e.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Supabase Bağlantı Durumu</h1>
        <button
          data-testid="recheck-btn"
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Yeniden dene
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon={ShieldCheck} title="Backend Bağlantısı" ok={!!backend?.connected} testid="card-backend">
          <p className="break-all">Proje: <span className="text-slate-300">{backend?.project_url || "—"}</span></p>
          {backend?.error && <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">{backend.error}</p>}
        </Card>
        <Card icon={KeyRound} title="Frontend İstemci" ok={frontendAuth.ok} testid="card-frontend">
          <p>{frontendAuth.msg}</p>
        </Card>
        <Card icon={KeyRound} title="Auth" ok={!!backend?.auth} testid="card-auth">
          <p>Supabase Auth admin API {backend?.auth ? "erişilebilir" : "erişilemiyor"}.</p>
        </Card>
        <Card icon={HardDrive} title="Storage" ok={!!backend?.storage} testid="card-storage">
          <p>{backend?.storage ? `${backend?.buckets?.length || 0} bucket bulundu.` : "Storage erişilemiyor."}</p>
        </Card>
      </div>
    </div>
  );
}
