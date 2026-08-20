"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as { message?: string; token?: string; user?: { role?: string } };
  try {
    return JSON.parse(text) as { message?: string; token?: string; user?: { role?: string } };
  } catch {
    return { message: response.ok ? "Unexpected server response." : `Server error (${response.status}).` };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Login failed");

      if (data.token) localStorage.setItem("raven_token", data.token);
      const destination = data.user?.role === "ADMIN" || data.user?.role === "MODERATOR"
        ? "/admin"
        : next.startsWith("/") && !next.startsWith("/admin") ? next : "/dashboard";
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4"><div className="w-full max-w-md"><div className="rounded-2xl border border-white/10 bg-[#0e0d16] p-8 shadow-2xl">
    <div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-black shadow-lg shadow-violet-500/50">R</div><h1 className="text-3xl font-black text-white">Login</h1><p className="mt-2 text-sm text-zinc-500">Raven Oracle Platform</p></div>
    <form onSubmit={handleLogin} className="space-y-4"><div><label className="mb-2 block text-sm font-bold text-white">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-violet-500" placeholder="your@email.com" /></div><div><label className="mb-2 block text-sm font-bold text-white">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-violet-500" placeholder="Password" /></div>{error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">⚠️ {error}</div>}<button disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 py-3 font-black text-white disabled:opacity-50">{loading ? "Logging in…" : "Login"}</button></form>
    <div className="mt-6 border-t border-white/10 pt-6 text-center"><p className="text-sm text-zinc-600">Don&apos;t have an account? <Link href="/register" className="font-bold text-violet-400">Sign up</Link></p><p className="mt-3 text-[11px] text-zinc-600">After login, connect X, Discord and manage wallets from Account Settings.</p><Link href="/" className="mt-4 inline-block text-xs text-zinc-600">← Back to Home</Link></div>
  </div></div></main>;
}
