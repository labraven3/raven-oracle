"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = { id: string; email: string | null; emailVerifiedAt?: string | null; displayName?: string | null; username?: string | null; role?: string; status?: string };
type Social = { id: string; provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Wallet = { id: string; address: string; chain: string; network: string; status?: string; isPrimary?: boolean };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const me = await api<{ user: User }>("/auth/me");
    setUser(me.user);
    setUsername(me.user.username ?? "");
    setDisplayName(me.user.displayName ?? "");

    const [socialResult, walletResult] = await Promise.all([
      api<{ accounts: Social[] }>("/social-accounts/"),
      api<{ wallets: Wallet[] }>("/wallets/"),
    ]);
    setSocials(socialResult.accounts);
    setWallets(walletResult.wallets.filter((w) => w.status !== "ARCHIVED" && w.status !== "DELETED"));
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackToken = hash.get("token");
    if (callbackToken) {
      localStorage.setItem("raven_token", callbackToken);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    const token = localStorage.getItem("raven_token");
    if (!token) {
      router.replace("/login?next=/account");
      return;
    }

    void load().catch(() => {
      localStorage.removeItem("raven_token");
      router.replace("/login?next=/account");
    });
  }, [load, router]);

  const updateProfile = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/profile", { method: "PATCH", body: JSON.stringify({ username: username.trim() || undefined, displayName: displayName.trim() || undefined }) });
      await load(); setEditing(false); setMessage("Profile updated successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update profile"); }
    finally { setBusy(false); }
  };

  const connectSocial = async (provider: "x" | "discord") => {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`);
      window.location.assign(data.authorizationUrl);
    } catch (e) { setError(e instanceof Error ? e.message : `${provider} connection is unavailable`); setBusy(false); }
  };

  const disconnectSocial = async (id: string) => {
    if (!window.confirm("Disconnect this social account?")) return;
    setBusy(true); setError("");
    try { await api(`/social-accounts/${id}`, { method: "DELETE" }); await load(); setMessage("Social account disconnected."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to disconnect account"); }
    finally { setBusy(false); }
  };

  const addWallet = async () => {
    if (!address.trim()) { setError("Enter a wallet address."); return; }
    setBusy(true); setError(""); setMessage("");
    try { await api("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) }); setAddress(""); await load(); setMessage("Wallet added successfully."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to add wallet"); }
    finally { setBusy(false); }
  };

  const removeWallet = async (id: string) => {
    if (!window.confirm("Remove this wallet from your account?")) return;
    setBusy(true); setError("");
    try { await api(`/wallets/${id}`, { method: "DELETE" }); await load(); setMessage("Wallet removed."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to remove wallet"); }
    finally { setBusy(false); }
  };

  const makePrimary = async (id: string) => {
    setBusy(true); setError("");
    try { await api(`/wallets/${id}`, { method: "PATCH", body: JSON.stringify({ isPrimary: true }) }); await load(); setMessage("Primary prize wallet updated."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update primary wallet"); }
    finally { setBusy(false); }
  };

  const logout = () => { localStorage.removeItem("raven_token"); router.replace("/"); };

  if (!user) return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader /><section className="mx-auto max-w-lg px-5 py-24 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /><p className="mt-5 text-sm text-zinc-500">Loading your account…</p></section></main>;

  const discord = socials.find((s) => s.provider === "DISCORD");
  const xSocial = socials.find((s) => s.provider === "X");

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">MY PROFILE</span><h1 className="mt-3 text-5xl font-medium">Account settings.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Manage your profile, connect X and Discord, and control the wallet addresses used for prizes.</p></div>
          <button onClick={logout} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-white/5">Log out</button>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">{error}</div>}
        {message && <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-300">{message}</div>}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PROFILE</span><h2 className="mt-3 text-2xl font-semibold">Your profile.</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-zinc-600">Email</div><div className="mt-2 break-all text-sm">{user.email}</div><div className="mt-1 text-[10px] text-emerald-400">{user.emailVerifiedAt ? "✓ Verified" : "Not verified"}</div></div>
              {editing ? <><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" maxLength={32} className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" /><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" maxLength={80} className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" /><div className="flex gap-2"><button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold">Cancel</button><button disabled={busy} onClick={() => void updateProfile()} className="flex-1 rounded-lg bg-violet-500 py-3 text-xs font-black text-black disabled:opacity-40">Save Changes</button></div></> : <><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-zinc-600">Username</div><div className="mt-2 text-sm">{username || "Not set"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-zinc-600">Display name</div><div className="mt-2 text-sm">{displayName || "Not set"}</div></div><button onClick={() => setEditing(true)} className="w-full rounded-lg bg-white py-3 text-xs font-black text-black">Edit Profile</button></>}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">CONNECTED ACCOUNTS</span><h2 className="mt-3 text-2xl font-semibold">Social connections.</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between gap-3"><div><b>X</b><p className="mt-1 text-xs text-zinc-500">{xSocial?.providerUsername ? `@${xSocial.providerUsername}` : "Not connected"}</p></div>{xSocial ? <button disabled={busy} onClick={() => void disconnectSocial(xSocial.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-300">Disconnect</button> : <button disabled={busy} onClick={() => void connectSocial("x")} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black">Connect X</button>}</div></div>
              <div className="rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between gap-3"><div><b>Discord</b><p className="mt-1 text-xs text-zinc-500">{discord?.providerUsername ? `@${discord.providerUsername}` : "Not connected"}</p></div>{discord ? <button disabled={busy} onClick={() => void disconnectSocial(discord.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-300">Disconnect</button> : <button disabled={busy} onClick={() => void connectSocial("discord")} className="rounded-lg bg-[#5865F2] px-3 py-2 text-[10px] font-black">Connect Discord</button>}</div></div>
              <p className="text-[11px] leading-5 text-zinc-600">Connections are optional. Your verified Raven Oracle email remains your account login.</p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6 md:col-span-2">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PRIZE WALLETS</span><h2 className="mt-3 text-2xl font-semibold">Your wallet addresses.</h2>
            <p className="mt-2 text-xs text-zinc-500">Add, remove, or choose which wallet should receive prizes.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address"} className="rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" /><select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} className="rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><button disabled={busy} onClick={() => void addWallet()} className="rounded-lg bg-violet-500 px-5 py-3 text-xs font-black text-black disabled:opacity-40">Add Wallet</button></div>
            <div className="mt-5 space-y-2">{wallets.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-600">No wallet addresses added yet.</div> : wallets.map((wallet) => <div key={wallet.id} className="flex flex-col gap-3 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] text-zinc-600">{wallet.chain} · {wallet.network}</span>{wallet.isPrimary && <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-bold text-violet-300">PRIMARY</span>}</div><div className="mt-1 break-all font-mono text-xs">{wallet.address}</div></div><div className="flex shrink-0 gap-2">{!wallet.isPrimary && <button disabled={busy} onClick={() => void makePrimary(wallet.id)} className="rounded-lg border border-violet-500/20 px-3 py-2 text-[10px] font-bold text-violet-300">Make Primary</button>}<button disabled={busy} onClick={() => void removeWallet(wallet.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-300">Remove</button></div></div>)}</div>
          </article>
        </div>
      </section>
    </main>
  );
}
