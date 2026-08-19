"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = { email: string | null; username?: string | null; displayName?: string | null; emailVerifiedAt?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null };
type Wallet = { address: string; chain: string; isPrimary?: boolean; status?: string };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("raven_token");
    if (!token) { router.replace("/login?next=/dashboard"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/auth/me`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/social-accounts/`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/wallets/`, { headers }).then((r) => r.json()),
    ]).then(([me, social, wallet]) => {
      if (!me.success) throw new Error("Session expired");
      setUser(me.user);
      setSocials(social.accounts ?? []);
      setWallets((wallet.wallets ?? []).filter((w: Wallet) => w.status !== "ARCHIVED" && w.status !== "DELETED"));
    }).catch(() => { localStorage.removeItem("raven_token"); router.replace("/login?next=/dashboard"); });
  }, [router]);

  if (!user) return <main className="grid min-h-screen place-items-center bg-[#06060a] text-zinc-500">Loading your dashboard…</main>;
  const name = user.displayName || user.username || user.email?.split("@")[0] || "Raven user";
  const x = socials.find((s) => s.provider === "X");
  const discord = socials.find((s) => s.provider === "DISCORD");
  const wallet = wallets.find((w) => w.isPrimary) || wallets[0];

  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader /><section className="mx-auto max-w-6xl px-5 py-14">
    <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">DASHBOARD</span>
    <h1 className="mt-3 text-5xl font-medium tracking-tight">Welcome, {name}.</h1>
    <p className="mt-3 text-sm text-zinc-500">Your Raven Oracle account overview.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-4">
      <Card title="EMAIL" value={user.email ?? "Not set"} sub={user.emailVerifiedAt ? "✓ Verified" : "Not verified"} />
      <Card title="X" value={x?.providerUsername ? `@${x.providerUsername}` : "Not connected"} sub="Manage in Account" />
      <Card title="DISCORD" value={discord?.providerUsername ? `@${discord.providerUsername}` : "Not connected"} sub="Manage in Account" />
      <Card title="PRIZE WALLET" value={wallet?.chain ?? "Not added"} sub={wallet?.address ?? "Manage in Account"} />
    </div>
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-7"><h2 className="text-2xl font-semibold">Your account</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Edit your profile, connect X or Discord, and add, remove or change your prize wallet.</p><Link href="/account" className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-xs font-black text-black">Account Settings →</Link></article>
      <article className="rounded-2xl border border-white/10 bg-[#0d0c11] p-7"><h2 className="text-2xl font-semibold">Creator Studio</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Raffle creation and management are separate from your personal dashboard.</p><Link href="/create" className="mt-6 inline-block rounded-lg bg-violet-500 px-5 py-3 text-xs font-black text-black">Create Raffle →</Link></article>
    </div>
  </section></main>;
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><span className="text-[9px] tracking-[.18em] text-zinc-600">{title}</span><b className="mt-3 block break-all text-sm">{value}</b><span className="mt-2 block truncate text-[10px] text-zinc-600">{sub}</span></div>;
}
