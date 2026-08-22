"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

async function readJson(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data;
}

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
  endsAt: string;
  status: string;
  project?: { name?: string | null; logoUrl?: string | null } | null;
};

const nftShowcase = [
  {
    name: "CryptoPunk",
    image: "https://www.larvalabs.com/cryptopunks/cryptopunk001.png",
    glow: "from-cyan-400/30 via-violet-500/20 to-transparent",
  },
  {
    name: "Bored Ape",
    image: "https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zgy0hjd2xKIgjJJtWIc0ybj4Vd7wv8t3pxDGHoJBzDB?w=700&auto=format",
    glow: "from-violet-500/30 via-fuchsia-500/20 to-transparent",
  },
  {
    name: "Azuki",
    image: "https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v-aI8din7WPk0Pgo3qQFhAUH-B6i-dCqqc_mCkRIzULmwzwecnohLhrcH8A9mpWIZqA7ygc52Sr81hE?w=700&auto=format",
    glow: "from-pink-500/25 via-purple-500/25 to-transparent",
  },
  {
    name: "Pudgy Penguins",
    image: "https://i.seadn.io/gcs/files/0f63c67e2d2a8fa5e05a2be1d80bf2de.webp?w=700&auto=format",
    glow: "from-blue-400/25 via-cyan-400/20 to-transparent",
  },
];

const chainLogos = [
  { name: "Ethereum", src: "https://cdn.simpleicons.org/ethereum/ffffff" },
  { name: "Solana", src: "https://cdn.simpleicons.org/solana/ffffff" },
  { name: "Robinhood", src: "https://cdn.simpleicons.org/robinhood/ffffff" },
];

export default function Home() {
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [nftIndex, setNftIndex] = useState(0);
  const [chainIndex, setChainIndex] = useState(0);
  const [tab, setTab] = useState<"trending" | "upcoming">("trending");

  useEffect(() => {
    void Promise.all([
      readJson("/projects/public").catch(() => readJson("/projects?status=APPROVED")),
      readJson("/raffles/public").catch(() => ({ raffles: [] })),
    ]).then(([projectData, raffleData]) => {
      setProjects(Array.isArray(projectData.projects) ? projectData.projects : []);
      setRaffles(Array.isArray(raffleData.raffles) ? raffleData.raffles : []);
    }).catch(() => {
      setProjects([]);
      setRaffles([]);
    });

    const nftTimer = window.setInterval(() => setNftIndex((value) => (value + 1) % nftShowcase.length), 4200);
    const chainTimer = window.setInterval(() => setChainIndex((value) => (value + 1) % chainLogos.length), 3000);
    return () => {
      window.clearInterval(nftTimer);
      window.clearInterval(chainTimer);
    };
  }, []);

  const trending = useMemo(() => projects.slice(0, 6), [projects]);
  const upcoming = useMemo(() => raffles.slice(0, 6), [raffles]);
  const nft = nftShowcase[nftIndex];
  const chain = chainLogos[chainIndex];
  const dark = theme === "dark";

  return (
    <main className={dark ? "min-h-screen overflow-hidden bg-[#07070b] text-white" : "min-h-screen overflow-hidden bg-[#f7f7fb] text-zinc-950"}>
      <style jsx global>{`
        @keyframes ravenFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-16px) rotate(2deg); } }
        @keyframes ravenSpin { from { transform: rotateY(0deg) rotateZ(-4deg); } to { transform: rotateY(360deg) rotateZ(4deg); } }
        @keyframes ravenOrbit { from { transform: rotate(0deg) translateX(22px) rotate(0deg); } to { transform: rotate(360deg) translateX(22px) rotate(-360deg); } }
        @keyframes ravenPulse { 0%,100% { opacity:.35; transform:scale(.9); } 50% { opacity:.7; transform:scale(1.08); } }
        @keyframes ravenFade { 0% { opacity:0; transform:scale(.94) translateY(8px); } 12%,78% { opacity:1; transform:scale(1) translateY(0); } 92%,100% { opacity:0; transform:scale(1.04) translateY(-8px); } }
        .raven-float { animation: ravenFloat 5s ease-in-out infinite; }
        .raven-spin { animation: ravenSpin 7s linear infinite; transform-style:preserve-3d; }
        .raven-orbit { animation: ravenOrbit 12s linear infinite; }
        .raven-pulse { animation: ravenPulse 4s ease-in-out infinite; }
        .raven-fade { animation: ravenFade 4.2s ease-in-out both; }
        @media (prefers-reduced-motion: reduce) { .raven-float,.raven-spin,.raven-orbit,.raven-pulse,.raven-fade { animation:none!important; } }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className={dark ? "absolute left-[8%] top-[10%] h-96 w-96 rounded-full bg-violet-600/10 blur-[130px]" : "absolute left-[8%] top-[10%] h-96 w-96 rounded-full bg-violet-400/20 blur-[130px]"} />
        <div className={dark ? "absolute right-[5%] top-[28%] h-[28rem] w-[28rem] rounded-full bg-cyan-500/5 blur-[150px]" : "absolute right-[5%] top-[28%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[150px]"} />
      </div>

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:px-10 lg:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10">
            <div className={dark ? "mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[10px] font-black tracking-[.24em] text-violet-300" : "mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-[10px] font-black tracking-[.24em] text-violet-700 shadow-sm"}>
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_12px_#a78bfa]" /> NFT RAFFLE ECOSYSTEM
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[.96] tracking-[-.055em] sm:text-6xl lg:text-7xl">
              The next generation of
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">NFT whitelists.</span>
            </h1>
            <p className={dark ? "mt-7 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg" : "mt-7 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg"}>
              Discover NFT projects, enter verified raffles, complete community tasks and earn whitelist spots through Raven Oracle.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/raffles" className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-violet-500/25 transition hover:-translate-y-0.5 hover:shadow-violet-500/40">Explore Raffles</Link>
              <Link href="/projects" className={dark ? "rounded-xl border border-white/10 bg-white/[.03] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/[.07]" : "rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"}>Explore Projects</Link>
            </div>
          </div>

          <div className="relative mx-auto h-[470px] w-full max-w-[520px] [perspective:1200px]">
            <div className="absolute inset-8 rounded-[42px] border border-violet-500/10 bg-gradient-to-br from-violet-500/[.08] via-transparent to-cyan-400/[.04] backdrop-blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`absolute h-72 w-72 rounded-full bg-gradient-to-br ${nft.glow} blur-3xl raven-pulse`} />
              <div className="raven-float relative z-20 h-72 w-72 overflow-hidden rounded-[38px] border border-white/15 bg-black/30 p-2 shadow-[0_30px_100px_rgba(124,58,237,.25)] sm:h-80 sm:w-80">
                <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-zinc-950">
                  <img key={nft.image} src={nft.image} alt="" className="raven-fade h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-5 left-5 text-xs font-black uppercase tracking-[.2em] text-white/80">{nft.name}</div>
                </div>
              </div>
            </div>

            {[0,1,2,3].map((i) => (
              <div key={i} className="raven-orbit absolute left-1/2 top-1/2 z-10 h-10 w-10 rounded-full border border-white/10 bg-white/[.04] shadow-xl backdrop-blur" style={{ animationDelay: `${i * -2.8}s`, transformOrigin: `${110 + i * 20}px` }}>
                <span className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-400/50 to-cyan-300/20" />
              </div>
            ))}

            <div className={dark ? "absolute bottom-4 left-4 z-30 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-xl" : "absolute bottom-4 left-4 z-30 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 shadow-xl backdrop-blur-xl"}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 p-2 shadow-lg shadow-violet-500/20 [perspective:500px]">
                <img key={chain.name} src={chain.src} alt="" className="raven-spin h-full w-full object-contain" />
              </div>
              <div>
                <div className={dark ? "text-[9px] font-black tracking-[.2em] text-zinc-500" : "text-[9px] font-black tracking-[.2em] text-zinc-500"}>ECOSYSTEM</div>
                <div className="mt-0.5 text-sm font-black">{chain.name}</div>
              </div>
            </div>

            <div className="absolute right-4 top-12 z-30 h-20 w-20 rounded-3xl border border-violet-400/20 bg-violet-500/[.06] backdrop-blur-xl raven-float" style={{ animationDelay: "-2s" }}>
              <div className="absolute inset-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent" />
              <div className="absolute inset-0 grid place-items-center text-xl font-black text-violet-300">✦</div>
            </div>
          </div>
        </div>
      </section>

      <section className={dark ? "border-y border-white/[.06] bg-white/[.02]" : "border-y border-zinc-200 bg-white/70"}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-5 px-5 py-5 text-[10px] font-black tracking-[.2em] text-zinc-500 sm:justify-between sm:px-8">
          <span>VERIFIED PROJECTS</span><span>FAIR RAFFLES</span><span>DISCORD VERIFIED</span><span>X VERIFIED</span><span>EVM + SOLANA</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><div className="text-[10px] font-black tracking-[.24em] text-violet-400">DISCOVER</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">NFT Projects</h2></div>
          <Link href="/projects" className="text-xs font-black text-violet-400 hover:text-violet-300">View all →</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trending.length === 0 ? <div className={dark ? "col-span-full rounded-2xl border border-white/10 bg-white/[.02] py-16 text-center text-sm text-zinc-500" : "col-span-full rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500"}>No approved NFT projects yet.</div> : trending.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className={dark ? "group rounded-2xl border border-white/[.08] bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-violet-500/40 hover:bg-white/[.04]" : "group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-xl"}>
              <div className="flex items-center gap-4"><div className="h-14 w-14 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-cyan-400/10">{p.logoUrl ? <img src={p.logoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl font-black text-violet-300">{p.name[0]}</div>}</div><div className="min-w-0"><h3 className="truncate font-black group-hover:text-violet-300">{p.name}</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{p.category || "NFT"} · VERIFIED</p></div></div>
              <p className="mt-5 line-clamp-2 text-sm leading-6 text-zinc-500">{p.description || "Explore this NFT project and its upcoming whitelist raffles."}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-4 text-xs font-bold text-zinc-500"><span>Explore</span><span className="text-violet-400 transition group-hover:translate-x-1">→</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={dark ? "mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-10" : "mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-10"}>
        <div className="mb-8 flex items-end justify-between gap-4"><div><div className="text-[10px] font-black tracking-[.24em] text-cyan-400">RAFFLES</div><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">What&apos;s happening</h2></div><div className="flex gap-2"><button onClick={() => setTab("trending")} className={`rounded-lg px-4 py-2 text-[10px] font-black ${tab === "trending" ? "bg-violet-500 text-white" : "border border-white/10 text-zinc-500"}`}>TRENDING</button><button onClick={() => setTab("upcoming")} className={`rounded-lg px-4 py-2 text-[10px] font-black ${tab === "upcoming" ? "bg-violet-500 text-white" : "border border-white/10 text-zinc-500"}`}>UPCOMING</button></div></div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(tab === "trending" ? raffles : upcoming).slice(0, 6).map((raffle) => (
            <Link key={raffle.id} href={`/raffles/${raffle.id}`} className={dark ? "group rounded-2xl border border-white/[.08] bg-gradient-to-br from-white/[.04] to-white/[.015] p-5 transition hover:-translate-y-1 hover:border-violet-500/40" : "group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-xl"}>
              <div className="flex items-center gap-3"><div className="h-11 w-11 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/10">{raffle.project?.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center font-black text-violet-300">R</div>}</div><div className="min-w-0"><h3 className="truncate font-black">{raffle.title}</h3><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">{raffle.project?.name || "Raven Oracle"}</p></div></div>
              <div className="mt-5 flex items-end justify-between"><div><div className="text-[9px] font-black tracking-wider text-zinc-500">PRIZE</div><div className="mt-1 text-sm font-black">{raffle.prizeName}</div></div><div className="text-right"><div className="text-[9px] font-black tracking-wider text-zinc-500">STATUS</div><div className="mt-1 text-xs font-black text-emerald-400">{raffle.status}</div></div></div>
            </Link>
          ))}
          {(tab === "trending" ? raffles : upcoming).length === 0 && <div className={dark ? "col-span-full rounded-2xl border border-white/10 py-16 text-center text-sm text-zinc-500" : "col-span-full rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500"}>No raffles available yet.</div>}
        </div>
      </section>
    </main>
  );
}
