"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  category?: string;
  status?: string;
};

type Raffle = {
  id: string;
  title: string;
  prizeName: string;
  endsAt: string;
  status: string;
  project?: { name?: string | null; logoUrl?: string | null } | null;
};

async function api<T>(path: string): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raven_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tab, setTab] = useState<"upcoming" | "trending">("trending");
  const [heroVisible, setHeroVisible] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [iconIndex, setIconIndex] = useState(0);

  // Rotating icons for floating cards
  const iconSets = [
    ["🎨", "💎", "🎮", "⛓️"],
    ["🚀", "🌟", "🎯", "💰"],
    ["🔥", "⚡", "🌈", "🎭"],
    ["🏆", "👑", "💫", "🎪"],
  ];

  useEffect(() => {
    const token = localStorage.getItem("raven_token");
    setIsLoggedIn(!!token);

    void Promise.all([
      api<{ projects: Project[] }>("/projects/public").catch(() => ({ projects: [] })),
      api<{ raffles: Raffle[] }>("/raffles/public").catch(() => ({ raffles: [] })),
    ]).then(([p, r]) => {
      setProjects(p.projects.filter((x) => x.status === "APPROVED"));
      setRaffles(r.raffles.filter((x) => ["ACTIVE", "SCHEDULED"].includes(x.status)));
    });

    // Icon rotation every 4 seconds
    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % 4);
    }, 4000);

    // Hero visibility on scroll
    const handleScroll = () => {
      setHeroVisible(window.scrollY < 300);
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearInterval(iconInterval);
    };
  }, []);

  const trending = projects.slice(0, 6);
  const upcoming = raffles.slice(0, 6);
  const currentIcons = iconSets[iconIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-64 h-64 bg-violet-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] animate-pulse delay-500" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-violet-500/50">
              R
            </div>
            <div>
              <div className="font-black text-sm tracking-[.2em]">RAVEN</div>
              <div className="text-[8px] text-violet-300 tracking-[.15em]">ORACLE</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link href="/projects" className="text-zinc-400 hover:text-white transition-colors">
              NFT Projects
            </Link>
            <Link href="/raffles" className="text-zinc-400 hover:text-white transition-colors">
              Raffles
            </Link>
            <Link href="/alpha" className="text-zinc-400 hover:text-white transition-colors">
              King of Alpha
            </Link>
            <Link href="/how-it-works" className="text-zinc-400 hover:text-white transition-colors">
              How it Works
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-xs font-bold border border-white/10 rounded-lg hover:bg-white/5"
                >
                  Creator Studio
                </Link>
                <Link
                  href="/account"
                  className="px-4 py-2 text-xs font-black bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-lg shadow-violet-500/30"
                >
                  Account
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-bold border border-white/10 rounded-lg hover:bg-white/5"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-xs font-black bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-lg shadow-violet-500/30"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Floating Elements */}
      {heroVisible && (
        <section className="relative overflow-hidden h-[600px] transition-opacity duration-700">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Floating NFT Cards with rotating icons */}
          <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-2xl border border-violet-500/30 backdrop-blur-sm animate-float shadow-2xl shadow-violet-500/20 transition-all duration-1000">
            <div className="w-full h-full bg-gradient-to-br from-violet-400/10 to-purple-500/10 rounded-2xl flex items-center justify-center text-4xl">
              {currentIcons[0]}
            </div>
          </div>

          <div className="absolute top-40 right-32 w-40 h-40 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-2xl border border-blue-500/30 backdrop-blur-sm animate-float-delayed shadow-2xl shadow-blue-500/20 transition-all duration-1000">
            <div className="w-full h-full bg-gradient-to-br from-blue-400/10 to-cyan-500/10 rounded-2xl flex items-center justify-center text-5xl">
              {currentIcons[1]}
            </div>
          </div>

          <div className="absolute bottom-32 left-40 w-36 h-36 bg-gradient-to-br from-pink-500/20 to-rose-600/20 rounded-2xl border border-pink-500/30 backdrop-blur-sm animate-float shadow-2xl shadow-pink-500/20 transition-all duration-1000">
            <div className="w-full h-full bg-gradient-to-br from-pink-400/10 to-rose-500/10 rounded-2xl flex items-center justify-center text-4xl">
              {currentIcons[2]}
            </div>
          </div>

          <div className="absolute bottom-20 right-20 w-28 h-28 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-2xl border border-green-500/30 backdrop-blur-sm animate-float-delayed shadow-2xl shadow-green-500/20 transition-all duration-1000">
            <div className="w-full h-full bg-gradient-to-br from-green-400/10 to-emerald-500/10 rounded-2xl flex items-center justify-center text-3xl">
              {currentIcons[3]}
            </div>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 text-center px-6">
            <div className="inline-block mb-6 px-4 py-2 bg-violet-500/10 border border-violet-500/30 rounded-full text-xs font-black tracking-[.2em] text-violet-300">
              WEB3 NFT RAFFLE PLATFORM
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                The Future of
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                NFT Whitelists
              </span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Join verified NFT communities, complete tasks, and win whitelist spots through provably fair raffles powered by blockchain technology.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/raffles"
                className="px-8 py-4 text-sm font-black bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl shadow-2xl shadow-violet-500/50 hover:shadow-violet-500/70 transition-all"
              >
                Explore Raffles
              </Link>
              <Link
                href="/projects/new"
                className="px-8 py-4 text-sm font-bold border border-white/20 rounded-xl hover:bg-white/5 transition-all"
              >
                Launch Project
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Featured Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="text-xs font-black tracking-[.2em] text-violet-400 mb-2">
              DISCOVER
            </div>
            <h2 className="text-4xl font-black">Featured NFT Projects</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("trending")}
              className={`px-6 py-3 text-xs font-black rounded-lg transition-all ${
                tab === "trending"
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/50"
                  : "border border-white/10 text-zinc-400 hover:border-white/20"
              }`}
            >
              🔥 TRENDING
            </button>
            <button
              onClick={() => setTab("upcoming")}
              className={`px-6 py-3 text-xs font-black rounded-lg transition-all ${
                tab === "upcoming"
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/50"
                  : "border border-white/10 text-zinc-400 hover:border-white/20"
              }`}
            >
              🚀 UPCOMING
            </button>
          </div>
        </div>

        {tab === "trending" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.length === 0 ? (
              <div className="col-span-full text-center py-20 text-zinc-600">
                No approved projects yet.
              </div>
            ) : (
              trending.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 hover:border-violet-500/50 transition-all hover:shadow-2xl hover:shadow-violet-500/20"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center overflow-hidden">
                      {p.logoUrl ? (
                        <img
                          src={p.logoUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-black text-violet-300">
                          {p.name[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-lg mb-1 group-hover:text-violet-300 transition-colors">
                        {p.name}
                      </h3>
                      <span className="text-xs text-zinc-500 font-bold">
                        {p.category || "NFT"} · VERIFIED
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">
                    {p.description || "Explore this NFT project and upcoming raffles."}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">View Project</span>
                    <span className="text-violet-400 font-black group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {tab === "upcoming" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.length === 0 ? (
              <div className="col-span-full text-center py-20 text-zinc-600">
                No upcoming raffles yet.
              </div>
            ) : (
              upcoming.map((r) => (
                <Link
                  key={r.id}
                  href={`/raffles/${r.id}`}
                  className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 hover:border-violet-500/50 transition-all hover:shadow-2xl hover:shadow-violet-500/20"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-[9px] font-black text-green-300">
                      {r.status}
                    </span>
                    <span className="text-xs text-zinc-500 font-bold">
                      {new Date(r.endsAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-black text-lg mb-2 group-hover:text-violet-300 transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-4">
                    {r.project?.name || "NFT Project"}
                  </p>
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Prize</span>
                      <span className="text-white font-bold">{r.prizeName}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/10 bg-black/20 backdrop-blur-xl mt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-lg">
                  R
                </div>
                <div>
                  <div className="font-black text-sm tracking-[.2em]">RAVEN</div>
                  <div className="text-[8px] text-violet-300 tracking-[.15em]">
                    ORACLE
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Web3's most trusted NFT whitelist raffle platform. Provably fair draws powered by blockchain.
              </p>
            </div>

            <div>
              <h4 className="font-black text-sm mb-4">Platform</h4>
              <div className="space-y-2 text-xs text-zinc-400">
                <Link href="/projects" className="block hover:text-white transition-colors">
                  NFT Projects
                </Link>
                <Link href="/raffles" className="block hover:text-white transition-colors">
                  Raffles
                </Link>
                <Link href="/alpha" className="block hover:text-white transition-colors">
                  King of Alpha
                </Link>
                <Link href="/how-it-works" className="block hover:text-white transition-colors">
                  How it Works
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-black text-sm mb-4">Creators</h4>
              <div className="space-y-2 text-xs text-zinc-400">
                <Link href="/dashboard" className="block hover:text-white transition-colors">
                  Creator Studio
                </Link>
                <Link href="/projects/new" className="block hover:text-white transition-colors">
                  Launch Project
                </Link>
                <Link href="/create" className="block hover:text-white transition-colors">
                  Create Raffle
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-black text-sm mb-4">Community</h4>
              <div className="flex gap-3">
                <a
                  href="https://twitter.com/RavenOracle"
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://discord.gg/raveoracle"
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </a>
                <a
                  href="https://t.me/RavenOracle"
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.654-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500">
            <p>© 2024 Raven Oracle. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        @keyframes float-delayed {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) rotate(-5deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
