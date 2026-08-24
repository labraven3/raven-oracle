"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "ALL" | "NFT";
type Chain = { id: string; name: string; slug: string };
type Project = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  xUrl: string | null;
  discordUrl: string | null;
  logoUrl: string;
  bannerUrl: string | null;
  projectType: "NFT" | "TOKEN" | "AIRDROP" | "OTHER";
  category: string;
  chain?: string | null;
};
const DEFAULT_CHAINS = ["Ethereum", "Solana", "Polygon", "Aptos", "Sui", "Bitcoin", "Base", "Arbitrum", "Binance", "Monad", "Blast", "Scroll", "zkSync", "Linea", "ApeChain", "Abstract", "Bera", "Robinhood"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chains, setChains] = useState<Chain[]>(DEFAULT_CHAINS.map(name => ({ id: name, name, slug: name.toLowerCase() })));
  const [type, setType] = useState<ProjectType>("ALL");
  const [chain, setChain] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/chains`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setChains(d.chains?.length ? d.chains : chains))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "60" });
    if (type === "NFT") params.set("projectType", "NFT");
    if (chain !== "ALL") params.set("chain", chain);
    if (search.trim()) params.set("search", search.trim());
    setLoading(true); setError("");
    fetch(`${API_BASE_URL}/projects/discovery?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Unable to load projects"); return d; })
      .then(d => setProjects(d.projects ?? []))
      .catch(e => { if (e.name !== "AbortError") setError(e instanceof Error ? e.message : "Unable to load projects"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [type, chain, search]);

  return <main className="min-h-screen bg-[#f6f7f9] text-[#171820] dark:bg-[#07070a] dark:text-zinc-100">
    <SiteHeader />
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_50px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-[#0d0c11] dark:shadow-none">
        <header className="border-b border-slate-200/80 px-5 py-5 sm:px-7 dark:border-white/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Dashboard /</div><h1 className="mt-1 text-2xl font-semibold">All projects</h1></div>
            <div className="flex flex-wrap gap-2"><Link href="/projects/new" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black dark:border-white/10">Submit a project</Link><select value={chain} onChange={e => setChain(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold dark:border-white/10 dark:bg-[#121318]"><option value="ALL">All chains</option>{chains.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          </div>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <label className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-black/20"><span className="mr-3 text-slate-400">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects" className="w-full bg-transparent py-3 text-sm outline-none" /></label>
            <div className="flex gap-2"><button onClick={() => setType("ALL")} className={`rounded-xl border px-4 py-2.5 text-[10px] font-black ${type === "ALL" ? "border-[#242631] bg-[#242631] text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>All projects</button><button onClick={() => setType("NFT")} className={`rounded-xl border px-4 py-2.5 text-[10px] font-black ${type === "NFT" ? "border-[#242631] bg-[#242631] text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>NFT</button></div>
          </div>
        </header>
        <div className="flex items-center justify-between px-5 py-4 text-[10px] font-semibold text-slate-400 sm:px-7"><span>{loading ? "Loading…" : `${projects.length} projects`}</span><span>Sort by: <b className="text-slate-700 dark:text-zinc-300">Trending ↓</b></span></div>
        {error && <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 sm:mx-7">{error}</div>}
        {loading ? <div className="p-16 text-center text-sm text-slate-400">Loading projects…</div> : projects.length === 0 ? <div className="m-5 rounded-2xl border border-dashed border-slate-200 p-16 text-center text-sm text-slate-400">No projects found.</div> :
          <div className="grid gap-5 px-5 pb-7 sm:px-7 md:grid-cols-2">
            {projects.map(p => <Link key={p.id} href={`/projects/${p.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-[#111218]">
              <div className="relative flex min-h-[210px] items-center justify-center overflow-hidden bg-slate-100 p-2 dark:bg-[#17171e]">
                {p.bannerUrl ? <img src={p.bannerUrl} alt="" className="max-h-[310px] w-full object-contain transition duration-500 group-hover:scale-[1.01]" /> : <div className="h-[210px] w-full rounded-xl bg-gradient-to-br from-violet-950/70 via-[#17121f] to-[#0b0b0f]" />}
                <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-black text-slate-700">{p.chain || "TBA"}</div><div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-black text-slate-600">✓ Verified</div>
              </div>
              <div className="p-5"><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-white dark:border-white/10 dark:bg-black">{p.logoUrl ? <img src={p.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-black">{p.name[0]}</span>}</div><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{p.name}</h2><div className="mt-1 text-[10px] text-slate-400">NFT</div></div><span className="text-xs text-slate-400">↗</span></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center dark:border-white/5"><div><div className="text-[10px] font-bold">Supply</div><div className="mt-1 text-[10px] text-slate-400">TBD</div></div><div><div className="text-[10px] font-bold">Mint price</div><div className="mt-1 text-[10px] text-slate-400">TBD</div></div><div><div className="text-[10px] font-bold">Mint date</div><div className="mt-1 text-[10px] text-slate-400">TBD</div></div></div></div>
            </Link>)}
          </div>}
      </div>
    </div>
  </main>;
}
