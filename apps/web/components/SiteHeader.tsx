"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "@/contexts/ThemeContext";
import RavenLogo from "./RavenLogo";

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncAuth = async () => {
      const tokenPresent = Boolean(localStorage.getItem("raven_token"));
      if (!cancelled && tokenPresent) setIsLoggedIn(true);

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!cancelled) setIsLoggedIn(response.ok);
      } catch {
        if (!cancelled) setIsLoggedIn(tokenPresent);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    };

    void syncAuth();

    const onStorage = (event: StorageEvent) => {
      if (event.key === "raven_token") void syncAuth();
    };
    const onAuthChanged = () => void syncAuth();

    window.addEventListener("storage", onStorage);
    window.addEventListener("raven-auth-changed", onAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("raven-auth-changed", onAuthChanged);
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      localStorage.removeItem("raven_token");
      window.dispatchEvent(new Event("raven-auth-changed"));
      setIsLoggedIn(false);
      router.replace("/");
    }
  };

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
          <button onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
            {theme === "dark" ? "☼" : "☾"}
          </button>
          {!authChecked ? null : isLoggedIn ? <>
            <Link href="/dashboard" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5">Dashboard</Link>
            <Link href="/create" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5 sm:block">Creator Studio</Link>
            <Link href="/account" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/30">Account</Link>
            <button onClick={() => void handleLogout()} className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-white/5 sm:block">Logout</button>
          </> : <>
            <Link href="/login" className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/5">Login</Link>
            <Link href="/register" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/30">Sign Up</Link>
          </>}
        </div>
      </div>
    </nav>
  );
}
