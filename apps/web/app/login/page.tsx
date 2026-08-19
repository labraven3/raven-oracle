"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResendMessage("");
    setEmailVerificationRequired(false);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.emailVerificationRequired) {
          setEmailVerificationRequired(true);
          setError("");
          return;
        }
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("raven_token", data.token);
      if (data.user?.role === "ADMIN" || data.user?.role === "MODERATOR") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setResendMessage("Enter your email address first.");
      return;
    }

    setResending(true);
    setResendMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/email/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to resend verification email.");
      setResendMessage(data.message || "A new verification link has been sent.");
    } catch (err: any) {
      setResendMessage(err.message || "Unable to resend verification email.");
    } finally {
      setResending(false);
    }
  }

  if (emailVerificationRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
        <div className="w-full max-w-md">
          <div className="bg-[#0e0d16] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
            <p className="text-zinc-400 mb-6">
              We sent a verification link to <strong className="text-yellow-400">{email}</strong>
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              Check your inbox and spam folder. If the email did not arrive, send yourself a fresh verification link below.
            </p>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-left">
              <p className="text-xs text-yellow-400">
                💡 Each verification link expires in 30 minutes.
              </p>
            </div>

            {resendMessage && (
              <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-left text-xs text-violet-200">
                {resendMessage}
              </div>
            )}

            <button
              onClick={() => void resendVerification()}
              disabled={resending}
              className="w-full px-6 py-3 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors mb-3"
            >
              {resending ? "Sending…" : "Resend Verification Email"}
            </button>

            <button
              onClick={() => setEmailVerificationRequired(false)}
              className="w-full px-6 py-3 border border-white/10 hover:bg-white/5 text-white font-bold rounded-lg transition-colors mb-3"
            >
              Back to Login
            </button>

            <p className="text-xs text-zinc-600">
              Don't have an account?{" "}
              <Link href="/register" className="text-violet-400 hover:text-violet-300 font-bold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-64 h-64 bg-violet-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0e0d16] border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black text-2xl mb-4 shadow-lg shadow-violet-500/50">
              R
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              Login
            </h1>
            <p className="text-sm text-zinc-500 mt-2">Raven Oracle Platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Password" />
            </div>
            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 text-white font-black rounded-lg transition-all shadow-lg shadow-violet-500/30">
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-zinc-600">
              Don't have an account? <Link href="/register" className="text-violet-400 hover:text-violet-300 font-bold">Sign up</Link>
            </p>
            <Link href="/" className="inline-block mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
