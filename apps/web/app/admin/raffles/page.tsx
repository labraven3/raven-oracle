"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = {
  id: string;
  title: string;
  prizeName: string;
  status: string;
  startsAt: string;
  endsAt: string;
  winnerCount: number;
  cancelledAt?: string | null;
  createdAt: string;
  project?: {
    name: string;
    logoUrl?: string | null;
  } | null;
  createdBy: {
    email?: string | null;
    username?: string | null;
  };
  _count: {
    entries: number;
    winners: number;
    tasks: number;
  };
};

type Winner = {
  id: string;
  selectionRank: number;
  status: string;
  selectedAt: string;
  notifiedAt?: string | null;
  claimedAt?: string | null;
  walletAddressSnapshot: string;
  user: {
    id: string;
    email?: string | null;
    username?: string | null;
    displayName?: string | null;
  };
  entry: {
    id: string;
    status: string;
  };
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminRafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cancelRaffle, setCancelRaffle] = useState<Raffle | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [viewWinners, setViewWinners] = useState<{ raffle: Raffle; winners: Winner[] } | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ success: boolean; raffles: Raffle[] }>("/admin/raffles");
        setRaffles(data.raffles);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load raffles");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const openCancel = (raffle: Raffle) => {
    setCancelRaffle(raffle);
    setCancelReason("");
  };

  const closeCancel = () => {
    setCancelRaffle(null);
    setCancelReason("");
  };

  const executeCancel = async () => {
    if (!cancelRaffle || !cancelReason.trim()) {
      setError("Cancellation reason is required");
      return;
    }

    setBusy(cancelRaffle.id);
    setError("");
    try {
      await api(`/admin/raffles/${cancelRaffle.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: cancelReason }),
      });
      setMessage("Raffle cancelled successfully");
      closeCancel();
      setLoading(true);
      const data = await api<{ success: boolean; raffles: Raffle[] }>("/admin/raffles");
      setRaffles(data.raffles);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  const loadWinners = async (raffle: Raffle) => {
    setBusy(raffle.id);
    setError("");
    try {
      const data = await api<{ success: boolean; raffle: Raffle; winners: Winner[] }>(
        `/admin/raffles/${raffle.id}/winners`
      );
      setViewWinners({ raffle, winners: data.winners });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load winners");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">
              R
            </span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          RAFFLE MANAGEMENT
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Manage raffles.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          View raffle details, cancel raffles, and review winners.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const data = await api<{ success: boolean; raffles: Raffle[] }>("/admin/raffles");
                setRaffles(data.raffles);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to load raffles");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
          >
            Refresh
          </button>
        </div>

        {/* Raffles List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">Loading raffles…</div>
        ) : raffles.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No raffles found.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {raffles.map((raffle) => (
              <article
                key={raffle.id}
                className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"
              >
                <div className="flex gap-5">
                  {raffle.project?.logoUrl && (
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">
                      <img
                        src={raffle.project.logoUrl}
                        alt={`${raffle.project.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{raffle.title}</h2>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${
                          raffle.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : raffle.status === "COMPLETED"
                              ? "bg-blue-500/10 text-blue-300"
                              : raffle.status === "CANCELLED"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        {raffle.status}
                      </span>
                      {raffle.project && (
                        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] text-violet-300">
                          {raffle.project.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">Prize: {raffle.prizeName}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                      <span>{raffle._count.entries} entries</span>
                      <span>•</span>
                      <span>{raffle._count.winners} winners selected</span>
                      <span>•</span>
                      <span>{raffle._count.tasks} tasks</span>
                      <span>•</span>
                      <span>{raffle.winnerCount} winner slots</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                      <span>Starts: {new Date(raffle.startsAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>Ends: {new Date(raffle.endsAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-700">
                      Created by {raffle.createdBy.username || raffle.createdBy.email} •{" "}
                      {new Date(raffle.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  <Link
                    href={`/raffles/${raffle.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold hover:bg-white/5"
                  >
                    View Public Page
                  </Link>
                  {raffle._count.winners > 0 && (
                    <button
                      disabled={busy === raffle.id}
                      onClick={() => void loadWinners(raffle)}
                      className="rounded-lg border border-blue-900/40 px-3 py-2 text-[10px] font-bold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
                    >
                      View Winners ({raffle._count.winners})
                    </button>
                  )}
                  {!raffle.cancelledAt &&
                    !["COMPLETED", "DRAWING"].includes(raffle.status) && (
                      <button
                        disabled={busy === raffle.id}
                        onClick={() => openCancel(raffle)}
                        className="ml-auto rounded-lg border border-red-900/40 px-3 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Cancel Raffle
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Cancel Modal */}
      {cancelRaffle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Cancel Raffle</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Raffle: {cancelRaffle.title}
            </p>
            <p className="mt-2 text-sm text-yellow-300">
              ⚠️ This will cancel the raffle and notify participants.
            </p>

            <div className="mt-6">
              <label className="block text-xs font-bold text-zinc-400">
                Cancellation Reason (Required)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                placeholder="Why is this raffle being cancelled?"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeCancel}
                className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={executeCancel}
                disabled={busy === cancelRaffle.id}
                className="flex-1 rounded-lg bg-red-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {busy === cancelRaffle.id ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winners Modal */}
      {viewWinners && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-auto rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Winners</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {viewWinners.raffle.title}
                </p>
              </div>
              <button
                onClick={() => setViewWinners(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {viewWinners.winners.length === 0 ? (
                <p className="text-center text-sm text-zinc-600">No winners selected yet.</p>
              ) : (
                viewWinners.winners.map((winner) => (
                  <div
                    key={winner.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="text-sm">
                            #{winner.selectionRank} •{" "}
                            {winner.user.displayName ||
                              winner.user.username ||
                              winner.user.email ||
                              "Unknown User"}
                          </b>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                              winner.status === "CLAIMED"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : winner.status === "NOTIFIED"
                                  ? "bg-blue-500/10 text-blue-300"
                                  : "bg-yellow-500/10 text-yellow-300"
                            }`}
                          >
                            {winner.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          Wallet: {winner.walletAddressSnapshot.slice(0, 10)}...
                          {winner.walletAddressSnapshot.slice(-8)}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-700">
                          Selected: {new Date(winner.selectedAt).toLocaleString()}
                        </p>
                        {winner.claimedAt && (
                          <p className="mt-1 text-[10px] text-emerald-300">
                            Claimed: {new Date(winner.claimedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
