"use client";

import { useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) {
        throw new Error(data.message || "Admin login failed");
      }

      // Keep the admin session completely separate from the normal user session.
      // A browser may legitimately have both sessions active at the same time.
      localStorage.setItem("raven_admin_token", data.token);
      document.cookie = `raven_admin_token=${encodeURIComponent(data.token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0a12] via-[#0f0d1a] to-[#0b0a12] px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-64 h-64 bg-violet-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0e0d16] border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black text-2xl mb-4 shadow-lg shadow-violet-500/50">R</div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Admin Panel</h1>
            <p className="text-sm text-zinc-500 mt-2">Raven Oracle Administration</p>
          </div>

          <div className="mb-6 p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
            <p className="text-xs text-violet-300">🔐 Admin credentials required. Unauthorized access attempts are logged.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-bold text-white mb-2">Email</label>
              <input id="admin-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="admin@example.com" />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-bold text-white mb-2">Password</label>
              <input id="admin-password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="••••••••••••" />
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">⚠️ {error}</div>}

            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 text-white font-black rounded-lg transition-all shadow-lg shadow-violet-500/30">
              {loading ? "Verifying..." : "Login to Admin Panel"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-zinc-600">Not an admin? <Link href="/login" className="text-violet-400 hover:text-violet-300 font-bold">User Login</Link></p>
          </div>
          <div className="mt-4 text-center"><Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Back to Home</Link></div>
        </div>
      </div>
    </div>
  );
}
