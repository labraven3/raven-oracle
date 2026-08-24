"use client";

import { useEffect, useState } from "react";
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
type DiscoveryResponse = { projects?: Project[]; total?: number; counts?: Record<string, number> };

const projectTypes: ProjectType[] = ["ALL", "NFT", "TOKEN", "AIRDROP", "OTHER"];
const DEFAULT_CHAIN_NAMES = ["Ethereum", "Solana", "Polygon", "Aptos", "Sui", "Bitcoin", "Base", "Arbitrum", "Binance", "Monad", "Blast", "Scroll", "zkSync", "Linea", "ApeChain", "Abstract", "Bera", "Robinhood"];
const DEFAULT_CHAINS: Chain[] = DEFAULT_CHAIN_NAMES.map((name) => ({ id: `default-${name.toLowerCase()}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }));

function chainName(value?: string | null) { return value?.trim() || "TBA"; }
function badgeFor(project: Project) { return project.projectType === "NFT" ? "NFT" : project.projectType; }

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
    fetch(`${API_BASE_URL}/chains`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load chains");
        return data as { chains?: Chain[] };
      })
      .then((data) => { if (!cancelled) setChains(data.chains?.length ? data.chains : DEFAULT_CHAINS); })
      .catch(() => { if (!cancelled) setChains(DEFAULT_CHAINS); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (projectType !== "ALL") params.set("projectType", projectType);
    if (chain !== "ALL") params.set("chain", chain);
    if (query.trim()) params.set("search", query.trim());
    params.set("limit", "60");
    setLoading(true); setError("");
    fetch(`${API_BASE_URL}/projects/discovery?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load projects");
        return data as DiscoveryResponse;
      })
      .then((data) => { if (!cancelled) setProjects(data.projects ?? []); })
      .catch((reason) => { if (!cancelled) { setProjects([]); setError(reason instanceof Error ? reason.message : "Unable to load projects"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectType, chain, query]);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#171820] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#0d0c11] dark:shadow-none">
          <header className="border-b border-slate-200/80 px-5 py-5 sm:px-7 dark:border-white/10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black">R</Link>
                <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Dashboard /</div><h1 className="mt-0.5 text-xl font-semibold">All projects</h1></div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link href="/projects/new" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-[#121318] dark:text-zinc-200">Submit a project</Link>
                <select value={chain} onChange={(e) => setChain(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#121318] dark:text-zinc-200"><option value="ALL">Filters: All chains</option>{chains.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-black/20"><span className="mr-3 text-slate-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600" /></label>
              <div className="flex gap-2 overflow-x-auto">
                {projectTypes.map((item) => <button key={item} onClick={() => setProjectType(item)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-[10px] font-black ${projectType === item ? "border-[#242631] bg-[#242631] text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-[#121318] dark:text-zinc-300"}`}>{item === "ALL" ? "All projects" : item}</button>)}
              </div>
            </div>
          </header>

          <div className="flex items-center justify-between px-5 py-4 text-[10px] font-semibold text-slate-400 sm:px-7"><span>{loading ? "Loading…" : `${projects.length} projects`}</span><span>Sort by: <b className="text-slate-600 dark:text-zinc-300">Trending ↓</b></span></div>
          {error && <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 sm:mx-7 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-300">{error}</div>}
          {loading ? <div className="px-5 pb-10 sm:px-7"><div className="rounded-2xl bg-slate-50 p-16 text-center text-sm text-slate-400 dark:bg-[#111218]">Loading projects…</div></div> : projects.length === 0 ? <div className="px-5 pb-10 sm:px-7"><div className="rounded-2xl border border-dashed border-slate-200 p-16 text-center text-sm text-slate-400 dark:border-white/10">No projects found.</div></div> : (
            <div className="grid gap-5 px-5 pb-7 sm:px-7 md:grid-cols-2">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-white/10 dark:bg-[#111218] dark:shadow-none dark:hover:border-violet-500/30">
                  <div className="relative aspect-[2.55/1] overflow-hidden bg-slate-200 dark:bg-[#1b1b22]">
                    {project.bannerUrl ? <img src={project.bannerUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.34),transparent_38%),linear-gradient(135deg,#dfe3ea,#8f9aaa)] dark:from-[#1c1729] dark:to-[#15151b]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-black text-slate-700 shadow-sm">☰ {chainName(project.chain)}</div>
                    <div className="absolute right-3 top-3 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-[9px] font-black text-slate-600 shadow-sm">✓ Verified</div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-black">{project.logoUrl ? <img src={project.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-black">{project.name.slice(0,1)}</span>}</div>
                      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{project.name}</h2><div className="mt-1 text-[10px] font-medium text-slate-400">{project.category || badgeFor(project)}</div></div>
                      <span className="text-[10px] font-semibold text-slate-400">↗</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center dark:border-white/5"><div><div className="text-[10px] font-bold text-slate-700 dark:text-zinc-200">{project.projectType === "NFT" ? "Supply" : "Type"}</div><div className="mt-1 text-[10px] text-slate-400">{project.projectType === "NFT" ? "TBD" : project.projectType}</div></div><div><div className="text-[10px] font-bold text-slate-700 dark:text-zinc-200">Mint price</div><div className="mt-1 text-[10px] text-slate-400">TBD</div></div><div><div className="text-[10px] font-bold text-slate-700 dark:text-zinc-200">Mint date</div><div className="mt-1 text-[10px] text-slate-400">TBD</div></div></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
