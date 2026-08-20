"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = {
  id: string;
  email: string | null;
  emailVerifiedAt?: string | null;
  displayName?: string | null;
  username?: string | null;
  role?: string;
  status?: string;
};

type Social = {
  id: string;
  provider: "X" | "DISCORD";
  providerUsername?: string | null;
  displayName?: string | null;
};

type Wallet = {
  id: string;
  address: string;
  chain: string;
  network: string;
  status?: string;
  isPrimary?: boolean;
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function ChainBadge({ chain }: { chain: string }) {
  const label = chain.toUpperCase() === "SOLANA" ? "Solana" : chain;
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-white">
      {label}
    </span>
  );
}

function SocialIcon({ provider }: { provider: "X" | "DISCORD" | "TELEGRAM" }) {
  if (provider === "X") return <span className="text-lg font-semibold text-black">𝕏</span>;
  if (provider === "DISCORD") return <span className="text-sm font-black text-[#5865f2]">◉</span>;
  return <span className="text-base text-sky-500">➤</span>;
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
    setWallets(
      walletResult.wallets.filter(
        (wallet) => wallet.status !== "ARCHIVED" && wallet.status !== "DELETED",
      ),
    );
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackToken = hash.get("token");
    if (callbackToken) {
      localStorage.setItem("raven_token", callbackToken);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    void load().catch(() => {
      localStorage.removeItem("raven_token");
      router.replace("/login?next=/account");
    });
  }, [load, router]);

  const updateProfile = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim() || undefined,
          displayName: displayName.trim() || undefined,
        }),
      });
      await load();
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update profile");
    } finally {
      setBusy(false);
    }
  };

  const connectSocial = async (provider: "x" | "discord") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`);
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${provider} connection is unavailable`);
      setBusy(false);
    }
  };

  const disconnectSocial = async (id: string) => {
    if (!window.confirm("Disconnect this social account?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/social-accounts/${id}`, { method: "DELETE" });
      await load();
      setMessage("Social account disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to disconnect account");
    } finally {
      setBusy(false);
    }
  };

  const addWallet = async () => {
    if (!address.trim()) {
      setError("Enter a wallet address.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/wallets/", {
        method: "POST",
        body: JSON.stringify({ address: address.trim(), chain }),
      });
      setAddress("");
      await load();
      setMessage("Wallet added successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add wallet");
    } finally {
      setBusy(false);
    }
  };

  const removeWallet = async (id: string) => {
    if (!window.confirm("Remove this wallet from your account?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/wallets/${id}`, { method: "DELETE" });
      await load();
      setMessage("Wallet removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove wallet");
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`/wallets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPrimary: true }),
      });
      await load();
      setMessage("Primary wallet updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update primary wallet");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Clear local compatibility state even if the API is unavailable.
    } finally {
      localStorage.removeItem("raven_token");
      router.replace("/");
    }
  };

  const discord = socials.find((social) => social.provider === "DISCORD");
  const xSocial = socials.find((social) => social.provider === "X");
  const primaryWallets = useMemo(() => wallets.filter((wallet) => wallet.isPrimary), [wallets]);
  const otherWallets = useMemo(() => wallets.filter((wallet) => !wallet.isPrimary), [wallets]);

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <section className="mx-auto max-w-lg px-5 py-24 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="mt-5 text-sm text-slate-500">Loading your profile…</p>
        </section>
      </main>
    );
  }

  const initials = (displayName || username || user.email || "R").trim().slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto flex max-w-7xl gap-0 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
          <div className="px-3 pb-5 text-xs font-bold text-slate-900">My Profile</div>
          <nav className="space-y-1">
            <a href="#profile" className="flex items-center gap-3 rounded-lg bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-700"><span>♙</span> Profile</a>
            <a href="#security" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>♢</span> Security</a>
            <a href="#socials" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>◉</span> Social Accounts</a>
            <a href="#wallets" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>▣</span> Wallets</a>
            <a href="#notifications" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>♧</span> Notifications</a>
            <a href="#referrals" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>♧</span> Referrals</a>
            <a href="#activity" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>↶</span> Activity</a>
            <a href="#api-keys" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"><span>⚿</span> API Keys</a>
          </nav>
          <button onClick={() => void logout()} className="mt-16 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50">⇥ Log out</button>
        </aside>

        <section className="min-w-0 flex-1 bg-white px-4 py-5 sm:px-7 lg:px-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-base font-black text-white">{initials}</div>
              <div><h1 className="text-sm font-bold text-slate-900">Welcome back, {username || displayName || "Raven"}</h1><p className="text-[10px] text-slate-500">Manage your account, socials &amp; wallets</p></div>
            </div>
            <button onClick={() => void logout()} className="rounded-lg border border-red-400 px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50">Log out</button>
          </div>

          {(error || message) && <div className="mt-5 space-y-2">{error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</div>}{message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-600">{message}</div>}</div>}

          <div id="profile" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Profile Information</h2><p className="mt-1 text-[10px] text-slate-500">Update your personal details and how others see you.</p></div>{!editing && <button onClick={() => setEditing(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-[10px] font-bold text-white hover:bg-violet-700">Edit</button>}</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-700">Email address</label><div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="min-w-0 truncate text-xs text-slate-600">{user.email || "—"}</span><span className={`ml-3 shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${user.emailVerifiedAt ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{user.emailVerifiedAt ? "✓ Verified" : "Not verified"}</span></div></div>
              <div><label className="text-[10px] font-bold text-slate-700">Username</label>{editing ? <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={32} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /> : <div className="mt-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-700">{username || "Not set"}</div>}</div>
              <div><label className="text-[10px] font-bold text-slate-700">Display name</label>{editing ? <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /> : <div className="mt-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-700">{displayName || "Not set"}</div>}</div>
            </div>
            {editing && <div className="mt-4 flex justify-end gap-2"><button onClick={() => { setEditing(false); setUsername(user.username ?? ""); setDisplayName(user.displayName ?? ""); }} className="rounded-lg border border-slate-200 px-4 py-2 text-[10px] font-bold text-slate-600">Cancel</button><button disabled={busy} onClick={() => void updateProfile()} className="rounded-lg bg-violet-600 px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">Save changes</button></div>}
          </div>

          <div id="socials" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div><h2 className="text-sm font-bold text-slate-900">Social accounts</h2><p className="mt-1 text-[10px] text-slate-500">Verify your identity so we can easily message you about a giveaway or allowlist.</p></div><div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"><SocialIcon provider="DISCORD" /></div><div className="min-w-0"><div className="text-[10px] font-bold text-slate-700">Discord account</div><div className="truncate text-[10px] text-slate-500">{discord?.providerUsername || "Not connected"}</div></div></div>{discord ? <button disabled={busy} onClick={() => void disconnectSocial(discord.id)} className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-[10px] font-bold text-red-500 disabled:opacity-50">Unlink</button> : <button disabled={busy} onClick={() => void connectSocial("discord")} className="shrink-0 rounded-lg bg-[#5865f2] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Connect</button>}</div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"><SocialIcon provider="X" /></div><div className="min-w-0"><div className="text-[10px] font-bold text-slate-700">X account</div><div className="truncate text-[10px] text-slate-500">{xSocial?.providerUsername ? `@${xSocial.providerUsername}` : "Not connected"}</div>{!xSocial && <div className="text-[9px] text-slate-400">Reconnect your X account to support giveaway verification.</div>}</div></div><div className="flex shrink-0 gap-2">{xSocial && <button disabled={busy} onClick={() => void disconnectSocial(xSocial.id)} className="rounded-lg border border-red-300 px-3 py-2 text-[10px] font-bold text-red-500 disabled:opacity-50">Disconnect</button>}<button disabled={busy} onClick={() => void connectSocial("x")} className="rounded-lg border border-violet-300 px-3 py-2 text-[10px] font-bold text-violet-700 disabled:opacity-50">{xSocial ? "Reconnect" : "Connect X"}</button></div></div>
            <div id="telegram" className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"><SocialIcon provider="TELEGRAM" /></div><div className="min-w-0"><div className="text-[10px] font-bold text-slate-700">Telegram account</div><div className="text-[10px] text-slate-500">Telegram connection is not configured in the current account API.</div></div></div><button disabled className="shrink-0 cursor-not-allowed rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-400">Connect Telegram</button></div>
          </div></div>

          <div id="wallets" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Wallets</h2><p className="mt-1 text-[10px] text-slate-500">Add multiple wallets to verify token ownership. All of these wallets can also access your profile.</p></div><button onClick={() => document.getElementById("wallet-address")?.focus()} className="rounded-lg bg-violet-600 px-4 py-2 text-[10px] font-bold text-white hover:bg-violet-700">Add wallet +</button></div><div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]"><input id="wallet-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={chain === "EVM" ? "0x… wallet address" : "Solana wallet address"} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><select value={chain} onChange={(event) => setChain(event.target.value as "EVM" | "SOLANA")} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><button disabled={busy} onClick={() => void addWallet()} className="rounded-lg bg-violet-600 px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">Add</button></div><h3 className="mt-6 text-[10px] font-bold text-slate-700">Primary wallets</h3><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{primaryWallets.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-[10px] text-slate-400 sm:col-span-2 xl:col-span-4">No primary wallets yet.</div> : primaryWallets.map((wallet) => <div key={wallet.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between gap-2"><ChainBadge chain={wallet.chain} /><span className="rounded-full bg-sky-500 px-2 py-1 text-[8px] font-bold text-white">● Primary</span></div><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-600">{shortenAddress(wallet.address)}</div><div className="mt-2 flex items-center justify-between"><span className="text-[8px] text-slate-400">{wallet.network}</span><button disabled={busy} onClick={() => void removeWallet(wallet.id)} className="text-[9px] font-bold text-red-500">Remove</button></div></div>)}</div><h3 className="mt-6 text-[10px] font-bold text-slate-700">Other wallets</h3><div className="mt-2 space-y-2">{otherWallets.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[10px] text-slate-400">No other wallets.</p> : otherWallets.map((wallet) => <div key={wallet.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><ChainBadge chain={wallet.chain} /><span className="text-[9px] text-slate-400">{wallet.network}</span></div><div className="mt-1 font-mono text-[10px] text-slate-600">{shortenAddress(wallet.address)}</div></div><div className="flex gap-2"><button disabled={busy} onClick={() => void makePrimary(wallet.id)} className="rounded-lg border border-violet-200 px-3 py-2 text-[9px] font-bold text-violet-700">Make Primary</button><button disabled={busy} onClick={() => void removeWallet(wallet.id)} className="rounded-lg border border-red-200 px-3 py-2 text-[9px] font-bold text-red-500">Remove</button></div></div>)}</div></div>

          <div id="security" className="mt-5 grid gap-5 md:grid-cols-2"><div id="notifications" className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Notifications</h2><p className="mt-1 text-[10px] text-slate-500">Notification preferences are managed by the current account system.</p></div><div id="activity" className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Activity</h2><p className="mt-1 text-[10px] text-slate-500">Account activity will appear here when the activity API is enabled.</p></div><div id="referrals" className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Referrals</h2><p className="mt-1 text-[10px] text-slate-500">Referral tools are ready to be connected to the referral backend.</p></div><div id="api-keys" className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">API Keys</h2><p className="mt-1 text-[10px] text-slate-500">API key management is not exposed by the current account API.</p></div></div>
          <div className="mt-8 border-t border-slate-200 pt-5 text-[9px] text-slate-400"><Link href="/" className="font-bold text-violet-600 hover:text-violet-700">Raven Oracle</Link> · Account settings</div>
        </section>
      </div>
    </main>
  );
}
