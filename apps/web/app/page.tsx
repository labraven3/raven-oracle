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
  sources: string[];
  tone: string;
  subtitle: string;
};

type Ecosystem = { name: string; logo: string; fallbackLogo?: string; color: string; fallback: string };

// Use stable, real artwork URLs instead of the older SeaDN/IPFS links that were
// intermittently returning broken images in production.
const COLLECTIONS: Collection[] = [
  {
    name: "CryptoPunks",
    chain: "Ethereum",
    sources: [
      "https://cryptopunks.app/api/punks/2008/image",
      "https://coin-images.coingecko.com/nft_contracts/images/270/small_2x/cryptopunks.png?1707287245",
    ],
    tone: "from-cyan-300 via-sky-500 to-indigo-700",
    subtitle: "10,000 pixel legends",
  },
  {
    name: "Bored Ape Yacht Club",
    chain: "Ethereum",
    sources: [
      "https://coinspot-nfts.s3-ap-southeast-2.amazonaws.com/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/400px/1722.png",
      "https://coin-images.coingecko.com/nft_contracts/images/20/small_2x/bored-ape-yacht-club.png?1707287177",
    ],
    tone: "from-amber-300 via-orange-500 to-red-700",
    subtitle: "10,000 iconic apes",
  },
  {
    name: "Pudgy Penguins",
    chain: "Ethereum",
    sources: [
      "https://www.coinrank.io/wp-content/uploads/2024/12/Pudgy-Penguins-NFT-1.webp",
      "https://coin-images.coingecko.com/nft_contracts/images/38/small_2x/pudgy.jpg?1730778323",
    ],
    tone: "from-sky-200 via-cyan-400 to-blue-700",
    subtitle: "8,888 penguins",
  },
  {
    name: "Azuki",
    chain: "Ethereum",
    sources: [
      "https://azk.imgix.net/big_azukis/a-3309.png?w=1200&h=1200&fit=crop",
      "https://azk.imgix.net/big_azukis/a-253.png?w=1200&h=1200&fit=crop",
    ],
    tone: "from-rose-300 via-fuchsia-500 to-violet-700",
    subtitle: "10,000 anime-inspired NFTs",
  },
];

const ECOSYSTEMS: Ecosystem[] = [
  { name: "Bitcoin", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/bitcoin.svg", fallbackLogo: "https://cdn.simpleicons.org/bitcoin/F7931A", color: "#F7931A", fallback: "BTC" },
  { name: "Sui", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/sui.svg", fallbackLogo: "https://cdn.simpleicons.org/sui/6FBCF0", color: "#6FBCF0", fallback: "SUI" },
  { name: "Solana", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/solana.svg", fallbackLogo: "https://cdn.simpleicons.org/solana/14F195", color: "#14F195", fallback: "SOL" },
  { name: "Ethereum", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/ethereum.svg", fallbackLogo: "https://cdn.simpleicons.org/ethereum/627EEA", color: "#627EEA", fallback: "ETH" },
  { name: "Robinhood Chain", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/robinhood.svg", fallbackLogo: "https://cdn.simpleicons.org/robinhood/CCFF00", color: "#CCFF00", fallback: "RH" },
  { name: "Ink", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/ink.svg", fallbackLogo: "https://cdn.simpleicons.org/ink/7B61FF", color: "#7B61FF", fallback: "INK" },
  { name: "Arc", logo: "https://cms-images.arc.xyz/arc-logomark-white.svg", fallbackLogo: "https://cdn.simpleicons.org/arc/FFFFFF", color: "#FFFFFF", fallback: "ARC" },
  { name: "Monad", logo: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/monad.svg", fallbackLogo: "https://cdn.simpleicons.org/monad/6E54FF", color: "#6E54FF", fallback: "MON" },
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
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[.04]">
      {src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : <span className="font-black text-violet-300">{name.slice(0, 1).toUpperCase()}</span>}
    </div>
  );
}

function CollectionVisual({ collection }: { collection: Collection }) {
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [collection.name]);

  const rawSource = collection.sources[sourceIndex];

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[25px] bg-gradient-to-br ${collection.tone}`}>
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full bg-violet-950/35 blur-3xl" />
      <div className="absolute inset-2.5 rounded-[22px] border border-white/20 bg-black/10" />

      <div className="absolute inset-0 flex items-center justify-center pb-5 pt-3 sm:pb-7 sm:pt-5">
        <div className="relative h-[62%] w-[62%] overflow-hidden rounded-[25px] border border-white/25 bg-black/20 shadow-[0_22px_55px_rgba(0,0,0,.42)] backdrop-blur-[2px] sm:h-[66%] sm:w-[66%]">
          <img
            key={rawSource}
            src={rawSource}
            alt={collection.name}
            referrerPolicy="no-referrer"
            onError={() => setSourceIndex((value) => value + 1 < collection.sources.length ? value + 1 : value)}
            className="h-full w-full object-cover transition-transform duration-1000 ease-out"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
          <div className="pointer-events-none absolute left-3 top-3 h-2 w-2 rounded-full bg-white/60 shadow-[0_0_12px_rgba(255,255,255,.7)]" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-3 sm:bottom-5 sm:left-5 sm:right-5">
        <div>
          <div className="text-[7px] font-black uppercase tracking-[.22em] text-white/65 sm:text-[8px]">{collection.chain}</div>
          <div className="mt-0.5 text-sm font-black text-white sm:text-base">{collection.name}</div>
        </div>
        <div className="rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[7px] font-black uppercase tracking-[.15em] text-white/80 backdrop-blur sm:text-[8px]">OG</div>
      </div>
    </div>
  );
}

function EcosystemLogo({ ecosystem }: { ecosystem: Ecosystem }) {
  // The jsDelivr Simple Icons files are monochrome by default, which made the
  // ecosystem logos appear black. Start with the colored Simple Icons endpoint,
  // then fall back to the original logo URL, then to the text mark.
  const sources = [ecosystem.fallbackLogo, ecosystem.logo].filter(Boolean) as string[];
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [ecosystem.name, ecosystem.logo, ecosystem.fallbackLogo]);

  if (sourceIndex >= sources.length) {
    return <span className="text-[8px] font-black" style={{ color: ecosystem.color }}>{ecosystem.fallback}</span>;
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt={ecosystem.name}
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((value) => value + 1)}
      className="h-full w-full object-contain"
    />
  );
}

function OgShowcase() {
  const [index, setIndex] = useState(0);
  const [ecoIndex, setEcoIndex] = useState(0);
  const collection = COLLECTIONS[index];
  const ecosystem = ECOSYSTEMS[ecoIndex];

  useEffect(() => {
    const collectionTimer = window.setInterval(() => setIndex((value) => (value + 1) % COLLECTIONS.length), 5000);
    const ecosystemTimer = window.setInterval(() => setEcoIndex((value) => (value + 1) % ECOSYSTEMS.length), 3000);
    return () => { window.clearInterval(collectionTimer); window.clearInterval(ecosystemTimer); };
  }, []);

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-violet-400/15 bg-[#08070e] shadow-2xl shadow-violet-950/20 sm:min-h-[470px]">
      <style jsx>{`@keyframes ravenOgIn { from { opacity: 0; transform: translateY(18px) scale(.94) rotate(-2deg); } to { opacity: 1; transform: translateY(0) scale(1) rotate(-2deg); } } @keyframes ravenOgFloat { 0%,100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(-2deg) translateY(-7px); } }`}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(124,58,237,.34),transparent_38%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,.14),transparent_25%),radial-gradient(circle_at_8%_85%,rgba(236,72,153,.12),transparent_25%)]" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[100px]" />

      <div className="absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[8px] font-black tracking-[.2em] text-violet-200 backdrop-blur-xl">OG COLLECTIONS</div>
      <div className="absolute right-5 top-5 z-20 flex gap-1.5">{COLLECTIONS.map((item, i) => <button aria-label={`Show ${item.name}`} key={item.name} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-1.5 bg-white/30"}`} />)}</div>

      <div className="absolute inset-x-0 top-[50px] flex justify-center sm:top-[58px]">
        <div key={collection.name} className="relative h-[250px] w-[250px] rounded-[32px] border border-white/20 bg-gradient-to-br from-white/10 to-white/[.02] p-2.5 shadow-[0_0_90px_rgba(139,92,246,.32)] sm:h-[330px] sm:w-[330px] sm:p-3.5" style={{ animation: "ravenOgIn .75s cubic-bezier(.22,.8,.22,1) both, ravenOgFloat 5s ease-in-out 1s infinite" }}>
          <CollectionVisual collection={collection} />
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3 sm:bottom-6 sm:left-6 sm:right-6">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/40 p-2 shadow-lg" style={{ boxShadow: `0 0 24px ${ecosystem.color}55` }}><EcosystemLogo ecosystem={ecosystem} /></div>
          <div><div className="text-[7px] font-black tracking-[.2em] text-zinc-500">ECOSYSTEM</div><div className="text-xs font-black text-white">{ecosystem.name}</div></div>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[8px] font-black uppercase tracking-[.18em] text-zinc-400 backdrop-blur sm:block">{collection.subtitle}</div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const metadata = project.metadata ?? {};
  const mintDate = metadata.mintDate ? new Date(metadata.mintDate).toLocaleDateString() : "Not set";
  return <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] transition duration-300 hover:-translate-y-1 hover:border-violet-500/40"><div className="relative h-36 overflow-hidden border-b border-white/[.06] bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-cyan-400/10">{project.bannerUrl ? <img src={project.bannerUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(34,211,238,.18),transparent_30%)] />}<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" /><div className="absolute bottom-3 left-4"><Logo src={project.logoUrl} name={project.name} /></div></div><div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-black text-white">{project.name}</h3><p className="mt-1 text-xs text-zinc-500">{metadata.standard ?? "NFT Project"}</p></div><span className="text-xs text-zinc-400">View →</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><div><div className="text-zinc-500">Supply</div><div className="mt-1 font-bold text-zinc-200">{metadata.supply ?? "Not set"}</div></div><div><div className="text-zinc-500">Mint date</div><div className="mt-1 font-bold text-zinc-200">{mintDate}</div></div><div><div className="text-zinc-500">Mint price</div><div className="mt-1 font-bold text-zinc-200">{metadata.mintPrice ?? "Not set"}</div></div></div></div></Link>;
}

export default function HomePage() {
  const [data, setData] = useState<{ projects: Project[]; raffles: Raffle[] }>({ projects: [], raffles: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await readHome();
        if (active) { setData({ projects: next.projects ?? [], raffles: next.raffles ?? [] }); setError(""); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load live data");
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const activeRaffles = useMemo(() => data.raffles.filter((raffle) => raffle.status === "PUBLISHED"), [data.raffles]);

  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="max-w-4xl"><h1 className="text-5xl font-black tracking-[-.04em] sm:text-7xl">Discover. Enter. <span className="text-violet-300">Win.</span></h1><p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">Raven Oracle is built for transparent NFT raffles — clear requirements, real entries and recorded winners.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/raffles" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">Explore Raffles</Link><Link href="/projects" className="rounded-xl border border-white/10 bg-white/[.03] px-5 py-3 text-sm font-bold text-white">NFT Projects</Link></div></div>
        <div className="mt-10"><OgShowcase /></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="mb-7 flex items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.25em] text-violet-300">NFT PROJECTS</div><h2 className="mt-2 text-3xl font-black sm:text-4xl">Projects on Raven Oracle</h2></div><Link href="/projects" className="text-sm font-bold text-zinc-300">View all →</Link></div>{data.projects.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-zinc-500">No NFT projects yet.</div>}</section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="mb-7 flex items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.25em] text-violet-300">LIVE RAFFLES</div><h2 className="mt-2 text-3xl font-black sm:text-4xl">Raffles you can enter</h2></div><Link href="/raffles" className="text-sm font-bold text-zinc-300">View all →</Link></div>{activeRaffles.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{activeRaffles.map((raffle) => <Link key={raffle.id} href={`/raffles/${raffle.id}`} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="text-xs text-violet-300">LIVE</div><h3 className="mt-2 text-lg font-black">{raffle.title}</h3><p className="mt-1 text-sm text-zinc-400">{raffle.prizeName} × {raffle.prizeQuantity}</p><div className="mt-5 text-xs text-zinc-500">Ends in {remaining(raffle.endsAt)}</div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-zinc-500">No active raffles yet.</div>}</section>

      {error ? <div className="mx-auto max-w-7xl px-4 pb-10 text-xs text-amber-300 sm:px-6">Live data: {error}</div> : null}
    </main>
  );
}
