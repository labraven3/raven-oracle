"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { API_BASE_URL } from "@/lib/api-config";

type Project = { id: string; name: string; description?: string | null; logoUrl?: string | null; category?: string | null };
type Raffle = { id: string; title: string; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount: number; project?: { id: string; name?: string | null; logoUrl?: string | null } | null; _count?: { entries: number; winners: number; tasks: number } };
type OgCollection = { name: string; chain: string; image: string; subtitle: string };
type Ecosystem = { name: string; mark: string; detail: string };

const OG_COLLECTIONS: OgCollection[] = [
  { name: "Bored Ape Yacht Club", chain: "Ethereum", image: "https://cdn.sanity.io/images/cg92vzda/production/37007d3de60678ca6a37467cbe97cf5febbf663b-1360x2000.jpg?auto=format&fit=max&q=75&w=1200", subtitle: "10K iconic apes" },
  { name: "CryptoPunks", chain: "Ethereum", image: "https://media.nftnewstoday.com/4691/conversions/cryptopunks--optimized.webp", subtitle: "OG pixel legends" },
  { name: "Pudgy Penguins", chain: "Ethereum", image: "https://thecryptokrew.com/wp-content/uploads/2024/03/pudgy-penguins-huddle.jpg", subtitle: "8,888 penguins" },
  { name: "Azuki", chain: "Ethereum", image: "https://bloomrewards.ghost.io/content/images/2023/05/data-src-image-7a30970e-ed45-4521-ae05-c21f9bf03f0d.png", subtitle: "Anime-inspired icons" },
  { name: "Doodles", chain: "Ethereum", image: "https://imageio.forbes.com/specials-images/imageserve/631fd33431b0b6a8ed7ec50a/0x0.jpg?fit=bounds&format=jpg&height=900&width=1600", subtitle: "Colorful culture" },
  { name: "Moonbirds", chain: "Ethereum", image: "https://www.coinspeaker.com/wp-content/uploads/2022/09/what-are-moonbirds-guide-to-the-pfp-nft-collection.jpg", subtitle: "10K pixel owls" },
];

const ECOSYSTEMS: Ecosystem[] = [
  { name: "Ethereum", mark: "Ξ", detail: "Blue-chip NFT home" },
  { name: "Solana", mark: "≋", detail: "Fast-moving NFT scene" },
  { name: "Bitcoin", mark: "₿", detail: "Ordinals & Runes" },
  { name: "Polygon", mark: "◇", detail: "Gaming & brands" },
  { name: "Base", mark: "●", detail: "Onchain creators" },
  { name: "Robinhood", mark: "◈", detail: "Digital asset platform" },
];

async function readHome() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE_URL}/home`, { cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
    return data as { projects?: Project[]; raffles?: Raffle[] };
  } finally { window.clearTimeout(timer); }
}

function Logo({ src, name, large = false }: { src?: string | null; name: string; large?: boolean }) {
  return <div className={`${large ? "h-14 w-14 rounded-2xl" : "h-10 w-10 rounded-xl"} shrink-0 overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-cyan-400/10`}>{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</div>}</div>;
}

function remaining(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Math.max(0, date.getTime() - Date.now());
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function OgShowcase() {
  const [index, setIndex] = useState(0);
  const [ecoIndex, setEcoIndex] = useState(0);
  const collection = OG_COLLECTIONS[index];
  const ecosystem = ECOSYSTEMS[ecoIndex];

  useEffect(() => {
    const collectionTimer = window.setInterval(() => setIndex((value) => (value + 1) % OG_COLLECTIONS.length), 4500);
    const ecosystemTimer = window.setInterval(() => setEcoIndex((value) => (value + 1) % ECOSYSTEMS.length), 3000);
    return () => { window.clearInterval(collectionTimer); window.clearInterval(ecosystemTimer); };
  }, []);

  return <div className="relative min-h-[410px] overflow-hidden rounded-[30px] border border-violet-400/15 bg-[#08070e] sm:min-h-[510px]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,.34),transparent_38%),radial-gradient(circle_at_88%_15%,rgba(34,211,238,.16),transparent_25%),radial-gradient(circle_at_8%_85%,rgba(236,72,153,.12),transparent_25%)]" />
    <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
    <div className="absolute left-5 top-5 z-30 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[8px] font-black tracking-[.22em] text-violet-200 backdrop-blur-xl">OG COLLECTIONS</div>
    <div className="absolute right-5 top-5 z-30 flex gap-1.5">{OG_COLLECTIONS.map((item, i) => <button aria-label={`Show ${item.name}`} key={item.name} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-white shadow-[0_0_12px_rgba(255,255,255,.7)]" : "w-1.5 bg-white/30 hover:bg-white/60"}`} />)}</div>

    <div className="absolute inset-x-0 top-[55px] flex justify-center sm:top-[65px]">
      <div key={collection.name} className="group relative h-[285px] w-[285px] rotate-[-2deg] rounded-[34px] border border-white/20 bg-white/[.04] p-3 shadow-[0_0_100px_rgba(139,92,246,.32)] animate-[fadeIn_.7s_ease-out] sm:h-[355px] sm:w-[355px] sm:p-4">
        <div className="absolute -inset-5 -z-10 rounded-[45px] bg-violet-500/10 blur-2xl transition duration-700 group-hover:bg-fuchsia-500/20" />
        <div className="relative h-full w-full overflow-hidden rounded-[25px] border border-white/20 bg-black">
          <img src={collection.image} alt={`${collection.name} NFT collection`} className="h-full w-full object-cover transition duration-[4500ms] ease-out group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_30%,rgba(0,0,0,.38))]" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5"><div className="text-[8px] font-black uppercase tracking-[.22em] text-white/60">{collection.chain}</div><div className="mt-1 text-base font-black text-white sm:text-xl">{collection.name}</div><div className="mt-1 text-[9px] font-medium text-white/60">{collection.subtitle}</div></div>
        </div>
        <div className="absolute -right-2 -top-2 h-5 w-5 animate-pulse rounded-full bg-white shadow-[0_0_25px_rgba(255,255,255,.9)]" />
      </div>
    </div>

    <div className="absolute bottom-5 left-5 right-5 z-30 flex items-center justify-between gap-4 sm:bottom-7 sm:left-7 sm:right-7">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-lg font-black shadow-lg">{ecosystem.mark}</div>
        <div><div className="text-[7px] font-black tracking-[.2em] text-zinc-500">ECOSYSTEM</div><div className="text-xs font-black text-white">{ecosystem.name}</div><div className="text-[8px] text-zinc-500">{ecosystem.detail}</div></div>
      </div>
      <div className="hidden rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[8px] font-black uppercase tracking-[.18em] text-zinc-400 backdrop-blur sm:block">{collection.subtitle}</div>
    </div>
  </div>;
}

function ProjectCard({ project }: { project: Project }) {
  return <Link href={`/projects/${project.id}`} className="group relative overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] p-5 transition duration-300 hover:-translate-y-1 hover:border-violet-500/40"><div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl transition group-hover:bg-violet-500/25"/><div className="relative flex items-center gap-4"><Logo src={project.logoUrl} name={project.name} large/><div className="min-w-0"><h3 className="truncate font-black text-white group-hover:text-violet-300">{project.name}</h3><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.14em] text-zinc-500">{project.category || "NFT"} · VERIFIED</p></div></div><p className="mt-5 line-clamp-2 min-h-12 text-sm leading-6 text-zinc-500">{project.description || "Discover this verified NFT community and its whitelist opportunities."}</p><div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-4 text-xs font-bold text-zinc-400"><span>Explore</span><span className="text-violet-400 transition group-hover:translate-x-1">→</span></div></Link>;
}

function RaffleCard({ raffle }: { raffle: Raffle }) {
  const name = raffle.project?.name || raffle.title;
  return <Link href={`/raffles/${raffle.id}`} className="group min-w-0 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-500/40 sm:p-5"><div className="flex items-start gap-3"><Logo src={raffle.project?.logoUrl} name={name} large/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate font-black text-white">{name}</h3><span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[7px] font-black tracking-wider text-emerald-400">{raffle.status === "ACTIVE" ? "LIVE" : "SOON"}</span></div><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500">RAFFLE</p></div></div><div className="mt-5 grid grid-cols-3 gap-3 text-[9px]"><div><div className="uppercase tracking-wider text-zinc-600">Prize</div><div className="mt-1 truncate font-black text-white">{raffle.prizeQuantity} {raffle.prizeName}</div></div><div><div className="uppercase tracking-wider text-zinc-600">Ends in</div><div className="mt-1 font-black text-white">{remaining(raffle.endsAt)}</div></div><div><div className="uppercase tracking-wider text-zinc-600">Entries</div><div className="mt-1 font-black text-white">{(raffle._count?.entries || 0).toLocaleString()}</div></div></div><div className="mt-5 rounded-xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 px-4 py-2.5 text-center text-xs font-black text-violet-300 transition group-hover:from-violet-600 group-hover:text-white">Enter Raffle</div></Link>;
}

export default function Home() {
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tab, setTab] = useState<"trending" | "upcoming">("trending");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => { let active = true; readHome().then((data) => { if (!active) return; setProjects(Array.isArray(data.projects) ? data.projects : []); setRaffles(Array.isArray(data.raffles) ? data.raffles : []); setApiError(false); }).catch(() => { if (!active) return; setApiError(true); setProjects([]); setRaffles([]); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const dark = theme === "dark";
  const activeRaffles = useMemo(() => raffles.filter((r) => r.status === "ACTIVE"), [raffles]);
  const upcomingRaffles = useMemo(() => raffles.filter((r) => r.status === "SCHEDULED"), [raffles]);
  const displayedRaffles = tab === "trending" ? activeRaffles : upcomingRaffles;

  return <main className={dark ? "min-h-screen overflow-x-hidden bg-[#050507] text-white" : "min-h-screen overflow-x-hidden bg-[#f7f7fb] text-zinc-950"}>
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-[4%] top-[8%] h-[32rem] w-[32rem] rounded-full bg-violet-700/10 blur-[150px]"/><div className="absolute right-[-10%] top-[35%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/5 blur-[150px]"/></div>

    <section className="mx-auto w-full max-w-[1380px] px-5 pb-10 pt-24 sm:px-8 lg:px-10 lg:pb-16 lg:pt-28"><div className="grid items-center gap-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-12"><div className="min-w-0"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-[9px] font-black tracking-[.24em] text-violet-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400"/> NFT RAFFLE ECOSYSTEM</div><h1 className="max-w-3xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl lg:text-[76px]">The next generation of<span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text pb-2 text-transparent">NFT whitelists.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Discover real NFT projects, enter verified raffles, complete community tasks and earn whitelist spots through Raven Oracle.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/raffles" className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-violet-500/20 transition hover:-translate-y-1">Explore Raffles</Link><Link href="/projects" className="rounded-xl border border-white/10 bg-white/[.025] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-1 hover:bg-white/[.05]">Explore Projects</Link></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[8px] font-black tracking-[.13em] text-zinc-500"><span>✓ VERIFIED PROJECTS</span><span>✓ FAIR RAFFLES</span><span>✓ DISCORD VERIFIED</span><span>✓ X VERIFIED</span></div></div><OgShowcase/></div></section>

    <section className="border-y border-white/[.06] bg-white/[.018]"><div className="mx-auto grid w-full max-w-[1380px] grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">{[[loading ? "—" : projects.length.toLocaleString(), "VERIFIED PROJECTS"],[loading ? "—" : activeRaffles.length.toLocaleString(), "LIVE RAFFLES"],["100%", "FAIR DRAW"],["6+", "ECOSYSTEMS"],["24/7", "DISCOVERY"]].map(([value,label],i)=><div key={label} className={`px-4 py-5 text-center ${i < 4 ? "border-r border-white/[.06]" : "hidden lg:block"}`}><div className="text-xl font-black sm:text-2xl">{value}</div><div className="mt-1 text-[7px] font-black tracking-[.18em] text-zinc-600">{label}</div></div>)}</div></section>

    <section className="mx-auto w-full max-w-[1380px] px-5 py-14 sm:px-8 lg:px-10 lg:py-20"><div className="mb-7 flex items-end justify-between gap-4"><div><div className="text-[9px] font-black tracking-[.24em] text-violet-400">DISCOVER</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">NFT Projects</h2></div><Link href="/projects" className="text-xs font-black text-white transition hover:text-violet-300">View all →</Link></div>{apiError && <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">Project data is temporarily unavailable.</div>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{loading ? [0,1,2,3].map((i)=><div key={i} className="h-52 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]"/>) : projects.slice(0,4).map((project)=><ProjectCard key={project.id} project={project}/>)}{!loading && projects.length === 0 && !apiError && <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">No approved NFT projects yet.</div>}</div></section>

    <section className="border-y border-white/[.06] bg-white/[.012]"><div className="mx-auto w-full max-w-[1380px] px-5 py-14 sm:px-8 lg:px-10 lg:py-20"><div className="mb-7 flex items-end justify-between gap-4"><div><div className="text-[9px] font-black tracking-[.24em] text-cyan-400">RAFFLES</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">What's happening</h2></div><div className="flex rounded-xl border border-white/10 bg-white/[.025] p-1"><button onClick={() => setTab("trending")} className={`rounded-lg px-4 py-2 text-xs font-black transition ${tab === "trending" ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg" : "text-zinc-500"}`}>TRENDING</button><button onClick={() => setTab("upcoming")} className={`rounded-lg px-4 py-2 text-xs font-black transition ${tab === "upcoming" ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg" : "text-zinc-500"}`}>UPCOMING</button></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{displayedRaffles.slice(0,6).map((raffle)=><RaffleCard key={raffle.id} raffle={raffle}/>)}{!loading && displayedRaffles.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">No {tab === "trending" ? "live" : "upcoming"} raffles right now.</div>}</div></div></section>

    <div className="mx-auto max-w-[1380px] px-5 py-5 sm:px-8 lg:px-10"><div className="flex gap-8 overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.018] px-5 py-4 text-[8px] font-black tracking-[.16em] text-violet-300"><span className="whitespace-nowrap">@0xRaven entered a raffle</span><span className="whitespace-nowrap">@AlphaHunter won a WL spot</span><span className="whitespace-nowrap">@Web3Legend entered a raffle</span><span className="whitespace-nowrap">@MoonBag won 3 WL spots</span></div></div>
  </main>;
}
