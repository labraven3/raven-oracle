"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as { message?: string; authorizationUrl?: string };
  try { return JSON.parse(text) as { message?: string; authorizationUrl?: string }; }
  catch { return { message: response.ok ? "Unexpected server response." : `Server error (${response.status}).` }; }
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"x" | "discord" | null>(null);

  useEffect(() => {
    const message = params.get("message");
    const status = params.get("status");
    if (status === "error" && message) setError(message);
  }, [params]);

  async function oauthLogin(provider: "x" | "discord") {
    setError("");
    setOauthLoading(provider);
    localStorage.removeItem("raven_token");
    try {
      const returnTo = next.startsWith("/") && !next.startsWith("/admin") ? next : "/dashboard";
      const response = await fetch(`${API_BASE_URL}/auth/${provider}/start?login=1&returnTo=${encodeURIComponent(returnTo)}`, { credentials: "omit", cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok || !data.authorizationUrl) throw new Error(data.message || `${provider === "x" ? "X" : "Discord"} login is unavailable.`);
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth login failed");
      setOauthLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#0e0d16] p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-black shadow-lg shadow-violet-500/50">R</div>
            <h1 className="text-3xl font-black text-white">Login</h1>
            <p className="mt-2 text-sm text-zinc-500">Raven Oracle Platform</p>
          </div>

          <div className="space-y-3">
            <button disabled={!!oauthLoading} onClick={() => void oauthLogin("x")} className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-bold text-white hover:border-white/20 disabled:opacity-50">
              <span className="text-lg">𝕏</span><span>{oauthLoading === "x" ? "Connecting…" : "Continue with X"}</span>
            </button>
            <button disabled={!!oauthLoading} onClick={() => void oauthLogin("discord")} className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#5865F2] px-4 py-3 font-bold text-white hover:bg-[#4f5bd5] disabled:opacity-50">
              <span>◉</span><span>{oauthLoading === "discord" ? "Connecting…" : "Continue with Discord"}</span>
            </button>
          </div>

          {error && <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">⚠️ {error}</div>}

          <div className="mt-7 border-t border-white/10 pt-5 text-center">
            <p className="text-[11px] leading-5 text-zinc-600">After logging in, you can add and verify your email from your Profile.</p>
            <Link href="/" className="mt-4 inline-block text-xs text-zinc-600 hover:text-zinc-300">← Back to Home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4"><div className="text-sm text-zinc-500">Loading login…</div></main>}><LoginForm /></Suspense>;
}
