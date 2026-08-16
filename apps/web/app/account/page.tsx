"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
type User = { id: string; email: string | null; emailVerifiedAt?: string | null; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Wallet = { id: string; address: string; chain: string; network: string; status?: string };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");

  const load = useCallback(async () => {
    const [me, socialsData, walletsData] = await Promise.all([
      api<{ user: User }>("/auth/me"),
      api<{ accounts: Social[] }>("/social-accounts/"),
      api<{ wallets: Wallet[] }>("/wallets/"),
    ]);
    setUser(me.user);
    setEmail(me.user.email ?? "");
    setSocials(socialsData.accounts);
    setWallets(walletsData.wallets.filter((wallet) => wallet.status !== "DELETED"));
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const handoffToken = hash.get("token");
    const socialStatus = hash.get("status");
    const socialMessage = hash.get("message");
    if (handoffToken) localStorage.setItem("raven_token", handoffToken);
    if (socialStatus === "connected") setMessage("Discord connected. Add your Gmail below when you're ready.");
    if (socialStatus === "email-required") setMessage("Discord connected. Your Discord email is not being used automatically. Add the email you want on your Raven Oracle profile.");
    if (socialStatus === "error" && socialMessage) setMessage(socialMessage);
    if (window.location.hash) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    if (localStorage.getItem("raven_token")) void load().catch(() => setUser(null));
  }, [load]);

  const connectDiscord = async () => {
    setDiscordBusy(true);
    try {
      const data = await api<{ authorizationUrl: string }>("/auth/discord/start");
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Discord connection");
      setDiscordBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!email.trim()) return setMessage("Enter your Gmail address first.");
    setBusy(true);
    try {
      const data = await api<{ challenge: string; message: string }>("/auth/email/request-verification", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setChallenge(data.challenge);
      setOtp("");
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send OTP");
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    if (!challenge) return setMessage("Request an OTP first.");
    if (!/^\d{6}$/.test(otp)) return setMessage("Enter the 6-digit OTP from Raven Oracle.");
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User; message: string }>("/auth/email/verify-otp", { method: "POST", body: JSON.stringify({ email: email.trim(), challenge, code: otp }) });
      localStorage.setItem("raven_token", data.token);
      setUser(data.user);
      setChallenge("");
      setOtp("");
      setMessage(data.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OTP verification failed");
    } finally { setBusy(false); }
  };

  const addWallet = async () => {
    if (!address.trim()) return;
    setBusy(true);
    try {
      await api("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      setAddress("");
      setMessage("Prize address saved.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save address"); }
    finally { setBusy(false); }
  };

  if (!user) return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="border-b border-white/10 px-5 py-5"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a></header>
      <section className="mx-auto max-w-lg px-5 py-20">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">RAVEN ORACLE ACCOUNT</span>
        <h1 className="mt-3 text-5xl font-medium">Connect your account.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500">Connect Discord to create or access your Raven Oracle profile. Your Gmail is separate profile information and is never taken from Discord automatically.</p>
        <button disabled={discordBusy} onClick={() => void connectDiscord()} className="mt-8 w-full rounded-xl bg-[#5865F2] py-4 text-sm font-black text-white">{discordBusy ? "Connecting…" : "Continue with Discord"}</button>
        {message && <p className="mt-5 rounded-xl border border-violet-900/40 bg-violet-950/10 p-4 text-xs text-violet-200">{message}</p>}
      </section>
    </main>
  );

  const discord = socials.find((item) => item.provider === "DISCORD");
  const x = socials.find((item) => item.provider === "X");

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/90 px-5 py-5 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a><nav className="flex gap-5 text-xs text-zinc-500"><a href="/raffles">Raffles</a><a href="/projects">Projects</a><a href="/dashboard">Creator Studio</a></nav></div></header>
      <section className="mx-auto max-w-5xl px-5 py-14">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">MY PROFILE</span>
        <h1 className="mt-3 text-5xl font-medium">Account settings.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Connect your socials, add the Gmail where Raven Oracle should contact you, and keep your prize addresses ready for raffles.</p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">SOCIAL ACCOUNTS</span>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 p-4"><div><b>Discord</b><p className="mt-1 text-xs text-zinc-600">{discord?.providerUsername ? `@${discord.providerUsername}` : "Not connected"}</p></div><button onClick={() => void connectDiscord()} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">{discord ? "Reconnect" : "Connect"}</button></div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 p-4"><div><b>X</b><p className="mt-1 text-xs text-zinc-600">{x?.providerUsername ? `@${x.providerUsername}` : "Not connected"}</p></div><span className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-zinc-600">Coming later</span></div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">CONTACT EMAIL</span>
            <h2 className="mt-3 text-2xl font-semibold">Your Gmail.</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">This is the email Raven Oracle uses for winner notifications and important account messages. It is not your login.</p>
            <div className="mt-5 flex items-center gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@gmail.com" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none"/><span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.emailVerifiedAt ? "border border-emerald-500/20 text-emerald-300" : "border border-amber-500/20 text-amber-300"}`}>{user.emailVerifiedAt ? "VERIFIED" : "UNVERIFIED"}</span></div>
            {!challenge ? <button disabled={busy || !email.trim()} onClick={() => void sendOtp()} className="mt-3 w-full rounded-lg bg-violet-500 py-3 text-xs font-black">{busy ? "Sending OTP…" : user.email === email && user.emailVerifiedAt ? "Change email" : "Send OTP"}</button> : <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><p className="text-xs text-violet-200">We sent a 6-digit code from Raven Oracle to <b>{email}</b>.</p><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoFocus placeholder="000000" className="mt-3 w-full rounded-lg border border-white/10 bg-black px-3 py-4 text-center text-2xl font-black tracking-[.5em] outline-none"/><button disabled={busy || otp.length !== 6} onClick={() => void verifyOtp()} className="mt-3 w-full rounded-lg bg-white py-3 text-xs font-black text-black">{busy ? "Verifying…" : "Verify email"}</button><button disabled={busy} onClick={() => void sendOtp()} className="mt-2 w-full py-2 text-[10px] font-bold text-zinc-500">Send a new code</button></div>}
          </article>
        </div>

        <article className="mt-5 rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
          <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PRIZE ADDRESSES</span>
          <h2 className="mt-3 text-2xl font-semibold">Where should prizes go?</h2>
          <p className="mt-2 text-xs text-zinc-500">Keep your EVM or Solana address on your profile so you can select it when entering a raffle.</p>
          <div className="mt-5 space-y-3">{wallets.map((wallet) => <div key={wallet.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4"><div><div className="text-[9px] font-black text-violet-300">{wallet.chain} · {wallet.network}</div><div className="mt-1 break-all text-xs text-zinc-400">{wallet.address}</div></div><span className="text-[9px] text-emerald-300">READY</span></div>)}</div>
          <div className="mt-5 flex gap-2"><select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} className="rounded-lg border border-white/10 bg-black px-3 text-xs"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Paste wallet address" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 py-3 text-xs"/><button disabled={busy || !address.trim()} onClick={() => void addWallet()} className="rounded-lg bg-violet-500 px-4 text-[10px] font-black">Add address</button></div>
        </article>
        {message && <div className="mt-5 rounded-xl border border-violet-900/40 bg-violet-950/10 p-4 text-xs text-violet-200">{message}</div>}
      </section>
    </main>
  );
}
