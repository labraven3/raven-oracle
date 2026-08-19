"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const me = await api<{ user: User }>("/auth/me");
    setUser(me.user);
    setUsername(me.user.username ?? "");
    setDisplayName(me.user.displayName ?? "");
    setEmail(me.user.email ?? "");

    const results = await Promise.allSettled([
      api<{ accounts: Social[] }>("/social-accounts/"),
      api<{ wallets: Wallet[] }>("/wallets/"),
    ]);

    if (results[0]?.status === "fulfilled") setSocials(results[0].value.accounts);
    if (results[1]?.status === "fulfilled") {
      setWallets(results[1].value.wallets.filter((wallet) => wallet.status !== "DELETED"));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const token = localStorage.getItem("raven_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        await load();
      } catch {
        // Old/invalid tokens must never fall back to the old Discord-only account screen.
        if (active) {
          localStorage.removeItem("raven_token");
          router.replace("/login");
        }
      }
    };
    void start();
    return () => {
      active = false;
    };
  }, [load, router]);

  const updateProfile = async () => {
    if (!username.trim() && !displayName.trim()) {
      setMessage("Username or display name required.");
      return;
    }
    setBusy(true);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setBusy(false);
    }
  };

  const addWallet = async () => {
    if (!address.trim()) return;
    setBusy(true);
    try {
      await api("/wallets/", {
        method: "POST",
        body: JSON.stringify({ address: address.trim(), chain }),
      });
      setAddress("");
      await load();
      setMessage("Prize address saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save wallet");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("raven_token");
    router.replace("/login");
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-[#06060a] text-zinc-100">
        <SiteHeader />
        <section className="mx-auto max-w-lg px-5 py-24 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-500">Loading your account…</p>
        </section>
      </main>
    );
  }

  const discord = socials.find((social) => social.provider === "DISCORD");
  const xSocial = socials.find((social) => social.provider === "X");

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">MY PROFILE</span>
            <h1 className="mt-3 text-5xl font-medium">Account settings.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Manage your Raven Oracle profile, connected socials, and prize wallet addresses.
            </p>
          </div>
          <button onClick={logout} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-white/5">
            Log out
          </button>
        </div>

        {message && <div className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-xs text-violet-200">{message}</div>}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PROFILE</span>
            <h2 className="mt-3 text-2xl font-semibold">Your profile.</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-600">Email</div>
                <div className="mt-2 break-all text-sm">{email || "Not set"}</div>
                <div className="mt-1 text-[10px] text-emerald-400">{user.emailVerifiedAt ? "Verified" : "Not verified"}</div>
              </div>
              {editing ? (
                <>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" maxLength={32} className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" />
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" maxLength={80} className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold">Cancel</button>
                    <button disabled={busy} onClick={() => void updateProfile()} className="flex-1 rounded-lg bg-violet-500 py-3 text-xs font-black disabled:opacity-40">{busy ? "Saving…" : "Save Changes"}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs text-zinc-600">Username</div>
                    <div className="mt-2 font-mono text-sm">{username || <span className="text-zinc-600">Not set</span>}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs text-zinc-600">Display name</div>
                    <div className="mt-2 text-sm">{displayName || <span className="text-zinc-600">Not set</span>}</div>
                  </div>
                  <button onClick={() => setEditing(true)} className="w-full rounded-lg bg-white py-3 text-xs font-black text-black">Edit Profile</button>
                </>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">CONNECTED ACCOUNTS</span>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between"><b>Discord</b><span className="text-[10px] text-zinc-600">Optional</span></div>
                <p className="mt-2 text-xs text-zinc-500">{discord?.providerUsername ? `@${discord.providerUsername}` : "Not connected"}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between"><b>X</b><span className="text-[10px] text-zinc-600">Optional</span></div>
                <p className="mt-2 text-xs text-zinc-500">{xSocial?.providerUsername ? `@${xSocial.providerUsername}` : "Not connected"}</p>
              </div>
              <p className="text-[11px] leading-5 text-zinc-600">Your Raven Oracle login is your verified email and password. Discord/X are optional profile connections and are never required to open this page.</p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6 md:col-span-2">
            <span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PRIZE WALLETS</span>
            <h2 className="mt-3 text-2xl font-semibold">Where should prizes go?</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address"} className="rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none" />
              <select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} className="rounded-lg border border-white/10 bg-black px-3 py-3 text-xs outline-none">
                <option value="EVM">EVM</option>
                <option value="SOLANA">Solana</option>
              </select>
              <button disabled={busy} onClick={() => void addWallet()} className="rounded-lg bg-violet-500 px-5 py-3 text-xs font-black disabled:opacity-40">Add Wallet</button>
            </div>
            {wallets.length > 0 && <div className="mt-5 space-y-2">{wallets.map((wallet) => <div key={wallet.id} className="rounded-xl border border-white/10 p-4"><div className="text-[10px] text-zinc-600">{wallet.chain} · {wallet.network}</div><div className="mt-1 break-all font-mono text-xs">{wallet.address}</div></div>)}</div>}
          </article>
        </div>
      </section>
    </main>
  );
}
