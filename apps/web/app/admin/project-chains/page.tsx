"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type Row = { id: string; name: string; status: string; category: string; chain: string | null; createdAt: string };

async function api<T>(path: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_admin_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminProjectChainsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ projects: Row[] }>("/admin/project-chains");
      setRows(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load project chain audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter !== "ALL" && row.status !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || row.name.toLowerCase().includes(q) || (row.chain ?? "").toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
  }), [rows, filter, search]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-violet-300">← Admin</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT AUDIT</span>
            <h1 className="mt-2 text-5xl font-medium tracking-tight">Project chain audit.</h1>
            <p className="mt-3 text-sm text-zinc-600">Verify every listing has a valid chain association before publication.</p>
          </div>
          <button onClick={() => void load()} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/5">Refresh</button>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["TOTAL", rows.length],
            ["WITH CHAIN", rows.filter((row) => Boolean(row.chain)).length],
            ["MISSING CHAIN", rows.filter((row) => !row.chain).length],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"><small className="text-[9px] font-black tracking-[.15em] text-zinc-600">{label}</small><b className="mt-2 block text-2xl">{value}</b></div>)}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {["ALL", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-4 py-2 text-[10px] font-black ${filter === item ? "bg-white text-black" : "border border-white/10 text-zinc-500"}`}>{item}</button>)}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project or chain…" className="ml-auto min-w-[220px] rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-xs text-white outline-none" />
        </div>

        {loading ? <div className="py-20 text-center text-sm text-zinc-600">Loading chain audit…</div> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">No projects match this filter.</div> : <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0c11]"><div className="grid grid-cols-[1.6fr_.8fr_.8fr_1fr] border-b border-white/10 px-5 py-3 text-[9px] font-black tracking-[.14em] text-zinc-600"><span>PROJECT</span><span>TYPE</span><span>STATUS</span><span>CHAIN</span></div>{filtered.map((row) => <div key={row.id} className="grid grid-cols-[1.6fr_.8fr_.8fr_1fr] items-center border-b border-white/5 px-5 py-4 last:border-0"><div><b className="text-sm">{row.name}</b><p className="mt-1 text-[10px] text-zinc-600">Created {new Date(row.createdAt).toLocaleDateString()}</p></div><span className="text-[10px] font-black text-violet-300">{row.category}</span><span className="text-[10px] text-zinc-500">{row.status}</span><span className={`text-xs font-bold ${row.chain ? "text-emerald-300" : "text-red-300"}`}>{row.chain ?? "Missing chain"}</span></div>)}</div>}
      </div>
    </AdminLayout>
  );
}
