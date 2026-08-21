"use client";

import { useEffect, useState } from "react";
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
  status?: string | null;
};

type Raffle = {
  id: string;
  title: string;
  prizeName: string;
  endsAt: string;
  status: string;
  project?: { name?: string | null; logoUrl?: string | null } | null;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tab, setTab] = useState<"upcoming" | "trending">("trending");
  const [heroVisible, setHeroVisible] = useState(true);
  const [iconIndex, setIconIndex] = useState(0);
  const [heroSettings, setHeroSettings] = useState<any>(null);
  const { theme, toggleTheme } = useTheme();

  const iconSets = [
    ["🎨", "💎", "🎮", "⛓️"],
    ["🚀", "🌟", "🎯", "💰"],
    ["🔥", "⚡", "🌈", "🎭"],
    ["🏆", "👑", "💫", "🎪"],
  ];

  useEffect(() => {
    const loadHome = async () => {
      try {
        const projectData = await readJson("/projects/public").catch(() => readJson("/projects?status=APPROVED"));
        const raffleData = await readJson("/raffles/public").catch(() => ({ raffles: [] }));
        setProjects(Array.isArray(projectData.projects) ? projectData.projects : []);
        setRaffles(Array.isArray(raffleData.raffles) ? raffleData.raffles : []);
      } catch {
        setProjects([]);
        setRaffles([]);
      }
    };

    void loadHome();

    const savedSettings = localStorage.getItem("hero_settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setHeroSettings(parsed);
      } catch {}
    }

    const iconInterval = setInterval(() => setIconIndex((prev) => (prev + 1) % 4), 3000);
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 300) setHeroVisible(true);
      else if (currentScrollY > lastScrollY) setHeroVisible(false);
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearInterval(iconInterval);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const trending = projects.slice(0, 6);
  const upcoming = raffles.slice(0, 6);
  const currentIcons = iconSets[iconIndex];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === "dark" ? "bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white" : "bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900"}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className={`absolute top-20 left-10 w-64 h-64 rounded-full blur-[120px] animate-pulse ${theme === "dark" ? "bg-violet-500/20" : "bg-violet-500/30"}`} />
        <div className={`absolute bottom-40 right-20 w-96 h-96 rounded-full blur-[140px] animate-pulse delay-1000 ${theme === "dark" ? "bg-blue-500/10" : "bg-blue-500/20"}`} />
        <div className={`absolute top-1/2 left-1/2 w-80 h-80 rounded-full blur-[100px] animate-pulse delay-500 ${theme === "dark" ? "bg-purple-500/10" : "bg-purple-500/20"}`} />
      </div>

      <div className="h-[72px]" />

      <section className={`relative overflow-hidden transition-all duration-1000 ease-in-out ${heroVisible ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`} style={{ height: heroVisible ? "600px" : "0px" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={`absolute ${index === 0 ? "top-20 left-20 w-32 h-32" : index === 1 ? "top-40 right-32 w-40 h-40" : index === 2 ? "bottom-32 left-40 w-36 h-36" : "bottom-20 right-20 w-28 h-28"}`}>
              <div className="w-full h-full rounded-2xl border border-violet-500/20 bg-violet-500/10 backdrop-blur-sm shadow-2xl overflow-hidden flex items-center justify-center text-4xl">
                {currentIcons[index]}
              </div>
            </div>
          ))}
          <div className="relative z-30 text-center px-6">
            <div className={`inline-block mb-6 px-4 py-2 rounded-full text-xs font-black tracking-[.2em] ${theme === "dark" ? "bg-violet-500/10 border border-violet-500/30 text-violet-300" : "bg-violet-500/20 border border-violet-500/40 text-violet-600"}`}>WEB3 NFT RAFFLE PLATFORM</div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: heroSettings ? `linear-gradient(to right, ${heroSettings.gradient1Color1}, ${heroSettings.gradient1Color2}, ${heroSettings.gradient1Color3})` : "linear-gradient(to right, #a78bfa, #c084fc, #f0abfc)" }}>{heroSettings?.tagline1 || "The Future of"}</span>
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: heroSettings ? `linear-gradient(to right, ${heroSettings.gradient2Color1}, ${heroSettings.gradient2Color2}, ${heroSettings.gradient2Color3})` : "linear-gradient(to right, #60a5fa, #67e8f9, #a78bfa)" }}>{heroSettings?.tagline2 || "NFT Whitelists"}</span>
            </h1>
            <p className={`text-xl max-w-2xl mx-auto mb-10 leading-relaxed ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>Join verified NFT communities, complete tasks, and win whitelist spots through provably fair raffles powered by blockchain technology.</p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/raffles" className="px-8 py-4 text-sm font-black bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl shadow-2xl shadow-violet-500/50 hover:shadow-violet-500/70 transition-all text-white">Explore Raffles</Link>
              <Link href="/projects/new" className={`px-8 py-4 text-sm font-bold rounded-xl transition-all ${theme === "dark" ? "border border-white/20 hover:bg-white/5" : "border border-gray-300 hover:bg-gray-100"}`}>Launch Project</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="text-xs font-black tracking-[.2em] text-violet-400 mb-2">DISCOVER</div>
            <h2 className={`text-4xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Featured NFT Projects</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab("trending")} className={`px-6 py-3 text-xs font-black rounded-lg transition-all ${tab === "trending" ? "bg-violet-500 text-white shadow-lg shadow-violet-500/50" : theme === "dark" ? "border border-white/10 text-zinc-400 hover:border-white/20" : "border border-gray-300 text-gray-600 hover:border-gray-400"}`}>🔥 TRENDING</button>
            <button onClick={() => setTab("upcoming")} className={`px-6 py-3 text-xs font-black rounded-lg transition-all ${tab === "upcoming" ? "bg-violet-500 text-white shadow-lg shadow-violet-500/50" : theme === "dark" ? "border border-white/10 text-zinc-400 hover:border-white/20" : "border border-gray-300 text-gray-600 hover:border-gray-400"}`}>🚀 UPCOMING</button>
          </div>
        </div>

        {tab === "trending" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.length === 0 ? (
              <div className={`col-span-full text-center py-20 ${theme === "dark" ? "text-zinc-600" : "text-gray-400"}`}>No approved projects yet.</div>
            ) : (
              trending.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className={`group relative rounded-2xl border p-6 transition-all hover:shadow-2xl ${theme === "dark" ? "border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-violet-500/50 hover:shadow-violet-500/20" : "border-gray-200 bg-white hover:border-violet-500/50 hover:shadow-violet-500/20"}`}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center overflow-hidden">
                      {p.logoUrl ? <img src={p.logoUrl} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-black text-violet-300">{p.name[0]}</span>}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-lg mb-1 group-hover:text-violet-300 transition-colors">{p.name}</h3>
                      <span className={`text-xs font-bold ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{p.category || "NFT"} · VERIFIED</span>
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed line-clamp-2 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{p.description || "Explore this NFT project and upcoming raffles."}</p>
                  <div className={`mt-4 pt-4 border-t flex items-center justify-between text-xs ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}>
                    <span className={theme === "dark" ? "text-zinc-500" : "text-gray-500"}>View Project</span>
                    <span className="text-violet-400 font-black group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {tab === "upcoming" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.length === 0 ? <div className={`col-span-full text-center py-20 ${theme === "dark" ? "text-zinc-600" : "text-gray-400"}`}>No upcoming raffles yet.</div> : upcoming.map((raffle) => (
              <Link key={raffle.id} href={`/raffles/${raffle.id}`} className={`group rounded-2xl border p-6 ${theme === "dark" ? "border-white/10 bg-white/[.03]" : "border-gray-200 bg-white"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/10 flex items-center justify-center text-violet-400">{raffle.project?.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}</div>
                  <div className="min-w-0"><h3 className="truncate font-bold">{raffle.title}</h3><p className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{raffle.project?.name || "Raven Oracle"}</p></div>
                </div>
                <p className={`mt-4 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{raffle.prizeName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
