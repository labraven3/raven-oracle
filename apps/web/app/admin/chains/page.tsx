"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type Chain = { id: string; name: string; slug: string; isActive: boolean; sortOrder: number };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminChainsPage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ chains: Chain[] }>("/admin/chains");
      setChains(data.chains);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load chains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy("add"); setError(""); setMessage("");
    try {
      await api("/admin/chains", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setName(""); setMessage("Chain added."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add chain"); }
    finally { setBusy(null); }
  };

  const toggle = async (chain: Chain) => {
    setBusy(chain.id); setError(""); setMessage("");
    try {
      await api(`/admin/chains/${chain.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !chain.isActive }) });
      setMessage(`${chain.name} ${chain.isActive ? "disabled" : "enabled"}.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update chain"); }
    finally { setBusy(null); }
  };

  const remove = async (chain: Chain) => {
    if (!window.confirm(`Remove ${chain.name} from chain management?`)) return;
    setBusy(chain.id); setError(""); setMessage("");
    try {
      await api(`/admin/chains/${chain.id}`, { method: "DELETE" });
      setMessage(`${chain.name} removed.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove chain"); }
    finally { setBusy(null); }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">CONFIGURATION</span>
          <h1 className="mt-2 text-5xl font-medium tracking-tight">Chains.</h1>
          <p className="mt-3 text-sm text-zinc-600">Manage the chains that appear in project creation and discovery filters.</p>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}

        <section className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder="Add chain name, e.g. Monad" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <button disabled={busy === "add" || !name.trim()} onClick={() => void add()} className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === "add" ? "Adding…" : "Add chain"}</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0c11]">
          {loading ? <div className="p-12 text-center text-sm text-zinc-600">Loading chains…</div> : chains.length === 0 ? <div className="p-12 text-center text-sm text-zinc-600">No chains configured.</div> : <div className="divide-y divide-white/5">{chains.map((chain) => <div key={chain.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-bold text-zinc-100">{chain.name}</h2><span className={`rounded-full px-2 py-1 text-[9px] font-black ${chain.isActive ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-500/10 text-zinc-500"}`}>{chain.isActive ? "ACTIVE" : "DISABLED"}</span></div><p className="mt-1 text-xs text-zinc-600">{chain.slug}</p></div><div className="flex gap-2"><button disabled={busy === chain.id} onClick={() => void toggle(chain)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold text-zinc-300">{chain.isActive ? "Disable" : "Enable"}</button><button disabled={busy === chain.id} onClick={() => void remove(chain)} className="rounded-lg border border-red-900/40 px-4 py-2 text-[10px] font-bold text-red-300">Remove</button></div></div>)}</div>}
        </section>
      </div>
    </AdminLayout>
  );
}
