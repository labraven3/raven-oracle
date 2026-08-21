"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "ALL" | "NFT" | "TOKEN" | "AIRDROP" | "OTHER";
type Chain = { id: string; name: string; slug: string };
type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  xUrl: string | null;
  discordUrl: string | null;
  logoUrl: string;
  bannerUrl: string | null;
  projectType: Exclude<ProjectType, "ALL">;
  category: string;
  chain?: string | null;
  status: string;
  createdAt: string;
};

const projectTypes: ProjectType[] = ["ALL", "NFT", "TOKEN", "AIRDROP", "OTHER"];
const DEFAULT_CHAIN_NAMES = ["Ethereum", "Solana", "Polygon", "Aptos", "Sui", "Cardano", "Bitcoin", "Avax", "Venom", "Injective", "Sei", "Base", "Ripple", "Arbitrum", "Immutable", "Flow", "Binance", "Tezos", "MultiversX", "Near", "Hedera", "Cosmos", "Reef", "Starknet", "Manta", "Monad", "Blast", "Stargaze", "Scroll", "zkSync", "Enjin", "Linea", "Oraichain", "TON", "Viction", "Bera", "Tron", "ApeChain", "Abstract", "Hyperliquid", "Story", "XION", "Somnia", "Sophon", "Robinhood"];
const DEFAULT_CHAINS: Chain[] = DEFAULT_CHAIN_NAMES.map((name) => ({ id: `default-${name.toLowerCase()}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }));

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chains, setChains] = useState<Chain[]>(DEFAULT_CHAINS);
  const [query, setQuery] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("ALL");
  const [chain, setChain] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch(`${API_BASE_URL}/projects/public`, { cache: "no-store" }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message ?? "Unable to load projects");
        return d as { projects?: Project[] };
      }),
      fetch(`${API_BASE_URL}/chains`, { cache: "no-store" }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message ?? "Unable to load chains");
        return d as { chains?: Chain[] };
      }),
    ]).then(([projectsResult, chainsResult]) => {
      if (cancelled) return;
      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value.projects ?? []);
      else setError(projectsResult.reason instanceof Error ? projectsResult.reason.message : "Unable to load projects");
      if (chainsResult.status === "fulfilled" && chainsResult.value.chains?.length) setChains(chainsResult.value.chains);
      else setChains(DEFAULT_CHAINS);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((project) =>
      (projectType === "ALL" || project.projectType === projectType) &&
      (chain === "ALL" || project.chain === chain) &&
      (!q || `${project.name} ${project.description ?? ""} ${project.projectType} ${project.chain ?? ""}`.toLowerCase().includes(q))
    );
  }, [projects, projectType, chain, query]);

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#15151d] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-black/5 pb-7 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.24em] text-violet-500 dark:text-violet-300">Explore</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Discover Projects</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Discover verified NFTs, tokens, airdrops and other Web3 opportunities across the networks supported by Raven Oracle.</p>
          </div>
          <Link href="/projects/new" className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500">Submit a project</Link>
        </header>

        <section className="mt-7 rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0c11]">
          <div className="p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_230px]">
              <label className="flex items-center rounded-xl border border-black/10 bg-[#fafafa] px-4 dark:border-white/10 dark:bg-black/20">
                <span className="mr-3 text-zinc-400">⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, type or chain" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400" />
              </label>
              <select value={chain} onChange={(e) => setChain(e.target.value)} className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-700 outline-none dark:border-white/10 dark:bg-[#121318] dark:text-zinc-200">
                <option value="ALL">All chains</option>
                {chains.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {projectTypes.map((item) => (
                <button key={item} onClick={() => setProjectType(item)} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black tracking-[.08em] transition ${projectType === item ? "border-violet-500 bg-violet-500 text-white" : "border-black/10 bg-white text-zinc-600 hover:border-violet-300 hover:text-violet-500 dark:border-white/10 dark:bg-[#111218] dark:text-zinc-300 dark:hover:border-violet-400 dark:hover:text-violet-300"}`}>{item}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-zinc-400 dark:border-white/10 sm:px-6">
            <span>{loading ? "Loading" : `${filtered.length} projects`}</span>
            <span>{chain === "ALL" ? "All networks" : chain}</span>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>}
        {loading ? (
          <div className="mt-5 rounded-2xl border border-black/5 bg-white p-16 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0d0c11]">Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white p-16 text-center dark:border-white/10 dark:bg-[#0d0c11]"><h2 className="text-lg font-semibold">No projects found</h2><p className="mt-2 text-sm text-zinc-500">Try another search, project type or chain.</p></div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5 dark:border-white/10 dark:bg-[#0d0c11] dark:hover:border-violet-500/40">
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-100 via-slate-100 to-slate-200 dark:from-violet-950/40 dark:via-[#17171d] dark:to-[#0a0a0d]">
                  {project.bannerUrl ? <img src={project.bannerUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.35),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,.20),transparent_40%)]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4"><span className="rounded-full bg-black/45 px-3 py-1.5 text-[9px] font-black text-white backdrop-blur">{project.projectType}</span><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-black text-emerald-200 backdrop-blur">VERIFIED</span></div>
                  <div className="absolute bottom-4 left-4 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-white/70 bg-black/40 shadow-lg backdrop-blur"><img src={project.logoUrl} alt="" className="h-full w-full object-cover" /></div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold group-hover:text-violet-500">{project.name}</h2><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">{project.chain || "Chain TBA"}</p></div><span className="text-xs text-zinc-400">→</span></div>
                  <p className="mt-4 line-clamp-2 text-xs leading-5 text-zinc-500">{project.description || "Verified project on Raven Oracle."}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-[9px] font-black uppercase tracking-[.12em] text-zinc-400 dark:border-white/5"><span>{project.projectType}</span><span className="text-violet-500">View details</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
