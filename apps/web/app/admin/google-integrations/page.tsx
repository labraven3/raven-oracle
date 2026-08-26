"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type Connection = { email: string | null; name: string | null; connectedAt: string; updatedAt: string };
type Data = { totalConnected: number; connections: Connection[] };

async function api<T>(path: string) {
  const headers = new Headers();
  const token = localStorage.getItem("raven_admin_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function GoogleIntegrationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<Data>("/admin/google-integrations").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Unable to load Google integrations")); }, []);

  return <AdminLayout><div className="mx-auto max-w-6xl">
    <div className="mb-8"><span className="text-[9px] font-black tracking-[.2em] text-emerald-300/70">GOOGLE DRIVE</span><h1 className="mt-2 text-5xl font-medium tracking-tight">Creator connections.</h1><p className="mt-3 text-sm text-zinc-600">Read-only operational visibility into creator Google Drive connections. Tokens are never exposed here.</p></div>
    {error && <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="text-[9px] font-black tracking-[.16em] text-zinc-600">CONNECTED CREATORS</div><div className="mt-3 text-4xl font-black">{data?.totalConnected ?? "—"}</div><div className="mt-2 text-xs text-zinc-500">Google OAuth connections</div></div>
      <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="text-[9px] font-black tracking-[.16em] text-zinc-600">SCOPE</div><div className="mt-3 text-lg font-bold text-emerald-300">Drive + Sheets</div><div className="mt-2 text-xs text-zinc-500">Used only for creator winner exports</div></div>
      <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="text-[9px] font-black tracking-[.16em] text-zinc-600">STORAGE</div><div className="mt-3 text-lg font-bold">Encrypted</div><div className="mt-2 text-xs text-zinc-500">Refresh tokens are encrypted at rest</div></div>
    </div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Recent connections</h2><p className="mt-1 text-xs text-zinc-600">Latest 50 creator connections.</p></div><button onClick={() => void api<Data>("/admin/google-integrations").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Unable to refresh"))} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">Refresh</button></div>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/5">{!data?.connections.length ? <div className="p-10 text-center text-sm text-zinc-600">No Google Drive connections yet.</div> : data.connections.map((row, index) => <div key={`${row.email}-${index}`} className="grid gap-2 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[1.3fr_1fr_1fr]"><div><div className="text-sm font-bold text-zinc-200">{row.email ?? "No email returned"}</div><div className="mt-1 text-xs text-zinc-600">{row.name ?? "Google creator"}</div></div><div className="text-xs text-zinc-500">Connected {new Date(row.connectedAt).toLocaleString()}</div><div className="text-xs text-zinc-500">Updated {new Date(row.updatedAt).toLocaleString()}</div></div>)}</div>
    </section>
  </div></AdminLayout>;
}
