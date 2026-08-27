"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Project = { id: string; name: string; description?: string | null; logoUrl?: string | null; category?: string | null };
type Raffle = { id: string; title: string; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount: number; project?: { id: string; name?: string | null; logoUrl?: string | null } | null; _count?: { entries: number; winners: number; tasks: number } };

async function getHome() {
  const response = await fetch(`${API_BASE_URL}/home`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load live data");
  return data as { projects?: Project[]; raffles?: Raffle[] };
}

function Logo({ src, name }: { src?: string | null; name: string }) {
  return <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[.04]">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</span>}</div>;
}

function timeLeft(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
}

function RaffleCard({ raffle }: { raffle: Raffle }) {
  const name = raffle.project?.name || raffle.title;
  return <Link href={`/raffles/${raffle.id}`} className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-violet-400/40">
    <div className="flex items-start gap-3"><Logo src={raffle.project?.logoUrl} name={name} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate font-semibold text-white">{name}</h3><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">{raffle.status === "ACTIVE" ? "Live" : "Upcoming"}</span></div><p className="mt-1 truncate text-xs text-zinc-500">{raffle.prizeQuantity} × {raffle.prizeName}</p></div></div>
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4 text-xs"><div><span className="text-zinc-600">Entries</span><div className="mt-1 font-semibold text-zinc-200">{(raffle._count?.entries || 0).toLocaleString()}</div></div><div><span className="text-zinc-600">Ends</span><div className="mt-1 font-semibold text-zinc-200">{timeLeft(raffle.endsAt)}</div></div></div>
    <div className="mt-5 text-sm font-semibold text-violet-300 group-hover:text-white">View raffle →</div>
  </Link>;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { let mounted = true; getHome().then((data) => { if (!mounted) return; setProjects(Array.isArray(data.projects) ? data.projects : []); setRaffles(Array.isArray(data.raffles) ? data.raffles : []); }).catch(() => mounted && setError(true)).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, []);

  const active = useMemo(() => raffles.filter((r) => r.status === "ACTIVE"), [raffles]);
  const upcoming = useMemo(() => raffles.filter((r) => r.status === "SCHEDULED"), [raffles]);

  return <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
    <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 lg:px-10 lg:pt-32">
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-violet-700/15 blur-[130px]" /><div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="relative grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> NFT raffle platform</div>
          <h1 className="max-w-2xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">Run NFT raffles people can <span className="text-violet-300">verify.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Raven Oracle helps creators host transparent NFT giveaways with clear entry rules, secure prize handling, and verifiable winner selection.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/projects/new" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200">Create a raffle</Link><Link href="/raffles" className="rounded-xl border border-white/10 bg-white/[.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[.08]">Explore raffles</Link></div>
          <p className="mt-5 text-xs text-zinc-600">Only request wallet signatures when a transaction is actually required.</p>
        </div>
        <div className="relative rounded-3xl border border-white/10 bg-[#0b0a10] p-3 shadow-2xl shadow-violet-950/20"><div className="rounded-2xl border border-white/[.07] bg-[#08080c] p-5 sm:p-7"><div className="flex items-center justify-between border-b border-white/[.06] pb-5"><div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-600">Raven Oracle</div><div className="mt-1 text-lg font-bold">Raffle overview</div></div><span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-semibold text-violet-300">Demo preview</span></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="text-xs text-zinc-600">Status</div><div className="mt-2 font-semibold">Active</div></div><div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="text-xs text-zinc-600">Entries</div><div className="mt-2 font-semibold">Live data</div></div><div className="hidden rounded-xl border border-white/[.06] bg-white/[.02] p-4 sm:block"><div className="text-xs text-zinc-600">Result</div><div className="mt-2 font-semibold">Verifiable</div></div></div><div className="mt-4 rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="flex items-center justify-between"><span className="text-xs text-zinc-500">Entry rules</span><span className="text-xs text-emerald-300">Configured</span></div><div className="mt-3 h-2 rounded-full bg-white/[.06]"><div className="h-2 w-2/3 rounded-full bg-violet-400/70" /></div></div></div></div>
      </div>
    </section>

    <section className="border-y border-white/[.06] bg-white/[.015]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-4 lg:px-10"><div><div className="text-sm font-bold text-white">01 · Create</div><p className="mt-2 text-sm leading-6 text-zinc-500">Set the prize, network, duration and entry rules.</p></div><div><div className="text-sm font-bold text-white">02 · Publish</div><p className="mt-2 text-sm leading-6 text-zinc-500">Share a public raffle page with clear requirements.</p></div><div><div className="text-sm font-bold text-white">03 · Enter</div><p className="mt-2 text-sm leading-6 text-zinc-500">Participants review the rules before submitting an entry.</p></div><div><div className="text-sm font-bold text-white">04 · Draw</div><p className="mt-2 text-sm leading-6 text-zinc-500">Complete the draw and publish the resulting winner record.</p></div></div></section>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Live marketplace</p><h2 className="mt-2 text-3xl font-black">Active raffles</h2><p className="mt-2 text-sm text-zinc-500">Real raffles from the platform. No fabricated activity.</p></div><Link href="/raffles" className="hidden text-sm font-semibold text-zinc-300 hover:text-white sm:block">View all →</Link></div>
      {error ? <div className="mt-8 rounded-2xl border border-red-400/10 bg-red-400/[.04] p-6 text-sm text-zinc-400">Live raffle data is temporarily unavailable. Please try again shortly.</div> : loading ? <div className="mt-8 grid gap-4 md:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]" />)}</div> : active.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{active.slice(0,6).map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center"><div className="font-semibold text-white">No active raffles yet</div><p className="mt-2 text-sm text-zinc-500">New raffles will appear here once they are published.</p><Link href="/raffles" className="mt-5 inline-block text-sm font-semibold text-violet-300">Browse upcoming raffles →</Link></div>}
    </section>

    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10"><div className="grid gap-5 lg:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[.02] p-6 lg:col-span-2"><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Transparency</p><h2 className="mt-2 text-2xl font-black">Know what happens before you enter.</h2><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold">Clear entry rules</h3><p className="mt-1 text-sm leading-6 text-zinc-500">Every raffle should explain its requirements, limits and timing before you submit an entry.</p></div><div><h3 className="font-semibold">Visible results</h3><p className="mt-1 text-sm leading-6 text-zinc-500">Winner records and transaction details are shown when the underlying functionality is available.</p></div><div><h3 className="font-semibold">No fake claims</h3><p className="mt-1 text-sm leading-6 text-zinc-500">Audits, on-chain randomness and security guarantees are only claimed when implemented.</p></div><div><h3 className="font-semibold">Safety first</h3><p className="mt-1 text-sm leading-6 text-zinc-500">Never share a seed phrase or private key. Review every wallet transaction before signing.</p></div></div></div><div className="rounded-2xl border border-white/10 bg-white/[.02] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-zinc-500">For creators</p><h2 className="mt-2 text-2xl font-black">Build a giveaway people trust.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Create public raffle pages, define requirements, manage entries and review results from one dashboard.</p><Link href="/projects/new" className="mt-6 inline-block text-sm font-semibold text-violet-300">Create your first raffle →</Link></div></div></section>

    <section className="border-t border-white/[.06] bg-[#07070a]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10"><div className="grid gap-8 md:grid-cols-3"><div><div className="text-sm font-bold">Explore</div><div className="mt-4 space-y-2 text-sm text-zinc-500"><Link className="block hover:text-white" href="/raffles">Raffles</Link><Link className="block hover:text-white" href="/projects">Projects</Link><Link className="block hover:text-white" href="/how-it-works">How it works</Link></div></div><div><div className="text-sm font-bold">Product</div><div className="mt-4 space-y-2 text-sm text-zinc-500"><Link className="block hover:text-white" href="/dashboard">Dashboard</Link><Link className="block hover:text-white" href="/projects/new">Create a raffle</Link><Link className="block hover:text-white" href="/account">Account</Link></div></div><div><div className="text-sm font-bold">Safety</div><p className="mt-4 text-sm leading-6 text-zinc-600">Raven Oracle will never ask for a seed phrase or private key. Always verify the network, contract and transaction before signing.</p></div></div><div className="mt-10 border-t border-white/[.06] pt-6 text-xs text-zinc-600">Raven Oracle · NFT raffle infrastructure · Functionality marked as coming soon is not yet available.</div></div></section>
  </main>;
}
