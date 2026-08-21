"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api-config";

type GateProps = { raffleId: string; children: React.ReactNode };
type RaffleResponse = { raffle?: { entryRules?: unknown } };

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void }; } }

function required(entryRules: unknown) { return !!entryRules && typeof entryRules === "object" && !Array.isArray(entryRules) && (entryRules as Record<string, unknown>).captchaRequired === true; }

export default function RaffleCaptchaGate({ raffleId, children }: GateProps) {
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [entryExists, setEntryExists] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadRaffle = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/raffles/${raffleId}`, { credentials: "include", cache: "no-store" });
        const data = await response.json() as RaffleResponse;
        if (!cancelled) setNeedsCaptcha(required(data.raffle?.entryRules));
      } catch { /* public page continues */ }
    };
    void loadRaffle();
    return () => { cancelled = true; };
  }, [raffleId]);

  useEffect(() => {
    if (!needsCaptcha || entryExists) return;
    let cancelled = false;
    const checkEntry = async () => {
      try { const response = await fetch(`${API_BASE_URL}/raffles/${raffleId}/entries/me`, { credentials: "include", cache: "no-store" }); if (!cancelled && response.ok) setEntryExists(true); } catch { /* logged out or not entered */ }
    };
    void checkEntry();
    const timer = window.setInterval(() => { if (!cancelled) void checkEntry(); }, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [raffleId, needsCaptcha, entryExists]);

  useEffect(() => {
    if (!needsCaptcha || !entryExists || verified || !containerRef.current) return;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) { setMessage("CAPTCHA is required, but the public Turnstile site key is not configured."); return; }
    const render = () => {
      if (!window.turnstile || !containerRef.current || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: async (token: string) => {
          try {
            const response = await fetch(`${API_BASE_URL}/raffle-captcha/${raffleId}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ token }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message ?? "CAPTCHA verification failed");
            setVerified(true); setMessage("CAPTCHA verified. Your entry eligibility has been refreshed.");
          } catch (error) { setMessage(error instanceof Error ? error.message : "CAPTCHA verification failed"); window.turnstile?.reset(widgetRef.current ?? undefined); }
        },
        "expired-callback": () => setVerified(false),
        "error-callback": () => setMessage("CAPTCHA could not be verified. Please try again."),
      });
    };
    if (window.turnstile) render();
    else {
      const existing = document.querySelector('script[data-raven-turnstile="1"]');
      if (existing) existing.addEventListener("load", render, { once: true });
      else { const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true; script.dataset.ravenTurnstile = "1"; script.addEventListener("load", render, { once: true }); document.head.appendChild(script); }
    }
    return () => { widgetRef.current = null; };
  }, [needsCaptcha, entryExists, verified, raffleId]);

  return <>
    {needsCaptcha && <div className="mx-auto mb-5 max-w-6xl px-5"><section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[9px] font-black tracking-[.18em] text-amber-300">ANTI-BOT VERIFICATION</div><h2 className="mt-1 text-sm font-semibold text-zinc-100">CAPTCHA required for this raffle</h2><p className="mt-1 text-xs text-zinc-500">Enter the raffle first, then complete Turnstile here to refresh your eligibility.</p></div>{entryExists && !verified && <div ref={containerRef} className="min-h-[65px]" />}</div>{verified && <p className="mt-3 text-xs font-semibold text-emerald-400">✓ CAPTCHA verified</p>}{message && <p className="mt-3 text-xs text-zinc-400">{message}</p>}</section></div>}
    {children}
  </>;
}
