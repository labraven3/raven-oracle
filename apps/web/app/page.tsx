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
  logoUrl?: string | null;
  bannerUrl?: string | null;
  metadata?: { supply?: number; mintDate?: string; mintPrice?: string; standard?: string } | null;
};

type Collection = {
  name: string;
  chain: string;
  image: string;
  fallback?: string;
  tone: string;
  subtitle: string;
  crop?: boolean;
};

type Ecosystem = { name: string; logo: string; color: string; fallback: string };

const COLLECTIONS: Collection[] = [
  { name: "CryptoPunks", chain: "Ethereum", image: "https://raw.githubusercontent.com/larvalabs/cryptopunks/master/punks.png", tone: "from-cyan-300 via-sky-500 to-indigo-700", subtitle: "10,000 pixel legends", crop: true },
  { name: "Bored Ape Yacht Club", chain: "Ethereum", image: "https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zgy0hjd2xKIgjJJtWIc0ybj4Vd7wv8t3pxDGHoJBzDB?w=1000&auto=format", fallback: "https://boredapeyachtclub.com/favicon.ico", tone: "from-amber-300 via-orange-500 to-red-700", subtitle: "10,000 iconic apes" },
  { name: "Pudgy Penguins", chain: "Ethereum", image: "https://i.seadn.io/gae/yNi-XdGxsgQCPpqSio4o31ygAV6wURdIdInWRcFIl46UjUQ1eV7BEndGe8L661OoG-clRi7EgInLX4LPu9Jfw4fq0bnVYHqg7RFi?w=1000&auto=format", fallback: "https://www.pudgypenguins.com/favicon.ico", tone: "from-sky-200 via-cyan-400 to-blue-700", subtitle: "8,888 penguins" },
  { name: "Azuki", chain: "Ethereum", image: "https://i.seadn.io/gae/K_yvd5xs6EXWL26mRm6-TORZeG_YTGVDh8h5Yok0RQdkKyOA8Mp1CKt2Y7QK3t-h6ZEGayO8HcVlWHHUj1K-tkaN_tI4p1e-YIMz?w=1000&auto=format", fallback: "https://www.azuki.com/favicon.ico", tone: "from-rose-300 via-fuchsia-500 to-violet-700", subtitle: "10,000 anime-inspired NFTs" },
];

const ECOSYSTEMS: Ecosystem[] = [
  { name: "Ethereum", logo: "https://cdn.simpleicons.org/ethereum/627EEA", color: "#627EEA", fallback: "ETH" },
  { name: "Solana", logo: "https://cdn.simpleicons.org/solana/14F195", color: "#14F195", fallback: "SOL" },
  { name: "Bitcoin", logo: "https://cdn.simpleicons.org/bitcoin/F7931A", color: "#F7931A", fallback: "BTC" },
  { name: "Polygon", logo: "https://cdn.simpleicons.org/polygon/8247E5", color: "#8247E5", fallback: "POL" },
  { name: "Base", logo: "https://raw.githubusercontent.com/base/brand-kit/main/logo/Basemark/Digital/Base_basemark_blue.svg", color: "#0052FF", fallback: "BASE" },
];

async function readHome() {
  const response = await fetch(`${API_BASE_URL}/home`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Unable to load live data");
  return data as { projects?: Project[]; raffles?: Raffle[] };
}

function remaining(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function Logo({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[.04]">{src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : <span className="font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</span>}</div>;
}

function CollectionVisual({ collection }: { collection: Collection }) {
  const [src, setSrc] = useState(collection.image);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(collection.image); setFailed(false); }, [collection.image]);

  return <div className={`relative h-full w-full overflow-hidden rounded-[28px] bg-gradient-to-br ${collection.tone}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.22),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(0,0,0,.38),transparent_35%)]" />
    <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
    <div className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-black/35 blur-3xl" />
    <div className="absolute inset-4 rounded-[23px] border border-white/25 bg-black/10" />

    {collection.crop && !failed ? <div className="absolute inset-0 grid place-items-center overflow-hidden"><div className="h-[58%] w-[58%] animate-[float_5s_ease-in-out_infinite] rounded-[28px] border border-white/20 bg-[#111] shadow-[0_25px_80px_rgba(0,0,0,.45)]" style={{ backgroundImage: `url(${src})`, backgroundRepeat: "no-repeat", backgroundSize: "1000% 1000%", backgroundPosition: "0% 0%", imageRendering: "pixelated" }} /></div> : <div className="absolute inset-7 flex items-center justify-center overflow-hidden rounded-[24px]"><img key={src} src={src} alt={collection.name} referrerPolicy="no-referrer" onError={() => collection.fallback ? setSrc(collection.fallback) : setFailed(true)} className="h-full w-full object-contain drop-shadow-[0_28px_55px_rgba(0,0,0,.45)] transition duration-700 animate-[float_5s_ease-in-out_infinite]" /></div>}

    <div className="absolute left-6 top-6 rounded-full border border-white/20 bg-black/35 px-3 py-2 text-[8px] font-black uppercase tracking-[.2em] text-white/80 backdrop-blur-xl">OG COLLECTION</div>
    <div className="absolute right-6 top-6 h-2 w-2 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,.9)] animate-pulse" />
    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 sm:bottom-7 sm:left-7 sm:right-7"><div><div className="text-[8px] font-black uppercase tracking-[.22em] text-white/65">{collection.chain}</div><div className="mt-1 text-xl font-black text-white sm:text-2xl">{collection.name}</div></div><div className="rounded-full border border-white/20 bg-black/35 px-3 py-2 text-[8px] font-black uppercase tracking-[.16em] text-white/75 backdrop-blur">{collection.subtitle}</div></div>
  </div>;
}

function OgShowcase() {
  const [index, setIndex] = useState(0);
  const [ecoIndex, setEcoIndex] = useState(0);
  const collection = COLLECTIONS[index];
  const ecosystem = ECOSYSTEMS[ecoIndex];

  useEffect(() => {
    const collectionTimer = window.setInterval(() => setIndex((value) => (value + 1) % COLLECTIONS.length), 4200);
    const ecosystemTimer = window.setInterval(() => setEcoIndex((value) => (value + 1) % ECOSYSTEMS.length), 2800);
    return () => { window.clearInterval(collectionTimer); window.clearInterval(ecosystemTimer); };
  }, []);

  return <div className="relative min-h-[430px] overflow-hidden rounded-[32px] border border-violet-400/15 bg-[#08070e] shadow-2xl shadow-violet-950/20 sm:min-h-[560px]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,.32),transparent_40%),radial-gradient(circle_at_90%_15%,rgba(34,211,238,.14),transparent_28%),radial-gradient(circle_at_5%_90%,rgba(236,72,153,.13),transparent_28%)]" />
    <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[110px]" />
    <div className="absolute inset-5 rounded-[27px] border border-white/[.06]" />
    <div className="absolute left-7 top-7 z-20 rounded-full border border-white/10 bg-black/35 px-4 py-2.5 text-[8px] font-black tracking-[.2em] text-violet-200 backdrop-blur-xl">OG COLLECTIONS</div>
    <div className="absolute right-7 top-8 z-20 flex gap-1.5">{COLLECTIONS.map((item, i) => <button aria-label={`Show ${item.name}`} key={item.name} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-1.5 bg-white/30"}`} />)}</div>
    <div key={collection.name} className="absolute inset-x-8 top-[70px] bottom-[84px] animate-[fadeIn_.7s_ease-out]"><div className="h-full w-full rotate-[-2deg] rounded-[36px] border border-white/15 bg-gradient-to-br from-white/10 to-white/[.015] p-3 shadow-[0_0_110px_rgba(139,92,246,.25)] sm:p-5"><CollectionVisual collection={collection} /></div></div>
    <div className="absolute bottom-7 left-7 right-7 z-20 flex items-center justify-between gap-4"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-black/45 p-2 shadow-lg" style={{ boxShadow: `0 0 28px ${ecosystem.color}55` }}><img src={ecosystem.logo} alt={ecosystem.name} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} className="h-full w-full object-contain" /></div><div><div className="text-[7px] font-black tracking-[.2em] text-zinc-500">ECOSYSTEM</div><div className="text-xs font-black text-white">{ecosystem.name}</div></div></div><div className="hidden rounded-full border border-white/10 bg-black/45 px-4 py-2.5 text-[8px] font-black uppercase tracking-[.18em] text-zinc-400 backdrop-blur sm:block">{collection.chain} · OG</div></div>
  </div>;
}

function ProjectCard({ project }: { project: Project }) {
  const metadata = project.metadata ?? {};
  const mintDate = metadata.mintDate ? new Date(metadata.mintDate).toLocaleDateString() : "Not set";
  return <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] transition duration-300 hover:-translate-y-1 hover:border-violet-500/40"><div className="relative h-36 overflow-hidden border-b border-white/[.06] bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-cyan-400/10">{project.bannerUrl ? <img src={project.bannerUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(34,211,238,.18),transparent_30%)]" />}<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" /><div className="absolute bottom-3 left-4"><Logo src={project.logoUrl} name={project.name} /></div></div><div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><h3 className="truncate font-black text-white">{project.name}</h3><span className="shrink-0 text-[9px] font-semibold text-zinc-600">View →</span></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[.06] pt-4 text-[10px]"><div><div className="text-zinc-600">Supply</div><div className="mt-1 font-black text-zinc-200">{metadata.supply?.toLocaleString() ?? "Not set"}</div></div><div><div className="text-zinc-600">Mint date</div><div className="mt-1 font-black text-zinc-200">{mintDate}</div></div><div><div className="text-zinc-600">Mint price</div><div className="mt-1 font-black text-zinc-200">{metadata.mintPrice || "Not set"}</div></div></div></div></Link>;
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

  useEffect(() => {
    let mounted = true;
    const load = () => readHome().then((data) => { if (!mounted) return; setProjects(Array.isArray(data.projects) ? data.projects : []); setRaffles(Array.isArray(data.raffles) ? data.raffles : []); setApiError(false); }).catch(() => mounted && setApiError(true)).finally(() => mounted && setLoading(false));
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const active = useMemo(() => raffles.filter((raffle) => raffle.status === "ACTIVE"), [raffles]);

  return <main className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
    <section className="mx-auto w-full max-w-[1380px] px-5 pb-14 pt-24 sm:px-8 lg:px-10 lg:pb-20 lg:pt-28"><div className="grid items-center gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-12"><div className="min-w-0"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-[9px] font-black tracking-[.24em] text-violet-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" /> NFT RAFFLE ECOSYSTEM</div><h1 className="max-w-3xl text-5xl font-black leading-[.94] tracking-tight sm:text-6xl lg:text-7xl">Discover. Enter. <span className="text-violet-300">Win.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Raven Oracle is built for transparent NFT raffles — clear requirements, real entries and recorded winners.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/raffles" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200">Explore Raffles</Link><Link href="/projects" className="rounded-xl border border-white/10 bg-white/[.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[.08]">NFT Projects</Link></div></div><OgShowcase /></div></section>

    <section className="mx-auto w-full max-w-[1380px] px-5 pb-20 sm:px-8 lg:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">NFT Projects</p><h2 className="mt-2 text-3xl font-black">Projects on Raven Oracle</h2></div><Link href="/projects" className="text-sm font-semibold text-zinc-300 transition hover:text-white">View all →</Link></div>{loading ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]" />)}</div> : projects.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center"><div className="font-semibold text-white">No NFT projects yet</div><p className="mt-2 text-sm text-zinc-500">Featured projects will appear here when they are published.</p><Link href="/projects" className="mt-5 inline-block text-sm font-semibold text-violet-300">Explore projects →</Link></div>}</section>

    <section className="mx-auto w-full max-w-[1380px] px-5 pb-20 sm:px-8 lg:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Live Raffles</p><h2 className="mt-2 text-3xl font-black">Raffles you can enter</h2></div><Link href="/raffles" className="text-sm font-semibold text-zinc-300 transition hover:text-white">View all →</Link></div>{apiError ? <div className="mt-8 rounded-2xl border border-red-400/10 bg-red-400/[.04] p-6 text-sm text-zinc-400">Live platform data is temporarily unavailable.</div> : loading ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.02]" />)}</div> : active.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{active.slice(0, 6).map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center"><div className="font-semibold text-white">No active raffles yet</div><p className="mt-2 text-sm text-zinc-500">Live raffles will appear here as soon as they are published.</p><Link href="/raffles" className="mt-5 inline-block text-sm font-semibold text-violet-300">Explore raffles →</Link></div>}</section>

    <section className="border-y border-white/[.06] bg-[#07070a]"><div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Safety</p><h2 className="mt-2 text-2xl font-black">Your wallet stays yours.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Raven Oracle does not ask for a seed phrase or private key, and no wallet connection is needed to use the platform or enter a raffle.</p></div><div className="rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-zinc-400">No wallet connection needed</div></div></section>
  </main>;
}
