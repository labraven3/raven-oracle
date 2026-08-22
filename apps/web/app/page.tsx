"use client";

import "./raven-3d.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { API_BASE_URL } from "@/lib/api-config";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  category?: string | null;
};

type Raffle = {
  id: string;
  title: string;
  prizeName: string;
  prizeQuantity: number;
  startsAt: string;
  endsAt: string;
  status: string;
  winnerCount: number;
  project?: { id: string; name?: string | null; logoUrl?: string | null } | null;
  _count?: { entries: number; winners: number; tasks: number };
};

async function readHome() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE_URL}/home`, { cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
    return data as { projects?: Project[]; raffles?: Raffle[] };
  } finally {
    window.clearTimeout(timer);
  }
}

function Logo({ src, name, large = false }: { src?: string | null; name: string; large?: boolean }) {
  return (
    <div className={`${large ? "h-14 w-14 rounded-2xl" : "h-10 w-10 rounded-xl"} shrink-0 overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-cyan-400/10`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</div>}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ThreeDShowcase({ project, sideProjects, dark }: { project?: Project; sideProjects: Project[]; dark: boolean }) {
  return (
    <div className={`relative min-h-[430px] overflow-hidden rounded-[32px] border ${dark ? "border-white/10 bg-[#0c0915]" : "border-violet-100 bg-white"}`}>
      <div className={`absolute inset-0 ${dark ? "bg-[radial-gradient(circle_at_50%_42%,rgba(148,92,255,.28),transparent_36%),radial-gradient(circle_at_75%_15%,rgba(50,220,255,.10),transparent_28%)]" : "bg-[radial-gradient(circle_at_50%_42%,rgba(139,92,246,.18),transparent_36%),radial-gradient(circle_at_75%_15%,rgba(34,211,238,.10),transparent_28%)]"}`} />
      <div className="absolute -left-20 top-24 h-48 w-48 rounded-full bg-violet-600/20 blur-[80px]" />
      <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-[90px]" />

      <div className="relative z-10 flex items-start justify-between p-5 sm:p-7">
        <div><div className="text-[9px] font-black tracking-[.26em] text-violet-400">FEATURED DROP</div><h2 className={`mt-2 text-2xl font-black tracking-tight ${dark ? "text-white" : "text-zinc-950"}`}>{project?.name || "Raven Oracle spotlight"}</h2></div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[8px] font-black tracking-[.16em] text-emerald-400">NFT</span>
      </div>

      <div className="ro-3d-scene absolute inset-x-0 top-[78px] h-[290px]">
        <div className="ro-3d-orbit ro-orbit-a" />
        <div className="ro-3d-orbit ro-orbit-b" />
        <div className="ro-3d-card ro-card-back" />
        <div className="ro-3d-card ro-card-mid" />
        <div className="ro-3d-card ro-card-front">
          <div className="ro-card-shine" />
          <div className="ro-card-grid" />
          <div className="ro-card-logo">{project?.logoUrl ? <img src={project.logoUrl} alt="" /> : <span>{project?.name?.slice(0, 1).toUpperCase() || "R"}</span>}</div>
          <div className="ro-card-chip">NFT</div>
          <div className="ro-card-title">{project?.name || "Raven Oracle"}</div>
          <div className="ro-card-meta">VERIFIED WHITELIST · RAVEN ORACLE</div>
          <div className="ro-card-lines"><span /><span /><span /></div>
        </div>
        {sideProjects.slice(0, 2).map((item, index) => <Link key={item.id} href={`/projects/${item.id}`} className={`ro-float-token ${index === 0 ? "ro-token-left" : "ro-token-right"}`}><Logo src={item.logoUrl} name={item.name} /></Link>)}
      </div>

      <div className={`absolute inset-x-5 bottom-5 z-20 rounded-2xl border p-4 backdrop-blur-xl sm:inset-x-7 ${dark ? "border-white/10 bg-black/35" : "border-zinc-200 bg-white/75"}`}>
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="text-[8px] font-black tracking-[.18em] text-zinc-500">DISCOVERED ON RAVEN ORACLE</div><div className={`mt-1 truncate text-sm font-black ${dark ? "text-white" : "text-zinc-950"}`}>{project?.name || "Your next NFT project"}</div></div>{project && <Link href={`/projects/${project.id}`} className="shrink-0 rounded-lg bg-violet-500 px-3 py-2 text-[9px] font-black text-white transition hover:bg-violet-400">Explore →</Link>}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tab, setTab] = useState<"trending" | "upcoming">("trending");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    let active = true;
    readHome().then((data) => {
      if (!active) return;
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setRaffles(Array.isArray(data.raffles) ? data.raffles : []);
      setApiError(false);
    }).catch(() => {
      if (!active) return;
      setApiError(true);
      setProjects([]);
      setRaffles([]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const dark = theme === "dark";
  const visibleProjects = useMemo(() => projects.slice(0, 12), [projects]);
  const featuredProjects = useMemo(() => projects.slice(0, 3), [projects]);
  const activeRaffles = useMemo(() => raffles.filter((r) => r.status === "ACTIVE"), [raffles]);
  const upcomingRaffles = useMemo(() => raffles.filter((r) => r.status === "SCHEDULED"), [raffles]);
  const displayedRaffles = tab === "trending" ? activeRaffles : upcomingRaffles;

  const shell = dark ? "min-h-screen overflow-x-hidden bg-[#07070b] text-white" : "min-h-screen overflow-x-hidden bg-[#f7f7fb] text-zinc-950";
  const card = dark ? "border-white/[.08] bg-white/[.025]" : "border-zinc-200 bg-white shadow-sm";
  const muted = dark ? "text-zinc-400" : "text-zinc-600";

  return (
    <main className={shell}>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className={dark ? "absolute left-[5%] top-[4%] h-[34rem] w-[34rem] rounded-full bg-violet-600/12 blur-[150px]" : "absolute left-[5%] top-[4%] h-[34rem] w-[34rem] rounded-full bg-violet-400/15 blur-[150px]"} /><div className={dark ? "absolute right-0 top-[24%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/7 blur-[150px]" : "absolute right-0 top-[24%] h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-[150px]"} /></div>

      <section className="mx-auto w-full max-w-[1380px] px-5 pb-12 pt-24 sm:px-8 lg:px-10 lg:pt-28">
        <div className="grid min-w-0 items-center gap-8 lg:grid-cols-[.86fr_1.14fr]">
          <div className="min-w-0 self-center">
            <div className={dark ? "mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[10px] font-black tracking-[.24em] text-violet-300" : "mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-[10px] font-black tracking-[.24em] text-violet-700"}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> NFT RAFFLE ECOSYSTEM</div>
            <h1 className="max-w-3xl text-5xl font-black leading-[.92] tracking-[-.065em] sm:text-6xl lg:text-[76px]">The next generation of<span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text pb-2 text-transparent">NFT whitelists.</span></h1>
            <p className={`mt-6 max-w-xl text-base leading-7 sm:text-lg ${muted}`}>Discover real NFT projects, enter verified raffles, complete eligible tasks and earn whitelist spots through Raven Oracle.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/raffles" className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-violet-500/20 transition hover:-translate-y-1">Explore Raffles</Link><Link href="/projects" className={dark ? "rounded-xl border border-white/10 bg-white/[.03] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-1" : "rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-bold text-zinc-900 transition hover:-translate-y-1"}>Explore Projects</Link></div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[9px] font-black tracking-[.12em] text-zinc-500"><span>✓ VERIFIED PROJECTS</span><span>✓ FAIR DRAW</span><span>✓ DISCORD TASKS</span><span>✓ EVM + SOLANA</span></div>
          </div>
          <ThreeDShowcase project={featuredProjects[0]} sideProjects={featuredProjects.slice(1)} dark={dark} />
        </div>
      </section>

      <section className={dark ? "border-y border-white/[.06] bg-white/[.018]" : "border-y border-zinc-200 bg-white/70"}><div className="mx-auto grid w-full max-w-[1380px] grid-cols-2 sm:grid-cols-4"><div className="border-r border-white/[.06] px-4 py-6 text-center"><div className="text-2xl font-black">{loading ? "—" : projects.length}</div><div className="mt-1 text-[8px] font-black tracking-[.18em] text-zinc-500">VERIFIED PROJECTS</div></div><div className="border-r border-white/[.06] px-4 py-6 text-center"><div className="text-2xl font-black">{loading ? "—" : activeRaffles.length}</div><div className="mt-1 text-[8px] font-black tracking-[.18em] text-zinc-500">LIVE RAFFLES</div></div><div className="border-r border-white/[.06] px-4 py-6 text-center"><div className="text-2xl font-black">100%</div><div className="mt-1 text-[8px] font-black tracking-[.18em] text-zinc-500">FAIR DRAW</div></div><div className="px-4 py-6 text-center"><div className="text-2xl font-black">2</div><div className="mt-1 text-[8px] font-black tracking-[.18em] text-zinc-500">CHAINS</div></div></div></section>

      <section className="mx-auto w-full max-w-[1380px] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4"><div><div className="text-[10px] font-black tracking-[.24em] text-violet-400">DISCOVER</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Trending NFT Projects</h2><p className={`mt-2 text-sm ${muted}`}>Approved NFT communities and their whitelist opportunities.</p></div><Link href="/projects" className="shrink-0 text-xs font-black text-violet-400">View all →</Link></div>
        {apiError && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${dark ? "border-amber-400/20 bg-amber-400/5 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-800"}`}>Project data is temporarily unavailable. The rest of the homepage is still available.</div>}
        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-4">{loading ? [0,1,2,3].map((item) => <div key={item} className={`h-48 animate-pulse rounded-2xl border ${card}`} />) : visibleProjects.length === 0 ? <div className={`col-span-full rounded-2xl border border-dashed py-16 text-center text-sm ${dark ? "border-white/10 text-zinc-500" : "border-zinc-200 text-zinc-500"}`}>{apiError ? "Unable to load projects right now." : "No approved NFT projects yet. Once a project is approved, it will appear here automatically."}</div> : visibleProjects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className={`group relative min-w-0 overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-2 hover:border-violet-500/40 ${card}`}><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl transition group-hover:bg-violet-500/25" /><div className="relative flex min-w-0 items-center gap-4"><Logo src={project.logoUrl} name={project.name} large /><div className="min-w-0"><h3 className="truncate font-black group-hover:text-violet-300">{project.name}</h3><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500">NFT · {project.category || "NFT"}</p></div></div><p className="relative mt-5 line-clamp-2 text-sm leading-6 text-zinc-500">{project.description || "Explore this NFT project and its upcoming whitelist raffles."}</p><div className="relative mt-5 flex items-center justify-between border-t border-white/[.06] pt-4 text-[10px] font-black uppercase tracking-wider text-zinc-500"><span>Explore project</span><span className="text-violet-400 transition group-hover:translate-x-1">→</span></div></Link>)}</div>
      </section>

      <section className="mx-auto w-full max-w-[1380px] px-5 pb-20 sm:px-8 lg:px-10"><div className="mb-8 flex items-end justify-between gap-4"><div><div className="text-[10px] font-black tracking-[.24em] text-fuchsia-400">RAFFLES</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">What's happening</h2><p className={`mt-2 text-sm ${muted}`}>Live and upcoming NFT whitelist opportunities.</p></div><div className={`flex rounded-xl border p-1 ${dark ? "border-white/10 bg-white/[.03]" : "border-zinc-200 bg-white"}`}><button onClick={() => setTab("trending")} className={`rounded-lg px-4 py-2 text-[10px] font-black ${tab === "trending" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>TRENDING</button><button onClick={() => setTab("upcoming")} className={`rounded-lg px-4 py-2 text-[10px] font-black ${tab === "upcoming" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>UPCOMING</button></div></div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">{displayedRaffles.length === 0 ? <div className={`col-span-full rounded-2xl border border-dashed py-14 text-center text-sm ${dark ? "border-white/10 text-zinc-500" : "border-zinc-200 text-zinc-500"}`}>{loading ? "Loading raffles…" : tab === "trending" ? "No live NFT raffles right now." : "No upcoming NFT raffles yet."}</div> : displayedRaffles.map((raffle) => <Link key={raffle.id} href={`/raffles/${raffle.id}`} className={`group rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:border-violet-500/40 ${card}`}><div className="flex items-center gap-3"><Logo src={raffle.project?.logoUrl} name={raffle.project?.name || "NFT"} /><div className="min-w-0"><h3 className="truncate font-black group-hover:text-violet-300">{raffle.title}</h3><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500">{raffle.project?.name || "NFT Project"}</p></div><span className={`ml-auto rounded-full px-2 py-1 text-[8px] font-black ${raffle.status === "ACTIVE" ? "bg-emerald-400/10 text-emerald-400" : "bg-violet-400/10 text-violet-300"}`}>{raffle.status === "ACTIVE" ? "LIVE" : "UPCOMING"}</span></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4"><div><div className="text-[8px] font-black tracking-wider text-zinc-500">PRIZE</div><div className="mt-1 text-sm font-black">{raffle.prizeQuantity} × {raffle.prizeName}</div></div><div><div className="text-[8px] font-black tracking-wider text-zinc-500">ENDS</div><div className="mt-1 text-sm font-black">{formatDate(raffle.endsAt)}</div></div></div></Link>)}</div>
      </section>
    </main>
  );
}
