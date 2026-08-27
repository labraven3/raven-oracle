"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type SocialAccount = { provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Winner = { id: string; selectionRank: number; walletAddressSnapshot: string; status: string; notificationStatus: string; selectedAt: string; notifiedAt?: string | null; user: { displayName?: string | null; username?: string | null; email?: string | null; emailVerifiedAt?: string | null; socialAccounts?: SocialAccount[] } };
type Raffle = { id: string; title: string; prizeName: string; status: string; winnerCount: number; endsAt?: string };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message ?? `Request failed (${response.status})`);
    (error as Error & { code?: string }).code = data.code;
    throw error;
  }
  return data as T;
}
function social(winner: Winner, provider: SocialAccount["provider"]) { const account = winner.user.socialAccounts?.find((item) => item.provider === provider); return account?.providerUsername ?? account?.displayName ?? ""; }
function formatDate(value?: string) { if (!value) return "—"; return new Date(value).toLocaleString(); }
function prettyStatus(status: string) { return status.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()); }

export default function WinnerCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const winnerData = await api<{ raffle: Raffle; winners: Winner[] }>(`/raffles/${id}/winners`);
      setRaffle(winnerData.raffle); setWinners(winnerData.winners ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load Winner Center"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);

  const downloadWinners = async () => {
    setBusy("export"); setError(""); setMessage("");
    try {
      const headers = new Headers();
      const token = localStorage.getItem("raven_token");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${API_BASE_URL}/raffles/${id}/winners/export`, { headers, credentials: "include", cache: "no-store" });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message ?? `Export failed (${response.status})`); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `raven-oracle-${id}-winners.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setMessage("Winner XLSX downloaded successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to export winners"); }
    finally { setBusy(""); }
  };

  const notify = async (winnerId: string, resend = false) => {
    setBusy(winnerId); setError(""); setMessage("");
    try { await api(`/raffles/${id}/winners/${winnerId}/${resend ? "resend" : "notify"}`, { method: "POST" }); setMessage(resend ? "Winner email resent successfully." : "Winner email sent successfully."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Notification failed"); }
    finally { setBusy(""); }
  };

  if (loading) return <main className="min-h-screen bg-[#06060a] text-zinc-500"><SiteHeader/><div className="mx-auto max-w-6xl p-10">Loading Winner Center…</div></main>;
  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader/><div className="mx-auto max-w-6xl px-5 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={`/dashboard/raffles/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Raffle operations</Link>
      <button type="button" onClick={() => void downloadWinners()} disabled={busy === "export" || raffle?.status !== "COMPLETED" || winners.length === 0} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
        {busy === "export" ? "Preparing XLSX…" : "Download XLSX"}
      </button>
    </div>
    <section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0c11] p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">WINNER CENTER</span><h1 className="mt-2 text-4xl font-semibold">{raffle?.title}</h1><p className="mt-2 text-sm text-zinc-500">{raffle?.prizeName} · {winners.length} / {raffle?.winnerCount ?? 0} winners</p><p className="mt-2 text-xs text-zinc-600">Raffle ended: {formatDate(raffle?.endsAt)}</p></div><div className="max-w-md rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4"><div className="text-[9px] font-black tracking-[.18em] text-emerald-300">WINNER XLSX EXPORT</div><p className="mt-2 text-xs leading-5 text-zinc-400">The XLSX contains only: X, Discord, Wallet Address, Email, and Entered At.</p><p className="mt-3 text-[10px] text-zinc-600">Wallet addresses are exported as text so Excel will not convert them to scientific notation. Google Sheets integration is paused for now.</p></div></div></section>
    {error&&<div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">{message}</div>}
    <section className="mt-6 space-y-3">{winners.length===0?<div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-zinc-600">No winners have been selected yet.</div>:winners.map((w)=><article key={w.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><div className="grid gap-4 lg:grid-cols-[56px_1.5fr_1.2fr_auto] lg:items-center"><div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/10 text-lg font-black text-violet-300">#{w.selectionRank}</div><div className="min-w-0"><b className="block truncate">{w.user.displayName||w.user.username||w.user.email||"Winner"}</b><span className="mt-1 block truncate text-xs text-zinc-500">{w.walletAddressSnapshot}</span><span className="mt-1 block text-[10px] text-zinc-600">{w.user.email||"No email"} · {w.user.emailVerifiedAt?"email verified":"email not verified"}</span></div><div className="space-y-1 text-[10px] text-zinc-500"><div><span className="text-zinc-700">X:</span> {social(w,"X")||"—"}</div><div><span className="text-zinc-700">Discord:</span> {social(w,"DISCORD")||"—"}</div><div className="pt-1 text-zinc-700">Selected: {formatDate(w.selectedAt)}</div></div><div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-lg border border-white/10 px-3 py-2">{prettyStatus(w.status)}</span><span className="rounded-lg border border-white/10 px-3 py-2">{prettyStatus(w.notificationStatus)}</span>{w.notificationStatus==="SENT"?<button disabled={busy===w.id} onClick={()=>void notify(w.id,true)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy===w.id?"Sending…":"Resend email"}</button>:<button disabled={busy===w.id} onClick={()=>void notify(w.id)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy===w.id?"Sending…":"Notify winner"}</button>}</div></div></article>)}</section>
  </div></main>;
}
