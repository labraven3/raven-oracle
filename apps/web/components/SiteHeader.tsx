"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SiteHeader() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("raven_token");
    setIsLoggedIn(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("raven_token");
    setIsLoggedIn(false);
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl">
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
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-bold text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5"
              >
                Logout
              </button>
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
  );
}
