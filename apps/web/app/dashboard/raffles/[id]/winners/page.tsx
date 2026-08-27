"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type SocialAccount = { provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Winner = {
  id: string;
  selectionRank: number;
  walletAddressSnapshot: string;
  status: string;
  notificationStatus: string;
  selectedAt: string;
  notifiedAt?: string | null;
  user: {
    displayName?: string | null;
    username?: string | null;
    email?: string | null;
    emailVerifiedAt?: string | null;
    socialAccounts?: SocialAccount[];
  };
};
type Raffle = { id: string; title: string; prizeName: string; status: string; winnerCount: number; endsAt?: string };
type GoogleStatus = { connected: boolean; email?: string | null; name?: string | null };

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

function social(winner: Winner, provider: SocialAccount["provider"]) {
  const account = winner.user.socialAccounts?.find((item) => item.provider === provider);
  return account?.providerUsername ?? account?.displayName ?? "";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function WinnerCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [google, setGoogle] = useState<GoogleStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ raffle: Raffle; winners: Winner[]; viewer: string }>(`/raffles/${id}/winners`);
      setRaffle(data.raffle);
      setWinners(data.winners ?? []);
      try {
        const googleStatus = await api<GoogleStatus>(`/raffles/${id}/winners/export/google-sheets/status`);
        setGoogle(googleStatus);
      } catch {
        setGoogle({ connected: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Winner Center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const notify = async (winnerId: string, resend = false) => {
    setBusy(winnerId); setError(""); setMessage("");
    try {
      await api(`/raffles/${id}/winners/${winnerId}/${resend ? "resend" : "notify"}`, { method: "POST" });
      setMessage(resend ? "Winner email resent." : "Winner email sent.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notification failed");
    } finally { setBusy(""); }
  };

  const winnerData = useMemo(() => winners.map((w) => ({
    rank: w.selectionRank,
    name: w.user.displayName || w.user.username || w.user.email || "Winner",
    x: social(w, "X"),
    discord: social(w, "DISCORD"),
    wallet: w.walletAddressSnapshot,
    email: w.user.email || "",
    status: w.status,
    notification: w.notificationStatus,
  })), [winners]);

  const copyWinnerData = async () => {
    setError(""); setMessage("");
    try {
      const header = ["Rank", "Winner", "X Username", "Discord Username", "Wallet Address", "Email", "Status", "Notification Status"];
      const rows = winnerData.map((w) => [String(w.rank), w.name, w.x, w.discord, w.wallet, w.email, w.status, w.notification]);
      const text = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join("\t")).join("\n");
      await navigator.clipboard.writeText(text);
      setMessage("Winner data copied. Paste it into your own Google Sheet.");
    } catch { setError("Could not copy winner data. Please use Export CSV instead."); }
  };

  const openGoogleSheets = () => { window.open("https://sheets.google.com/", "_blank", "noopener,noreferrer"); };
  const connectGoogle = () => {
    const returnTo = `/dashboard/raffles/${encodeURIComponent(String(id))}/winners`;
    window.location.assign(`${API_BASE_URL}/auth/google/connect?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const exportGoogleSheet = async () => {
    setBusy("google-sheet"); setError(""); setMessage("");
    try {
      const data = await api<{ spreadsheetUrl: string; worksheetName?: string; exportId?: string; rowCount?: number; message?: string }>(`/raffles/${id}/winners/export/google-sheets`, { method: "POST", body: JSON.stringify({}) });
      setMessage(`${data.message ?? "Winner Google Sheet created."}${data.worksheetName ? ` Worksheet: ${data.worksheetName}.` : ""}${data.rowCount ? ` ${data.rowCount} winner(s) exported.` : ""}`);
      window.open(data.spreadsheetUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const typed = e as Error & { code?: string };
      setError(typed.code === "GOOGLE_NOT_CONNECTED" ? "Connect Google first, then export the winners." : (typed.message || "Unable to create Google Sheet"));
    } finally { setBusy(""); }
  };

  if (loading) return <main className="min-h-screen bg-[#06060a] text-zinc-500"><SiteHeader/><div className="mx-auto max-w-6xl p-10">Loading Winner Center…</div></main>;

  return <main className="min-h-screen bg-[#06060a] text-zinc-100">
    <SiteHeader/>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/dashboard/raffles/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Raffle operations</Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openGoogleSheets} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black">Open Google Sheets ↗</button>
          <button type="button" onClick={() => void copyWinnerData()} disabled={winners.length === 0} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40">Copy Winner Data</button>
          {google.connected ? (
            <button type="button" onClick={() => void exportGoogleSheet()} disabled={busy === "google-sheet" || winners.length === 0} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy === "google-sheet" ? "Exporting…" : "Export Winners to Google Sheets"}</button>
          ) : (
            <button type="button" onClick={connectGoogle} className="rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white">Connect Google to Export</button>
          )}
          <a href={`${API_BASE_URL}/raffles/${id}/winners/export`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black">Export CSV</a>
        </div>
      </div>

      <section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0c11] p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">WINNER CENTER</span>
            <h1 className="mt-2 text-4xl font-semibold">{raffle?.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">{raffle?.prizeName} · {winners.length} / {raffle?.winnerCount ?? 0} winners</p>
            <p className="mt-2 text-xs text-zinc-600">Raffle ended: {formatDate(raffle?.endsAt)}</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-xs ${google.connected ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-amber-500/20 bg-amber-500/5 text-amber-300"}`}>
            <div className="font-black">Google Sheets</div>
            <div className="mt-1 text-[10px] opacity-80">{google.connected ? `Connected${google.email ? ` · ${google.email}` : ""}` : "Not connected — connect before exporting"}</div>
            {!google.connected && <button type="button" onClick={connectGoogle} className="mt-2 text-[10px] font-black underline underline-offset-2">Connect Google →</button>}
          </div>
        </div>
        <p className="mt-5 text-xs leading-6 text-zinc-600">Google Sheets export includes raffle metadata, wallet, X/Discord, email, winner status, entry information, task verification details, selection time, and raffle end time. Every export receives a unique export ID.</p>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}
      {message && <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">{message}</div>}

      <section className="mt-6 space-y-3">
        {winners.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-zinc-600">No winners have been selected yet.</div> : winners.map((w) => <article key={w.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
          <div className="grid gap-4 lg:grid-cols-[56px_1.5fr_1.2fr_auto] lg:items-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/10 text-lg font-black text-violet-300">#{w.selectionRank}</div>
            <div className="min-w-0"><b className="block truncate">{w.user.displayName || w.user.username || w.user.email || "Winner"}</b><span className="mt-1 block truncate text-xs text-zinc-500">{w.walletAddressSnapshot}</span><span className="mt-1 block text-[10px] text-zinc-600">{w.user.email || "No email"} · {w.user.emailVerifiedAt ? "email verified" : "email not verified"}</span></div>
            <div className="space-y-1 text-[10px] text-zinc-500"><div><span className="text-zinc-700">X:</span> {social(w, "X") || "—"}</div><div><span className="text-zinc-700">Discord:</span> {social(w, "DISCORD") || "—"}</div></div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-lg border border-white/10 px-3 py-2">{w.status}</span><span className="rounded-lg border border-white/10 px-3 py-2">{w.notificationStatus}</span>{w.notificationStatus === "SENT" ? <button disabled={busy === w.id} onClick={() => void notify(w.id, true)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy === w.id ? "Sending…" : "Resend email"}</button> : <button disabled={busy === w.id} onClick={() => void notify(w.id)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy === w.id ? "Sending…" : "Notify winner"}</button>}</div>
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
