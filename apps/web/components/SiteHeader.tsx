"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "@/contexts/ThemeContext";
import RavenLogo from "./RavenLogo";

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
      const tokenPresent = Boolean(localStorage.getItem("raven_token"));

      // Keep the authenticated UI immediately when a Raven token exists.
      // This prevents Login / Sign Up from flashing or replacing Profile
      // during a full navigation such as clicking the brand logo.
      if (!cancelled) {
        setIsLoggedIn(tokenPresent);
        setAuthChecked(true);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
          cache: "no-store",
          headers: tokenPresent
            ? { Authorization: `Bearer ${localStorage.getItem("raven_token")}` }
            : undefined,
        });

        if (!cancelled && response.ok) {
          setIsLoggedIn(true);
        } else if (!cancelled && !tokenPresent) {
          setIsLoggedIn(false);
        }
      } catch {
        // Network/API failures must not log a locally authenticated user out.
        if (!cancelled) setIsLoggedIn(tokenPresent);
      }
    };

    void syncAuth();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "raven_token") void syncAuth();
    };
    const onAuthChanged = () => void syncAuth();
    const onPageShow = () => void syncAuth();

    window.addEventListener("storage", onStorage);
    window.addEventListener("raven-auth-changed", onAuthChanged);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("raven-auth-changed", onAuthChanged);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="shrink-0"><RavenLogo compact /></Link>
        <div className="hidden items-center gap-8 text-sm md:flex">
          <Link href="/projects" className="text-zinc-400 transition-colors hover:text-white">NFT Projects</Link>
          <Link href="/raffles" className="text-zinc-400 transition-colors hover:text-white">Raffles</Link>
          <Link href="/alpha" className="text-zinc-400 transition-colors hover:text-white">King of Alpha</Link>
          <Link href="/how-it-works" className="text-zinc-400 transition-colors hover:text-white">How it Works</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {!authChecked ? null : isLoggedIn ? (
            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/30">
                Profile
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#0d0c11]">
                  <Link href="/account" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2.5 text-xs font-bold text-zinc-800 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/5">My Profile</Link>
                  <button type="button" onClick={() => { toggleTheme(); setProfileOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold text-zinc-800 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/5">
                    <span>Theme</span><span>{theme === "dark" ? "Dark" : "Light"}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/5">Login</Link>
              <Link href="/register" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/30">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
