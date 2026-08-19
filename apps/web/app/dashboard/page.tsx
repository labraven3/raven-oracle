"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type User = { id: string; email: string | null; displayName?: string | null; username?: string | null };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: string; createdByUserId: string; winnerCount?: number };
type Entry = { id: string; userId: string; walletAddressId: string; status: string; riskScore?: number | null; riskLevel?: string | null; socialVerifiedAtEntry: boolean; enteredAt: string };
type Winner = { id: string; userId: string; walletAddressSnapshot: string; selectionRank: number; status: string; notificationStatus?: string; notifiedAt?: string | null; user?: { email?: string | null; emailVerifiedAt?: string | null; username?: string | null; displayName?: string | null } };

async function api<T>(path: string, options: RequestInit = {}): Promise<T> { const headers = new Headers(options.headers); headers.set("Content-Type", "application/json"); const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null; if (token) headers.set("Authorization", `Bearer ${token}`); const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`); return data as T; }
function short(value: string) { return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value; }
function date(value: string) { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null); const [raffles, setRaffles] = useState<Raffle[]>([]); const [selected, setSelected] = useState<Raffle | null>(null); const [entries, setEntries] = useState<Entry[]>([]); const [winners, setWinners] = useState<Winner[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const me = await api<{ user: User }>("/auth/me");
        setUser(me.user);
        const data = await api<{ raffles: Raffle[] }>("/raffles/");
        setRaffles(data.raffles.filter((r) => r.createdByUserId === me.user.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load creator studio");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);
  const open = async (raffle: Raffle) => { setSelected(raffle); setEntries([]); setWinners([]); setError(""); setMessage(""); try { const [e, w] = await Promise.all([api<{ entries: Entry[] }>(`/raffles/${raffle.id}/entries`), api<{ winners: Winner[] }>(`/raffles/${raffle.id}/winners`)]); setEntries(e.entries); setWinners(w.winners); } catch (x) { setError(x instanceof Error ? x.message : "Unable to load raffle"); } };
  const status = async (next: "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "CANCELLED") => { if (!selected) return; setBusy(true); try { const d = await api<{ raffle: Raffle }>(`/raffles/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }); setSelected(d.raffle); setRaffles((r) => r.map((x) => x.id === d.raffle.id ? d.raffle : x)); setMessage(`Raffle moved to ${next}.`); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update raffle"); } finally { setBusy(false); } };
  const evaluateAll = async () => { if (!selected) return; setBusy(true); try { const next: Entry[] = []; for (const entry of entries) { const d = await api<{ entry: Entry }>(`/raffles/${selected.id}/entries/${entry.id}/evaluate`, { method: "POST" }); next.push(d.entry); } setEntries(next); setMessage("All entries evaluated."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to evaluate entries"); } finally { setBusy(false); } };
  const draw = async () => { if (!selected || !window.confirm("Draw the NFT whitelist winners now? This selection is final.")) return; setBusy(true); try { const d = await api<{ raffle: Raffle; winners: Winner[] }>(`/raffles/${selected.id}/draw`, { method: "POST" }); setSelected(d.raffle); setWinners(d.winners); setRaffles((r) => r.map((x) => x.id === d.raffle.id ? d.raffle : x)); setMessage("Winners selected permanently. Use Winner Center to email them and export the whitelist."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to draw winners"); } finally { setBusy(false); } };
  const notify = async (winnerId: string, resend = false) => { if (!selected) return; setBusy(true); try { const d = await api<{ winner: Winner; message?: string }>(`/raffles/${selected.id}/winners/${winnerId}/${resend ? "resend" : "notify"}`, { method: "POST" }); setWinners((w) => w.map((x) => x.id === winnerId ? d.winner : x)); setMessage(d.message ?? "Winner email sent."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to send winner email"); } finally { setBusy(false); } };
  const stats = useMemo(() => ({ total: entries.length, eligible: entries.filter((e) => e.status === "ELIGIBLE").length, winners: winners.length }), [entries, winners]);
  const exportCsv = async () => { if (!selected) return; setBusy(true); try { const token = localStorage.getItem("raven_token") ?? ""; const response = await fetch(`${API_BASE_URL}/raffles/${selected.id}/winners/export`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Unable to export whitelist"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `raven-oracle-${selected.id}-winners.csv`; a.click(); URL.revokeObjectURL(url); setMessage("Whitelist CSV downloaded."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to export whitelist"); } finally { setBusy(false); } };
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#07070a] text-zinc-500">Loading Creator Studio…</main>;
  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-950/20 font-black text-violet-200">
              R
            </span>
            <span>
              <b className="block text-sm tracking-[.18em]">RAVEN ORACLE</b>
              <small className="text-[9px] tracking-[.16em] text-zinc-600">CREATOR STUDIO</small>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 sm:block">
              {user?.username ?? user?.displayName ?? user?.email}
            </span>
            <Link href="/create" className="rounded-lg bg-violet-500 px-4 py-2.5 text-xs font-black">
              + Create raffle
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">MANAGEMENT</span>
            <h1 className="mt-2 text-5xl font-medium tracking-tight">Your raffles.</h1>
            <p className="mt-3 text-sm text-zinc-600">
              Run NFT whitelist raffles, verify entries, draw permanent winners and deliver wallet lists to projects.
            </p>
          </div>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const me = await api<{ user: User }>("/auth/me");
                setUser(me.user);
                const data = await api<{ raffles: Raffle[] }>("/raffles/");
                setRaffles(data.raffles.filter((r) => r.createdByUserId === me.user.id));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to load creator studio");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold text-zinc-400"
          >
            Refresh
          </button>
        </div>
        {(error || message) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-900/50 bg-red-950/20 text-red-300"
                : "border-emerald-900/50 bg-emerald-950/20 text-emerald-300"
            }`}
          >
            {error || message}
          </div>
        )}
        {raffles.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-zinc-500">You haven&apos;t created a raffle yet.</p>
            <Link
              href="/create"
              className="mt-5 inline-block rounded-lg bg-white px-5 py-3 text-xs font-black text-black"
            >
              Create your first raffle
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {raffles.map((r) => (
              <button
                key={r.id}
                onClick={() => void open(r)}
                className={`grid w-full gap-4 rounded-2xl border p-5 text-left md:grid-cols-[1fr_auto_auto] ${
                  selected?.id === r.id ? "border-violet-400/40 bg-violet-950/10" : "border-white/10 bg-[#0d0c11]"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{r.title}</h2>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black text-zinc-500">
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    {r.prizeName} · {r.prizeQuantity} whitelist spot{r.prizeQuantity === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="self-center text-xs text-zinc-600">Ends {date(r.endsAt)}</span>
                <span className="self-center text-xs font-bold text-violet-300">Manage →</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <section className="mt-8 rounded-2xl border border-violet-300/15 bg-[#0d0c11] p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <span className="text-[9px] font-black tracking-[.2em] text-zinc-600">RAFFLE CONTROL</span>
                <h2 className="mt-2 text-2xl font-bold">{selected.title}</h2>
                <p className="mt-2 text-xs text-zinc-600">{selected.prizeName}</p>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Starts {date(selected.startsAt)} · Ends {date(selected.endsAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.status === "DRAFT" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void status(new Date(selected.startsAt).getTime() > Date.now() ? "SCHEDULED" : "ACTIVE")
                    }
                    className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-black text-black"
                  >
                    Publish
                  </button>
                )}
                {selected.status === "SCHEDULED" && (
                  <button
                    disabled={busy}
                    onClick={() => void status("ACTIVE")}
                    className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-black text-black"
                  >
                    Activate now
                  </button>
                )}
                {(selected.status === "DRAFT" ||
                  selected.status === "SCHEDULED" ||
                  selected.status === "ACTIVE") && (
                  <button
                    disabled={busy}
                    onClick={() => void status("CANCELLED")}
                    className="rounded-lg border border-red-900/40 px-4 py-2.5 text-xs font-bold text-red-300"
                  >
                    Cancel
                  </button>
                )}
                {selected.status === "ACTIVE" && (
                  <button
                    disabled={busy}
                    onClick={() => void status("CLOSED")}
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold"
                  >
                    Close entries
                  </button>
                )}
                {selected.status === "CLOSED" && (
                  <button
                    disabled={busy}
                    onClick={() => void evaluateAll()}
                    className="rounded-lg border border-violet-400/20 px-4 py-2.5 text-xs font-bold text-violet-200"
                  >
                    Evaluate all
                  </button>
                )}
                {selected.status === "CLOSED" && (
                  <button
                    disabled={busy || stats.eligible === 0}
                    onClick={() => void draw()}
                    className="rounded-lg bg-violet-500 px-4 py-2.5 text-xs font-black"
                  >
                    Draw winners
                  </button>
                )}
                {winners.length > 0 && (
                  <>
                    <Link
                      href={`/raffles/${selected.id}/winners`}
                      className="rounded-lg bg-white px-4 py-2.5 text-xs font-black text-black"
                    >
                      Winner Center
                    </Link>
                    <button
                      disabled={busy}
                      onClick={exportCsv}
                      className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold"
                    >
                      Export CSV
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <small className="text-[9px] tracking-[.15em] text-zinc-600">ENTRIES</small>
                <b className="mt-2 block text-2xl">{stats.total}</b>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <small className="text-[9px] tracking-[.15em] text-zinc-600">ELIGIBLE</small>
                <b className="mt-2 block text-2xl text-emerald-300">{stats.eligible}</b>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <small className="text-[9px] tracking-[.15em] text-zinc-600">PERMANENT WINNERS</small>
                <b className="mt-2 block text-2xl text-violet-300">{stats.winners}</b>
              </div>
            </div>
            {winners.length > 0 && (
              <div className="mt-7 rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black tracking-[.18em] text-emerald-400">
                    WHITELIST WINNERS
                  </span>
                  <span className="text-[10px] text-zinc-600">{winners.length} selected</span>
                </div>
                <div className="mt-4 grid gap-3">
                  {winners.map((w) => (
                    <div key={w.id} className="rounded-lg border border-white/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <b>
                            #{w.selectionRank} · {w.user?.username ? `@${w.user.username}` : short(w.userId)}
                          </b>
                          <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                            {w.walletAddressSnapshot}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {w.user?.email ?? "No Gmail"} ·{" "}
                            {w.user?.emailVerifiedAt ? "verified" : "unverified"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black">
                            {w.status}
                          </span>
                          {w.notificationStatus === "SENT" ? (
                            <button
                              disabled={busy}
                              onClick={() => void notify(w.id, true)}
                              className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold"
                            >
                              Resend email
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => void notify(w.id)}
                              className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black"
                            >
                              Send email
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px]">
                        <span className="text-zinc-600">Email: {w.notificationStatus ?? "PENDING"}</span>
                        <span className="font-bold text-emerald-300">Whitelist ready · no claim required</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
