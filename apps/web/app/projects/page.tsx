"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "ALL" | "NFT";
type Chain = { id: string; name: string; slug: string };
type Project = { id: string; name: string; description: string | null; websiteUrl: string | null; xUrl: string | null; discordUrl: string | null; logoUrl: string; bannerUrl: string | null; projectType: "NFT" | "TOKEN" | "AIRDROP" | "OTHER"; category: string; chain?: string | null };

const DEFAULT_CHAINS = ["Ethereum", "Solana", "Polygon", "Aptos", "Sui", "Bitcoin", "Base", "Arbitrum", "Binance", "Monad", "Blast", "Scroll", "zkSync", "Linea", "ApeChain", "Abstract", "Bera", "Robinhood"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chains, setChains] = useState<Chain[]>(DEFAULT_CHAINS.map(name => ({ id: name, name, slug: name.toLowerCase() })));
  const [type, setType] = useState<ProjectType>("ALL");
  const [chain, setChain] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/chains`, { cache: "force-cache" })
      .then(r => r.json())
      .then(d => { if (active && d.chains?.length) setChains(d.chains); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "24" });
    if (type === "NFT") params.set("projectType", "NFT");
    if (chain !== "ALL") params.set("chain", chain);
    if (debouncedSearch) params.set("search", debouncedSearch);
    setLoading(true); setError("");

    fetch(`${API_BASE_URL}/projects/discovery?${params}`, { cache: "default", signal: controller.signal })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Unable to load projects"); return d; })
      .then(d => { if (!controller.signal.aborted) setProjects(d.projects ?? []); })
      .catch(e => { if (e.name !== "AbortError") setError(e instanceof Error ? e.message : "Unable to load projects"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [type, chain, debouncedSearch]);

  return <main className="min-h-screen bg-[#06060a] text-zinc-100">
    <SiteHeader />
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0c11]">
        <header className="border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Dashboard /</div><h1 className="mt-1 text-2xl font-semibold">All projects</h1></div><div className="flex flex-wrap gap-2"><Link href="/projects/new" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black">Submit a project</Link><select value={chain} onChange={e => setChain(e.target.value)} className="rounded-xl border border-white/10 bg-[#121318] px-4 py-2.5 text-xs font-semibold"><option value="ALL">All chains</option>{chains.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div></div>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row"><label className="flex flex-1 items-center rounded-xl border border-white/10 bg-black/20 px-4"><span className="mr-3 text-zinc-600">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-600" /></label><div className="flex gap-2"><button onClick={() => setType("ALL")} className={`rounded-xl border px-4 py-2.5 text-[10px] font-black ${type === "ALL" ? "border-white bg-white text-black" : "border-white/10 text-zinc-400"}`}>All projects</button><button onClick={() => setType("NFT")} className={`rounded-xl border px-4 py-2.5 text-[10px] font-black ${type === "NFT" ? "border-white bg-white text-black" : "border-white/10 text-zinc-400"}`}>NFT</button></div></div>
        </header>
        <div className="flex items-center justify-between px-5 py-4 text-[10px] font-semibold text-zinc-600 sm:px-7"><span>{loading ? "Loading…" : `${projects.length} projects`}</span><span>Sort by: <b className="text-zinc-300">Newest ↓</b></span></div>
        {error && <div className="mx-5 mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300 sm:mx-7">{error}</div>}
        {loading ? <div className="p-16 text-center text-sm text-zinc-600">Loading projects…</div> : projects.length === 0 ? <div className="m-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">No projects found.</div> : <div className="grid gap-5 px-5 pb-7 sm:px-7 md:grid-cols-2">{projects.map(p => <Link key={p.id} href={`/projects/${p.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111218] transition hover:-translate-y-0.5 hover:border-violet-500/30"><div className="relative flex min-h-[210px] items-center justify-center overflow-hidden bg-[#17171e] p-2">{p.bannerUrl ? <img src={p.bannerUrl} alt="" loading="lazy" decoding="async" className="max-h-[300px] w-full object-contain transition duration-500 group-hover:scale-[1.01]" /> : <div className="h-[210px] w-full rounded-xl bg-gradient-to-br from-violet-950/70 via-[#17121f] to-[#0b0b0f]" />}<div className="absolute left-3 top-3 projects-chain-badge rounded-full bg-black/55 px-3 py-1.5 text-[9px] font-black text-white backdrop-blur">{p.chain || "TBA"}</div><div className="absolute right-3 top-3 projects-verified-badge rounded-full bg-black/55 px-3 py-1.5 text-[9px] font-black text-zinc-200 backdrop-blur">✓ Verified</div></div><div className="p-5"><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-black">{p.logoUrl ? <img src={p.logoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span className="font-black">{p.name[0]}</span>}</div><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{p.name}</h2><div className="mt-1 text-[10px] text-zinc-500">NFT</div></div><span className="text-xs text-zinc-500">↗</span></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-center"><div><div className="text-[10px] font-bold">Supply</div><div className="mt-1 text-[10px] text-zinc-500">TBD</div></div><div><div className="text-[10px] font-bold">Mint price</div><div className="mt-1 text-[10px] text-zinc-500">TBD</div></div><div><div className="text-[10px] font-bold">Mint date</div><div className="mt-1 text-[10px] text-zinc-500">TBD</div></div></div></div></Link>)}</div>}
      </div>
    </div>
    <style jsx global>{`
      html[data-theme="light"] .projects-chain-badge,
      html[data-theme="light"] .projects-verified-badge {
        background: rgba(255, 255, 255, 0.92) !important;
        border: 1px solid rgba(124, 58, 237, 0.16);
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
      }
      html[data-theme="light"] .projects-chain-badge {
        color: #27272a !important;
      }
      html[data-theme="light"] .projects-verified-badge {
        color: #3f3f46 !important;
      }
    `}</style>
  </main>;
}
