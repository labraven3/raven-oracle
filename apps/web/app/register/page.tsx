"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", username: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match");
    if (formData.password.length < 12) return setError("Password must be at least 12 characters long");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: formData.email, username: formData.username, password: formData.password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally { setLoading(false); }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
      <div className="w-full max-w-md bg-[#0e0d16] border border-white/10 rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">✉</div>
        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
        <p className="text-zinc-400 mb-4">We sent a verification link to <strong className="text-blue-400">{formData.email}</strong>.</p>
        <p className="text-sm text-zinc-500 mb-6">Click the link in your email to verify your account. The link expires in 30 minutes.</p>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6"><p className="text-xs text-blue-400">Check your spam or promotions folder if you do not see it.</p></div>
        <button onClick={() => router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`)} className="w-full px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-lg">I’m waiting for the email</button>
        <p className="text-xs text-zinc-600 mt-4">You must verify your email before signing in.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0e0d16] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black text-2xl mb-4">R</div><h1 className="text-3xl font-black text-white">Create Account</h1><p className="text-sm text-zinc-500 mt-2">Join Raven Oracle Platform</p></div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div><label className="block text-sm font-bold text-white mb-2">Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData,email:e.target.value})} required className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white" placeholder="your@email.com" /></div>
            <div><label className="block text-sm font-bold text-white mb-2">Username</label><input type="text" value={formData.username} onChange={e => setFormData({...formData,username:e.target.value})} required minLength={3} maxLength={30} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white" placeholder="username" /></div>
            <div><label className="block text-sm font-bold text-white mb-2">Password</label><input type="password" value={formData.password} onChange={e => setFormData({...formData,password:e.target.value})} required minLength={12} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white" placeholder="Min 12 characters" /><p className="text-xs text-zinc-500 mt-1">Must have uppercase, lowercase, number, and be 12+ characters</p></div>
            <div><label className="block text-sm font-bold text-white mb-2">Confirm Password</label><input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData,confirmPassword:e.target.value})} required minLength={12} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white" placeholder="Confirm password" /></div>
            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 disabled:opacity-50 text-white font-black rounded-lg">{loading ? "Creating account..." : "Create Account"}</button>
          </form>
          <div className="mt-6 pt-6 border-t border-white/10 text-center"><p className="text-sm text-zinc-600">Already have an account? <Link href="/login" className="text-violet-400 font-bold">Login</Link></p></div>
          <div className="mt-4 text-center"><Link href="/" className="text-xs text-zinc-600">← Back to Home</Link></div>
        </div>
      </div>
    </div>
  );
}
