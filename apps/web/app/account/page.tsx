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
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, socialsData, walletsData] = await Promise.all([
        api<{ user: User }>("/auth/me"),
        api<{ accounts: Social[] }>("/social-accounts/"),
        api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setUser(me.user);
      setSocials(socialsData.accounts);
      setWallets(walletsData.wallets.filter((wallet) => wallet.status !== "DELETED"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const handoffToken = hash.get("token");
    const socialStatus = hash.get("status");
    const socialMessage = hash.get("message");
    if (handoffToken) localStorage.setItem("raven_token", handoffToken);
    if (socialStatus === "connected") setMessage("Discord connected. Your Raven Oracle account is ready.");
    if (socialStatus === "email-required") setMessage("Discord connected. Add an email below so Raven Oracle can verify and contact you.");
    if (socialStatus === "error" && socialMessage) setMessage(socialMessage);
    if (window.location.hash) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);

    const query = new URLSearchParams(window.location.search);
    const verificationToken = query.get("verifyEmail");
    if (verificationToken) {
      void api<{ token: string; user: User; message: string }>("/auth/email/verify", { method: "POST", body: JSON.stringify({ token: verificationToken }) })
        .then((data) => { localStorage.setItem("raven_token", data.token); setMessage(data.message); window.history.replaceState({}, "", window.location.pathname); return load(); })
        .catch((error) => setMessage(error instanceof Error ? error.message : "Email verification failed"));
    } else if (localStorage.getItem("raven_token")) {
      void load();
    }
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

  const auth = async () => {
    if (!email.trim() || password.length < 8) return setMessage("Use a valid email and password of at least 8 characters.");
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User; emailVerificationRequired?: boolean }>(register ? "/auth/register" : "/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
      localStorage.setItem("raven_token", data.token);
      setUser(data.user);
      setEmail(""); setPassword("");
      setMessage(data.emailVerificationRequired ? "Account created. Check your email and click Verify email before signing in again." : register ? "Account created." : "Signed in.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed"); }
    finally { setBusy(false); }
  };

  const requestVerification = async () => {
    if (!email.trim()) return setMessage("Enter the email address you want to use.");
    setBusy(true);
    try {
      const data = await api<{ message: string }>("/auth/email/request-verification", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setMessage(data.message);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send verification email"); }
    finally { setBusy(false); }
  };

  const addWallet = async () => {
    if (!address.trim()) return;
    setBusy(true);
    try { await api("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) }); setAddress(""); setMessage("Prize address saved."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save address"); }
    finally { setBusy(false); }
  };

  if (!user) return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="border-b border-white/10 px-5 py-5"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a></header>
      <div className="mx-auto max-w-md px-5 py-16">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">RAVEN ORACLE ACCOUNT</span>
        <h1 className="mt-3 text-4xl font-medium">Enter with Discord.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Connect Discord first. Raven Oracle creates your account automatically and uses your verified Discord email when Discord provides one.</p>
        <button disabled={discordBusy} onClick={() => void connectDiscord()} className="mt-8 w-full rounded-xl bg-[#5865F2] py-4 text-sm font-black text-white">{discordBusy ? "Connecting…" : "Continue with Discord"}</button>
        <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[.18em] text-zinc-700"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
        <button onClick={() => setRegister((value) => !value)} className="w-full rounded-xl border border-white/10 py-3 text-xs font-bold text-zinc-400">{register ? "Use existing email account" : "Create with email + password"}</button>
        {register || !register ? <div className="mt-5 space-y-3"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" className="w-full rounded-xl border border-white/10 bg-[#0d0c11] p-4 text-sm outline-none"/><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" type="password" className="w-full rounded-xl border border-white/10 bg-[#0d0c11] p-4 text-sm outline-none"/><button disabled={busy} onClick={() => void auth()} className="w-full rounded-xl bg-white py-3 text-xs font-black text-black">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button></div> : null}
        {message && <p className="mt-5 rounded-xl border border-violet-900/40 bg-violet-950/10 p-4 text-xs text-violet-200">{message}</p>}
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/90 px-5 py-5 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a><nav className="flex gap-5 text-xs text-zinc-500"><a href="/raffles">Raffles</a><a href="/projects">Projects</a><a href="/dashboard">Creator Studio</a></nav></div></header>
      <section className="mx-auto max-w-5xl px-5 py-14">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">ACCOUNT</span><h1 className="mt-3 text-5xl font-medium">{user.username ?? user.displayName ?? user.email ?? "Raven member"}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500"><span>{user.email ?? "No email added yet"}</span>{user.emailVerifiedAt ? <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[9px] font-black text-emerald-300">EMAIL VERIFIED</span> : <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[9px] font-black text-amber-300">EMAIL REQUIRED</span>}</div>

        {!user.emailVerifiedAt && <article className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><span className="text-[9px] font-black tracking-[.18em] text-amber-300">FINISH YOUR ACCOUNT</span><h2 className="mt-2 text-xl font-bold">Add a real email.</h2><p className="mt-2 text-xs leading-5 text-zinc-500">We send a real verification email through Gmail. You need a verified email for important account and raffle notifications.</p><div className="mt-5 flex gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user.email ?? "you@example.com"} type="email" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none"/><button disabled={busy} onClick={() => void requestVerification()} className="rounded-lg bg-violet-500 px-4 py-3 text-xs font-black">{busy ? "Sending…" : "Send verification"}</button></div></article>}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">SOCIAL CONNECTIONS</span>{["DISCORD","X"].map((provider) => { const social = socials.find((item) => item.provider === provider); return <div key={provider} className="mt-5 flex items-center justify-between border-b border-white/10 pb-4"><div><b>{provider === "DISCORD" ? "Discord" : "X"}</b><p className="mt-1 text-xs text-zinc-600">{social?.providerUsername || "Not connected"}</p></div>{provider === "DISCORD" && <button onClick={() => void connectDiscord()} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">{social ? "Reconnect" : "Connect"}</button>}</div>; })}</article>
          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PRIZE ADDRESSES</span>{wallets.map((wallet) => <div key={wallet.id} className="mt-5 rounded-xl border border-white/10 p-3"><div className="text-[9px] text-violet-300">{wallet.chain} · {wallet.network}</div><div className="mt-1 break-all text-xs text-zinc-400">{wallet.address}</div></div>)}<div className="mt-5 flex gap-2"><select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} className="rounded-lg border border-white/10 bg-black px-3 text-xs"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Paste address" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs"/><button disabled={busy} onClick={() => void addWallet()} className="rounded-lg bg-violet-500 px-3 text-[10px] font-black">Add</button></div></article>
        </div>
        {message && <div className="mt-5 rounded-xl border border-violet-900/40 bg-violet-950/10 p-4 text-xs text-violet-200">{message}</div>}
      </section>
    </main>
  );
}
