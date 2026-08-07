import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Activity, FileSpreadsheet, MapPinned } from "lucide-react";
import ConnectionStatus from "./pages/ConnectionStatus";
import SchoolImportPreview from "./pages/SchoolImportPreview";
import "./App.css";

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
          isActive
            ? "bg-white/10 text-white ring-1 ring-white/15"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-[#0b1120] bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(99,102,241,0.15),transparent),radial-gradient(50rem_30rem_at_-10%_20%,rgba(16,185,129,0.10),transparent)]">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1120]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
                <MapPinned size={18} />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">PDRPUSULA</p>
                <p className="text-sm font-bold text-white">School Risk Maps · RAM</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              <NavItem to="/" icon={FileSpreadsheet} label="Okul İçe Aktarma" />
              <NavItem to="/status" icon={Activity} label="Bağlantı" />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">
          <Routes>
            <Route path="/" element={<SchoolImportPreview />} />
            <Route path="/status" element={<ConnectionStatus />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
