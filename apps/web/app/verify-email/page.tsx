"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token");
      const email_param = searchParams.get("email");

      if (!token || !email_param) {
        setStatus("error");
        setError("Invalid verification link");
        return;
      }

      setEmail(email_param);

      try {
        // The Express route is mounted at /api/auth/email/verify.
        // API_BASE_URL is /api, so /auth must be included here.
        const response = await fetch(`${API_BASE_URL}/auth/email/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setStatus("error");
          setError(data.message || "Verification failed");
          return;
        }

        setStatus("success");
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } catch (err: any) {
        setStatus("error");
        setError(err.message || "Verification failed");
      }
    };

    verifyToken();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0e0d16] border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <div className="text-center">
            {status === "verifying" && (
              <>
                <div className="inline-block animate-spin mb-4">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full"></div>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Verifying Email</h1>
                <p className="text-zinc-400">Please wait while we verify your email...</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400 mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
                <p className="text-zinc-400 mb-6">
                  Your email <strong className="text-green-400">{email}</strong> has been verified successfully.
                </p>
                <p className="text-sm text-zinc-500 mb-6">Redirecting to login...</p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-lg transition-colors"
                >
                  Go to Login
                </Link>
              </>
            )}

            {status === "error" && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-400 mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
                <p className="text-red-400 mb-6">{error}</p>
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">Try one of the following:</p>
                  <Link
                    href="/register"
                    className="inline-block px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-lg transition-colors"
                  >
                    Create New Account
                  </Link>
                  <div>
                    <Link
                      href="/login"
                      className="text-violet-400 hover:text-violet-300 text-sm font-medium"
                    >
                      Back to Login
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
