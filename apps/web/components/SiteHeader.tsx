"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "@/contexts/ThemeContext";
import RavenLogo from "./RavenLogo";

const AUTH_CACHE_MS = 30_000;

export default function SiteHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const syncAuth = async () => {
      const token = localStorage.getItem("raven_token");
      const tokenPresent = Boolean(token);
      const cachedUntil = Number(sessionStorage.getItem("raven_auth_cache_until") ?? "0");
      if (tokenPresent && cachedUntil > Date.now()) { setIsLoggedIn(true); setAuthChecked(true); return; }
      setIsLoggedIn(tokenPresent); setAuthChecked(true);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include", cache: "no-store", headers: tokenPresent ? { Authorization: `Bearer ${token}` } : undefined });
        if (cancelled) return;
        if (response.ok) { setIsLoggedIn(true); sessionStorage.setItem("raven_auth_cache_until", String(Date.now() + AUTH_CACHE_MS)); }
        else if (!tokenPresent) { setIsLoggedIn(false); sessionStorage.removeItem("raven_auth_cache_until"); }
      } catch { if (!cancelled) setIsLoggedIn(tokenPresent); }
    };
    void syncAuth();
    const onStorage = (event: StorageEvent) => { if (event.key === "raven_token") void syncAuth(); };
    const onAuthChanged = () => void syncAuth();
    window.addEventListener("storage", onStorage); window.addEventListener("raven-auth-changed", onAuthChanged);
    return () => { cancelled = true; window.removeEventListener("storage", onStorage); window.removeEventListener("raven-auth-changed", onAuthChanged); };
  }, [pathname]);

  useEffect(() => { const onPointerDown = (event: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false); }; document.addEventListener("mousedown", onPointerDown); return () => document.removeEventListener("mousedown", onPointerDown); }, []);

  const nav = [["/projects", "NFT Projects"], ["/raffles", "Raffles"], ["/how-it-works", "How it Works"], ["/docs", "Docs"]] as const;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[.08] bg-black/70 backdrop-blur-xl" aria-label="Primary navigation">
      <div className="mx-auto flex min-h-[60px] max-w-[1380px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="shrink-0" aria-label="Raven Oracle home"><RavenLogo compact /></Link>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center justify-center gap-4 px-1 py-1 text-[12px] font-semibold sm:gap-6 sm:text-[14px] lg:gap-8">            {nav.map(([href, label]) => <Link key={href} href={href} className={`whitespace-nowrap transition-colors ${pathname === href || pathname.startsWith(`${href}/`) ? "text-white" : "text-zinc-500 hover:text-white"}`}>{label}</Link>)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!authChecked ? null : isLoggedIn ? (
            <>
              <Link href="/dashboard" className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[9px] font-black text-violet-200 hover:border-violet-400/60 hover:bg-violet-500/20 sm:px-4 sm:text-[10px]">Dashboard</Link>
              <div className="relative" ref={profileRef}>
                <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-[9px] font-black text-white shadow-lg shadow-violet-500/20 sm:px-4 sm:text-xs">Profile</button>
                {profileOpen && <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0d0c11] p-2 shadow-2xl" role="menu"><Link href="/account" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/5">My Profile</Link><button type="button" onClick={() => { toggleTheme(); setProfileOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/5"><span>Theme</span><span>{theme === "dark" ? "Dark" : "Light"}</span></button></div>}
              </div>
            </>
          ) : (
            <Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold text-white hover:bg-white/5 sm:px-4 sm:text-xs">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
