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
      // Clear the local compatibility token even if the API is unavailable.
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