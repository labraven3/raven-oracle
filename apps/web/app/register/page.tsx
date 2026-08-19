"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 12) {
      setError("Password must be at least 12 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0a12] px-4">
        <div className="w-full max-w-md">
          <div className="bg-[#0e0d16] border border-[#302c40] rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#f5f3fa] mb-2">Registration Successful!</h2>
            <p className="text-sm text-[#8f8a9e]">Check your email to verify your account. Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0a12] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0e0d16] border border-[#302c40] rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#9b63ff] to-[#5a27a9] text-white font-black text-2xl mb-4">
              R
            </div>
            <h1 className="text-2xl font-bold text-[#f5f3fa]">Create Account</h1>
            <p className="text-sm text-[#8f8a9e] mt-2">Join Raven Oracle Platform</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#f5f3fa] mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="w-full px-4 py-3 bg-[#15131f] border border-[#302c40] rounded-lg text-[#f5f3fa] focus:ring-2 focus:ring-[#9b63ff] focus:outline-none"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f5f3fa] mb-2">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
                minLength={3}
                maxLength={30}
                className="w-full px-4 py-3 bg-[#15131f] border border-[#302c40] rounded-lg text-[#f5f3fa] focus:ring-2 focus:ring-[#9b63ff] focus:outline-none"
                placeholder="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f5f3fa] mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                minLength={12}
                className="w-full px-4 py-3 bg-[#15131f] border border-[#302c40] rounded-lg text-[#f5f3fa] focus:ring-2 focus:ring-[#9b63ff] focus:outline-none"
                placeholder="Min 12 characters"
              />
              <p className="text-xs text-[#8f8a9e] mt-1">Must be at least 12 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f5f3fa] mb-2">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                required
                minLength={12}
                className="w-full px-4 py-3 bg-[#15131f] border border-[#302c40] rounded-lg text-[#f5f3fa] focus:ring-2 focus:ring-[#9b63ff] focus:outline-none"
                placeholder="Confirm password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#9b63ff] hover:bg-[#8a52ee] disabled:bg-[#302c40] text-white font-bold rounded-lg transition-colors"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8f8a9e]">
              Already have an account?{" "}
              <Link href="/login" className="text-[#9b63ff] hover:underline font-medium">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
