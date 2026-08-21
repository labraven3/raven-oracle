"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = { id: string; title: string; status: string; prizeName: string; winnerCount: number; project?: { name?: string | null } | null; _count?: { entries: number; winners: number; tasks: number } };
type Audit = { raffleId: string; status: string; healthy: boolean; issues: string[]; warnings: string[]; counts: { tasks: number; requiredTasks: number; entries: number; eligible: number; ineligible: number; pending: number; winners: number; winnerSlots: number }; checkedAt: string };

async function api<T>(path: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  const headers = new Headers(); if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminIntegrityPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selected, setSelected] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ raffles: Raffle[] }>("/admin/raffles?status=COMPLETED").then((data) => {
      const list = data.raffles ?? [];
      setRaffles(list);
      setSelected(list[0]?.id ?? "");
    }).catch((e) => setError(e instanceof Error ? e.message : "Unable to load raffles")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) { setAudit(null); return; }
    setBusy(true); setError("");
    void api<{ audit: Audit }>(`/admin/raffle-integrity/${selected}`).then((data) => setAudit(data.audit)).catch((e) => setError(e instanceof Error ? e.message : "Unable to run integrity audit")).finally(() => setBusy(false));
  }, [selected]);

  const current = useMemo(() => raffles.find((r) => r.id === selected), [raffles, selected]);

  return <AdminLayout>
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">SYSTEM HARDENING</span><h1 className="mt-2 text-5xl font-medium tracking-tight">Raffle integrity.</h1><p className="mt-3 text-sm text-zinc-600">Read-only consistency checks before draw and after completion.</p></div>
        <Link href="/admin/raffles" className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold">← Raffle Management</Link>
      </div>

      {error && <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
        <label className="block text-[9px] font-black tracking-[.15em] text-zinc-600">SELECT RAFFLE</label>
        {loading ? <p className="mt-3 text-sm text-zinc-600">Loading…</p> : <select value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"><option value="">Choose a completed raffle</option>{raffles.map((r) => <option key={r.id} value={r.id}>{r.title} — {r.project?.name ?? "No project"}</option>)}</select>}
      </div>

      {current && <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"><small className="text-[9px] tracking-[.15em] text-zinc-600">STATUS</small><b className="mt-2 block text-lg">{current.status}</b></div><div className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"><small className="text-[9px] tracking-[.15em] text-zinc-600">ENTRIES</small><b className="mt-2 block text-lg">{current._count?.entries ?? 0}</b></div><div className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"><small className="text-[9px] tracking-[.15em] text-zinc-600">WINNERS</small><b className="mt-2 block text-lg">{current._count?.winners ?? 0} / {current.winnerCount}</b></div></div>}

      {busy ? <div className="py-20 text-center text-sm text-zinc-600">Running integrity audit…</div> : audit && <section className="mt-6 space-y-5">
        <div className={`rounded-2xl border p-6 ${audit.healthy ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black tracking-[.16em] text-zinc-500">OVERALL HEALTH</span><h2 className="mt-2 text-2xl font-semibold">{audit.healthy ? "Healthy" : "Issues detected"}</h2></div><span className={`rounded-full px-3 py-1 text-[9px] font-black ${audit.healthy ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{audit.issues.length} issues · {audit.warnings.length} warnings</span></div><p className="mt-4 text-[10px] text-zinc-600">Checked {new Date(audit.checkedAt).toLocaleString()}</p></div>

        <div className="grid gap-3 sm:grid-cols-4"><Metric label="TASKS" value={audit.counts.tasks} /><Metric label="REQUIRED" value={audit.counts.requiredTasks} /><Metric label="ELIGIBLE" value={audit.counts.eligible} /><Metric label="PENDING" value={audit.counts.pending} /><Metric label="INELIGIBLE" value={audit.counts.ineligible} /><Metric label="WINNERS" value={audit.counts.winners} /><Metric label="SLOTS" value={audit.counts.winnerSlots} /></div>

        <div className="grid gap-5 lg:grid-cols-2"><IssueList title="Issues" items={audit.issues} tone="red" empty="No blocking issues detected." /><IssueList title="Warnings" items={audit.warnings} tone="amber" empty="No warnings detected." /></div>
      </section>}
    </div>
  </AdminLayout>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"><small className="text-[8px] font-black tracking-[.15em] text-zinc-600">{label}</small><b className="mt-2 block text-xl">{value}</b></div>; }
function IssueList({ title, items, tone, empty }: { title: string; items: string[]; tone: "red" | "amber"; empty: string }) { const classes = tone === "red" ? "border-red-900/40 bg-red-950/10 text-red-300" : "border-amber-900/40 bg-amber-950/10 text-amber-300"; return <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-4 text-sm text-zinc-600">{empty}</p> : <div className="mt-4 space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${classes}`}>{item}</div>)}</div>}</div>; }
