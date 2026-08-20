"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("raven_token")));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      localStorage.removeItem("raven_token");
      setIsLoggedIn(false);
      router.replace("/");
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg font-black shadow-lg shadow-violet-500/50">R</div><div><div className="font-black text-sm tracking-[.2em]">RAVEN</div><div className="text-[8px] tracking-[.15em] text-violet-300">ORACLE</div></div></Link>
        <div className="hidden items-center gap-8 text-sm md:flex"><Link href="/projects" className="text-zinc-400 transition-colors hover:text-white">NFT Projects</Link><Link href="/raffles" className="text-zinc-400 transition-colors hover:text-white">Raffles</Link><Link href="/alpha" className="text-zinc-400 transition-colors hover:text-white">King of Alpha</Link><Link href="/how-it-works" className="text-zinc-400 transition-colors hover:text-white">How it Works</Link></div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn ? <><Link href="/dashboard" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5">Dashboard</Link><Link href="/create" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5 sm:block">Creator Studio</Link><Link href="/account" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-black shadow-lg shadow-violet-500/30">Account</Link><button onClick={() => void handleLogout()} className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-white/5 sm:block">Logout</button></> : <><Link href="/login" className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/5">Login</Link><Link href="/register" className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-xs font-black shadow-lg shadow-violet-500/30">Sign Up</Link></>}
        </div>
      </div>
    </nav>
  );
}
