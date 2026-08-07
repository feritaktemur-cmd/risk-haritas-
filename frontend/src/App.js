import React, { useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheck, Database, KeyRound, HardDrive, RefreshCw, MapPinned } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function StatusPill({ ok, label }) {
  return (
    <span
      data-testid={`pill-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
          : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      {ok ? "Connected" : "Down"}
    </span>
  );
}

function Card({ icon: Icon, title, children, ok, testid }) {
  return (
    <div
      data-testid={testid}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <Icon size={20} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        {ok !== undefined && <StatusPill ok={ok} label={title} />}
      </div>
      <div className="text-sm text-slate-400">{children}</div>
    </div>
  );
}

export default function App() {
  const [backend, setBackend] = useState(null);
  const [frontendAuth, setFrontendAuth] = useState({ ok: false, msg: "Checking…" });
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    // Backend -> Supabase (service key)
    try {
      const { data } = await axios.get(`${API}/supabase/status`);
      setBackend(data);
    } catch (e) {
      setBackend({ connected: false, error: e.message });
    }
    // Frontend -> Supabase (publishable key): a getSession call proves the client + URL are reachable
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setFrontendAuth({ ok: true, msg: "supabase-js client initialized & reachable" });
    } catch (e) {
      setFrontendAuth({ ok: false, msg: e.message || "Client init failed" });
    }
    setLoading(false);
  };

  useEffect(() => {
    check();
  }, []);

  const backendOk = backend?.connected;

  return (
    <div className="min-h-screen w-full bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-12 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/20">
              <MapPinned size={22} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/80">
                RAM · Guidance & Research Centers
              </p>
              <h1 className="text-2xl font-extrabold text-white">School Risk Maps</h1>
            </div>
          </div>
          <p className="max-w-2xl text-slate-400">
            Project scaffold is ready. Below is the live status of the Supabase connection for
            <span className="text-slate-200"> Database</span>,
            <span className="text-slate-200"> Authentication</span> and
            <span className="text-slate-200"> Storage</span> across the backend and frontend.
          </p>
          <button
            data-testid="recheck-btn"
            onClick={check}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Re-check connection
          </button>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card icon={ShieldCheck} title="Backend Link" ok={!!backendOk} testid="card-backend">
            <p className="break-all">
              Project: <span className="text-slate-300">{backend?.project_url || "—"}</span>
            </p>
            {backend?.error && (
              <p data-testid="backend-error" className="mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">
                {backend.error}
              </p>
            )}
          </Card>

          <Card icon={KeyRound} title="Frontend Client" ok={frontendAuth.ok} testid="card-frontend">
            <p>{frontendAuth.msg}</p>
          </Card>

          <Card icon={KeyRound} title="Auth" ok={!!backend?.auth} testid="card-auth">
            <p>Supabase Auth admin API {backend?.auth ? "reachable" : "not reachable"}.</p>
          </Card>

          <Card icon={HardDrive} title="Storage" ok={!!backend?.storage} testid="card-storage">
            <p>
              {backend?.storage
                ? `${backend?.buckets?.length || 0} bucket(s) found.`
                : "Storage API not reachable."}
            </p>
          </Card>
        </div>

        <Card icon={Database} title="What's next">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your custom database schema & migrations will be applied separately (no tables created here).</li>
            <li>Backend-first: sensitive & aggregation logic runs server-side with the secret key.</li>
            <li>Once connected, we build RAM/school auth, class risk forms, and risk-map analytics.</li>
          </ul>
        </Card>

        <footer className="mt-12 text-center text-xs text-slate-600">
          Connection scaffold · no tables, migrations, or schema changes made.
        </footer>
      </div>
    </div>
  );
}
