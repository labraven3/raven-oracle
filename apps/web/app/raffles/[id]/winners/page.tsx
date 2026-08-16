"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type Winner = {
  id: string;
  userId: string;
  walletAddressSnapshot: string;
  selectionRank: number;
  status: string;
  notificationStatus: string;
  selectedAt: string;
  notifiedAt?: string | null;
  claimedAt?: string | null;
  claimReference?: string | null;
  replacedByWinnerId?: string | null;
  replacementReason?: string | null;
};

type Data = {
  raffle: { id: string; title: string; status: string; winnerCount: number };
  winners: Winner[];
  viewer: "CREATOR" | "WINNER";
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export default function WinnersPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/raffles/${id}/winners`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load winners");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const action = async (path: string, body?: unknown) => {
    setBusy(true); setMessage("");
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally { setBusy(false); }
  };

  if (!data) return <main className="min-h-screen bg-[#07070a] p-10 text-zinc-400">{message || "Loading winners…"}</main>;

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <a href={`/raffles/${id}`} className="text-xs text-zinc-500 hover:text-zinc-200">← Back to raffle</a>
        <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-[#0d0c11] p-7 sm:flex-row sm:items-center">
          <div>
            <p className="text-[9px] font-black tracking-[.2em] text-violet-300/70">WINNER MANAGEMENT</p>
            <h1 className="mt-2 text-3xl font-semibold">{data.raffle.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">{data.raffle.status} · {data.raffle.winnerCount} winner{data.raffle.winnerCount === 1 ? "" : "s"}</p>
          </div>
          {data.viewer === "CREATOR" && data.raffle.status === "CLOSED" && (
            <button disabled={busy} onClick={() => action(`/raffles/${id}/draw`)} className="rounded-xl bg-violet-400 px-5 py-3 text-xs font-black text-black disabled:opacity-50">Draw winners</button>
          )}
        </div>

        {message && <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">{message}</div>}

        <div className="mt-6 space-y-3">
          {data.winners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">No winners selected yet.</div>
          ) : data.winners.map((winner) => (
            <div key={winner.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-400/10 px-2 py-1 text-[9px] font-black text-violet-300">#{winner.selectionRank}</span>
                    <b>{short(winner.walletAddressSnapshot)}</b>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-zinc-400">{winner.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">Selected {new Date(winner.selectedAt).toLocaleString()}</p>
                  {winner.claimReference && <p className="mt-1 text-xs text-emerald-300">Claim reference: {winner.claimReference}</p>}
                  {winner.replacementReason && <p className="mt-1 text-xs text-zinc-500">{winner.replacementReason}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {data.viewer === "CREATOR" && (winner.status === "SELECTED" || winner.status === "NOTIFIED") && (
                    <button disabled={busy || winner.status === "NOTIFIED"} onClick={() => action(`/raffles/${id}/winners/${winner.id}/notify`)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">{winner.status === "NOTIFIED" ? "Notified" : "Notify winner"}</button>
                  )}
                  {data.viewer === "CREATOR" && ["SELECTED", "NOTIFIED"].includes(winner.status) && (
                    <button disabled={busy} onClick={() => action(`/raffles/${id}/winners/${winner.id}/expire`)} className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-300">Expire / replace</button>
                  )}
                  {data.viewer === "WINNER" && winner.status === "NOTIFIED" && (
                    <button disabled={busy} onClick={() => action(`/raffles/${id}/winners/${winner.id}/claim`)} className="rounded-lg bg-emerald-400 px-4 py-2 text-[10px] font-black text-black">Claim prize</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
