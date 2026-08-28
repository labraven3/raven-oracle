"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = {
  id: string;
  title: string;
  prizeName: string;
  prizeQuantity: number;
  endsAt: string;
  status: string;
  project?: { name?: string | null; logoUrl?: string | null } | null;
  _count?: { entries: number };
};

type Project = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  category?: string | null;
  status?: string | null;
};

type OgCollection = { name: string; chain: string; mark: string; tone: string; subtitle: string };
type Ecosystem = { name: string; mark: string; detail: string };

const OG_COLLECTIONS: OgCollection[] = [
  { name: "Bored Ape Yacht Club", chain: "Ethereum", mark: "🦍", tone: "from-amber-300 via-orange-500 to-red-700", subtitle: "10K iconic apes" },
  { name: "CryptoPunks", chain: "Ethereum", mark: "👾", tone: "from-cyan-300 via-sky-500 to-indigo-700", subtitle: "OG pixel legends" },
  { name: "Pudgy Penguins", chain: "Ethereum", mark: "🐧", tone: "from-sky-200 via-cyan-400 to-blue-700", subtitle: "8,888 penguins" },
  { name: "Azuki", chain: "Ethereum", mark: "⛩️", tone: "from-rose-300 via-fuchsia-500 to-violet-700", subtitle: "Anime-inspired icons" },
  { name: "Doodles", chain: "Ethereum", mark: "🌈", tone: "from-pink-300 via-yellow-300 to-cyan-400", subtitle: "Colorful culture" },
  { name: "Moonbirds", chain: "Ethereum", mark: "🦉", tone: "from-violet-300 via-indigo-500 to-slate-800", subtitle: "Collective owls" },
];

const ECOSYSTEMS: Ecosystem[] = [
  { name: "Ethereum", mark: "Ξ", detail: "NFT blue chips" },
  { name: "Solana", mark: "≋", detail: "Fast NFT culture" },
  { name: "Bitcoin", mark: "₿", detail: "Ordinals & Runes" },
  { name: "Polygon", mark: "◇", detail: "Gaming & brands" },
  { name: "Base", mark: "●", detail: "Onchain creators" },
  { name: "Robinhood", mark: "◈", detail: "NFT marketplace" },
];

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

function remaining(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Math.max(0, date.getTime() - Date.now());
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function Logo({ src, name }: { src?: string | null; name: string }) {
  return <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-cyan-400/10">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</span>}</div>;
}

function CollectionVisual({ collection }: { collection: OgCollection }) {
  return <div className={`relative h-full w-full overflow-hidden rounded-[24px] bg-gradient-to-br ${collection.tone}`}>
    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
    <div className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-black/30 blur-3xl" />
    <div className="absolute inset-3 rounded-[19px] border border-white/30 bg-black/15 backdrop-blur-[2px]" />
    <div className="absolute inset-0 grid place-items-center"><div className="relative grid h-36 w-36 place-items-center rounded-[34px] border border-white/40 bg-black/20 text-7xl shadow-2xl backdrop-blur-md transition duration-700 sm:h-48 sm:w-48 sm:text-8xl">{collection.mark}<div className="absolute -right-2 -top-2 h-5 w-5 animate-pulse rounded-full bg-white shadow-[0_0_25px_rgba(255,255,255,.9)]" /></div></div>
    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3"><div><div className="text-[8px] font-black uppercase tracking-[.22em] text-white/70">{collection.chain}</div><div className="mt-1 text-sm font-black text-white sm:text-base">{collection.name}</div></div><div className="rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[8px] font-black text-white/80 backdrop-blur">OG</div></div>
  </div>;
}

function OgShowcase() {
  const [index, setIndex] = useState(0);
  const [ecoIndex, setEcoIndex] = useState(0);
  const collection = OG_COLLECTIONS[index];
  const ecosystem = ECOSYSTEMS[ecoIndex];

  useEffect(() => {
    const collectionTimer = window.setInterval(() => setIndex((value) => (value + 1) % OG_COLLECTIONS.length), 4200);
    const ecosystemTimer = window.setInterval(() => setEcoIndex((value) => (value + 1) % ECOSYSTEMS.length), 2800);
    return () => { window.clearInterval(collectionTimer); window.clearInterval(ecosystemTimer); };
  }, []);

  return <div className="relative min-h-[390px] overflow-hidden rounded-[30px] border border-violet-400/15 bg-[#08070e] shadow-2xl shadow-violet-950/20 sm:min-h-[500px]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(124,58,237,.34),transparent_38%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,.14),transparent_25%),radial-gradient(circle_at_8%_85%,rgba(236,72,153,.12),transparent_25%)]" />
    <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[100px]" />
    <div className="absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[8px] font-black tracking-[.2em] text-violet-200 backdrop-blur-xl">OG COLLECTIONS</div>
    <div className="absolute right-5 top-5 z-20 flex gap-1.5">{OG_COLLECTIONS.map((item, i) => <button aria-label={`Show ${item.name}`} key={item.name} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-1.5 bg-white/30"}`} />)}</div>
    <div className="absolute inset-x-0 top-[52px] flex justify-center sm:top-[62px]"><div key={collection.name} className="group relative h-[275px] w-[275px] rotate-[-2deg] rounded-[34px] border border-white/20 bg-gradient-to-br from-white/10 to-white/[.02] p-3 shadow-[0_0_90px_rgba(139,92,246,.32)] transition-all duration-700 animate-[pulse_4s_ease-in-out_infinite] sm:h-[350px] sm:w-[350px] sm:p-4"><CollectionVisual collection={collection} /></div></div>
    <div className="absolute bottom-5 left-5 right-5 z-20 flex items-center justify-between gap-4 sm:bottom-7 sm:left-7 sm:right-7"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-lg shadow-lg">{ecosystem.mark}</div><div><div className="text-[7px] font-black tracking-[.2em] text-zinc-500">NFT ECOSYSTEM & MARKET</div><div className="text-xs font-black text-white">{ecosystem.name}</div><div className="text-[8px] text-zinc-500">{ecosystem.detail}</div></div></div><div className="hidden rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[8px] font-black uppercase tracking-[.18em] text-zinc-400 backdrop-blur sm:block">{collection.subtitle}</div></div>
  </div>;
}

function ProjectCard({ project }: { project: Project }) {
  const description = project.description?.trim() || "NFT project on Raven Oracle.";
  return <Link href={`/projects/${project.id}`} className="group min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] transition duration-300 hover:-translate-y-1 hover:border-violet-500/40">
    <div className="relative h-28 overflow-hidden border-b border-white/[.06] bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-cyan-400/10">
      {project.bannerUrl ? <img src={project.bannerUrl} alt="" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(34,211,238,.18),transparent_30%)]" />}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-3 left-4 flex items-center gap-3"><Logo src={project.logoUrl} name={project.name} /><span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[7px] font-black uppercase tracking-wider text-violet-200 backdrop-blur">NFT</span></div>
    </div>
    <div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><h3 className="truncate font-black text-white">{project.name}</h3><span className="shrink-0 text-[9px] font-semibold text-zinc-600">View →</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{description}</p></div>
  </Link>;
}

function RaffleCard({ raffle }: { raffle: Raffle }) {
  const name = raffle.project?.name || raffle.title;
  return <Link href={`/raffles/${raffle.id}`} className="group min-w-0 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-500/40 sm:p-5"><div className="flex items-start gap-3"><Logo src={raffle.project?.logoUrl} name={name} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate font-black text-white">{name}</h3><span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[7px] font-black tracking-wider text-emerald-400">LIVE</span></div><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500">{raffle.prizeQuantity} × {raffle.prizeName}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4 text-[10px]"><div><div className="uppercase tracking-wider text-zinc-600">Entries</div><div className="mt-1 font-black text-white">{(raffle._count?.entries || 0).toLocaleString()}</div></div><div><div className="uppercase tracking-wider text-zinc-600">Ends in</div><div className="mt-1 font-black text-white">{remaining(raffle.endsAt)}</div></div></div><div className="mt-5 rounded-xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 px-4 py-2.5 text-center text-xs font-black text-violet-300 transition group-hover:from-violet-600 group-hover:to-fuchsia-600 group-hover:text-white">Enter Raffle</div></Link>;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => { let mounted = true; readHome().then((data) => { if (!mounted) return; setProjects(Array.isArray(data.projects) ? data.projects : []); setRaffles(Array.isArray(data.raffles) ? data.raffles : []); setApiError(false); }).catch(() => mounted && setApiError(true)).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, []);
  const active = useMemo(() => raffles.filter((raffle) => raffle.status === "ACTIVE"), [raffles]);

  return <main className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
    <section className="mx-auto w-full max-w-[1380px] px-5 pb-14 pt-24 sm:px-8 lg:px-10 lg:pb-20 lg:pt-28"><div className="grid items-center gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-12"><div className="min-w-0"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-[9px] font-black tracking-[.24em] text-violet-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" /> NFT RAFFLE ECOSYSTEM</div><h1 className="max-w-3xl text-5xl font-black leading-[.94] tracking-tight sm:text-6xl lg:text-7xl">Discover. Enter. <span className="text-violet-300">Win.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Raven Oracle is built for transparent NFT raffles — clear requirements, real entries and recorded winners.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/raffles" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200">Explore Raffles</Link><Link href="/projects/new" className="rounded-xl border border-white/10 bg-white/[.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[.08]">Create a Raffle</Link></div></div><OgShowcase /></div></section>

    <section className="mx-auto w-full max-w-[1380px] px-5 pb-16 sm:px-8 lg:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">NFT projects</p><h2 className="mt-2 text-3xl font-black">Projects on Raven Oracle</h2><p className="mt-2 text-sm text-zinc-500">Discover NFT projects featured on the platform.</p></div><Link href="/projects" className="text-sm font-semibold text-zinc-300 transition hover:text-white">View all →</Link></div>{apiError ? null : loading ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]" />)}</div> : projects.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center"><div className="font-semibold text-white">No NFT projects yet</div><p className="mt-2 text-sm text-zinc-500">Approved projects will appear here when they are published.</p><Link href="/projects" className="mt-5 inline-block text-sm font-semibold text-violet-300">Explore projects →</Link></div>}</section>

    <section className="mx-auto w-full max-w-[1380px] px-5 pb-20 sm:px-8 lg:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Live raffles</p><h2 className="mt-2 text-3xl font-black">Raffles you can enter</h2><p className="mt-2 text-sm text-zinc-500">Only live platform data is shown here.</p></div><Link href="/raffles" className="text-sm font-semibold text-zinc-300 transition hover:text-white">View all →</Link></div>{apiError ? <div className="mt-8 rounded-2xl border border-red-400/10 bg-red-400/[.04] p-6 text-sm text-zinc-400">Live platform data is temporarily unavailable.</div> : loading ? <div className="mt-8 grid gap-4 md:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]" />)}</div> : active.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{active.slice(0, 6).map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center"><div className="font-semibold text-white">No active raffles yet</div><p className="mt-2 text-sm text-zinc-500">Live raffles will appear here as soon as they are published.</p><Link href="/raffles" className="mt-5 inline-block text-sm font-semibold text-violet-300">Explore raffles →</Link></div>}</section>

    <section className="border-y border-white/[.06] bg-[#07070a]"><div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Safety</p><h2 className="mt-2 text-2xl font-black">Your wallet stays yours.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Raven Oracle does not ask for a seed phrase or private key, and you do not need to connect a wallet just to use the platform or enter a raffle.</p></div><div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3"><span className="rounded-xl border border-white/10 px-4 py-3">No seed phrases</span><span className="rounded-xl border border-white/10 px-4 py-3">No private keys</span><span className="rounded-xl border border-white/10 px-4 py-3">No wallet connect to enter</span></div></div></section>
  </main>;
}
